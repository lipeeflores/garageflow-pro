import { AppLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Car,
  Clock,
  Wrench,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkOrders, type WorkflowStep } from "@/hooks/useWorkOrders";
import { WorkOrderFormDialog } from "@/components/forms";
import { WorkOrderCard } from "@/components/oficina";

const boxLabels: Record<string, string> = {
  BOX_1: "Box 1",
  BOX_2: "Box 2",
  BOX_3: "Box 3",
  BOX_4: "Box 4",
  PATIO: "Pátio",
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
