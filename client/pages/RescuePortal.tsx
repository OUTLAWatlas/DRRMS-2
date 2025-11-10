import { Button } from "@/components/ui/button";
import { useAppStore } from "@/state/app-store";
import { useMemo, useState } from "react";

export default function RescuePortal() {
  const requests = useAppStore((state) => state.requests);
  const notifications = useAppStore((state) => state.notifications);
  const availableResources = useAppStore((state) => state.availableResources);
  const peopleNeedingHelp = useAppStore((state) => state.peopleNeedingHelp);
  const fulfillRequest = useAppStore((state) => state.fulfillRequest);
  const rejectRequest = useAppStore((state) => state.rejectRequest);
  const updateAvailableResources = useAppStore((state) => state.updateAvailableResources);
  const dispatchFromWarehouse = useAppStore((state) => state.dispatchFromWarehouse);
  
  const [resourceInput, setResourceInput] = useState(availableResources);

  const pending = useMemo(() => requests.filter((r) => r.status === "pending"), [requests]);

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

      <div className="py-10 sm:py-14 container mx-auto">
        <h2 className="text-2xl sm:text-3xl font-extrabold mb-6">Disaster Response Dashboard</h2>
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
                <div className="text-sm text-muted-foreground">{pending.length > 0 ? "Active" : "Idle"}</div>
              </div>
              {pending.length > 0 ? (
                <div className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold">#{pending[0].id} • {pending[0].kind === "report" ? "Report" : "Help"} • {pending[0].severity}</div>
                    <div className="text-sm text-muted-foreground">{pending[0].where}</div>
                  </div>
                  <div className="mt-2 text-sm">{pending[0].what}</div>
                  <div className="mt-3 flex gap-2">
                    <Button onClick={() => fulfillRequest(pending[0].id)}>Mark Fulfilled</Button>
                    <Button variant="outline" onClick={() => dispatchFromWarehouse("Water", 10)}>Dispatch 10 Water</Button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No active rescues.</div>
              )}
            </section>

            <section className="rounded-xl border bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Requests</h2>
                <div className="text-sm text-muted-foreground">Pending: {pending.length}</div>
              </div>
              <div className="space-y-3">
                {pending.map((r) => (
                  <div key={r.id} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-semibold">#{r.id} • {r.kind === "report" ? "Report" : "Help"} • {r.severity}</div>
                      <div className="text-sm text-muted-foreground">{r.where}</div>
                    </div>
                    <div className="mt-2 text-sm">{r.what}</div>
                    <div className="mt-3 flex gap-2">
                      <Button onClick={() => fulfillRequest(r.id)}>Fulfill</Button>
                      <Button variant="outline" onClick={() => rejectRequest(r.id)}>Reject</Button>
                    </div>
                  </div>
                ))}
                {pending.length === 0 && (
                  <div className="text-sm text-muted-foreground">No pending requests.</div>
                )}
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
                <li>People needing help: <strong>{peopleNeedingHelp}</strong></li>
                <li>Resources required based on requests: <strong>{pending.reduce((s, r) => s + (r.resourcesRequired ?? 1), 0)}</strong></li>
              </ul>
              <div className="mt-4 flex gap-2">
                <input
                  type="number"
                  className="h-10 w-full rounded-md border px-3"
                  value={resourceInput}
                  onChange={(e) => setResourceInput(parseInt(e.target.value || "0"))}
                />
                <Button onClick={() => updateAvailableResources(resourceInput)}>Update</Button>
              </div>
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
