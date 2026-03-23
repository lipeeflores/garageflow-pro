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
  ChevronDown,
  ChevronUp,
  Mic,
  Camera
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  useWorkOrderDiagnostics, 
  useCreateDiagnostic 
} from "@/hooks/useWorkOrderDiagnostics";
import { useUpdateWorkOrder } from "@/hooks/useWorkOrders";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AudioRecorder } from "./AudioRecorder";
import { PhotoUpload } from "./PhotoUpload";
import { DiagnosisItemsList } from "./DiagnosisItemsList";
import type { WorkflowStep } from "@/hooks/useWorkOrders";

const diagnosisSchema = z.object({
  technical_report: z.string().min(10, "O parecer técnico deve ter pelo menos 10 caracteres"),
  transcription_raw: z.string().optional(),
  transcription_refined: z.string().optional(),
  voice_memo_url: z.string().optional(),
});

type DiagnosisFormData = z.infer<typeof diagnosisSchema>;

interface WorkOrderDiagnosisProps {
  workOrderId: string;
  currentStep: WorkflowStep;
  canEdit: boolean;
  vehicleInfo?: string;
}

export function WorkOrderDiagnosis({ 
  workOrderId, 
  currentStep,
  canEdit,
  vehicleInfo 
}: WorkOrderDiagnosisProps) {
  const [showForm, setShowForm] = useState(false);
  const [expandedDiagnosis, setExpandedDiagnosis] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<"text" | "audio">("text");
  
  const { data: diagnostics, isLoading } = useWorkOrderDiagnostics(workOrderId);
  const createDiagnostic = useCreateDiagnostic();
  const updateWorkOrder = useUpdateWorkOrder();
  const { toast } = useToast();
  
  const form = useForm<DiagnosisFormData>({
    resolver: zodResolver(diagnosisSchema),
    defaultValues: {
      technical_report: "",
      transcription_raw: "",
      transcription_refined: "",
      voice_memo_url: "",
    },
  });

  const canAddDiagnosis = canEdit && (
    currentStep === "EM_DIAGNOSTICO" || 
    currentStep === "CHECKIN_CONCLUIDO"
  );

  const handleTranscriptionComplete = (raw: string, refined: string, audioUrl: string) => {
    form.setValue("technical_report", refined || raw);
    form.setValue("transcription_raw", raw);
    form.setValue("transcription_refined", refined);
    form.setValue("voice_memo_url", audioUrl);
  };

  const onSubmit = async (data: DiagnosisFormData) => {
    try {
      let technicalReport = data.technical_report;
      let transcriptionRaw = data.transcription_raw || null;
      let transcriptionRefined = data.transcription_refined || null;

      // Refino com IA para diagnóstico digitado manualmente
      if (inputMode === "text" && technicalReport.trim().length >= 10) {
        const { data: refinedData, error: refineError } = await supabase.functions.invoke("transcribe-audio", {
          body: {
            technical_report: technicalReport,
            context: vehicleInfo || "",
          },
        });

        if (refineError) {
          console.error("Error refining diagnosis text:", refineError);
          toast({
            title: "Atenção",
            description: "Não foi possível refinar com IA agora. O texto original será salvo.",
            variant: "destructive",
          });
        } else if (refinedData?.transcription_refined) {
          transcriptionRaw = technicalReport;
          transcriptionRefined = refinedData.transcription_refined;
          technicalReport = refinedData.transcription_refined;
        }
      }

      await createDiagnostic.mutateAsync({
        work_order_id: workOrderId,
        technical_report: technicalReport,
        transcription_raw: transcriptionRaw,
        transcription_refined: transcriptionRefined,
        voice_memo_url: data.voice_memo_url || null,
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
      setInputMode("text");
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
            <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as "text" | "audio")}>
              <TabsList className="mb-4">
                <TabsTrigger value="text">Digitar</TabsTrigger>
                <TabsTrigger value="audio" className="gap-2">
                  <Mic className="h-4 w-4" />
                  Gravar Áudio
                </TabsTrigger>
              </TabsList>

              <TabsContent value="audio" className="mt-0">
                <AudioRecorder
                  onTranscriptionComplete={handleTranscriptionComplete}
                  vehicleContext={vehicleInfo}
                  disabled={createDiagnostic.isPending}
                />
              </TabsContent>

              <TabsContent value="text" className="mt-0">
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
                          setInputMode("text");
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
              </TabsContent>
            </Tabs>

            {/* Show form when audio mode has transcription ready */}
            {inputMode === "audio" && form.watch("technical_report") && (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 space-y-4">
                  <FormField
                    control={form.control}
                    name="technical_report"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Parecer Técnico (refinado pela IA)</FormLabel>
                        <FormControl>
                          <Textarea
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
                        setInputMode("text");
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
            )}
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

      {/* Items/Parts Section - visible during diagnosis */}
      {(currentStep === "EM_DIAGNOSTICO" || currentStep === "AGUARDANDO_ORCAMENTO" || currentStep === "EM_EXECUCAO" || currentStep === "AJUSTES") && (
        <DiagnosisItemsList
          workOrderId={workOrderId}
          canEdit={canEdit && (currentStep === "EM_DIAGNOSTICO" || currentStep === "EM_EXECUCAO" || currentStep === "AJUSTES")}
        />
      )}

      {/* Photo Upload Section */}
      {(currentStep === "EM_DIAGNOSTICO" || currentStep === "EM_EXECUCAO" || currentStep === "AJUSTES") && canEdit && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Fotos do {currentStep === "EM_DIAGNOSTICO" ? "Diagnóstico" : "Serviço"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PhotoUpload
              workOrderId={workOrderId}
              attachmentType={currentStep === "EM_DIAGNOSTICO" ? "DIAGNOSIS_PHOTO" : "EXECUTION_PHOTO"}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
