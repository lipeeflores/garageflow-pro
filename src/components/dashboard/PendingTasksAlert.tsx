import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  AlertTriangle, 
  FileText, 
  Car, 
  User, 
  Clock,
  ChevronRight,
  DollarSign,
  Bell,
  PackageCheck,
  Phone,
  MessageCircle
} from "lucide-react";
import { useWorkOrders, type WorkOrder } from "@/hooks/useWorkOrders";
import { cn } from "@/lib/utils";
import { useSoundAlerts } from "@/hooks/useSoundAlerts";
import { BudgetQuickDialog } from "./BudgetQuickDialog";

export function PendingTasksAlert() {
  const [playedIds, setPlayedIds] = useState<Set<string>>(new Set());
  const { playSound } = useSoundAlerts();
  

  // Fetch orders waiting for budget
  const { data: pendingBudgetOrders } = useWorkOrders({
    workflow_step: ["AGUARDANDO_ORCAMENTO"],
  });

  // Fetch orders waiting for approval (also important for admin)
  const { data: pendingApprovalOrders } = useWorkOrders({
    workflow_step: ["AGUARDANDO_APROVACAO"],
  });

  // Fetch orders ready for pickup - need to notify customer
  const { data: readyForPickupOrders } = useWorkOrders({
    workflow_step: ["PRONTO_PARA_RETIRADA"],
  });

  const pendingBudgetCount = pendingBudgetOrders?.length ?? 0;
  const pendingApprovalCount = pendingApprovalOrders?.length ?? 0;
  const readyForPickupCount = readyForPickupOrders?.length ?? 0;

  // Play sound when new orders need budget
  useEffect(() => {
    if (pendingBudgetOrders && pendingBudgetOrders.length > 0) {
      const newOrders = pendingBudgetOrders.filter(o => !playedIds.has(o.id));
      if (newOrders.length > 0) {
        playSound("warning");
        setPlayedIds(prev => {
          const newSet = new Set(prev);
          newOrders.forEach(o => newSet.add(o.id));
          return newSet;
        });
      }
    }
  }, [pendingBudgetOrders, playedIds, playSound]);

  // Play sound when orders are ready for pickup
  useEffect(() => {
    if (readyForPickupOrders && readyForPickupOrders.length > 0) {
      const newOrders = readyForPickupOrders.filter(o => !playedIds.has(`ready-${o.id}`));
      if (newOrders.length > 0) {
        playSound("ready");
        setPlayedIds(prev => {
          const newSet = new Set(prev);
          newOrders.forEach(o => newSet.add(`ready-${o.id}`));
          return newSet;
        });
      }
    }
  }, [readyForPickupOrders, playedIds, playSound]);

  if (pendingBudgetCount === 0 && pendingApprovalCount === 0 && readyForPickupCount === 0) {
    return null;
  }

  return (
    <Card className="border-warning/50 bg-warning/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-warning/20 animate-pulse">
            <Bell className="h-4 w-4 text-warning" />
          </div>
          <CardTitle className="text-base font-display flex items-center gap-2">
            Tarefas Pendentes
            <Badge variant="destructive" className="animate-pulse">
              {pendingBudgetCount + pendingApprovalCount + readyForPickupCount}
            </Badge>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pending Budget Section - URGENT */}
        {pendingBudgetCount > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-warning">
              <AlertTriangle className="h-4 w-4" />
              <span>Aguardando Orçamento ({pendingBudgetCount})</span>
            </div>
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-2">
                {pendingBudgetOrders?.map((order) => (
                  <PendingOrderCard 
                    key={order.id} 
                    order={order} 
                    type="budget"
                  />
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Ready for Pickup Section - Need to notify customer */}
        {readyForPickupCount > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-success">
              <PackageCheck className="h-4 w-4" />
              <span>Prontos para Retirada ({readyForPickupCount})</span>
            </div>
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-2">
                {readyForPickupOrders?.map((order) => (
                  <PendingOrderCard 
                    key={order.id} 
                    order={order} 
                    type="ready"
                  />
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Pending Approval Section */}
        {pendingApprovalCount > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Aguardando Aprovação do Cliente ({pendingApprovalCount})</span>
            </div>
            <ScrollArea className="max-h-[150px]">
              <div className="space-y-2">
                {pendingApprovalOrders?.slice(0, 3).map((order) => (
                  <PendingOrderCard 
                    key={order.id} 
                    order={order} 
                    type="approval"
                  />
                ))}
                {pendingApprovalCount > 3 && (
                  <p className="text-xs text-muted-foreground text-center py-1">
                    +{pendingApprovalCount - 3} mais aguardando aprovação
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface PendingOrderCardProps {
  order: WorkOrder;
  type: "budget" | "approval" | "ready";
}

function PendingOrderCard({ order, type }: PendingOrderCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const timeSinceCreated = () => {
    const created = new Date(order.created_at!);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMins}min`;
    }
    return `${diffMins}min`;
  };

  const formatPhoneForWhatsApp = (phone: string | undefined) => {
    if (!phone) return null;
    // Remove non-digits
    const digits = phone.replace(/\D/g, '');
    // Add Brazil country code if not present
    if (digits.length === 11) {
      return `55${digits}`;
    }
    return digits;
  };

  const whatsappPhone = formatPhoneForWhatsApp(order.customer?.phone_number);
  const vehicleInfo = `${order.vehicle?.make} ${order.vehicle?.model} - Placa ${order.vehicle?.plate}`;
  const pickupMessage = encodeURIComponent(
    `Olá ${order.customer?.full_name}! 🚗\n\nSeu veículo ${vehicleInfo} está pronto para retirada!\n\nAguardamos você. 😊`
  );

  return (
    <>
      <div
        className={cn(
          "flex items-center justify-between p-3 rounded-lg border transition-all",
          type === "budget" 
            ? "bg-warning/10 border-warning/30 hover:border-warning/50" 
            : type === "ready"
            ? "bg-success/10 border-success/30 hover:border-success/50"
            : "bg-muted/50 border-border hover:border-border/80"
        )}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Vehicle plate badge */}
          <Badge 
            variant="outline" 
            className={cn(
              "font-display text-sm px-2 py-1 shrink-0",
              type === "budget" && "border-warning text-warning bg-warning/10",
              type === "ready" && "border-success text-success bg-success/10"
            )}
          >
            {order.vehicle?.plate || "---"}
          </Badge>

          {/* Vehicle and customer info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 text-sm truncate">
              <Car className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="truncate">
                {order.vehicle?.make} {order.vehicle?.model}
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
              <User className="h-3 w-3 shrink-0" />
              <span className="truncate">{order.customer?.full_name}</span>
              {order.customer?.phone_number && (
                <>
                  <span className="mx-1">•</span>
                  <Phone className="h-3 w-3 shrink-0" />
                  <span>{order.customer.phone_number}</span>
                </>
              )}
            </div>
          </div>

          {/* Time elapsed */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
            <Clock className="h-3 w-3" />
            <span>{timeSinceCreated()}</span>
          </div>
        </div>

        {/* Action buttons */}
        {type === "budget" ? (
          <Button 
            size="sm" 
            className="ml-2 gap-1 bg-warning hover:bg-warning/90 text-warning-foreground shrink-0"
            onClick={() => setDialogOpen(true)}
          >
            <DollarSign className="h-3 w-3" />
            <span className="hidden sm:inline">Montar Orçamento</span>
            <span className="sm:hidden">Orçar</span>
          </Button>
        ) : type === "ready" ? (
          <div className="flex items-center gap-2 ml-2 shrink-0">
            {whatsappPhone && (
              <Button 
                size="sm" 
                className="gap-1 bg-[#25D366] hover:bg-[#25D366]/90 text-white"
                asChild
              >
                <a 
                  href={`https://wa.me/${whatsappPhone}?text=${pickupMessage}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="h-3 w-3" />
                  <span className="hidden sm:inline">Avisar Cliente</span>
                  <span className="sm:hidden">WhatsApp</span>
                </a>
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="sm"
              className="gap-1"
              asChild
            >
              <a href={`/ordem/${order.id}`}>
                <FileText className="h-3 w-3" />
                <span className="hidden sm:inline">Ver OS</span>
              </a>
            </Button>
          </div>
        ) : (
          <Button 
            variant="ghost" 
            size="sm"
            className="ml-2 gap-1 shrink-0"
            asChild
          >
            <a href={`/ordem/${order.id}`}>
              <FileText className="h-3 w-3" />
              Ver OS
              <ChevronRight className="h-3 w-3" />
            </a>
          </Button>
        )}
      </div>

      {type === "budget" && (
        <BudgetQuickDialog 
          order={order}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      )}
    </>
  );
}