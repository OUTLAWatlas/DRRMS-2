import { randomUUID } from "node:crypto";
import type { Response } from "express";
import { desc, inArray } from "drizzle-orm";
import {
  providerHealthEvents,
  providerHealthSnapshots,
  providerOncallRosters,
  type ProviderFreshnessState,
  type ProviderHealthEventType,
  type ProviderHealthStatus,
} from "../db/schema";
import { getDb } from "../db";
import { recordSchedulerRun } from "./scheduler-metrics";
import type {
  ProviderHealthEvent,
  ProviderHealthEventSeverity,
  ProviderHealthIngestResponse,
  ProviderHealthSnapshot,
  ProviderHealthStreamEvent,
  ProviderOnCallRoster,
} from "../shared-api";

const STREAM_EVENT_NAME = "provider-health";
const DEFAULT_INTERVAL_MS = readInterval(process.env.PROVIDER_HEALTH_REFRESH_INTERVAL_MS, 30_000);
const DATA_SOURCES = ["status-pings", "sla", "roster"];

const streamClients = new Map<string, Response>();
let schedulerHandle: NodeJS.Timeout | null = null;
let ingestionRunning = false;
let lastIngestedAt: number | null = null;

const PROVIDER_SEEDS: ProviderSeed[] = [
  {
    id: "ngo-rapid-relief",
    name: "Rapid Relief Coalition",
    region: "Konkan Littoral",
    latitude: 18.96,
    longitude: 72.82,
    coverageRadiusKm: 180,
    slaTier: "platinum",
    baseLatencyMs: 240,
    volatility: 0.9,
    shiftMinutes: 6 * 60,
    escalationPolicy: "Incident lead → Deputy → Director",
    roster: [
      { owner: "Ananya Kulkarni", role: "Incident Lead", contact: "+91 90000 11111" },
      { owner: "Samarjit Rao", role: "Ops Lead", contact: "+91 90000 22222" },
      { owner: "Heena Tomar", role: "Ops Lead", contact: "+91 90000 33333" },
    ],
  },
  {
    id: "logi-skylift",
    name: "SkyLift Logistics",
    region: "Godavari Delta",
    latitude: 16.78,
    longitude: 82.21,
    coverageRadiusKm: 220,
    slaTier: "gold",
    baseLatencyMs: 360,
    volatility: 0.7,
    shiftMinutes: 8 * 60,
    escalationPolicy: "Fleet supervisor → Duty chief",
    roster: [
      { owner: "Rohit Seshadri", role: "Fleet Supervisor", contact: "+91 98888 10101" },
      { owner: "Dia Fernandes", role: "Duty Chief", contact: "+91 98888 20202" },
    ],
  },
  {
    id: "ngo-monsoon-shield",
    name: "Monsoon Shield Trust",
    region: "North Bengal Corridor",
    latitude: 26.7,
    longitude: 88.36,
    coverageRadiusKm: 150,
    slaTier: "gold",
    baseLatencyMs: 420,
    volatility: 0.8,
    shiftMinutes: 12 * 60,
    escalationPolicy: "Duty coordinator → Regional head",
    roster: [
      { owner: "Ipsita Sen", role: "Duty Coordinator", contact: "+91 97777 41414" },
      { owner: "Tashi Pradhan", role: "Regional Head", contact: "+91 97777 51515" },
    ],
  },
  {
    id: "tech-aerial-grid",
    name: "Aerial Grid Partners",
    region: "Vindhya Plateau",
    latitude: 23.2,
    longitude: 79.98,
    coverageRadiusKm: 260,
    slaTier: "silver",
    baseLatencyMs: 520,
    volatility: 1.05,
    shiftMinutes: 6 * 60,
    escalationPolicy: "Drone ops → NOC",
    roster: [
      { owner: "Lata Bhosale", role: "Drone Ops", contact: "+91 95555 60606" },
      { owner: "Milan D'Souza", role: "Network Ops", contact: "+91 95555 70707" },
      { owner: "Ekansh Patel", role: "Network Ops", contact: "+91 95555 80808" },
    ],
  },
];

type ProviderSeed = {
  id: string;
  name: string;
  region: string;
  latitude: number;
  longitude: number;
  coverageRadiusKm: number;
  slaTier: "platinum" | "gold" | "silver" | "bronze";
  baseLatencyMs: number;
  volatility: number;
  shiftMinutes: number;
  escalationPolicy: string;
  roster: Array<{ owner: string; role: string; contact: string }>;
};

