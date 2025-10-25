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

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API routes
  app.use("/api/auth", authRoutes);
  app.use("/api/reports", reportRoutes);
  app.use("/api/rescue-requests", rescueRequestRoutes);
  app.use("/api/warehouses", warehouseRoutes);
  app.use("/api/resources", resourceRoutes);
  app.use("/api/allocations", allocationRoutes);

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
