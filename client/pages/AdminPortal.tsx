import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { BookmarkPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { OperationsMap } from "@/components/geo/OperationsMap";
import { DemandHeatmapGrid, DemandTrendChart } from "@/components/DemandSignals";
import { useAppStore } from "@/state/app-store";
import {
  useApproveRescuerMutation,
  useGetPendingRescuersQuery,
  useGetRescueRequestsQuery,
  useGetResourcesQuery,
  useGetWarehousesQuery,
  useGetRespondersQuery,
  useUpdateUserRoleMutation,
  useUpdateUserAccessMutation,
  useGetPrioritiesQuery,
  useRecalculatePrioritiesMutation,
  useApplyRecommendationMutation,
  useTransactionSummaryQuery,
  useGetTransactionsQuery,
  useCreateTransactionMutation,
  useGetAllocationHistoryQuery,
  useLiveWeatherQuery,
  useGovernmentAlertsQuery,
  useRefreshLiveFeedsMutation,
  useGeoOverviewQuery,
  useGeoHeatmapQuery,
  usePredictiveRecommendationsQuery,
  usePredictiveFeedbackMutation,
  useDemandInsightsQuery,
  useSchedulerHealthQuery,
} from "@/hooks/api-hooks";
import type {
  PredictiveFeedbackAction,
  PredictiveRecommendationContext,
  SchedulerHealthRecord,
  SchedulerHealthStatus,
} from "@shared/api";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";

const statusStyles: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  in_progress: "bg-blue-100 text-blue-800",
  fulfilled: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-gray-100 text-gray-700",
};

const schedulerStatusBadge: Record<SchedulerHealthStatus, string> = {
  healthy: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  critical: "border-red-200 bg-red-50 text-red-900",
};

const schedulerStatusDot: Record<SchedulerHealthStatus, string> = {
  healthy: "bg-emerald-500",
  warning: "bg-amber-500",
  critical: "bg-red-500",
};

