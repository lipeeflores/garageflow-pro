import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWorkOrders, type WorkflowStep } from "@/hooks/useWorkOrders";
import { cn } from "@/lib/utils";
import { 
  Clock, 
  User, 
  Car, 
  ChevronRight, 
  Loader2, 
  ClipboardCheck,
  Wrench,
  FileText,
  CheckCircle2,
  Play,
  Settings,
  ShieldCheck,
  PackageCheck,
  Flag,
  LucideIcon
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface KanbanColumnConfig {
  id: string;
  title: string;
  color: string;
  icon: LucideIcon;
  workflowSteps: WorkflowStep[];
}

// 5 columns on top row
const topColumns: KanbanColumnConfig[] = [
  { id: "aguardando_checkin", title: "Aguard. Mecânico", color: "bg-yellow-500", icon: ClipboardCheck, workflowSteps: ["AGUARDANDO_CHECKIN", "CHECKIN_CONCLUIDO"] },
  { id: "em_diagnostico", title: "Em Diagnóstico", color: "bg-purple-500", icon: Wrench, workflowSteps: ["EM_DIAGNOSTICO"] },
  { id: "aguardando_orcamento", title: "Aguard. Orçamento", color: "bg-orange-500", icon: FileText, workflowSteps: ["AGUARDANDO_ORCAMENTO"] },
  { id: "aguardando_aprovacao", title: "Aguard. Aprovação", color: "bg-green-500", icon: CheckCircle2, workflowSteps: ["AGUARDANDO_APROVACAO"] },
  { id: "aprovado", title: "Aprovado", color: "bg-green-600", icon: CheckCircle2, workflowSteps: ["APROVADO"] },
];

// 5 columns on bottom row
const bottomColumns: KanbanColumnConfig[] = [
  { id: "em_execucao", title: "Em Execução", color: "bg-orange-500", icon: Play, workflowSteps: ["EM_EXECUCAO"] },
  { id: "qualidade", title: "Qualidade", color: "bg-cyan-500", icon: ShieldCheck, workflowSteps: ["EM_QUALIDADE", "AJUSTES"] },
  { id: "pronto", title: "A Entregar", color: "bg-pink-500", icon: PackageCheck, workflowSteps: ["PRONTO_PARA_RETIRADA"] },
  { id: "finalizado", title: "Finalizado", color: "bg-purple-600", icon: Flag, workflowSteps: ["FINALIZADO"] },
  { id: "cancelado", title: "Cancelado", color: "bg-gray-500", icon: Flag, workflowSteps: ["CANCELADO"] },
];

const allColumns = [...topColumns, ...bottomColumns];

export function WorkflowKanban() {
  const navigate = useNavigate();
  const { data: workOrders, isLoading, error } = useWorkOrders({
    workflow_step: allColumns.flatMap(c => c.workflowSteps),
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

  const getOrdersBySteps = (steps: WorkflowStep[]) => {
    return workOrders?.filter(wo => steps.includes(wo.workflow_step)) || [];
  };

  const renderColumn = (column: KanbanColumnConfig) => {
    const orders = getOrdersBySteps(column.workflowSteps);
    const Icon = column.icon;
    
    return (
      <div
        key={column.id}
        className="flex h-full flex-col rounded-lg bg-muted/30 border border-border/50"
      >
        {/* Column Header */}
        <div className="flex items-center gap-2 p-2 border-b border-border/50">
          <div className={cn("h-2.5 w-2.5 rounded-full", column.color)} />
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <h3 className="text-xs font-semibold truncate">{column.title}</h3>
          <Badge variant="secondary" className="ml-auto text-[10px] h-5">
            {orders.length}
          </Badge>
        </div>

        {/* Cards */}
        <ScrollArea className="flex-1 p-2">
          <div className="space-y-2">
            {orders.length === 0 ? (
              <div className="flex items-center justify-center py-4 text-xs text-muted-foreground">
                Vazio
              </div>
            ) : (
              orders.slice(0, 5).map((order) => (
                <Card
                  key={order.id}
                  className="cursor-pointer border-0 bg-card shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
                  onClick={() => navigate(`/ordens/${order.id}`)}
                >
                  <CardContent className="p-2">
                    {/* Plate */}
                    <div className="flex items-center justify-between">
                      <span className="font-display text-sm font-bold">
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
                        className="text-[9px] h-4 px-1"
                      >
                        {order.priority === "ALTA" ? "🔴" : order.priority === "BAIXA" ? "🟢" : "🟡"}
                      </Badge>
                    </div>

                    {/* Vehicle */}
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Car className="h-2.5 w-2.5" />
                      <span className="truncate">
                        {order.vehicle?.make} {order.vehicle?.model}
                      </span>
                    </div>

                    {/* Customer */}
                    <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                      <User className="h-2.5 w-2.5" />
                      <span className="truncate">{order.customer?.full_name}</span>
                    </div>

                    {/* Time */}
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="h-2.5 w-2.5" />
                      <span>
                        {new Date(order.created_at).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
            {orders.length > 5 && (
              <div className="text-center py-1">
                <span className="text-[10px] text-muted-foreground">
                  +{orders.length - 5} mais
                </span>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  };

  const renderKanbanRow = (columns: KanbanColumnConfig[]) => (
    <div className="grid grid-cols-5 gap-2 h-[180px]">
      {columns.map(renderColumn)}
    </div>
  );

  return (
    <div className="space-y-3 overflow-x-auto pb-2">
      <div className="min-w-[900px] space-y-3">
        {renderKanbanRow(topColumns)}
        {renderKanbanRow(bottomColumns)}
      </div>
    </div>
  );
}
