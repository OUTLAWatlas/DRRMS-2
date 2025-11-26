import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAppStore } from "@/state/app-store";

export default function RequireAuth({ children }: { children: React.ReactElement }) {
  const user = useAppStore((s) => s.user);
  const token = useAppStore((s) => s.authToken);
  const location = useLocation();

  const authenticated = !!(user || token);

  if (!authenticated) {
    const next = encodeURIComponent(location.pathname + (location.search || ""));
    return <Navigate to={`/signin?next=${next}`} replace />;
  }

  return children;
}
