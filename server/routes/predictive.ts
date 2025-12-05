import { Router } from "express";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { getDb } from "../db";
import {
  demandFeatureSnapshots,
  predictiveFeedback,
  predictiveModelRuns,
  predictiveRecommendations,
  requestFeatureSnapshots,
  rescueRequests,
} from "../db/schema";
import { authMiddleware, AuthRequest, rescuerOnly } from "../middleware/auth";
import type {
  DemandInsightsResponse,
  PredictiveRecommendationFeedbackRequest,
  PredictiveRecommendationStatus,
  PredictiveRecommendationsResponse,
} from "@shared/api";

const router = Router();
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const ACTIVE_RECOMMENDATION_STATUSES = ["suggested", "queued"] as const;
const VALID_ACTIONS = new Set(["applied", "dismissed"]);
const SNAPSHOT_BUCKET_MINUTES = Number(process.env.DEMAND_SNAPSHOT_BUCKET_MINUTES ?? 30);
const SNAPSHOT_BUCKET_MS = Math.max(5, SNAPSHOT_BUCKET_MINUTES || 30) * 60 * 1000;
const DEFAULT_BUCKET_LOOKBACK = 12;
const MAX_BUCKET_LOOKBACK = 48;

router.get("/demand-insights", authMiddleware, rescuerOnly, async (req, res) => {
  const db = getDb();
  const bucketsParam = Number(req.query.buckets ?? DEFAULT_BUCKET_LOOKBACK);
  const bucketWindow = Number.isFinite(bucketsParam)
    ? Math.min(Math.max(1, Math.trunc(bucketsParam)), MAX_BUCKET_LOOKBACK)
    : DEFAULT_BUCKET_LOOKBACK;
  const sinceMs = Date.now() - bucketWindow * SNAPSHOT_BUCKET_MS * 2;

  const snapshots = await db
    .select()
    .from(demandFeatureSnapshots)
    .where(gte(demandFeatureSnapshots.bucketStart, sinceMs))
    .orderBy(desc(demandFeatureSnapshots.bucketStart));

  if (!snapshots.length) {
    const empty: DemandInsightsResponse = { latestBucketStart: null, heatmap: [], timeline: [] };
    return res.json(empty);
  }

  const latestBucketStart = Number(snapshots[0]!.bucketStart);
  const latestRows = snapshots.filter((row) => Number(row.bucketStart) === latestBucketStart);

  const heatmap = latestRows.map((row) => ({
    region: row.region,
    resourceType: row.resourceType,
    requestCount: row.requestCount,
    pendingCount: row.pendingCount,
    inventoryAvailable: row.inventoryAvailable ?? 0,
    demandPressure: computeDemandPressure(row.requestCount, row.pendingCount, row.inventoryAvailable),
    medianWaitMins: row.medianWaitMins ?? null,
  }));

  const bucketMap = new Map<number, { pressureSum: number; count: number; waits: number[] }>();
  for (const row of snapshots) {
    const key = Number(row.bucketStart);
    const entry = bucketMap.get(key) ?? { pressureSum: 0, count: 0, waits: [] };
    entry.pressureSum += computeDemandPressure(row.requestCount, row.pendingCount, row.inventoryAvailable);
    entry.count += 1;
    if (row.medianWaitMins != null) {
      entry.waits.push(row.medianWaitMins);
    }
    bucketMap.set(key, entry);
  }

  const timeline = Array.from(bucketMap.entries())
    .sort(([a], [b]) => a - b)
    .slice(-bucketWindow)
    .map(([bucketStart, entry]) => ({
      bucketStart,
      avgDemandPressure: entry.count ? entry.pressureSum / entry.count : 0,
      medianWaitMins: entry.waits.length ? computeMedian(entry.waits) : null,
    }));

  const payload: DemandInsightsResponse = {
    latestBucketStart,
    heatmap,
    timeline,
  };

  res.json(payload);
});

