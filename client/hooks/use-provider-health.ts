import { useEffect, useRef, useState } from "react";
import { apiClient } from "@/lib/apiClient";
import { useAppStore } from "@/state/app-store";
import type {
  ProviderHealthEvent,
  ProviderHealthResponse,
  ProviderHealthSnapshot,
  ProviderHealthStreamEvent,
} from "@shared/api";

const MAX_EVENTS = 25;

export function useProviderHealthFeed() {
  const token = useAppStore((state) => state.authToken);
  const [snapshots, setSnapshots] = useState<ProviderHealthSnapshot[]>([]);
  const [events, setEvents] = useState<ProviderHealthEvent[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!token) {
        setEnabled(false);
        setSnapshots([]);
        setEvents([]);
        setStreaming(false);
        setError("Authentication required");
        setLoading(false);
        closeStream();
        return;
      }

      setLoading(true);
      try {
        const response = await apiClient<ProviderHealthResponse>("/api/providers/health");
        if (cancelled) return;
        setEnabled(response.featureEnabled);
        setSnapshots(response.snapshots ?? []);
        setEvents(response.events ?? []);
        setLastUpdatedAt(response.lastIngestedAt ?? Date.now());
        setError(null);
        if (!response.featureEnabled) {
          setStreaming(false);
          setLoading(false);
          closeStream();
          return;
        }
        openStream(token);
      } catch (err) {
        if (cancelled) return;
        setEnabled(false);
        setError(err instanceof Error ? err.message : "Unable to load provider health feed");
        setStreaming(false);
        closeStream();
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    function openStream(currentToken: string) {
      closeStream();
      const streamUrl = `/api/providers/health/stream?token=${encodeURIComponent(currentToken)}`;
      const source = new EventSource(streamUrl);
      sourceRef.current = source;
      source.onopen = () => {
        if (!cancelled) {
          setStreaming(true);
          setError(null);
        }
      };
      source.onerror = () => {
        if (!cancelled) {
          setStreaming(false);
        }
      };
      source.addEventListener("provider-health", (event) => {
        if (cancelled) return;
        try {
          const payload = JSON.parse((event as MessageEvent<string>).data) as ProviderHealthStreamEvent;
          handleStreamEvent(payload);
        } catch (e) {
          console.warn("[provider-health] unable to parse stream payload", e);
        }
      });
    }

    function handleStreamEvent(payload: ProviderHealthStreamEvent) {
      switch (payload.kind) {
        case "snapshot":
          setSnapshots((prev) => upsertSnapshot(prev, payload.payload));
          setLastUpdatedAt(Date.now());
          break;
        case "event":
          setEvents((prev) => [payload.payload, ...prev].slice(0, MAX_EVENTS));
          break;
        case "roster":
          setSnapshots((prev) =>
            prev.map((snapshot) =>
              snapshot.providerId === payload.payload.providerId
                ? {
                    ...snapshot,
                    rosterLead: payload.payload.shiftOwner ?? snapshot.rosterLead,
                    rosterContact: payload.payload.contactChannel ?? snapshot.rosterContact,
                    rosterShiftStartsAt: payload.payload.shiftStartsAt ?? snapshot.rosterShiftStartsAt,
                    rosterShiftEndsAt: payload.payload.shiftEndsAt ?? snapshot.rosterShiftEndsAt,
                  }
                : snapshot,
            ),
          );
          break;
        case "bootstrap":
          setSnapshots(payload.payload.snapshots ?? []);
          setEvents(payload.payload.events ?? []);
          setLastUpdatedAt(payload.payload.timestamp ?? Date.now());
          break;
        case "heartbeat":
          setStreaming(true);
          break;
        default:
          break;
      }
    }

    function closeStream() {
      if (sourceRef.current) {
        sourceRef.current.close();
        sourceRef.current = null;
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
      closeStream();
    };
  }, [token]);

  return {
    snapshots,
    events,
    enabled,
    loading,
    streaming,
    error,
    lastUpdatedAt,
  };
}

function upsertSnapshot(
  list: ProviderHealthSnapshot[],
  incoming: ProviderHealthSnapshot,
): ProviderHealthSnapshot[] {
  const index = list.findIndex((entry) => entry.providerId === incoming.providerId);
  if (index === -1) {
    return [...list, incoming];
  }
  const next = [...list];
  next[index] = incoming;
  return next;
}
