import "./global.css";

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
import RequireAuth from "@/components/RequireAuth";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <div className="min-h-screen flex flex-col">
          <SiteHeader />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/user" element={<RequireAuth><UserPortal /></RequireAuth>} />
              <Route path="/report" element={<ReportPage />} />
              <Route path="/request" element={<RequestDashboard />} />
              <Route path="/resources" element={<ResourcesPage />} />
              <Route path="/rescue" element={<RequireAuth><RescuePortal /></RequireAuth>} />
              <Route path="/signin" element={<SignIn />} />
              <Route path="/signup" element={<SignUp />} />
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
