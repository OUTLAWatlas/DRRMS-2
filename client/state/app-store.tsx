import { createContext, useContext, useMemo, useReducer } from "react";

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

type State = {
  requests: HelpRequest[];
  notifications: Notification[];
  warehouses: WarehouseResource[];
  peopleNeedingHelp: number;
  availableResources: number;
};

type Action =
  | { type: "SUBMIT_REQUEST"; payload: HelpRequest }
  | { type: "FULFILL_REQUEST"; id: string }
  | { type: "REJECT_REQUEST"; id: string }
  | { type: "ADD_NOTIFICATION"; payload: Notification }
  | { type: "UPDATE_AVAILABLE_RESOURCES"; amount: number }
  | { type: "ADJUST_WAREHOUSE_STOCK"; resource: string; delta: number }
  | { type: "DISPATCH_FROM_WAREHOUSE"; resource: string; amount: number };

const initialState: State = {
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

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SUBMIT_REQUEST": {
      const r = action.payload;
      const peopleNeedingHelp = state.peopleNeedingHelp + (r.people ?? 1);
      const notifications = [
        ...state.notifications,
        {
          id: `NTF${Date.now()}`,
          message:
            r.kind === "report"
              ? `Disaster reported in ${r.where}. Severity: ${r.severity}`
              : `Help requested in ${r.where}. ${r.people ?? 1} people affected` ,
          area: r.where,
          createdAt: Date.now(),
        },
      ];
      return { ...state, requests: [r, ...state.requests], notifications, peopleNeedingHelp };
    }
    case "FULFILL_REQUEST": {
      const idx = state.requests.findIndex((rq) => rq.id === action.id);
      if (idx === -1) return state;
      const req = state.requests[idx];
      const resourcesUsed = req.resourcesRequired ?? 1;
      const availableResources = Math.max(0, state.availableResources - resourcesUsed);
      const peopleNeedingHelp = Math.max(0, state.peopleNeedingHelp - (req.people ?? 1));
      const requests = state.requests.map((r) => (r.id === req.id ? { ...r, status: "fulfilled" } : r));
      return { ...state, requests, availableResources, peopleNeedingHelp };
    }
    case "REJECT_REQUEST": {
      const requests = state.requests.map((r) => (r.id === action.id ? { ...r, status: "rejected" } : r));
      return { ...state, requests };
    }
    case "ADD_NOTIFICATION": {
      return { ...state, notifications: [action.payload, ...state.notifications] };
    }
    case "UPDATE_AVAILABLE_RESOURCES": {
      return { ...state, availableResources: Math.max(0, action.amount) };
    }
    case "ADJUST_WAREHOUSE_STOCK": {
      const warehouses = state.warehouses.map((w) =>
        w.type === action.resource ? { ...w, stock: Math.max(0, w.stock + action.delta) } : w,
      );
      const availableResources = Math.max(0, warehouses.reduce((sum, w) => sum + w.stock, 0));
      return { ...state, warehouses, availableResources };
    }
    case "DISPATCH_FROM_WAREHOUSE": {
      const warehouses = state.warehouses.map((w) =>
        w.type === action.resource
          ? {
              ...w,
              stock: Math.max(0, w.stock - action.amount),
              distributed: w.distributed + action.amount,
            }
          : w,
      );
      const availableResources = Math.max(0, warehouses.reduce((sum, w) => sum + w.stock, 0));
      return { ...state, warehouses, availableResources };
    }
    default:
      return state;
  }
}

const Ctx = createContext<{
  state: State;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAppStore must be used within AppStoreProvider");
  return c;
}

export function newRequestId() {
  const n = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return `REQ${Date.now().toString().slice(-5)}${n}`;
}
