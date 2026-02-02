import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { Phone, Car, Clock, ChevronLeft, ChevronRight, User, Plus, Check, X } from "lucide-react";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { format, isSameDay, addDays, subDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAppointments, useUpdateAppointment } from "@/hooks/useAppointments";
import { AppointmentFormDialog } from "@/components/forms/AppointmentFormDialog";
import type { Database } from "@/integrations/supabase/types";

type AppointmentStatus = Database["public"]["Enums"]["appointment_status"];

const statusColors: Record<AppointmentStatus, string> = {
  AGENDADO: "bg-info/20 text-info",
  CHEGOU: "bg-success/20 text-success",
  NAO_COMPARECEU: "bg-destructive/20 text-destructive",
  REMARCADO: "bg-warning/20 text-warning",
  CANCELADO: "bg-muted text-muted-foreground",
};

const statusLabels: Record<AppointmentStatus, string> = {
  AGENDADO: "Agendado",
  CHEGOU: "Chegou",
  NAO_COMPARECEU: "Não Compareceu",
  REMARCADO: "Remarcado",
  CANCELADO: "Cancelado",
};

export default function Agenda() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { data: appointments, isLoading } = useAppointments();
  const updateAppointment = useUpdateAppointment();

  const dayAppointments = useMemo(() => {
    if (!appointments) return [];
    return appointments
      .filter(apt => isSameDay(parseISO(apt.scheduled_at), selectedDate))
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  }, [appointments, selectedDate]);

  const stats = useMemo(() => {
    const total = dayAppointments.length;
    const chegou = dayAppointments.filter(a => a.status === "CHEGOU").length;
    const cancelado = dayAppointments.filter(a => a.status === "CANCELADO" || a.status === "NAO_COMPARECEU").length;
    return { total, chegou, cancelado };
  }, [dayAppointments]);

  const handlePrevDay = () => setSelectedDate(d => subDays(d, 1));
  const handleNextDay = () => setSelectedDate(d => addDays(d, 1));
  const handleToday = () => setSelectedDate(new Date());

  const handleMarkArrived = (id: string) => {
    updateAppointment.mutate({ id, updates: { status: "CHEGOU" } });
  };

  const handleCancel = (id: string) => {
    updateAppointment.mutate({ id, updates: { status: "CANCELADO" } });
  };

  if (isLoading) {
    return (
      <AppLayout title="Agenda" subtitle="Gerencie os agendamentos da oficina">
        <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
          <div className="space-y-4">
            <Skeleton className="h-80" />
            <Skeleton className="h-12" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Agenda" subtitle="Gerencie os agendamentos da oficina">
      <div className="grid gap-6 lg:grid-cols-[320px,1fr] animate-fade-in">
        {/* Left: Calendar */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                className="w-full"
                locale={ptBR}
              />
            </CardContent>
          </Card>

          <AppointmentFormDialog selectedDate={selectedDate} />

          {/* Quick Stats */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Resumo do Dia
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Total de agendamentos</span>
                <Badge variant="secondary">{stats.total}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Chegaram</span>
                <Badge className="bg-success/20 text-success">{stats.chegou}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Cancelados</span>
                <Badge className="bg-destructive/20 text-destructive">{stats.cancelado}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Day View */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={handlePrevDay}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <CardTitle className="font-display">
                  {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={handleNextDay}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="outline" size="sm" onClick={handleToday}>
                Hoje
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {dayAppointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Clock className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 font-display text-lg font-semibold">
                  Nenhum agendamento
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Não há atendimentos agendados para este dia.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {dayAppointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className={cn(
                      "group flex items-start gap-4 rounded-xl border p-4 transition-all duration-200",
                      appointment.status === "CANCELADO" || appointment.status === "NAO_COMPARECEU"
                        ? "border-muted bg-muted/30 opacity-60"
                        : "border-border bg-card hover:border-accent/30 hover:shadow-soft"
                    )}
                  >
                    {/* Time */}
                    <div className="flex w-16 flex-col items-center shrink-0">
                      <span className="font-display text-lg font-bold text-foreground">
                        {format(parseISO(appointment.scheduled_at), "HH:mm")}
                      </span>
                      <Badge className={cn("text-[10px]", statusColors[appointment.status])}>
                        {statusLabels[appointment.status]}
                      </Badge>
                    </div>

                    {/* Content */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <h4 className="font-semibold text-foreground">
                              {appointment.customer?.full_name || "Cliente não definido"}
                            </h4>
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="h-3.5 w-3.5" />
                            <span>{appointment.customer?.phone_number || "-"}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-display text-base font-bold text-foreground">
                            {appointment.vehicle?.plate || "---"}
                          </span>
                          <div className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                            <Car className="h-3.5 w-3.5" />
                            <span>
                              {appointment.vehicle?.make} {appointment.vehicle?.model}
                            </span>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Motivo:</span>{" "}
                        {appointment.reason}
                      </p>

                      {/* Actions */}
                      {appointment.status === "AGENDADO" && (
                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-success border-success/30 hover:bg-success/10"
                            onClick={() => handleMarkArrived(appointment.id)}
                          >
                            <Check className="h-3.5 w-3.5" />
                            Chegou
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                            onClick={() => handleCancel(appointment.id)}
                          >
                            <X className="h-3.5 w-3.5" />
                            Cancelar
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
