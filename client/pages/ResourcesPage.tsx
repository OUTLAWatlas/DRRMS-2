import { useMemo, useState, type FormEvent } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { OperationsMap } from "@/components/geo/OperationsMap";
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
} from "@/hooks/api-hooks";
import type { UpdateWarehouseInput, UpdateResourceInput } from "@shared/api";

const initialWarehouseForm = { name: "", location: "", capacity: "", lastAuditedAt: "" };
const initialWarehouseUpdateForm = { warehouseId: "", name: "", location: "", capacity: "", lastAuditedAt: "" };
const initialResourceForm = { type: "", quantity: "", unit: "units", reorderLevel: "0", warehouseId: "" };
const initialResourceUpdateForm = { resourceId: "", type: "", quantity: "", warehouseId: "", unit: "", reorderLevel: "" };
const initialTransferForm = { resourceId: "", toWarehouseId: "", quantity: "", note: "" };
const initialDistributionForm = { resourceId: "", warehouseId: "", quantity: "", destination: "", requestId: "", notes: "" };

export default function ResourcesPage() {
  const warehouses = useGetWarehousesQuery();
  const resources = useGetResourcesQuery();
  const transfers = useGetResourceTransfersQuery();
  const distributionLogs = useGetDistributionLogsQuery();

  const createWarehouse = useCreateWarehouseMutation();
  const updateWarehouse = useUpdateWarehouseMutation();
  const createResource = useCreateResourceMutation();
  const updateResource = useUpdateResourceMutation();
  const createTransfer = useCreateResourceTransferMutation();
  const createDistribution = useCreateDistributionLogMutation();
  const geoOverview = useGeoOverviewQuery();
  const geoHeatmap = useGeoHeatmapQuery({ bucket: 0.15, window: 12 });

  const [warehouseForm, setWarehouseForm] = useState(initialWarehouseForm);
  const [warehouseUpdateForm, setWarehouseUpdateForm] = useState(initialWarehouseUpdateForm);
  const [resourceForm, setResourceForm] = useState(initialResourceForm);
  const [resourceUpdateForm, setResourceUpdateForm] = useState(initialResourceUpdateForm);
  const [transferForm, setTransferForm] = useState(initialTransferForm);
  const [distributionForm, setDistributionForm] = useState(initialDistributionForm);

  const warehouseTotals = useMemo(() => {
    const totals: Record<number, number> = {};
    (resources.data ?? []).forEach((resource) => {
      totals[resource.warehouseId] = (totals[resource.warehouseId] ?? 0) + resource.quantity;
    });
    return totals;
  }, [resources.data]);

  const warehouseNameMap = useMemo(() => {
    const map: Record<number, string> = {};
    (warehouses.data ?? []).forEach((wh) => {
      map[wh.id] = wh.name;
    });
    return map;
  }, [warehouses.data]);

  function handleCreateWarehouse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!warehouseForm.name || !warehouseForm.location) {
      toast.error("Name and location are required");
      return;
    }
    createWarehouse.mutate(
      {
        name: warehouseForm.name,
        location: warehouseForm.location,
        capacity: warehouseForm.capacity ? Number(warehouseForm.capacity) : undefined,
        lastAuditedAt: warehouseForm.lastAuditedAt
          ? new Date(warehouseForm.lastAuditedAt).toISOString()
          : undefined,
      },
      {
        onSuccess: () => {
          toast.success("Warehouse created");
          setWarehouseForm(initialWarehouseForm);
        },
        onError: (error) => toast.error(error.message || "Unable to create warehouse"),
      },
    );
  }

  function handleUpdateWarehouse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!warehouseUpdateForm.warehouseId) {
      toast.error("Select a warehouse to update");
      return;
    }
    const payload: UpdateWarehouseInput = {};
    if (warehouseUpdateForm.name) payload.name = warehouseUpdateForm.name;
    if (warehouseUpdateForm.location) payload.location = warehouseUpdateForm.location;
    if (warehouseUpdateForm.capacity) payload.capacity = Number(warehouseUpdateForm.capacity);
    if (warehouseUpdateForm.lastAuditedAt)
      payload.lastAuditedAt = new Date(warehouseUpdateForm.lastAuditedAt).toISOString();

    if (Object.keys(payload).length === 0) {
      toast.error("Provide at least one field to update");
      return;
    }

    updateWarehouse.mutate(
      { id: Number(warehouseUpdateForm.warehouseId), data: payload },
      {
        onSuccess: () => {
          toast.success("Warehouse updated");
          setWarehouseUpdateForm(initialWarehouseUpdateForm);
        },
        onError: (error) => toast.error(error.message || "Unable to update warehouse"),
      },
    );
  }

  function handleCreateResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resourceForm.type || !resourceForm.warehouseId) {
      toast.error("Resource type and warehouse are required");
      return;
    }
    const quantity = Number(resourceForm.quantity);
    if (Number.isNaN(quantity) || quantity <= 0) {
      toast.error("Enter a valid quantity");
      return;
    }

    createResource.mutate(
      {
        type: resourceForm.type,
        quantity,
        warehouseId: Number(resourceForm.warehouseId),
        unit: resourceForm.unit || undefined,
        reorderLevel: resourceForm.reorderLevel ? Number(resourceForm.reorderLevel) : undefined,
      },
      {
        onSuccess: () => {
          toast.success("Resource saved");
          setResourceForm(initialResourceForm);
        },
        onError: (error) => toast.error(error.message || "Unable to save resource"),
      },
    );
  }

  function handleUpdateResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resourceUpdateForm.resourceId) {
      toast.error("Select a resource to update");
      return;
    }
    const payload: UpdateResourceInput = {};
    if (resourceUpdateForm.type) payload.type = resourceUpdateForm.type;
    if (resourceUpdateForm.quantity)
      payload.quantity = Number(resourceUpdateForm.quantity);
    if (resourceUpdateForm.unit) payload.unit = resourceUpdateForm.unit;
    if (resourceUpdateForm.warehouseId) payload.warehouseId = Number(resourceUpdateForm.warehouseId);
    if (resourceUpdateForm.reorderLevel)
      payload.reorderLevel = Number(resourceUpdateForm.reorderLevel);

    if (Object.keys(payload).length === 0) {
      toast.error("Provide at least one field to update");
      return;
    }

    updateResource.mutate(
      { id: Number(resourceUpdateForm.resourceId), data: payload },
      {
        onSuccess: () => {
          toast.success("Resource updated");
          setResourceUpdateForm(initialResourceUpdateForm);
        },
        onError: (error) => toast.error(error.message || "Unable to update resource"),
      },
    );
  }

  function handleCreateTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!transferForm.resourceId || !transferForm.toWarehouseId) {
      toast.error("Select resource and destination");
      return;
    }
    const quantity = Number(transferForm.quantity);
    if (!quantity || quantity <= 0) {
      toast.error("Enter a valid quantity");
      return;
    }

    createTransfer.mutate(
      {
        resourceId: Number(transferForm.resourceId),
        toWarehouseId: Number(transferForm.toWarehouseId),
        quantity,
        note: transferForm.note || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Transfer recorded");
          setTransferForm(initialTransferForm);
        },
        onError: (error) => toast.error(error.message || "Unable to transfer stock"),
      },
    );
  }

  function handleDistributionChange(resourceId: string) {
    setDistributionForm((prev) => {
      const selected = (resources.data ?? []).find((r) => r.id === Number(resourceId));
      return {
        ...prev,
        resourceId,
        warehouseId: selected ? String(selected.warehouseId) : "",
      };
    });
  }

  function handleCreateDistribution(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!distributionForm.resourceId || !distributionForm.warehouseId) {
      toast.error("Select a resource to dispatch");
      return;
    }
    if (!distributionForm.destination) {
      toast.error("Destination is required");
      return;
    }
    const quantity = Number(distributionForm.quantity);
    if (!quantity || quantity <= 0) {
      toast.error("Enter a valid quantity");
      return;
    }

    createDistribution.mutate(
      {
        resourceId: Number(distributionForm.resourceId),
        warehouseId: Number(distributionForm.warehouseId),
        quantity,
        destination: distributionForm.destination,
        requestId: distributionForm.requestId ? Number(distributionForm.requestId) : undefined,
        notes: distributionForm.notes || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Distribution logged");
          setDistributionForm(initialDistributionForm);
        },
        onError: (error) => toast.error(error.message || "Unable to log distribution"),
      },
    );
  }

  const selectedDistributionWarehouseName = (() => {
    if (!distributionForm.warehouseId) return "";
    return warehouseNameMap[Number(distributionForm.warehouseId)] ?? "";
  })();

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
                    const inStock = warehouseTotals[warehouse.id] ?? 0;
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
            <form className="space-y-3" onSubmit={handleCreateWarehouse}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Create warehouse</h3>
                <Button size="sm" type="submit" disabled={createWarehouse.isPending}>
                  {createWarehouse.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
              <div>
                <Label>Name</Label>
                <Input
                  value={warehouseForm.name}
                  onChange={(e) => setWarehouseForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <Label>Location</Label>
                <Input
                  value={warehouseForm.location}
                  onChange={(e) => setWarehouseForm((f) => ({ ...f, location: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Capacity</Label>
                  <Input
                    type="number"
                    value={warehouseForm.capacity}
                    onChange={(e) => setWarehouseForm((f) => ({ ...f, capacity: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Last audited at</Label>
                  <Input
                    type="datetime-local"
                    value={warehouseForm.lastAuditedAt}
                    onChange={(e) => setWarehouseForm((f) => ({ ...f, lastAuditedAt: e.target.value }))}
                  />
                </div>
              </div>
            </form>

            <div className="border-t pt-4">
              <form className="space-y-3" onSubmit={handleUpdateWarehouse}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Update warehouse</h3>
                  <Button size="sm" type="submit" variant="outline" disabled={updateWarehouse.isPending}>
                    {updateWarehouse.isPending ? "Updating…" : "Update"}
                  </Button>
                </div>
                <div>
                  <Label>Warehouse</Label>
                  <select
                    className="mt-1 h-10 w-full rounded-md border px-3"
                    value={warehouseUpdateForm.warehouseId}
                    onChange={(e) => setWarehouseUpdateForm((f) => ({ ...f, warehouseId: e.target.value }))}
                  >
                    <option value="">Select warehouse</option>
                    {(warehouses.data ?? []).map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Name</Label>
                  <Input
                    value={warehouseUpdateForm.name}
                    onChange={(e) => setWarehouseUpdateForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Location</Label>
                  <Input
                    value={warehouseUpdateForm.location}
                    onChange={(e) => setWarehouseUpdateForm((f) => ({ ...f, location: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Capacity</Label>
                    <Input
                      type="number"
                      value={warehouseUpdateForm.capacity}
                      onChange={(e) => setWarehouseUpdateForm((f) => ({ ...f, capacity: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Last audited at</Label>
                    <Input
                      type="datetime-local"
                      value={warehouseUpdateForm.lastAuditedAt}
                      onChange={(e) =>
                        setWarehouseUpdateForm((f) => ({ ...f, lastAuditedAt: e.target.value }))
                      }
                    />
                  </div>
                </div>
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
          </CardHeader>
          <CardContent>
            {resources.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading resources…</p>
            ) : resources.error ? (
              <p className="text-sm text-red-500">Failed to load resources.</p>
            ) : resources.data?.length ? (
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
                  {resources.data.map((resource) => {
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
            <form className="space-y-3" onSubmit={handleCreateResource}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Add resource</h3>
                <Button size="sm" type="submit" disabled={createResource.isPending}>
                  {createResource.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
              <div>
                <Label>Type</Label>
                <Input value={resourceForm.type} onChange={(e) => setResourceForm((f) => ({ ...f, type: e.target.value }))} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    value={resourceForm.quantity}
                    onChange={(e) => setResourceForm((f) => ({ ...f, quantity: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Unit</Label>
                  <Input value={resourceForm.unit} onChange={(e) => setResourceForm((f) => ({ ...f, unit: e.target.value }))} />
                </div>
                <div>
                  <Label>Reorder level</Label>
                  <Input
                    type="number"
                    value={resourceForm.reorderLevel}
                    onChange={(e) => setResourceForm((f) => ({ ...f, reorderLevel: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label>Warehouse</Label>
                <select
                  className="mt-1 h-10 w-full rounded-md border px-3"
                  value={resourceForm.warehouseId}
                  onChange={(e) => setResourceForm((f) => ({ ...f, warehouseId: e.target.value }))}
                >
                  <option value="">Select warehouse</option>
                  {(warehouses.data ?? []).map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </div>
            </form>

            <div className="border-t pt-4">
              <form className="space-y-3" onSubmit={handleUpdateResource}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Update resource</h3>
                  <Button size="sm" type="submit" variant="outline" disabled={updateResource.isPending}>
                    {updateResource.isPending ? "Updating…" : "Update"}
                  </Button>
                </div>
                <div>
                  <Label>Resource</Label>
                  <select
                    className="mt-1 h-10 w-full rounded-md border px-3"
                    value={resourceUpdateForm.resourceId}
                    onChange={(e) => setResourceUpdateForm((f) => ({ ...f, resourceId: e.target.value }))}
                  >
                    <option value="">Select resource</option>
                    {(resources.data ?? []).map((resource) => (
                      <option key={resource.id} value={resource.id}>
                        {resource.type} • {warehouseNameMap[resource.warehouseId] ?? `Warehouse ${resource.warehouseId}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      value={resourceUpdateForm.quantity}
                      onChange={(e) => setResourceUpdateForm((f) => ({ ...f, quantity: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Unit</Label>
                    <Input
                      value={resourceUpdateForm.unit}
                      onChange={(e) => setResourceUpdateForm((f) => ({ ...f, unit: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Reorder level</Label>
                    <Input
                      type="number"
                      value={resourceUpdateForm.reorderLevel}
                      onChange={(e) => setResourceUpdateForm((f) => ({ ...f, reorderLevel: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Warehouse</Label>
                    <select
                      className="mt-1 h-10 w-full rounded-md border px-3"
                      value={resourceUpdateForm.warehouseId}
                      onChange={(e) => setResourceUpdateForm((f) => ({ ...f, warehouseId: e.target.value }))}
                    >
                      <option value="">Keep current</option>
                      {(warehouses.data ?? []).map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>
                          {warehouse.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <Label>Rename</Label>
                  <Input
                    value={resourceUpdateForm.type}
                    onChange={(e) => setResourceUpdateForm((f) => ({ ...f, type: e.target.value }))}
                  />
                </div>
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
            <form className="space-y-3" onSubmit={handleCreateTransfer}>
              <div>
                <Label>Resource</Label>
                <select
                  className="mt-1 h-10 w-full rounded-md border px-3"
                  value={transferForm.resourceId}
                  onChange={(e) => setTransferForm((f) => ({ ...f, resourceId: e.target.value }))}
                >
                  <option value="">Select resource</option>
                  {(resources.data ?? []).map((resource) => (
                    <option key={resource.id} value={resource.id}>
                      {resource.type} • {warehouseNameMap[resource.warehouseId] ?? `Warehouse ${resource.warehouseId}`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Destination warehouse</Label>
                  <select
                    className="mt-1 h-10 w-full rounded-md border px-3"
                    value={transferForm.toWarehouseId}
                    onChange={(e) => setTransferForm((f) => ({ ...f, toWarehouseId: e.target.value }))}
                  >
                    <option value="">Select destination</option>
                    {(warehouses.data ?? []).map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    value={transferForm.quantity}
                    onChange={(e) => setTransferForm((f) => ({ ...f, quantity: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label>Note</Label>
                <Textarea
                  value={transferForm.note}
                  onChange={(e) => setTransferForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="Optional context for the move"
                />
              </div>
              <Button type="submit" disabled={createTransfer.isPending}>
                {createTransfer.isPending ? "Transferring…" : "Record transfer"}
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
                        {warehouseNameMap[transfer.fromWarehouseId ?? 0] ?? "Unknown"} →
                        {" "}
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
            <form className="space-y-3" onSubmit={handleCreateDistribution}>
              <div>
                <Label>Resource</Label>
                <select
                  className="mt-1 h-10 w-full rounded-md border px-3"
                  value={distributionForm.resourceId}
                  onChange={(e) => handleDistributionChange(e.target.value)}
                >
                  <option value="">Select resource</option>
                  {(resources.data ?? []).map((resource) => (
                    <option key={resource.id} value={resource.id}>
                      {resource.type} • {warehouseNameMap[resource.warehouseId] ?? `Warehouse ${resource.warehouseId}`}
                    </option>
                  ))}
                </select>
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
                    value={distributionForm.quantity}
                    onChange={(e) => setDistributionForm((f) => ({ ...f, quantity: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Linked request ID</Label>
                  <Input
                    type="number"
                    value={distributionForm.requestId}
                    onChange={(e) => setDistributionForm((f) => ({ ...f, requestId: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label>Destination</Label>
                <Input
                  value={distributionForm.destination}
                  onChange={(e) => setDistributionForm((f) => ({ ...f, destination: e.target.value }))}
                />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={distributionForm.notes}
                  onChange={(e) => setDistributionForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Include vehicle, contact, or ETA"
                />
              </div>
              <Button type="submit" disabled={createDistribution.isPending}>
                {createDistribution.isPending ? "Logging…" : "Log distribution"}
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
    </div>
  );
}
