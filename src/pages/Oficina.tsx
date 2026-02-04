import { AppLayout } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
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
} from "lucide-react";
import { useWorkOrders, type WorkflowStep } from "@/hooks/useWorkOrders";
import { useTodayScheduledAppointments } from "@/hooks/useAppointments";
import { WorkOrderFormDialog } from "@/components/forms";
import { KanbanColumn, KanbanCard, AppointmentKanbanCard } from "@/components/oficina";
import { Button } from "@/components/ui/button";

interface KanbanColumnConfig {
  id: string;
  title: string;
  icon: typeof CalendarCheck;
  color: string;
  workflowSteps?: WorkflowStep[];
  isAppointments?: boolean;
}

const columns: KanbanColumnConfig[] = [
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

export default function Oficina() {
  // Get all workflow steps for work orders query
  const allWorkflowSteps = columns
    .filter((c) => c.workflowSteps)
    .flatMap((c) => c.workflowSteps!);

  const { data: appointments, isLoading: appointmentsLoading } = useTodayScheduledAppointments();
  const { data: workOrders, isLoading: workOrdersLoading } = useWorkOrders({
    workflow_step: allWorkflowSteps,
  });

  const isLoading = appointmentsLoading || workOrdersLoading;

  // Group work orders by workflow step
  const getOrdersForColumn = (config: KanbanColumnConfig) => {
    if (!config.workflowSteps || !workOrders) return [];
    return workOrders.filter((order) =>
      config.workflowSteps!.includes(order.workflow_step)
    );
  };

  if (isLoading) {
    return (
      <AppLayout title="Oficina" subtitle="Kanban de Ordens de Serviço">
        <div className="flex gap-4 h-[calc(100vh-180px)] overflow-x-auto pb-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-full w-[220px] min-w-[220px] rounded-lg" />
          ))}
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
        <div className="flex gap-4 h-[calc(100vh-180px)] pb-4 animate-fade-in">
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
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </AppLayout>
  );
}
