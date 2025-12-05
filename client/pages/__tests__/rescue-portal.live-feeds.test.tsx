import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  AlertPanel,
  CriticalAlertBanner,
  WeatherPanel,
  isHighSeverity,
  selectHighestSeverityAlert,
} from "@/pages/RescuePortal";
import { useGovernmentAlertsQuery, useLiveWeatherQuery } from "@/hooks/api-hooks";
import type {
  GovernmentAlert,
  GovernmentAlertsResponse,
  LiveWeatherReading,
  LiveWeatherResponse,
} from "@shared/api";

function makeAlert(overrides: Partial<GovernmentAlert> = {}): GovernmentAlert {
  const timestamp = Date.now();
  return {
    id: overrides.id ?? Math.floor(Math.random() * 10000),
    externalId: overrides.externalId ?? "ext-1",
    headline: overrides.headline ?? "Cyclone advisory",
    area: overrides.area ?? "Mumbai",
    severity: overrides.severity ?? "moderate",
    certainty: overrides.certainty ?? "likely",
    urgency: overrides.urgency ?? "immediate",
    source: overrides.source ?? "IMD",
    issuedAt: overrides.issuedAt ?? timestamp,
    expiresAt: overrides.expiresAt ?? timestamp + 3600_000,
    summary: overrides.summary ?? "Prepare for heavy rainfall.",
    rawPayload: overrides.rawPayload ?? null,
    status: overrides.status ?? "active",
    createdAt: overrides.createdAt ?? timestamp,
  };
}

function makeReading(overrides: Partial<LiveWeatherReading> = {}): LiveWeatherReading {
  const timestamp = Date.now();
  return {
    id: overrides.id ?? Math.floor(Math.random() * 10000),
    latitude: overrides.latitude ?? 18.5204,
    longitude: overrides.longitude ?? 73.8567,
    locationName: overrides.locationName ?? "Pune",
    temperatureC: overrides.temperatureC ?? 31,
    windSpeedKph: overrides.windSpeedKph ?? 24,
    humidity: overrides.humidity ?? 68,
    precipitationMm: overrides.precipitationMm ?? 4,
    condition: overrides.condition ?? "Humid",
    alertLevel: overrides.alertLevel ?? "high",
    source: overrides.source ?? "mock",
    recordedAt: overrides.recordedAt ?? timestamp,
    createdAt: overrides.createdAt ?? timestamp,
  };
}

function makeWeatherQuery(
  overrides: Partial<ReturnType<typeof useLiveWeatherQuery>> = {},
): ReturnType<typeof useLiveWeatherQuery> {
  return {
    data: undefined,
    error: null,
    isLoading: false,
    refetch: async () => ({}) as any,
    ...overrides,
  } as ReturnType<typeof useLiveWeatherQuery>;
}

function makeAlertsQuery(
  overrides: Partial<ReturnType<typeof useGovernmentAlertsQuery>> = {},
): ReturnType<typeof useGovernmentAlertsQuery> {
  return {
    data: undefined,
    error: null,
    isLoading: false,
    refetch: async () => ({}) as any,
    ...overrides,
  } as ReturnType<typeof useGovernmentAlertsQuery>;
}

describe("selectHighestSeverityAlert", () => {
  it("returns the alert with the highest severity", () => {
    const alerts = [
      makeAlert({ id: 1, severity: "moderate" }),
      makeAlert({ id: 2, severity: "severe" }),
      makeAlert({ id: 3, severity: "high" }),
    ];
    const result = selectHighestSeverityAlert(alerts);
    expect(result?.id).toBe(2);
  });

  it("returns null when no alerts present", () => {
    expect(selectHighestSeverityAlert([])).toBeNull();
  });
});

describe("severity helpers", () => {
  it("flags high severity alerts", () => {
    expect(isHighSeverity("high")).toBe(true);
    expect(isHighSeverity("minor")).toBe(false);
  });
});

describe("CriticalAlertBanner", () => {
  it("renders headline and severity badge", () => {
    const alert = makeAlert({ headline: "Flood warning", severity: "severe" });
    render(<CriticalAlertBanner alert={alert} isLoading={false} />);
    expect(screen.getByText("Flood warning")).toBeInTheDocument();
    expect(screen.getByText(/severe/i)).toBeInTheDocument();
  });
});

describe("WeatherPanel", () => {
  it("shows primary location details", () => {
    const weatherData: LiveWeatherResponse = {
      primary: makeReading({ locationName: "Chennai" }),
      nearby: [makeReading({ id: 100, locationName: "Hyderabad" })],
    };
    const query = makeWeatherQuery({ data: weatherData });
    render(<WeatherPanel query={query} />);
    expect(screen.getByText("Chennai")).toBeInTheDocument();
    expect(screen.getByText(/Hyderabad/)).toBeInTheDocument();
  });
});

describe("AlertPanel", () => {
  it("falls back when there are no alerts", () => {
    const data: GovernmentAlertsResponse = { alerts: [] };
    const query = makeAlertsQuery({ data });
    render(<AlertPanel query={query} />);
    expect(screen.getByText(/No government advisories/i)).toBeInTheDocument();
  });

  it("lists active alerts", () => {
    const data: GovernmentAlertsResponse = { alerts: [makeAlert({ headline: "Heatwave" })] };
    const query = makeAlertsQuery({ data });
    render(<AlertPanel query={query} />);
    expect(screen.getByText("Heatwave")).toBeInTheDocument();
  });
});
