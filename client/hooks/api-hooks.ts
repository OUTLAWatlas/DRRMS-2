import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useAppStore } from "@/state/app-store";
import { toast } from "sonner";
import type {
  LoginInput,
  LoginResponse,
  RegisterInput,
  RegisterResponse,
  ForgotPasswordInput,
  ForgotPasswordResponse,
  DisasterReport,
  CreateReportInput,
  UpdateReportInput,
  RescueRequest,
  CreateRescueRequestInput,
  UpdateRescueRequestStatusInput,
  Warehouse,
  CreateWarehouseInput,
  Resource,
  CreateResourceInput,
  UpdateResourceInput,
  ResourceAllocation,
  CreateAllocationInput,
  PendingRescuer,
  ApproveRescuerResponse,
  User,
  UpdateUserRoleInput,
  UpdateUserRoleResponse,
  UpdateUserAccessInput,
  UpdateUserAccessResponse,
  UpdateWarehouseInput,
  ResourceTransfer,
  CreateResourceTransferInput,
  DistributionLog,
  CreateDistributionLogInput,
  PrioritizedRequest,
  RecalculatePrioritiesResponse,
  ApplyRecommendationResponse,
  TransactionRecord,
  TransactionSummary,
  TransactionQueryFilters,
  TransactionSummaryQuery,
  CreateTransactionInput,
  AllocationHistoryEntry,
  AllocationHistoryFilter,
  LiveWeatherResponse,
  GovernmentAlertsResponse,
  LiveFeedRefreshResponse,
  GeoOverviewResponse,
  GeoHeatmapResponse,
  PredictiveRecommendationsResponse,
  PredictiveRecommendationFeedbackRequest,
  DemandInsightsResponse,
  SchedulersHealthResponse,
  PaginatedReportsResponse,
  PaginatedRescueRequestsResponse,
  PaginatedResourcesResponse,
  LowStockResourcesResponse,
} from "@shared/api";

// ===========================
// Auth Hooks
// ===========================

export function useLoginMutation() {
  const { setToken, setUser } = useAppStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (credentials: LoginInput) => {
      const response = await apiClient<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      });
      return response;
    },
    onSuccess: (data) => {
      setToken(data.token);
      setUser(data.user);
      queryClient.invalidateQueries({ queryKey: ["user"] });
    },
  });
}

export function useRegisterMutation() {
  const { setToken, setUser } = useAppStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userData: RegisterInput) => {
      const response = await apiClient<RegisterResponse>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(userData),
      });
      return response;
    },
    onSuccess: (data) => {
      if ("token" in data) {
        setToken(data.token);
        setUser(data.user);
        queryClient.invalidateQueries({ queryKey: ["user"] });
      }
    },
  });
}

export function useGetPendingRescuersQuery() {
  return useQuery({
    queryKey: ["pending-rescuers"],
    queryFn: async () => {
      const response = await apiClient<PendingRescuer[]>("/api/auth/pending-rescuers");
      return response;
    },
  });
}

export function useApproveRescuerMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rescuerId: number) => {
      const response = await apiClient<ApproveRescuerResponse>(`/api/auth/approve/${rescuerId}`, {
        method: "POST",
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-rescuers"] });
      queryClient.invalidateQueries({ queryKey: ["responders"] });
    },
  });
}

export function useGetRespondersQuery() {
  return useQuery({
    queryKey: ["responders"],
    queryFn: async () => {
      const response = await apiClient<User[]>("/api/auth/responders");
      return response;
    },
  });
}

export function useGetPrioritiesQuery() {
  return useQuery({
    queryKey: ["priorities"],
    queryFn: async () => {
      const response = await apiClient<PrioritizedRequest[]>("/api/priorities");
      return response;
    },
  });
}

type UpdateRolePayload = UpdateUserRoleInput & { userId: number };
type UpdateAccessPayload = UpdateUserAccessInput & { userId: number };
type ApplyRecommendationPayload = { recommendationId: number };

export function useUpdateUserRoleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, role }: UpdateRolePayload) => {
      const response = await apiClient<UpdateUserRoleResponse>(`/api/auth/users/${userId}/role`, {
        method: "POST",
        body: JSON.stringify({ role }),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["responders"] });
      queryClient.invalidateQueries({ queryKey: ["pending-rescuers"] });
    },
  });
}

export function useUpdateUserAccessMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, blocked }: UpdateAccessPayload) => {
      const response = await apiClient<UpdateUserAccessResponse>(`/api/auth/users/${userId}/access`, {
        method: "POST",
        body: JSON.stringify({ blocked }),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["responders"] });
      queryClient.invalidateQueries({ queryKey: ["pending-rescuers"] });
    },
  });
}

export function useRecalculatePrioritiesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient<RecalculatePrioritiesResponse>("/api/priorities/recalculate", {
        method: "POST",
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["priorities"] });
    },
  });
}