type SnapshotRow = typeof providerHealthSnapshots.$inferSelect;
type EventRow = typeof providerHealthEvents.$inferSelect;
type RosterRow = typeof providerOncallRosters.$inferSelect;
type SnapshotInsert = typeof providerHealthSnapshots.$inferInsert;
type EventInsert = typeof providerHealthEvents.$inferInsert;
type RosterInsert = typeof providerOncallRosters.$inferInsert;

type IngestionSummary = ProviderHealthIngestResponse;

export function isProviderHealthEnabled() {
  return process.env.PROVIDER_HEALTH_DISABLED !== "true";
}

export function getLastProviderHealthIngestedAt() {
  return lastIngestedAt;
}

export async function ingestProviderHealthTelemetry(now = Date.now()): Promise<IngestionSummary> {
  return runGuardedIngestion(now, false);
}

export function startProviderHealthScheduler() {
  if (schedulerHandle || shouldSkipScheduler()) return;
  if (!isProviderHealthEnabled()) {
    console.info("[provider-health] disabled via flag; scheduler not started");
    return;
  }
  console.info(`[provider-health] scheduler enabled | interval=${DEFAULT_INTERVAL_MS}ms`);
  triggerScheduledIngestion();
  schedulerHandle = setInterval(triggerScheduledIngestion, DEFAULT_INTERVAL_MS);
}

export function stopProviderHealthScheduler() {
  if (schedulerHandle) {
    clearInterval(schedulerHandle);
    schedulerHandle = null;
  }
}

export async function getProviderHealthSnapshots(limit = 24): Promise<ProviderHealthSnapshot[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(providerHealthSnapshots)
    .orderBy(desc(providerHealthSnapshots.observedAt))
    .limit(limit);
  return rows.map(deserializeSnapshot);
}

export async function getRecentProviderHealthEvents(limit = 25): Promise<ProviderHealthEvent[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(providerHealthEvents)
    .orderBy(desc(providerHealthEvents.observedAt))
    .limit(limit);
  return rows.map(deserializeEvent);
}

export function registerProviderHealthStream(res: Response) {
  const id = randomUUID();
  streamClients.set(id, res);
  return id;
}

export function unregisterProviderHealthStream(id: string) {
  streamClients.delete(id);
}

export function writeProviderHealthStreamEvent(res: Response, event: ProviderHealthStreamEvent) {
  res.write(serializeStreamEvent(event));
}

function broadcast(event: ProviderHealthStreamEvent) {
  if (!streamClients.size) return;
  const payload = serializeStreamEvent(event);
  for (const [clientId, client] of streamClients.entries()) {
    try {
      client.write(payload);
    } catch (error) {
      console.warn(`[provider-health] dropping stream client ${clientId} after write failure`, error);
      try {
        client.end();
      } catch {}
      streamClients.delete(clientId);
    }
  }
}

function serializeStreamEvent(event: ProviderHealthStreamEvent) {
  return `event: ${STREAM_EVENT_NAME}\ndata: ${JSON.stringify(event)}\n\n`;
}

async function runGuardedIngestion(now: number, recordMetrics: boolean): Promise<IngestionSummary> {
  if (!isProviderHealthEnabled()) {
    return {
      ingested: 0,
      events: 0,
      rosters: 0,
      updatedProviders: [],
      featureEnabled: false,
      skipped: true,
      reason: "disabled",
    };
  }
  if (ingestionRunning) {
    return {
      ingested: 0,
      events: 0,
      rosters: 0,
      updatedProviders: [],
      featureEnabled: true,
      skipped: true,
      reason: "busy",
    };
  }

  ingestionRunning = true;
  const startedAt = Date.now();
  let success = false;
  let errorMessage: string | undefined;
  try {
    const summary = await performIngestion(now);
    success = true;
    return summary;
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[provider-health] ingestion failed", error);
    throw error;
  } finally {
    ingestionRunning = false;
    if (recordMetrics) {
      await recordSchedulerRun({
        name: "provider_health_ingestor",
        startedAt,
        finishedAt: Date.now(),
        success,
        errorMessage,
      });
    }
  }
}

async function triggerScheduledIngestion() {
  try {
    await runGuardedIngestion(Date.now(), true);
  } catch (error) {
    // error already logged
  }
}

