import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { lazy, Suspense } from "react";
import { MeetingStateProvider } from "@/hooks/use-meeting-state";
import StickyCallBar from "@/components/StickyCallBar";
import UnboundAIChat from "@/components/UnboundAIChat";

const Index = lazy(() => import("./pages/Index"));
const AuthPage = lazy(() => import("./pages/auth/AuthPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Profile = lazy(() => import("./pages/Profile"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="dark" storageKey="meeting-assistant-theme">
      <TooltipProvider>
        <BrowserRouter>
          <AuthProvider>
            <MeetingStateProvider>
              <StickyCallBar />
              <UnboundAIChat />
              <Toaster />
              <Sonner />
              <Suspense fallback={<div>Loading...</div>}>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/auth/*" element={<AuthPage />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </MeetingStateProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
