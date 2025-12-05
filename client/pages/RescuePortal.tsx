import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { ProviderHealthSection } from "@/components/provider-health/ProviderHealthSection";
import { DebouncedSearchInput } from "@/components/filters/SearchInput";
import { StatusPills, type StatusOption } from "@/components/filters/StatusPills";
import { WarehouseFilterSelect } from "@/components/filters/WarehouseFilterSelect";
import { DemandHeatmapGrid, DemandTrendChart } from "@/components/DemandSignals";
import { useZodForm } from "@/hooks/use-zod-form";
import { useListParams } from "@/hooks/use-list-params";
import { useProviderHealthFeed } from "@/hooks/use-provider-health";
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
  useRescueBacklog,
  useWarehouseInventorySummary,
  useGetLowStockResourcesQuery,
  useCreateResourceTransferMutation,
  useGetDistributionLogsQuery,
} from "@/hooks/api-hooks";
import {
  distributionLogFormSchema,
  resourceTransferFormSchema,
  type GovernmentAlert,
  type RescueRequest,
  type Resource,
  type PaginatedRescueRequestsResponse,
  type Warehouse,
} from "@shared/api";
import { AlertTriangle, X } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

type NotificationEntry = { id: string; message: string; area?: string; createdAt: number };

const DEFAULT_REQUEST_PAGE_SIZE = 50;
const REQUEST_PAGE_OPTIONS = [25, 50, 100, 200] as const;
const ANALYTICS_PAGE_LIMIT = 200;
const SLA_TARGET_MINUTES = 6 * 60;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const STATUS_FILTER_OPTIONS: readonly StatusOption<RescueRequest["status"] | "all">[] = [
  { label: "All statuses", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "In progress", value: "in_progress" },
  { label: "Fulfilled", value: "fulfilled" },
  { label: "Cancelled", value: "cancelled" },
];


