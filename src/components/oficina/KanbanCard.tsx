import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreVertical, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CheckinDialog } from "@/components/checkin";
import { useUpdateWorkOrder, type WorkOrder, type WorkflowStep } from "@/hooks/useWorkOrders";

interface KanbanCardProps {
  order: WorkOrder;
}

const actionConfig: Record<WorkflowStep, { label: string; action: 'checkin' | 'navigate' | 'update'; nextStep?: WorkflowStep } | null> = {
  AGUARDANDO_CHECKIN: { label: "Pegar Serviço", action: 'checkin' },
  CHECKIN_CONCLUIDO: { label: "Diagnóstico", action: 'navigate' },
  EM_DIAGNOSTICO: { label: "Diagnóstico", action: 'navigate' },
  AGUARDANDO_ORCAMENTO: { label: "Orçamento", action: 'navigate' },
  AGUARDANDO_APROVACAO: null,
  APROVADO: { label: "Iniciar", action: 'update', nextStep: 'EM_EXECUCAO' },
  EM_EXECUCAO: { label: "Concluir", action: 'update', nextStep: 'EM_QUALIDADE' },
  EM_QUALIDADE: null,
  AJUSTES: null,
  PRONTO_PARA_RETIRADA: { label: "Entregar", action: 'navigate' },
  FINALIZADO: { label: "Ver", action: 'navigate' },
  CANCELADO: null,
};

export function KanbanCard({ order }: KanbanCardProps) {
  const navigate = useNavigate();
  const updateWorkOrder = useUpdateWorkOrder();
  const [checkinOpen, setCheckinOpen] = useState(false);

  const config = actionConfig[order.workflow_step];
  const timeAgo = formatDistanceToNow(new Date(order.created_at || Date.now()), {
    addSuffix: false,
    locale: ptBR,
  });

  const handleAction = () => {
    if (!config) return;

    switch (config.action) {
      case 'checkin':
        setCheckinOpen(true);
        break;
      case 'navigate':
        navigate(`/ordens/${order.id}`);
        break;
      case 'update':
        if (config.nextStep) {
          updateWorkOrder.mutate({
            id: order.id,
            updates: { workflow_step: config.nextStep },
          });
        }
        break;
    }
  };

  return (
    <>
      <div className="group relative rounded-lg border border-border/50 bg-card/80 p-3 transition-all hover:border-border hover:shadow-md">
        {/* Header with menu */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {order.customer?.full_name || "Cliente"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {order.vehicle?.make} {order.vehicle?.model}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/ordem/${order.id}`)}>
                Ver detalhes
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Plate - Main identifier */}
        <div className="mb-2">
          <span className="inline-block rounded bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
            {order.vehicle?.plate || "SEM PLACA"}
          </span>
        </div>

        {/* Footer with time and action */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{timeAgo}</span>
          </div>
          {config && (
            <Button
              size="sm"
              variant="secondary"
              className="h-6 px-2 text-xs"
              onClick={handleAction}
              disabled={updateWorkOrder.isPending}
            >
              {config.label}
            </Button>
          )}
        </div>
      </div>

      <CheckinDialog
        open={checkinOpen}
        onOpenChange={setCheckinOpen}
        workOrderId={order.id}
        vehiclePlate={order.vehicle?.plate || "SEM PLACA"}
      />
    </>
  );
}
