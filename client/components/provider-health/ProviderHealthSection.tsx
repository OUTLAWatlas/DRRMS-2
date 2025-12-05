import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ProviderHealthEvent, ProviderHealthSnapshot } from "@shared/api";
import { Activity, AlertTriangle, MapPinned, Radio, SatelliteDish, Signal } from "lucide-react";

const STATUS_THEME: Record<ProviderHealthSnapshot["status"], { label: string; dot: string; pill: string }> = {
  healthy: {
    label: "Healthy",
    dot: "bg-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.65)]",
    pill: "text-emerald-100 bg-emerald-500/10 border-emerald-300/30",
  },
  elevated: {
    label: "Elevated",
    dot: "bg-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.6)]",
    pill: "text-amber-100 bg-amber-500/10 border-amber-200/30",
  },
  degraded: {
    label: "Degraded",
    dot: "bg-orange-400 shadow-[0_0_18px_rgba(249,115,22,0.55)]",
    pill: "text-orange-100 bg-orange-500/10 border-orange-200/30",
  },
  critical: {
    label: "Critical",
    dot: "bg-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.65)]",
    pill: "text-rose-100 bg-rose-500/10 border-rose-200/30",
  },
  offline: {
    label: "Offline",
    dot: "bg-slate-400 shadow-[0_0_12px_rgba(148,163,184,0.45)]",
    pill: "text-slate-100 bg-slate-500/10 border-slate-200/30",
  },
};

const mapBounds = {
  latMin: 5,
  latMax: 37,
  lonMin: 68,
  lonMax: 97,
};

export type ProviderHealthSectionProps = {
  snapshots: ProviderHealthSnapshot[];
  events: ProviderHealthEvent[];
  streaming: boolean;
  enabled: boolean;
  lastUpdatedAt: number | null;
  error: string | null;
  loading?: boolean;
};

export function ProviderHealthSection({
  snapshots,
  events,
  streaming,
  enabled,
  lastUpdatedAt,
  error,
  loading,
}: ProviderHealthSectionProps) {
  if (!enabled) {
    return (
      <Card className="border-dashed border-muted-foreground/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Radio className="h-4 w-4 text-muted-foreground" /> Provider health feed disabled
          </CardTitle>
          <CardDescription>Turn on the provider health feature flag to surface live telemetry.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <section className="space-y-4">
      <Card className="border border-slate-900 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-900 text-slate-100 shadow-2xl">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-400">Provider live feed</p>
            <CardTitle className="text-xl font-semibold text-white">Operational backbone</CardTitle>
            <CardDescription className="text-sm text-slate-300">
              Streaming uptime, SLA posture, and on-call leads for logistics partners.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <Badge
              variant={streaming ? "default" : "outline"}
              className={cn(
                "flex items-center gap-1",
                streaming ? "bg-emerald-500/90" : "border-slate-500 text-slate-200",
              )}
            >
              <Signal className="h-3 w-3" /> {streaming ? "Streaming" : "Reconnecting"}
            </Badge>
            <span className="text-slate-400">
              Last update: {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString() : "n/a"}
            </span>
            {error ? (
              <span className="inline-flex items-center gap-1 text-rose-200">
                <AlertTriangle className="h-3 w-3" /> {error}
              </span>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <ProviderHealthCards snapshots={snapshots} loading={loading} />
            <ProviderCoverageMap snapshots={snapshots} loading={loading} />
          </div>
        </CardContent>
      </Card>

      <ProviderHealthActivity events={events} streaming={streaming} />
    </section>
  );
}

type CardsProps = {
  snapshots: ProviderHealthSnapshot[];
  loading?: boolean;
};

function ProviderHealthCards({ snapshots, loading }: CardsProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-40 bg-slate-800/40" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <Skeleton key={idx} className="h-32 rounded-2xl bg-slate-800/40" />
          ))}
        </div>
      </div>
    );
  }

  if (!snapshots.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-200">
        Waiting for first telemetry window…
      </div>
    );
  }

  const healthy = snapshots.filter((snapshot) => snapshot.status === "healthy").length;
  const degraded = snapshots.filter((snapshot) => snapshot.status === "degraded" || snapshot.status === "critical").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-200">
        <span className="inline-flex items-center gap-1 font-semibold text-emerald-200">
          <Activity className="h-4 w-4" /> {healthy} healthy
        </span>
        <span className="inline-flex items-center gap-1 text-amber-200">
          <AlertTriangle className="h-4 w-4" /> {degraded} degraded/critical
        </span>
        <span className="text-slate-400">{snapshots.length} providers onboarded</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {snapshots.map((snapshot) => (
          <article key={snapshot.providerId} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <header className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-widest text-slate-400">{snapshot.coverageRegion ?? "Unknown zone"}</p>
                <h4 className="text-base font-semibold text-white">{snapshot.providerName}</h4>
              </div>
              <span className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold", STATUS_THEME[snapshot.status].pill)}>
                <span className={cn("h-2.5 w-2.5 rounded-full", STATUS_THEME[snapshot.status].dot)} />
                {STATUS_THEME[snapshot.status].label}
              </span>
            </header>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-slate-400">Uptime</dt>
                <dd className="text-white">{formatPercent(snapshot.uptimePercent)}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Latency</dt>
                <dd className="text-white">{snapshot.latencyMs ? `${snapshot.latencyMs} ms` : "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-400">On-call lead</dt>
                <dd className="text-white">{snapshot.rosterLead ?? "TBD"}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Contact</dt>
                <dd className="text-white">{snapshot.rosterContact ?? "—"}</dd>
              </div>
            </dl>
            <footer className="mt-4 flex items-center justify-between text-[11px] text-slate-400">
              <span>Freshness: {snapshot.freshnessState}</span>
              <span>{snapshot.slaTier?.toUpperCase() ?? "CORE"} SLA</span>
            </footer>
          </article>
        ))}
      </div>
    </div>
  );
}