async function performIngestion(now: number): Promise<IngestionSummary> {
  const db = getDb();
  const providerIds = PROVIDER_SEEDS.map((seed) => seed.id);

  const previousSnapshots = providerIds.length
    ? await db
        .select()
        .from(providerHealthSnapshots)
        .where(inArray(providerHealthSnapshots.providerId, providerIds))
    : [];
  const previousSnapshotMap = new Map(previousSnapshots.map((row) => [row.providerId, row]));

  const previousRosters = providerIds.length
    ? await db
        .select()
        .from(providerOncallRosters)
        .where(inArray(providerOncallRosters.providerId, providerIds))
        .orderBy(desc(providerOncallRosters.createdAt))
    : [];
  const rosterMap = new Map<string, RosterRow>();
  for (const roster of previousRosters) {
    if (!rosterMap.has(roster.providerId)) {
      rosterMap.set(roster.providerId, roster);
    }
  }

  const snapshotBroadcast: ProviderHealthSnapshot[] = [];
  const eventBroadcast: ProviderHealthEvent[] = [];
  const rosterBroadcast: ProviderOnCallRoster[] = [];

  for (const seed of PROVIDER_SEEDS) {
    const synthesized = synthesizeSample(seed, now);
    const [row] = await db
      .insert(providerHealthSnapshots)
      .values(synthesized.snapshot)
      .onConflictDoUpdate({
        target: providerHealthSnapshots.providerId,
        set: {
          status: synthesized.snapshot.status,
          uptimePercent: synthesized.snapshot.uptimePercent,
          latencyMs: synthesized.snapshot.latencyMs,
          activeIncidents: synthesized.snapshot.activeIncidents,
          slaTier: synthesized.snapshot.slaTier,
          coverageRegion: synthesized.snapshot.coverageRegion,
          coverageRadiusKm: synthesized.snapshot.coverageRadiusKm,
          latitude: synthesized.snapshot.latitude,
          longitude: synthesized.snapshot.longitude,
          lastPingAt: synthesized.snapshot.lastPingAt,
          freshnessState: synthesized.snapshot.freshnessState,
          dataSources: synthesized.snapshot.dataSources,
          metadata: synthesized.snapshot.metadata,
          observedAt: synthesized.snapshot.observedAt,
          rosterLead: synthesized.snapshot.rosterLead,
          rosterContact: synthesized.snapshot.rosterContact,
          rosterShiftStartsAt: synthesized.snapshot.rosterShiftStartsAt,
          rosterShiftEndsAt: synthesized.snapshot.rosterShiftEndsAt,
        },
      })
      .returning();

    const snapshot = deserializeSnapshot(row);
    snapshotBroadcast.push(snapshot);

    const previous = previousSnapshotMap.get(seed.id);
    if (!previous || previous.status !== snapshot.status) {
      const [eventRow] = await db.insert(providerHealthEvents).values(buildStatusEvent(snapshot, previous)).returning();
      eventBroadcast.push(deserializeEvent(eventRow));
    }

    if (snapshot.uptimePercent != null) {
      const prevUptime = previous?.uptimePercent ?? 1;
      if (snapshot.uptimePercent < 0.9 && prevUptime >= 0.9) {
        const [slaRow] = await db
          .insert(providerHealthEvents)
          .values(buildSlaEvent(snapshot))
          .returning();
        eventBroadcast.push(deserializeEvent(slaRow));
      }
    }

    if (synthesized.roster) {
      const latestRoster = rosterMap.get(seed.id);
      const rosterChanged =
        !latestRoster ||
        latestRoster.shiftStartsAt !== synthesized.roster.shiftStartsAt ||
        latestRoster.shiftOwner !== synthesized.roster.shiftOwner;
      if (rosterChanged) {
        const [rosterRow] = await db.insert(providerOncallRosters).values(synthesized.roster).returning();
        rosterMap.set(seed.id, rosterRow);
        const rosterDto = deserializeRoster(rosterRow);
        rosterBroadcast.push(rosterDto);
        const [rosterEventRow] = await db
          .insert(providerHealthEvents)
          .values(buildRosterEvent(snapshot, rosterDto))
          .returning();
        eventBroadcast.push(deserializeEvent(rosterEventRow));
      }
    }
  }

  lastIngestedAt = now;

  snapshotBroadcast.forEach((entry) => broadcast({ kind: "snapshot", payload: entry }));
  eventBroadcast.forEach((entry) => broadcast({ kind: "event", payload: entry }));
  rosterBroadcast.forEach((entry) => broadcast({ kind: "roster", payload: entry }));

  return {
    ingested: snapshotBroadcast.length,
    events: eventBroadcast.length,
    rosters: rosterBroadcast.length,
    updatedProviders: snapshotBroadcast.map((entry) => entry.providerId),
    featureEnabled: true,
    skipped: false,
  };
}

