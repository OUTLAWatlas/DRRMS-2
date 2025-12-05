import type { RequestHandler } from "express";
import type { AuthRequest } from "../middleware/auth";
import { consumeRateLimit, type RateLimitRule } from "../middleware/rateLimit";

type Role = "survivor" | "rescuer" | "admin";

export type Permission =
  | "reports:create"
  | "reports:read"
  | "reports:update"
  | "reports:delete"
  | "rescue:create"
  | "rescue:list:all"
  | "rescue:list:own"
  | "rescue:update"
  | "warehouses:read"
  | "warehouses:write"
  | "resources:read"
  | "resources:write"
  | "allocations:write"
  | "distribution:write"
  | "transactions:read"
  | "transactions:write"
  | "livefeeds:read"
  | "transparency:read"
  | "transparency:generate";

type PermissionRule = {
  roles: Role[];
  rateLimit?: RateLimitRule;
};

const permissionMatrix: Record<Permission, PermissionRule> = {
  "reports:create": { roles: ["survivor", "rescuer", "admin"], rateLimit: { windowMs: 60_000, max: 20 } },
  "reports:read": { roles: ["rescuer", "admin"] },
  "reports:update": { roles: ["rescuer", "admin"], rateLimit: { windowMs: 60_000, max: 40 } },
  "reports:delete": { roles: ["admin"] },
  "rescue:create": { roles: ["survivor", "rescuer", "admin"], rateLimit: { windowMs: 60_000, max: 15 } },
  "rescue:list:all": { roles: ["rescuer", "admin"] },
  "rescue:list:own": { roles: ["survivor", "rescuer", "admin"] },
  "rescue:update": { roles: ["rescuer", "admin"], rateLimit: { windowMs: 60_000, max: 45 } },
  "warehouses:read": { roles: ["rescuer", "admin"] },
  "warehouses:write": { roles: ["rescuer", "admin"] },
  "resources:read": { roles: ["rescuer", "admin"] },
  "resources:write": { roles: ["rescuer", "admin"] },
  "allocations:write": { roles: ["rescuer", "admin"], rateLimit: { windowMs: 60_000, max: 60 } },
  "distribution:write": { roles: ["rescuer", "admin"] },
  "transactions:read": { roles: ["rescuer", "admin"] },
  "transactions:write": { roles: ["admin"] },
  "livefeeds:read": { roles: ["rescuer", "admin"] },
  "transparency:read": { roles: ["rescuer", "admin"] },
  "transparency:generate": { roles: ["admin"] },
};

export function requirePermission(permission: Permission): RequestHandler {
  return function permissionGuard(req: AuthRequest, res, next) {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const rule = permissionMatrix[permission];
    if (!rule) {
      return res.status(500).json({ error: "Permission matrix misconfigured" });
    }
    if (!rule.roles.includes(user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (rule.rateLimit) {
      const key = `${user.userId}`;
      const outcome = consumeRateLimit(`perm:${permission}`, key, rule.rateLimit);
      if (!outcome.ok) {
        const retrySeconds = Math.ceil((outcome.retryAfterMs ?? 0) / 1000);
        res.setHeader("Retry-After", retrySeconds);
        return res.status(429).json({ error: "Action temporarily rate limited" });
      }
    }
    return next();
  };
}

export function isPermitted(role: Role, permission: Permission) {
  const rule = permissionMatrix[permission];
  if (!rule) return false;
  return rule.roles.includes(role);
}