type MapProps = {
  snapshots: ProviderHealthSnapshot[];
  loading?: boolean;
};

function ProviderCoverageMap({ snapshots, loading }: MapProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-950 to-slate-900 p-4">
      <div className="flex items-center justify-between text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <MapPinned className="h-4 w-4 text-indigo-300" /> Coverage map
        </div>
        <span>{snapshots.length} signals</span>
      </div>
      <div className="mt-3 h-64 w-full overflow-hidden rounded-2xl bg-slate-950/70">
        <div className="relative h-full w-full">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.15),transparent_40%),radial-gradient(circle_at_80%_30%,rgba(56,189,248,0.12),transparent_35%),linear-gradient(120deg,rgba(15,23,42,0.9),rgba(15,23,42,0.6))]" />
          {loading ? (
            <Skeleton className="absolute inset-4 rounded-xl bg-slate-800/40" />
          ) : (
            snapshots.map((snapshot) => {
              if (snapshot.latitude == null || snapshot.longitude == null) return null;
              const left = lonToPercent(snapshot.longitude);
              const top = latToPercent(snapshot.latitude);
              const theme = STATUS_THEME[snapshot.status];
              return (
                <div
                  key={`${snapshot.providerId}-point`}
                  className="absolute"
                  style={{ left: `${left}%`, top: `${top}%` }}
                >
                  <div
                    className={cn(
                      "flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center",
                      "text-[10px] font-semibold tracking-wide",
                    )}
                  >
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-white shadow-lg">
                      {snapshot.providerName.split(" ")[0]}
                    </span>
                    <span className={cn("mt-1 h-3 w-3 rounded-full", theme.dot)} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

type ActivityProps = {
  events: ProviderHealthEvent[];
  streaming: boolean;
};

function ProviderHealthActivity({ events, streaming }: ActivityProps) {
  return (
    <Card className="border border-slate-200/40">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Live activity</p>
            <CardTitle className="text-base">Provider signal stream</CardTitle>
          </div>
          <Badge variant={streaming ? "secondary" : "outline"} className="flex items-center gap-1">
            <SatelliteDish className="h-3 w-3" /> {streaming ? "Live" : "Paused"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent events. Stay tuned for the next update.</p>
        ) : (
          <ul className="space-y-3">
            {events.slice(0, 6).map((event) => (
              <li key={`${event.id}-${event.observedAt}`} className="rounded-xl border border-muted/30 p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{event.providerName}</span>
                  <span>{new Date(event.observedAt).toLocaleTimeString()}</span>
                </div>
                <p className="mt-1 text-sm text-foreground">{event.message}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <Badge variant="outline" className="border-dashed border-current text-current">
                    {event.eventType.replace("_", " ")}
                  </Badge>
                  <span>status → {event.nextStatus ?? "—"}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function lonToPercent(lon: number) {
  const clamped = clamp(mapBounds.lonMin, mapBounds.lonMax, lon);
  return normalize(clamped, mapBounds.lonMin, mapBounds.lonMax) * 100;
}

function latToPercent(lat: number) {
  const clamped = clamp(mapBounds.latMin, mapBounds.latMax, lat);
  const percent = normalize(clamped, mapBounds.latMin, mapBounds.latMax) * 100;
  return 100 - percent;
}

function normalize(value: number, min: number, max: number) {
  if (max === min) return 0;
  return (value - min) / (max - min);
}

function clamp(min: number, max: number, value: number) {
  return Math.min(max, Math.max(min, value));
}

function formatPercent(value: number | null) {
  if (value == null) return "—";
  return `${(value * 100).toFixed(1)}%`;
}
