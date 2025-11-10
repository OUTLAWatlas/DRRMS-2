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
});

export const createResourceSchema = z.object({
  type: z.string().min(1),
  quantity: z.number().int().nonnegative(),
  warehouseId: z.number().int().positive(),
});

// For PUT /api/resources/:id
export const updateResourceSchema = z.object({
  type: z.string().min(1).optional(),
  quantity: z.number().int().nonnegative().optional(),
  warehouseId: z.number().int().positive().optional(),
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
export type CreateReportInput = z.infer<typeof createReportSchema>;
export type UpdateReportInput = z.infer<typeof updateReportSchema>;
export type CreateRescueRequestInput = z.infer<
  typeof createRescueRequestSchema
>;
export type UpdateRescueRequestStatusInput = z.infer<
  typeof updateRescueRequestStatusSchema
>;
export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
export type CreateResourceInput = z.infer<typeof createResourceSchema>;
export type UpdateResourceInput = z.infer<typeof updateResourceSchema>;
export type CreateAllocationInput = z.infer<typeof createAllocationSchema>;

// -----------------------------
// Response Types (from DB schema)
// -----------------------------
export type User = {
  id: number;
  name: string;
  email: string;
  role: "survivor" | "rescuer" | "admin";
  createdAt: number;
  updatedAt: number;
};

export type LoginResponse = {
  token: string;
  user: User;
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
  createdAt: number;
  updatedAt: number;
};

export type Warehouse = {
  id: number;
  name: string;
  location: string;
  createdAt: number;
  updatedAt: number;
};

export type Resource = {
  id: number;
  type: string;
  quantity: number;
  warehouseId: number;
  createdAt: number;
  updatedAt: number;
};

export type ResourceAllocation = {
  id: number;
  requestId: number;
  resourceId: number;
  quantity: number;
  allocatedBy: number;
  createdAt: number;
  updatedAt: number;
};
