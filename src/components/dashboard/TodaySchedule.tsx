import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTodayAndMissedAppointments, type AppointmentStatus } from "@/hooks/useAppointments";
import { Clock, Car, User, Loader2, Phone, Check, MoreHorizontal, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const statusColors: Record<AppointmentStatus, string> = {
  AGENDADO: "bg-blue-500",
  CHEGOU: "bg-green-500",
  NAO_COMPARECEU: "bg-red-500",
  REMARCADO: "bg-yellow-500",
  CANCELADO: "bg-gray-500",
};

const statusLabels: Record<AppointmentStatus, string> = {
  AGENDADO: "Agendado",
  CHEGOU: "Chegou",
  NAO_COMPARECEU: "Não Compareceu",
  REMARCADO: "Remarcado",
  CANCELADO: "Cancelado",
};

export function TodaySchedule() {
  const { data, isLoading, error } = useTodayAndMissedAppointments();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Erro ao carregar agendamentos
      </div>
    );
  }

  const todayAppointments = data?.today || [];
  const missedAppointments = data?.missed || [];
  const allAppointments = [...missedAppointments, ...todayAppointments];

  if (allAppointments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Car className="h-12 w-12 mb-4 opacity-50" />
        <p>Nenhum agendamento para hoje</p>
      </div>
    );
  }

  const now = new Date();

  return (
    <div className="space-y-3">
      {allAppointments.map((appointment) => {
        const isNoShow = appointment.status === "NAO_COMPARECEU";
        const isLate = appointment.status === "AGENDADO" && new Date(appointment.scheduled_at) < now;
        const displayStatus = isLate ? "Atrasado" : statusLabels[appointment.status];
        const displayColor = isLate ? "bg-yellow-500" : statusColors[appointment.status];

        return (
          <div
            key={appointment.id}
            className={cn(
              "group flex items-start gap-4 rounded-xl border p-4 transition-all duration-200",
              isNoShow
                ? "border-red-500/50 bg-red-500/5"
                : appointment.status === "CHEGOU"
                ? "border-green-500/30 bg-green-500/5"
                : isLate
                ? "border-yellow-500/30 bg-yellow-500/5"
                : "border-border bg-card hover:border-accent/30 hover:shadow-sm"
            )}
          >
            {/* Time */}
            <div className="flex flex-col items-center">
              <span className="font-display text-lg font-bold text-foreground">
                {format(new Date(appointment.scheduled_at), "HH:mm")}
              </span>
              {isNoShow && (
                <span className="text-[10px] text-muted-foreground">
                  {format(new Date(appointment.scheduled_at), "dd/MM")}
                </span>
              )}
              <Badge
                variant={isNoShow ? "destructive" : "secondary"}
                className="mt-1 gap-1.5 text-[10px] whitespace-nowrap"
              >
                <span className={cn("h-2 w-2 rounded-full", displayColor)} />
                {displayStatus}
              </Badge>
            </div>

            {/* Details */}
            <div className="flex-1 space-y-2 min-w-0">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <h4 className="font-semibold text-foreground truncate">
                    {appointment.customer?.full_name || "Cliente não informado"}
                  </h4>
                  <div className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{appointment.customer?.phone_number}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-display text-base font-bold text-foreground">
                    {appointment.vehicle?.plate || "---"}
                  </span>
                  <div className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground justify-end">
                    <Car className="h-3.5 w-3.5" />
                    <span>
                      {appointment.vehicle 
                        ? `${appointment.vehicle.make} ${appointment.vehicle.model}`
                        : "Veículo não informado"}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-sm text-muted-foreground truncate">
                <span className="font-medium text-foreground">Motivo:</span>{" "}
                {appointment.reason}
              </p>

              {isNoShow && (
                <div className="flex items-center gap-1.5 text-xs text-red-500 font-medium">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Não compareceu — necessário remarcar
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-start gap-2 opacity-0 transition-opacity group-hover:opacity-100">
              {(appointment.status === "AGENDADO" || isNoShow) && (
                <>
                  {appointment.status === "AGENDADO" && (
                    <Button
                      size="sm"
                      className="h-8 gap-1.5 bg-green-600 hover:bg-green-700"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Check-in
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>Remarcar</DropdownMenuItem>
                      <DropdownMenuItem>Enviar lembrete</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        Cancelar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
