import { useState } from "react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Car,
  Clock,
  User,
  Wrench,
  Camera,
  FileText,
  CheckCircle,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkOrders, useUpdateWorkOrder, type WorkflowStep } from "@/hooks/useWorkOrders";
import { WorkOrderFormDialog } from "@/components/forms";
import { CheckinDialog } from "@/components/checkin/CheckinDialog";

const priorityColors = {
  BAIXA: "bg-muted text-muted-foreground",
  MEDIA: "bg-warning/20 text-warning",
  ALTA: "bg-destructive/20 text-destructive",
};

const stepColors: Record<WorkflowStep, string> = {
  AGUARDANDO_CHECKIN: "bg-info/20 text-info",
  CHECKIN_CONCLUIDO: "bg-info/20 text-info",
  EM_DIAGNOSTICO: "bg-warning/20 text-warning",
  AGUARDANDO_ORCAMENTO: "bg-accent/20 text-accent",
  AGUARDANDO_APROVACAO: "bg-purple-100 text-purple-700",
  APROVADO: "bg-success/20 text-success",
  EM_EXECUCAO: "bg-primary/20 text-primary",
  EM_QUALIDADE: "bg-purple-100 text-purple-700",
  AJUSTES: "bg-warning/20 text-warning",
  PRONTO_PARA_RETIRADA: "bg-success/20 text-success",
  FINALIZADO: "bg-muted text-muted-foreground",
  CANCELADO: "bg-destructive/20 text-destructive",
};

const stepLabels: Record<WorkflowStep, string> = {
  AGUARDANDO_CHECKIN: "Aguardando Check-in",
  CHECKIN_CONCLUIDO: "Check-in Concluído",
  EM_DIAGNOSTICO: "Em Diagnóstico",
  AGUARDANDO_ORCAMENTO: "Aguardando Orçamento",
  AGUARDANDO_APROVACAO: "Aguardando Aprovação",
  APROVADO: "Aprovado",
  EM_EXECUCAO: "Em Execução",
  EM_QUALIDADE: "Em Qualidade",
  AJUSTES: "Ajustes",
  PRONTO_PARA_RETIRADA: "Pronto p/ Retirada",
  FINALIZADO: "Finalizado",
  CANCELADO: "Cancelado",
};

const boxLabels: Record<string, string> = {
  BOX_1: "Box 1",
  BOX_2: "Box 2",
  BOX_3: "Box 3",
  BOX_4: "Box 4",
  PATIO: "Pátio",
};

const getProgressForStep = (step: WorkflowStep): number => {
  const progressMap: Record<WorkflowStep, number> = {
    AGUARDANDO_CHECKIN: 0,
    CHECKIN_CONCLUIDO: 10,
    EM_DIAGNOSTICO: 25,
    AGUARDANDO_ORCAMENTO: 35,
    AGUARDANDO_APROVACAO: 45,
    APROVADO: 55,
    EM_EXECUCAO: 70,
    EM_QUALIDADE: 85,
    AJUSTES: 80,
    PRONTO_PARA_RETIRADA: 95,
    FINALIZADO: 100,
    CANCELADO: 0,
  };
  return progressMap[step] || 0;
};

