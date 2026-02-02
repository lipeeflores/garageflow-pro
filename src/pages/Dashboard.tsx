import { AppLayout } from "@/components/layout";
import {
  StatsCard,
  WorkflowKanban,
  TodaySchedule,
  MechanicRanking,
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

export default function Dashboard() {
  return (
    <AppLayout
      title="Dashboard"
      subtitle={`Terça-feira, ${new Date().toLocaleDateString("pt-BR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })}`}
    >
      <div className="space-y-6 animate-fade-in">
        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3">
          <Button className="gap-2 bg-accent hover:bg-accent/90 shadow-glow">
            <Plus className="h-4 w-4" />
            Nova OS
          </Button>
          <Button variant="outline" className="gap-2">
            <Calendar className="h-4 w-4" />
            Agendar
          </Button>
          <Button variant="outline" className="gap-2">
            <Car className="h-4 w-4" />
            Check-in Direto
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="OS em Andamento"
            value={8}
            subtitle="3 aguardando orçamento"
            icon={FileText}
            variant="accent"
          />
          <StatsCard
            title="Veículos Hoje"
            value={12}
            subtitle="5 já atendidos"
            icon={Car}
            trend={{ value: 20, isPositive: true }}
          />
          <StatsCard
            title="Tempo Médio"
            value="2h 45m"
            subtitle="Por ordem de serviço"
            icon={Clock}
            variant="warning"
          />
          <StatsCard
            title="Faturamento Hoje"
            value="R$ 4.850"
            subtitle="Meta: R$ 6.000"
            icon={DollarSign}
            variant="success"
            trend={{ value: 12, isPositive: true }}
          />
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="workflow" className="space-y-4">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="workflow" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Fluxo de Trabalho
            </TabsTrigger>
            <TabsTrigger value="schedule" className="gap-2">
              <Calendar className="h-4 w-4" />
              Agenda do Dia
            </TabsTrigger>
            <TabsTrigger value="ranking" className="gap-2">
              <Clock className="h-4 w-4" />
              Ranking
            </TabsTrigger>
          </TabsList>

          <TabsContent value="workflow" className="mt-6">
            <Card className="border-0 bg-transparent shadow-none">
              <CardHeader className="px-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-display text-lg">
                    Ordens de Serviço
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="gap-1 text-accent">
                    Ver todas
                    <ChevronRight className="h-4 w-4" />
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
                  <Button variant="ghost" size="sm" className="gap-1 text-accent">
                    Ver agenda completa
                    <ChevronRight className="h-4 w-4" />
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