export function useApplyRecommendationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ recommendationId }: ApplyRecommendationPayload) => {
      const response = await apiClient<ApplyRecommendationResponse>(
        `/api/priorities/recommendations/${recommendationId}/apply`,
        {
          method: "POST",
        },
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["priorities"] });
      queryClient.invalidateQueries({ queryKey: ["allocations"] });
      queryClient.invalidateQueries({ queryKey: ["allocation-history"] });
      queryClient.invalidateQueries({ queryKey: ["resources", "list"] });
    },
  });
}

// ===========================
// Live feeds & geospatial data
// ===========================

type LiveWeatherParams = { latitude?: number; longitude?: number };

export function useLiveWeatherQuery(params?: LiveWeatherParams) {
  return useQuery({
    queryKey: ["live-weather", params?.latitude ?? null, params?.longitude ?? null],
    queryFn: async () => {
      const search = new URLSearchParams();
      if (params?.latitude !== undefined) search.set("lat", params.latitude.toString());
      if (params?.longitude !== undefined) search.set("lon", params.longitude.toString());
      const response = await apiClient<LiveWeatherResponse>(
        `/api/live-feeds/weather${search.toString() ? `?${search.toString()}` : ""}`,
      );
      return response;
    },
    refetchInterval: 120_000,
  });
}

type AlertParams = { severity?: string; limit?: number };

export function useGovernmentAlertsQuery(params?: AlertParams) {
  return useQuery({
    queryKey: ["gov-alerts", params?.severity ?? null, params?.limit ?? null],
    queryFn: async () => {
      const search = new URLSearchParams();
      if (params?.severity) search.set("severity", params.severity);
      if (params?.limit) search.set("limit", params.limit.toString());
      const response = await apiClient<GovernmentAlertsResponse>(
        `/api/live-feeds/alerts${search.toString() ? `?${search.toString()}` : ""}`,
      );
      return response;
    },
    refetchInterval: 300_000,
  });
}

export function useRefreshLiveFeedsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await apiClient<LiveFeedRefreshResponse>("/api/live-feeds/refresh", {
        method: "POST",
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-weather"] });
      queryClient.invalidateQueries({ queryKey: ["gov-alerts"] });
    },
  });
}

type HeatmapParams = { bucket?: number; window?: number };

export function useGeoOverviewQuery() {
  return useQuery({
    queryKey: ["geo-overview"],
    queryFn: async () => {
      const response = await apiClient<GeoOverviewResponse>("/api/geo/overview");
      return response;
    },
    refetchInterval: 60_000,
  });
}

export function useGeoHeatmapQuery(params?: HeatmapParams) {
  return useQuery({
    queryKey: ["geo-heatmap", params?.bucket ?? null, params?.window ?? null],
    queryFn: async () => {
      const search = new URLSearchParams();
      if (params?.bucket) search.set("bucket", params.bucket.toString());
      if (params?.window) search.set("window", params.window.toString());
      const response = await apiClient<GeoHeatmapResponse>(
        `/api/geo/heatmap${search.toString() ? `?${search.toString()}` : ""}`,
      );
      return response;
    },
    refetchInterval: 60_000,
  });
}

type PredictiveQueryParams = { region?: string; limit?: number };

export function usePredictiveRecommendationsQuery(params?: PredictiveQueryParams) {
  return useQuery({
    queryKey: ["predictive-recommendations", params?.region ?? null, params?.limit ?? null],
    queryFn: async () => {
      const search = new URLSearchParams();
      if (params?.region) search.set("region", params.region);
      if (params?.limit) search.set("limit", params.limit.toString());
      const response = await apiClient<PredictiveRecommendationsResponse>(
        `/api/predictive/recommendations${search.toString() ? `?${search.toString()}` : ""}`,
      );
      return response;
    },
    refetchInterval: 180_000,
  });
}

type PredictiveFeedbackPayload = PredictiveRecommendationFeedbackRequest & { recommendationId: number };

export function usePredictiveFeedbackMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ recommendationId, action, note }: PredictiveFeedbackPayload) => {
      const response = await apiClient<{ message: string }>(
        `/api/predictive/recommendations/${recommendationId}/feedback`,
        {
          method: "POST",
          body: JSON.stringify({ action, note }),
        },
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["predictive-recommendations"] });
    },
  });
}

type DemandInsightsParams = { buckets?: number };

export function useDemandInsightsQuery(params?: DemandInsightsParams) {
  return useQuery({
    queryKey: ["demand-insights", params?.buckets ?? null],
    queryFn: async () => {
      const search = new URLSearchParams();
      if (params?.buckets) search.set("buckets", params.buckets.toString());
      const response = await apiClient<DemandInsightsResponse>(
        `/api/predictive/demand-insights${search.toString() ? `?${search.toString()}` : ""}`,
      );
      return response;
    },
    refetchInterval: 300_000,
  });
}

export function useSchedulerHealthQuery() {
  return useQuery({
    queryKey: ["scheduler-health"],
    queryFn: async () => {
      const response = await apiClient<SchedulersHealthResponse>("/api/health/schedulers");
      return response;
    },
    refetchInterval: 60_000,
  });
}

