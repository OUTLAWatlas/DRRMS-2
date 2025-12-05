import { Router } from "express";
import { authMiddleware, AuthRequest, adminOnly } from "../middleware/auth";
import {
  getClosestWeatherReading,
  getRecentGovernmentAlerts,
  refreshLiveFeeds,
} from "../services/live-feeds";

const router = Router();

router.get("/weather", authMiddleware, async (req, res) => {
  const latValue = req.query.lat ? parseFloat(String(req.query.lat)) : undefined;
  const lonValue = req.query.lon ? parseFloat(String(req.query.lon)) : undefined;
  const latitude = typeof latValue === "number" && Number.isFinite(latValue) ? latValue : undefined;
  const longitude = typeof lonValue === "number" && Number.isFinite(lonValue) ? lonValue : undefined;
  const response = await getClosestWeatherReading(latitude, longitude);
  res.json(response);
});

router.get("/alerts", authMiddleware, async (req, res) => {
  const severityFilter = typeof req.query.severity === "string" ? req.query.severity.toLowerCase() : undefined;
  const limit = req.query.limit ? Math.min(50, Math.max(1, parseInt(String(req.query.limit), 10))) : 20;
  const alerts = await getRecentGovernmentAlerts(limit * 2);
  const filtered = severityFilter
    ? alerts.filter((alert) => alert.severity?.toLowerCase() === severityFilter).slice(0, limit)
    : alerts.slice(0, limit);
  res.json({ alerts: filtered });
});

router.post("/refresh", authMiddleware, adminOnly, async (_req: AuthRequest, res) => {
  const summary = await refreshLiveFeeds();
  res.json(summary);
});

export default router;
