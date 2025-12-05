import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { toast } from "sonner";
import { OperationsMap } from "@/components/geo/OperationsMap";
import { useZodForm } from "@/hooks/use-zod-form";
import {
  useCreateWarehouseMutation,
  useCreateResourceMutation,
  useCreateResourceTransferMutation,
  useCreateDistributionLogMutation,
  useGetDistributionLogsQuery,
  useGetResourceTransfersQuery,
  useGetResourcesQuery,
  useGetWarehousesQuery,
  useUpdateResourceMutation,
  useUpdateWarehouseMutation,
  useGeoOverviewQuery,
  useGeoHeatmapQuery,
  useWarehouseInventorySummary,
} from "@/hooks/api-hooks";
import {
  createWarehouseFormSchema,
  updateWarehouseFormSchema,
  createResourceFormSchema,
  updateResourceFormSchema,
  resourceTransferFormSchema,
  distributionLogFormSchema,
  type UpdateWarehouseInput,
  type UpdateResourceInput,
} from "@shared/api";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { X } from "lucide-react";

const DEFAULT_RESOURCE_PAGE_SIZE = 50;
const RESOURCE_PAGE_OPTIONS = [25, 50, 100, 200] as const;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export default function ResourcesPage() {
  const [resourcePage, setResourcePage] = useState(1);
  const [resourceSearch, setResourceSearch] = useState("");
  const [resourceTypeFilter, setResourceTypeFilter] = useState("");
  const [resourceWarehouseFilter, setResourceWarehouseFilter] = useState("all");
  const [resourceSortBy, setResourceSortBy] = useState<"updatedAt" | "quantity" | "type">("updatedAt");
  const [resourceSortDirection, setResourceSortDirection] = useState<"asc" | "desc">("desc");
  const [resourceLimit, setResourceLimit] = useState<number>(DEFAULT_RESOURCE_PAGE_SIZE);

  const resourcesQueryParams = useMemo(
    () => ({
      page: resourcePage,
      limit: resourceLimit,
      search: resourceSearch.trim() || undefined,
      type: resourceTypeFilter.trim() || undefined,
      warehouseId: resourceWarehouseFilter === "all" ? undefined : Number(resourceWarehouseFilter),
      sortBy: resourceSortBy,
      sortDirection: resourceSortDirection,
    }),
    [
      resourcePage,
      resourceSearch,
      resourceTypeFilter,
      resourceWarehouseFilter,
      resourceSortBy,
      resourceSortDirection,
      resourceLimit,
    ],
  );

  const geoOverview = useGeoOverviewQuery();
  const geoHeatmap = useGeoHeatmapQuery({ bucket: 0.15, window: 12 });
  const warehouses = useGetWarehousesQuery();
  const resources = useGetResourcesQuery(resourcesQueryParams);
  const transfers = useGetResourceTransfersQuery();
  const distributionLogs = useGetDistributionLogsQuery();
  const inventorySummary = useWarehouseInventorySummary(resourcesQueryParams);

  const createWarehouse = useCreateWarehouseMutation();
  const updateWarehouse = useUpdateWarehouseMutation();
  const createResource = useCreateResourceMutation();
  const updateResource = useUpdateResourceMutation();
  const createTransfer = useCreateResourceTransferMutation();
  const createDistribution = useCreateDistributionLogMutation();

  const resourceList = resources.data?.resources ?? [];
  const resourcePagination = resources.data?.pagination;
  const currentResourcePage = resourcePagination?.page ?? resourcePage;

  const createWarehouseForm = useZodForm({
    schema: createWarehouseFormSchema,
    defaultValues: {
      name: "",
      location: "",
      capacity: undefined,
      lastAuditedAt: "",
    },
  });
  const updateWarehouseForm = useZodForm({
    schema: updateWarehouseFormSchema,
    defaultValues: {
      warehouseId: undefined,
      name: "",
      location: "",
      capacity: undefined,
      lastAuditedAt: "",
    },
  });
  const createResourceForm = useZodForm({
    schema: createResourceFormSchema,
    defaultValues: {
      type: "",
      quantity: undefined,
      warehouseId: undefined,
      unit: "units",
      reorderLevel: undefined,
    },
  });
  const updateResourceForm = useZodForm({
    schema: updateResourceFormSchema,
    defaultValues: {
      resourceId: undefined,
      type: "",
      quantity: undefined,
      warehouseId: undefined,
      unit: "",
      reorderLevel: undefined,
    },
  });
  const resourceTransferForm = useZodForm({
    schema: resourceTransferFormSchema,
    defaultValues: {
      resourceId: undefined,
      toWarehouseId: undefined,
      quantity: undefined,
      note: "",
    },
  });
  const distributionForm = useZodForm({
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

  const totalResourcePages = Math.max(1, resourcePagination?.totalPages ?? 1);
  const canPrevResourcePage = currentResourcePage > 1;
  const canNextResourcePage = currentResourcePage < totalResourcePages;

  const warehouseInventoryMap = inventorySummary.data?.warehouses ?? {};

  const warehouseNameMap = useMemo(() => {
    const map: Record<number, string> = {};
    (warehouses.data ?? []).forEach((wh) => {
      map[wh.id] = wh.name;
    });
    return map;
  }, [warehouses.data]);

  const isCreatingWarehouse = createWarehouse.isPending || createWarehouseForm.formState.isSubmitting;
  const isUpdatingWarehouse = updateWarehouse.isPending || updateWarehouseForm.formState.isSubmitting;
  const isCreatingResource = createResource.isPending || createResourceForm.formState.isSubmitting;
  const isUpdatingResource = updateResource.isPending || updateResourceForm.formState.isSubmitting;
  const isCreatingTransfer = createTransfer.isPending || resourceTransferForm.formState.isSubmitting;
  const isCreatingDistribution = createDistribution.isPending || distributionForm.formState.isSubmitting;

  useEffect(() => {
    setResourcePage(1);
  }, [resourceSearch, resourceWarehouseFilter, resourceTypeFilter, resourceSortBy, resourceSortDirection, resourceLimit]);

  useEffect(() => {
    if (resourcePagination?.totalPages && resourcePage > resourcePagination.totalPages) {
      setResourcePage(Math.max(1, resourcePagination.totalPages));
    }
  }, [resourcePage, resourcePagination?.totalPages]);

  const selectedDistributionResourceId = distributionForm.watch("resourceId");
  useEffect(() => {
    if (!selectedDistributionResourceId) return;
    const selected = resourceList.find((r) => r.id === selectedDistributionResourceId);
    if (selected) {
      distributionForm.setValue("warehouseId", selected.warehouseId);
    }
  }, [selectedDistributionResourceId, resourceList, distributionForm]);

  const submitCreateWarehouse = createWarehouseForm.handleSubmit((values) => {
    createWarehouse.mutate(values, {
      onSuccess: () => {
        toast.success("Warehouse created");
        createWarehouseForm.reset();
      },
      onError: (error) => {
        const message = error?.message || "Unable to create warehouse";
        toast.error(message);
        createWarehouseForm.setError("root", { type: "server", message });
      },
    });
  });

  const submitUpdateWarehouse = updateWarehouseForm.handleSubmit(({ warehouseId, ...data }) => {
    const payload: UpdateWarehouseInput = { ...data };
    updateWarehouse.mutate(
      { id: warehouseId, data: payload },
      {
        onSuccess: () => {
          toast.success("Warehouse updated");
          updateWarehouseForm.reset();
        },
        onError: (error) => {
          const message = error?.message || "Unable to update warehouse";
          toast.error(message);
          updateWarehouseForm.setError("root", { type: "server", message });
        },
      },
    );
  });

  const submitCreateResource = createResourceForm.handleSubmit((values) => {
    createResource.mutate(values, {
      onSuccess: () => {
        toast.success("Resource saved");
        createResourceForm.reset({
          type: "",
          quantity: undefined,
          warehouseId: undefined,
          unit: "units",
          reorderLevel: undefined,
        });
      },
      onError: (error) => {
        const message = error?.message || "Unable to save resource";
        toast.error(message);
        createResourceForm.setError("root", { type: "server", message });
      },
    });
  });

  const submitUpdateResource = updateResourceForm.handleSubmit(({ resourceId, ...data }) => {
    const payload: UpdateResourceInput = { ...data };
    updateResource.mutate(
      { id: resourceId, data: payload },
      {
        onSuccess: () => {
          toast.success("Resource updated");
          updateResourceForm.reset();
        },
        onError: (error) => {
          const message = error?.message || "Unable to update resource";
          toast.error(message);
          updateResourceForm.setError("root", { type: "server", message });
        },
      },
    );
  });

  const submitCreateTransfer = resourceTransferForm.handleSubmit((values) => {
    createTransfer.mutate(values, {
      onSuccess: () => {
        toast.success("Transfer recorded");
        resourceTransferForm.reset();
      },
      onError: (error) => {
        const message = error?.message || "Unable to transfer stock";
        toast.error(message);
        resourceTransferForm.setError("root", { type: "server", message });
      },
    });
  });

  const submitCreateDistribution = distributionForm.handleSubmit((values) => {
    createDistribution.mutate(values, {
      onSuccess: () => {
        toast.success("Distribution logged");
        distributionForm.reset();
      },
      onError: (error) => {
        const message = error?.message || "Unable to log distribution";
        toast.error(message);
        distributionForm.setError("root", { type: "server", message });
      },
    });
  });

  const selectedDistributionWarehouseId = distributionForm.watch("warehouseId");
  const selectedDistributionWarehouseName = selectedDistributionWarehouseId
    ? warehouseNameMap[selectedDistributionWarehouseId] ?? ""
    : "";
  const utilizationSeries = useMemo(() => {
    if (!warehouses.data?.length)
      return [] as Array<{ id: number; name: string; utilization: number; stock: number }>;
    return warehouses.data
      .map((warehouse) => {
        const capacity = warehouse.capacity ?? 0;
        if (!capacity) return null;
        const stockEntry = warehouseInventoryMap[warehouse.id];
        const totalStock = stockEntry?.totalQuantity ?? 0;
        const utilization = Math.min(100, Math.round((totalStock / capacity) * 100));
        return { id: warehouse.id, name: warehouse.name, utilization, stock: totalStock };
      })
      .filter((entry): entry is { id: number; name: string; utilization: number; stock: number } => Boolean(entry))
      .sort((a, b) => b.utilization - a.utilization)
      .slice(0, 6);
  }, [warehouses.data, warehouseInventoryMap]);
  const utilizationChartConfig = useMemo<ChartConfig>(
    () => ({ utilization: { label: "Capacity used", color: "hsl(var(--chart-4))" } }),
    [],
  );
  const distributionVelocity = useMemo(() => {
    const logs = distributionLogs.data ?? [];
    if (!logs.length) {
      return { series: [] as { timestamp: number; label: string; quantity: number }[], last24h: 0, avgDaily: 0 };
    }
    const bucketMap = new Map<number, number>();
    const now = Date.now();
    let totalQuantity = 0;
    let last24h = 0;
    logs.forEach((log) => {
      const createdAt = log.createdAt ?? 0;
      totalQuantity += log.quantity;
      if (now - createdAt <= ONE_DAY_MS) {
        last24h += log.quantity;
      }
      const bucket = startOfDayMs(createdAt);
      bucketMap.set(bucket, (bucketMap.get(bucket) ?? 0) + log.quantity);
    });
    const series = Array.from(bucketMap.entries())
      .sort((a, b) => a[0] - b[0])
      .slice(-7)
      .map(([timestamp, quantity]) => ({
        timestamp,
        label: new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        quantity,
      }));
    const avgDaily = bucketMap.size ? Math.round(totalQuantity / Math.min(7, bucketMap.size)) : totalQuantity;
    return { series, last24h, avgDaily };
  }, [distributionLogs.data]);
  const velocityChartConfig = useMemo<ChartConfig>(
    () => ({ quantity: { label: "Dispatches", color: "hsl(var(--chart-2))" } }),
    [],
  );
  const activityTimeline = useMemo(() => {
    const dispatchEvents = (distributionLogs.data ?? []).map((log) => ({
      id: `dispatch-${log.id}`,
      timestamp: log.createdAt ?? 0,
      title: `Dispatched ${log.quantity} units`,
      subtitle: log.destination,
      meta: log.notes ?? "Logged distribution",
    }));
    const transferEvents = (transfers.data ?? []).map((transfer) => ({
      id: `transfer-${transfer.id}`,
      timestamp: transfer.createdAt ?? 0,
      title: `Moved ${transfer.quantity} units`,
      subtitle: `${warehouseNameMap[transfer.fromWarehouseId ?? 0] ?? "Unknown"} → ${
        warehouseNameMap[transfer.toWarehouseId ?? 0] ?? "Unknown"
      }`,
      meta: transfer.note ?? "Transfer recorded",
    }));
    return [...dispatchEvents, ...transferEvents]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 8);
  }, [distributionLogs.data, transfers.data, warehouseNameMap]);
  const resourceFilterChips = useMemo(
    () => {
      const chips: { key: string; label: string; onClear: () => void }[] = [];
      if (resourceSearch.trim()) {
        chips.push({ key: "search", label: `Search: “${resourceSearch.trim()}”`, onClear: () => setResourceSearch("") });
      }
      if (resourceTypeFilter.trim()) {
        chips.push({ key: "type", label: `Type: ${resourceTypeFilter}`, onClear: () => setResourceTypeFilter("") });
      }
      if (resourceWarehouseFilter !== "all") {
        chips.push({
          key: "warehouse",
          label: `Warehouse: ${warehouseNameMap[Number(resourceWarehouseFilter)] ?? resourceWarehouseFilter}`,
          onClear: () => setResourceWarehouseFilter("all"),
        });
      }
      return chips;
    },
    [resourceSearch, resourceTypeFilter, resourceWarehouseFilter, warehouseNameMap],
  );
  const clearResourceFilters = () => {
    setResourceSearch("");
    setResourceTypeFilter("");
    setResourceWarehouseFilter("all");
  };

  return (
    <div className="container mx-auto py-10 sm:py-14 space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl sm:text-4xl font-extrabold">Resource Operations Center</h1>
        <p className="text-muted-foreground">
          Track inventory across warehouses, execute transfers, and keep auditable logs of every dispatch.
        </p>
      </div>

      <section>
        <Card>
          <CardHeader className="flex flex-col gap-1">
            <CardTitle>Live operations map</CardTitle>
            <CardDescription>Visualize need clusters alongside active depots.</CardDescription>
          </CardHeader>
          <CardContent>
            {geoOverview.isLoading || geoHeatmap.isLoading ? (
              <Skeleton className="w-full h-[360px]" />
            ) : geoOverview.error || geoHeatmap.error ? (
              <p className="text-sm text-red-500">Unable to load geospatial layers.</p>
            ) : (
              <OperationsMap overview={geoOverview.data} heatmap={geoHeatmap.data?.buckets} height={360} />
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Warehouse utilization</CardTitle>
            <CardDescription>Capacity consumed across the busiest hubs.</CardDescription>
          </CardHeader>
          <CardContent>
            {warehouses.isLoading || inventorySummary.isLoading ? (
              <Skeleton className="h-52 w-full" />
            ) : warehouses.error ? (
              <p className="text-sm text-destructive">Failed to load warehouse data.</p>
            ) : utilizationSeries.length ? (
              <>
                <ChartContainer config={utilizationChartConfig} className="h-60 w-full">
                  <BarChart
                    data={utilizationSeries}
                    layout="vertical"
                    margin={{ left: 8, right: 16, top: 10, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={140}
                      tickLine={false}
                      axisLine={false}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="utilization" fill="var(--color-utilization)" radius={4} />
                  </BarChart>
                </ChartContainer>
                <p className="mt-3 text-xs text-muted-foreground">
                  Showing top {utilizationSeries.length} warehouses by utilization.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Add capacity figures to monitor utilization.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Distribution velocity</CardTitle>
            <CardDescription>Outbound dispatches tracked over the last week.</CardDescription>
          </CardHeader>
          <CardContent>
            {distributionLogs.isLoading ? (
              <Skeleton className="h-52 w-full" />
            ) : distributionLogs.error ? (
              <p className="text-sm text-destructive">Failed to load distribution logs.</p>
            ) : distributionVelocity.series.length ? (
              <>
                <div className="grid gap-4 sm:grid-cols-3 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Last 24h</p>
                    <p className="text-2xl font-bold text-foreground">{distributionVelocity.last24h.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Avg daily</p>
                    <p className="text-2xl font-bold text-foreground">{distributionVelocity.avgDaily.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Window</p>
                    <p className="text-2xl font-bold text-foreground">{distributionVelocity.series.length} days</p>
                  </div>
                </div>
                <ChartContainer config={velocityChartConfig} className="mt-4 h-60 w-full">
                  <AreaChart data={distributionVelocity.series} margin={{ left: 8, right: 16, top: 12, bottom: 0 }}>
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
              <p className="text-sm text-muted-foreground">No recent dispatches to plot.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Warehouses</CardTitle>
            <CardDescription>Real-time capacity view with audit metadata.</CardDescription>
          </CardHeader>
          <CardContent>
            {warehouses.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading warehouses…</p>
            ) : warehouses.error ? (
              <p className="text-sm text-red-500">Failed to load warehouses.</p>
            ) : warehouses.data?.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Capacity</TableHead>
                    <TableHead>In Stock</TableHead>
                    <TableHead>Last audit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {warehouses.data.map((warehouse) => {
                    const inStock = warehouseInventoryMap[warehouse.id]?.totalQuantity ?? 0;
                    const utilization = warehouse.capacity
                      ? Math.min(100, Math.round((inStock / warehouse.capacity) * 100))
                      : 0;
                    return (
                      <TableRow key={warehouse.id}>
                        <TableCell>
                          <p className="font-medium">{warehouse.name}</p>
                          <p className="text-xs text-muted-foreground">{warehouse.location}</p>
                        </TableCell>
                        <TableCell>{warehouse.capacity.toLocaleString()}</TableCell>
                        <TableCell>
                          {inStock.toLocaleString()} ({utilization}% used)
                        </TableCell>
                        <TableCell>
                          {warehouse.lastAuditedAt ? new Date(warehouse.lastAuditedAt).toLocaleDateString() : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">No warehouses recorded yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Warehouse actions</CardTitle>
            <CardDescription>Create or update warehouse metadata.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form className="space-y-3" onSubmit={submitCreateWarehouse}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Create warehouse</h3>
                <Button size="sm" type="submit" disabled={isCreatingWarehouse}>
                  {isCreatingWarehouse ? "Saving..." : "Save"}
                </Button>
              </div>
              <div>
                <Label>Name</Label>
                <Input disabled={isCreatingWarehouse} {...createWarehouseForm.register("name")} />
                {createWarehouseForm.formState.errors.name && (
                  <p className="mt-1 text-xs text-destructive">
                    {createWarehouseForm.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div>
                <Label>Location</Label>
                <Input disabled={isCreatingWarehouse} {...createWarehouseForm.register("location")} />
                {createWarehouseForm.formState.errors.location && (
                  <p className="mt-1 text-xs text-destructive">
                    {createWarehouseForm.formState.errors.location.message}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Capacity</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    disabled={isCreatingWarehouse}
                    {...createWarehouseForm.register("capacity")}
                  />
                  {createWarehouseForm.formState.errors.capacity && (
                    <p className="mt-1 text-xs text-destructive">
                      {createWarehouseForm.formState.errors.capacity.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label>Last audited at</Label>
                  <Input
                    type="datetime-local"
                    disabled={isCreatingWarehouse}
                    {...createWarehouseForm.register("lastAuditedAt")}
                  />
                  {createWarehouseForm.formState.errors.lastAuditedAt && (
                    <p className="mt-1 text-xs text-destructive">
                      {createWarehouseForm.formState.errors.lastAuditedAt.message}
                    </p>
                  )}
                </div>
              </div>
              {createWarehouseForm.formState.errors.root?.message && (
                <p className="text-xs text-destructive">{createWarehouseForm.formState.errors.root.message}</p>
              )}
            </form>

            <div className="border-t pt-4">
              <form className="space-y-3" onSubmit={submitUpdateWarehouse}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Update warehouse</h3>
                  <Button size="sm" type="submit" variant="outline" disabled={isUpdatingWarehouse}>
                    {isUpdatingWarehouse ? "Updating..." : "Update"}
                  </Button>
                </div>
                <div>
                  <Label>Warehouse</Label>
                  <select
                    className="mt-1 h-10 w-full rounded-md border px-3"
                    disabled={isUpdatingWarehouse}
                    {...updateWarehouseForm.register("warehouseId")}
                  >
                    <option value="">Select warehouse</option>
                    {(warehouses.data ?? []).map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </option>
                    ))}
                  </select>
                  {updateWarehouseForm.formState.errors.warehouseId && (
                    <p className="mt-1 text-xs text-destructive">
                      {updateWarehouseForm.formState.errors.warehouseId.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label>Name</Label>
                  <Input disabled={isUpdatingWarehouse} {...updateWarehouseForm.register("name")} />
                  {updateWarehouseForm.formState.errors.name && (
                    <p className="mt-1 text-xs text-destructive">
                      {updateWarehouseForm.formState.errors.name.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label>Location</Label>
                  <Input disabled={isUpdatingWarehouse} {...updateWarehouseForm.register("location")} />
                  {updateWarehouseForm.formState.errors.location && (
                    <p className="mt-1 text-xs text-destructive">
                      {updateWarehouseForm.formState.errors.location.message}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Capacity</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      disabled={isUpdatingWarehouse}
                      {...updateWarehouseForm.register("capacity")}
                    />
                    {updateWarehouseForm.formState.errors.capacity && (
                      <p className="mt-1 text-xs text-destructive">
                        {updateWarehouseForm.formState.errors.capacity.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Last audited at</Label>
                    <Input
                      type="datetime-local"
                      disabled={isUpdatingWarehouse}
                      {...updateWarehouseForm.register("lastAuditedAt")}
                    />
                    {updateWarehouseForm.formState.errors.lastAuditedAt && (
                      <p className="mt-1 text-xs text-destructive">
                        {updateWarehouseForm.formState.errors.lastAuditedAt.message}
                      </p>
                    )}
                  </div>
                </div>
                {updateWarehouseForm.formState.errors.root?.message && (
                  <p className="text-xs text-destructive">{updateWarehouseForm.formState.errors.root.message}</p>
                )}
              </form>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Resources</CardTitle>
            <CardDescription>Live inventory with reorder alerts.</CardDescription>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>
                Page {currentResourcePage} / {totalResourcePages}
                {resourcePagination?.total != null ? ` • Total records: ${resourcePagination.total}` : ""}
              </span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canPrevResourcePage || resources.isFetching}
                  onClick={() => setResourcePage((prev) => Math.max(1, prev - 1))}
                >
                  Prev
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canNextResourcePage || resources.isFetching}
                  onClick={() => setResourcePage((prev) => Math.min(totalResourcePages, prev + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wide">Search</Label>
                <Input
                  placeholder="Keyword or unit"
                  value={resourceSearch}
                  onChange={(event) => setResourceSearch(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wide">Type filter</Label>
                <Input
                  placeholder="Exact type"
                  value={resourceTypeFilter}
                  onChange={(event) => setResourceTypeFilter(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wide">Warehouse</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={resourceWarehouseFilter}
                  onChange={(event) => setResourceWarehouseFilter(event.target.value)}
                >
                  <option value="all">All warehouses</option>
                  {(warehouses.data ?? []).map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wide">Sort by</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={resourceSortBy}
                  onChange={(event) => setResourceSortBy(event.target.value as typeof resourceSortBy)}
                >
                  <option value="updatedAt">Recently updated</option>
                  <option value="quantity">Quantity</option>
                  <option value="type">Resource name</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wide">Direction</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={resourceSortDirection}
                  onChange={(event) => setResourceSortDirection(event.target.value as typeof resourceSortDirection)}
                >
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wide">Page size</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={resourceLimit}
                  onChange={(event) => setResourceLimit(Number(event.target.value))}
                >
                  {RESOURCE_PAGE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option} rows
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {resourceFilterChips.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {resourceFilterChips.map((chip) => (
                  <Button
                    key={chip.key}
                    size="sm"
                    variant="secondary"
                    className="h-7 rounded-full px-3"
                    onClick={chip.onClear}
                  >
                    {chip.label}
                    <X className="ml-1 h-3 w-3" />
                  </Button>
                ))}
                <Button size="sm" variant="ghost" className="h-7" onClick={clearResourceFilters}>
                  Reset filters
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {resources.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading resources…</p>
            ) : resources.error ? (
              <p className="text-sm text-red-500">Failed to load resources.</p>
            ) : resourceList.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Resource</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Reorder</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resourceList.map((resource) => {
                    const belowThreshold = resource.quantity <= resource.reorderLevel;
                    return (
                      <TableRow key={resource.id} className={belowThreshold ? "bg-amber-50" : undefined}>
                        <TableCell>
                          <p className="font-medium">{resource.type}</p>
                          <p className="text-xs text-muted-foreground">ID #{resource.id}</p>
                        </TableCell>
                        <TableCell>{warehouseNameMap[resource.warehouseId] ?? `Warehouse ${resource.warehouseId}`}</TableCell>
                        <TableCell>
                          {resource.quantity.toLocaleString()} {resource.unit}
                        </TableCell>
                        <TableCell>
                          {resource.reorderLevel.toLocaleString()} {resource.unit}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">No resources recorded yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resource actions</CardTitle>
            <CardDescription>Track intake and reorder targets.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form className="space-y-3" onSubmit={submitCreateResource}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Add resource</h3>
                <Button size="sm" type="submit" disabled={isCreatingResource}>
                  {isCreatingResource ? "Saving..." : "Save"}
                </Button>
              </div>
              <div>
                <Label>Type</Label>
                <Input disabled={isCreatingResource} {...createResourceForm.register("type")} />
                {createResourceForm.formState.errors.type && (
                  <p className="mt-1 text-xs text-destructive">
                    {createResourceForm.formState.errors.type.message}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    disabled={isCreatingResource}
                    {...createResourceForm.register("quantity")}
                  />
                  {createResourceForm.formState.errors.quantity && (
                    <p className="mt-1 text-xs text-destructive">
                      {createResourceForm.formState.errors.quantity.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label>Unit</Label>
                  <Input disabled={isCreatingResource} {...createResourceForm.register("unit")} />
                </div>
                <div>
                  <Label>Reorder level</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    disabled={isCreatingResource}
                    {...createResourceForm.register("reorderLevel")}
                  />
                  {createResourceForm.formState.errors.reorderLevel && (
                    <p className="mt-1 text-xs text-destructive">
                      {createResourceForm.formState.errors.reorderLevel.message}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <Label>Warehouse</Label>
                <select
                  className="mt-1 h-10 w-full rounded-md border px-3"
                  disabled={isCreatingResource}
                  {...createResourceForm.register("warehouseId")}
                >
                  <option value="">Select warehouse</option>
                  {(warehouses.data ?? []).map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
                {createResourceForm.formState.errors.warehouseId && (
                  <p className="mt-1 text-xs text-destructive">
                    {createResourceForm.formState.errors.warehouseId.message}
                  </p>
                )}
              </div>
              {createResourceForm.formState.errors.root?.message && (
                <p className="text-xs text-destructive">{createResourceForm.formState.errors.root.message}</p>
              )}
            </form>

            <div className="border-t pt-4">
              <form className="space-y-3" onSubmit={submitUpdateResource}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Update resource</h3>
                  <Button size="sm" type="submit" variant="outline" disabled={isUpdatingResource}>
                    {isUpdatingResource ? "Updating..." : "Update"}
                  </Button>
                </div>
                <div>
                  <Label>Resource</Label>
                  <select
                    className="mt-1 h-10 w-full rounded-md border px-3"
                    disabled={isUpdatingResource}
                    {...updateResourceForm.register("resourceId")}
                  >
                    <option value="">Select resource</option>
                    {resourceList.map((resource) => (
                      <option key={resource.id} value={resource.id}>
                        {resource.type} • {warehouseNameMap[resource.warehouseId] ?? `Warehouse ${resource.warehouseId}`}
                      </option>
                    ))}
                  </select>
                  {updateResourceForm.formState.errors.resourceId && (
                    <p className="mt-1 text-xs text-destructive">
                      {updateResourceForm.formState.errors.resourceId.message}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Type</Label>
                    <Input disabled={isUpdatingResource} {...updateResourceForm.register("type")} />
                  </div>
                  <div>
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      disabled={isUpdatingResource}
                      {...updateResourceForm.register("quantity")}
                    />
                    {updateResourceForm.formState.errors.quantity && (
                      <p className="mt-1 text-xs text-destructive">
                        {updateResourceForm.formState.errors.quantity.message}
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Warehouse</Label>
                    <select
                      className="mt-1 h-10 w-full rounded-md border px-3"
                      disabled={isUpdatingResource}
                      {...updateResourceForm.register("warehouseId")}
                    >
                      <option value="">Keep current</option>
                      {(warehouses.data ?? []).map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>
                          {warehouse.name}
                        </option>
                      ))}
                    </select>
                    {updateResourceForm.formState.errors.warehouseId && (
                      <p className="mt-1 text-xs text-destructive">
                        {updateResourceForm.formState.errors.warehouseId.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Unit</Label>
                    <Input disabled={isUpdatingResource} {...updateResourceForm.register("unit")} />
                  </div>
                </div>
                <div>
                  <Label>Reorder level</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    disabled={isUpdatingResource}
                    {...updateResourceForm.register("reorderLevel")}
                  />
                  {updateResourceForm.formState.errors.reorderLevel && (
                    <p className="mt-1 text-xs text-destructive">
                      {updateResourceForm.formState.errors.reorderLevel.message}
                    </p>
                  )}
                </div>
                {updateResourceForm.formState.errors.root?.message && (
                  <p className="text-xs text-destructive">{updateResourceForm.formState.errors.root.message}</p>
                )}
              </form>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Transfer stock</CardTitle>
            <CardDescription>Move resources between warehouses with an audit note.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="space-y-3" onSubmit={submitCreateTransfer}>
              <div>
                <Label>Resource</Label>
                <select
                  className="mt-1 h-10 w-full rounded-md border px-3"
                  disabled={isCreatingTransfer}
                  {...resourceTransferForm.register("resourceId")}
                >
                  <option value="">Select resource</option>
                  {resourceList.map((resource) => (
                    <option key={resource.id} value={resource.id}>
                      {resource.type} • {warehouseNameMap[resource.warehouseId] ?? `Warehouse ${resource.warehouseId}`}
                    </option>
                  ))}
                </select>
                {resourceTransferForm.formState.errors.resourceId && (
                  <p className="mt-1 text-xs text-destructive">
                    {resourceTransferForm.formState.errors.resourceId.message}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Destination warehouse</Label>
                  <select
                    className="mt-1 h-10 w-full rounded-md border px-3"
                    disabled={isCreatingTransfer}
                    {...resourceTransferForm.register("toWarehouseId")}
                  >
                    <option value="">Select destination</option>
                    {(warehouses.data ?? []).map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </option>
                    ))}
                  </select>
                  {resourceTransferForm.formState.errors.toWarehouseId && (
                    <p className="mt-1 text-xs text-destructive">
                      {resourceTransferForm.formState.errors.toWarehouseId.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    disabled={isCreatingTransfer}
                    {...resourceTransferForm.register("quantity")}
                  />
                  {resourceTransferForm.formState.errors.quantity && (
                    <p className="mt-1 text-xs text-destructive">
                      {resourceTransferForm.formState.errors.quantity.message}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <Label>Note</Label>
                <Textarea
                  disabled={isCreatingTransfer}
                  placeholder="Optional context for the move"
                  {...resourceTransferForm.register("note")}
                />
              </div>
              {resourceTransferForm.formState.errors.root?.message && (
                <p className="text-xs text-destructive">{resourceTransferForm.formState.errors.root.message}</p>
              )}
              <Button type="submit" disabled={isCreatingTransfer}>
                {isCreatingTransfer ? "Recording..." : "Record transfer"}
              </Button>
            </form>

            <div>
              <h3 className="font-semibold mb-2">Recent transfers</h3>
              {transfers.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading transfers…</p>
              ) : transfers.error ? (
                <p className="text-sm text-red-500">Failed to load transfers.</p>
              ) : transfers.data?.length ? (
                <ul className="space-y-2 text-sm">
                  {transfers.data.slice(0, 5).map((transfer) => (
                    <li key={transfer.id} className="rounded-md border p-3">
                      <div className="flex items-center justify-between">
                        <span>
                          Resource #{transfer.resourceId} • {transfer.quantity}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {new Date(transfer.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {warehouseNameMap[transfer.fromWarehouseId ?? 0] ?? "Unknown"} → {" "}
                        {warehouseNameMap[transfer.toWarehouseId ?? 0] ?? "Unknown"}
                      </p>
                      {transfer.note && <p className="text-xs mt-1">{transfer.note}</p>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No transfers logged yet.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribution log</CardTitle>
            <CardDescription>Record every outbound shipment for traceability.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="space-y-3" onSubmit={submitCreateDistribution}>
              <div>
                <Label>Resource</Label>
                <select
                  className="mt-1 h-10 w-full rounded-md border px-3"
                  disabled={isCreatingDistribution}
                  {...distributionForm.register("resourceId")}
                >
                  <option value="">Select resource</option>
                  {resourceList.map((resource) => (
                    <option key={resource.id} value={resource.id}>
                      {resource.type} • {warehouseNameMap[resource.warehouseId] ?? `Warehouse ${resource.warehouseId}`}
                    </option>
                  ))}
                </select>
                {distributionForm.formState.errors.resourceId && (
                  <p className="mt-1 text-xs text-destructive">
                    {distributionForm.formState.errors.resourceId.message}
                  </p>
                )}
                {selectedDistributionWarehouseName && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Dispatching from {selectedDistributionWarehouseName}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    disabled={isCreatingDistribution}
                    {...distributionForm.register("quantity")}
                  />
                  {distributionForm.formState.errors.quantity && (
                    <p className="mt-1 text-xs text-destructive">
                      {distributionForm.formState.errors.quantity.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label>Linked request ID</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    disabled={isCreatingDistribution}
                    {...distributionForm.register("requestId")}
                  />
                </div>
              </div>
              <div>
                <Label>Destination</Label>
                <Input
                  disabled={isCreatingDistribution}
                  {...distributionForm.register("destination")}
                />
                {distributionForm.formState.errors.destination && (
                  <p className="mt-1 text-xs text-destructive">
                    {distributionForm.formState.errors.destination.message}
                  </p>
                )}
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  disabled={isCreatingDistribution}
                  placeholder="Include vehicle, contact, or ETA"
                  {...distributionForm.register("notes")}
                />
              </div>
              {distributionForm.formState.errors.root?.message && (
                <p className="text-xs text-destructive">{distributionForm.formState.errors.root.message}</p>
              )}
              <Button type="submit" disabled={isCreatingDistribution}>
                {isCreatingDistribution ? "Logging..." : "Log distribution"}
              </Button>
            </form>

            <div>
              <h3 className="font-semibold mb-2">Latest dispatches</h3>
              {distributionLogs.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading logs…</p>
              ) : distributionLogs.error ? (
                <p className="text-sm text-red-500">Failed to load logs.</p>
              ) : distributionLogs.data?.length ? (
                <ul className="space-y-2 text-sm">
                  {distributionLogs.data.slice(0, 5).map((log) => (
                    <li key={log.id} className="rounded-md border p-3">
                      <div className="flex items-center justify-between">
                        <span>
                          Resource #{log.resourceId} • {log.quantity}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">Destination: {log.destination}</p>
                      {log.notes && <p className="text-xs mt-1">{log.notes}</p>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No dispatches logged yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Recent activity timeline</CardTitle>
            <CardDescription>Latest transfers and dispatches across all warehouses.</CardDescription>
          </CardHeader>
          <CardContent>
            {transfers.isLoading || distributionLogs.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : transfers.error || distributionLogs.error ? (
              <p className="text-sm text-destructive">Unable to load recent activity.</p>
            ) : activityTimeline.length ? (
              <ul className="space-y-3">
                {activityTimeline.map((event) => (
                  <li key={event.id} className="flex items-start justify-between gap-4 border-b pb-3 last:border-b-0">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{event.title}</p>
                      <p className="text-xs text-muted-foreground">{event.subtitle}</p>
                      {event.meta ? <p className="text-xs text-muted-foreground">{event.meta}</p> : null}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {event.timestamp ? new Date(event.timestamp).toLocaleString() : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No recent activity logged.</p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function startOfDayMs(timestamp: number) {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}
