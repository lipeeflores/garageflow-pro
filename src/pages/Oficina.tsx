import { AppLayout } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CalendarCheck,
  Clock,
  Stethoscope,
  Calculator,
  FileCheck,
  CheckCircle,
  Wrench,
  ClipboardCheck,
  Gift,
  Flag,
  Plus,
  Car,
} from "lucide-react";
import { useWorkOrders, type WorkflowStep } from "@/hooks/useWorkOrders";
import { useTodayScheduledAppointments } from "@/hooks/useAppointments";
import { WorkOrderFormDialog } from "@/components/forms";
import { KanbanColumn, KanbanCard, AppointmentKanbanCard } from "@/components/oficina";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface KanbanColumnConfig {
  id: string;
  title: string;
  icon: typeof CalendarCheck;
  color: string;
  workflowSteps?: WorkflowStep[];
  isAppointments?: boolean;
}

const topColumns: KanbanColumnConfig[] = [
  {
    id: "checkin",
    title: "Check-in (Dia)",
    icon: CalendarCheck,
    color: "bg-slate-500",
    isAppointments: true,
  },
  {
    id: "aguardando_checkin",
    title: "Aguard. Mecânico",
    icon: Clock,
    color: "bg-yellow-500",
    workflowSteps: ["AGUARDANDO_CHECKIN"],
  },
  {
    id: "diagnostico",
    title: "Em Diagnóstico",
    icon: Stethoscope,
    color: "bg-violet-500",
    workflowSteps: ["CHECKIN_CONCLUIDO", "EM_DIAGNOSTICO"],
  },
  {
    id: "orcamento",
    title: "Aguard. Orçamento",
    icon: Calculator,
    color: "bg-orange-500",
    workflowSteps: ["AGUARDANDO_ORCAMENTO"],
  },
  {
    id: "aprovacao",
    title: "Aguard. Aprovação",
    icon: FileCheck,
    color: "bg-green-500",
    workflowSteps: ["AGUARDANDO_APROVACAO"],
  },
];

const bottomColumns: KanbanColumnConfig[] = [
  {
    id: "aprovado",
    title: "Aprovado",
    icon: CheckCircle,
    color: "bg-green-600",
    workflowSteps: ["APROVADO"],
  },
  {
    id: "execucao",
    title: "Em Execução",
    icon: Wrench,
    color: "bg-orange-600",
    workflowSteps: ["EM_EXECUCAO"],
  },
  {
    id: "qualidade",
    title: "Qualidade",
    icon: ClipboardCheck,
    color: "bg-cyan-500",
    workflowSteps: ["EM_QUALIDADE", "AJUSTES"],
  },
  {
    id: "entrega",
    title: "A Entregar",
    icon: Gift,
    color: "bg-pink-500",
    workflowSteps: ["PRONTO_PARA_RETIRADA"],
  },
  {
    id: "finalizado",
    title: "Finalizado",
    icon: Flag,
    color: "bg-violet-600",
    workflowSteps: ["FINALIZADO"],
  },
];

const allColumns = [...topColumns, ...bottomColumns];

type BoxLocation = "BOX_1" | "BOX_2" | "BOX_3" | "BOX_4" | "PATIO";

const boxLabels: Record<BoxLocation, string> = {
  BOX_1: "Elevador 1",
  BOX_2: "Elevador 2",
  BOX_3: "Elevador 3",
  BOX_4: "Elevador 4",
  PATIO: "Pátio",
};

export default function Oficina() {
  const allWorkflowSteps = allColumns
    .filter((c) => c.workflowSteps)
    .flatMap((c) => c.workflowSteps!);

  const { data: appointments, isLoading: appointmentsLoading } = useTodayScheduledAppointments();
  const { data: workOrders, isLoading: workOrdersLoading } = useWorkOrders({
    workflow_step: allWorkflowSteps,
  });

  const isLoading = appointmentsLoading || workOrdersLoading;

  const getOrdersForColumn = (config: KanbanColumnConfig) => {
    if (!config.workflowSteps || !workOrders) return [];
    return workOrders.filter((order) =>
      config.workflowSteps!.includes(order.workflow_step)
    );
  };

  // Group work orders by box location
  const getOrdersByBox = () => {
    if (!workOrders) return {};
    const activeOrders = workOrders.filter(
      (o) => o.workflow_step === "EM_EXECUCAO" || o.workflow_step === "EM_DIAGNOSTICO"
    );
    return activeOrders.reduce((acc, order) => {
      const box = order.box_location || "PATIO";
      if (!acc[box]) acc[box] = [];
      acc[box].push(order);
      return acc;
    }, {} as Record<string, typeof workOrders>);
  };

  const ordersByBox = getOrdersByBox();

  const renderKanbanRow = (columns: KanbanColumnConfig[]) => (
    <div className="grid grid-cols-5 gap-3 min-w-[1100px]">
      {columns.map((column) => {
        const items = column.isAppointments
          ? appointments || []
          : getOrdersForColumn(column);

        return (
          <KanbanColumn
            key={column.id}
            title={column.title}
            icon={column.icon}
            color={column.color}
            count={items.length}
            emptyIcon={column.icon}
          >
            {column.isAppointments
              ? (appointments || []).map((appointment) => (
                  <AppointmentKanbanCard
                    key={appointment.id}
                    appointment={appointment}
                  />
                ))
              : getOrdersForColumn(column).map((order) => (
                  <KanbanCard key={order.id} order={order} />
                ))}
          </KanbanColumn>
        );
      })}
    </div>
  );

  if (isLoading) {
    return (
      <AppLayout title="Oficina" subtitle="Kanban de Ordens de Serviço">
        <div className="space-y-4">
          <div className="grid grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-[280px] rounded-lg" />
            ))}
          </div>
          <div className="grid grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-[280px] rounded-lg" />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Oficina"
      subtitle="Kanban de Ordens de Serviço"
      fullWidth
    >
      {/* Box Location Status */}
      <div className="mb-4 flex flex-wrap gap-2">
        {(Object.keys(boxLabels) as BoxLocation[]).map((box) => {
          const orders = ordersByBox[box] || [];
          const isOccupied = orders.length > 0;
          return (
            <Badge
              key={box}
              variant={isOccupied ? "default" : "outline"}
              className={cn(
                "px-3 py-1.5 gap-2",
                isOccupied && "bg-primary"
              )}
            >
              <Car className="h-3.5 w-3.5" />
              <span>{boxLabels[box]}</span>
              {isOccupied && (
                <span className="ml-1 font-bold">
                  {orders[0]?.vehicle?.plate}
                </span>
              )}
            </Badge>
          );
        })}
      </div>

      <div className="flex items-center justify-end mb-4">
        <WorkOrderFormDialog
          trigger={
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Nova OS
            </Button>
          }
        />
      </div>

      <ScrollArea className="w-full">
        <div className="space-y-4 pb-4 animate-fade-in">
          {/* Top Row - 5 columns */}
          {renderKanbanRow(topColumns)}
          
          {/* Bottom Row - 5 columns */}
          {renderKanbanRow(bottomColumns)}
        </div>
      </ScrollArea>
    </AppLayout>
  );
}