export function useForgotPasswordMutation() {
  return useMutation({
    mutationFn: async (payload: ForgotPasswordInput) => {
      const response = await apiClient<ForgotPasswordResponse>("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      return response;
    },
  });
}

export function useGetAllocationHistoryQuery(params?: AllocationHistoryFilter) {
  return useQuery({
    queryKey: [
      "allocation-history",
      params?.start ?? null,
      params?.end ?? null,
      params?.resourceId ?? null,
      params?.warehouseId ?? null,
      params?.requestId ?? null,
      params?.eventType ?? null,
      params?.limit ?? null,
    ],
    queryFn: async () => {
      const search = new URLSearchParams();
      if (params?.start != null) search.set("start", params.start.toString());
      if (params?.end != null) search.set("end", params.end.toString());
      if (params?.resourceId != null) search.set("resourceId", params.resourceId.toString());
      if (params?.warehouseId != null) search.set("warehouseId", params.warehouseId.toString());
      if (params?.requestId != null) search.set("requestId", params.requestId.toString());
      if (params?.eventType) search.set("eventType", params.eventType);
      if (params?.limit != null) search.set("limit", params.limit.toString());
      const qs = search.toString();
      const response = await apiClient<AllocationHistoryEntry[]>(
        `/api/allocations/history${qs ? `?${qs}` : ""}`,
      );
      return response;
    },
  });
}

export function useGetTransactionsQuery(params?: TransactionQueryFilters) {
  return useQuery({
    queryKey: [
      "transactions",
      params?.start ?? null,
      params?.end ?? null,
      params?.category ?? null,
      params?.direction ?? null,
      params?.limit ?? null,
    ],
    queryFn: async () => {
      const search = new URLSearchParams();
      if (params?.start != null) search.set("start", params.start.toString());
      if (params?.end != null) search.set("end", params.end.toString());
      if (params?.category) search.set("category", params.category);
      if (params?.direction) search.set("direction", params.direction);
      if (params?.limit != null) search.set("limit", params.limit.toString());
      const qs = search.toString();
      const response = await apiClient<TransactionRecord[]>(`/api/transactions${qs ? `?${qs}` : ""}`);
      return response;
    },
  });
}

export function useTransactionSummaryQuery(params?: TransactionSummaryQuery) {
  return useQuery({
    queryKey: [
      "transaction-summary",
      params?.start ?? null,
      params?.end ?? null,
      params?.category ?? null,
      params?.direction ?? null,
      params?.period ?? null,
      params?.windowDays ?? null,
    ],
    queryFn: async () => {
      const search = new URLSearchParams();
      if (params?.start != null) search.set("start", params.start.toString());
      if (params?.end != null) search.set("end", params.end.toString());
      if (params?.category) search.set("category", params.category);
      if (params?.direction) search.set("direction", params.direction);
      if (params?.limit != null) search.set("limit", params.limit.toString());
      if (params?.period) search.set("period", params.period);
      if (params?.windowDays != null) search.set("windowDays", params.windowDays.toString());
      const qs = search.toString();
      const response = await apiClient<TransactionSummary>(
        `/api/transactions/summary${qs ? `?${qs}` : ""}`,
      );
      return response;
    },
  });
}

export function useCreateTransactionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateTransactionInput) => {
      const response = await apiClient<TransactionRecord>("/api/transactions", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transaction-summary"] });
    },
  });
}

// ===========================
// Disaster Reports Hooks
// ===========================

type GetReportsQueryParams = {
  page?: number;
  limit?: number;
  status?: DisasterReport["status"];
  severity?: DisasterReport["severity"];
};

const DEFAULT_REPORTS_PAGE_SIZE = 25;

export function useGetReportsQuery(params?: GetReportsQueryParams) {
  const normalized = {
    page: Math.max(1, params?.page ?? 1),
    limit: Math.max(1, params?.limit ?? DEFAULT_REPORTS_PAGE_SIZE),
    status: params?.status ?? null,
    severity: params?.severity ?? null,
  };

  return useQuery({
    queryKey: ["reports", "list", normalized],
    queryFn: async () => {
      const search = new URLSearchParams();
      search.set("page", normalized.page.toString());
      search.set("limit", normalized.limit.toString());
      if (normalized.status) search.set("status", normalized.status);
      if (normalized.severity) search.set("severity", normalized.severity);
      const qs = search.toString();
      const response = await apiClient<PaginatedReportsResponse>(
        `/api/reports${qs ? `?${qs}` : ""}`,
      );
      return response;
    },
  });
}

export function useGetReportQuery(id: number | string | undefined) {
  return useQuery({
    queryKey: ["reports", id],
    queryFn: async () => {
      const response = await apiClient<DisasterReport>(`/api/reports/${id}`);
      return response;
    },
    enabled: !!id,
  });
}

