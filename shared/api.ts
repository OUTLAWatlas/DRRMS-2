/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

import { z } from "zod";

/**
 * Example response type for /api/demo
 */
export interface DemoResponse {
  message: string;
}

// -----------------------------
// Auth Schemas
// -----------------------------
export const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["survivor", "rescuer", "admin"]).default("survivor"),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  mfaToken: z.string().length(6).optional(),
  mfaRecoveryCode: z.string().min(6).max(32).optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(["rescuer", "admin"]),
});

export const updateUserAccessSchema = z.object({
  blocked: z.boolean(),
});

export const updateUserProfileSchema = z
  .object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    role: z.enum(["survivor", "rescuer", "admin"]).optional(),
    isApproved: z.boolean().optional(),
    isBlocked: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export const mfaVerifySchema = z.object({
  token: z.string().length(6),
});

export const mfaDisableSchema = z
  .object({
    token: z.string().length(6).optional(),
    recoveryCode: z.string().min(6).max(32).optional(),
  })
  .refine((data) => Boolean(data.token || data.recoveryCode), {
    message: "Token or recovery code required",
    path: ["token"],
  });

export const createTransactionSchema = z.object({
  reference: z.string().min(1),
  direction: z.enum(["income", "expense"]),
  amount: z.number().positive(),
  currency: z.string().length(3).optional(),
  category: z.string().min(2).max(40).optional(),
  description: z.string().max(280).optional(),
  requestId: z.number().int().positive().optional(),
});

