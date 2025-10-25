import { useLocation } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useAppStore, newRequestId } from "@/state/app-store";
import { toast } from "sonner";

export default function RequestDashboard() {
  const { state, dispatch } = useAppStore();
  const loc = useLocation() as any;
  const prefill = loc.state?.prefill as
    | { what?: string; where?: string; severity?: string; when?: string }
    | undefined;

  const [form, setForm] = useState({
    kind: loc.state?.fromReport ? "report" : "request",
    what: prefill?.what ?? "",
    where: prefill?.where ?? "",
    severity: (prefill?.severity as any) ?? "Moderate",
    when: prefill?.when ?? "",
    people: 1,
    resourcesRequired: 1,
    contact: "",
    notes: "",
  });

  return (
    <div className="py-10 sm:py-14">
      <h1 className="text-center text-3xl sm:text-4xl font-extrabold mb-2">Help & Report Dashboard</h1>
      <p className="text-center text-muted-foreground mb-8">Provide details below so responders can assist quickly.</p>
      <div className="container mx-auto max-w-3xl">
        <div className="rounded-xl bg-white text-black p-6 sm:p-8 shadow-xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const id = newRequestId();
              dispatch({
                type: "SUBMIT_REQUEST",
                payload: {
                  id,
                  kind: form.kind as any,
                  what: form.what,
                  where: form.where,
                  severity: form.severity as any,
                  when: form.when,
                  people: Number(form.people) || 1,
                  resourcesRequired: Number(form.resourcesRequired) || 1,
                  contact: form.contact,
                  status: "pending",
                },
              });
              toast.success(
                "Help is on the way. If further assistance is required, request additional help.",
              );
              setForm({ ...form, notes: "", contact: "" });
            }}
            className="space-y-5"
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Type</Label>
                <select
                  value={form.kind}
                  onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as any }))}
                  className="mt-2 h-10 w-full rounded-md border px-3"
                >
                  <option value="request">Request Help</option>
                  <option value="report">Report Disaster</option>
                </select>
              </div>
              <div>
                <Label>People needing help</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.people}
                  onChange={(e) => setForm((f) => ({ ...f, people: Number(e.target.value) }))}
                  className="mt-2"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Resources required</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.resourcesRequired}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, resourcesRequired: Number(e.target.value) }))
                  }
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Contact</Label>
                <Input
                  placeholder="Phone or email"
                  value={form.contact}
                  onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
                  className="mt-2"
                />
              </div>
            </div>

            <div>
              <Label>Where</Label>
              <Input
                placeholder="Area / address"
                value={form.where}
                onChange={(e) => setForm((f) => ({ ...f, where: e.target.value }))}
                className="mt-2"
              />
            </div>

            <div>
              <Label>What happened?</Label>
              <Textarea
                placeholder="Brief description"
                value={form.what}
                onChange={(e) => setForm((f) => ({ ...f, what: e.target.value }))}
                className="mt-2"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Severity</Label>
                <select
                  value={form.severity}
                  onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}
                  className="mt-2 h-10 w-full rounded-md border px-3"
                >
                  {(["Low", "Moderate", "High", "Critical"] as const).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>When did it occur?</Label>
                <Input
                  type="datetime-local"
                  value={form.when}
                  onChange={(e) => setForm((f) => ({ ...f, when: e.target.value }))}
                  className="mt-2"
                />
              </div>
            </div>

            <div>
              <Label>Additional notes</Label>
              <Textarea
                placeholder="Any extra information"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="mt-2"
              />
            </div>

            <Button type="submit" className="w-full h-12 text-base font-semibold">Submit</Button>
          </form>
        </div>
      </div>
    </div>
  );
}
