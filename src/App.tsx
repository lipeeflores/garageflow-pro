import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { NotificationPermissionPrompt } from "@/components/notifications";
import { InstallPrompt } from "@/components/pwa";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import Agenda from "./pages/Agenda";
import Oficina from "./pages/Oficina";
import Clientes from "./pages/Clientes";
import Veiculos from "./pages/Veiculos";
import Ordens from "./pages/Ordens";
import OrdemDetalhe from "./pages/OrdemDetalhe";
import OrcamentoPublico from "./pages/OrcamentoPublico";
import Ponto from "./pages/Ponto";
import Financeiro from "./pages/Financeiro";
import Configuracoes from "./pages/Configuracoes";
import WorkshopTV from "./pages/WorkshopTV";
import ClienteHistorico from "./pages/ClienteHistorico";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <NotificationPermissionPrompt />
        <InstallPrompt />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/"
              element={
                <ProtectedRoute requiredRoles={['ADMIN', 'MANAGER']}>
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
              path="/clientes/:id"
              element={
                <ProtectedRoute requiredRoles={['ADMIN', 'MANAGER']}>
                  <ClienteHistorico />
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
            <Route
              path="/financeiro"
              element={
                <ProtectedRoute requiredRoles={['ADMIN', 'MANAGER']}>
                  <Financeiro />
                </ProtectedRoute>
              }
            />
            <Route
              path="/configuracoes"
              element={
                <ProtectedRoute requiredRoles={['ADMIN']}>
                  <Configuracoes />
                </ProtectedRoute>
              }
            />
            {/* Public routes - no auth required */}
            <Route path="/orcamento/:id" element={<OrcamentoPublico />} />
            <Route path="/tv" element={<WorkshopTV />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
