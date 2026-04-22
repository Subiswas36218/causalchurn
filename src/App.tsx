import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { DatasetProvider } from "@/hooks/useDataset";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Index from "./pages/Index";
import AuthPage from "./pages/Auth";
import UploadPage from "./pages/Upload";
import Dashboard from "./pages/Dashboard";
import Insights from "./pages/Insights";
import Uplift from "./pages/Uplift";
import Recommendations from "./pages/Recommendations";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <DatasetProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/upload" element={<UploadPage />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/insights" element={<Insights />} />
                <Route path="/uplift" element={<Uplift />} />
                <Route path="/recommendations" element={<Recommendations />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </DatasetProvider>
        </AuthProvider>
      </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
