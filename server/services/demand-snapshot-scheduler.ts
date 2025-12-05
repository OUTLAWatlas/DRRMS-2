import { generateDemandFeatureSnapshot } from "./demand-snapshot";
import { recordSchedulerRun } from "./scheduler-metrics";

const DEFAULT_INTERVAL_MS = Number(process.env.DEMAND_SNAPSHOT_INTERVAL_MS ?? 15 * 60 * 1000);
let schedulerHandle: NodeJS.Timeout | null = null;
let inProgress = false;

export function startDemandSnapshotScheduler() {
  if (process.env.DISABLE_DEMAND_SNAPSHOT === "true") return;
  if (process.env.NODE_ENV === "test") return;
  if (schedulerHandle) return;

  schedulerHandle = setInterval(runCycle, DEFAULT_INTERVAL_MS);
  void runCycle();
}

async function runCycle() {
  if (inProgress) return;
  inProgress = true;
  const startedAt = Date.now();
  let success = false;
  let errorMessage: string | undefined;
  try {
    await generateDemandFeatureSnapshot();
    success = true;
  } catch (error) {
    console.error("[demand-snapshot] generation failed", error);
    errorMessage = error instanceof Error ? error.message : String(error);
  } finally {
    const finishedAt = Date.now();
    await recordSchedulerRun({
      name: "demand_snapshotter",
      startedAt,
      finishedAt,
      success,
      errorMessage,
    });
    inProgress = false;
  }
}
