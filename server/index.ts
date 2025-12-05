import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import authRoutes from "./routes/auth";
import reportRoutes from "./routes/reports";
import rescueRequestRoutes from "./routes/rescueRequests";
import warehouseRoutes from "./routes/warehouses";
import resourceRoutes from "./routes/resources";
import allocationRoutes from "./routes/allocations";
import resourceTransferRoutes from "./routes/resourceTransfers";
import distributionLogRoutes from "./routes/distributionLogs";
import prioritizationRoutes from "./routes/prioritization";
import transactionRoutes from "./routes/transactions";
import liveFeedRoutes from "./routes/liveFeeds";
import geoRoutes from "./routes/geospatial";
import predictiveRoutes from "./routes/predictive";
import healthRoutes from "./routes/health";
import transparencyRoutes from "./routes/transparency";
import userRoutes from "./routes/users";
import { startLiveFeedScheduler } from "./services/live-feed-scheduler";
import { startPredictiveAllocationScheduler } from "./services/predictive-allocation";
import { startDemandSnapshotScheduler } from "./services/demand-snapshot-scheduler";
import { startTransparencyReportScheduler } from "./services/transparency-report-scheduler";

export function createServer() {
  const app = express();
  app.set("trust proxy", 1);

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use((req, res, next) => {
    res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  });

  if (process.env.ENFORCE_HTTPS !== "false") {
    app.use((req, res, next) => {
      const forwarded = (req.headers["x-forwarded-proto"] as string | undefined)?.toLowerCase();
      const isSecure = req.secure || forwarded === "https";
      if (!isSecure && process.env.NODE_ENV === "production") {
        return res.status(426).json({ error: "HTTPS is required" });
      }
      return next();
    });
  }

  // API routes
  app.use("/api/auth", authRoutes);
  app.use("/api/reports", reportRoutes);
  app.use("/api/rescue-requests", rescueRequestRoutes);
  app.use("/api/warehouses", warehouseRoutes);
  app.use("/api/resources", resourceRoutes);
  app.use("/api/allocations", allocationRoutes);
  app.use("/api/resource-transfers", resourceTransferRoutes);
  app.use("/api/distribution-logs", distributionLogRoutes);
  app.use("/api/priorities", prioritizationRoutes);
  app.use("/api/transactions", transactionRoutes);
  app.use("/api/live-feeds", liveFeedRoutes);
  app.use("/api/geo", geoRoutes);
  app.use("/api/predictive", predictiveRoutes);
  app.use("/api/health", healthRoutes);
  app.use("/api/transparency", transparencyRoutes);
  app.use("/api/users", userRoutes);

  startLiveFeedScheduler();
  startPredictiveAllocationScheduler();
  startDemandSnapshotScheduler();
  startTransparencyReportScheduler();

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  // Basic error handler
  app.use((err: any, _req, res, _next) => {
    console.error(err?.stack || err);
    res.status(500).send("Something broke!");
  });

  return app;
}