export function useSubmitReportMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reportData: CreateReportInput) => {
      const response = await apiClient<DisasterReport>("/api/reports", {
        method: "POST",
        body: JSON.stringify(reportData),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}

export function useUpdateReportMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: UpdateReportInput;
    }) => {
      const response = await apiClient<DisasterReport>(`/api/reports/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["reports", variables.id] });
    },
  });
}

export function useDeleteReportMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient(`/api/reports/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}

// ===========================
// Rescue Requests Hooks
// ===========================

type SortDirection = "asc" | "desc";
type RescueRequestSortKey = "createdAt" | "priority" | "criticalityScore";

type GetRescueRequestsParams = {
  page?: number;
  limit?: number;
  status?: RescueRequest["status"];
  priority?: RescueRequest["priority"];
  userId?: number;
  warehouseId?: number;
  search?: string;
  sortBy?: RescueRequestSortKey;
  sortDirection?: SortDirection;
};

const DEFAULT_RESCUE_PAGE_SIZE = 25;
const DEFAULT_RESCUE_SORT: RescueRequestSortKey = "createdAt";
const DEFAULT_RESCUE_SORT_DIRECTION: SortDirection = "desc";

function normalizeRescueRequestParams(params?: GetRescueRequestsParams) {
  return {
    page: Math.max(1, params?.page ?? 1),
    limit: Math.max(1, params?.limit ?? DEFAULT_RESCUE_PAGE_SIZE),
    status: params?.status ?? null,
    priority: params?.priority ?? null,
    userId: params?.userId ?? null,
    warehouseId: params?.warehouseId ?? null,
    search: params?.search?.trim() ? params.search.trim() : null,
    sortBy: params?.sortBy ?? DEFAULT_RESCUE_SORT,
    sortDirection: params?.sortDirection ?? DEFAULT_RESCUE_SORT_DIRECTION,
  } as const;
}

type NormalizedRescueRequestParams = ReturnType<typeof normalizeRescueRequestParams>;
type RescueRequestsQueryKey = ["rescueRequests", "list", NormalizedRescueRequestParams];
type RescueRequestsQueryOptions<TData> = Omit<
  UseQueryOptions<PaginatedRescueRequestsResponse, Error, TData, RescueRequestsQueryKey>,
  "queryKey" | "queryFn"
>;

export function useGetRescueRequestsQuery<TData = PaginatedRescueRequestsResponse>(
  params?: GetRescueRequestsParams,
  options?: RescueRequestsQueryOptions<TData>,
) {
  const normalized = normalizeRescueRequestParams(params);

  return useQuery<PaginatedRescueRequestsResponse, Error, TData>({
    queryKey: ["rescueRequests", "list", normalized],
    queryFn: async () => {
      const search = new URLSearchParams();
      search.set("page", normalized.page.toString());
      search.set("limit", normalized.limit.toString());
      if (normalized.status) search.set("status", normalized.status);
      if (normalized.priority) search.set("priority", normalized.priority);
      if (normalized.userId) search.set("userId", normalized.userId.toString());
      if (normalized.warehouseId) search.set("warehouseId", normalized.warehouseId.toString());
      if (normalized.search) search.set("q", normalized.search);
      if (normalized.sortBy) search.set("sortBy", normalized.sortBy);
      if (normalized.sortDirection) search.set("sortDirection", normalized.sortDirection);
      const qs = search.toString();
      const response = await apiClient<PaginatedRescueRequestsResponse>(
        `/api/rescue-requests${qs ? `?${qs}` : ""}`,
      );
      return response;
    },
    ...options,
  });
}

export function useGetUserRescueRequestsQuery(params?: Omit<GetRescueRequestsParams, "userId">) {
  const { user, hydrated } = useAppStore();
  const normalized = normalizeRescueRequestParams({ ...params, userId: user?.id });

  return useQuery({
    queryKey: ["rescueRequests", "user", user?.id ?? "anonymous", normalized],
    queryFn: async () => {
      const search = new URLSearchParams();
      search.set("page", normalized.page.toString());
      search.set("limit", normalized.limit.toString());
      if (normalized.status) search.set("status", normalized.status);
      if (normalized.priority) search.set("priority", normalized.priority);
      if (normalized.userId) search.set("userId", normalized.userId.toString());
      if (normalized.warehouseId) search.set("warehouseId", normalized.warehouseId.toString());
      if (normalized.search) search.set("q", normalized.search);
      if (normalized.sortBy) search.set("sortBy", normalized.sortBy);
      if (normalized.sortDirection) search.set("sortDirection", normalized.sortDirection);
      const qs = search.toString();
      const response = await apiClient<PaginatedRescueRequestsResponse>(
        `/api/rescue-requests${qs ? `?${qs}` : ""}`,
      );
      return response;
    },
    enabled: Boolean(hydrated && user),
  });
}

export function useGetRescueRequestQuery(id: number | string | undefined) {
  return useQuery({
    queryKey: ["rescueRequests", id],
    queryFn: async () => {
      const response = await apiClient<RescueRequest>(`/api/rescue-requests/${id}`);
      return response;
    },
    enabled: !!id,
  });
}

type RescueBacklogSummary = {
  totalRequests: number;
  openRequests: number;
  pending: number;
  inProgress: number;
  fulfilled: number;
  cancelled: number;
  estimatedPeopleImpacted: number;
  priorityBreakdown: Record<RescueRequest["priority"], number>;
  statusBreakdown: Record<RescueRequest["status"], number>;
  recentCritical: RescueRequest[];
};

export function useRescueBacklog(params?: GetRescueRequestsParams) {
  return useGetRescueRequestsQuery<RescueBacklogSummary>(params, {
    select: (data) => {
      const summary: RescueBacklogSummary = {
        totalRequests: data.requests.length,
        openRequests: 0,
        pending: 0,
        inProgress: 0,
        fulfilled: 0,
        cancelled: 0,
        estimatedPeopleImpacted: 0,
        priorityBreakdown: {
          low: 0,
          medium: 0,
          high: 0,
        },
        statusBreakdown: {
          pending: 0,
          in_progress: 0,
          fulfilled: 0,
          cancelled: 0,
        },
        recentCritical: [],
      };

      for (const request of data.requests) {
        summary.priorityBreakdown[request.priority] += 1;
        summary.statusBreakdown[request.status] += 1;

        if (request.status === "pending" || request.status === "in_progress") {
          summary.openRequests += 1;
          summary.estimatedPeopleImpacted += Math.max(1, request.peopleCount ?? 0);
        }
      }

      summary.pending = summary.statusBreakdown.pending;
      summary.inProgress = summary.statusBreakdown.in_progress;
      summary.fulfilled = summary.statusBreakdown.fulfilled;
      summary.cancelled = summary.statusBreakdown.cancelled;

      summary.recentCritical = [...data.requests]
        .filter((request) => request.status !== "cancelled")
        .sort((a, b) => {
          if (b.criticalityScore === a.criticalityScore) {
            return b.createdAt - a.createdAt;
          }
          return b.criticalityScore - a.criticalityScore;
        })
        .slice(0, 5);

      return summary;
    },
  });
}

export function useSubmitRescueRequestMutation() {
  const queryClient = useQueryClient();
  const { user } = useAppStore();

  return useMutation({
    mutationFn: async (requestData: CreateRescueRequestInput) => {
      const response = await apiClient<RescueRequest>("/api/rescue-requests", {
        method: "POST",
        body: JSON.stringify(requestData),
      });
      return response;
    },
    onSuccess: () => {
      toast.success("Help request submitted. Rescuers have been notified.");
      queryClient.invalidateQueries({ queryKey: ["rescueRequests", "list"] });
      queryClient.invalidateQueries({ queryKey: ["rescueRequests", "user", user?.id ?? "anonymous"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Unable to submit help request");
    },
  });
}

export function useUpdateRescueRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: UpdateRescueRequestStatusInput;
    }) => {
      const response = await apiClient<RescueRequest>(`/api/rescue-requests/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      return response;
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ["rescueRequests"] });

      const previousDetail = queryClient.getQueryData<RescueRequest>(["rescueRequests", variables.id]);
      const previousLists = queryClient.getQueriesData<PaginatedRescueRequestsResponse>({
        queryKey: ["rescueRequests", "list"],
      });
      const previousUserLists = queryClient.getQueriesData<PaginatedRescueRequestsResponse>({
        queryKey: ["rescueRequests", "user"],
      });

      const patchPaginated = (collection?: PaginatedRescueRequestsResponse) => {
        if (!collection) return collection;
        return {
          ...collection,
          requests: collection.requests.map((request) =>
            request.id === variables.id ? { ...request, ...variables.data } : request,
          ),
        };
      };

      const fallbackRequest =
        previousDetail ??
        previousLists
          .flatMap(([, value]) => value?.requests ?? [])
          .find((request) => request.id === variables.id) ??
        previousUserLists
          .flatMap(([, value]) => value?.requests ?? [])
          .find((request) => request.id === variables.id);

      if (fallbackRequest) {
        queryClient.setQueryData<RescueRequest>(["rescueRequests", variables.id], {
          ...fallbackRequest,
          ...variables.data,
        });
      }

      previousLists.forEach(([key, value]) => {
        if (!value) return;
        queryClient.setQueryData<PaginatedRescueRequestsResponse>(key, patchPaginated(value));
      });

      previousUserLists.forEach(([key, value]) => {
        if (!value) return;
        queryClient.setQueryData<PaginatedRescueRequestsResponse>(key, patchPaginated(value));
      });

      return { previousDetail, previousLists, previousUserLists };
    },
    onError: (_error, variables, context) => {
      if (!context) return;
      if (context.previousDetail) {
        queryClient.setQueryData(["rescueRequests", variables.id], context.previousDetail);
      }
      context.previousLists.forEach(([key, value]) => {
        queryClient.setQueryData(key, value);
      });
      context.previousUserLists.forEach(([key, value]) => {
        queryClient.setQueryData(key, value);
      });
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: ["rescueRequests", "list"] });
      queryClient.invalidateQueries({ queryKey: ["rescueRequests", "user"] });
      queryClient.invalidateQueries({ queryKey: ["rescueRequests", variables.id] });
    },
  });
}

// ===========================
// Warehouses Hooks
// ===========================

export function useGetWarehousesQuery() {
  return useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => {
      const response = await apiClient<Warehouse[]>("/api/warehouses");
      return response;
    },
  });
}

export function useGetWarehouseQuery(id: number | string | undefined) {
  return useQuery({
    queryKey: ["warehouses", id],
    queryFn: async () => {
      const response = await apiClient<Warehouse>(`/api/warehouses/${id}`);
      return response;
    },
    enabled: !!id,
  });
}

export function useGetWarehouseInventoryQuery(id: number | string | undefined) {
  return useQuery({
    queryKey: ["warehouses", id, "inventory"],
    queryFn: async () => {
      const response = await apiClient<Resource[]>(`/api/warehouses/${id}/inventory`);
      return response;
    },
    enabled: !!id,
  });
}

export function useCreateWarehouseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (warehouseData: CreateWarehouseInput) => {
      const response = await apiClient<Warehouse>("/api/warehouses", {
        method: "POST",
        body: JSON.stringify(warehouseData),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
    },
  });
}

export function useUpdateWarehouseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: UpdateWarehouseInput;
    }) => {
      const response = await apiClient<Warehouse>(`/api/warehouses/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      queryClient.invalidateQueries({ queryKey: ["warehouses", data.id] });
    },
  });
}

