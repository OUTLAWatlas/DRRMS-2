import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Severity = "Low" | "Moderate" | "High" | "Critical";
export type RequestStatus = "pending" | "fulfilled" | "rejected";

export type HelpRequest = {
  id: string;
  kind: "request" | "report";
  what: string;
  where: string;
  severity: Severity;
  when: string; // ISO string
  people?: number;
  resourcesRequired?: number;
  contact?: string;
  status: RequestStatus;
};

export type Notification = { id: string; message: string; area?: string; createdAt: number };

export type WarehouseResource = {
  type: string;
  stock: number;
  distributed: number;
};

export type User = {
  id: number;
  name: string;
  email: string;
  role: "survivor" | "rescuer" | "admin";
};

type State = {
  // Auth state
  authToken: string | null;
  user: User | null;
  
  // App state
  requests: HelpRequest[];
  notifications: Notification[];
  warehouses: WarehouseResource[];
  peopleNeedingHelp: number;
  availableResources: number;
};

type Actions = {
  // Auth actions
  setToken: (token: string | null) => void;
  setUser: (user: User | null) => void;
  logout: () => void;
  
  // App actions
  submitRequest: (payload: HelpRequest) => void;
  fulfillRequest: (id: string) => void;
  rejectRequest: (id: string) => void;
  addNotification: (payload: Notification) => void;
  updateAvailableResources: (amount: number) => void;
  adjustWarehouseStock: (resource: string, delta: number) => void;
  dispatchFromWarehouse: (resource: string, amount: number) => void;
};

const initialState: State = {
  authToken: null,
  user: null,
  requests: [],
  notifications: [],
  warehouses: [
    { type: "Water", stock: 100, distributed: 0 },
    { type: "Food", stock: 500, distributed: 0 },
    { type: "Medical Kits", stock: 80, distributed: 0 },
    { type: "Blankets", stock: 200, distributed: 0 },
    { type: "Fuel", stock: 60, distributed: 0 },
  ],
  peopleNeedingHelp: 0,
  availableResources: 100,
};

export const useAppStore = create<State & Actions>()(
  persist(
    (set) => ({
      ...initialState,
      
      // Auth actions
      setToken: (token) => set({ authToken: token }),
      setUser: (user) => set({ user }),
      logout: () => set({ authToken: null, user: null }),
      
      // App actions
      submitRequest: (payload) =>
        set((state) => {
          const r = payload;
          const peopleNeedingHelp = state.peopleNeedingHelp + (r.people ?? 1);
          const notifications = [
            ...state.notifications,
            {
              id: `NTF${Date.now()}`,
              message:
                r.kind === "report"
                  ? `Disaster reported in ${r.where}. Severity: ${r.severity}`
                  : `Help requested in ${r.where}. ${r.people ?? 1} people affected`,
              area: r.where,
              createdAt: Date.now(),
            },
          ];
          return { requests: [r, ...state.requests], notifications, peopleNeedingHelp };
        }),
        
      fulfillRequest: (id) =>
        set((state) => {
          const idx = state.requests.findIndex((rq) => rq.id === id);
          if (idx === -1) return state;
          const req = state.requests[idx];
          const resourcesUsed = req.resourcesRequired ?? 1;
          const availableResources = Math.max(0, state.availableResources - resourcesUsed);
          const peopleNeedingHelp = Math.max(0, state.peopleNeedingHelp - (req.people ?? 1));
          const requests = state.requests.map((r) =>
            r.id === req.id ? { ...r, status: "fulfilled" as RequestStatus } : r,
          );
          return { requests, availableResources, peopleNeedingHelp };
        }),
        
      rejectRequest: (id) =>
        set((state) => ({
          requests: state.requests.map((r) =>
            r.id === id ? { ...r, status: "rejected" as RequestStatus } : r,
          ),
        })),
        
      addNotification: (payload) =>
        set((state) => ({
          notifications: [payload, ...state.notifications],
        })),
        
      updateAvailableResources: (amount) =>
        set({ availableResources: Math.max(0, amount) }),
        
      adjustWarehouseStock: (resource, delta) =>
        set((state) => {
          const warehouses = state.warehouses.map((w) =>
            w.type === resource ? { ...w, stock: Math.max(0, w.stock + delta) } : w,
          );
          const availableResources = Math.max(0, warehouses.reduce((sum, w) => sum + w.stock, 0));
          return { warehouses, availableResources };
        }),
        
      dispatchFromWarehouse: (resource, amount) =>
        set((state) => {
          const warehouses = state.warehouses.map((w) =>
            w.type === resource
              ? {
                  ...w,
                  stock: Math.max(0, w.stock - amount),
                  distributed: w.distributed + amount,
                }
              : w,
          );
          const availableResources = Math.max(0, warehouses.reduce((sum, w) => sum + w.stock, 0));
          return { warehouses, availableResources };
        }),
    }),
    {
      name: "drrms-store",
      partialize: (state) => ({
        authToken: state.authToken,
        user: state.user,
      }),
    },
  ),
);

export function newRequestId() {
  const n = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return `REQ${Date.now().toString().slice(-5)}${n}`;
}
