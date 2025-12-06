import Dexie, { type Table } from "dexie";
import type { RescueRequest, Resource, ResourceAllocation } from "@shared/api";

const DB_NAME = "drrms-offline";
const DB_VERSION = 1;

export type OfflineRescueRequest = RescueRequest & { version?: number };
export type OfflineResource = Resource & { version?: number };
export type OfflineResourceAllocation = ResourceAllocation & { version?: number };
export type OfflineSlice = "rescueRequests" | "resources" | "allocations";

export type SliceRecordMap = {
  rescueRequests: OfflineRescueRequest[];
  resources: OfflineResource[];
  allocations: OfflineResourceAllocation[];
};

export type SyncMetadata = {
  slice: OfflineSlice;
  lastPulledAt: number | null;
  lastPushedAt: number | null;
  lastVersion: number | null;
};

class OfflineDatabase extends Dexie {
  rescueRequests!: Table<OfflineRescueRequest, number>;
  resources!: Table<OfflineResource, number>;
  allocations!: Table<OfflineResourceAllocation, number>;
  syncState!: Table<SyncMetadata, string>;

  constructor() {
    super(DB_NAME);
    this.version(DB_VERSION).stores({
      rescueRequests: "id,updatedAt,version,status,priority",
      resources: "id,updatedAt,version,type,warehouseId",
      allocations: "id,updatedAt,version,requestId,resourceId",
      syncState: "&slice",
    });
  }
}

let dbInstance: OfflineDatabase | null = null;

const isIndexedDbAvailable = () =>
  typeof window !== "undefined" && typeof indexedDB !== "undefined";

export const getOfflineDb = () => {
  if (!isIndexedDbAvailable()) {
    return null;
  }

  if (!dbInstance) {
    dbInstance = new OfflineDatabase();
  }

  return dbInstance;
};

type SliceRecord<K extends OfflineSlice> = SliceRecordMap[K] extends Array<infer R> ? R : never;

const resolveTable = <K extends OfflineSlice>(db: OfflineDatabase, slice: K): Table<SliceRecord<K>, number> => {
  switch (slice) {
    case "rescueRequests":
      return db.rescueRequests as Table<SliceRecord<K>, number>;
    case "resources":
      return db.resources as Table<SliceRecord<K>, number>;
    case "allocations":
      return db.allocations as Table<SliceRecord<K>, number>;
    default:
      return db.rescueRequests as Table<SliceRecord<K>, number>;
  }
};

export const fetchOfflineSnapshot = async (): Promise<SliceRecordMap> => {
  const db = getOfflineDb();
  if (!db) {
    return {
      rescueRequests: [],
      resources: [],
      allocations: [],
    };
  }

  const [rescueRequests, resources, allocations] = await Promise.all([
    db.rescueRequests.toArray(),
    db.resources.toArray(),
    db.allocations.toArray(),
  ]);

  return { rescueRequests, resources, allocations };
};

export const replaceSliceRecords = async <K extends OfflineSlice>(
  slice: K,
  records: SliceRecordMap[K],
): Promise<void> => {
  const db = getOfflineDb();
  if (!db) {
    return;
  }

  const table = resolveTable(db, slice);
  await table.clear();
  if (records.length) {
    await table.bulkPut(records as SliceRecord<K>[]);
  }
};

export const clearOfflineStorage = async () => {
  const db = getOfflineDb();
  if (!db) {
    return;
  }
  await Promise.all([
    db.rescueRequests.clear(),
    db.resources.clear(),
    db.allocations.clear(),
    db.syncState.clear(),
  ]);
};
