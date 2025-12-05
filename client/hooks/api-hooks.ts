import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
      queryClient.invalidateQueries({ queryKey: ["resources"] });
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

export function useGetReportsQuery() {
  return useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const response = await apiClient<DisasterReport[]>("/api/reports");
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

export function useGetRescueRequestsQuery() {
  return useQuery({
    queryKey: ["rescueRequests"],
    queryFn: async () => {
      const response = await apiClient<RescueRequest[]>("/api/rescue-requests");
      return response;
    },
  });
}

export function useGetUserRescueRequestsQuery() {
  const { user, hydrated } = useAppStore();

  return useQuery({
    queryKey: ["rescueRequests", "user", user?.id ?? "anonymous"],
    queryFn: async () => {
      const response = await apiClient<RescueRequest[]>("/api/rescue-requests");
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
    onMutate: async (requestData) => {
      await queryClient.cancelQueries({ queryKey: ["rescueRequests"] });
      await queryClient.cancelQueries({ queryKey: ["rescueRequests", "user", user?.id ?? "anonymous"] });

      const previousAll = queryClient.getQueryData<RescueRequest[]>(["rescueRequests"]);
      const previousUser = queryClient.getQueryData<RescueRequest[]>(["rescueRequests", "user", user?.id ?? "anonymous"]);

      const tempId = -Date.now();
      const now = Date.now();
      const optimistic: RescueRequest = {
        id: tempId,
        location: requestData.location,
        details: requestData.details,
        peopleCount: requestData.peopleCount ?? null,
        priority: requestData.priority ?? "medium",
        status: "pending",
        requestedBy: user?.id ?? 0,
        criticalityScore: 0,
        lastScoredAt: null,
        latitude: requestData.latitude ?? null,
        longitude: requestData.longitude ?? null,
        createdAt: now,
        updatedAt: now,
      };

      queryClient.setQueryData<RescueRequest[]>(["rescueRequests"], (current) => (current ? [optimistic, ...current] : [optimistic]));
      queryClient.setQueryData<RescueRequest[]>(
        ["rescueRequests", "user", user?.id ?? "anonymous"],
        (current) => (current ? [optimistic, ...current] : [optimistic]),
      );

      return { previousAll, previousUser, tempId };
    },
    onSuccess: (data, _variables, context) => {
      const replaceTemp = (list?: RescueRequest[] | undefined) =>
        list?.map((item) => (context && item.id === context.tempId ? data : item)) ?? list;

      queryClient.setQueryData<RescueRequest[]>(["rescueRequests"], (current) => replaceTemp(current) ?? [data]);
      queryClient.setQueryData<RescueRequest[]>(
        ["rescueRequests", "user", user?.id ?? "anonymous"],
        (current) => replaceTemp(current) ?? [data],
      );

      toast.success("Help request submitted. Rescuers have been notified.");
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previousAll) {
        queryClient.setQueryData(["rescueRequests"], context.previousAll);
      }
      if (context?.previousUser) {
        queryClient.setQueryData(["rescueRequests", "user", user?.id ?? "anonymous"], context.previousUser);
      }
      toast.error(error.message || "Unable to submit help request");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["rescueRequests"] });
      queryClient.invalidateQueries({ queryKey: ["rescueRequests", "user", user?.id ?? "anonymous"] });
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["rescueRequests"] });
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

export function useGetResourcesQuery() {
  return useQuery({
    queryKey: ["resources"],
    queryFn: async () => {
      const response = await apiClient<Resource[]>("/api/resources");
      return response;
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
      const response = await apiClient<Resource>("/api/resources", {
        method: "POST",
        body: JSON.stringify(resourceData),
      });
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["resources"] });
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
      const response = await apiClient<Resource>(`/api/resources/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      queryClient.invalidateQueries({ queryKey: ["resources", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["warehouses", data.warehouseId, "inventory"] });
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
      queryClient.invalidateQueries({ queryKey: ["resources"] });
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
      const response = await apiClient<ResourceAllocation>("/api/allocations", {
        method: "POST",
        body: JSON.stringify(allocationData),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allocations"] });
      queryClient.invalidateQueries({ queryKey: ["resources"] });
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
      queryClient.invalidateQueries({ queryKey: ["resources"] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      queryClient.invalidateQueries({ queryKey: ["distribution-logs"] });
    },
  });
}
