import { useAppStore } from "@/state/app-store";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

export default function ResourcesPage() {
  const requests = useAppStore((state) => state.requests);
  const warehouses = useAppStore((state) => state.warehouses);
  const availableResources = useAppStore((state) => state.availableResources);
  const adjustWarehouseStock = useAppStore((state) => state.adjustWarehouseStock);
  const dispatchFromWarehouse = useAppStore((state) => state.dispatchFromWarehouse);

  useEffect(() => {
    const t = setInterval(() => {
      if (requests.some((r) => r.status === "pending")) {
        dispatchFromWarehouse("Water", 5);
      }
    }, 5000);
    return () => clearInterval(t);
  }, [requests, dispatchFromWarehouse]);

  return (
    <div className="py-10 sm:py-14 container mx-auto">
      <h1 className="text-3xl sm:text-4xl font-extrabold mb-6">Warehouse Resource Tracker</h1>
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Warehouse Overview</h2>
            <div className="text-sm text-muted-foreground">Available: {availableResources}</div>
          </div>
          <div className="space-y-5">
            {warehouses.map((w) => {
              const pct = Math.min(100, Math.round((w.stock / (w.stock + w.distributed || 1)) * 100));
              return (
                <div key={w.type} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{w.type}</div>
                    <div className="text-sm text-muted-foreground">
                      Stock: {w.stock} • Distributed: {w.distributed}
                    </div>
                  </div>
                  <div className="mt-3">
                    <Progress value={pct} />
                    <div className="mt-3 flex gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => adjustWarehouseStock(w.type, 20)}
                      >
                        Incoming +20
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => dispatchFromWarehouse(w.type, 10)}
                      >
                        Dispatch 10
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6">
          <h2 className="text-xl font-bold mb-4">Real-Time Tracking Panel</h2>
          <ul className="space-y-3 text-sm">
            <li>Incoming stock delivery of 100 units of water</li>
            <li>Outgoing distribution of 50 food packs to Pune relief center</li>
            <li>Water stock below 20% in Mumbai warehouse</li>
          </ul>
          <div className="mt-6 flex gap-3">
            <Button onClick={() => adjustWarehouseStock("Water", 100)}>
              Update Stock
            </Button>
            <Button
              variant="outline"
              onClick={() => dispatchFromWarehouse("Food", 50)}
            >
              Dispatch Resources
            </Button>
          </div>
          <div className="mt-6 text-sm text-muted-foreground">
            Stock levels refresh in real-time as resources are distributed or received.
          </div>
        </div>
      </div>
    </div>
  );
}
