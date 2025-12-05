import { Router } from "express";
import { authMiddleware, adminOnly } from "../middleware/auth";
import { getSchedulerHealthSummary } from "../services/scheduler-metrics";

const router = Router();

router.get("/schedulers", authMiddleware, adminOnly, async (_req, res) => {
  const summary = await getSchedulerHealthSummary();
  res.json(summary);
});

export default router;
