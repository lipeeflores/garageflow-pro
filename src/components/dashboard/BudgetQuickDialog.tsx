import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Car, 
  User, 
  Phone, 
  FileText, 
  DollarSign,
  Loader2,
  Send,
  ExternalLink,
  CheckCircle2,
  ClipboardList
} from "lucide-react";
import { type WorkOrder, useUpdateWorkOrder } from "@/hooks/useWorkOrders";
import { useWorkOrderItems } from "@/hooks/useWorkOrderItems";
import { WorkOrderBudget } from "@/components/workorder/WorkOrderBudget";
import { ShareBudgetButton } from "@/components/workorder/ShareBudgetButton";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface BudgetQuickDialogProps {
  order: WorkOrder;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BudgetQuickDialog({ order, open, onOpenChange }: BudgetQuickDialogProps) {
  const updateWorkOrder = useUpdateWorkOrder();
  const { data: items } = useWorkOrderItems(order.id);
  const { toast } = useToast();

  // Check if all items have pricing
  const allItemsPriced = items?.every(item => item.pricing?.total_price != null && Number(item.pricing.total_price) > 0) ?? false;
  const hasItems = items && items.length > 0;
  const canSendToApproval = hasItems && allItemsPriced;

  // Calculate total
  const totalAmount = items?.reduce((sum, item) => {
    return sum + (Number(item.pricing?.total_price) || 0);
  }, 0) ?? 0;

  const handleSendToApproval = async () => {
    try {
      await updateWorkOrder.mutateAsync({
        id: order.id,
        updates: {
          workflow_step: "AGUARDANDO_APROVACAO",
          total_amount: totalAmount,
        },
      });
      onOpenChange(false);
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleGeneratePartsReport = () => {
    if (!items || items.length === 0) return;

    const parts = items.filter(i => i.item_type === "PART");
    if (parts.length === 0) {
      toast({ title: "Sem peças", description: "Nenhuma peça encontrada para gerar relatório.", variant: "destructive" });
      return;
    }

    const vehicleInfo = `${order.vehicle?.make || ""} ${order.vehicle?.model || ""} ${order.vehicle?.year || ""} - Placa: ${order.vehicle?.plate || ""}`.trim();
    
    let report = `RELATÓRIO DE PEÇAS PARA COTAÇÃO\n`;
    report += `${"=".repeat(40)}\n\n`;
    report += `Veículo: ${vehicleInfo}\n`;
    if (order.vehicle?.color) report += `Cor: ${order.vehicle.color}\n`;
    report += `OS: OS-${order.id.slice(0, 8).toUpperCase()}\n`;
    report += `Data: ${new Date().toLocaleDateString("pt-BR")}\n\n`;
    report += `${"─".repeat(40)}\n`;
    report += `PEÇAS NECESSÁRIAS:\n`;
    report += `${"─".repeat(40)}\n\n`;

    parts.forEach((part, idx) => {
      report += `${idx + 1}. ${part.description}\n`;
      report += `   Quantidade: ${part.quantity}\n`;
      if (part.part_code) report += `   Código: ${part.part_code}\n`;
      report += `\n`;
    });

    report += `${"─".repeat(40)}\n`;
    report += `Total de itens: ${parts.length}\n`;

    // Copy to clipboard
    navigator.clipboard.writeText(report).then(() => {
      toast({ title: "Copiado!", description: "Relatório de peças copiado para a área de transferência." });
    }).catch(() => {
      // Fallback: download as text file
      const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pecas-${order.vehicle?.plate || "veiculo"}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Download", description: "Relatório de peças baixado." });
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="flex items-center gap-2 font-display">
            <DollarSign className="h-5 w-5 text-warning" />
            Montar Orçamento
          </DialogTitle>
          <DialogDescription>
            Monte o orçamento baseado no diagnóstico do mecânico
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 overflow-y-auto" style={{ maxHeight: "calc(90vh - 200px)" }}>
          <div className="space-y-4 pb-4">
            {/* Vehicle & Customer Info */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Car className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Badge variant="outline" className="font-display text-base mb-1">
                    {order.vehicle?.plate}
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    {order.vehicle?.make} {order.vehicle?.model} {order.vehicle?.year}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <User className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{order.customer?.full_name}</p>
                  {order.customer?.phone_number && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      {order.customer.phone_number}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Initial Complaint */}
            {order.initial_complaint && (
              <div className="p-3 rounded-lg border bg-card">
                <div className="flex items-center gap-2 text-sm font-medium mb-2">
                  <FileText className="h-4 w-4" />
                  Reclamação Inicial
                </div>
                <p className="text-sm text-muted-foreground">{order.initial_complaint}</p>
              </div>
            )}

            <Separator />

            {/* Budget Section */}
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Itens do Orçamento
              </h4>
              <WorkOrderBudget 
                workOrderId={order.id} 
                canEdit={true}
              />
            </div>

            {/* Status indicators */}
            {hasItems && (
              <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  {allItemsPriced ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border-2 border-warning" />
                  )}
                  <span className="text-sm">
                    {allItemsPriced ? "Todos os itens precificados" : "Preencha os preços de todos os itens"}
                  </span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="border-t p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            {/* View full order link */}
            <Button variant="ghost" size="sm" asChild className="sm:mr-auto">
              <a href={`/ordens/${order.id}`}>
                <ExternalLink className="h-4 w-4 mr-1" />
                Ver OS completa
              </a>
            </Button>

            <div className="flex flex-wrap gap-2">
              {/* Generate parts report */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleGeneratePartsReport}
                className="gap-2"
              >
                <ClipboardList className="h-4 w-4" />
                Relatório de Peças
              </Button>

              {/* Share budget button */}
              {canSendToApproval && (
                <ShareBudgetButton workOrderId={order.id} />
              )}

              {/* Send to approval */}
              <Button
                onClick={handleSendToApproval}
                disabled={!canSendToApproval || updateWorkOrder.isPending}
                size="sm"
                className={cn(
                  "gap-2",
                  canSendToApproval && "bg-success hover:bg-success/90"
                )}
              >
                {updateWorkOrder.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Enviar para Aprovação
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