// ===========================
// Resources Hooks
// ===========================

type ResourceSortKey = "updatedAt" | "quantity" | "type";

type GetResourcesParams = {
  page?: number;
  limit?: number;
  warehouseId?: number;
  type?: string;
  search?: string;
  sortBy?: ResourceSortKey;
  sortDirection?: SortDirection;
};

const DEFAULT_RESOURCES_PAGE_SIZE = 50;
const DEFAULT_RESOURCE_SORT: ResourceSortKey = "updatedAt";
const DEFAULT_RESOURCE_SORT_DIRECTION: SortDirection = "desc";

function normalizeResourceParams(params?: GetResourcesParams) {
  return {
    page: Math.max(1, params?.page ?? 1),
    limit: Math.max(1, params?.limit ?? DEFAULT_RESOURCES_PAGE_SIZE),
    warehouseId: params?.warehouseId ?? null,
    type: params?.type ?? null,
    search: params?.search?.trim() ? params.search.trim() : null,
    sortBy: params?.sortBy ?? DEFAULT_RESOURCE_SORT,
    sortDirection: params?.sortDirection ?? DEFAULT_RESOURCE_SORT_DIRECTION,
  } as const;
}

type NormalizedResourceParams = ReturnType<typeof normalizeResourceParams>;
type ResourcesQueryKey = ["resources", "list", NormalizedResourceParams];
type ResourcesQueryOptions<TData> = Omit<
  UseQueryOptions<PaginatedResourcesResponse, Error, TData, ResourcesQueryKey>,
  "queryKey" | "queryFn"
