import { eq } from "drizzle-orm";
import type {
  SchedulerHealthRecord,
  SchedulerHealthStatus,
  SchedulerName,
  SchedulersHealthResponse,
} from "../shared-api";
import { getDb } from "../db";
import { schedulerMetrics } from "../db/schema";

type SchedulerDefinition = {
  name: SchedulerName;
  label: string;
  description: string;
  expectedIntervalMs: number;
};

const schedulerDefinitions: SchedulerDefinition[] = [
  {
    name: "demand_snapshotter",
    label: "Demand snapshotter",
    description: "Generates rolling demand feature buckets for forecasting",
    expectedIntervalMs: readInterval(process.env.DEMAND_SNAPSHOT_INTERVAL_MS, 15 * 60 * 1000),
  },
  {
    name: "predictive_allocation",
    label: "Predictive allocation",
    description: "Produces AI-assisted allocation recommendations",
    expectedIntervalMs: readInterval(process.env.PREDICTIVE_REFRESH_INTERVAL_MS, 5 * 60 * 1000),
  },
  {
    name: "live_feed_refresh",
    label: "Live feed refresh",
    description: "Pulls weather + government alert feeds",
    expectedIntervalMs: readInterval(process.env.LIVE_FEED_REFRESH_INTERVAL_MS, 5 * 60 * 1000),
  },
  {
    name: "provider_health_ingestor",
    label: "Provider health feed",
    description: "Normalizes provider uptime + roster telemetry",
    expectedIntervalMs: readInterval(process.env.PROVIDER_HEALTH_REFRESH_INTERVAL_MS, 30 * 1000),
  },
  {
    name: "transparency_reporter",
    label: "Transparency reporter",
    description: "Seals immutable audit summaries for compliance",
    expectedIntervalMs: readInterval(process.env.TRANSPARENCY_REPORT_INTERVAL_MS, 60 * 60 * 1000),
  },
];

type RecordPayload = {
  name: SchedulerName;
  startedAt: number | Date;
  finishedAt: number | Date;
  success: boolean;
  errorMessage?: string;
};

export async function recordSchedulerRun(payload: RecordPayload) {
  try {
    const db = getDb();
    const finishedMs = toMillis(payload.finishedAt);
    const startedMs = toMillis(payload.startedAt);
    const durationMs = Math.max(0, finishedMs - startedMs);

    const [existing] = await db
      .select()
      .from(schedulerMetrics)
      .where(eq(schedulerMetrics.name, payload.name))
      .limit(1);

    const nextSuccessCount = payload.success ? (existing?.successCount ?? 0) + 1 : existing?.successCount ?? 0;
    const nextErrorCount = payload.success ? existing?.errorCount ?? 0 : (existing?.errorCount ?? 0) + 1;
    const nextConsecutiveFailures = payload.success ? 0 : (existing?.consecutiveFailures ?? 0) + 1;
    const lastSuccessAt = payload.success ? finishedMs : (existing?.lastSuccessAt ?? null);
    const lastErrorAt = payload.success ? (existing?.lastErrorAt ?? null) : finishedMs;
    const lastErrorMessage = payload.success ? null : truncate(payload.errorMessage);
    const updatedAt = Date.now();

    if (existing) {
      await db
        .update(schedulerMetrics)
        .set({
          lastRunAt: finishedMs,
          lastSuccessAt,
          lastErrorAt,
          lastDurationMs: durationMs,
          successCount: nextSuccessCount,
          errorCount: nextErrorCount,
          consecutiveFailures: nextConsecutiveFailures,
          lastErrorMessage,
          updatedAt,
        })
        .where(eq(schedulerMetrics.name, payload.name));
    } else {
      await db.insert(schedulerMetrics).values({
        name: payload.name,
        lastRunAt: finishedMs,
        lastSuccessAt,
        lastErrorAt,
        lastDurationMs: durationMs,
        successCount: nextSuccessCount,
        errorCount: nextErrorCount,
        consecutiveFailures: nextConsecutiveFailures,
        lastErrorMessage,
        updatedAt,
      });
    }
  } catch (error) {
    console.error(`[scheduler-metrics] failed to persist metrics for ${payload.name}`, error);
  }
}

export async function getSchedulerHealthSummary(): Promise<SchedulersHealthResponse> {
  const db = getDb();
  const rows = await db.select().from(schedulerMetrics);
  const now = Date.now();

  const schedulers: SchedulerHealthRecord[] = schedulerDefinitions.map((definition) => {
    const row = rows.find((entry) => entry.name === definition.name);
    const staleForMs = row?.lastRunAt != null ? Math.max(0, now - row.lastRunAt) : null;
    const status = deriveStatus(row, definition, staleForMs);

    return {
      name: definition.name,
      label: definition.label,
      description: definition.description,
      expectedIntervalMs: definition.expectedIntervalMs,
      lastRunAt: row?.lastRunAt ?? null,
      lastSuccessAt: row?.lastSuccessAt ?? null,
      lastErrorAt: row?.lastErrorAt ?? null,
      lastDurationMs: row?.lastDurationMs ?? null,
      successCount: row?.successCount ?? 0,
      errorCount: row?.errorCount ?? 0,
      consecutiveFailures: row?.consecutiveFailures ?? 0,
      staleForMs,
      status,
      lastErrorMessage: row?.lastErrorMessage ?? null,
    };
  });

  return {
    ok: true,
    generatedAt: now,
    schedulers,
  };
}

function deriveStatus(
  row: typeof schedulerMetrics.$inferSelect | undefined,
  definition: SchedulerDefinition,
  staleForMs: number | null,
): SchedulerHealthStatus {
  if (!row?.lastRunAt) return "critical";
  const failureStreak = row.consecutiveFailures ?? 0;
  if (failureStreak >= 3) return "critical";
  if (failureStreak > 0) return "warning";
  if (staleForMs != null) {
    const warningThreshold = definition.expectedIntervalMs * 1.5;
    const criticalThreshold = definition.expectedIntervalMs * 3;
    if (staleForMs > criticalThreshold) return "critical";
    if (staleForMs > warningThreshold) return "warning";
  }
  return "healthy";
}

function toMillis(value: number | Date) {
  return value instanceof Date ? value.getTime() : value;
}

function truncate(message?: string) {
  if (!message) return null;
  return message.length > 280 ? `${message.slice(0, 277)}...` : message;
}

function readInterval(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return fallback;
}
