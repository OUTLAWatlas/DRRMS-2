import type { NextFunction, Request, Response } from "express";

type BucketState = { count: number; resetAt: number };
const store = new Map<string, BucketState>();

export type RateLimitRule = {
  windowMs: number;
  max: number;
};

export function consumeRateLimit(bucketId: string, key: string, rule: RateLimitRule) {
  if (rule.max <= 0) return { ok: true } as const;
  const now = Date.now();
  const bucketKey = `${bucketId}:${key}`;
  const existing = store.get(bucketKey);
  if (!existing || existing.resetAt <= now) {
    const next: BucketState = { count: 1, resetAt: now + rule.windowMs };
    store.set(bucketKey, next);
    return { ok: true } as const;
  }
  if (existing.count < rule.max) {
    existing.count += 1;
    return { ok: true } as const;
  }
  return { ok: false, retryAfterMs: Math.max(0, existing.resetAt - now) } as const;
}

export function createRateLimiter(options: {
  bucketId: string;
  rule: RateLimitRule;
  key?: (req: Request) => string;
}) {
  return function rateLimiter(req: Request, res: Response, next: NextFunction) {
    const key = options.key?.(req) ?? req.ip ?? "global";
    const result = consumeRateLimit(options.bucketId, key, options.rule);
    if (!result.ok) {
      res.setHeader("Retry-After", Math.ceil((result.retryAfterMs ?? 0) / 1000));
      return res.status(429).json({ error: "Rate limit exceeded. Please retry shortly." });
    }
    next();
  };
}