>;

export function useGetResourcesQuery<TData = PaginatedResourcesResponse>(
  params?: GetResourcesParams,
  options?: ResourcesQueryOptions<TData>,
) {
  const normalized = normalizeResourceParams(params);

  return useQuery<PaginatedResourcesResponse, Error, TData>({
    queryKey: ["resources", "list", normalized],
    queryFn: async () => {
      const search = new URLSearchParams();
      search.set("page", normalized.page.toString());
      search.set("limit", normalized.limit.toString());
      if (normalized.warehouseId) search.set("warehouseId", normalized.warehouseId.toString());
      if (normalized.type) search.set("type", normalized.type);
      if (normalized.search) search.set("q", normalized.search);
      if (normalized.sortBy) search.set("sortBy", normalized.sortBy);
      if (normalized.sortDirection) search.set("sortDirection", normalized.sortDirection);
      const qs = search.toString();
      const response = await apiClient<PaginatedResourcesResponse>(
        `/api/resources${qs ? `?${qs}` : ""}`,
      );
      return response;
    },
    ...options,
  });
}

type LowStockParams = {
  warehouseId?: number;
  limit?: number;
  includeDepleted?: boolean;
  buffer?: number;
};

export function useGetLowStockResourcesQuery(params?: LowStockParams) {
  const normalized = {
    warehouseId: params?.warehouseId ?? null,
    limit: Math.max(1, Math.min(500, params?.limit ?? 25)),
    includeDepleted: params?.includeDepleted ?? true,
    buffer: Math.max(0, params?.buffer ?? 0),
  } as const;

  return useQuery({
    queryKey: ["resources", "low-stock", normalized],
    queryFn: async () => {
      const search = new URLSearchParams();
      search.set("limit", normalized.limit.toString());
      search.set("includeDepleted", String(normalized.includeDepleted));
      search.set("buffer", normalized.buffer.toString());
      if (normalized.warehouseId) {
        search.set("warehouseId", normalized.warehouseId.toString());
      }
      const qs = search.toString();
      const response = await apiClient<LowStockResourcesResponse>(
        `/api/resources/low-stock${qs ? `?${qs}` : ""}`,
      );
      return response;
    },
  });
}

type WarehouseInventorySummary = {
  totalQuantity: number;
  uniqueResourceTypes: number;
  lowStockResources: Resource[];
  depletedResources: Resource[];
  warehouses: Record<
    number,
    {
      warehouseId: number;
      totalQuantity: number;
      resourceTypes: number;
      lowStockResources: Resource[];
      resources: Resource[];
    }
  >;
};

