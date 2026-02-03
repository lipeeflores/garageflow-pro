import { useParams, useNavigate, Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  ArrowLeft, 
  Car, 
  User, 
  Phone, 
  Calendar,
  Clock,
  FileText,
  Wrench,
  MapPin,
  AlertTriangle,
  RotateCcw,
  ExternalLink
} from "lucide-react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useWorkOrder, useUpdateWorkOrder, type WorkflowStep } from "@/hooks/useWorkOrders";
import { useWorkOrderReturns } from "@/hooks/useWorkOrderReturns";
import { useAuth } from "@/contexts/AuthContext";
import { 
  WorkOrderTimeline, 
  WorkOrderDiagnosis, 
  WorkOrderBudget,
  QualityControlDialog,
  ShareBudgetButton,
  PaymentDialog,
  ReturnWorkOrderDialog,
} from "@/components/workorder";
import { CheckinDialog } from "@/components/checkin";
import { cn } from "@/lib/utils";

const stepColors: Record<WorkflowStep, string> = {
  AGUARDANDO_CHECKIN: "bg-muted text-muted-foreground",
  CHECKIN_CONCLUIDO: "bg-info/20 text-info",
  EM_DIAGNOSTICO: "bg-warning/20 text-warning",
  AGUARDANDO_ORCAMENTO: "bg-accent/20 text-accent",
  AGUARDANDO_APROVACAO: "bg-info/20 text-info",
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

const priorityConfig = {
  BAIXA: { label: "Baixa", color: "bg-muted text-muted-foreground" },
  MEDIA: { label: "Média", color: "bg-warning/20 text-warning" },
  ALTA: { label: "Alta", color: "bg-destructive/20 text-destructive" },
};

export default function OrdemDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdminOrManager, user } = useAuth();
  const { data: workOrder, isLoading } = useWorkOrder(id);
  const { data: returnData } = useWorkOrderReturns(id || "");
  const updateWorkOrder = useUpdateWorkOrder();

  const canEdit = isAdminOrManager || 
    (workOrder?.current_mechanic_id === user?.id);

  const handleWorkflowAction = async (newStep: WorkflowStep) => {
    if (!id) return;
    await updateWorkOrder.mutateAsync({
      id,
      updates: { workflow_step: newStep },
    });
  };

  if (isLoading) {
    return (
      <AppLayout title="Carregando..." subtitle="Ordem de Serviço">
        <div className="space-y-6">
          <Skeleton className="h-10 w-32" />
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-48" />
              <Skeleton className="h-64" />
            </div>
            <Skeleton className="h-96" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!workOrder) {
    return (
      <AppLayout title="Não encontrada" subtitle="Ordem de Serviço">
        <div className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 font-display text-lg font-semibold">
            Ordem não encontrada
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            A ordem de serviço solicitada não existe ou foi removida.
          </p>
          <Button 
            className="mt-4"
            onClick={() => navigate("/ordens")}
          >
            Voltar para Ordens
          </Button>
        </div>
      </AppLayout>
    );
  }

  const priority = workOrder.priority || "MEDIA";

  return (
    <AppLayout 
      title={`OS-${workOrder.id.slice(0, 8).toUpperCase()}`} 
      subtitle="Detalhes da Ordem de Serviço"
    >
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Button 
            variant="outline" 
            onClick={() => navigate(-1)}
            className="w-fit gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>

          <div className="flex flex-wrap gap-2">
            <Badge className={cn("text-sm", stepColors[workOrder.workflow_step])}>
              {stepLabels[workOrder.workflow_step]}
            </Badge>
            <Badge className={cn("text-sm", priorityConfig[priority].color)}>
              {priorityConfig[priority].label}
            </Badge>
            {workOrder.order_type === "RETORNO" && (
              <Badge variant="destructive" className="text-sm">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Retorno
              </Badge>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Vehicle & Customer Info */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Vehicle Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Car className="h-4 w-4" />
                    Veículo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-display font-bold">
                      {workOrder.vehicle?.plate}
                    </span>
                    {workOrder.vehicle?.color && (
                      <Badge variant="secondary">{workOrder.vehicle.color}</Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground">
                    {workOrder.vehicle?.make} {workOrder.vehicle?.model}
                    {workOrder.vehicle?.year && ` (${workOrder.vehicle.year})`}
                  </p>
                  {workOrder.box_location && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-primary" />
                      <span>
                        {workOrder.box_location === "PATIO" 
                          ? "Pátio" 
                          : workOrder.box_location.replace("_", " ")}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Customer Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-lg font-medium">
                    {workOrder.customer?.full_name}
                  </p>
                  {workOrder.customer?.phone_number && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <a 
                        href={`tel:${workOrder.customer.phone_number}`}
                        className="hover:text-primary"
                      >
                        {workOrder.customer.phone_number}
                      </a>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>
                      Criada em {workOrder.created_at && format(
                        new Date(workOrder.created_at),
                        "dd/MM/yyyy",
                        { locale: ptBR }
                      )}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Complaint */}
            {workOrder.initial_complaint && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Reclamação do Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {workOrder.initial_complaint}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Tabs */}
            <Tabs defaultValue="diagnosis" className="w-full">
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="diagnosis" className="gap-2">
                  <Wrench className="h-4 w-4" />
                  <span className="hidden sm:inline">Diagnóstico</span>
                </TabsTrigger>
                <TabsTrigger value="budget" className="gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Orçamento</span>
                </TabsTrigger>
                <TabsTrigger value="timeline" className="gap-2">
                  <Clock className="h-4 w-4" />
                  <span className="hidden sm:inline">Histórico</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="diagnosis" className="mt-4">
                <WorkOrderDiagnosis 
                  workOrderId={workOrder.id}
                  currentStep={workOrder.workflow_step}
                  canEdit={canEdit}
                />
              </TabsContent>

              <TabsContent value="budget" className="mt-4">
                <WorkOrderBudget 
                  workOrderId={workOrder.id}
                  canEdit={canEdit}
                />
              </TabsContent>

              <TabsContent value="timeline" className="mt-4">
                <Card>
                  <CardContent className="pt-6">
                    <WorkOrderTimeline workOrderId={workOrder.id} />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar - Actions */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Check-in */}
                {workOrder.workflow_step === "AGUARDANDO_CHECKIN" && (
                  <CheckinDialog 
                    workOrderId={workOrder.id}
                    vehiclePlate={workOrder.vehicle?.plate || ""}
                    trigger={
                      <Button className="w-full gap-2">
                        <Car className="h-4 w-4" />
                        Realizar Check-in
                      </Button>
                    }
                  />
                )}

                {/* Start Diagnosis */}
                {workOrder.workflow_step === "CHECKIN_CONCLUIDO" && canEdit && (
                  <Button 
                    className="w-full gap-2"
                    onClick={() => handleWorkflowAction("EM_DIAGNOSTICO")}
                    disabled={updateWorkOrder.isPending}
                  >
                    <Wrench className="h-4 w-4" />
                    Iniciar Diagnóstico
                  </Button>
                )}

                {/* Send to Budget */}
                {workOrder.workflow_step === "EM_DIAGNOSTICO" && canEdit && (
                  <Button 
                    className="w-full gap-2"
                    variant="secondary"
                    onClick={() => handleWorkflowAction("AGUARDANDO_ORCAMENTO")}
                    disabled={updateWorkOrder.isPending}
                  >
                    <FileText className="h-4 w-4" />
                    Enviar p/ Orçamento
                  </Button>
                )}

                {/* Send for Approval */}
                {workOrder.workflow_step === "AGUARDANDO_ORCAMENTO" && isAdminOrManager && (
                  <Button 
                    className="w-full gap-2"
                    onClick={() => handleWorkflowAction("AGUARDANDO_APROVACAO")}
                    disabled={updateWorkOrder.isPending}
                  >
                    <FileText className="h-4 w-4" />
                    Enviar p/ Aprovação
                  </Button>
                )}

                {/* Awaiting Approval - Share with customer */}
                {workOrder.workflow_step === "AGUARDANDO_APROVACAO" && isAdminOrManager && (
                  <>
                    <ShareBudgetButton
                      workOrderId={workOrder.id}
                      customerPhone={workOrder.customer?.phone_number}
                      customerName={workOrder.customer?.full_name}
                      vehiclePlate={workOrder.vehicle?.plate}
                      totalAmount={workOrder.total_amount ?? undefined}
                    />
                    <Button 
                      className="w-full gap-2 bg-success hover:bg-success/90"
                      onClick={() => handleWorkflowAction("APROVADO")}
                      disabled={updateWorkOrder.isPending}
                    >
                      Aprovar Orçamento
                    </Button>
                    <Button 
                      className="w-full gap-2"
                      variant="destructive"
                      onClick={() => handleWorkflowAction("CANCELADO")}
                      disabled={updateWorkOrder.isPending}
                    >
                      Recusar
                    </Button>
                  </>
                )}

                {/* Start Execution */}
                {workOrder.workflow_step === "APROVADO" && canEdit && (
                  <Button 
                    className="w-full gap-2"
                    onClick={() => handleWorkflowAction("EM_EXECUCAO")}
                    disabled={updateWorkOrder.isPending}
                  >
                    <Wrench className="h-4 w-4" />
                    Iniciar Execução
                  </Button>
                )}

                {/* Send to Quality */}
                {workOrder.workflow_step === "EM_EXECUCAO" && canEdit && (
                  <Button 
                    className="w-full gap-2"
                    onClick={() => handleWorkflowAction("EM_QUALIDADE")}
                    disabled={updateWorkOrder.isPending}
                  >
                    Enviar p/ Qualidade
                  </Button>
                )}

                {/* Quality Actions - Use QC Dialog */}
                {workOrder.workflow_step === "EM_QUALIDADE" && isAdminOrManager && (
                  <QualityControlDialog
                    workOrderId={workOrder.id}
                    trigger={
                      <Button className="w-full gap-2">
                        Controle de Qualidade
                      </Button>
                    }
                  />
                )}

                {/* From Adjustments */}
                {workOrder.workflow_step === "AJUSTES" && canEdit && (
                  <Button 
                    className="w-full gap-2"
                    onClick={() => handleWorkflowAction("EM_QUALIDADE")}
                    disabled={updateWorkOrder.isPending}
                  >
                    Retornar p/ Qualidade
                  </Button>
                )}

                {/* Finalize */}
                {workOrder.workflow_step === "PRONTO_PARA_RETIRADA" && isAdminOrManager && (
                  <>
                    <PaymentDialog
                      workOrderId={workOrder.id}
                      totalAmount={workOrder.total_amount ?? 0}
                    />
                    <Button 
                      className="w-full gap-2 bg-success hover:bg-success/90"
                      onClick={() => handleWorkflowAction("FINALIZADO")}
                      disabled={updateWorkOrder.isPending}
                    >
                      Finalizar OS
                    </Button>
                  </>
                )}

                {/* Payment for Finalized */}
                {workOrder.workflow_step === "FINALIZADO" && isAdminOrManager && (
                  <PaymentDialog
                    workOrderId={workOrder.id}
                    totalAmount={workOrder.total_amount ?? 0}
                  />
                )}

                {/* Return/Warranty - Show for finalized orders */}
                {workOrder.workflow_step === "FINALIZADO" && 
                 workOrder.order_type !== "RETORNO" && 
                 isAdminOrManager && (
                  <>
                    <Separator />
                    <ReturnWorkOrderDialog
                      workOrderId={workOrder.id}
                      vehicleId={workOrder.vehicle_id}
                      customerId={workOrder.customer_id}
                      vehiclePlate={workOrder.vehicle?.plate || ""}
                      originalMechanicId={workOrder.current_mechanic_id || undefined}
                      originalMechanicName={workOrder.mechanic?.full_name}
                    />
                  </>
                )}

                <Separator />

                {/* Assigned Mechanic */}
                {workOrder.mechanic ? (
                  <div className="text-sm">
                    <p className="text-muted-foreground mb-1">Mecânico Responsável:</p>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                        {workOrder.mechanic.full_name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)}
                      </div>
                      <span className="font-medium">{workOrder.mechanic.full_name}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhum mecânico atribuído
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Return History Card */}
            {(returnData?.asOriginal?.length || returnData?.asReturn) && (
              <Card className="border-destructive/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-destructive">
                    <RotateCcw className="h-4 w-4" />
                    Retornos de Garantia
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* This order is a RETURN - show link to original */}
                  {returnData?.asReturn && (
                    <div className="rounded-lg bg-destructive/10 p-3 space-y-2">
                      <p className="text-xs font-medium text-destructive">Esta OS é um retorno de:</p>
                      <Link 
                        to={`/ordens/${returnData.asReturn.original_work_order_id}`}
                        className="flex items-center gap-2 text-sm font-medium hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        OS-{returnData.asReturn.original_work_order_id.slice(0, 8).toUpperCase()}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        <strong>Motivo:</strong> {returnData.asReturn.reason}
                      </p>
                    </div>
                  )}

                  {/* This order has spawned returns - show list */}
                  {returnData?.asOriginal?.map((ret) => (
                    <div key={ret.id} className="rounded-lg border border-destructive/20 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <Link 
                          to={`/ordens/${ret.return_work_order_id}`}
                          className="flex items-center gap-2 text-sm font-medium hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          OS-{ret.return_work_order_id.slice(0, 8).toUpperCase()}
                        </Link>
                        <Badge variant="outline" className="text-xs">
                          {ret.return_date && format(new Date(ret.return_date), "dd/MM/yy")}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        <strong>Motivo:</strong> {ret.reason}
                      </p>
                      {ret.mechanic_blamed && (
                        <p className="text-xs text-destructive">
                          <strong>Responsável:</strong> {ret.mechanic_blamed.full_name} (-10 pts)
                        </p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