export default function AdminPortal() {
  const pendingRescuers = useGetPendingRescuersQuery();
  const approveRescuer = useApproveRescuerMutation();
  const responders = useGetRespondersQuery();
  const updateUserRole = useUpdateUserRoleMutation();
  const updateUserAccess = useUpdateUserAccessMutation();
  const priorities = useGetPrioritiesQuery();
  const recalcPriorities = useRecalculatePrioritiesMutation();
  const applyRecommendation = useApplyRecommendationMutation();
  const [transactionPeriod, setTransactionPeriod] = useState<"day" | "week" | "month">("day");
  const [transactionWindowDays, setTransactionWindowDays] = useState(30);
  const [transactionCategory, setTransactionCategory] = useState("");
  const [savedCategoryPresets, setSavedCategoryPresets] = useState<string[]>([]);
  const presetCategories = ["fuel", "logistics", "grant", "donation", "medical", "operations"];
  const [allocationWindowDays, setAllocationWindowDays] = useState(7);
  const [allocationResourceFilter, setAllocationResourceFilter] = useState("all");
  const [allocationEventFilter, setAllocationEventFilter] = useState("all");
  const transactionSummary = useTransactionSummaryQuery({
    period: transactionPeriod,
    windowDays: transactionWindowDays,
    category: transactionCategory || undefined,
  });
  const transactionRange = transactionSummary.data?.range;
  const transactions = useGetTransactionsQuery({
    start: transactionRange?.start,
    end: transactionRange?.end,
    category: transactionCategory || undefined,
    limit: 250,
  });
  const createTransaction = useCreateTransactionMutation();
  const allocationRange = useMemo(() => {
    const end = Date.now();
    const start = end - allocationWindowDays * 24 * 60 * 60 * 1000;
    return { start, end };
  }, [allocationWindowDays]);
  const allocationHistory = useGetAllocationHistoryQuery({
    start: allocationRange.start,
    end: allocationRange.end,
    resourceId: allocationResourceFilter !== "all" ? Number(allocationResourceFilter) : undefined,
    eventType: allocationEventFilter !== "all" ? (allocationEventFilter as "booked" | "dispatched" | "released") : undefined,
    limit: 120,
  });
  const liveWeather = useLiveWeatherQuery();
  const alerts = useGovernmentAlertsQuery({ limit: 5 });
  const refreshLiveFeeds = useRefreshLiveFeedsMutation();
  const geoOverview = useGeoOverviewQuery();
  const geoHeatmap = useGeoHeatmapQuery({ bucket: 0.2, window: 24 });
  const predictiveRecommendations = usePredictiveRecommendationsQuery({ limit: 5 });
  const predictiveFeedback = usePredictiveFeedbackMutation();
  const demandInsights = useDemandInsightsQuery({ buckets: 12 });
  const schedulerHealth = useSchedulerHealthQuery();
  const rescueRequests = useGetRescueRequestsQuery();
  const warehouses = useGetWarehousesQuery();
  const resources = useGetResourcesQuery();
  const currentUserId = useAppStore((s) => s.user?.id);
  const [transactionForm, setTransactionForm] = useState({
    reference: "",
    direction: "income" as "income" | "expense",
    amount: "",
    currency: "INR",
    description: "",
    requestId: "",
    category: "",
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("admin-ledger-category-presets");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setSavedCategoryPresets(parsed.filter((item): item is string => typeof item === "string"));
        }
      } catch {
        // ignore malformed presets
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("admin-ledger-category-presets", JSON.stringify(savedCategoryPresets));
  }, [savedCategoryPresets]);

  const requestStats = useMemo(() => {
    const stats: Record<string, number> = {
      pending: 0,
      in_progress: 0,
      fulfilled: 0,
      cancelled: 0,
    };
    rescueRequests.data?.forEach((request) => {
      stats[request.status] = (stats[request.status] ?? 0) + 1;
    });
    return stats;
  }, [rescueRequests.data]);

  const totalWarehouseStock = useMemo(() => {
    if (!resources.data) return 0;
    return resources.data.reduce((sum, item) => sum + item.quantity, 0);
  }, [resources.data]);

  const resourceOptions = useMemo(() => {
    if (!resources.data) return [];
    return resources.data.map((resource) => ({
      value: resource.id.toString(),
      label: `${resource.type} · WH ${resource.warehouseId ?? "—"}`,
    }));
  }, [resources.data]);

  const transactionCategoryOptions = useMemo(() => {
    if (!transactionSummary.data?.categories) return [];
    return Array.from(new Set(transactionSummary.data.categories.map((cat) => cat.category)));
  }, [transactionSummary.data]);

  const transactionRangeLabel = useMemo(() => {
    if (!transactionRange) return "All time";
    const start = new Date(transactionRange.start).toLocaleDateString();
    const end = new Date(transactionRange.end).toLocaleDateString();
    return `${start} → ${end}`;
  }, [transactionRange]);

  const allocationRangeLabel = useMemo(() => {
    const start = new Date(allocationRange.start).toLocaleDateString();
    const end = new Date(allocationRange.end).toLocaleDateString();
    return `${start} → ${end}`;
  }, [allocationRange]);

  const topPriorityScore = useMemo(() => priorities.data?.[0]?.score ?? 0, [priorities.data]);

  const handleApprove = (rescuerId: number) => {
    approveRescuer.mutate(rescuerId, {
      onSuccess: () => {
        toast.success("Rescuer approved successfully");
      },
      onError: (error) => {
        toast.error(error.message || "Unable to approve rescuer");
      },
    });
  };

  const handleRoleChange = (userId: number, role: "rescuer" | "admin") => {
    updateUserRole.mutate(
      { userId, role },
      {
        onSuccess: (data) => {
          toast.success(data.message);
        },
        onError: (error) => {
          toast.error(error.message || "Unable to update role");
        },
      },
    );
  };

  const handleAccessChange = (userId: number, blocked: boolean) => {
    updateUserAccess.mutate(
      { userId, blocked },
      {
        onSuccess: (data) => {
          toast.success(data.message);
        },
        onError: (error) => {
          toast.error(error.message || "Unable to update access");
        },
      },
    );
  };

  const handleApplyRecommendation = (recommendationId: number) => {
    applyRecommendation.mutate(
      { recommendationId },
      {
        onSuccess: () => {
          toast.success("Recommendation applied");
        },
        onError: (error) => {
          toast.error(error.message || "Failed to apply recommendation");
        },
      },
    );
  };

  const handlePredictiveAction = (recommendationId: number, action: PredictiveFeedbackAction) => {
    predictiveFeedback.mutate(
      { recommendationId, action },
      {
        onSuccess: () => {
          toast.success(action === "applied" ? "Prediction queued" : "Prediction dismissed");
        },
        onError: (error) => {
          toast.error(error.message || "Unable to update prediction");
        },
      },
    );
  };

  const handleSaveCategoryPreset = () => {
    if (!transactionCategory) {
      toast.error("Select a category first");
      return;
    }
    setSavedCategoryPresets((prev) => {
      if (prev.includes(transactionCategory)) {
        toast.info("Preset already saved");
        return prev;
      }
      const next = [transactionCategory, ...prev].slice(0, 5);
      toast.success("Category preset saved");
      return next;
    });
  };

  const handleRemoveCategoryPreset = (preset: string) => {
    setSavedCategoryPresets((prev) => prev.filter((item) => item !== preset));
  };

  const handleClearSavedPresets = () => setSavedCategoryPresets([]);

  const handleTransactionExport = () => {
    const search = new URLSearchParams();
    if (transactionRange?.start != null) search.set("start", transactionRange.start.toString());
    if (transactionRange?.end != null) search.set("end", transactionRange.end.toString());
    if (transactionCategory) search.set("category", transactionCategory);
    search.set("limit", "1000");
    const qs = search.toString();
    window.open(`/api/transactions/export${qs ? `?${qs}` : ""}`, "_blank", "noopener,noreferrer");
  };

  const handleAllocationExport = () => {
    const search = new URLSearchParams();
    search.set("start", allocationRange.start.toString());
    search.set("end", allocationRange.end.toString());
    if (allocationResourceFilter !== "all") search.set("resourceId", allocationResourceFilter);
    if (allocationEventFilter !== "all") search.set("eventType", allocationEventFilter);
    search.set("limit", "1000");
    const qs = search.toString();
    window.open(`/api/allocations/history/export${qs ? `?${qs}` : ""}`, "_blank", "noopener,noreferrer");
  };

  const handleCreateTransaction = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!transactionForm.reference || !transactionForm.amount) {
      toast.error("Reference and amount are required");
      return;
    }
    const amountValue = Number(transactionForm.amount);
    if (Number.isNaN(amountValue) || amountValue <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    const requestIdValue = transactionForm.requestId ? Number(transactionForm.requestId) : undefined;
    if (transactionForm.requestId && Number.isNaN(requestIdValue)) {
      toast.error("Request ID must be numeric");
      return;
    }
    createTransaction.mutate(
      {
        reference: transactionForm.reference,
        direction: transactionForm.direction,
        amount: amountValue,
        currency: transactionForm.currency || undefined,
        description: transactionForm.description || undefined,
        requestId: requestIdValue,
        category: transactionForm.category || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Transaction logged");
          setTransactionForm({
            reference: "",
            direction: "income",
            amount: "",
            currency: "INR",
            description: "",
            requestId: "",
            category: "",
          });
        },
        onError: (error) => {
          toast.error(error.message || "Unable to log transaction");
        },
      },
    );
  };

  const handleRefreshLiveFeeds = () => {
    refreshLiveFeeds.mutate(undefined, {
      onSuccess: (data) => {
        toast.success(`Feeds refreshed via ${data.provider} provider`);
      },
      onError: () => toast.error("Unable to refresh feeds"),
    });
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Admin Command Center</h1>
          <p className="text-muted-foreground mt-2">
            Monitor high-priority incidents, control resource distribution, and approve new responder access.
          </p>
        </div>
        <div className="flex gap-3">
          <Button asChild variant="outline">
            <Link to="/resources">Open resource tools</Link>
          </Button>
          <Button variant="secondary" onClick={handleRefreshLiveFeeds} disabled={refreshLiveFeeds.isPending}>
            {refreshLiveFeeds.isPending ? "Refreshing feeds…" : "Refresh live feeds"}
          </Button>
          <Button onClick={() => {
            pendingRescuers.refetch();
            rescueRequests.refetch();
            warehouses.refetch();
            resources.refetch();
            geoOverview.refetch();
            geoHeatmap.refetch();
          }}>
            Refresh data
          </Button>
        </div>
      </div>

      <section className="grid gap-4 mt-8 md:grid-cols-4">
        <StatCard
          label="Pending rescuer approvals"
          value={pendingRescuers.data?.length ?? 0}
          loading={pendingRescuers.isLoading}
          helper="Requests awaiting admin clearance"
        />
        <StatCard
          label="Active rescue requests"
          value={(requestStats.pending ?? 0) + (requestStats.in_progress ?? 0)}
          loading={rescueRequests.isLoading}
          helper="Includes pending + in progress"
        />
        <StatCard
          label="Warehouses online"
          value={warehouses.data?.length ?? 0}
          loading={warehouses.isLoading}
          helper={`${totalWarehouseStock.toLocaleString()} total items tracked`}
        />
        <StatCard
          label="Top priority score"
          value={topPriorityScore}
          loading={priorities.isLoading}
          helper="Higher score = faster attention"
        />
      </section>

      <section className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Scheduler heartbeat</CardTitle>
            <CardDescription>Last touchpoint for automation loops feeding this console.</CardDescription>
          </CardHeader>
          <CardContent>
            {schedulerHealth.isLoading ? (
              <SchedulerHealthSkeleton />
            ) : schedulerHealth.error ? (
              <p className="text-sm text-destructive">Unable to load scheduler telemetry.</p>
            ) : schedulerHealth.data?.schedulers?.length ? (
              <div className="space-y-3">
                {schedulerHealth.data.schedulers.map((record) => (
                  <SchedulerHealthRow key={record.name} record={record} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Scheduler data has not been captured yet.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 mt-8 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Rescuer onboarding queue</CardTitle>
            <CardDescription>Approve only trusted responders to prevent pseudo accounts.</CardDescription>
          </CardHeader>
          <CardContent>{renderPendingRescuers(pendingRescuers, handleApprove, approveRescuer.isPending)}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Request status breakdown</CardTitle>
            <CardDescription>Track engagement across all disaster tickets.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(requestStats).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={cn("h-2.5 w-2.5 rounded-full", statusDot(status))} />
                    <p className="capitalize text-sm font-medium">{status.replace("_", " ")}</p>
                  </div>
                  <p className="text-lg font-semibold">{count}</p>
                </div>
              ))}
              <div className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
                Fulfilled requests automatically move into archival after 30 days. Pending tickets older than 24 hours will be auto-escalated.
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Responder access control</CardTitle>
            <CardDescription>Promote trusted rescuers to admins or downgrade inactive admins.</CardDescription>
          </CardHeader>
          <CardContent>
            {renderResponderTable({
              query: responders,
              isMutating: updateUserRole.isPending,
              onPromote: (id) => handleRoleChange(id, "admin"),
              onDemote: (id) => handleRoleChange(id, "rescuer"),
              onToggleAccess: handleAccessChange,
              isAccessMutating: updateUserAccess.isPending,
              currentUserId,
            })}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 mt-8 lg:grid-cols-2">
        <Card>
          <CardHeader className="gap-1">
            <CardTitle>Live weather signal</CardTitle>
            <CardDescription>Monitors major hubs to anticipate accessibility windows.</CardDescription>
          </CardHeader>
          <CardContent>{renderWeatherPanel(liveWeather)}</CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-1">
            <CardTitle>Government alerts feed</CardTitle>
            <CardDescription>Latest advisories from NDMA / IMD partners.</CardDescription>
          </CardHeader>
          <CardContent>{renderAlertPanel(alerts)}</CardContent>
        </Card>
      </section>

      <section className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Predictive allocation outlook</CardTitle>
            <CardDescription>Early warning signals from the AI planning loop.</CardDescription>
          </CardHeader>
          <CardContent>
            {renderPredictivePanel({
              query: predictiveRecommendations,
              onAction: handlePredictiveAction,
              processing: predictiveFeedback.isPending,
            })}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 mt-8 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Demand vs inventory heatmap</CardTitle>
            <CardDescription>Latest predictive snapshot across key hubs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <DemandHeatmapGrid
              cells={demandInsights.data?.heatmap}
              loading={demandInsights.isLoading}
              error={Boolean(demandInsights.error)}
            />
            {demandInsights.data?.latestBucketStart ? (
              <p className="text-[11px] text-muted-foreground">
                Bucket {new Date(demandInsights.data.latestBucketStart).toLocaleString()}
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pressure & latency trend</CardTitle>
            <CardDescription>Monitors demand pressure alongside median wait.</CardDescription>
          </CardHeader>
          <CardContent>
            <DemandTrendChart
              timeline={demandInsights.data?.timeline}
              loading={demandInsights.isLoading}
              error={Boolean(demandInsights.error)}
            />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 mt-8 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Dynamic priority queue</CardTitle>
              <CardDescription>Highest scoring incidents with AI-assisted allocations.</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => recalcPriorities.mutate()}
              disabled={recalcPriorities.isPending}
            >
              {recalcPriorities.isPending ? "Recalculating…" : "Recalculate"}
            </Button>
          </CardHeader>
          <CardContent>
            {renderPriorityTable({
              query: priorities,
              onApply: handleApplyRecommendation,
              applying: applyRecommendation.isPending,
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue & transaction log</CardTitle>
            <CardDescription>Track reimbursements, fuel spends, and partner funding.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2 text-xs">
                <label className="flex items-center gap-2">
                  <span className="text-muted-foreground uppercase tracking-wide">Bucket</span>
                  <select
                    className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                    value={transactionPeriod}
                    onChange={(e) => setTransactionPeriod(e.target.value as "day" | "week" | "month")}
                  >
                    <option value="day">Daily</option>
                    <option value="week">Weekly</option>
                    <option value="month">Monthly</option>
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-muted-foreground uppercase tracking-wide">Window</span>
                  <select
                    className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                    value={transactionWindowDays}
                    onChange={(e) => setTransactionWindowDays(Number(e.target.value))}
                  >
                    <option value={7}>Last 7d</option>
                    <option value={30}>Last 30d</option>
                    <option value={90}>Last 90d</option>
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-muted-foreground uppercase tracking-wide">Category</span>
                  <select
                    className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                    value={transactionCategory}
                    onChange={(e) => setTransactionCategory(e.target.value)}
                  >
                    <option value="">All categories</option>
                    {transactionCategoryOptions.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>
                <span className="text-[11px] text-muted-foreground">Range: {transactionRangeLabel}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    transactionSummary.refetch();
                    transactions.refetch();
                  }}
                >
                  Refresh ledger
                </Button>
                <Button variant="outline" size="sm" onClick={handleTransactionExport}>
                  Download CSV
                </Button>
              </div>
            </div>
            <div className="rounded-lg border border-dashed border-primary/30 bg-muted/30 p-3 text-xs">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Ops presets</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={handleSaveCategoryPreset}>
                    <BookmarkPlus className="h-4 w-4" /> Save current filter
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!savedCategoryPresets.length}
                    onClick={handleClearSavedPresets}
                  >
                    Clear saved
                  </Button>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <p className="text-[12px] font-semibold text-muted-foreground">Quick picks</p>
                <div className="flex flex-wrap gap-2">
                  {presetCategories.map((category) => {
                    const active = transactionCategory === category;
                    return (
                      <button
                        key={category}
                        type="button"
                        onClick={() => setTransactionCategory(category)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-semibold capitalize transition-colors",
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground hover:border-foreground/60",
                        )}
                      >
                        {category}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setTransactionCategory("")}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-colors",
                      transactionCategory === ""
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-foreground/60",
                    )}
                  >
                    Reset
                  </button>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <p className="text-[12px] font-semibold text-muted-foreground">Saved views</p>
                {savedCategoryPresets.length ? (
                  <div className="flex flex-wrap gap-2">
                    {savedCategoryPresets.map((preset) => {
                      const active = preset === transactionCategory;
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setTransactionCategory(preset)}
                          className={cn(
                            "group inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold capitalize transition-colors",
                            active
                              ? "border-primary bg-primary/15 text-primary"
                              : "border-border bg-background text-muted-foreground hover:border-foreground/60",
                          )}
                        >
                          <span>{preset}</span>
                          <span
                            role="button"
                            aria-label={`Remove ${preset}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleRemoveCategoryPreset(preset);
                            }}
                            className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:bg-muted/80"
                          >
                            <X className="h-3 w-3" />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[12px] text-muted-foreground">Bookmark a category to pin it for the ops shift.</p>
                )}
              </div>
            </div>
            <div className="grid gap-4 text-sm md:grid-cols-3">
              {renderTransactionSummary(transactionSummary.data, transactionSummary.isLoading)}
            </div>
            {renderTransactionCharts(transactionSummary.data, transactionSummary.isLoading)}
            <div className="border rounded-lg p-3">
              {renderTransactionTimeline(transactions)}
            </div>
            <div>
              <p className="text-sm font-semibold mb-2">Log transaction</p>
              <form className="grid gap-2" onSubmit={handleCreateTransaction}>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="Reference"
                    value={transactionForm.reference}
                    onChange={(e) => setTransactionForm((f) => ({ ...f, reference: e.target.value }))}
                  />
                  <select
                    className="h-10 rounded-md border px-3"
                    value={transactionForm.direction}
                    onChange={(e) =>
                      setTransactionForm((f) => ({ ...f, direction: e.target.value as "income" | "expense" }))
                    }
                  >
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    type="number"
                    placeholder="Amount"
                    value={transactionForm.amount}
                    onChange={(e) => setTransactionForm((f) => ({ ...f, amount: e.target.value }))}
                  />
                  <Input
                    placeholder="Currency"
                    value={transactionForm.currency}
                    onChange={(e) => setTransactionForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))}
                  />
                </div>
                <Input
                  placeholder="Category (fuel, logistics, grant)"
                  value={transactionForm.category}
                  onChange={(e) => setTransactionForm((f) => ({ ...f, category: e.target.value }))}
                />
                <Input
                  placeholder="Linked request ID (optional)"
                  value={transactionForm.requestId}
                  onChange={(e) => setTransactionForm((f) => ({ ...f, requestId: e.target.value }))}
                />
                <Textarea
                  placeholder="Notes"
                  value={transactionForm.description}
                  onChange={(e) => setTransactionForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                />
                <Button type="submit" disabled={createTransaction.isPending}>
                  {createTransaction.isPending ? "Logging…" : "Log transaction"}
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 mt-8 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Critical incidents</CardTitle>
            <CardDescription>Latest rescue requests requiring admin oversight.</CardDescription>
          </CardHeader>
          <CardContent>
            {rescueRequests.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : rescueRequests.data?.length ? (
              <div className="space-y-4">
                {rescueRequests.data.slice(0, 5).map((request) => (
                  <div key={request.id} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">Request #{request.id}</p>
                        <p className="text-sm text-muted-foreground">{request.location}</p>
                      </div>
                      <Badge className={cn("capitalize", statusStyles[request.status])}>{request.status.replace("_", " ")}</Badge>
                    </div>
                    <p className="text-sm mt-3 text-muted-foreground">{request.details}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No active requests were found.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resource availability snapshot</CardTitle>
            <CardDescription>Aggregated supply view across all warehouses.</CardDescription>
          </CardHeader>
          <CardContent>
            {resources.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : resources.data?.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Resource</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resources.data.slice(0, 6).map((resource) => (
                    <TableRow key={resource.id}>
                      <TableCell>
                        <p className="font-medium">{resource.type}</p>
                        <p className="text-xs text-muted-foreground">Warehouse #{resource.warehouseId}</p>
                      </TableCell>
                      <TableCell className="text-right font-semibold">{resource.quantity.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">No resource records available.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Allocation history</CardTitle>
            <CardDescription>Audit trail for every booking/dispatch action.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2 text-xs">
                <label className="flex items-center gap-2">
                  <span className="text-muted-foreground uppercase tracking-wide">Window</span>
                  <select
                    className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                    value={allocationWindowDays}
                    onChange={(e) => setAllocationWindowDays(Number(e.target.value))}
                  >
                    <option value={3}>Last 3d</option>
                    <option value={7}>Last 7d</option>
                    <option value={14}>Last 14d</option>
                    <option value={30}>Last 30d</option>
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-muted-foreground uppercase tracking-wide">Resource</span>
                  <select
                    className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                    value={allocationResourceFilter}
                    onChange={(e) => setAllocationResourceFilter(e.target.value)}
                  >
                    <option value="all">All resources</option>
                    {resourceOptions.slice(0, 25).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-muted-foreground uppercase tracking-wide">Event</span>
                  <select
                    className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                    value={allocationEventFilter}
                    onChange={(e) => setAllocationEventFilter(e.target.value)}
                  >
                    <option value="all">All events</option>
                    <option value="booked">Booked</option>
                    <option value="dispatched">Dispatched</option>
                    <option value="released">Released</option>
                  </select>
                </label>
                <span className="text-[11px] text-muted-foreground">Range: {allocationRangeLabel}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" size="sm" onClick={() => allocationHistory.refetch()}>
                  Refresh log
                </Button>
                <Button variant="outline" size="sm" onClick={handleAllocationExport}>
                  Export CSV
                </Button>
              </div>
            </div>
            {renderAllocationHistory(allocationHistory)}
          </CardContent>
        </Card>
      </section>

      <section className="mt-8">
        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Situational awareness map</CardTitle>
              <CardDescription>Overlay demand clusters, depots, and live allocations.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => {
              geoOverview.refetch();
              geoHeatmap.refetch();
            }}>
              Re-sync layers
            </Button>
          </CardHeader>
          <CardContent>
            {geoOverview.isLoading || geoHeatmap.isLoading ? (
              <Skeleton className="w-full h-[420px]" />
            ) : geoOverview.error || geoHeatmap.error ? (
              <p className="text-sm text-red-500">Unable to load geospatial dataset.</p>
            ) : (
              <>
                <OperationsMap overview={geoOverview.data} heatmap={geoHeatmap.data?.buckets} height={420} />
                <div className="grid gap-3 mt-4 text-sm md:grid-cols-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground uppercase">Tracked requests</p>
                    <p className="text-2xl font-semibold">{geoOverview.data?.requests.length ?? 0}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground uppercase">Warehouses mapped</p>
                    <p className="text-2xl font-semibold">{geoOverview.data?.warehouses.length ?? 0}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground uppercase">Active allocations</p>
                    <p className="text-2xl font-semibold">{geoOverview.data?.allocations.length ?? 0}</p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function SchedulerHealthRow({ record }: { record: SchedulerHealthRecord }) {
  return (
    <div className="rounded-lg border border-border/70 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("h-2.5 w-2.5 rounded-full", schedulerStatusDot[record.status])} />
            <p className="font-semibold leading-tight">{record.label}</p>
            <Badge
              variant="outline"
              className={cn("text-[11px] uppercase tracking-wide", schedulerStatusBadge[record.status])}
            >
              {record.status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{record.description}</p>
        </div>
        <div className="text-sm text-muted-foreground space-y-1 sm:text-right">
          <p>
            Last run <span className="font-semibold text-foreground">{formatRelativeTimestamp(record.lastRunAt)}</span>
          </p>
          <p>
            Duration <span className="font-semibold text-foreground">{formatDuration(record.lastDurationMs)}</span>
          </p>
          <p>
            Staleness {" "}
            <span className="font-semibold text-foreground">
              {describeStaleness(record.staleForMs, record.expectedIntervalMs)}
            </span>
          </p>
        </div>
      </div>
      {record.lastErrorMessage ? (
        <p className="mt-2 text-xs text-destructive">Last error: {record.lastErrorMessage}</p>
      ) : null}
    </div>
  );
}

function SchedulerHealthSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="h-16 w-full" />
      ))}
    </div>
  );
}

function formatRelativeTimestamp(timestamp: number | null) {
  if (!timestamp) return "never";
  const delta = Date.now() - timestamp;
  if (delta < 60_000) return "just now";
  if (delta < 3_600_000) return `${Math.round(delta / 60_000)} min ago`;
  if (delta < 86_400_000) return `${Math.round(delta / 3_600_000)} hr ago`;
  return new Date(timestamp).toLocaleString();
}

function formatDuration(duration: number | null) {
  if (!duration) return "—";
  if (duration >= 60_000) return `${(duration / 1000).toFixed(1)}s`;
  if (duration >= 1000) return `${(duration / 1000).toFixed(1)}s`;
  return `${duration} ms`;
}

function describeStaleness(staleForMs: number | null, expectedIntervalMs: number) {
  if (staleForMs == null) return "unknown";
  if (staleForMs < expectedIntervalMs) return "on schedule";
  if (staleForMs < expectedIntervalMs * 2) {
    return `${Math.round(staleForMs / 60_000)} min old`;
  }
  const hours = Math.round(staleForMs / 3_600_000);
  return hours < 24 ? `${hours} hr old` : `${Math.round(hours / 24)} d old`;
}

function renderPendingRescuers(
  query: ReturnType<typeof useGetPendingRescuersQuery>,
  onApprove: (id: number) => void,
  approving: boolean,
) {
  if (query.isLoading) {
    return <Skeleton className="h-40 w-full" />;
  }

  if (query.error) {
    return <p className="text-sm text-red-500">Failed to load pending approvals.</p>;
  }

  if (!query.data?.length) {
    return <p className="text-sm text-muted-foreground">All rescuers are approved. Great job staying ahead!</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Requested</TableHead>
            <TableHead className="w-[100px] text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {query.data.map((rescuer) => (
            <TableRow key={rescuer.id}>
              <TableCell className="font-medium">{rescuer.name}</TableCell>
              <TableCell>{rescuer.email}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{new Date(rescuer.createdAt).toLocaleString()}</TableCell>
              <TableCell className="text-right">
                <Button size="sm" onClick={() => onApprove(rescuer.id)} disabled={approving}>
                  Approve
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function renderResponderTable({
  query,
  onPromote,
  onDemote,
  onToggleAccess,
  isMutating,
  isAccessMutating,
  currentUserId,
}: {
  query: ReturnType<typeof useGetRespondersQuery>;
  onPromote: (id: number) => void;
  onDemote: (id: number) => void;
  onToggleAccess: (id: number, blocked: boolean) => void;
  isMutating: boolean;
  isAccessMutating: boolean;
  currentUserId?: number;
}) {
  if (query.isLoading) return <Skeleton className="h-40 w-full" />;
  if (query.error) return <p className="text-sm text-red-500">Failed to load responders.</p>;
  if (!query.data?.length) return <p className="text-sm text-muted-foreground">No responders found.</p>;

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {query.data.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">{user.name}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={user.role === "admin" ? "default" : "secondary"}>{user.role}</Badge>
                  {!user.isApproved && <Badge variant="outline">Pending</Badge>}
                  {user.isBlocked && <Badge variant="destructive">Blocked</Badge>}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col items-end gap-2 md:flex-row md:justify-end">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onPromote(user.id)}
                    disabled={isMutating || user.role === "admin"}
                  >
                    Promote to admin
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onDemote(user.id)}
                    disabled={isMutating || user.role === "rescuer" || user.id === currentUserId}
                  >
                    Downgrade
                  </Button>
                  <Button
                    size="sm"
                    variant={user.isBlocked ? "secondary" : "destructive"}
                    onClick={() => onToggleAccess(user.id, !user.isBlocked)}
                    disabled={isAccessMutating || user.id === currentUserId}
                  >
                    {user.isBlocked ? "Restore access" : "Block access"}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function renderPriorityTable({
  query,
  onApply,
  applying,
}: {
  query: ReturnType<typeof useGetPrioritiesQuery>;
  onApply: (recommendationId: number) => void;
  applying: boolean;
}) {
  if (query.isLoading) return <Skeleton className="h-32 w-full" />;
  if (query.error) return <p className="text-sm text-red-500">Unable to load priority queue.</p>;
  if (!query.data?.length) return <p className="text-sm text-muted-foreground">No open rescue requests.</p>;

  return (
    <div className="space-y-4">
      {query.data.slice(0, 4).map((item) => {
        const signalBadges = [
          { label: "Time decay", value: item.ageWeight },
          { label: "Proximity", value: item.proximityWeight },
          { label: "Hub capacity", value: item.hubCapacityWeight },
          { label: "Supply pressure", value: item.supplyPressureWeight },
        ].filter((badge) => badge.value != null);
        const nearestHubLabel =
          item.nearestWarehouseName ??
          (item.nearestWarehouseId != null ? `Hub #${item.nearestWarehouseId}` : "No warehouse linked yet");
        const distanceLabel =
          item.nearestWarehouseDistanceKm != null
            ? `${item.nearestWarehouseDistanceKm.toFixed(1)} km radius`
            : "Distance unknown";
        const hubCapacityLabel =
          item.hubCapacityRatio != null
            ? `${Math.round(Math.min(200, item.hubCapacityRatio * 100))}% of capacity`
            : "Capacity unknown";
        return (
          <div key={item.snapshotId} className="rounded-lg border p-4">
            <div className="flex items-center justify-between text-sm">
              <div>
                <p className="font-semibold">Request #{item.request.id}</p>
                <p className="text-muted-foreground">{item.request.location}</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold">{item.score}</p>
                <p className="text-xs text-muted-foreground">Priority score</p>
              </div>
            </div>
            <p className="text-sm mt-3 text-muted-foreground">{item.request.details}</p>
            <p className="text-xs mt-2 text-muted-foreground">{item.rationale}</p>
            <div className="mt-4 grid gap-4 text-xs text-muted-foreground md:grid-cols-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide">Signal weights</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {signalBadges.map((badge) => (
                    <Badge key={badge.label} variant="outline" className="font-normal">
                      {badge.label}: {badge.value}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide">Nearest hub</p>
                <div className="mt-2 space-y-1">
                  <p className="font-medium text-foreground">{nearestHubLabel}</p>
                  <p>{distanceLabel}</p>
                  <p>{hubCapacityLabel}</p>
                </div>
              </div>
            </div>
            {item.recommendation ? (
              <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <p className="text-sm">
                  Suggest {item.recommendation.quantity ?? "?"} {item.recommendation.resourceType ?? "units"} from {item.recommendation.warehouseName ?? `Warehouse #${item.recommendation.warehouseId}`}
                </p>
                <Button
                  size="sm"
                  onClick={() => item.recommendation && onApply(item.recommendation.id)}
                  disabled={applying}
                >
                  Apply recommendation
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-3">No recommendation generated yet.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function renderTransactionCharts(
  data?: ReturnType<typeof useTransactionSummaryQuery>["data"],
  loading?: boolean,
) {
  if (loading) {
    return <Skeleton className="h-64 w-full" />;
  }
  if (!data?.periodBuckets?.length) {
    return <p className="rounded-lg border p-4 text-sm text-muted-foreground">No transaction flow captured for this window.</p>;
  }

  const bucketData = data.periodBuckets
    .slice()
    .sort((a, b) => a.periodStart - b.periodStart)
    .map((bucket) => ({
      label: new Date(bucket.periodStart).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      income: Number((bucket.income / 100).toFixed(2)),
      expense: Number((bucket.expense / 100).toFixed(2)),
    }));

  const cashflowConfig = {
    income: { label: "Income", color: "hsl(var(--chart-1))" },
    expense: { label: "Expense", color: "hsl(var(--chart-2))" },
  } as const;

  const palette = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
  ];

  const categorySlices = (data.categories ?? [])
    .slice()
    .sort((a, b) => b.income + b.expense - (a.income + a.expense))
    .slice(0, 6)
    .map((category, index) => ({
      name: category.category,
      value: Number(((category.income + category.expense) / 100).toFixed(2)),
      colorKey: `slice-${index}`,
      color: palette[index % palette.length],
    }))
    .filter((slice) => slice.value > 0);

  const categoryChartConfig = categorySlices.reduce<ChartConfig>((acc, slice) => {
    acc[slice.colorKey] = { label: slice.name, color: slice.color };
    return acc;
  }, {});

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-lg border p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Cashflow trend</p>
        <ChartContainer config={cashflowConfig} className="mt-3 min-h-[240px] w-full">
          <AreaChart data={bucketData} margin={{ left: 8, right: 12, top: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={12} />
            <YAxis tickLine={false} axisLine={false} width={40} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              type="monotone"
              dataKey="income"
              stroke="var(--color-income)"
              fill="var(--color-income)"
              fillOpacity={0.2}
              strokeWidth={2}
              name="income"
            />
            <Area
              type="monotone"
              dataKey="expense"
              stroke="var(--color-expense)"
              fill="var(--color-expense)"
              fillOpacity={0.15}
              strokeWidth={2}
              name="expense"
            />
          </AreaChart>
        </ChartContainer>
      </div>
      <div className="rounded-lg border p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Top categories</p>
        {categorySlices.length ? (
          <ChartContainer config={categoryChartConfig} className="mt-3 min-h-[240px] w-full">
            <PieChart>
              <Pie data={categorySlices} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={4}>
                {categorySlices.map((slice) => (
                  <Cell key={slice.name} fill={`var(--color-${slice.colorKey})`} />
                ))}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent />} />
            </PieChart>
          </ChartContainer>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">No categorized spend recorded.</p>
        )}
        {categorySlices.length ? (
          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
            {categorySlices.map((slice) => (
              <li key={slice.name} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: slice.color }} />
                  {slice.name}
                </span>
                <span className="font-mono text-foreground">₹{slice.value.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function renderTransactionSummary(data?: ReturnType<typeof useTransactionSummaryQuery>["data"], loading?: boolean) {
  if (loading) {
    return (
      <>
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
      </>
    );
  }
  const formatter = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
  return [
    {
      label: "Income",
      value: formatter.format((data?.totalIncome ?? 0) / 100),
    },
    {
      label: "Expense",
      value: formatter.format((data?.totalExpense ?? 0) / 100),
    },
    {
      label: "Balance",
      value: formatter.format((data?.balance ?? 0) / 100),
    },
  ].map((stat) => (
    <div key={stat.label} className="rounded-lg border p-3">
      <p className="text-xs uppercase text-muted-foreground">{stat.label}</p>
      <p className="text-lg font-semibold">{stat.value}</p>
    </div>
  ));
}

function renderTransactionTimeline(query: ReturnType<typeof useGetTransactionsQuery>) {
  if (query.isLoading) return <Skeleton className="h-24 w-full" />;
  if (query.error) return <p className="text-sm text-red-500">Failed to load transactions.</p>;
  if (!query.data?.length) return <p className="text-sm text-muted-foreground">No transactions logged yet.</p>;

  return (
    <div className="space-y-3 max-h-48 overflow-y-auto">
      {query.data.slice(0, 6).map((tx) => {
        const formatter = new Intl.NumberFormat("en-IN", { style: "currency", currency: tx.currency || "INR" });
        return (
          <div key={tx.id} className="flex items-center justify-between text-sm">
            <div>
              <p className="font-medium">{tx.reference}</p>
              <p className="text-xs text-muted-foreground">
                {tx.direction === "income" ? "+" : "-"}
                {formatter.format(tx.amountCents / 100)}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <Badge variant="secondary" className="text-[10px] font-normal uppercase tracking-wide">
                  {tx.category || "general"}
                </Badge>
                {tx.requestId ? <span>Req #{tx.requestId}</span> : null}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{new Date(tx.recordedAt).toLocaleString()}</p>
          </div>
        );
      })}
    </div>
  );
}

function renderAllocationHistory(query: ReturnType<typeof useGetAllocationHistoryQuery>) {
  if (query.isLoading) return <Skeleton className="h-32 w-full" />;
  if (query.error) return <p className="text-sm text-red-500">Failed to load history.</p>;
  if (!query.data?.length) return <p className="text-sm text-muted-foreground">No allocation events logged.</p>;

  return (
    <div className="space-y-3 max-h-72 overflow-y-auto text-sm">
      {query.data.slice(0, 8).map((entry) => (
        <div key={entry.id} className="rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <p className="font-medium capitalize">{entry.eventType}</p>
            <p className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</p>
          </div>
          <p className="text-sm mt-1">
            {entry.quantity.toLocaleString()} {entry.resourceType ?? `Resource #${entry.resourceId}`} from
            {" "}
            {entry.warehouseName ?? `Warehouse #${entry.warehouseId}`}
          </p>
          {entry.note && <p className="text-xs text-muted-foreground mt-1">{entry.note}</p>}
          <p className="text-xs text-muted-foreground mt-1">Actor: {entry.actorName ?? "System"}</p>
        </div>
      ))}
    </div>
  );
}

function renderWeatherPanel(query: ReturnType<typeof useLiveWeatherQuery>) {
  if (query.isLoading) return <Skeleton className="h-40 w-full" />;
  if (query.error) return <p className="text-sm text-red-500">Unable to load weather data.</p>;
  if (!query.data) return <p className="text-sm text-muted-foreground">No readings recorded.</p>;

  const primary = query.data.primary ?? query.data.nearby?.[0];
  return (
    <div className="space-y-4">
      {primary ? (
        <div className="rounded-xl border bg-muted/40 p-4">
          <p className="text-xs uppercase text-muted-foreground">Primary location</p>
          <p className="text-xl font-semibold">{primary.locationName}</p>
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Temperature</p>
              <p className="text-lg font-bold">{primary.temperatureC ?? "—"}°C</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Wind</p>
              <p className="text-lg font-bold">{primary.windSpeedKph?.toFixed(1) ?? "—"} km/h</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Humidity</p>
              <p className="text-lg font-bold">{primary.humidity ?? "—"}%</p>
            </div>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{primary.condition ?? "Stable"}</p>
          <p className="text-xs text-muted-foreground">Alert level: {primary.alertLevel}</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Awaiting initial readings…</p>
      )}

      {query.data.nearby?.length ? (
        <div className="space-y-2 text-sm">
          <p className="text-xs uppercase text-muted-foreground">Other hubs</p>
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

function renderAlertPanel(query: ReturnType<typeof useGovernmentAlertsQuery>) {
  if (query.isLoading) return <Skeleton className="h-40 w-full" />;
  if (query.error) return <p className="text-sm text-red-500">Unable to load alerts.</p>;
  if (!query.data?.alerts.length) return <p className="text-sm text-muted-foreground">No advisories received in the last 24 hours.</p>;

  return (
    <div className="space-y-3 max-h-56 overflow-y-auto text-sm">
      {query.data.alerts.slice(0, 5).map((alert) => (
        <div key={alert.id} className="rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold">{alert.headline}</p>
            <Badge variant="secondary" className="capitalize">
              {alert.severity ?? "info"}
            </Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{alert.summary ?? "See raw payload for details."}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Issued {alert.issuedAt ? new Date(alert.issuedAt).toLocaleString() : "recently"}
          </p>
        </div>
      ))}
    </div>
  );
}

function renderPredictivePanel({
  query,
  onAction,
  processing,
}: {
  query: ReturnType<typeof usePredictiveRecommendationsQuery>;
  onAction: (id: number, action: PredictiveFeedbackAction) => void;
  processing: boolean;
}) {
  if (query.isLoading) return <Skeleton className="h-40 w-full" />;
  if (query.error) return <p className="text-sm text-red-500">Unable to load predictive recommendations.</p>;

  const items = query.data?.recommendations ?? [];
  if (!items.length) {
    return <p className="text-sm text-muted-foreground">No predictive recommendations available yet.</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((rec) => (
        <div key={rec.id} className="rounded-lg border p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold capitalize">{rec.resourceType}</p>
              <p className="text-xs text-muted-foreground">
                {rec.region ?? rec.request?.location ?? "Region unknown"} • {rec.suggestedQuantity} units
              </p>
            </div>
            <Badge variant="outline" className="capitalize">
              {rec.status}
            </Badge>
          </div>
          <p className="text-sm mt-2 text-muted-foreground">
            {rec.rationale ?? "Model suggests staging resources in advance."}
          </p>
          {renderRecommendationContext(rec.context)}
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>Confidence: {(rec.confidence ?? 0.5).toFixed(2)}</span>
            {rec.leadTimeMinutes && <span>Lead time: {rec.leadTimeMinutes} mins</span>}
            {rec.request?.priority && <span>Priority: {rec.request.priority}</span>}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => onAction(rec.id, "applied")}
              disabled={processing}
            >
              Queue dispatch
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onAction(rec.id, "dismissed")}
              disabled={processing}
            >
              Dismiss
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function renderRecommendationContext(context: PredictiveRecommendationContext | null | undefined) {
  if (!context) return null;
  const regionalChips = [
    context.avgPending != null ? `Avg pending: ${context.avgPending.toFixed(1)}` : null,
    context.avgInventory != null ? `Inventory: ${Math.round(context.avgInventory)}` : null,
    context.demandPressure != null ? `Demand pressure: ${(context.demandPressure * 100).toFixed(0)}%` : null,
    context.weatherAlertLevel ? `Weather: ${context.weatherAlertLevel}` : null,
    context.supplyPressure != null ? `Supply pressure: ${(context.supplyPressure * 100).toFixed(0)}%` : null,
  ].filter(Boolean) as string[];
  const logisticsChips = [
    context.timeDecayWeight != null ? `Time decay: ${context.timeDecayWeight}` : null,
    context.proximityWeight != null ? `Proximity: ${context.proximityWeight}` : null,
    context.hubCapacityWeight != null ? `Hub capacity: ${context.hubCapacityWeight}` : null,
    context.nearestWarehouseDistanceKm != null
      ? `Distance: ${context.nearestWarehouseDistanceKm.toFixed(1)} km`
      : null,
    context.hubCapacityRatio != null
      ? `Hub load: ${Math.round(Math.min(200, context.hubCapacityRatio * 100))}%`
      : null,
    context.estimatedTravelMinutes != null ? `ETA: ${context.estimatedTravelMinutes} mins` : null,
  ].filter(Boolean) as string[];
  if (!regionalChips.length && !logisticsChips.length) return null;
  return (
    <div className="mt-2 space-y-2 text-[11px] text-muted-foreground">
      {regionalChips.length ? (
        <div className="flex flex-wrap gap-2">
          {regionalChips.map((chip) => (
            <Badge key={chip} variant="secondary">
              {chip}
            </Badge>
          ))}
        </div>
      ) : null}
      {logisticsChips.length ? (
        <div className="flex flex-wrap gap-2">
          {logisticsChips.map((chip) => (
            <Badge key={chip} variant="outline">
              {chip}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function statusDot(status: string) {
  switch (status) {
    case "pending":
      return "bg-amber-500";
    case "in_progress":
      return "bg-blue-500";
    case "fulfilled":
      return "bg-emerald-500";
    case "cancelled":
      return "bg-gray-400";
    default:
      return "bg-muted-foreground";
  }
}

function StatCard({
  label,
  value,
  helper,
  loading,
}: {
  label: string;
  value: number;
  helper?: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl">
          {loading ? <Skeleton className="h-8 w-16" /> : value.toLocaleString()}
        </CardTitle>
      </CardHeader>
      {helper && <CardContent className="pt-0 text-sm text-muted-foreground">{helper}</CardContent>}
    </Card>
  );
}
