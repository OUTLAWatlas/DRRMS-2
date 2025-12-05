import { createHash } from "node:crypto";
import { liveWeatherReadings, governmentAlerts } from "../db/schema";
import { getDb } from "../db";
import { desc, lt, sql } from "drizzle-orm";

const WEATHER_RETENTION_MS = 1000 * 60 * 60 * 6; // 6 hours
const ALERT_RETENTION_MS = 1000 * 60 * 60 * 24 * 3; // 3 days
const DEFAULT_RETRIES = Number(process.env.LIVE_FEED_MAX_RETRIES ?? 2);
const RETRY_DELAY_MS = Number(process.env.LIVE_FEED_RETRY_DELAY_MS ?? 1500);

const DEFAULT_LOCATIONS = [
  { locationName: "Mumbai", latitude: 19.076, longitude: 72.8777 },
  { locationName: "Pune", latitude: 18.5204, longitude: 73.8567 },
  { locationName: "Nagpur", latitude: 21.1458, longitude: 79.0882 },
  { locationName: "Nashik", latitude: 19.9975, longitude: 73.7898 },
  { locationName: "Aurangabad", latitude: 19.8762, longitude: 75.3433 },
];

type WeatherInsert = typeof liveWeatherReadings.$inferInsert;
type AlertInsert = typeof governmentAlerts.$inferInsert;

type WeatherProvider = {
  name: "mock" | "openweather" | "openmeteo";
  fetchReadings(): Promise<WeatherInsert[]>;
};

type AlertProvider = {
  name: "mock" | "feed" | "weather-gov";
  fetchAlerts(): Promise<AlertInsert[]>;
};

class MockWeatherProvider implements WeatherProvider {
  name: WeatherProvider["name"] = "mock";

  async fetchReadings(): Promise<WeatherInsert[]> {
    const now = Date.now();
    return DEFAULT_LOCATIONS.map((loc, idx) => ({
      locationName: loc.locationName,
      latitude: loc.latitude,
      longitude: loc.longitude,
      temperatureC: 24 + (idx % 3) * 1.5,
      windSpeedKph: 5 + idx,
      humidity: 60 + (idx % 4) * 5,
      precipitationMm: idx % 2 === 0 ? 2 : 0,
      condition: idx % 2 === 0 ? "Scattered showers" : "Humid",
      alertLevel: idx % 2 === 0 ? "watch" : "normal",
      source: "mock",
      recordedAt: new Date(now - idx * 15 * 60 * 1000),
    }));
  }
}

class OpenWeatherProvider implements WeatherProvider {
  name: WeatherProvider["name"] = "openweather";
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly maxRetries: number;

  constructor(apiKey: string, apiUrl = "https://api.openweathermap.org/data/2.5/weather", maxRetries = DEFAULT_RETRIES) {
    this.apiKey = apiKey;
    this.apiUrl = apiUrl;
    this.maxRetries = Math.max(0, maxRetries);
  }

  async fetchReadings(): Promise<WeatherInsert[]> {
    const readings: WeatherInsert[] = [];
    for (const loc of DEFAULT_LOCATIONS) {
      try {
        const data = await runWithRetries(async () => {
          const url = new URL(this.apiUrl);
          url.searchParams.set("lat", String(loc.latitude));
          url.searchParams.set("lon", String(loc.longitude));
          url.searchParams.set("appid", this.apiKey);
          url.searchParams.set("units", "metric");
          const response = await fetch(url);
          if (!response.ok) throw new Error(`Weather API returned ${response.status}`);
          return (await response.json()) as any;
        }, this.maxRetries, `openweather:${loc.locationName}`);
        readings.push({
          locationName: data?.name || loc.locationName,
          latitude: loc.latitude,
          longitude: loc.longitude,
          temperatureC: typeof data?.main?.temp === "number" ? data.main.temp : null,
          windSpeedKph: typeof data?.wind?.speed === "number" ? data.wind.speed * 3.6 : null,
          humidity: typeof data?.main?.humidity === "number" ? data.main.humidity : null,
          precipitationMm: typeof data?.rain?.["1h"] === "number" ? data.rain["1h"] : null,
          condition: data?.weather?.[0]?.description ?? null,
          alertLevel: mapAlertLevel(data),
          source: "openweather",
          recordedAt: new Date(data?.dt ? data.dt * 1000 : Date.now()),
        });
      } catch (error) {
        console.warn("Weather provider failed, falling back to mock value", error);
      }
    }
    if (!readings.length) {
      return new MockWeatherProvider().fetchReadings();
    }
    return readings;
  }
}

