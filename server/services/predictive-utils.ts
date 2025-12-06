import type { RescueRequest } from "../shared-api";

export function inferResourceType(details: string) {
  const lower = details.toLowerCase();
  if (/(medical|injury|hospital|clinic)/.test(lower)) return "medical kits";
  if (/(water|thirst|hydration)/.test(lower)) return "water";
  if (/(food|ration|meal)/.test(lower)) return "food";
  if (/(shelter|blanket|cold)/.test(lower)) return "blankets";
  return "general supplies";
}

export function normalizeRegion(region?: string | null) {
  if (!region) return "unknown";
  return region.split(",")[0]?.trim().toLowerCase() || "unknown";
}

export function buildStatsKey(region: string, resourceType: string) {
  return `${region}::${resourceType}`;
}

export function alertLevelScore(level?: string | null) {
  switch ((level ?? "").toLowerCase()) {
    case "warning":
      return 0.35;
    case "watch":
      return 0.2;
    case "advisory":
      return 0.1;
    default:
      return 0;
  }
}

export function deriveRequestRegion(request: Pick<RescueRequest, "location">) {
  return normalizeRegion(request.location);
}
