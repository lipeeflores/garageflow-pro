import { cn } from "@/lib/utils";
import { 
  Camera, 
  Stethoscope, 
  FileText, 
  ThumbsUp, 
  Wrench, 
  CheckCircle, 
  Car,
  ChevronRight
} from "lucide-react";
import type { WorkflowStep } from "@/hooks/useWorkOrders";

interface WorkflowStepIndicatorProps {
  currentStep: WorkflowStep;
  className?: string;
}

type StepConfig = {
  key: WorkflowStep;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
};

const workflowSteps: StepConfig[] = [
  { key: "AGUARDANDO_CHECKIN", label: "Check-in", shortLabel: "Check-in", icon: Camera },
  { key: "CHECKIN_CONCLUIDO", label: "Check-in OK", shortLabel: "Check-in", icon: Camera },
  { key: "EM_DIAGNOSTICO", label: "Diagnóstico", shortLabel: "Diag.", icon: Stethoscope },
  { key: "AGUARDANDO_ORCAMENTO", label: "Orçamento", shortLabel: "Orç.", icon: FileText },
  { key: "AGUARDANDO_APROVACAO", label: "Aprovação", shortLabel: "Aprov.", icon: ThumbsUp },
  { key: "APROVADO", label: "Aprovado", shortLabel: "Aprov.", icon: ThumbsUp },
  { key: "EM_EXECUCAO", label: "Execução", shortLabel: "Exec.", icon: Wrench },
  { key: "EM_QUALIDADE", label: "Qualidade", shortLabel: "Qual.", icon: CheckCircle },
  { key: "AJUSTES", label: "Ajustes", shortLabel: "Ajust.", icon: Wrench },
  { key: "PRONTO_PARA_RETIRADA", label: "Entrega", shortLabel: "Entreg.", icon: Car },
];

// Main flow steps to display (simplified view)
const displaySteps: StepConfig[] = [
  { key: "AGUARDANDO_CHECKIN", label: "Check-in", shortLabel: "Check-in", icon: Camera },
  { key: "EM_DIAGNOSTICO", label: "Diagnóstico", shortLabel: "Diag.", icon: Stethoscope },
  { key: "AGUARDANDO_ORCAMENTO", label: "Orçamento", shortLabel: "Orç.", icon: FileText },
  { key: "AGUARDANDO_APROVACAO", label: "Aprovação", shortLabel: "Aprov.", icon: ThumbsUp },
  { key: "EM_EXECUCAO", label: "Execução", shortLabel: "Exec.", icon: Wrench },
  { key: "EM_QUALIDADE", label: "Qualidade", shortLabel: "Qual.", icon: CheckCircle },
  { key: "PRONTO_PARA_RETIRADA", label: "Entrega", shortLabel: "Entreg.", icon: Car },
];

// Map intermediate steps to their display equivalent
const stepToDisplayIndex: Record<WorkflowStep, number> = {
  AGUARDANDO_CHECKIN: 0,
  CHECKIN_CONCLUIDO: 0, // Still in check-in phase
  EM_DIAGNOSTICO: 1,
  AGUARDANDO_ORCAMENTO: 2,
  AGUARDANDO_APROVACAO: 3,
  APROVADO: 3, // Still in approval phase
  EM_EXECUCAO: 4,
  EM_QUALIDADE: 5,
  AJUSTES: 5, // Still in quality phase
  PRONTO_PARA_RETIRADA: 6,
  FINALIZADO: 6,
  CANCELADO: -1,
};

export function WorkflowStepIndicator({ currentStep, className }: WorkflowStepIndicatorProps) {
  const currentIndex = stepToDisplayIndex[currentStep];

  if (currentStep === "CANCELADO" || currentStep === "FINALIZADO") {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-1 overflow-x-auto pb-2", className)}>
      {displaySteps.map((step, index) => {
        const Icon = step.icon;
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isPending = index > currentIndex;

        return (
          <div key={step.key} className="flex items-center">
            <div
              className={cn(
                "flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap",
                isCompleted && "bg-success/20 text-success",
                isCurrent && "bg-primary text-primary-foreground shadow-sm",
                isPending && "bg-muted/50 text-muted-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{step.label}</span>
              <span className="sm:hidden">{step.shortLabel}</span>
            </div>
            {index < displaySteps.length - 1 && (
              <ChevronRight 
                className={cn(
                  "h-4 w-4 mx-0.5 flex-shrink-0",
                  isCompleted ? "text-success" : "text-muted-foreground/40"
                )} 
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
