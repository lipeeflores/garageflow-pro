import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Car, User, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkflowStep } from "@/hooks/useWorkOrders";
import { CheckinDialog } from "@/components/checkin/CheckinDialog";
import { WorkflowStepIndicator } from "./WorkflowStepIndicator";
import { WorkOrderActions } from "./WorkOrderActions";

const priorityColors = {
  BAIXA: "bg-muted text-muted-foreground",
  MEDIA: "bg-warning/20 text-warning",
  ALTA: "bg-destructive/20 text-destructive",
};

const boxLabels: Record<string, string> = {
  BOX_1: "Box 1",
  BOX_2: "Box 2",
  BOX_3: "Box 3",
  BOX_4: "Box 4",
  PATIO: "Pátio",
};

interface WorkOrderCardProps {
  order: {
    id: string;
    workflow_step: WorkflowStep;
    priority: "BAIXA" | "MEDIA" | "ALTA" | null;
    box_location: string | null;
    vehicle?: {
      plate: string;
      make: string;
      model: string;
      year: number | null;
    } | null;
    customer?: {
      full_name: string;
    } | null;
    mechanic?: {
      full_name: string;
    } | null;
    initial_complaint?: string | null;
  };
}

export function WorkOrderCard({ order }: WorkOrderCardProps) {
  const [checkinOpen, setCheckinOpen] = useState(false);
  const priority = order.priority || "MEDIA";

  return (
    <>
      <Card className="overflow-hidden transition-all hover:shadow-md">
        <CardContent className="p-0">
          {/* Workflow Step Indicator at top */}
          <div className="border-b border-border bg-muted/30 px-4 py-3">
            <WorkflowStepIndicator currentStep={order.workflow_step} />
          </div>

          {/* Main Content */}
          <div className="p-4">
            <div className="flex items-start justify-between gap-4">
              {/* Left: Vehicle & Customer Info */}
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Car className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display text-lg font-bold">
                      {order.vehicle?.plate || "---"}
                    </span>
                    <Badge className={cn("text-xs", priorityColors[priority])}>
                      {priority === "ALTA" ? "Alta" : priority === "BAIXA" ? "Baixa" : "Média"}
                    </Badge>
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1 truncate">
                      <User className="h-3.5 w-3.5 flex-shrink-0" />
                      {order.customer?.full_name || "Cliente não definido"}
                    </span>
                    {order.box_location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {boxLabels[order.box_location] || order.box_location}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {order.vehicle?.make} {order.vehicle?.model} {order.vehicle?.year}
                  </p>
                </div>
              </div>

              {/* Right: Order ID and Mechanic */}
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-muted-foreground">
                  OS-{order.id.slice(0, 8).toUpperCase()}
                </p>
                {order.mechanic?.full_name && (
                  <div className="mt-1 flex items-center justify-end gap-1.5">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      {order.mechanic.full_name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                    <span className="text-xs font-medium hidden sm:inline">
                      {order.mechanic.full_name.split(" ")[0]}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Complaint Preview */}
            {order.initial_complaint && (
              <p className="mt-3 text-sm text-muted-foreground line-clamp-1 bg-muted/50 rounded px-2 py-1">
                {order.initial_complaint}
              </p>
            )}

            {/* Action Buttons */}
            <div className="mt-4 flex items-center justify-end border-t border-border pt-3">
              <WorkOrderActions
                orderId={order.id}
                workflowStep={order.workflow_step}
                onCheckinClick={() => setCheckinOpen(true)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <CheckinDialog
        open={checkinOpen}
        onOpenChange={setCheckinOpen}
        workOrderId={order.id}
        vehiclePlate={order.vehicle?.plate || "---"}
      />
    </>
  );
}
