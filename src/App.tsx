import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import Agenda from "./pages/Agenda";
import Oficina from "./pages/Oficina";
import Clientes from "./pages/Clientes";
import Veiculos from "./pages/Veiculos";
import Ordens from "./pages/Ordens";
import OrdemDetalhe from "./pages/OrdemDetalhe";
import Ponto from "./pages/Ponto";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/agenda"
              element={
                <ProtectedRoute>
                  <Agenda />
                </ProtectedRoute>
              }
            />
            <Route
              path="/oficina"
              element={
                <ProtectedRoute>
                  <Oficina />
                </ProtectedRoute>
              }
            />
            <Route
              path="/clientes"
              element={
                <ProtectedRoute requiredRoles={['ADMIN', 'MANAGER']}>
                  <Clientes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/veiculos"
              element={
                <ProtectedRoute>
                  <Veiculos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ordens"
              element={
                <ProtectedRoute>
                  <Ordens />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ordens/:id"
              element={
                <ProtectedRoute>
                  <OrdemDetalhe />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ponto"
              element={
                <ProtectedRoute>
                  <Ponto />
                </ProtectedRoute>
              }
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
