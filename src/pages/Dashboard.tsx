import { AppLayout } from "@/components/layout";
import {
  StatsCard,
  WorkflowKanban,
  TodaySchedule,
  MechanicRanking,
  PendingTasksAlert,
} from "@/components/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Car,
  Clock,
  DollarSign,
  FileText,
  Plus,
  Calendar,
  TrendingUp,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { WorkOrderFormDialog } from "@/components/forms";
import { useDashboardStats, formatDuration, formatCurrency } from "@/hooks/useDashboardStats";

export default function Dashboard() {
  const { isAdminOrManager } = useAuth();
  const { data: stats, isLoading } = useDashboardStats();

  const activeOrders = stats?.activeOrders ?? 0;
  const pendingBudget = stats?.pendingBudget ?? 0;
  const todayVehicles = stats?.todayVehicles ?? 0;
  const arrivedVehicles = stats?.arrivedVehicles ?? 0;
  const avgTimePerOS = stats?.avgTimePerOS ?? 0;
  const todayRevenue = stats?.todayRevenue ?? 0;

  return (
    <AppLayout
      title="Dashboard"
      subtitle={`${new Date().toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })}`}
    >
      <div className="space-y-4 md:space-y-6 animate-fade-in">
        {/* Pending Tasks Alert - Top priority for Simone */}
        <PendingTasksAlert />

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {isAdminOrManager && (
            <WorkOrderFormDialog
              trigger={
                <Button className="gap-2 bg-accent hover:bg-accent/90 shadow-glow text-sm">
                  <Plus className="h-4 w-4" />
                  <span className="hidden xs:inline">Nova OS</span>
                  <span className="xs:hidden">OS</span>
                </Button>
              }
            />
          )}
          <Button variant="outline" className="gap-2 text-sm" asChild>
            <a href="/agenda">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Agendar</span>
            </a>
          </Button>
          <Button variant="outline" className="gap-2 text-sm" asChild>
            <a href="/oficina">
              <Car className="h-4 w-4" />
              <span className="hidden sm:inline">Check-in</span>
            </a>
          </Button>
        </div>

        {/* Stats Grid - scrollable on mobile */}
        <div className="flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-4 sm:overflow-visible sm:pb-0">
          <div className="min-w-[160px] shrink-0 sm:min-w-0">
            <StatsCard
              title="OS em Andamento"
              value={activeOrders}
              subtitle={`${pendingBudget} aguardando orçamento`}
              icon={FileText}
              variant="accent"
            />
          </div>
          <div className="min-w-[160px] shrink-0 sm:min-w-0">
            <StatsCard
              title="Veículos Hoje"
              value={todayVehicles}
              subtitle={`${arrivedVehicles} já chegaram`}
              icon={Car}
            />
          </div>
          <div className="min-w-[160px] shrink-0 sm:min-w-0">
            <StatsCard
              title="Tempo Médio"
              value={formatDuration(avgTimePerOS)}
              subtitle="Por ordem de serviço"
              icon={Clock}
              variant="warning"
            />
          </div>
          {isAdminOrManager && (
            <div className="min-w-[160px] shrink-0 sm:min-w-0">
            <StatsCard
              title="Faturamento Hoje"
              value={formatCurrency(todayRevenue)}
              subtitle="Receitas do dia"
              icon={DollarSign}
              variant="success"
            />
            </div>
          )}
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="workflow" className="space-y-4">
          <TabsList className="bg-muted/50 w-full grid grid-cols-3 h-auto">
            <TabsTrigger value="workflow" className="gap-1 sm:gap-2 py-2 px-2 sm:px-3 text-xs sm:text-sm">
              <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Fluxo de Trabalho</span>
              <span className="sm:hidden">Fluxo</span>
            </TabsTrigger>
            <TabsTrigger value="schedule" className="gap-1 sm:gap-2 py-2 px-2 sm:px-3 text-xs sm:text-sm">
              <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Agenda do Dia</span>
              <span className="sm:hidden">Agenda</span>
            </TabsTrigger>
            <TabsTrigger value="ranking" className="gap-1 sm:gap-2 py-2 px-2 sm:px-3 text-xs sm:text-sm">
              <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
              <span>Ranking</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="workflow" className="mt-6">
            <Card className="border-0 bg-transparent shadow-none">
              <CardHeader className="px-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-display text-lg">
                    Ordens de Serviço
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="gap-1 text-accent" asChild>
                    <a href="/ordens">
                      Ver todas
                      <ChevronRight className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-0">
                <WorkflowKanban />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="schedule" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="font-display text-lg">
                    Agendamentos de Hoje
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="gap-1 text-accent" asChild>
                    <a href="/agenda">
                      Ver agenda completa
                      <ChevronRight className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <TodaySchedule />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ranking" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="font-display text-lg">
                    Ranking de Mecânicos - {new Date().toLocaleDateString("pt-BR", { month: "long" })}
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="gap-1 text-accent">
                    Ver detalhes
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <MechanicRanking />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
