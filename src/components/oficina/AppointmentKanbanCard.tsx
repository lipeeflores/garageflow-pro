import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, Car } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CheckinDialog } from "@/components/checkin";
import { useConvertAppointmentToWorkOrder, type Appointment } from "@/hooks/useAppointments";

interface AppointmentKanbanCardProps {
  appointment: Appointment;
}

export function AppointmentKanbanCard({ appointment }: AppointmentKanbanCardProps) {
  const convertToWorkOrder = useConvertAppointmentToWorkOrder();
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [createdWorkOrderId, setCreatedWorkOrderId] = useState<string | null>(null);

  const scheduledTime = format(new Date(appointment.scheduled_at), "HH:mm", {
    locale: ptBR,
  });

  const handleArrival = async () => {
    if (!appointment.customer_id || !appointment.vehicle_id) {
      return;
    }
    try {
      const workOrder = await convertToWorkOrder.mutateAsync({
        appointmentId: appointment.id,
        customerId: appointment.customer_id,
        vehicleId: appointment.vehicle_id,
        reason: appointment.reason,
      });
      // Immediately open check-in dialog after creating the WO
      setCreatedWorkOrderId(workOrder.id);
      setCheckinOpen(true);
    } catch (error) {
      // Error toast is handled by the mutation
    }
  };

  return (
    <>
      <div className="group relative rounded-lg border border-border/50 bg-card/80 p-3 transition-all hover:border-border hover:shadow-md">
        {/* Header */}
        <div className="mb-2">
          <p className="text-sm font-medium truncate">
            {appointment.customer?.full_name || "Cliente"}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {appointment.vehicle?.make} {appointment.vehicle?.model}
          </p>
        </div>

        {/* Plate - Main identifier */}
        <div className="mb-2">
          {appointment.vehicle?.plate ? (
            <span className="inline-block rounded bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
              {appointment.vehicle.plate}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
              <Car className="h-3 w-3" />
              Sem veículo
            </span>
          )}
        </div>

        {/* Scheduled time */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
          <Clock className="h-3 w-3" />
          <span>Agendado: {scheduledTime}</span>
        </div>

        {/* Action button */}
        <Button
          size="sm"
          className="w-full h-7 text-xs"
          onClick={handleArrival}
          disabled={convertToWorkOrder.isPending || !appointment.customer_id || !appointment.vehicle_id}
        >
          {convertToWorkOrder.isPending ? "Criando OS..." : "Chegou"}
        </Button>
      </div>

      {createdWorkOrderId && (
        <CheckinDialog
          open={checkinOpen}
          onOpenChange={setCheckinOpen}
          workOrderId={createdWorkOrderId}
          vehiclePlate={appointment.vehicle?.plate || "SEM PLACA"}
        />
      )}
    </>
  );
}
