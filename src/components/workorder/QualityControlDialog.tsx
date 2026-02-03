import { useState } from "react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";

interface QualityControlDialogProps {
  workOrderId: string;
  onComplete?: () => void;
  trigger?: React.ReactNode;
}

export function QualityControlDialog({ 
  workOrderId, 
  onComplete,
  trigger 
}: QualityControlDialogProps) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const handleSubmit = async (approve: boolean) => {
    if (!profile?.tenant_id || !profile.id) return;

    setSubmitting(true);
    try {
      // Create quality record
      const { error: qcError } = await supabase
        .from('work_order_quality')
        .insert({
          work_order_id: workOrderId,
          tenant_id: profile.tenant_id,
          manager_id: profile.id,
          status: approve ? 'APROVADO' : 'DEVOLVIDO_AJUSTES',
          notes: notes || null,
          inspected_at: new Date().toISOString(),
        });

      if (qcError) throw qcError;

      // Update work order status
      const newStep = approve ? 'PRONTO_PARA_RETIRADA' : 'AJUSTES';
      const { error: updateError } = await supabase
        .from('work_orders')
        .update({ workflow_step: newStep })
        .eq('id', workOrderId);

      if (updateError) throw updateError;

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['work_orders'] });
      queryClient.invalidateQueries({ queryKey: ['work_order', workOrderId] });

      toast({
        title: approve ? "Qualidade Aprovada" : "Devolvido para Ajustes",
        description: approve 
          ? "O veículo está pronto para retirada."
          : "O mecânico foi notificado sobre os ajustes necessários.",
      });

      setOpen(false);
      setNotes("");
      onComplete?.();
    } catch (error) {
      console.error('Error submitting QC:', error);
      toast({
        title: "Erro",
        description: "Não foi possível registrar a inspeção de qualidade.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="w-full gap-2">
            <CheckCircle className="h-4 w-4" />
            Controle de Qualidade
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Controle de Qualidade</DialogTitle>
          <DialogDescription>
            Inspecione o veículo e registre sua avaliação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="qc-notes">Observações da Inspeção</Label>
            <Textarea
              id="qc-notes"
              placeholder="Descreva os pontos verificados, problemas encontrados ou observações gerais..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="destructive"
            className="w-full gap-2 sm:w-auto"
            onClick={() => handleSubmit(false)}
            disabled={submitting}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            Devolver p/ Ajustes
          </Button>
          <Button
            className="w-full gap-2 bg-success hover:bg-success/90 sm:w-auto"
            onClick={() => handleSubmit(true)}
            disabled={submitting}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            Aprovar Qualidade
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