export default function RescuePortal() {
  const liveWeather = useLiveWeatherQuery();
  const alerts = useGovernmentAlertsQuery({ limit: 5 });
  const demandInsights = useDemandInsightsQuery({ buckets: 10 });
  const { params, setParams } = useListParams("rescuePortal", {
    page: { type: "number", defaultValue: 1 },
    limit: { type: "number", defaultValue: DEFAULT_REQUEST_PAGE_SIZE },
    search: { type: "string", defaultValue: "" },
    status: { type: "string", defaultValue: "all" },
    priority: { type: "string", defaultValue: "all" },
    sortBy: { type: "string", defaultValue: "createdAt" },
    sortDirection: { type: "string", defaultValue: "desc" },
    warehouseId: { type: "number", defaultValue: 0 },
  });

  const requestPage = params.page ?? 1;
  const requestLimit = params.limit ?? DEFAULT_REQUEST_PAGE_SIZE;
  const rescueSearch = params.search ?? "";
  const statusFilter = (params.status as RescueRequest["status"] | "all") ?? "all";
  const priorityFilter = (params.priority as RescueRequest["priority"] | "all") ?? "all";
  const rescueSortBy = (params.sortBy as "createdAt" | "criticalityScore" | "priority") ?? "createdAt";
  const rescueSortDirection = (params.sortDirection as "asc" | "desc") ?? "desc";
  const selectedHubId = params.warehouseId && params.warehouseId > 0 ? params.warehouseId : null;

  const rescueQueryParams = {
    page: requestPage,
    limit: requestLimit,
    status: statusFilter === "all" ? undefined : statusFilter,
    priority: priorityFilter === "all" ? undefined : priorityFilter,
    warehouseId: selectedHubId ?? undefined,
    search: rescueSearch.trim() || undefined,
    sortBy: rescueSortBy,
    sortDirection: rescueSortDirection,
  } as const;

  const analyticsQueryParams = {
    ...rescueQueryParams,
    page: 1,
    limit: Math.max(ANALYTICS_PAGE_LIMIT, requestLimit),
  } as const;

  const rescueRequests = useGetRescueRequestsQuery(rescueQueryParams);
  const rescueBacklog = useRescueBacklog(analyticsQueryParams);
  const requestAnalytics = useGetRescueRequestsQuery(analyticsQueryParams);

  const resourcesQueryParams = { page: 1, limit: 250 } as const;
  const resourcesQuery = useGetResourcesQuery(resourcesQueryParams);
  const warehouseInventorySummary = useWarehouseInventorySummary(resourcesQueryParams);
  const lowStockQuery = useGetLowStockResourcesQuery({
    warehouseId: selectedHubId ?? undefined,
    limit: 15,
    includeDepleted: true,
  });
  const warehousesQuery = useGetWarehousesQuery();
  const updateRescueRequest = useUpdateRescueRequestMutation();
  const createDistributionLog = useCreateDistributionLogMutation();
  const updateResourceMutation = useUpdateResourceMutation();
  const createTransfer = useCreateResourceTransferMutation();
  const distributionLogsQuery = useGetDistributionLogsQuery();
  const queryClient = useQueryClient();
  const providerHealth = useProviderHealthFeed();

  const dispatchForm = useZodForm({
    schema: distributionLogFormSchema,
    defaultValues: {
      resourceId: undefined,
      warehouseId: undefined,
      quantity: undefined,
      destination: "",
      requestId: undefined,
      notes: "",
    },
  });

  const transferForm = useZodForm({
    schema: resourceTransferFormSchema,
    defaultValues: {
      resourceId: undefined,
      toWarehouseId: undefined,
      quantity: undefined,
      note: "",
    },
  });

  const requestPagination = rescueRequests.data?.pagination;
  const requests = rescueRequests.data?.requests ?? [];
  const resourceList = resourcesQuery.data?.resources ?? [];
  const warehouses = warehousesQuery.data ?? [];
  const warehouseNameMap = useMemo(() => {
    const map: Record<number, string> = {};
    warehouses.forEach((warehouse) => {
      map[warehouse.id] = warehouse.name;
    });
    return map;
  }, [warehouses]);
  useEffect(() => {
    if (!warehouses.length) return;
    if (selectedHubId && warehouses.every((warehouse) => warehouse.id !== selectedHubId)) {
      setParams({ warehouseId: warehouses[0].id });
    }
  }, [selectedHubId, warehouses, setParams]);
  const selectedWarehouse = useMemo(() => warehouses.find((w) => w.id === selectedHubId) ?? null, [warehouses, selectedHubId]);
  const visibleRequests = useMemo(() => {
    let list = [...requests];
    if (selectedWarehouse) {
      list = filterRequestsByHub(list, selectedWarehouse);
    }
    const effectiveStatus = statusFilter === "all" ? null : statusFilter;
    if (effectiveStatus) {
      list = list.filter((request) => request.status === effectiveStatus);
    }
    const effectivePriority = priorityFilter === "all" ? null : priorityFilter;
    if (effectivePriority) {
      list = list.filter((request) => request.priority === effectivePriority);
    }
    const searchTerm = rescueSearch.trim().toLowerCase();
    if (searchTerm) {
      list = list.filter((request) => matchesRescueSearch(request, searchTerm));
    }
    list.sort((a, b) => compareRescueRequests(a, b, rescueSortBy, rescueSortDirection));
    return list;
  }, [
    requests,
    selectedWarehouse,
    statusFilter,
    priorityFilter,
    rescueSearch,
    rescueSortBy,
    rescueSortDirection,
  ]);
  const dispatchableRequests = useMemo(() => visibleRequests.slice(0, 25), [visibleRequests]);
  const selectedDispatchResourceId = dispatchForm.watch("resourceId");
  const selectedDispatchResource = useMemo(
    () => resourceList.find((resource) => resource.id === selectedDispatchResourceId) ?? null,
    [selectedDispatchResourceId, resourceList],
  );
  useEffect(() => {
    if (!selectedDispatchResourceId) return;
    if (!selectedDispatchResource) return;
    dispatchForm.setValue("warehouseId", selectedDispatchResource.warehouseId);
  }, [selectedDispatchResourceId, selectedDispatchResource, dispatchForm]);

  const selectedDispatchRequestId = dispatchForm.watch("requestId");
  useEffect(() => {
    if (!selectedDispatchRequestId) return;
    const linkedRequest = visibleRequests.find((request) => request.id === selectedDispatchRequestId);
    if (!linkedRequest?.location) return;
    if (dispatchForm.getValues("destination")) return;
    dispatchForm.setValue("destination", linkedRequest.location);
  }, [selectedDispatchRequestId, visibleRequests, dispatchForm]);

  const selectedTransferResourceId = transferForm.watch("resourceId");
  const selectedTransferResource = useMemo(
    () => resourceList.find((resource) => resource.id === selectedTransferResourceId) ?? null,
    [selectedTransferResourceId, resourceList],
  );
  const activeRequests = useMemo(
    () => visibleRequests.filter((r) => r.status === "in_progress"),
    [visibleRequests],
  );
  const primaryActiveRequest = activeRequests[0] ?? null;
  const pendingRequests = useMemo(
    () => visibleRequests.filter((r) => r.status === "pending"),
    [visibleRequests],
  );
  const highlightedAlert = useMemo(() => selectHighestSeverityAlert(alerts.data?.alerts ?? []), [alerts.data]);
  const backlogSummary = rescueBacklog.data;
  const peopleNeedingHelp = useMemo(
    () => visibleRequests.reduce((sum, request) => sum + Math.max(1, request.peopleCount ?? 1), 0),
    [visibleRequests],
  );
  const estimatedResourceDemand = peopleNeedingHelp;
  const inventorySummary = warehouseInventorySummary.data;
  const warehouseInventoryMap = inventorySummary?.warehouses ?? {};
  const availableResources = inventorySummary?.totalQuantity ?? 0;
  const warehousesWithInventory = Object.values(warehouseInventoryMap).filter((entry) => entry.totalQuantity > 0).length;
  const getWarehouseStock = (warehouseId: number) => warehouseInventoryMap[warehouseId]?.totalQuantity ?? 0;
  const getWarehouseResources = (warehouseId: number) => warehouseInventoryMap[warehouseId]?.resources ?? [];
  const recentCriticalRequests = backlogSummary?.recentCritical ?? [];
  const lowStockAlerts = lowStockQuery.data?.resources ?? [];
  const lowStockTotal = lowStockQuery.data?.meta.total ?? lowStockAlerts.length;
  const depletedResourceCount = lowStockAlerts.filter((resource) => resource.quantity === 0).length;
  const topLowStockAlerts = lowStockAlerts.slice(0, 5);
  const priorityBreakdown = backlogSummary?.priorityBreakdown;
  const analyticsRequests = requestAnalytics.data?.requests ?? [];
  const backlogTotalRecords = requestAnalytics.data?.pagination?.total ?? backlogSummary?.totalRequests ?? 0;
  const burnChartConfig = useMemo<ChartConfig>(
    () => ({
      quantity: { label: "Units dispatched", color: "hsl(var(--chart-2))" },
    }),
    [],
  );
  const fulfillmentStats = useMemo(() => {
    if (!analyticsRequests.length) return null;
    const fulfilled = analyticsRequests.filter(
      (request) => request.status === "fulfilled" && request.createdAt && request.updatedAt,
    );
    if (!fulfilled.length) return null;
    const durations = fulfilled
      .map((request) => Math.max(0, (request.updatedAt ?? request.createdAt) - request.createdAt))
      .sort((a, b) => a - b);
    const totalDuration = durations.reduce((sum, value) => sum + value, 0);
    const targetMs = SLA_TARGET_MINUTES * 60 * 1000;
    const breachCount = durations.filter((value) => value > targetMs).length;
    const now = Date.now();
    const recentCount = fulfilled.filter(
      (request) => now - (request.updatedAt ?? request.createdAt) <= ONE_DAY_MS,
    ).length;
    const medianDuration = calculateMedian(durations);
    return {
      medianMinutes: Math.round(medianDuration / 60000),
      averageMinutes: Math.round(totalDuration / durations.length / 60000),
      breachRate: breachCount / durations.length,
      recentCount,
      sampleSize: fulfilled.length,
    };
  }, [analyticsRequests]);
  const burnDownStats = useMemo(() => {
    const logs = distributionLogsQuery.data ?? [];
    if (!logs.length) {
      return { points: [] as { timestamp: number; label: string; quantity: number }[], last24h: 0, avgDaily: 0 };
    }
    const now = Date.now();
    let last24h = 0;
    let last7d = 0;
    const bucketMap = new Map<number, number>();
    logs.forEach((log) => {
      const createdAt = log.createdAt ?? 0;
      if (now - createdAt <= ONE_DAY_MS) {
        last24h += log.quantity;
      }
      if (now - createdAt <= ONE_DAY_MS * 7) {
        last7d += log.quantity;
      }
      const bucket = startOfDayMs(createdAt);
      bucketMap.set(bucket, (bucketMap.get(bucket) ?? 0) + log.quantity);
    });
    const points = Array.from(bucketMap.entries())
      .sort((a, b) => a[0] - b[0])
      .slice(-7)
      .map(([timestamp, quantity]) => ({
        timestamp,
        label: new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        quantity,
      }));
    const avgDaily = last7d
      ? Math.round(last7d / Math.min(7, Math.max(1, bucketMap.size)))
      : last24h;
    return { points, last24h, avgDaily };
  }, [distributionLogsQuery.data]);
  const burnTrendDelta = burnDownStats.avgDaily
    ? burnDownStats.last24h - burnDownStats.avgDaily
    : 0;
  const backlogCardData = useMemo(
    () => [
      {
        key: "total",
        title: "Backlog volume",
        value: backlogTotalRecords,
        description: backlogSummary
          ? `${backlogSummary.openRequests} open • ${backlogSummary.fulfilled} fulfilled`
          : "Waiting for backlog data",
      },
      {
        key: "pending",
        title: "Pending cases",
        value: backlogSummary?.pending ?? 0,
        description: "Awaiting assignment",
      },
      {
        key: "inProgress",
        title: "Active deployments",
        value: backlogSummary?.inProgress ?? 0,
        description: "Teams mobilized",
      },
      {
        key: "fulfilled24h",
        title: "Fulfilled (24h)",
        value: fulfillmentStats?.recentCount ?? 0,
        description: fulfillmentStats?.sampleSize
          ? `${formatMinutesLabel(fulfillmentStats.medianMinutes ?? null)} median SLA`
          : "Need more completions",
      },
    ],
    [backlogSummary, backlogTotalRecords, fulfillmentStats],
  );
  const cachedStatusBreakdown = useMemo(() => {
    const snapshot: Record<RescueRequest["status"] | "total", number> = {
      total: 0,
      pending: 0,
      in_progress: 0,
      fulfilled: 0,
      cancelled: 0,
    };

    const cacheEntries = queryClient.getQueriesData({ queryKey: ["rescueRequests", "list"] });
    cacheEntries.forEach(([, data]) => {
      if (!data || typeof data !== "object" || !("requests" in data)) return;
      const typed = data as PaginatedRescueRequestsResponse;
      typed.requests.forEach((request) => {
        snapshot.total += 1;
        snapshot[request.status] += 1;
      });
    });

    return snapshot;
  }, [queryClient, rescueRequests.dataUpdatedAt, requestAnalytics.dataUpdatedAt]);
  const filterChips = useMemo(() => {
    const chips: { key: string; label: string; onClear: () => void }[] = [];
    if (statusFilter !== "all") {
      chips.push({
        key: "status",
        label: `Status: ${statusFilter.replace("_", " ")}`,
        onClear: () => setParams({ status: "all", page: 1 }),
      });
    }
    if (priorityFilter !== "all") {
      chips.push({
        key: "priority",
        label: `Priority: ${priorityFilter}`,
        onClear: () => setParams({ priority: "all", page: 1 }),
      });
    }
    if (selectedHubId) {
      chips.push({
        key: "hub",
        label: `Hub: ${warehouseNameMap[selectedHubId] ?? `Warehouse ${selectedHubId}`}`,
        onClear: () => setParams({ warehouseId: 0, page: 1 }),
      });
    }
    if (rescueSearch.trim()) {
      chips.push({
        key: "search",
        label: `Search: “${rescueSearch.trim()}”`,
        onClear: () => setParams({ search: "", page: 1 }),
      });
    }
    return chips;
  }, [priorityFilter, rescueSearch, selectedHubId, setParams, statusFilter, warehouseNameMap]);

  const clearAllFilters = () => {
    setParams({ status: "all", priority: "all", search: "", warehouseId: 0, page: 1 });
  };
  const defaultDispatchResource = useMemo(
    () =>
      resourceList.find(
        (resource) =>
          resource.quantity > 0 && (selectedHubId == null || resource.warehouseId === selectedHubId),
      ) ?? null,
    [resourceList, selectedHubId],
  );
  const isDispatching = createDistributionLog.isPending || dispatchForm.formState.isSubmitting;
  const isRestocking = updateResourceMutation.isPending;
  const isTransferring = createTransfer.isPending || transferForm.formState.isSubmitting;

  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const seenAlertIdsRef = useRef<Set<number>>(new Set());
  const currentRequestPage = requestPagination?.page ?? requestPage;
  const totalRequestPages = Math.max(1, requestPagination?.totalPages ?? 1);
  const canPrevRequests = currentRequestPage > 1;
  const canNextRequests = currentRequestPage < totalRequestPages;

  useEffect(() => {
    if (requestPagination?.totalPages && requestPage > requestPagination.totalPages) {
      setParams({ page: Math.max(1, requestPagination.totalPages) });
    }
  }, [requestPage, requestPagination?.totalPages, setParams]);

  const handleUpdateRequest = (
    requestId: number,
    status: RescueRequest["status"],
  ) => {
    updateRescueRequest.mutate(
      { id: requestId, data: { status } },
      {
        onSuccess: () => {
          toast.success(`Request #${requestId} marked as ${status}`);
        },
        onError: (error: any) => toast.error(error?.message ?? "Unable to update request status"),
      },
    );
  };

  const handleRestockResource = (resourceId: number, delta: number) => {
    const resource = resourceList.find((item) => item.id === resourceId);
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

  const submitDispatchLog = dispatchForm.handleSubmit((values) => {
    createDistributionLog.mutate(values, {
      onSuccess: () => {
        toast.success("Dispatch recorded");
        dispatchForm.reset();
      },
      onError: (error: any) => {
        const message = error?.message ?? "Unable to record dispatch";
        toast.error(message);
        dispatchForm.setError("root", { type: "server", message });
      },
    });
  });

  const submitTransferLog = transferForm.handleSubmit((values) => {
    const resource = resourceList.find((item) => item.id === values.resourceId);
    if (resource && resource.warehouseId === values.toWarehouseId) {
      transferForm.setError("toWarehouseId", { type: "manual", message: "Select a different destination" });
      return;
    }
    createTransfer.mutate(values, {
      onSuccess: () => {
        toast.success("Transfer recorded");
        transferForm.reset();
      },
      onError: (error: any) => {
        const message = error?.message ?? "Unable to record transfer";
        toast.error(message);
        transferForm.setError("root", { type: "server", message });
      },
    });
  });

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
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold">Disaster Response Dashboard</h2>
            <p className="text-sm text-muted-foreground">
              Filter incidents by operational hub to keep teams focused on their city and its neighbouring corridors.
            </p>
          </div>
          <div className="w-full sm:max-w-sm space-y-2">
            <WarehouseFilterSelect
              label="Operational hub"
              value={selectedHubId}
              onChange={(value) => setParams({ warehouseId: value ?? 0, page: 1 })}
              warehouses={warehouses}
              isLoading={warehousesQuery.isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Requests refresh automatically for {selectedWarehouse?.name ?? "all hubs"}. Apply filters below to narrow
              the view.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <DebouncedSearchInput
              label="Search"
              placeholder="Keyword or location"
              value={rescueSearch}
              onCommit={(value) => setParams({ search: value, page: 1 })}
            />
          </div>
          <div className="lg:col-span-4 space-y-1">
            <Label className="text-xs uppercase tracking-wide">Status</Label>
            <StatusPills
              value={statusFilter}
              onChange={(value) => setParams({ status: value, page: 1 })}
              options={STATUS_FILTER_OPTIONS}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide">Priority</Label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={priorityFilter}
              onChange={(event) => setParams({ priority: event.target.value as typeof priorityFilter, page: 1 })}
            >
              <option value="all">All priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide">Sort by</Label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={rescueSortBy}
              onChange={(event) => setParams({ sortBy: event.target.value as typeof rescueSortBy, page: 1 })}
            >
              <option value="createdAt">Most recent</option>
              <option value="criticalityScore">Criticality score</option>
              <option value="priority">Priority</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide">Direction</Label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={rescueSortDirection}
              onChange={(event) => setParams({ sortDirection: event.target.value as typeof rescueSortDirection, page: 1 })}
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide">Page size</Label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={requestLimit}
              onChange={(event) => setParams({ limit: Number(event.target.value), page: 1 })}
            >
              {REQUEST_PAGE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option} per page
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">Cached total: {cachedStatusBreakdown.total.toLocaleString()}</Badge>
          <Badge variant="secondary">Pending: {cachedStatusBreakdown.pending.toLocaleString()}</Badge>
          <Badge variant="secondary">In progress: {cachedStatusBreakdown.in_progress.toLocaleString()}</Badge>
          <Badge variant="secondary">Fulfilled: {cachedStatusBreakdown.fulfilled.toLocaleString()}</Badge>
        </div>

        {filterChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {filterChips.map((chip) => (
              <Button
                key={chip.key}
                size="sm"
                variant="secondary"
                className="h-7 rounded-full px-3"
                onClick={chip.onClear}
              >
                <span>{chip.label}</span>
                <X className="ml-1 h-3 w-3" />
              </Button>
            ))}
            <Button size="sm" variant="ghost" className="h-7" onClick={clearAllFilters}>
              Reset filters
            </Button>
          </div>
        )}

        <ProviderHealthSection
          snapshots={providerHealth.snapshots}
          events={providerHealth.events}
          streaming={providerHealth.streaming}
          enabled={providerHealth.enabled}
          lastUpdatedAt={providerHealth.lastUpdatedAt}
          error={providerHealth.error}
          loading={providerHealth.loading}
        />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {backlogCardData.map((card) => (
            <Card key={card.key} className="border border-border/60">
              <CardHeader className="space-y-1">
                <CardTitle className="text-sm font-semibold text-muted-foreground">{card.title}</CardTitle>
                <CardDescription>{card.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {rescueBacklog.isLoading || requestAnalytics.isLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">{card.value.toLocaleString()}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Fulfillment SLA</CardTitle>
              <CardDescription>Median completion time for fulfilled requests.</CardDescription>
            </CardHeader>
            <CardContent>
              {requestAnalytics.isLoading ? (
                <Skeleton className="h-28 w-full" />
              ) : requestAnalytics.error ? (
                <p className="text-sm text-destructive">Unable to load SLA metrics.</p>
              ) : fulfillmentStats ? (
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Median</p>
                    <p className="text-2xl font-bold text-foreground">
                      {formatMinutesLabel(fulfillmentStats.medianMinutes)}
                    </p>
                    <p className="text-xs text-muted-foreground">Based on {fulfillmentStats.sampleSize} records</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Average</p>
                    <p className="text-2xl font-bold text-foreground">
                      {formatMinutesLabel(fulfillmentStats.averageMinutes)}
                    </p>
                    <p className="text-xs text-muted-foreground">Rolling lookback</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">SLA Breach</p>
                    <p className="text-2xl font-bold text-foreground">
                      {Math.round((fulfillmentStats.breachRate || 0) * 100)}%
                    </p>
                    <p className="text-xs text-muted-foreground">&gt;{SLA_TARGET_MINUTES / 60}h target</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No fulfilled requests in this window.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Resource burn-down</CardTitle>
              <CardDescription>Dispatch volume over the last week.</CardDescription>
            </CardHeader>
            <CardContent>
              {distributionLogsQuery.isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : distributionLogsQuery.error ? (
                <p className="text-sm text-destructive">Unable to load burn-down data.</p>
              ) : burnDownStats.points.length ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-3 text-sm">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Dispatched 24h</p>
                      <p className="text-2xl font-bold text-foreground">{burnDownStats.last24h.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Avg daily</p>
                      <p className="text-2xl font-bold text-foreground">{burnDownStats.avgDaily.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Trend</p>
                      <p className="text-2xl font-bold text-foreground">
                        {burnTrendDelta > 0 ? "+" : ""}
                        {burnTrendDelta.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {burnTrendDelta > 0 ? "Faster than avg" : burnTrendDelta < 0 ? "Below avg" : "On target"}
                      </p>
                    </div>
                  </div>
                  <ChartContainer config={burnChartConfig} className="mt-4 h-56 w-full">
                    <AreaChart data={burnDownStats.points} margin={{ left: 8, right: 12, top: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} width={40} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area
                        type="monotone"
                        dataKey="quantity"
                        stroke="var(--color-quantity)"
                        fill="var(--color-quantity)"
                        fillOpacity={0.2}
                        strokeWidth={2}
                        name="Dispatches"
                      />
                    </AreaChart>
                  </ChartContainer>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No dispatches recorded yet.</p>
              )}
            </CardContent>
          </Card>
        </section>

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
                <h2 className="text-xl font-bold">Current Rescues</h2>
                <div className="text-sm text-muted-foreground">
                  {activeRequests.length ? `${activeRequests.length} active` : "Idle"}
                </div>
              </div>
              {activeRequests.length ? (
                <div className="space-y-3">
                  {activeRequests.map((request) => (
                    <div key={request.id} className="rounded-lg border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-semibold">
                          #{request.id} • Priority {request.priority} • {request.status}
                        </div>
                        <div className="text-sm text-muted-foreground">{request.location}</div>
                      </div>
                      <div className="mt-2 text-sm">{request.details}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          onClick={() => handleUpdateRequest(request.id, "fulfilled")}
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
                            handleDispatchResource(defaultDispatchResource, qty, request);
                          }}
                        >
                          {defaultDispatchResource
                            ? `Dispatch ${Math.min(10, defaultDispatchResource.quantity)} ${defaultDispatchResource.type}`
                            : "Dispatch Resources"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No active rescues within this operational window.
                </div>
              )}
            </section>

            <section className="rounded-xl border bg-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-xl font-bold">Requests</h2>
                  <p className="text-xs text-muted-foreground">
                    Showing filtered open cases: {visibleRequests.length}
                    {requestPagination?.total != null ? ` • Total backlog: ${requestPagination.total}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    Page {currentRequestPage} / {totalRequestPages}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!canPrevRequests || rescueRequests.isFetching}
                      onClick={() => setParams({ page: Math.max(1, currentRequestPage - 1) })}
                    >
                      Prev
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!canNextRequests || rescueRequests.isFetching}
                      onClick={() => setParams({ page: Math.min(totalRequestPages, currentRequestPage + 1) })}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div>
              {rescueRequests.isLoading ? (
                <div className="text-sm text-muted-foreground">Loading requests…</div>
              ) : rescueRequests.error ? (
                <div className="text-sm text-red-500">Unable to load requests.</div>
              ) : (
                <div className="space-y-3">
                  {pendingRequests.map((r) => (
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
                  {pendingRequests.length === 0 && (
                    <div className="text-sm text-muted-foreground">
                      No pending requests within {selectedWarehouse?.name ?? "this hub"}'s coverage radius.
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="rounded-xl border bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Warehouse Resource Tracker</h2>
                <div className="text-sm text-muted-foreground">Available units: {availableResources}</div>
              </div>
              <div className="space-y-5">
                {warehouses.map((w) => {
                  const totalStock = getWarehouseStock(w.id);
                  const capacityPct = w.capacity ? Math.min(100, Math.round((totalStock / w.capacity) * 100)) : 0;
                  const warehouseResources = getWarehouseResources(w.id);
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
                                  onClick={() => handleDispatchResource(resource, Math.min(10, resource.quantity), primaryActiveRequest ?? undefined)}
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

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-xl border bg-card p-6">
                <h2 className="text-xl font-bold">Manual Dispatch</h2>
                <p className="text-sm text-muted-foreground">
                  Push supplies to the field with linked requests and provenance notes.
                </p>
                <form className="mt-4 space-y-3" onSubmit={submitDispatchLog}>
                  <div>
                    <Label>Resource</Label>
                    <select
                      className="mt-1 h-10 w-full rounded-md border px-3"
                      disabled={isDispatching}
                      {...dispatchForm.register("resourceId")}
                    >
                      <option value="">Select resource</option>
                      {resourceList.map((resource) => (
                        <option key={resource.id} value={resource.id}>
                          {resource.type} • WH {resource.warehouseId}
                        </option>
                      ))}
                    </select>
                    {selectedDispatchResource ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {selectedDispatchResource.quantity} {selectedDispatchResource.unit ?? "units"} available at {warehouseNameMap[selectedDispatchResource.warehouseId] ?? `Warehouse ${selectedDispatchResource.warehouseId}`}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">Select a stock item to see availability.</p>
                    )}
                    {dispatchForm.formState.errors.resourceId && (
                      <p className="text-xs text-destructive mt-1">
                        {dispatchForm.formState.errors.resourceId.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Source warehouse</Label>
                    <select
                      className="mt-1 h-10 w-full rounded-md border px-3"
                      disabled={isDispatching || !warehouses.length}
                      {...dispatchForm.register("warehouseId")}
                    >
                      <option value="">Select warehouse</option>
                      {warehouses.map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>
                          {warehouse.name}
                        </option>
                      ))}
                    </select>
                    {dispatchForm.formState.errors.warehouseId && (
                      <p className="text-xs text-destructive mt-1">
                        {dispatchForm.formState.errors.warehouseId.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      placeholder="Units to dispatch"
                      disabled={isDispatching}
                      {...dispatchForm.register("quantity")}
                    />
                    {dispatchForm.formState.errors.quantity && (
                      <p className="text-xs text-destructive mt-1">
                        {dispatchForm.formState.errors.quantity.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Destination</Label>
                    <Input
                      placeholder="Relief camp, GPS coordinate, etc."
                      disabled={isDispatching}
                      {...dispatchForm.register("destination")}
                    />
                    {dispatchForm.formState.errors.destination && (
                      <p className="text-xs text-destructive mt-1">
                        {dispatchForm.formState.errors.destination.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Link to request (optional)</Label>
                    <select
                      className="mt-1 h-10 w-full rounded-md border px-3"
                      disabled={isDispatching || !dispatchableRequests.length}
                      {...dispatchForm.register("requestId")}
                    >
                      <option value="">No linked request</option>
                      {dispatchableRequests.map((request) => (
                        <option key={request.id} value={request.id}>
                          #{request.id} • {request.location}
                        </option>
                      ))}
                    </select>
                    {dispatchForm.formState.errors.requestId && (
                      <p className="text-xs text-destructive mt-1">
                        {dispatchForm.formState.errors.requestId.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Textarea
                      placeholder="Convoy, strike team, driver, etc."
                      disabled={isDispatching}
                      {...dispatchForm.register("notes")}
                    />
                    {dispatchForm.formState.errors.notes && (
                      <p className="text-xs text-destructive mt-1">
                        {dispatchForm.formState.errors.notes.message}
                      </p>
                    )}
                  </div>
                  {dispatchForm.formState.errors.root?.message && (
                    <p className="text-xs text-destructive">{dispatchForm.formState.errors.root.message}</p>
                  )}
                  <Button type="submit" disabled={isDispatching} className="w-full">
                    {isDispatching ? "Recording…" : "Record dispatch"}
                  </Button>
                </form>
              </div>

              <div className="rounded-xl border bg-card p-6">
                <h2 className="text-xl font-bold">Inter-hub Transfer</h2>
                <p className="text-sm text-muted-foreground">
                  Balance inventory between warehouses with audit-friendly logs.
                </p>
                <form className="mt-4 space-y-3" onSubmit={submitTransferLog}>
                  <div>
                    <Label>Resource</Label>
                    <select
                      className="mt-1 h-10 w-full rounded-md border px-3"
                      disabled={isTransferring}
                      {...transferForm.register("resourceId")}
                    >
                      <option value="">Select resource</option>
                      {resourceList.map((resource) => (
                        <option key={resource.id} value={resource.id}>
                          {resource.type} • WH {resource.warehouseId}
                        </option>
                      ))}
                    </select>
                    {selectedTransferResource ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Currently {selectedTransferResource.quantity} {selectedTransferResource.unit ?? "units"} at {warehouseNameMap[selectedTransferResource.warehouseId] ?? `Warehouse ${selectedTransferResource.warehouseId}`}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">Choose an item to view source details.</p>
                    )}
                    {transferForm.formState.errors.resourceId && (
                      <p className="text-xs text-destructive mt-1">
                        {transferForm.formState.errors.resourceId.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Destination warehouse</Label>
                    <select
                      className="mt-1 h-10 w-full rounded-md border px-3"
                      disabled={isTransferring || !warehouses.length}
                      {...transferForm.register("toWarehouseId")}
                    >
                      <option value="">Select destination</option>
                      {warehouses.map((warehouse) => (
                        <option
                          key={warehouse.id}
                          value={warehouse.id}
                          disabled={selectedTransferResource?.warehouseId === warehouse.id}
                        >
                          {warehouse.name}
                        </option>
                      ))}
                    </select>
                    {transferForm.formState.errors.toWarehouseId && (
                      <p className="text-xs text-destructive mt-1">
                        {transferForm.formState.errors.toWarehouseId.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      placeholder="Units to move"
                      disabled={isTransferring}
                      {...transferForm.register("quantity")}
                    />
                    {transferForm.formState.errors.quantity && (
                      <p className="text-xs text-destructive mt-1">
                        {transferForm.formState.errors.quantity.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Note</Label>
                    <Textarea
                      placeholder="Driver, ETA, route, etc."
                      disabled={isTransferring}
                      {...transferForm.register("note")}
                    />
                    {transferForm.formState.errors.note && (
                      <p className="text-xs text-destructive mt-1">
                        {transferForm.formState.errors.note.message}
                      </p>
                    )}
                  </div>
                  {transferForm.formState.errors.root?.message && (
                    <p className="text-xs text-destructive">{transferForm.formState.errors.root.message}</p>
                  )}
                  <Button type="submit" disabled={isTransferring} className="w-full">
                    {isTransferring ? "Recording…" : "Record transfer"}
                  </Button>
                </form>
              </div>
            </section>

            <section className="rounded-xl border bg-card p-6">
              <h2 className="text-xl font-bold mb-4">Real-Time Tracking Panel</h2>
              <ul className="space-y-3 text-sm">
                {visibleRequests.slice(0, 3).map((req) => (
                  <li key={req.id}>
                    Request #{req.id} • {req.priority} priority at {req.location} ({req.peopleCount ?? 1} people waiting)
                  </li>
                ))}
                {visibleRequests.length === 0 && (
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
                    if (!defaultDispatchResource || !primaryActiveRequest) return;
                    const qty = Math.min(25, defaultDispatchResource.quantity);
                    handleDispatchResource(defaultDispatchResource, qty, primaryActiveRequest);
                  }}
                  disabled={!defaultDispatchResource || !primaryActiveRequest || isDispatching || (defaultDispatchResource?.quantity ?? 0) === 0}
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
                <li>Open rescue cases: <strong>{backlogSummary?.openRequests ?? 0}</strong></li>
                <li>People needing help: <strong>{peopleNeedingHelp}</strong></li>
                <li>Estimated kits required: <strong>{estimatedResourceDemand}</strong></li>
                <li>Warehouses with stock: <strong>{warehousesWithInventory}</strong> / {warehouses.length}</li>
                <li>High-priority backlog: <strong>{priorityBreakdown?.high ?? 0}</strong></li>
                <li>
                  Low-stock SKUs:
                  {lowStockQuery.isLoading ? (
                    <span className="ml-1 text-muted-foreground">Loading...</span>
                  ) : (
                    <>
                      {" "}
                      <strong>{lowStockTotal}</strong> ({depletedResourceCount} depleted)
                    </>
                  )}
                </li>
              </ul>
            </section>

            <section className="rounded-xl border bg-card p-6">
              <h3 className="text-lg font-bold">Priority Focus</h3>
              {recentCriticalRequests.length ? (
                <ul className="mt-3 space-y-2 text-sm">
                  {recentCriticalRequests.slice(0, 5).map((request) => (
                    <li key={request.id} className="rounded-md border px-3 py-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>#{request.id} • {request.priority}</span>
                        <span>{request.status.replace("_", " ")}</span>
                      </div>
                      <p className="text-sm font-medium">{request.location}</p>
                      <p className="text-xs text-muted-foreground">
                        Criticality {request.criticalityScore} • {request.peopleCount ?? 1} people waiting
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">No critical cases flagged.</p>
              )}
            </section>

            <section className="rounded-xl border bg-card p-6">
              <h3 className="text-lg font-bold">Low-Stock Alerts</h3>
              {lowStockQuery.isLoading ? (
                <div className="mt-3 space-y-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={`low-stock-skeleton-${index}`} className="h-12 w-full" />
                  ))}
                </div>
              ) : lowStockQuery.error ? (
                <p className="mt-3 text-sm text-destructive">Unable to load low-stock resources.</p>
              ) : topLowStockAlerts.length ? (
                <ul className="mt-3 space-y-2 text-sm">
                  {topLowStockAlerts.map((resource) => (
                    <li key={resource.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{resource.type}</p>
                        <p className="text-xs text-muted-foreground">
                          {resource.quantity} / {resource.reorderLevel} {resource.unit} • WH {resource.warehouseId}
                        </p>
                      </div>
                      <Badge variant="destructive">Low</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">No low-stock resources right now.</p>
              )}
              {lowStockTotal > topLowStockAlerts.length && !lowStockQuery.isLoading && !lowStockQuery.error ? (
                <p className="mt-4 text-xs text-muted-foreground">
                  Showing {topLowStockAlerts.length} of {lowStockTotal} low-stock alerts.
                </p>
              ) : null}
            </section>

            <section className="rounded-xl border bg-card p-6">
              <h3 className="text-lg font-bold">Requests Sidebar</h3>
              <ul className="mt-3 space-y-2 text-sm max-h-72 overflow-auto">
                {visibleRequests.map((r) => (
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

function matchesRescueSearch(request: RescueRequest, searchTerm: string) {
  const haystack = [
    `#${request.id}`,
    request.location,
    request.details,
    request.priority,
    request.status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(searchTerm);
}

function compareRescueRequests(
  a: RescueRequest,
  b: RescueRequest,
  sortBy: "createdAt" | "criticalityScore" | "priority",
  direction: "asc" | "desc",
) {
  let delta = 0;
  if (sortBy === "createdAt") {
    delta = (a.createdAt ?? 0) - (b.createdAt ?? 0);
  } else if (sortBy === "criticalityScore") {
    delta = (a.criticalityScore ?? 0) - (b.criticalityScore ?? 0);
  } else if (sortBy === "priority") {
    delta = getPriorityRankValue(a.priority) - getPriorityRankValue(b.priority);
  }
  return direction === "asc" ? delta : -delta;
}

function getPriorityRankValue(priority: RescueRequest["priority"]) {
  switch (priority) {
    case "high":
      return 3;
    case "medium":
      return 2;
    default:
      return 1;
  }
}

function formatMinutesLabel(minutes?: number | null) {
  if (!minutes || minutes <= 0) return "<1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function calculateMedian(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function startOfDayMs(timestamp: number) {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function filterRequestsByHub(requests: RescueRequest[], warehouse: Warehouse) {
  return requests.filter((request) => isRequestWithinHub(request, warehouse));
}

function isRequestWithinHub(request: RescueRequest, warehouse: Warehouse) {
  if (
    warehouse.latitude != null &&
    warehouse.longitude != null &&
    request.latitude != null &&
    request.longitude != null
  ) {
    const distanceKm = calculateDistanceKm(
      request.latitude,
      request.longitude,
      warehouse.latitude,
      warehouse.longitude,
    );
    return distanceKm <= 120;
  }
  const hubCity = extractCityKeyword(warehouse.location ?? "");
  const requestCity = extractCityKeyword(request.location ?? "");
  if (hubCity && requestCity) {
    if (hubCity === requestCity) return true;
    return requestCity.includes(hubCity) || hubCity.includes(requestCity);
  }
  return true;
}

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function extractCityKeyword(location: string) {
  const primary = location.split(",")[0] ?? "";
  return primary.trim().toLowerCase();
}

function getStockRatio(resource: Resource) {
  const reorderLevel = resource.reorderLevel ?? 0;
  const divisor = reorderLevel > 0 ? reorderLevel : Math.max(1, resource.quantity);
  return resource.quantity / divisor;
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
