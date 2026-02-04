import { Button } from "@/components/ui/button";
import { 
  Camera, 
  Stethoscope, 
  Send, 
  CheckCircle, 
  FileText,
  Eye
} from "lucide-react";
import { useUpdateWorkOrder, type WorkflowStep } from "@/hooks/useWorkOrders";
import { useNavigate } from "react-router-dom";

interface WorkOrderActionsProps {
  orderId: string;
  workflowStep: WorkflowStep;
  onCheckinClick: () => void;
}

export function WorkOrderActions({ orderId, workflowStep, onCheckinClick }: WorkOrderActionsProps) {
  const updateWorkOrder = useUpdateWorkOrder();
  const navigate = useNavigate();

  const handleStartDiagnosis = () => {
    updateWorkOrder.mutate({
      id: orderId,
      updates: { workflow_step: 'EM_DIAGNOSTICO' },
    });
  };

  const handleSendToQuote = () => {
    updateWorkOrder.mutate({
      id: orderId,
      updates: { workflow_step: 'AGUARDANDO_ORCAMENTO' },
    });
  };

  const handleStartExecution = () => {
    updateWorkOrder.mutate({
      id: orderId,
      updates: { workflow_step: 'EM_EXECUCAO' },
    });
  };

  const handleComplete = () => {
    updateWorkOrder.mutate({
      id: orderId,
      updates: { workflow_step: 'EM_QUALIDADE' },
    });
  };

  const handleViewDetails = () => {
    navigate(`/ordens/${orderId}`);
  };

  // Define action buttons based on current workflow step
  const getActionButton = () => {
    switch (workflowStep) {
      case "AGUARDANDO_CHECKIN":
        return (
          <Button
            size="sm"
            className="gap-1.5 bg-success hover:bg-success/90 text-success-foreground"
            onClick={onCheckinClick}
          >
            <Camera className="h-4 w-4" />
            Iniciar Check-in
          </Button>
        );
      case "CHECKIN_CONCLUIDO":
        return (
          <Button
            size="sm"
            className="gap-1.5 bg-warning hover:bg-warning/90 text-warning-foreground"
            onClick={handleStartDiagnosis}
          >
            <Stethoscope className="h-4 w-4" />
            Iniciar Diagnóstico
          </Button>
        );
      case "EM_DIAGNOSTICO":
        return (
          <Button
            size="sm"
            className="gap-1.5 bg-accent hover:bg-accent/90"
            onClick={handleSendToQuote}
          >
            <Send className="h-4 w-4" />
            Enviar p/ Orçamento
          </Button>
        );
      case "AGUARDANDO_ORCAMENTO":
        return (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={handleViewDetails}
          >
            <FileText className="h-4 w-4" />
            Elaborar Orçamento
          </Button>
        );
      case "AGUARDANDO_APROVACAO":
        return (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-muted-foreground"
            disabled
          >
            Aguardando Cliente...
          </Button>
        );
      case "APROVADO":
        return (
          <Button
            size="sm"
            className="gap-1.5 bg-primary hover:bg-primary/90"
            onClick={handleStartExecution}
          >
            <Stethoscope className="h-4 w-4" />
            Iniciar Execução
          </Button>
        );
      case "EM_EXECUCAO":
        return (
          <Button
            size="sm"
            className="gap-1.5 bg-success hover:bg-success/90 text-success-foreground"
            onClick={handleComplete}
          >
            <CheckCircle className="h-4 w-4" />
            Concluir Serviço
          </Button>
        );
      case "EM_QUALIDADE":
      case "AJUSTES":
        return (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-muted-foreground"
            disabled
          >
            Em Controle de Qualidade
          </Button>
        );
      case "PRONTO_PARA_RETIRADA":
        return (
          <Button
            size="sm"
            className="gap-1.5 bg-success hover:bg-success/90 text-success-foreground"
            onClick={handleViewDetails}
          >
            <CheckCircle className="h-4 w-4" />
            Finalizar Entrega
          </Button>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex items-center gap-2">
      {getActionButton()}
      <Button
        size="sm"
        variant="ghost"
        className="gap-1.5"
        onClick={handleViewDetails}
      >
        <Eye className="h-4 w-4" />
        <span className="hidden sm:inline">Ver Detalhes</span>
      </Button>
    </div>
  );
}
