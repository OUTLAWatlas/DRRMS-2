import { create } from "zustand";
import { persist } from "zustand/middleware";

export type User = {
  id: number;
  name: string;
  email: string;
  role: "survivor" | "rescuer" | "admin";
  isApproved: boolean;
  isBlocked: boolean;
};

type State = {
  authToken: string | null;
  user: User | null;
  hydrated: boolean;
};

type Actions = {
  setToken: (token: string | null) => void;
  setUser: (user: User | null) => void;
  logout: () => void;
  setHydrated: (value: boolean) => void;
};

const initialState: State = {
  authToken: null,
  user: null,
  hydrated: typeof window === "undefined",
};

export const useAppStore = create<State & Actions>()(
  persist(
    (set) => ({
      ...initialState,
      
      setToken: (token) => set({ authToken: token }),
      setUser: (user) => set({ user }),
      logout: () => set({ authToken: null, user: null }),
      setHydrated: (value) => set({ hydrated: value }),
    }),
    {
      name: "drrms-store",
      partialize: (state) => ({
        authToken: state.authToken,
        user: state.user,
      }),
      onRehydrateStorage: () => {
        return (state, error) => {
          if (error) {
            console.error("Failed to rehydrate auth store", error);
          }
          state?.setHydrated?.(true);
        };
      },
    },
  ),
);
