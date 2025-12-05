import { generateTransparencyReport } from "./transparency-report";
import { recordSchedulerRun } from "./scheduler-metrics";

const INTERVAL = Number(process.env.TRANSPARENCY_REPORT_INTERVAL_MS ?? 60 * 60 * 1000);
let handle: NodeJS.Timeout | null = null;
let running = false;

export function startTransparencyReportScheduler() {
  if (process.env.DISABLE_TRANSPARENCY_REPORTS === "true") return;
  if (process.env.NODE_ENV === "test") return;
  if (handle) return;
  handle = setInterval(runCycle, Math.max(5 * 60 * 1000, INTERVAL));
  void runCycle();
}

async function runCycle() {
  if (running) return;
  running = true;
  const startedAt = Date.now();
  let success = false;
  let errorMessage: string | undefined;
  try {
    await generateTransparencyReport(startedAt);
    success = true;
  } catch (error) {
    console.error("[transparency-report] generation failed", error);
    errorMessage = error instanceof Error ? error.message : String(error);
  } finally {
    const finishedAt = Date.now();
    await recordSchedulerRun({
      name: "transparency_reporter",
      startedAt,
      finishedAt,
      success,
      errorMessage,
    });
    running = false;
  }
}
