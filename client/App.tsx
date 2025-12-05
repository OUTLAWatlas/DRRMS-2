import "./global.css";

import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

import SiteHeader from "@/components/SiteHeader";
import UserPortal from "./pages/UserPortal";
import RescuePortal from "./pages/RescuePortal";
import ReportPage from "./pages/ReportPage";
import RequestDashboard from "./pages/RequestDashboard";
import ResourcesPage from "./pages/ResourcesPage";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import ForgotPassword from "./pages/ForgotPassword";
import AdminPortal from "./pages/AdminPortal";
import RequireAuth from "@/components/RequireAuth";
import { useAppStore } from "@/state/app-store";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SessionAutoLogout />
            <div className="min-h-screen flex flex-col">
          <SiteHeader />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Index />} />
              <Route
                path="/user"
                element={
                  <RequireAuth allowedRoles={["survivor"]}>
                    <UserPortal />
                  </RequireAuth>
                }
              />
              <Route path="/report" element={<ReportPage />} />
              <Route path="/request" element={<RequestDashboard />} />
              <Route
                path="/resources"
                element={
                  <RequireAuth allowedRoles={["admin"]}>
                    <ResourcesPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/admin"
                element={
                  <RequireAuth allowedRoles={["admin"]}>
                    <AdminPortal />
                  </RequireAuth>
                }
              />
              <Route
                path="/rescue"
                element={
                  <RequireAuth allowedRoles={["rescuer", "admin"]}>
                    <RescuePortal />
                  </RequireAuth>
                }
              />
              <Route path="/signin" element={<SignIn />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);

function SessionAutoLogout() {
  useEffect(() => {
    const handleUnload = () => {
      useAppStore.getState().logout();
    };

    window.addEventListener("pagehide", handleUnload);
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      window.removeEventListener("pagehide", handleUnload);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, []);

  return null;
}