function synthesizeSample(seed: ProviderSeed, now: number) {
  const bucketWindowMs = 30_000;
  const bucket = Math.floor(now / bucketWindowMs);
  const jitter = pseudoRandom(`${seed.id}:${bucket}`) * seed.volatility;
  const status = pickStatus(jitter);
  const incidents = deriveIncidentCount(status);
  const uptimeBase = clamp(0.65, 0.999, 0.98 - jitter * 0.25 + (seed.volatility - 1) * 0.05);
  const latencyMs = Math.round(seed.baseLatencyMs * (1 + jitter * 0.8));
  const lastPingAt = now - Math.round(bucketWindowMs * (0.4 + jitter));
  const freshness = deriveFreshness(lastPingAt, now);
  const roster = deriveRoster(seed, now);

  const snapshot: SnapshotInsert = {
    providerId: seed.id,
    providerName: seed.name,
    status,
    uptimePercent: Number(uptimeBase.toFixed(3)),
    latencyMs,
    activeIncidents: incidents,
    slaTier: seed.slaTier,
    coverageRegion: seed.region,
    coverageRadiusKm: seed.coverageRadiusKm,
    latitude: seed.latitude,
    longitude: seed.longitude,
    lastPingAt,
    freshnessState: freshness,
    dataSources: DATA_SOURCES.join(","),
    metadata: JSON.stringify({
      sampleWindowMs: bucketWindowMs,
      jitter: Number(jitter.toFixed(3)),
      escalationPolicy: seed.escalationPolicy,
    }),
    observedAt: now,
    rosterLead: roster?.shiftOwner ?? null,
    rosterContact: roster?.contactChannel ?? null,
    rosterShiftStartsAt: roster?.shiftStartsAt ?? null,
    rosterShiftEndsAt: roster?.shiftEndsAt ?? null,
  };

  return { snapshot, roster } satisfies { snapshot: SnapshotInsert; roster?: RosterInsert };
}

function deriveRoster(seed: ProviderSeed, now: number): RosterInsert {
  const shiftLengthMs = Math.max(60_000, seed.shiftMinutes * 60 * 1000);
  const shiftIndex = Math.floor(now / shiftLengthMs);
  const rosterEntry = seed.roster[shiftIndex % seed.roster.length];
  const shiftStartsAt = shiftIndex * shiftLengthMs;
  return {
    providerId: seed.id,
    providerName: seed.name,
    shiftOwner: rosterEntry.owner,
    role: rosterEntry.role,
    contactChannel: rosterEntry.contact,
    escalationPolicy: seed.escalationPolicy,
    shiftStartsAt,
    shiftEndsAt: shiftStartsAt + shiftLengthMs,
    coverageNotes: seed.region,
    metadata: JSON.stringify({ rosterIndex: shiftIndex, rosterSize: seed.roster.length }),
  };
}

function buildStatusEvent(snapshot: ProviderHealthSnapshot, previous?: SnapshotRow): EventInsert {
  return {
    providerId: snapshot.providerId,
    providerName: snapshot.providerName,
    eventType: "status_change",
    previousStatus: previous?.status ?? null,
    nextStatus: snapshot.status,
    severity: deriveSeverity(snapshot.status),
    message: `${snapshot.providerName} is now ${snapshot.status.toUpperCase()}`,
    metadata: JSON.stringify({ uptimePercent: snapshot.uptimePercent, latencyMs: snapshot.latencyMs }),
    observedAt: snapshot.observedAt,
  } satisfies EventInsert;
}

function buildSlaEvent(snapshot: ProviderHealthSnapshot): EventInsert {
  return {
    providerId: snapshot.providerId,
    providerName: snapshot.providerName,
    eventType: "sla_breach",
    previousStatus: snapshot.status,
    nextStatus: snapshot.status,
    severity: "critical",
    message: `SLA ${snapshot.slaTier ?? "core"} breach (${formatPercent(snapshot.uptimePercent)})`,
    metadata: JSON.stringify({
      slaTier: snapshot.slaTier,
      uptimePercent: snapshot.uptimePercent,
      latencyMs: snapshot.latencyMs,
    }),
    observedAt: snapshot.observedAt,
  } satisfies EventInsert;
}

