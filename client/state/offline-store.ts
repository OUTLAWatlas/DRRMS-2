import { create } from "zustand";
import {
  clearOfflineStorage,
  fetchOfflineSnapshot,
  replaceSliceRecords,
  type OfflineSlice,
  type SliceRecordMap,
  type OfflineRescueRequest,
  type OfflineResource,
  type OfflineResourceAllocation,
} from "@/lib/offline-db";

type HydrationStatus = "idle" | "hydrating" | "hydrated" | "error";

type OfflineState = {
  rescueRequests: OfflineRescueRequest[];
  resources: OfflineResource[];
  allocations: OfflineResourceAllocation[];
  hydrationStatus: HydrationStatus;
  hydrationError: string | null;
  lastHydratedAt: number | null;
};

type OfflineActions = {
  hydrateFromStorage: () => Promise<void>;
  replaceSlice: <K extends OfflineSlice>(slice: K, records: SliceRecordMap[K]) => Promise<void>;
  clearOfflineCache: () => Promise<void>;
};

const initialState: OfflineState = {
  rescueRequests: [],
  resources: [],
  allocations: [],
  hydrationStatus: typeof window === "undefined" ? "hydrated" : "idle",
  hydrationError: null,
  lastHydratedAt: null,
};

export const useOfflineStore = create<OfflineState & OfflineActions>()((set, get) => ({
  ...initialState,
  hydrateFromStorage: async () => {
    const status = get().hydrationStatus;
    if (status === "hydrated" || status === "hydrating") {
      return;
    }

    set({ hydrationStatus: "hydrating", hydrationError: null });
    try {
      const snapshot = await fetchOfflineSnapshot();
      set({
        ...snapshot,
        hydrationStatus: "hydrated",
        hydrationError: null,
        lastHydratedAt: Date.now(),
      });
    } catch (error) {
      set({
        hydrationStatus: "error",
        hydrationError: error instanceof Error ? error.message : "Failed to load offline data",
      });
    }
  },
  replaceSlice: async (slice, records) => {
    await replaceSliceRecords(slice, records);
    set({
      [slice]: records,
      lastHydratedAt: Date.now(),
    } as Partial<OfflineState>);
  },
  clearOfflineCache: async () => {
    await clearOfflineStorage();
    set({ ...initialState });
  },
}));