class OpenMeteoProvider implements WeatherProvider {
  name: WeatherProvider["name"] = "openmeteo";
  private readonly apiUrl: string;

  constructor(apiUrl = "https://api.open-meteo.com/v1/forecast") {
    this.apiUrl = apiUrl;
  }

  async fetchReadings(): Promise<WeatherInsert[]> {
    const readings: WeatherInsert[] = [];
    for (const loc of DEFAULT_LOCATIONS) {
      try {
        const url = new URL(this.apiUrl);
        url.searchParams.set("latitude", String(loc.latitude));
        url.searchParams.set("longitude", String(loc.longitude));
        url.searchParams.set("current", "temperature_2m,relative_humidity_2m,precipitation,rain,showers,wind_speed_10m");
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Open-Meteo returned ${response.status}`);
        const data = (await response.json()) as any;
        const current = data?.current;
        const recordedAt = current?.time ? new Date(current.time) : new Date();
        readings.push({
          locationName: current?.time ? `${loc.locationName}` : loc.locationName,
          latitude: loc.latitude,
          longitude: loc.longitude,
          temperatureC: typeof current?.temperature_2m === "number" ? current.temperature_2m : null,
          windSpeedKph: typeof current?.wind_speed_10m === "number" ? current.wind_speed_10m : null,
          humidity: typeof current?.relative_humidity_2m === "number" ? current.relative_humidity_2m : null,
          precipitationMm:
            typeof current?.precipitation === "number"
              ? current.precipitation
              : typeof current?.rain === "number"
                ? current.rain
                : typeof current?.showers === "number"
                  ? current.showers
                  : null,
          condition: mapOpenMeteoCondition(current?.weather_code),
          alertLevel: mapAlertLevelFromCode(current?.weather_code),
          source: "openmeteo",
          recordedAt,
        });
      } catch (error) {
        console.warn("Open-Meteo provider failed, falling back to mock", error);
        return new MockWeatherProvider().fetchReadings();
      }
    }
    return readings;
  }
}

class MockAlertProvider implements AlertProvider {
  name: AlertProvider["name"] = "mock";

  async fetchAlerts(): Promise<AlertInsert[]> {
    const now = Date.now();
    return [
      {
        externalId: `mock-${now}`,
        headline: "Simulated flood advisory",
        area: "Konkan Coast",
        severity: "Severe",
        certainty: "Likely",
        urgency: "Immediate",
        source: "mock",
        issuedAt: new Date(now),
        expiresAt: new Date(now + 4 * 60 * 60 * 1000),
        summary: "Heavy rainfall expected. Pre-position resources near coastal districts.",
        rawPayload: null,
        status: "active",
      },
    ];
  }
}

class FeedAlertProvider implements AlertProvider {
  name: AlertProvider["name"] = "feed";
  constructor(private readonly feedUrl: string, private readonly maxRetries = DEFAULT_RETRIES) {}

  async fetchAlerts(): Promise<AlertInsert[]> {
    try {
      const payload = await runWithRetries(async () => {
        const response = await fetch(this.feedUrl);
        if (!response.ok) throw new Error(`Alert feed returned ${response.status}`);
        return response.text();
      }, this.maxRetries, "alert-feed");
      const hash = createHash("sha256").update(payload).digest("hex").slice(0, 24);
      const issued = Date.now();
      return [
        {
          externalId: hash,
          headline: "External alert feed update",
          area: null,
          severity: null,
          certainty: null,
          urgency: null,
          source: this.feedUrl,
          issuedAt: new Date(issued),
          expiresAt: new Date(issued + 6 * 60 * 60 * 1000),
          summary: "Raw feed data ingested. See payload for specifics.",
          rawPayload: payload,
          status: "active",
        },
      ];
    } catch (error) {
      console.warn("Alert provider failed, falling back to mock", error);
      return new MockAlertProvider().fetchAlerts();
    }
  }
}

class WeatherGovAlertProvider implements AlertProvider {
  name: AlertProvider["name"] = "weather-gov";
  private readonly baseUrl: string;
  private readonly area?: string;
  private readonly limit: number;
  private readonly userAgent: string;

  constructor({ baseUrl, area, limit, userAgent }: { baseUrl?: string; area?: string; limit?: number; userAgent?: string }) {
    this.baseUrl = baseUrl ?? "https://api.weather.gov/alerts/active";
    this.area = area;
    this.limit = Math.max(1, Math.min(limit ?? 10, 50));
    this.userAgent = userAgent ?? "drrms.live-feeds/1.0 (support@drrms.org)";
  }

  async fetchAlerts(): Promise<AlertInsert[]> {
    const url = new URL(this.baseUrl);
    url.searchParams.set("limit", String(this.limit));
    if (this.area) url.searchParams.set("area", this.area);
    const response = await fetch(url, {
      headers: { "User-Agent": this.userAgent, Accept: "application/geo+json" },
    });
    if (!response.ok) throw new Error(`weather.gov feed returned ${response.status}`);
    const data = (await response.json()) as any;
    const features: any[] = data?.features ?? [];
    return features.map((feature) => {
      const props = feature?.properties ?? {};
      const issuedAt = props.sent ? new Date(props.sent) : null;
      const expiresAt = props.expires ? new Date(props.expires) : null;
      return {
        externalId: feature?.id ?? createHash("sha1").update(JSON.stringify(feature)).digest("hex"),
        headline: props.headline ?? props.event ?? "Weather alert",
        area: props.areaDesc ?? props.region ?? null,
        severity: props.severity ?? null,
        certainty: props.certainty ?? null,
        urgency: props.urgency ?? null,
        source: props.senderName ?? "weather.gov",
        issuedAt,
        expiresAt,
        summary: props.description ?? props.instruction ?? null,
        rawPayload: JSON.stringify(feature),
        status: props.status?.toLowerCase() ?? "active",
      } satisfies AlertInsert;
    });
  }
}

function buildWeatherProvider(): WeatherProvider {
  const apiKey = process.env.WEATHER_API_KEY;
  const provider = (process.env.WEATHER_PROVIDER ?? "").toLowerCase();
  if (apiKey && (provider === "openweather" || provider === "" || provider === undefined)) {
    return new OpenWeatherProvider(apiKey, process.env.WEATHER_API_URL, DEFAULT_RETRIES);
  }
  if (provider === "mock") {
    return new MockWeatherProvider();
  }
  if (!apiKey && provider === "openweather") {
    console.warn("WEATHER_PROVIDER=openweather but WEATHER_API_KEY missing. Falling back to Open-Meteo.");
  }
  return new OpenMeteoProvider(process.env.WEATHER_API_URL);
}

function buildAlertProvider(): AlertProvider {
  const feedUrl = process.env.GOV_ALERT_FEED_URL;
  if (feedUrl) {
    return new FeedAlertProvider(feedUrl, DEFAULT_RETRIES);
  }
  if (process.env.GOV_ALERT_FEED_URL === "") {
    console.warn("Empty GOV_ALERT_FEED_URL detected; using built-in weather.gov provider.");
  }
  const provider = (process.env.GOV_ALERT_PROVIDER ?? "weather-gov").toLowerCase();
  if (provider === "mock") {
    return new MockAlertProvider();
  }
  if (provider === "feed") {
    console.warn("GOV_ALERT_PROVIDER=feed requires GOV_ALERT_FEED_URL. Falling back to weather.gov provider.");
  }
  return new WeatherGovAlertProvider({
    baseUrl: process.env.GOV_ALERT_BASE_URL,
    area: process.env.GOV_ALERT_REGION,
    limit: process.env.GOV_ALERT_LIMIT ? Number(process.env.GOV_ALERT_LIMIT) : undefined,
    userAgent: process.env.GOV_ALERT_USER_AGENT,
  });
}

function mapAlertLevel(data: any): string {
  const code = data?.weather?.[0]?.main?.toLowerCase?.() ?? "";
  if (code.includes("storm") || code.includes("rain")) return "watch";
  if (code.includes("extreme")) return "warning";
  return "normal";
}

function mapOpenMeteoCondition(code?: number) {
  if (typeof code !== "number") return null;
  const mapping: Record<number, string> = {
    0: "Clear",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    95: "Thunderstorm",
  };
  return mapping[code] ?? "Unknown";
}

function mapAlertLevelFromCode(code?: number) {
  if (typeof code !== "number") return "normal";
  if ([63, 65, 95, 96, 99].includes(code)) return "warning";
  if ([53, 55, 61, 71, 73, 77].includes(code)) return "watch";
  return "normal";
}

async function runWithRetries<T>(operation: () => Promise<T>, retries: number, label: string): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await operation();
    } catch (error) {
      attempt += 1;
      if (attempt > retries) {
        throw error;
      }
      const delay = RETRY_DELAY_MS * attempt;
      console.warn(`[live-feeds] ${label} attempt ${attempt} failed:`, error);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export async function refreshLiveFeeds(now = new Date()) {
  const weatherProvider = buildWeatherProvider();
  const alertProvider = buildAlertProvider();
  const [weatherReadings, alerts] = await Promise.all([
    weatherProvider.fetchReadings().catch((err) => {
      console.warn("Weather refresh failed", err);
      return [] as WeatherInsert[];
    }),
    alertProvider.fetchAlerts().catch((err) => {
      console.warn("Alert refresh failed", err);
      return [] as AlertInsert[];
    }),
  ]);

  const db = getDb();
  if (weatherReadings.length) {
    await db.insert(liveWeatherReadings).values(weatherReadings);
    await db
      .delete(liveWeatherReadings)
      .where(lt(liveWeatherReadings.recordedAt, new Date(now.getTime() - WEATHER_RETENTION_MS)));
  }

  if (alerts.length) {
    for (const alert of alerts) {
      await db
        .insert(governmentAlerts)
        .values(alert)
        .onConflictDoUpdate({
          target: governmentAlerts.externalId,
          set: {
            headline: alert.headline,
            area: alert.area ?? null,
            severity: alert.severity ?? null,
            certainty: alert.certainty ?? null,
            urgency: alert.urgency ?? null,
            source: alert.source,
            issuedAt: alert.issuedAt ?? null,
            expiresAt: alert.expiresAt ?? null,
            summary: alert.summary ?? null,
            rawPayload: alert.rawPayload ?? null,
            status: alert.status,
          },
        });
    }
    await db
      .delete(governmentAlerts)
      .where(lt(governmentAlerts.issuedAt, new Date(now.getTime() - ALERT_RETENTION_MS)));
  }

  const result = {
    weatherInserted: weatherReadings.length,
    alertsUpserted: alerts.length,
    provider: weatherProvider.name === "mock" && alertProvider.name === "mock" ? "mock" : "live",
    refreshedAt: now.getTime(),
  };
  console.info(
    `[live-feeds] refresh complete | provider=${result.provider} weather=${result.weatherInserted} alerts=${result.alertsUpserted}`,
  );
  return result;
}

export async function getLatestWeatherReadings(limit = 10) {
  const db = getDb();
  return db
    .select()
    .from(liveWeatherReadings)
    .orderBy(desc(liveWeatherReadings.recordedAt))
    .limit(limit);
}

export async function getClosestWeatherReading(latitude?: number, longitude?: number) {
  const readings = await getLatestWeatherReadings(25);
  if (latitude === undefined || longitude === undefined || !readings.length) {
    return { primary: readings[0] ?? null, nearby: readings };
  }
  const sorted = readings
    .map((reading) => ({
      reading,
      distance: haversineDistance(latitude, longitude, reading.latitude, reading.longitude),
    }))
    .sort((a, b) => a.distance - b.distance);
  return {
    primary: sorted[0]?.reading ?? null,
    nearby: sorted.slice(0, 10).map((item) => item.reading),
  };
}

export async function getRecentGovernmentAlerts(limit = 20) {
  const db = getDb();
  return db
    .select()
    .from(governmentAlerts)
    .orderBy(desc(sql`COALESCE(${governmentAlerts.issuedAt}, ${governmentAlerts.createdAt})`))
    .limit(limit);
}

function haversineDistance(lat1?: number | null, lon1?: number | null, lat2?: number | null, lon2?: number | null) {
  if (
    lat1 === undefined ||
    lon1 === undefined ||
    lat2 === undefined ||
    lon2 === undefined ||
    lat1 === null ||
    lon1 === null ||
    lat2 === null ||
    lon2 === null
  ) {
    return Number.POSITIVE_INFINITY;
  }
  const R = 6371; // km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}
