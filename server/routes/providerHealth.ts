import { Router, type Request } from "express";
import { authMiddleware, rescuerOnly, adminOnly, type AuthRequest } from "../middleware/auth";
import { verifyAuthToken } from "../security/jwt";
import {
  getLastProviderHealthIngestedAt,
  getProviderHealthSnapshots,
  getRecentProviderHealthEvents,
  ingestProviderHealthTelemetry,
  isProviderHealthEnabled,
  registerProviderHealthStream,
  unregisterProviderHealthStream,
  writeProviderHealthStreamEvent,
} from "../services/provider-health";

const router = Router();

router.get("/", authMiddleware, rescuerOnly, async (_req: AuthRequest, res) => {
  if (!isProviderHealthEnabled()) {
    return res.status(503).json({
      featureEnabled: false,
      snapshots: [],
      events: [],
      lastIngestedAt: null,
    });
  }
  const [snapshots, events] = await Promise.all([
    getProviderHealthSnapshots(24),
    getRecentProviderHealthEvents(20),
  ]);
  return res.json({
    featureEnabled: true,
    snapshots,
    events,
    lastIngestedAt: getLastProviderHealthIngestedAt(),
  });
});

router.post("/ingest", authMiddleware, adminOnly, async (_req: AuthRequest, res) => {
  const summary = await ingestProviderHealthTelemetry();
  res.json(summary);
});

router.get("/stream", async (req, res) => {
  if (!isProviderHealthEnabled()) {
    return res.status(503).json({ error: "Provider health feed disabled" });
  }
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  let user;
  try {
    user = verifyAuthToken(token);
  } catch (error) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (user.role !== "rescuer" && user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const clientId = registerProviderHealthStream(res);

  const heartbeat = setInterval(() => {
    writeProviderHealthStreamEvent(res, { kind: "heartbeat", payload: { timestamp: Date.now() } });
  }, 25_000);

  const [snapshots, events] = await Promise.all([
    getProviderHealthSnapshots(24),
    getRecentProviderHealthEvents(10),
  ]);
  writeProviderHealthStreamEvent(res, {
    kind: "bootstrap",
    payload: {
      snapshots,
      events,
      timestamp: Date.now(),
    },
  });

  req.on("close", () => {
    clearInterval(heartbeat);
    unregisterProviderHealthStream(clientId);
  });
});

function extractToken(req: Request) {
  const header = typeof req.headers?.authorization === "string" ? req.headers.authorization : undefined;
  if (header?.startsWith("Bearer ")) {
    return header.slice("Bearer ".length).trim();
  }
  const queryValue = (req.query as Record<string, unknown> | undefined)?.token;
  const queryToken = typeof queryValue === "string" ? queryValue : Array.isArray(queryValue) ? String(queryValue[0]) : undefined;
  return queryToken ?? null;
}

export default router;
