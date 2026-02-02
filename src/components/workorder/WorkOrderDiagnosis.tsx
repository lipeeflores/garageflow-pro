import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Stethoscope, 
  Plus, 
  Loader2, 
  Clock,
  User,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { 
  useWorkOrderDiagnostics, 
  useCreateDiagnostic 
} from "@/hooks/useWorkOrderDiagnostics";
import { useUpdateWorkOrder } from "@/hooks/useWorkOrders";
import type { WorkflowStep } from "@/hooks/useWorkOrders";

const diagnosisSchema = z.object({
  technical_report: z.string().min(10, "O parecer técnico deve ter pelo menos 10 caracteres"),
});

type DiagnosisFormData = z.infer<typeof diagnosisSchema>;

interface WorkOrderDiagnosisProps {
  workOrderId: string;
  currentStep: WorkflowStep;
  canEdit: boolean;
}

export function WorkOrderDiagnosis({ 
  workOrderId, 
  currentStep,
  canEdit 
}: WorkOrderDiagnosisProps) {
  const [showForm, setShowForm] = useState(false);
  const [expandedDiagnosis, setExpandedDiagnosis] = useState<string | null>(null);
  
  const { data: diagnostics, isLoading } = useWorkOrderDiagnostics(workOrderId);
  const createDiagnostic = useCreateDiagnostic();
  const updateWorkOrder = useUpdateWorkOrder();
  
  const form = useForm<DiagnosisFormData>({
    resolver: zodResolver(diagnosisSchema),
    defaultValues: {
      technical_report: "",
    },
  });

  const canAddDiagnosis = canEdit && (
    currentStep === "EM_DIAGNOSTICO" || 
    currentStep === "CHECKIN_CONCLUIDO"
  );

  const onSubmit = async (data: DiagnosisFormData) => {
    try {
      await createDiagnostic.mutateAsync({
        work_order_id: workOrderId,
        technical_report: data.technical_report,
      });

      // Update workflow step to awaiting quote
      if (currentStep === "EM_DIAGNOSTICO") {
        await updateWorkOrder.mutateAsync({
          id: workOrderId,
          updates: { workflow_step: "AGUARDANDO_ORCAMENTO" },
        });
      }

      form.reset();
      setShowForm(false);
    } catch (error) {
      // Error handled by hooks
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add diagnosis button */}
      {canAddDiagnosis && !showForm && (
        <Button 
          onClick={() => setShowForm(true)}
          className="w-full gap-2"
          variant="outline"
        >
          <Plus className="h-4 w-4" />
          Adicionar Diagnóstico
        </Button>
      )}

      {/* New diagnosis form */}
      {showForm && (
        <Card className="border-primary/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Stethoscope className="h-4 w-4" />
              Novo Diagnóstico
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="technical_report"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Parecer Técnico *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Descreva os problemas encontrados e as soluções propostas..."
                          className="min-h-[150px] resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => {
                      form.reset();
                      setShowForm(false);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit"
                    disabled={createDiagnostic.isPending}
                  >
                    {createDiagnostic.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      "Salvar Diagnóstico"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Existing diagnostics */}
      {diagnostics && diagnostics.length > 0 ? (
        <div className="space-y-3">
          {diagnostics.map((diagnostic) => (
            <Collapsible 
              key={diagnostic.id}
              open={expandedDiagnosis === diagnostic.id}
              onOpenChange={(open) => setExpandedDiagnosis(open ? diagnostic.id : null)}
            >
              <Card>
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Stethoscope className="h-4 w-4" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-medium">
                            {diagnostic.mechanic?.full_name || "Mecânico"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {diagnostic.created_at && format(
                              new Date(diagnostic.created_at),
                              "dd/MM/yyyy 'às' HH:mm",
                              { locale: ptBR }
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {diagnostic.ended_at && (
                          <Badge variant="secondary" className="text-xs">
                            Concluído
                          </Badge>
                        )}
                        {expandedDiagnosis === diagnostic.id ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="rounded-lg bg-muted/50 p-4">
                      <p className="text-sm whitespace-pre-wrap">
                        {diagnostic.technical_report}
                      </p>
                    </div>
                    
                    {diagnostic.transcription_refined && (
                      <div className="mt-3 rounded-lg bg-accent/10 p-4">
                        <p className="text-xs font-medium text-accent mb-2">
                          Transcrição Refinada por IA
                        </p>
                        <p className="text-sm whitespace-pre-wrap">
                          {diagnostic.transcription_refined}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      ) : !showForm && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Stethoscope className="h-10 w-10 text-muted-foreground/50" />
          <p className="mt-2 text-sm text-muted-foreground">
            Nenhum diagnóstico registrado
          </p>
        </div>
      )}
    </div>
  );
}
