import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useAppStore } from "@/state/app-store";
import type {
  LoginInput,
  LoginResponse,
  RegisterInput,
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
      const response = await apiClient<LoginResponse>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(userData),
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
  const { user } = useAppStore();
  
  return useQuery({
    queryKey: ["rescueRequests", "user", user?.id],
    queryFn: async () => {
      const response = await apiClient<RescueRequest[]>("/api/rescue-requests");
      return response;
    },
    enabled: !!user,
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

  return useMutation({
    mutationFn: async (requestData: CreateRescueRequestInput) => {
      const response = await apiClient<RescueRequest>("/api/rescue-requests", {
        method: "POST",
        body: JSON.stringify(requestData),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rescueRequests"] });
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
