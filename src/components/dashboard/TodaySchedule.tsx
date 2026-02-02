import { Clock, Phone, Car, Check, X, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Appointment {
  id: string;
  time: string;
  customer: string;
  phone: string;
  plate: string;
  vehicle: string;
  reason: string;
  status: "agendado" | "chegou" | "nao_compareceu" | "cancelado";
}

const mockAppointments: Appointment[] = [
  {
    id: "1",
    time: "08:00",
    customer: "Carlos Eduardo",
    phone: "(47) 99999-1234",
    plate: "XYZ-9876",
    vehicle: "Jeep Compass 2021",
    reason: "Revisão completa + troca de óleo",
    status: "chegou",
  },
  {
    id: "2",
    time: "09:30",
    customer: "João Silva",
    phone: "(47) 98888-5678",
    plate: "ABC-1234",
    vehicle: "Honda Civic 2020",
    reason: "Barulho na suspensão dianteira",
    status: "agendado",
  },
  {
    id: "3",
    time: "10:00",
    customer: "Maria Santos",
    phone: "(47) 97777-9012",
    plate: "DEF-5678",
    vehicle: "Toyota Corolla 2019",
    reason: "Luz do motor acesa",
    status: "agendado",
  },
  {
    id: "4",
    time: "11:30",
    customer: "Paulo Mendes",
    phone: "(47) 96666-3456",
    plate: "GHI-9012",
    vehicle: "VW Polo 2022",
    reason: "Troca de pastilhas de freio",
    status: "agendado",
  },
  {
    id: "5",
    time: "14:00",
    customer: "Ana Costa",
    phone: "(47) 95555-7890",
    plate: "JKL-3456",
    vehicle: "Fiat Argo 2022",
    reason: "Alinhamento e balanceamento",
    status: "agendado",
  },
];

const statusConfig = {
  agendado: {
    label: "Agendado",
    className: "bg-info/20 text-info",
  },
  chegou: {
    label: "Chegou",
    className: "bg-success/20 text-success",
  },
  nao_compareceu: {
    label: "Não compareceu",
    className: "bg-destructive/20 text-destructive",
  },
  cancelado: {
    label: "Cancelado",
    className: "bg-muted text-muted-foreground",
  },
};

export function TodaySchedule() {
  return (
    <div className="space-y-3">
      {mockAppointments.map((appointment) => (
        <div
          key={appointment.id}
          className={cn(
            "group flex items-start gap-4 rounded-xl border p-4 transition-all duration-200",
            appointment.status === "chegou"
              ? "border-success/30 bg-success/5"
              : "border-border bg-card hover:border-accent/30 hover:shadow-soft"
          )}
        >
          {/* Time */}
          <div className="flex flex-col items-center">
            <span className="font-display text-lg font-bold text-foreground">
              {appointment.time}
            </span>
            <Badge
              className={cn(
                "mt-1 text-[10px]",
                statusConfig[appointment.status].className
              )}
            >
              {statusConfig[appointment.status].label}
            </Badge>
          </div>

          {/* Details */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-foreground">
                  {appointment.customer}
                </h4>
                <div className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  <span>{appointment.phone}</span>
                </div>
              </div>
              <div className="text-right">
                <span className="font-display text-base font-bold text-foreground">
                  {appointment.plate}
                </span>
                <div className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                  <Car className="h-3.5 w-3.5" />
                  <span>{appointment.vehicle}</span>
                </div>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Motivo:</span>{" "}
              {appointment.reason}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-start gap-2 opacity-0 transition-opacity group-hover:opacity-100">
            {appointment.status === "agendado" && (
              <>
                <Button
                  size="sm"
                  className="h-8 gap-1.5 bg-success hover:bg-success/90"
                >
                  <Check className="h-3.5 w-3.5" />
                  Check-in
                </Button>
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
      ))}
    </div>
  );
}
