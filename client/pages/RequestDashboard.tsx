import { Link, useLocation } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";
import { useAppStore } from "@/state/app-store";
import { toast } from "sonner";
import {
  useGetUserRescueRequestsQuery,
  useSubmitReportMutation,
  useSubmitRescueRequestMutation,
} from "@/hooks/api-hooks";
import type { RescueRequest } from "@shared/api";

type RequestFormState = {
  kind: "request" | "report";
  what: string;
  where: string;
  severity: "Low" | "Moderate" | "High" | "Critical";
  when: string;
  people: number;
  resourcesRequired: number;
  contact: string;
  notes: string;
};

const BASE_FORM: RequestFormState = {
  kind: "request",
  what: "",
  where: "",
  severity: "Moderate",
  when: "",
  people: 1,
  resourcesRequired: 1,
  contact: "",
  notes: "",
};

export default function RequestDashboard() {
  const { user, hydrated } = useAppStore();
  const rescueRequestsQuery = useGetUserRescueRequestsQuery();
  const submitRescueRequest = useSubmitRescueRequestMutation();
  const submitReport = useSubmitReportMutation();
  const loc = useLocation() as any;
  const isReportMode = loc.state?.fromReport ?? false;

  const prefill = loc.state?.prefill as
    | { what?: string; where?: string; severity?: string; when?: string }
    | undefined;

  const [form, setForm] = useState<RequestFormState>({
    ...BASE_FORM,
    kind: isReportMode ? "report" : "request",
    what: prefill?.what ?? "",
    where: prefill?.where ?? "",
    severity: (prefill?.severity as any) ?? "Moderate",
    when: prefill?.when ?? "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hydrated) return;
    if (!user) {
      toast.error("Please sign in before submitting a request.");
      return;
    }

    if (isReportMode) {
      submitReport.mutate(
        {
          whatHappened: form.what,
          location: form.where,
          severity: form.severity as any,
          occurredAt: form.when ? new Date(form.when).toISOString() : undefined,
        },
        {
          onSuccess: () => {
            toast.success("Disaster report submitted. Help is on the way.");
            setForm((prev) => ({ ...prev, notes: "", contact: "" }));
          },
          onError: (error) => {
            toast.error(error.message || "Failed to submit report");
          },
        },
      );
      return;
    }

    const payload = buildRescuePayload(form);
    submitRescueRequest.mutate(payload, {
      onSuccess: () => {
        setForm((prev) => ({ ...prev, notes: "", contact: "" }));
      },
      onError: (error) => {
        toast.error(error.message || "Failed to submit help request");
      },
    });
  };

  const recentRequests = useMemo(() => {
    if (!rescueRequestsQuery.data) return [] as RescueRequest[];
    return rescueRequestsQuery.data.slice(0, 5);
  }, [rescueRequestsQuery.data]);

  if (!hydrated) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        Restoring your session…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="py-20 text-center space-y-4">
        <p className="text-lg font-semibold">Please sign in to request help.</p>
        <Button asChild>
          <Link to="/signin">Go to sign in</Link>
        </Button>
      </div>
    );
  }

  if (user.role !== "survivor") {
    return (
      <div className="py-20 text-center space-y-4">
        <p className="text-lg font-semibold">This page is available only to survivor accounts.</p>
        <Button asChild variant="outline">
          <Link to="/rescue">Open rescuer tools</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="py-10 sm:py-14">
      <h1 className="text-center text-3xl sm:text-4xl font-extrabold mb-2">
        {isReportMode ? "Report Disaster" : "Request Help"}
      </h1>
      <p className="text-center text-muted-foreground mb-8">Provide details below so responders can assist quickly.</p>
      <div className="container mx-auto max-w-3xl">
        <div className="rounded-xl bg-white text-black p-6 sm:p-8 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            {isReportMode ? (
              <>
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

                <div>
                  <Label>Location</Label>
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
                    placeholder="Brief description of the disaster"
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
                      onChange={(e) =>
                        setForm((f) => ({ ...f, severity: e.target.value as RequestFormState["severity"] }))
                      }
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
                  <Label>Additional notes</Label>
                  <Textarea
                    placeholder="Any extra information"
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    className="mt-2"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="grid sm:grid-cols-2 gap-4">
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
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Contact</Label>
                    <Input
                      placeholder="Phone or email"
                      value={form.contact}
                      onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
                      className="mt-2"
                    />
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
                  <Label>Where</Label>
                  <Input
                    placeholder="Area / address"
                    value={form.where}
                    onChange={(e) => setForm((f) => ({ ...f, where: e.target.value }))}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label>What is needed?</Label>
                  <Textarea
                    placeholder="Describe what help you need"
                    value={form.what}
                    onChange={(e) => setForm((f) => ({ ...f, what: e.target.value }))}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label>Severity</Label>
                  <select
                    value={form.severity}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, severity: e.target.value as RequestFormState["severity"] }))
                    }
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
                  <Label>Additional notes</Label>
                  <Textarea
                    placeholder="Any extra information"
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    className="mt-2"
                  />
                </div>
              </>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold"
              disabled={submitRescueRequest.isPending || submitReport.isPending}
            >
              {submitRescueRequest.isPending || submitReport.isPending
                ? "Sending…"
                : isReportMode
                  ? "Report Disaster"
                  : "Request Help"}
            </Button>
          </form>
        </div>
      </div>
      {recentRequests.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xl font-semibold mb-4">Recent requests</h2>
          <div className="space-y-3">
            {recentRequests.map((request) => (
              <div key={request.id} className="rounded-lg border bg-white text-black p-4 shadow-sm">
                <div className="flex items-center justify-between text-sm">
                  <p className="font-semibold">Request #{request.id}</p>
                  <span className="capitalize text-muted-foreground">{request.status.replace("_", " ")}</span>
                </div>
                <p className="text-sm mt-2">{request.details}</p>
                <div className="mt-2 text-xs text-muted-foreground flex flex-wrap gap-3">
                  <span>{request.location}</span>
                  {request.peopleCount != null && <span>{request.peopleCount} people</span>}
                  <span>Priority: {request.priority}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function buildRescuePayload(form: RequestFormState) {
  const baseDetails = form.what.trim() || "Assistance requested";
  const extras = [
    form.notes?.trim() ? `Notes: ${form.notes}` : null,
    form.contact?.trim() ? `Contact: ${form.contact}` : null,
    form.when ? `Reported at ${new Date(form.when).toLocaleString()}` : null,
  ].filter(Boolean);

  const details = [baseDetails, ...extras].join("\n");

  return {
    location: form.where,
    details,
    peopleCount: Number(form.people) || undefined,
    priority: mapSeverityToPriority(form.severity),
  } satisfies Parameters<ReturnType<typeof useSubmitRescueRequestMutation>["mutate"]>[0];
}

function mapSeverityToPriority(severity: string) {
  switch (severity) {
    case "High":
    case "Critical":
      return "high" as const;
    case "Low":
      return "low" as const;
    default:
      return "medium" as const;
  }
}

