import { refreshLiveFeeds } from "./live-feeds";
import { recordSchedulerRun } from "./scheduler-metrics";

const DEFAULT_INTERVAL_MS = Number(process.env.LIVE_FEED_REFRESH_INTERVAL_MS ?? 5 * 60 * 1000);
let schedulerHandle: NodeJS.Timeout | null = null;
let isRunning = false;

export function startLiveFeedScheduler() {
  if (schedulerHandle || shouldSkipScheduler()) return;
  console.info(
    `[live-feeds] scheduler enabled | interval=${DEFAULT_INTERVAL_MS / 1000}s`
  );
  triggerRefresh();
  schedulerHandle = setInterval(triggerRefresh, DEFAULT_INTERVAL_MS);
}

export function stopLiveFeedScheduler() {
  if (schedulerHandle) {
    clearInterval(schedulerHandle);
    schedulerHandle = null;
  }
}

function shouldSkipScheduler() {
  return (
    process.env.LIVE_FEED_DISABLE_SCHEDULER === "true" ||
    process.env.NODE_ENV === "test"
  );
}

async function triggerRefresh() {
  if (isRunning) return;
  isRunning = true;
  const startedAt = Date.now();
  let success = false;
  let errorMessage: string | undefined;
  try {
    await refreshLiveFeeds();
    success = true;
  } catch (error) {
    console.error("[live-feeds] scheduled refresh failed", error);
    errorMessage = error instanceof Error ? error.message : String(error);
  } finally {
    const finishedAt = Date.now();
    await recordSchedulerRun({
      name: "live_feed_refresh",
      startedAt,
      finishedAt,
      success,
      errorMessage,
    });
    isRunning = false;
  }
}
