import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAppStore, type User } from "@/state/app-store";

type RequireAuthProps = {
  children: React.ReactElement;
  allowedRoles?: User["role"][];
};

const ROLE_HOME: Record<User["role"], string> = {
  survivor: "/user",
  rescuer: "/rescue",
  admin: "/resources",
};

export default function RequireAuth({ children, allowedRoles }: RequireAuthProps) {
  const user = useAppStore((s) => s.user);
  const token = useAppStore((s) => s.authToken);
  const hydrated = useAppStore((s) => s.hydrated);
  const location = useLocation();

  if (!hydrated) {
    return (
      <div className="flex h-full w-full items-center justify-center py-10 text-sm text-muted-foreground">
        Restoring your secure session…
      </div>
    );
  }

  const authenticated = Boolean(token && user);

  if (!authenticated) {
    const next = encodeURIComponent(location.pathname + (location.search || ""));
    return <Navigate to={`/signin?next=${next}`} replace />;
  }

  if (user && allowedRoles && !allowedRoles.includes(user.role)) {
    const destination = ROLE_HOME[user.role] ?? "/";
    return <Navigate to={destination} replace />;
  }

  return children;
}
