import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Phone, Car, Clock, ChevronLeft, ChevronRight, User } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface Appointment {
  id: string;
  time: string;
  customer: string;
  phone: string;
  plate: string;
  vehicle: string;
  reason: string;
  status: "agendado" | "confirmado" | "cancelado";
}

const mockAppointments: Record<string, Appointment[]> = {
  "2026-02-02": [
    {
      id: "1",
      time: "08:00",
      customer: "Carlos Eduardo",
      phone: "(47) 99999-1234",
      plate: "XYZ-9876",
      vehicle: "Jeep Compass 2021",
      reason: "Revisão completa",
      status: "confirmado",
    },
    {
      id: "2",
      time: "09:30",
      customer: "João Silva",
      phone: "(47) 98888-5678",
      plate: "ABC-1234",
      vehicle: "Honda Civic 2020",
      reason: "Barulho na suspensão",
      status: "agendado",
    },
    {
      id: "3",
      time: "11:00",
      customer: "Maria Santos",
      phone: "(47) 97777-9012",
      plate: "DEF-5678",
      vehicle: "Toyota Corolla 2019",
      reason: "Luz do motor acesa",
      status: "agendado",
    },
    {
      id: "4",
      time: "14:00",
      customer: "Paulo Mendes",
      phone: "(47) 96666-3456",
      plate: "GHI-9012",
      vehicle: "VW Polo 2022",
      reason: "Troca de pastilhas",
      status: "agendado",
    },
    {
      id: "5",
      time: "16:00",
      customer: "Ana Costa",
      phone: "(47) 95555-7890",
      plate: "JKL-3456",
      vehicle: "Fiat Argo 2022",
      reason: "Alinhamento",
      status: "cancelado",
    },
  ],
};

const timeSlots = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30",
];

const statusColors = {
  agendado: "bg-info/20 text-info",
  confirmado: "bg-success/20 text-success",
  cancelado: "bg-muted text-muted-foreground line-through",
};

export default function Agenda() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const dateKey = selectedDate.toISOString().split("T")[0];
  const appointments = mockAppointments[dateKey] || [];

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
              />
            </CardContent>
          </Card>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full gap-2 bg-accent hover:bg-accent/90">
                <Plus className="h-4 w-4" />
                Novo Agendamento
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-display">Novo Agendamento</DialogTitle>
                <DialogDescription>
                  Preencha os dados para agendar um atendimento.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="customer">Nome do Cliente</Label>
                  <Input id="customer" placeholder="Nome completo" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input id="phone" placeholder="(47) 99999-9999" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="plate">Placa</Label>
                    <Input id="plate" placeholder="ABC-1234" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="vehicle">Veículo</Label>
                    <Input id="vehicle" placeholder="Marca/Modelo Ano" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="time">Horário</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {timeSlots.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="reason">Motivo</Label>
                  <Textarea
                    id="reason"
                    placeholder="Descreva o motivo do atendimento"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button className="bg-accent hover:bg-accent/90">
                  Agendar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

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
                <Badge variant="secondary">{appointments.length}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Confirmados</span>
                <Badge className="bg-success/20 text-success">
                  {appointments.filter((a) => a.status === "confirmado").length}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Cancelados</span>
                <Badge className="bg-destructive/20 text-destructive">
                  {appointments.filter((a) => a.status === "cancelado").length}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Day View */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <CardTitle className="font-display">
                  {selectedDate.toLocaleDateString("pt-BR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </CardTitle>
                <Button variant="ghost" size="icon">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(new Date())}
              >
                Hoje
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {appointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Clock className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 font-display text-lg font-semibold">
                  Nenhum agendamento
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Não há atendimentos agendados para este dia.
                </p>
                <Button
                  className="mt-4 gap-2"
                  onClick={() => setIsDialogOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Agendar
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {appointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className={cn(
                      "group flex items-start gap-4 rounded-xl border p-4 transition-all duration-200",
                      appointment.status === "cancelado"
                        ? "border-muted bg-muted/30 opacity-60"
                        : "border-border bg-card hover:border-accent/30 hover:shadow-soft"
                    )}
                  >
                    {/* Time */}
                    <div className="flex w-16 flex-col items-center shrink-0">
                      <span className="font-display text-lg font-bold text-foreground">
                        {appointment.time}
                      </span>
                      <Badge className={cn("text-[10px]", statusColors[appointment.status])}>
                        {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                      </Badge>
                    </div>

                    {/* Content */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <h4 className="font-semibold text-foreground">
                              {appointment.customer}
                            </h4>
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
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