router.get("/recommendations", authMiddleware, rescuerOnly, async (req, res) => {
  const db = getDb();
  const limitParam = Number(req.query.limit ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(1, Math.trunc(limitParam)), MAX_LIMIT)
    : DEFAULT_LIMIT;
  const region = typeof req.query.region === "string" ? req.query.region : undefined;

  const conditions = [inArray(predictiveRecommendations.status, ACTIVE_RECOMMENDATION_STATUSES)];
  if (region) {
    conditions.push(eq(predictiveRecommendations.region, region));
  }
  const whereClause = conditions.length === 1 ? conditions[0]! : and(...conditions);

  const rows = await db
    .select({
      recommendation: predictiveRecommendations,
      request: rescueRequests,
      run: predictiveModelRuns,
      feature: requestFeatureSnapshots,
    })
    .from(predictiveRecommendations)
    .leftJoin(rescueRequests, eq(predictiveRecommendations.requestId, rescueRequests.id))
    .leftJoin(predictiveModelRuns, eq(predictiveRecommendations.modelRunId, predictiveModelRuns.id))
    .leftJoin(requestFeatureSnapshots, eq(predictiveRecommendations.featureSnapshotId, requestFeatureSnapshots.id))
    .where(whereClause)
    .orderBy(
      desc(predictiveRecommendations.impactScore),
      desc(predictiveRecommendations.confidence),
      desc(predictiveRecommendations.createdAt),
    )
    .limit(limit);

  const payload: PredictiveRecommendationsResponse = {
    recommendations: rows.map((row) => ({
      id: row.recommendation.id,
      requestId: row.recommendation.requestId,
      region: row.recommendation.region,
      resourceType: row.recommendation.resourceType,
      suggestedQuantity: row.recommendation.suggestedQuantity,
      confidence: row.recommendation.confidence,
      impactScore: row.recommendation.impactScore,
      leadTimeMinutes: row.recommendation.leadTimeMinutes,
      rationale: row.recommendation.rationale,
      status: row.recommendation.status as PredictiveRecommendationStatus,
          validFrom: toMillis(row.recommendation.validFrom) ?? Date.now(),
          validUntil: toMillis(row.recommendation.validUntil),
      modelVersion: row.run?.version ?? "baseline",
      context: parseContext(row.feature?.modelFeatures ?? null),
      request: row.request
        ? {
            id: row.request.id,
            location: row.request.location,
            priority: row.request.priority,
            peopleCount: row.request.peopleCount,
            status: row.request.status,
          }
        : null,
    })),
  };

  res.json(payload);
});

router.post(
  "/recommendations/:id/feedback",
  authMiddleware,
  rescuerOnly,
  async (req: AuthRequest, res) => {
    const recommendationId = Number(req.params.id);
    if (Number.isNaN(recommendationId)) {
      return res.status(400).json({ error: "Invalid recommendation id" });
    }

    const body = req.body as PredictiveRecommendationFeedbackRequest | undefined;
    if (!body || !VALID_ACTIONS.has(body.action)) {
      return res.status(400).json({ error: "Invalid feedback payload" });
    }

    const db = getDb();
    const rows = await db
      .select()
      .from(predictiveRecommendations)
      .where(eq(predictiveRecommendations.id, recommendationId))
      .limit(1);
    const recommendation = rows[0];
    if (!recommendation) {
      return res.status(404).json({ error: "Recommendation not found" });
    }

    await db.transaction(async (tx) => {
      await tx
        .update(predictiveRecommendations)
        .set({ status: body.action, updatedAt: Date.now() })
        .where(eq(predictiveRecommendations.id, recommendationId));

      await tx.insert(predictiveFeedback).values({
        recommendationId,
        action: body.action,
        actorId: req.user?.userId ?? null,
        notes: body.note ?? null,
      });
    });

    res.json({ message: "Feedback recorded" });
  },
);

export default router;

function parseContext(modelFeatures: string | null | undefined) {
  if (!modelFeatures) return null;
  try {
    const parsed = JSON.parse(modelFeatures) as Record<string, unknown>;
    return {
      avgPending: toNumber(parsed.avgPending),
      avgRequestCount: toNumber(parsed.avgRequestCount),
      avgInventory: toNumber(parsed.avgInventory),
      avgSeverity: toNumber(parsed.avgSeverity),
      demandPressure: toNumber(parsed.demandPressure),
      weatherAlertLevel: typeof parsed.weatherLayer === "string" ? parsed.weatherLayer : null,
      weatherScore: toNumber(parsed.weatherScore),
      sampleCount: toNumber(parsed.sampleCount),
      supplyPressure: toNumber(parsed.supplyPressure),
      timeDecayWeight: toNumber(parsed.timeDecayWeight),
      proximityWeight: toNumber(parsed.proximityWeight),
      hubCapacityWeight: toNumber(parsed.hubCapacityWeight),
      nearestWarehouseId: toNumber(parsed.nearestWarehouseId),
      nearestWarehouseDistanceKm: toNumber(parsed.nearestWarehouseDistanceKm),
      hubCapacityRatio: toNumber(parsed.hubCapacityRatio),
      estimatedTravelMinutes: toNumber(parsed.estimatedTravelMinutes),
    };
  } catch (error) {
    console.warn("Failed to parse model features for predictive context", error);
    return null;
  }
}

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toMillis(value: Date | number | null | undefined) {
  if (value == null) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function computeDemandPressure(requestCount: number, pendingCount: number, inventoryAvailable?: number | null) {
  const numerator = pendingCount + requestCount;
  const inventory = inventoryAvailable ?? 0;
  const denominator = Math.max(1, inventory || numerator || 1);
  return numerator / denominator;
}

function computeMedian(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}