export default function Oficina() {
  const activeSteps: WorkflowStep[] = [
    "AGUARDANDO_CHECKIN",
    "CHECKIN_CONCLUIDO",
    "EM_DIAGNOSTICO",
    "AGUARDANDO_ORCAMENTO",
    "AGUARDANDO_APROVACAO",
    "APROVADO",
    "EM_EXECUCAO",
  ];
  
  const qualitySteps: WorkflowStep[] = ["EM_QUALIDADE", "AJUSTES"];
  const waitingSteps: WorkflowStep[] = ["AGUARDANDO_CHECKIN", "AGUARDANDO_APROVACAO", "AGUARDANDO_ORCAMENTO"];

  const { data: allOrders, isLoading } = useWorkOrders({ workflow_step: [...activeSteps, ...qualitySteps] });

  const activeOrders = allOrders?.filter(o => activeSteps.includes(o.workflow_step) && !waitingSteps.includes(o.workflow_step)) || [];
  const waitingOrders = allOrders?.filter(o => waitingSteps.includes(o.workflow_step)) || [];
  const qualityOrders = allOrders?.filter(o => qualitySteps.includes(o.workflow_step)) || [];

  // Build boxes status from active orders
  const boxes = ["BOX_1", "BOX_2", "BOX_3", "BOX_4"].map(boxId => {
    const orderInBox = allOrders?.find(o => o.box_location === boxId);
    return {
      id: boxId,
      name: boxLabels[boxId],
      status: orderInBox ? "ocupado" : "livre",
      plate: orderInBox?.vehicle?.plate || null,
    };
  });

  if (isLoading) {
    return (
      <AppLayout title="Oficina" subtitle="Acompanhamento em tempo real">
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Oficina" subtitle="Acompanhamento em tempo real">
      <div className="space-y-6 animate-fade-in">
        {/* Box Status */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {boxes.map((box) => (
            <Card
              key={box.id}
              className={cn(
                "transition-all duration-200",
                box.status === "ocupado"
                  ? "border-accent/30 bg-accent/5"
                  : "border-success/30 bg-success/5"
              )}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-display text-lg font-bold">{box.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {box.status === "ocupado" ? box.plate : "Disponível"}
                  </p>
                </div>
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    box.status === "ocupado"
                      ? "bg-accent/20 text-accent"
                      : "bg-success/20 text-success"
                  )}
                >
                  {box.status === "ocupado" ? (
                    <Wrench className="h-5 w-5" />
                  ) : (
                    <CheckCircle className="h-5 w-5" />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Work Orders */}
        <Tabs defaultValue="active" className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="active" className="gap-2">
                <Wrench className="h-4 w-4" />
                Em Andamento
                <Badge className="ml-1">{activeOrders.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="waiting" className="gap-2">
                <Clock className="h-4 w-4" />
                Aguardando
                <Badge className="ml-1">{waitingOrders.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="quality" className="gap-2">
                <CheckCircle className="h-4 w-4" />
                Qualidade
                <Badge className="ml-1">{qualityOrders.length}</Badge>
              </TabsTrigger>
            </TabsList>
            <WorkOrderFormDialog />
          </div>

          <TabsContent value="active" className="space-y-4">
            {activeOrders.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Wrench className="h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 font-display text-lg font-semibold">
                    Nenhuma OS em andamento
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Crie uma nova ordem de serviço para começar.
                  </p>
                </CardContent>
              </Card>
            ) : (
              activeOrders.map((order) => (
                <WorkOrderCard key={order.id} order={order} />
              ))
            )}
          </TabsContent>

          <TabsContent value="waiting" className="space-y-4">
            {waitingOrders.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Clock className="h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 font-display text-lg font-semibold">
                    Nenhuma OS aguardando
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Todas as ordens de serviço estão em andamento.
                  </p>
                </CardContent>
              </Card>
            ) : (
              waitingOrders.map((order) => (
                <WorkOrderCard key={order.id} order={order} />
              ))
            )}
          </TabsContent>

          <TabsContent value="quality" className="space-y-4">
            {qualityOrders.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle className="h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 font-display text-lg font-semibold">
                    Nenhuma OS em qualidade
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Nenhuma ordem de serviço aguardando inspeção.
                  </p>
                </CardContent>
              </Card>
            ) : (
              qualityOrders.map((order) => (
                <WorkOrderCard key={order.id} order={order} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

interface WorkOrderCardProps {
  order: ReturnType<typeof useWorkOrders>["data"] extends (infer U)[] ? U : never;
}

function WorkOrderCard({ order }: WorkOrderCardProps) {
  const [checkinOpen, setCheckinOpen] = useState(false);
  const updateWorkOrder = useUpdateWorkOrder();

  if (!order) return null;
  
  const priority = order.priority || "MEDIA";
  const progress = getProgressForStep(order.workflow_step);

  const handleStartDiagnosis = () => {
    updateWorkOrder.mutate({
      id: order.id,
      updates: { workflow_step: 'EM_DIAGNOSTICO' },
    });
  };

  const handleSendToQuote = () => {
    updateWorkOrder.mutate({
      id: order.id,
      updates: { workflow_step: 'AGUARDANDO_ORCAMENTO' },
    });
  };

  const handleComplete = () => {
    updateWorkOrder.mutate({
      id: order.id,
      updates: { workflow_step: 'EM_QUALIDADE' },
    });
  };

  return (
    <>
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="flex items-stretch">
            {/* Left: Main Info */}
            <div className="flex-1 p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <Car className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="font-display text-xl font-bold">
                        {order.vehicle?.plate || "---"}
                      </span>
                      <Badge className={priorityColors[priority]}>
                        {priority.charAt(0) + priority.slice(1).toLowerCase()}
                      </Badge>
                      <Badge className={stepColors[order.workflow_step] || "bg-muted"}>
                        {stepLabels[order.workflow_step]}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        {order.customer?.full_name || "Cliente não definido"}
                      </span>
                      <span>
                        {order.vehicle?.make} {order.vehicle?.model} {order.vehicle?.year}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">
                    OS-{order.id.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="font-medium text-accent">
                    {order.box_location ? boxLabels[order.box_location] : "Pátio"}
                  </p>
                </div>
              </div>

              {/* Progress */}
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progresso</span>
                  <span className="font-medium">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              {/* Mechanic */}
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {order.mechanic?.full_name && (
                    <>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                        {order.mechanic.full_name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)}
                      </div>
                      <span className="font-medium">{order.mechanic.full_name}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex w-48 flex-col gap-2 border-l border-border bg-muted/30 p-4">
              {order.workflow_step === "AGUARDANDO_CHECKIN" && (
                <Button
                  className="gap-2 bg-success hover:bg-success/90"
                  onClick={() => setCheckinOpen(true)}
                >
                  <Camera className="h-4 w-4" />
                  Check-in
                </Button>
              )}
              {order.workflow_step === "CHECKIN_CONCLUIDO" && (
                <Button
                  className="gap-2 bg-accent hover:bg-accent/90"
                  onClick={handleStartDiagnosis}
                >
                  <Wrench className="h-4 w-4" />
                  Iniciar Diagnóstico
                </Button>
              )}
              {order.workflow_step === "EM_DIAGNOSTICO" && (
                <Button
                  className="gap-2 bg-accent hover:bg-accent/90"
                  onClick={handleSendToQuote}
                >
                  <Send className="h-4 w-4" />
                  Enviar p/ Orçamento
                </Button>
              )}
              {order.workflow_step === "EM_EXECUCAO" && (
                <>
                  <Button variant="outline" className="gap-2">
                    <Camera className="h-4 w-4" />
                    Adicionar Foto
                  </Button>
                  <Button
                    className="gap-2 bg-success hover:bg-success/90"
                    onClick={handleComplete}
                  >
                    <CheckCircle className="h-4 w-4" />
                    Concluir
                  </Button>
                </>
              )}
              <Button variant="ghost" className="gap-2">
                <FileText className="h-4 w-4" />
                Ver Detalhes
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <CheckinDialog
        open={checkinOpen}
        onOpenChange={setCheckinOpen}
        workOrderId={order.id}
        vehiclePlate={order.vehicle?.plate || "---"}
      />
    </>
  );
}
