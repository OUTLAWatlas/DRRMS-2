import { Link, useLocation } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo } from "react";
import type { FieldErrors } from "react-hook-form";
import { useAppStore } from "@/state/app-store";
import { toast } from "sonner";
import {
  useGetUserRescueRequestsQuery,
  useSubmitReportMutation,
  useSubmitRescueRequestMutation,
} from "@/hooks/api-hooks";
import { createReportSchema, createRescueRequestSchema, survivorSubmissionSchema } from "@shared/api";
import type { RescueRequest, SurvivorSubmissionInput } from "@shared/api";
import { useZodForm } from "@/hooks/use-zod-form";

const severityOptions = ["Low", "Moderate", "High", "Critical"] as const;

export default function RequestDashboard() {
  const { user, hydrated } = useAppStore();
  const rescueRequestsQuery = useGetUserRescueRequestsQuery({ limit: 10 });
  const submitRescueRequest = useSubmitRescueRequestMutation();
  const submitReport = useSubmitReportMutation();
  const loc = useLocation() as any;
  const isReportMode = loc.state?.fromReport ?? false;

  const prefill = loc.state?.prefill as
    | { what?: string; where?: string; severity?: string; when?: string }
    | undefined;

  const survivorFormDefaults = useMemo<SurvivorSubmissionInput>(() => {
    const base = {
      what: prefill?.what ?? "",
      where: prefill?.where ?? "",
      severity: (prefill?.severity as SurvivorSubmissionInput["severity"]) ?? "Moderate",
      when: prefill?.when ?? "",
      people: 1,
      contact: "",
      notes: "",
    } satisfies Omit<SurvivorSubmissionInput, "kind" | "resourcesRequired">;

    if (isReportMode) {
      return {
        kind: "report",
        ...base,
      } satisfies SurvivorSubmissionInput;
    }

    return {
      kind: "request",
      ...base,
      resourcesRequired: 1,
    } satisfies SurvivorSubmissionInput;
  }, [isReportMode, prefill?.what, prefill?.where, prefill?.severity, prefill?.when]);

  const survivorForm = useZodForm({
    schema: survivorSubmissionSchema,
    defaultValues: survivorFormDefaults,
  });

  const { register, handleSubmit: handleSurvivorSubmit, formState } = survivorForm;
  const requestErrors = formState.errors as FieldErrors<SurvivorRequestForm>;

  useEffect(() => {
    survivorForm.reset(survivorFormDefaults);
  }, [survivorFormDefaults, survivorForm]);

  useEffect(() => {
    survivorForm.setValue("kind", isReportMode ? "report" : "request");
  }, [isReportMode, survivorForm]);

  const onSubmit = handleSurvivorSubmit((values) => {
    if (!hydrated) return;
    if (!user) {
      toast.error("Please sign in before submitting a request.");
      return;
    }

    survivorForm.clearErrors("root");

    if (values.kind === "report") {
      const payload = createReportSchema.parse({
        whatHappened: values.what,
        location: values.where,
        severity: values.severity,
        occurredAt: values.when ? new Date(values.when).toISOString() : undefined,
      });
      submitReport.mutate(payload, {
        onSuccess: () => {
          toast.success("Disaster report submitted. Help is on the way.");
          survivorForm.reset({ ...survivorFormDefaults, contact: "", notes: "" });
        },
        onError: (error) => {
          const message = error?.message || "Failed to submit report";
          toast.error(message);
          survivorForm.setError("root", { type: "server", message });
        },
      });
      return;
    }

    const requestValues = values as SurvivorRequestForm;
    const payload = createRescueRequestSchema.parse(buildRescuePayload(requestValues));
    submitRescueRequest.mutate(payload, {
      onSuccess: () => {
        toast.success("Help request submitted. Stay alert for updates.");
        survivorForm.reset({ ...survivorFormDefaults, contact: "", notes: "" });
      },
      onError: (error) => {
        const message = error?.message || "Failed to submit help request";
        toast.error(message);
        survivorForm.setError("root", { type: "server", message });
      },
    });
  });

  const isMutating = submitRescueRequest.isPending || submitReport.isPending;
  const isBusy = isMutating || formState.isSubmitting;

  const recentRequests = useMemo(() => {
    if (!rescueRequestsQuery.data?.requests) return [] as RescueRequest[];
    return rescueRequestsQuery.data.requests.slice(0, 5);
  }, [rescueRequestsQuery.data?.requests]);

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
          <form onSubmit={onSubmit} className="space-y-5">
            <input type="hidden" value={isReportMode ? "report" : "request"} {...register("kind")} />
            {isReportMode ? (
              <>
                <div>
                  <Label>People needing help</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    className="mt-2"
                    disabled={isBusy}
                    {...register("people")}
                  />
                  {formState.errors.people && (
                    <p className="mt-1 text-xs text-destructive">
                      {formState.errors.people.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label>Location</Label>
                  <Input
                    placeholder="Area / address"
                    className="mt-2"
                    disabled={isBusy}
                    {...register("where")}
                  />
                  {formState.errors.where && (
                    <p className="mt-1 text-xs text-destructive">
                      {formState.errors.where.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label>What happened?</Label>
                  <Textarea
                    placeholder="Brief description of the disaster"
                    className="mt-2"
                    disabled={isBusy}
                    {...register("what")}
                  />
                  {formState.errors.what && (
                    <p className="mt-1 text-xs text-destructive">
                      {formState.errors.what.message}
                    </p>
                  )}
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Severity</Label>
                    <select
                      className="mt-2 h-10 w-full rounded-md border px-3"
                      disabled={isBusy}
                      {...register("severity")}
                    >
                      {severityOptions.map((s) => (
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
                      className="mt-2"
                      disabled={isBusy}
                      {...register("contact")}
                    />
                    {formState.errors.contact && (
                      <p className="mt-1 text-xs text-destructive">
                        {formState.errors.contact.message}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <Label>Additional notes</Label>
                  <Textarea
                    placeholder="Any extra information"
                    className="mt-2"
                    disabled={isBusy}
                    {...register("notes")}
                  />
                  {formState.errors.notes && (
                    <p className="mt-1 text-xs text-destructive">
                      {formState.errors.notes.message}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>People needing help</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      className="mt-2"
                      disabled={isBusy}
                      {...register("people")}
                    />
                    {formState.errors.people && (
                      <p className="mt-1 text-xs text-destructive">
                        {formState.errors.people.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Resources required</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      className="mt-2"
                      disabled={isBusy}
                      {...register("resourcesRequired")}
                    />
                    {requestErrors.resourcesRequired && (
                      <p className="mt-1 text-xs text-destructive">
                        {requestErrors.resourcesRequired.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Contact</Label>
                    <Input
                      placeholder="Phone or email"
                      className="mt-2"
                      disabled={isBusy}
                      {...register("contact")}
                    />
                    {formState.errors.contact && (
                      <p className="mt-1 text-xs text-destructive">
                        {formState.errors.contact.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>When did it occur?</Label>
                    <Input
                      type="datetime-local"
                      className="mt-2"
                      disabled={isBusy}
                      {...register("when")}
                    />
                  </div>
                </div>

                <div>
                  <Label>Where</Label>
                  <Input
                    placeholder="Area / address"
                    className="mt-2"
                    disabled={isBusy}
                    {...register("where")}
                  />
                  {formState.errors.where && (
                    <p className="mt-1 text-xs text-destructive">
                      {formState.errors.where.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label>What is needed?</Label>
                  <Textarea
                    placeholder="Describe what help you need"
                    className="mt-2"
                    disabled={isBusy}
                    {...register("what")}
                  />
                  {formState.errors.what && (
                    <p className="mt-1 text-xs text-destructive">
                      {formState.errors.what.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label>Severity</Label>
                  <select
                    className="mt-2 h-10 w-full rounded-md border px-3"
                    disabled={isBusy}
                    {...register("severity")}
                  >
                    {severityOptions.map((s) => (
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
                    className="mt-2"
                    disabled={isBusy}
                    {...register("notes")}
                  />
                  {formState.errors.notes && (
                    <p className="mt-1 text-xs text-destructive">
                      {formState.errors.notes.message}
                    </p>
                  )}
                </div>
              </>
            )}

            {formState.errors.root?.message && (
              <p className="text-sm text-destructive">{formState.errors.root.message}</p>
            )}

            <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={isBusy}>
              {isBusy ? "Sending..." : isReportMode ? "Report Disaster" : "Request Help"}
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

type SurvivorRequestForm = SurvivorSubmissionInput & { kind: "request" };

function buildRescuePayload(form: SurvivorRequestForm) {
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

function mapSeverityToPriority(severity: SurvivorSubmissionInput["severity"]) {
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

