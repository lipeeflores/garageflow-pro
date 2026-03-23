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
  Wrench, 
  Package,
  DollarSign,
  Loader2,
  Send,
  ExternalLink,
  CheckCircle2
} from "lucide-react";
import { type WorkOrder, useUpdateWorkOrder } from "@/hooks/useWorkOrders";
import { useWorkOrderItems } from "@/hooks/useWorkOrderItems";
import { WorkOrderBudget } from "@/components/workorder/WorkOrderBudget";
import { ShareBudgetButton } from "@/components/workorder/ShareBudgetButton";
import { cn } from "@/lib/utils";

interface BudgetQuickDialogProps {
  order: WorkOrder;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BudgetQuickDialog({ order, open, onOpenChange }: BudgetQuickDialogProps) {
  const updateWorkOrder = useUpdateWorkOrder();
  const { data: items } = useWorkOrderItems(order.id);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <DollarSign className="h-5 w-5 text-warning" />
            Montar Orçamento
          </DialogTitle>
          <DialogDescription>
            Monte o orçamento baseado no diagnóstico do mecânico
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4">
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
                  {order.vehicle?.color && (
                    <p className="text-xs text-muted-foreground">{order.vehicle.color}</p>
                  )}
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

        <Separator className="my-4" />

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {/* View full order link */}
          <Button variant="ghost" size="sm" asChild className="sm:mr-auto">
            <a href={`/ordens/${order.id}`}>
              <ExternalLink className="h-4 w-4 mr-1" />
              Ver OS completa
            </a>
          </Button>

          <div className="flex gap-2">
            {/* Share budget button */}
            {canSendToApproval && (
              <ShareBudgetButton workOrderId={order.id} />
            )}

            {/* Send to approval */}
            <Button
              onClick={handleSendToApproval}
              disabled={!canSendToApproval || updateWorkOrder.isPending}
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
