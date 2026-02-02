import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWorkOrders, type WorkflowStep } from "@/hooks/useWorkOrders";
import { cn } from "@/lib/utils";
import { Clock, User, Car, ChevronRight, Loader2 } from "lucide-react";

interface KanbanColumn {
  id: WorkflowStep;
  title: string;
  color: string;
}

const columns: KanbanColumn[] = [
  { id: "AGUARDANDO_CHECKIN", title: "Aguardando", color: "bg-yellow-500" },
  { id: "EM_DIAGNOSTICO", title: "Diagnóstico", color: "bg-blue-500" },
  { id: "AGUARDANDO_ORCAMENTO", title: "Orçamento", color: "bg-orange-500" },
  { id: "EM_EXECUCAO", title: "Em Execução", color: "bg-purple-500" },
  { id: "EM_QUALIDADE", title: "Qualidade", color: "bg-cyan-500" },
  { id: "PRONTO_PARA_RETIRADA", title: "Pronto", color: "bg-green-500" },
];

export function WorkflowKanban() {
  const { data: workOrders, isLoading, error } = useWorkOrders({
    workflow_step: columns.map(c => c.id),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Erro ao carregar ordens de serviço
      </div>
    );
  }

  const getOrdersByStep = (step: WorkflowStep) => {
    return workOrders?.filter(wo => wo.workflow_step === step) || [];
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((column) => {
        const orders = getOrdersByStep(column.id);
        
        return (
          <div
            key={column.id}
            className="flex w-72 shrink-0 flex-col rounded-xl bg-muted/30 p-3"
          >
            {/* Column Header */}
            <div className="mb-3 flex items-center gap-2">
              <div className={cn("h-3 w-3 rounded-full", column.color)} />
              <h3 className="text-sm font-semibold">{column.title}</h3>
              <Badge variant="secondary" className="ml-auto text-xs">
                {orders.length}
              </Badge>
            </div>

            {/* Cards */}
            <ScrollArea className="flex-1">
              <div className="space-y-3 pr-2">
                {orders.length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                    Nenhuma OS
                  </div>
                ) : (
                  orders.map((order) => (
                    <Card
                      key={order.id}
                      className="cursor-pointer border-0 bg-card shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
                    >
                      <CardContent className="p-3">
                        {/* Plate */}
                        <div className="flex items-center justify-between">
                          <span className="font-display text-base font-bold">
                            {order.vehicle?.plate || "---"}
                          </span>
                          <Badge
                            variant={
                              order.priority === "ALTA"
                                ? "destructive"
                                : order.priority === "BAIXA"
                                ? "secondary"
                                : "default"
                            }
                            className="text-[10px]"
                          >
                            {order.priority === "ALTA" ? "🔴" : order.priority === "BAIXA" ? "🟢" : "🟡"}
                          </Badge>
                        </div>

                        {/* Vehicle */}
                        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <Car className="h-3 w-3" />
                          <span>
                            {order.vehicle?.make} {order.vehicle?.model}
                            {order.vehicle?.year && ` (${order.vehicle.year})`}
                          </span>
                        </div>

                        {/* Customer */}
                        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span className="truncate">{order.customer?.full_name}</span>
                        </div>

                        {/* Time */}
                        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>
                            {new Date(order.created_at).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>

                        {/* Mechanic */}
                        {order.mechanic && (
                          <div className="mt-2 flex items-center gap-2">
                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary">
                              {order.mechanic.full_name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                            </div>
                            <span className="text-xs">{order.mechanic.full_name}</span>
                          </div>
                        )}

                        {/* Action */}
                        <div className="mt-3 flex items-center justify-end">
                          <span className="flex items-center gap-1 text-xs font-medium text-accent">
                            Ver detalhes
                            <ChevronRight className="h-3 w-3" />
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        );
      })}
    </div>
  );
}