export function useWarehouseInventorySummary(params?: GetResourcesParams) {
  return useGetResourcesQuery<WarehouseInventorySummary>(params, {
    select: (data) => {
      const summary: WarehouseInventorySummary = {
        totalQuantity: 0,
        uniqueResourceTypes: 0,
        lowStockResources: [],
        depletedResources: [],
        warehouses: {},
      };

      const globalTypes = new Set<string>();
      const warehouseTypeSets = new Map<number, Set<string>>();

      for (const resource of data.resources) {
        summary.totalQuantity += resource.quantity;
        globalTypes.add(resource.type.toLowerCase());

        const entry = summary.warehouses[resource.warehouseId] ?? {
          warehouseId: resource.warehouseId,
          totalQuantity: 0,
          resourceTypes: 0,
          lowStockResources: [],
          resources: [],
        };

        entry.totalQuantity += resource.quantity;
        entry.resources.push(resource);
        summary.warehouses[resource.warehouseId] = entry;

        const typeSet = warehouseTypeSets.get(resource.warehouseId) ?? new Set<string>();
        typeSet.add(resource.type.toLowerCase());
        warehouseTypeSets.set(resource.warehouseId, typeSet);

        const reorderLevel = resource.reorderLevel ?? 0;
        const isLowStock = reorderLevel > 0 && resource.quantity <= reorderLevel;
        const isDepleted = resource.quantity === 0;

        if (isLowStock) {
          summary.lowStockResources.push(resource);
          entry.lowStockResources.push(resource);
        }

        if (isDepleted) {
          summary.depletedResources.push(resource);
        }
      }

      summary.uniqueResourceTypes = globalTypes.size;

      for (const [warehouseId, typeSet] of warehouseTypeSets.entries()) {
        if (summary.warehouses[warehouseId]) {
          summary.warehouses[warehouseId].resourceTypes = typeSet.size;
        }
      }

      return summary;
    },
  });
}

export function useGetResourceQuery(id: number | string | undefined) {
  return useQuery({
    queryKey: ["resources", id],
    queryFn: async () => {
      const response = await apiClient<Resource>(`/api/resources/${id}`);
      return response;
    },
    enabled: !!id,
  });
}

export function useCreateResourceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (resourceData: CreateResourceInput) => {
      const response = await apiClient<{ record: Resource }>("/api/resources", {
        method: "POST",
        body: JSON.stringify(resourceData),
      });
      return response.record;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["resources", "list"] });
      queryClient.invalidateQueries({ queryKey: ["warehouses", data.warehouseId, "inventory"] });
    },
  });
}

export function useUpdateResourceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: UpdateResourceInput;
    }) => {
      const response = await apiClient<{ record: Resource }>(`/api/resources/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      return response.record;
    },
    onMutate: async (variables) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["resources"] }),
        queryClient.cancelQueries({ queryKey: ["warehouses"] }),
      ]);

      const previousDetail = queryClient.getQueryData<Resource>(["resources", variables.id]);
      const previousLists = queryClient.getQueriesData<PaginatedResourcesResponse>({
        queryKey: ["resources", "list"],
      });

      const findResourceInLists = () =>
        previousLists
          .flatMap(([, value]) => value?.resources ?? [])
          .find((resource) => resource.id === variables.id);

      const baselineResource = previousDetail ?? findResourceInLists();
      const optimisticResource = baselineResource
        ? ({ ...baselineResource, ...variables.data } as Resource)
        : undefined;

      if (optimisticResource) {
        queryClient.setQueryData<Resource>(["resources", variables.id], optimisticResource);
      }

      previousLists.forEach(([key, value]) => {
        if (!value || !optimisticResource) return;
        queryClient.setQueryData<PaginatedResourcesResponse>(key, {
          ...value,
          resources: value.resources.map((resource) =>
            resource.id === optimisticResource.id ? optimisticResource : resource,
          ),
        });
      });

      const previousWarehouseId = baselineResource?.warehouseId ?? null;
      const nextWarehouseId = variables.data.warehouseId ?? previousWarehouseId ?? null;
      const warehouseIds = new Set<number>();
      if (previousWarehouseId) warehouseIds.add(previousWarehouseId);
      if (nextWarehouseId) warehouseIds.add(nextWarehouseId);

      const warehouseSnapshots = Array.from(warehouseIds).map((warehouseId) => {
        const inventoryKey = ["warehouses", warehouseId, "inventory"] as const;
        const snapshot = queryClient.getQueryData<Resource[]>(inventoryKey);

        if (snapshot && optimisticResource) {
          const isSource = warehouseId === previousWarehouseId;
          const isTarget = warehouseId === nextWarehouseId;
          let nextInventory = snapshot;

          if (isTarget) {
            const exists = snapshot.some((entry) => entry.id === optimisticResource.id);
            nextInventory = exists
              ? snapshot.map((entry) => (entry.id === optimisticResource.id ? optimisticResource : entry))
              : [...snapshot, optimisticResource];
          }

          if (isSource && !isTarget) {
            nextInventory = snapshot.filter((entry) => entry.id !== optimisticResource.id);
          }

          queryClient.setQueryData<Resource[]>(inventoryKey, nextInventory);
        }

        return { key: inventoryKey, snapshot };
      });

      return { previousDetail, previousLists, warehouseSnapshots };
    },
    onError: (_error, variables, context) => {
      if (!context) return;
      if (context.previousDetail) {
        queryClient.setQueryData(["resources", variables.id], context.previousDetail);
      }
      context.previousLists.forEach(([key, value]) => {
        queryClient.setQueryData(key, value);
      });
      context.warehouseSnapshots.forEach(({ key, snapshot }) => {
        if (snapshot) {
          queryClient.setQueryData(key, snapshot);
        }
      });
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: ["resources", "list"] });
      queryClient.invalidateQueries({ queryKey: ["resources", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
    },
  });
}

export function useDeleteResourceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient(`/api/resources/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resources", "list"] });
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
    },
  });
}