// -----------------------------
// Reports Schemas
// -----------------------------
export const createReportSchema = z.object({
  whatHappened: z.string().min(1),
  location: z.string().min(1),
  severity: z.enum(["Low", "Moderate", "High", "Critical"]).default(
    "Low",
  ),
  occurredAt: z.string().datetime().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

// For PUT /api/reports/:id
export const updateReportSchema = z.object({
  whatHappened: z.string().min(1).optional(),
  location: z.string().min(1).optional(),
  severity: z
    .enum(["Low", "Moderate", "High", "Critical"])
    .optional(),
  occurredAt: z.string().datetime().optional(),
  status: z.enum(["pending", "in_progress", "resolved", "rejected"]).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

// -----------------------------
// Rescue Requests Schemas
// -----------------------------
export const createRescueRequestSchema = z.object({
  location: z.string().min(1),
  details: z.string().min(1),
  peopleCount: z.number().int().positive().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const updateRescueRequestStatusSchema = z.object({
  status: z.enum(["pending", "in_progress", "fulfilled", "cancelled"]),
});

// -----------------------------
// Warehouses & Resources Schemas
// -----------------------------
export const createWarehouseSchema = z.object({
  name: z.string().min(1),
  location: z.string().min(1),
  capacity: z.number().int().nonnegative().optional(),
  lastAuditedAt: z.string().datetime().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const updateWarehouseSchema = z.object({
  name: z.string().min(1).optional(),
  location: z.string().min(1).optional(),
  capacity: z.number().int().nonnegative().optional(),
  lastAuditedAt: z.string().datetime().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const createResourceSchema = z.object({
  type: z.string().min(1),
  quantity: z.number().int().nonnegative(),
  warehouseId: z.number().int().positive(),
  unit: z.string().min(1).optional(),
  reorderLevel: z.number().int().nonnegative().optional(),
});

// For PUT /api/resources/:id
export const updateResourceSchema = z.object({
  type: z.string().min(1).optional(),
  quantity: z.number().int().nonnegative().optional(),
  warehouseId: z.number().int().positive().optional(),
  unit: z.string().min(1).optional(),
  reorderLevel: z.number().int().nonnegative().optional(),
});

export const createResourceTransferSchema = z.object({
  resourceId: z.number().int().positive(),
  toWarehouseId: z.number().int().positive(),
  quantity: z.number().int().positive(),
  note: z.string().max(280).optional(),
});

export const createDistributionLogSchema = z.object({
  resourceId: z.number().int().positive(),
  warehouseId: z.number().int().positive(),
  quantity: z.number().int().positive(),
  destination: z.string().min(1),
  requestId: z.number().int().positive().optional(),
  notes: z.string().max(280).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

// -----------------------------
// Allocations Schemas
// -----------------------------
export const createAllocationSchema = z.object({
  requestId: z.number().int().positive(),
  resources: z
    .array(
      z.object({
        resourceId: z.number().int().positive(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
export type UpdateUserAccessInput = z.infer<typeof updateUserAccessSchema>;
export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>;
export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>;
export type MfaDisableInput = z.infer<typeof mfaDisableSchema>;
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type CreateReportInput = z.infer<typeof createReportSchema>;
export type UpdateReportInput = z.infer<typeof updateReportSchema>;
export type CreateRescueRequestInput = z.infer<
  typeof createRescueRequestSchema
>;
export type UpdateRescueRequestStatusInput = z.infer<
  typeof updateRescueRequestStatusSchema
>;
export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema>;
export type CreateResourceInput = z.infer<typeof createResourceSchema>;
export type UpdateResourceInput = z.infer<typeof updateResourceSchema>;
export type CreateAllocationInput = z.infer<typeof createAllocationSchema>;
export type CreateResourceTransferInput = z.infer<typeof createResourceTransferSchema>;
export type CreateDistributionLogInput = z.infer<typeof createDistributionLogSchema>;

// -----------------------------
// Response Types (from DB schema)
// -----------------------------
export type User = {
  id: number;
  name: string;
  email: string;
  role: "survivor" | "rescuer" | "admin";
  isApproved: boolean;
  isBlocked: boolean;
  mfaEnabled: boolean;
  createdAt: number;
  updatedAt: number;
};

export type LoginResponse = {
  token: string;
  user: User;
};

export type RegisterResponse =
  | LoginResponse
  | {
      pendingApproval: true;
      message: string;
    };

export type PendingRescuer = {
  id: number;
  name: string;
  email: string;
  createdAt: number;
};

export type ApproveRescuerResponse = {
  message: string;
  user: User;
};

export type UpdateUserRoleResponse = {
  message: string;
  user: User;
};

export type UpdateUserAccessResponse = {
  message: string;
  user: User;
};

export type ForgotPasswordResponse = {
  message: string;
  resetToken?: string;
};

export type DisasterReport = {
  id: number;
  whatHappened: string;
  location: string;
  severity: "Low" | "Moderate" | "High" | "Critical";
  status: "pending" | "in_progress" | "resolved" | "rejected";
  occurredAt: string | null;
  latitude: number | null;
  longitude: number | null;
  reportedBy: number;
  createdAt: number;
  updatedAt: number;
};

export type RescueRequest = {
  id: number;
  location: string;
  details: string;
  peopleCount: number | null;
  priority: "low" | "medium" | "high";
  status: "pending" | "in_progress" | "fulfilled" | "cancelled";
  requestedBy: number;
  criticalityScore: number;
  lastScoredAt: number | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: number;
  updatedAt: number;
};

export type Warehouse = {
  id: number;
  name: string;
  location: string;
  capacity: number;
  lastAuditedAt: number | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: number;
  updatedAt: number;
};

export type Resource = {
  id: number;
  type: string;
  quantity: number;
  unit: string;
  reorderLevel: number;
  warehouseId: number;
  createdAt: number;
  updatedAt: number;
};

export type ResourceTransfer = {
  id: number;
  resourceId: number;
  fromWarehouseId: number | null;
  toWarehouseId: number | null;
  quantity: number;
  note: string | null;
  createdBy: number | null;
  createdAt: number;
};

export type DistributionLog = {
  id: number;
  resourceId: number;
  warehouseId: number;
  quantity: number;
  destination: string;
  requestId: number | null;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  createdBy: number | null;
  createdAt: number;
};

export type ResourceAllocation = {
  id: number;
  requestId: number;
  resourceId: number;
  quantity: number;
  allocatedBy: number;
  status: "booked" | "dispatched" | "released";
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  allocatedAt: number;
};

export type PrioritySnapshot = {
  id: number;
  requestId: number;
  score: number;
  severityWeight: number;
  peopleWeight: number;
  ageWeight: number;
  supplyPressureWeight: number;
  recommendedResourceId: number | null;
  recommendedWarehouseId: number | null;
  recommendedQuantity: number | null;
  rationale: string | null;
  createdAt: number;
};

export type AllocationRecommendation = {
  id: number;
  requestId: number;
  resourceId: number | null;
  resourceType?: string | null;
  warehouseId: number | null;
  warehouseName?: string | null;
  quantity: number | null;
  score: number;
  status: "suggested" | "applied" | "dismissed";
  rationale: string | null;
  createdAt: number;
};

export type PrioritizedRequest = {
  snapshotId: number;
  request: RescueRequest;
  score: number;
  severityWeight: number;
  peopleWeight: number;
  ageWeight: number;
  supplyPressureWeight: number;
  proximityWeight: number;
  hubCapacityWeight: number;
  nearestWarehouseId?: number | null;
  nearestWarehouseDistanceKm?: number | null;
  hubCapacityRatio?: number | null;
  nearestWarehouseName?: string | null;
  rationale: string | null;
  recommendation?: AllocationRecommendation | null;
};

export type AllocationHistoryEntry = {
  id: number;
  allocationId: number | null;
  requestId: number;
  resourceId: number;
  resourceType: string;
  warehouseId: number | null;
  warehouseName?: string | null;
  quantity: number;
  eventType: "booked" | "dispatched" | "released";
  note: string | null;
  actorId: number | null;
  actorName?: string | null;
  createdAt: number;
};

export type AllocationHistoryFilter = {
  start?: number;
  end?: number;
  resourceId?: number;
  warehouseId?: number;
  requestId?: number;
  eventType?: "booked" | "dispatched" | "released";
  limit?: number;
};

export type TransactionRecord = {
  id: number;
  reference: string;
  direction: "income" | "expense";
  amountCents: number;
  currency: string;
  category: string;
  description: string | null;
  requestId: number | null;
  recordedBy: number | null;
  recordedAt: number;
};

export type TransactionQueryFilters = {
  start?: number;
  end?: number;
  category?: string;
  direction?: "income" | "expense";
  limit?: number;
};

export type TransactionSummaryQuery = TransactionQueryFilters & {
  period?: "day" | "week" | "month";
  windowDays?: number;
};

export type TransactionPeriodBucket = {
  periodStart: number;
  periodEnd: number;
  income: number;
  expense: number;
};

export type TransactionCategoryBreakdown = {
  category: string;
  income: number;
  expense: number;
};

export type TransactionSummary = {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  period: "day" | "week" | "month";
  bucketSizeMs: number;
  range: {
    start: number;
    end: number;
  };
  periodBuckets: TransactionPeriodBucket[];
  categories: TransactionCategoryBreakdown[];
};

export type RecalculatePrioritiesResponse = {
  updated: number;
  recalculatedAt: number;
  highestScore?: number;
};

export type ApplyRecommendationResponse = {
  message: string;
  allocation: ResourceAllocation;
};

export type LiveWeatherReading = {
  id: number;
  latitude: number;
  longitude: number;
  locationName: string;
  temperatureC: number | null;
  windSpeedKph: number | null;
  humidity: number | null;
  precipitationMm: number | null;
  condition: string | null;
  alertLevel: string;
  source: string;
  recordedAt: number;
  createdAt: number;
};

export type LiveWeatherResponse = {
  primary: LiveWeatherReading | null;
  nearby: LiveWeatherReading[];
};

export type GovernmentAlert = {
  id: number;
  externalId: string;
  headline: string;
  area: string | null;
  severity: string | null;
  certainty: string | null;
  urgency: string | null;
  source: string;
  issuedAt: number | null;
  expiresAt: number | null;
  summary: string | null;
  rawPayload: string | null;
  status: string;
  createdAt: number;
};

export type GovernmentAlertsResponse = {
  alerts: GovernmentAlert[];
};

export type LiveFeedRefreshResponse = {
  weatherInserted: number;
  alertsUpserted: number;
  provider: "mock" | "live";
  refreshedAt: number;
};

export type GeoRequestPoint = {
  id: number;
  latitude: number;
  longitude: number;
  status: RescueRequest["status"];
  priority: RescueRequest["priority"];
  peopleCount: number | null;
  criticalityScore: number;
  updatedAt: number;
};

export type GeoWarehousePoint = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  capacity: number;
  stockLevel: number;
};

export type GeoAllocationPoint = {
  id: number;
  requestId: number;
  resourceId: number;
  latitude: number;
  longitude: number;
  status: ResourceAllocation["status"];
  quantity: number;
  allocatedAt: number;
};

export type CriticalAssetType =
  | "fire_station"
  | "rescue_center"
  | "warehouse"
  | "police_station"
  | "medical_center"
  | "ndrf_base";

export type GeoCriticalAsset = {
  id: string;
  type: CriticalAssetType;
  name: string;
  latitude: number;
  longitude: number;
  city: string;
  state: string;
  description?: string;
  contact?: string;
};

export type GeoOverviewResponse = {
  requests: GeoRequestPoint[];
  warehouses: GeoWarehousePoint[];
  allocations: GeoAllocationPoint[];
  criticalAssets: GeoCriticalAsset[];
};

export type HeatmapBucket = {
  id: string;
  latitude: number;
  longitude: number;
  total: number;
  pending: number;
  inProgress: number;
  fulfilled: number;
  cancelled: number;
};

export type GeoHeatmapResponse = {
  buckets: HeatmapBucket[];
};

export type PredictiveRecommendationStatus =
  | "suggested"
  | "queued"
  | "applied"
  | "dismissed"
  | "expired";

export type PredictiveRecommendationContext = {
  avgPending?: number | null;
  avgRequestCount?: number | null;
  avgInventory?: number | null;
  avgSeverity?: number | null;
  demandPressure?: number | null;
  weatherAlertLevel?: string | null;
  weatherScore?: number | null;
  sampleCount?: number | null;
  supplyPressure?: number | null;
  timeDecayWeight?: number | null;
  proximityWeight?: number | null;
  hubCapacityWeight?: number | null;
  nearestWarehouseId?: number | null;
  nearestWarehouseDistanceKm?: number | null;
  hubCapacityRatio?: number | null;
  estimatedTravelMinutes?: number | null;
};

export type PredictiveRecommendation = {
  id: number;
  requestId: number | null;
  region: string | null;
  resourceType: string;
  suggestedQuantity: number;
  confidence: number | null;
  impactScore: number | null;
  leadTimeMinutes: number | null;
  rationale?: string | null;
  status: PredictiveRecommendationStatus;
  validFrom: number;
  validUntil: number | null;
  modelVersion: string;
  context?: PredictiveRecommendationContext | null;
  request?: {
    id: number;
    location: string | null;
    priority: RescueRequest["priority"];
    peopleCount: number | null;
    status: RescueRequest["status"];
  } | null;
};

export type PredictiveRecommendationsResponse = {
  recommendations: PredictiveRecommendation[];
};

export type PredictiveFeedbackAction = "applied" | "dismissed";

export type PredictiveRecommendationFeedbackRequest = {
  action: PredictiveFeedbackAction;
  note?: string;
};

export type DemandHeatmapCell = {
  region: string;
  resourceType: string;
  requestCount: number;
  pendingCount: number;
  inventoryAvailable: number;
  demandPressure: number;
  medianWaitMins: number | null;
};

export type DemandTimelinePoint = {
  bucketStart: number;
  avgDemandPressure: number;
  medianWaitMins: number | null;
};

export type DemandInsightsResponse = {
  latestBucketStart: number | null;
  heatmap: DemandHeatmapCell[];
  timeline: DemandTimelinePoint[];
};

export type SchedulerName =
  | "demand_snapshotter"
  | "predictive_allocation"
  | "live_feed_refresh"
  | "transparency_reporter";

export type SchedulerHealthStatus = "healthy" | "warning" | "critical";

export type SchedulerHealthRecord = {
  name: SchedulerName;
  label: string;
  description: string;
  expectedIntervalMs: number;
  lastRunAt: number | null;
  lastSuccessAt: number | null;
  lastErrorAt: number | null;
  lastDurationMs: number | null;
  successCount: number;
  errorCount: number;
  consecutiveFailures: number;
  staleForMs: number | null;
  status: SchedulerHealthStatus;
  lastErrorMessage?: string | null;
};

export type SchedulersHealthResponse = {
  ok: boolean;
  generatedAt: number;
  schedulers: SchedulerHealthRecord[];
};

export type TransparencyReportPayload = {
  generatedAt: number;
  windowStart: number;
  bucketStart: number;
  bucketEnd: number;
  totals: {
    rescueRequests: number;
    disasterReports: number;
    warehouses: number;
    resources: number;
  };
  activity24h: {
    newRequests: number;
    newReports: number;
    incomeCents: number;
    expenseCents: number;
  };
  status: {
    pending: number;
    inProgress: number;
    fulfilled: number;
  };
  governance: {
    pendingApprovals: number;
    blockedUsers: number;
  };
  chain: {
    previousHash: string | null;
  };
};

export type TransparencyReportRecord = {
  id: number;
  bucketStart: number;
  bucketEnd: number;
  generatedAt: number;
  payload: TransparencyReportPayload | null;
  payloadHash: string;
  signature: string | null;
  status: string;
  metadata: string | null;
};
