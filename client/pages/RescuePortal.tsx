import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { DemandHeatmapGrid, DemandTrendChart } from "@/components/DemandSignals";
import {
  useLiveWeatherQuery,
  useGovernmentAlertsQuery,
  useDemandInsightsQuery,
  useGetRescueRequestsQuery,
  useGetResourcesQuery,
  useGetWarehousesQuery,
  useUpdateRescueRequestMutation,
  useCreateDistributionLogMutation,
  useUpdateResourceMutation,
} from "@/hooks/api-hooks";
import type { GovernmentAlert, RescueRequest, Resource } from "@shared/api";
import { AlertTriangle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type NotificationEntry = { id: string; message: string; area?: string; createdAt: number };

export default function RescuePortal() {
  const liveWeather = useLiveWeatherQuery();
  const alerts = useGovernmentAlertsQuery({ limit: 5 });
  const demandInsights = useDemandInsightsQuery({ buckets: 10 });
  const rescueRequests = useGetRescueRequestsQuery();
  const resourcesQuery = useGetResourcesQuery();
  const warehousesQuery = useGetWarehousesQuery();
  const updateRescueRequest = useUpdateRescueRequestMutation();
  const createDistributionLog = useCreateDistributionLogMutation();
  const updateResourceMutation = useUpdateResourceMutation();

  const requests = rescueRequests.data ?? [];
  const openRequests = useMemo(
    () => requests.filter((r) => r.status === "pending" || r.status === "in_progress"),
    [requests],
  );
  const activeRequest = openRequests[0];
  const highlightedAlert = useMemo(() => selectHighestSeverityAlert(alerts.data?.alerts ?? []), [alerts.data]);
  const availableResources = useMemo(
    () => resourcesQuery.data?.reduce((sum, item) => sum + (item.quantity ?? 0), 0) ?? 0,
    [resourcesQuery.data],
  );
  const peopleNeedingHelp = useMemo(
    () => openRequests.reduce((sum, r) => sum + (r.peopleCount ?? 1), 0),
    [openRequests],
  );
  const estimatedResourceDemand = useMemo(
    () => openRequests.reduce((sum, r) => sum + Math.max(1, r.peopleCount ?? 1), 0),
    [openRequests],
  );
  const warehouseInventory = useMemo(() => {
    const stock = new Map<number, number>();
    resourcesQuery.data?.forEach((resource) => {
      stock.set(resource.warehouseId, (stock.get(resource.warehouseId) ?? 0) + (resource.quantity ?? 0));
    });
    return stock;
  }, [resourcesQuery.data]);
  const resourcesByWarehouse = useMemo(() => {
    const map = new Map<number, Resource[]>();
    resourcesQuery.data?.forEach((resource) => {
      const list = map.get(resource.warehouseId) ?? [];
      list.push(resource);
      map.set(resource.warehouseId, list);
    });
    return map;
  }, [resourcesQuery.data]);
  const warehousesWithInventory = useMemo(() => {
    const ids = new Set<number>();
    resourcesQuery.data?.forEach((resource) => {
      if (resource.quantity > 0) ids.add(resource.warehouseId);
    });
    return ids.size;
  }, [resourcesQuery.data]);
  const defaultDispatchResource = useMemo(
    () => resourcesQuery.data?.find((resource) => resource.quantity > 0) ?? null,
    [resourcesQuery.data],
  );
  const warehouses = warehousesQuery.data ?? [];
  const isDispatching = createDistributionLog.isPending;
  const isRestocking = updateResourceMutation.isPending;

  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const seenAlertIdsRef = useRef<Set<number>>(new Set());

  const handleUpdateRequest = (requestId: number, status: RescueRequest["status"]) => {
    updateRescueRequest.mutate(
      { id: requestId, data: { status } },
      {
        onSuccess: () => toast.success(`Request #${requestId} marked as ${status}`),
        onError: (error: any) => toast.error(error?.message ?? "Unable to update request status"),
      },
    );
  };

  const handleRestockResource = (resourceId: number, delta: number) => {
    const resource = resourcesQuery.data?.find((item) => item.id === resourceId);
    if (!resource) {
      toast.error("Resource not found");
      return;
    }
    const nextQuantity = Math.max(0, resource.quantity + delta);
    updateResourceMutation.mutate(
      { id: resourceId, data: { quantity: nextQuantity } },
      {
        onSuccess: () => toast.success(`Adjusted ${resource.type} stock by ${delta > 0 ? "+" : ""}${delta}`),
        onError: (error: any) => toast.error(error?.message ?? "Unable to update stock"),
      },
    );
  };

  const handleDispatchResource = (resource: Resource, quantity: number, request?: RescueRequest) => {
    if (quantity <= 0) {
      toast.error("Dispatch quantity must be greater than zero");
      return;
    }
    if (resource.quantity < quantity) {
      toast.error("Insufficient stock to dispatch");
      return;
    }
    createDistributionLog.mutate(
      {
        resourceId: resource.id,
        warehouseId: resource.warehouseId,
        quantity,
        destination: request?.location ?? "Rapid response deployment",
        requestId: request?.id,
        notes: request ? `Auto-dispatch for request #${request.id}` : "Manual dispatch from portal",
      },
      {
        onSuccess: () => toast.success(`Dispatched ${quantity} ${resource.unit ?? "units"} of ${resource.type}`),
        onError: (error: any) => toast.error(error?.message ?? "Unable to dispatch resources"),
      },
    );
  };

  useEffect(() => {
    if (!alerts.data?.alerts?.length) return;
    alerts.data.alerts.forEach((alert) => {
      if (seenAlertIdsRef.current.has(alert.id)) return;
      seenAlertIdsRef.current.add(alert.id);
      if (!isHighSeverity(alert.severity)) return;
      setNotifications((prev) => {
        if (prev.some((entry) => entry.id === `ALERT-${alert.id}`)) return prev;
        const next = [
          {
            id: `ALERT-${alert.id}`,
            message: `${alert.headline} (${alert.severity ?? "info"})`,
            area: alert.area ?? undefined,
            createdAt: Date.now(),
          },
          ...prev,
        ];
        return next.slice(0, 25);
      });
    });
  }, [alerts.data?.alerts]);

  return (
    <div>
      <div className="relative h-56 sm:h-64">
        <img
          src="https://images.pexels.com/photos/942320/pexels-photo-942320.jpeg?auto=compress&cs=tinysrgb&w=1600"
          alt="Firefighter"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative z-10 h-full flex items-end">
          <h1 className="container mx-auto pb-4 text-3xl sm:text-4xl font-extrabold text-white">Rescue Portal</h1>
        </div>
      </div>

      <div className="py-10 sm:py-14 container mx-auto space-y-6">
        <h2 className="text-2xl sm:text-3xl font-extrabold">Disaster Response Dashboard</h2>

        {highlightedAlert && (
          <CriticalAlertBanner alert={highlightedAlert} isLoading={alerts.isLoading} />
        )}

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-xl border bg-card p-6">
            <header className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Predictive signal</p>
                <h3 className="text-xl font-semibold">Demand pressure & latency</h3>
              </div>
              <Badge variant="outline">Last {demandInsights.data?.timeline.length ?? 0} buckets</Badge>
            </header>
            <div className="mt-4">
              <DemandTrendChart
                timeline={demandInsights.data?.timeline}
                loading={demandInsights.isLoading}
                error={Boolean(demandInsights.error)}
              />
            </div>
          </div>
          <div className="rounded-xl border bg-card p-6">
            <header className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Supply balance</p>
                <h3 className="text-xl font-semibold">Demand vs inventory heatmap</h3>
              </div>
              <Badge variant="secondary">{demandInsights.data?.heatmap.length ?? 0} hubs</Badge>
            </header>
            <div className="mt-4 space-y-3">
              <DemandHeatmapGrid
                cells={demandInsights.data?.heatmap}
                loading={demandInsights.isLoading}
                error={Boolean(demandInsights.error)}
              />
              {demandInsights.data?.latestBucketStart ? (
                <p className="text-[11px] text-muted-foreground">
                  Snapshot {new Date(demandInsights.data.latestBucketStart).toLocaleString()}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-xl border bg-card p-6">
            <header className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Live Weather</p>
                <h3 className="text-xl font-semibold">Operational window</h3>
              </div>
              <Badge variant="outline">Auto-refresh</Badge>
            </header>
            <div className="mt-4">
              <WeatherPanel query={liveWeather} />
            </div>
          </div>

          <div className="rounded-xl border bg-card p-6">
            <header className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Government Advisories</p>
                <h3 className="text-xl font-semibold">Alert stack</h3>
              </div>
              <Badge variant="secondary">{alerts.data?.alerts?.length ?? 0} active</Badge>
            </header>
            <div className="mt-4">
              <AlertPanel query={alerts} />
            </div>
          </div>
        </section>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <section className="rounded-xl border bg-card p-6">
              <h2 className="text-xl font-bold mb-4">Latest Notifications</h2>
              <ul className="space-y-2 text-sm max-h-48 overflow-auto">
                {notifications.length === 0 && <li className="text-muted-foreground">No notifications yet.</li>}
                {notifications.map((n) => (
                  <li key={n.id} className="flex justify-between border-b pb-2">
                    <span>{n.message}</span>
                    <span className="text-muted-foreground">{new Date(n.createdAt).toLocaleTimeString()}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-xl border bg-card p-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold">Current Rescue</h2>
                <div className="text-sm text-muted-foreground">{activeRequest ? "Active" : "Idle"}</div>
              </div>
              {activeRequest ? (
                <div className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold">#{activeRequest.id} • Priority {activeRequest.priority} • {activeRequest.status}</div>
                    <div className="text-sm text-muted-foreground">{activeRequest.location}</div>
                  </div>
                  <div className="mt-2 text-sm">{activeRequest.details}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      onClick={() => handleUpdateRequest(activeRequest.id, "fulfilled")}
                      disabled={updateRescueRequest.isPending}
                    >
                      Mark Fulfilled
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!defaultDispatchResource || isDispatching || (defaultDispatchResource?.quantity ?? 0) === 0}
                      onClick={() => {
                        if (!defaultDispatchResource) return;
                        const qty = Math.min(10, defaultDispatchResource.quantity);
                        handleDispatchResource(defaultDispatchResource, qty, activeRequest);
                      }}
                    >
                      {defaultDispatchResource
                        ? `Dispatch ${Math.min(10, defaultDispatchResource.quantity)} ${defaultDispatchResource.type}`
                        : "Dispatch Resources"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No active rescues.</div>
              )}
            </section>

            <section className="rounded-xl border bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Requests</h2>
                <div className="text-sm text-muted-foreground">Open: {openRequests.length}</div>
              </div>
              <div className="space-y-3">
                {openRequests.map((r) => (
                  <div key={r.id} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-semibold">#{r.id} • Priority {r.priority}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <span>{r.location}</span>
                        {r.peopleCount ? <Badge variant="outline">{r.peopleCount} people</Badge> : null}
                      </div>
                    </div>
                    <div className="mt-2 text-sm">{r.details}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleUpdateRequest(r.id, "in_progress")}
                        disabled={updateRescueRequest.isPending}
                      >
                        Mark In-Progress
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleUpdateRequest(r.id, "fulfilled")}
                        disabled={updateRescueRequest.isPending}
                      >
                        Fulfill
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateRequest(r.id, "cancelled")}
                        disabled={updateRescueRequest.isPending}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ))}
                {openRequests.length === 0 && (
                  <div className="text-sm text-muted-foreground">No open requests.</div>
                )}
              </div>
            </section>

            <section className="rounded-xl border bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Warehouse Resource Tracker</h2>
                <div className="text-sm text-muted-foreground">Available units: {availableResources}</div>
              </div>
              <div className="space-y-5">
                {warehouses.map((w) => {
                  const totalStock = warehouseInventory.get(w.id) ?? 0;
                  const capacityPct = w.capacity ? Math.min(100, Math.round((totalStock / w.capacity) * 100)) : 0;
                  const warehouseResources = resourcesByWarehouse.get(w.id) ?? [];
                  return (
                    <div key={w.id} className="rounded-lg border p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold">{w.name}</div>
                          <p className="text-xs text-muted-foreground">{w.location}</p>
                        </div>
                        <div className="text-xs text-muted-foreground text-right">
                          Capacity: {w.capacity || "n/a"}<br />
                          Stock: {totalStock}
                        </div>
                      </div>
                      <div>
                        <Progress value={capacityPct} />
                        <p className="mt-2 text-xs text-muted-foreground">
                          {w.capacity ? `${capacityPct}% utilized` : "Capacity not recorded"}
                        </p>
                      </div>
                      <div className="space-y-3">
                        {warehouseResources.length > 0 ? (
                          warehouseResources.slice(0, 3).map((resource) => (
                            <div key={resource.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
                              <div>
                                <p className="font-medium">{resource.type}</p>
                                <p className="text-xs text-muted-foreground">
                                  {resource.quantity} {resource.unit}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => handleRestockResource(resource.id, 20)}
                                  disabled={isRestocking}
                                >
                                  Incoming +20
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDispatchResource(resource, Math.min(10, resource.quantity), activeRequest)}
                                  disabled={resource.quantity === 0 || isDispatching}
                                >
                                  Dispatch 10
                                </Button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-muted-foreground">No inventory assigned to this warehouse.</p>
                        )}
                      </div>
                    </div>
                  );
                })}
                {warehouses.length === 0 && (
                  <p className="text-sm text-muted-foreground">No warehouses configured yet.</p>
                )}
              </div>
            </section>

            <section className="rounded-xl border bg-card p-6">
              <h2 className="text-xl font-bold mb-4">Real-Time Tracking Panel</h2>
              <ul className="space-y-3 text-sm">
                {openRequests.slice(0, 3).map((req) => (
                  <li key={req.id}>
                    Request #{req.id} • {req.priority} priority at {req.location} ({req.peopleCount ?? 1} people waiting)
                  </li>
                ))}
                {openRequests.length === 0 && (
                  <li className="text-muted-foreground">All requests fulfilled and no pending dispatches.</li>
                )}
              </ul>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button
                  onClick={() => defaultDispatchResource && handleRestockResource(defaultDispatchResource.id, 50)}
                  disabled={!defaultDispatchResource || isRestocking}
                >
                  Restock {defaultDispatchResource ? defaultDispatchResource.type : "resource"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!defaultDispatchResource || !activeRequest) return;
                    const qty = Math.min(25, defaultDispatchResource.quantity);
                    handleDispatchResource(defaultDispatchResource, qty, activeRequest);
                  }}
                  disabled={!defaultDispatchResource || !activeRequest || isDispatching || (defaultDispatchResource?.quantity ?? 0) === 0}
                >
                  Dispatch to field
                </Button>
              </div>
              <div className="mt-6 text-sm text-muted-foreground">
                Stock levels update automatically as distribution logs are recorded.
              </div>
            </section>

            <section className="rounded-xl border bg-card p-6">
              <h2 className="text-xl font-bold mb-4">NDRF Activity Reports</h2>
              <NDRFActivity />
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-xl border bg-card p-6">
              <h3 className="text-lg font-bold">Resource Overview</h3>
              <ul className="mt-3 space-y-1 text-sm">
                <li>Current available resources: <strong>{availableResources}</strong></li>
                <li>Open rescue cases: <strong>{openRequests.length}</strong></li>
                <li>People needing help: <strong>{peopleNeedingHelp}</strong></li>
                <li>Estimated kits required: <strong>{estimatedResourceDemand}</strong></li>
                <li>Warehouses with stock: <strong>{warehousesWithInventory}</strong> / {warehouses.length}</li>
              </ul>
            </section>

            <section className="rounded-xl border bg-card p-6">
              <h3 className="text-lg font-bold">Requests Sidebar</h3>
              <ul className="mt-3 space-y-2 text-sm max-h-72 overflow-auto">
                {requests.map((r) => (
                  <li key={r.id} className="flex items-center justify-between">
                    <span>#{r.id}</span>
                    <span className="text-muted-foreground">{r.status}</span>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

export function CriticalAlertBanner({ alert, isLoading }: { alert: GovernmentAlert | null; isLoading: boolean }) {
  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (!alert) return null;

  const variant = getSeverityRank(alert.severity) >= 3 ? "destructive" : "default";
  return (
    <Alert variant={variant} className="border-l-4">
      <AlertTriangle className="h-4 w-4" />
      <div>
        <AlertTitle className="flex flex-wrap items-center gap-2">
          {alert.headline}
          <Badge variant={variant === "destructive" ? "destructive" : "secondary"} className="uppercase">
            {alert.severity ?? "info"}
          </Badge>
        </AlertTitle>
        <AlertDescription className="mt-2 text-sm">
          {alert.summary ?? "Stay alert for additional instructions."}
          <span className="block text-xs text-muted-foreground mt-1">
            {alert.area ? `${alert.area} • ` : ""}
            Issued {alert.issuedAt ? new Date(alert.issuedAt).toLocaleTimeString() : "moments ago"}
          </span>
        </AlertDescription>
      </div>
    </Alert>
  );
}

export function WeatherPanel({ query }: { query: ReturnType<typeof useLiveWeatherQuery> }) {
  if (query.isLoading) return <Skeleton className="h-48 w-full" />;
  if (query.error) return <p className="text-sm text-red-500">Unable to load weather data.</p>;
  if (!query.data) return <p className="text-sm text-muted-foreground">No readings available.</p>;

  const primary = query.data.primary ?? query.data.nearby?.[0];

  return (
    <div className="space-y-4 text-sm">
      {primary ? (
        <div className="rounded-lg border bg-muted/40 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Primary hub</p>
              <p className="text-lg font-semibold">{primary.locationName}</p>
            </div>
            <Badge variant={getSeverityRank(primary.alertLevel) >= 3 ? "destructive" : "secondary"} className="capitalize">
              {primary.alertLevel}
            </Badge>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <dt className="text-xs text-muted-foreground">Temperature</dt>
              <dd className="text-lg font-bold">{primary.temperatureC ?? "—"}°C</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Wind</dt>
              <dd className="text-lg font-bold">{primary.windSpeedKph?.toFixed(1) ?? "—"} km/h</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Humidity</dt>
              <dd className="text-lg font-bold">{primary.humidity ?? "—"}%</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Precipitation</dt>
              <dd className="text-lg font-bold">{primary.precipitationMm ?? "—"} mm</dd>
            </div>
          </dl>
          <p className="mt-3 text-muted-foreground">{primary.condition ?? "Stable conditions"}</p>
          <p className="text-xs text-muted-foreground">Updated {new Date(primary.recordedAt).toLocaleTimeString()}</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Awaiting initial weather readings…</p>
      )}

      {query.data.nearby?.length ? (
        <div className="space-y-2">
          <p className="text-xs uppercase text-muted-foreground">Nearby sensors</p>
          {query.data.nearby.slice(0, 4).map((reading) => (
            <div key={reading.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
              <div>
                <p className="font-medium">{reading.locationName}</p>
                <p className="text-xs text-muted-foreground">{new Date(reading.recordedAt).toLocaleTimeString()}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{reading.temperatureC ?? "—"}°C</p>
                <p className="text-xs text-muted-foreground capitalize">{reading.alertLevel}</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AlertPanel({ query }: { query: ReturnType<typeof useGovernmentAlertsQuery> }) {
  if (query.isLoading) return <Skeleton className="h-48 w-full" />;
  if (query.error) return <p className="text-sm text-red-500">Unable to load alerts.</p>;
  if (!query.data?.alerts?.length) return <p className="text-sm text-muted-foreground">No government advisories right now.</p>;

  return (
    <div className="space-y-3 text-sm">
      {query.data.alerts.slice(0, 4).map((alert) => (
        <div key={alert.id} className="rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold">{alert.headline}</p>
            <Badge variant={getSeverityRank(alert.severity) >= 3 ? "destructive" : "secondary"} className="capitalize">
              {alert.severity ?? "info"}
            </Badge>
          </div>
          <p className="mt-2 text-muted-foreground text-xs">{alert.summary ?? "See full advisory for details."}</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {alert.area ?? "Region-wide"} • {alert.issuedAt ? new Date(alert.issuedAt).toLocaleTimeString() : "recent"}
          </p>
        </div>
      ))}
    </div>
  );
}

const severityOrder: Record<string, number> = {
  extreme: 4,
  severe: 3,
  high: 2,
  moderate: 1,
  minor: 0,
  info: 0,
};

export function getSeverityRank(severity?: string | null) {
  if (!severity) return 0;
  return severityOrder[severity.toLowerCase()] ?? 0;
}

export function isHighSeverity(severity?: string | null) {
  return getSeverityRank(severity) >= 2;
}

export function selectHighestSeverityAlert(alerts: GovernmentAlert[]) {
  if (!alerts.length) return null;
  return alerts.reduce<GovernmentAlert | null>((current, candidate) => {
    if (!current) return candidate;
    return getSeverityRank(candidate.severity) > getSeverityRank(current.severity) ? candidate : current;
  }, null);
}

function NDRFActivity() {
  const [form, setForm] = useState({ sent: 0, stationary: 0, deployed: 0, notes: "", active: true });
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <label className="text-sm font-medium">People sent</label>
          <input
            type="number"
            className="mt-1 h-10 w-full rounded-md border px-3"
            value={form.sent}
            onChange={(e) => setForm((f) => ({ ...f, sent: parseInt(e.target.value || "0") }))}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Stationary</label>
          <input
            type="number"
            className="mt-1 h-10 w-full rounded-md border px-3"
            value={form.stationary}
            onChange={(e) => setForm((f) => ({ ...f, stationary: parseInt(e.target.value || "0") }))}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Deployed</label>
          <input
            type="number"
            className="mt-1 h-10 w-full rounded-md border px-3"
            value={form.deployed}
            onChange={(e) => setForm((f) => ({ ...f, deployed: parseInt(e.target.value || "0") }))}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          id="active"
          type="checkbox"
          checked={form.active}
          onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
        />
        <label htmlFor="active" className="text-sm">Activity status: {form.active ? "Active" : "Paused"}</label>
      </div>
      <div>
        <label className="text-sm font-medium">Notes</label>
        <textarea
          className="mt-1 min-h-[100px] w-full rounded-md border p-3"
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        />
      </div>
      <Button>Save Update</Button>
    </div>
  );
}