// ===========================
// Resource Allocations Hooks
// ===========================

export function useGetAllocationsQuery() {
  return useQuery({
    queryKey: ["allocations"],
    queryFn: async () => {
      const response = await apiClient<ResourceAllocation[]>("/api/allocations");
      return response;
    },
  });
}

export function useGetAllocationQuery(id: number | string | undefined) {
  return useQuery({
    queryKey: ["allocations", id],
    queryFn: async () => {
      const response = await apiClient<ResourceAllocation>(`/api/allocations/${id}`);
      return response;
    },
    enabled: !!id,
  });
}

export function useCreateAllocationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (allocationData: CreateAllocationInput) => {
      const response = await apiClient<{ record: ResourceAllocation }>("/api/allocations", {
        method: "POST",
        body: JSON.stringify(allocationData),
      });
      return response.record;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allocations"] });
      queryClient.invalidateQueries({ queryKey: ["resources", "list"] });
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
    },
  });
}

// ===========================
// Resource Transfers Hooks
// ===========================

export function useGetResourceTransfersQuery() {
  return useQuery({
    queryKey: ["resource-transfers"],
    queryFn: async () => {
      const response = await apiClient<ResourceTransfer[]>("/api/resource-transfers");
      return response;
    },
  });
}

export function useCreateResourceTransferMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateResourceTransferInput) => {
      const response = await apiClient<ResourceTransfer>("/api/resource-transfers", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resources", "list"] });
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      queryClient.invalidateQueries({ queryKey: ["resource-transfers"] });
    },
  });
}

// ===========================
// Distribution Logs Hooks
// ===========================

export function useGetDistributionLogsQuery() {
  return useQuery({
    queryKey: ["distribution-logs"],
    queryFn: async () => {
      const response = await apiClient<DistributionLog[]>("/api/distribution-logs");
      return response;
    },
  });
}

export function useCreateDistributionLogMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateDistributionLogInput) => {
      const response = await apiClient<DistributionLog>("/api/distribution-logs", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      return response;
    },
    onMutate: async (payload) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["resources"] }),
        queryClient.cancelQueries({ queryKey: ["warehouses", payload.warehouseId, "inventory"] }),
      ]);

      const previousDetail = queryClient.getQueryData<Resource>(["resources", payload.resourceId]);
      const previousLists = queryClient.getQueriesData<PaginatedResourcesResponse>({
        queryKey: ["resources", "list"],
      });
      const inventoryKey = ["warehouses", payload.warehouseId, "inventory"] as const;
      const previousInventory = queryClient.getQueryData<Resource[]>(inventoryKey);

      const findResourceInLists = () =>
        previousLists
          .flatMap(([, value]) => value?.resources ?? [])
          .find((resource) => resource.id === payload.resourceId);

      const baselineResource = previousDetail ?? findResourceInLists();
      const optimisticResource = baselineResource
        ? ({ ...baselineResource, quantity: Math.max(0, baselineResource.quantity - payload.quantity) } as Resource)
        : undefined;

      if (optimisticResource) {
        queryClient.setQueryData<Resource>(["resources", payload.resourceId], optimisticResource);
      }

      previousLists.forEach(([key, value]) => {
        if (!value || !optimisticResource) return;
        queryClient.setQueryData<PaginatedResourcesResponse>(key, {
          ...value,
          resources: value.resources.map((resource) =>
            resource.id === optimisticResource.id ? optimisticResource : resource,
          ),
        });
      });

      if (previousInventory && optimisticResource) {
        queryClient.setQueryData<Resource[]>(
          inventoryKey,
          previousInventory.map((resource) =>
            resource.id === optimisticResource.id ? optimisticResource : resource,
          ),
        );
      }

      return { previousDetail, previousLists, previousInventory, inventoryKey };
    },
    onError: (_error, payload, context) => {
      if (!context) return;
      if (context.previousDetail) {
        queryClient.setQueryData(["resources", payload.resourceId], context.previousDetail);
      }
      context.previousLists.forEach(([key, value]) => {
        queryClient.setQueryData(key, value);
      });
      if (context.previousInventory) {
        queryClient.setQueryData(context.inventoryKey, context.previousInventory);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["resources", "list"] });
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      queryClient.invalidateQueries({ queryKey: ["distribution-logs"] });
    },
  });
}