function buildRosterEvent(snapshot: ProviderHealthSnapshot, roster: ProviderOnCallRoster): EventInsert {
  return {
    providerId: snapshot.providerId,
    providerName: snapshot.providerName,
    eventType: "roster_update",
    previousStatus: snapshot.status,
    nextStatus: snapshot.status,
    severity: "info",
    message: `New on-call lead: ${roster.shiftOwner}`,
    metadata: JSON.stringify({
      contactChannel: roster.contactChannel,
      shiftEndsAt: roster.shiftEndsAt,
    }),
    observedAt: snapshot.observedAt,
  } satisfies EventInsert;
}

function deserializeSnapshot(row: SnapshotRow): ProviderHealthSnapshot {
  return {
    id: row.id,
    providerId: row.providerId,
    providerName: row.providerName,
    status: row.status,
    uptimePercent: row.uptimePercent ?? null,
    latencyMs: row.latencyMs ?? null,
    activeIncidents: row.activeIncidents ?? 0,
    slaTier: row.slaTier ?? null,
    coverageRegion: row.coverageRegion ?? null,
    coverageRadiusKm: row.coverageRadiusKm ?? null,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    lastPingAt: row.lastPingAt ?? null,
    freshnessState: row.freshnessState,
    dataSources: row.dataSources ? row.dataSources.split(",").map((token) => token.trim()).filter(Boolean) : [],
    metadata: safeParse(row.metadata),
    observedAt: row.observedAt,
    createdAt: row.createdAt,
    rosterLead: row.rosterLead ?? null,
    rosterContact: row.rosterContact ?? null,
    rosterShiftStartsAt: row.rosterShiftStartsAt ?? null,
    rosterShiftEndsAt: row.rosterShiftEndsAt ?? null,
  };
}

function deserializeEvent(row: EventRow): ProviderHealthEvent {
  const severityFromRow = row.severity;
  const normalizedSeverity: ProviderHealthEventSeverity =
    severityFromRow === "info" || severityFromRow === "warning" || severityFromRow === "critical"
      ? severityFromRow
      : deriveSeverity((row.nextStatus as ProviderHealthStatus | null) ?? "healthy");
  return {
    id: row.id,
    providerId: row.providerId,
    providerName: row.providerName,
    eventType: row.eventType as ProviderHealthEventType,
    previousStatus: (row.previousStatus as ProviderHealthStatus | null) ?? null,
    nextStatus: (row.nextStatus as ProviderHealthStatus | null) ?? null,
    severity: normalizedSeverity,
    message: row.message,
    metadata: safeParse(row.metadata),
    observedAt: row.observedAt,
    createdAt: row.createdAt,
  };
}

function deserializeRoster(row: RosterRow): ProviderOnCallRoster {
  return {
    id: row.id,
    providerId: row.providerId,
    providerName: row.providerName,
    shiftOwner: row.shiftOwner,
    role: row.role ?? null,
    contactChannel: row.contactChannel ?? null,
    escalationPolicy: row.escalationPolicy ?? null,
    shiftStartsAt: row.shiftStartsAt ?? null,
    shiftEndsAt: row.shiftEndsAt ?? null,
    coverageNotes: row.coverageNotes ?? null,
    metadata: safeParse(row.metadata),
    createdAt: row.createdAt,
  };
}

function pickStatus(score: number): ProviderHealthStatus {
  if (score > 0.92) return "offline";
  if (score > 0.82) return "critical";
  if (score > 0.7) return "degraded";
  if (score > 0.55) return "elevated";
  return "healthy";
}

function deriveIncidentCount(status: ProviderHealthStatus) {
  switch (status) {
    case "healthy":
      return 0;
    case "elevated":
      return 1;
    case "degraded":
      return 2;
    case "critical":
      return 3;
    case "offline":
      return 4;
    default:
      return 0;
  }
}

function deriveFreshness(lastPingAt: number | null, now: number): ProviderFreshnessState {
  if (!lastPingAt) return "unknown";
  const age = now - lastPingAt;
  if (age <= 60_000) return "fresh";
  if (age <= 3 * 60_000) return "stale";
  return "unknown";
}

function deriveSeverity(status: ProviderHealthStatus) {
  if (status === "healthy") return "info";
  if (status === "elevated") return "warning";
  return "critical";
}

function pseudoRandom(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return (hash % 10_000) / 10_000;
}

function clamp(min: number, max: number, value: number) {
  return Math.min(max, Math.max(min, value));
}

function safeParse<T = Record<string, unknown>>(value?: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function formatPercent(value: number | null | undefined) {
  if (value == null) return "n/a";
  return `${(value * 100).toFixed(1)}%`;
}

function shouldSkipScheduler() {
  return process.env.NODE_ENV === "test";
}

function readInterval(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return fallback;
}
