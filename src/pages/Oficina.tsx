import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Car,
  Clock,
  User,
  Wrench,
  Camera,
  FileText,
  CheckCircle,
  AlertCircle,
  Play,
  Pause,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkOrder {
  id: string;
  plate: string;
  customer: string;
  vehicle: string;
  mechanic: string;
  box: string;
  step: string;
  timer: string;
  progress: number;
  priority: "baixa" | "media" | "alta";
}

const mockWorkOrders: WorkOrder[] = [
  {
    id: "OS-001",
    plate: "ABC-1234",
    customer: "João Silva",
    vehicle: "Honda Civic 2020",
    mechanic: "Carlos Silva",
    box: "Box 1",
    step: "Em Diagnóstico",
    timer: "00:45:23",
    progress: 25,
    priority: "alta",
  },
  {
    id: "OS-002",
    plate: "DEF-5678",
    customer: "Maria Santos",
    vehicle: "Toyota Corolla 2019",
    mechanic: "Roberto Santos",
    box: "Box 2",
    step: "Em Execução",
    timer: "02:15:42",
    progress: 60,
    priority: "media",
  },
  {
    id: "OS-003",
    plate: "GHI-9012",
    customer: "Pedro Oliveira",
    vehicle: "VW Golf 2021",
    mechanic: "André Lima",
    box: "Box 3",
    step: "Em Execução",
    timer: "01:30:15",
    progress: 45,
    priority: "media",
  },
  {
    id: "OS-004",
    plate: "JKL-3456",
    customer: "Ana Costa",
    vehicle: "Fiat Argo 2022",
    mechanic: "-",
    box: "Pátio",
    step: "Aguardando Check-in",
    timer: "-",
    progress: 0,
    priority: "baixa",
  },
];

const boxes = [
  { id: "box1", name: "Box 1", status: "ocupado", plate: "ABC-1234" },
  { id: "box2", name: "Box 2", status: "ocupado", plate: "DEF-5678" },
  { id: "box3", name: "Box 3", status: "ocupado", plate: "GHI-9012" },
  { id: "box4", name: "Box 4", status: "livre", plate: null },
];

const priorityColors = {
  baixa: "bg-muted text-muted-foreground",
  media: "bg-warning/20 text-warning",
  alta: "bg-destructive/20 text-destructive",
};

const stepColors: Record<string, string> = {
  "Aguardando Check-in": "bg-info/20 text-info",
  "Em Diagnóstico": "bg-warning/20 text-warning",
  "Em Execução": "bg-primary/20 text-primary",
  "Em Qualidade": "bg-accent/20 text-accent",
  "Pronto": "bg-success/20 text-success",
};

export default function Oficina() {
  return (
    <AppLayout title="Oficina" subtitle="Acompanhamento em tempo real">
      <div className="space-y-6 animate-fade-in">
        {/* Box Status */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {boxes.map((box) => (
            <Card
              key={box.id}
              className={cn(
                "transition-all duration-200",
                box.status === "ocupado"
                  ? "border-accent/30 bg-accent/5"
                  : "border-success/30 bg-success/5"
              )}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-display text-lg font-bold">{box.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {box.status === "ocupado" ? box.plate : "Disponível"}
                  </p>
                </div>
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    box.status === "ocupado"
                      ? "bg-accent/20 text-accent"
                      : "bg-success/20 text-success"
                  )}
                >
                  {box.status === "ocupado" ? (
                    <Wrench className="h-5 w-5" />
                  ) : (
                    <CheckCircle className="h-5 w-5" />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Work Orders */}
        <Tabs defaultValue="active" className="space-y-4">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="active" className="gap-2">
              <Wrench className="h-4 w-4" />
              Em Andamento
              <Badge className="ml-1">4</Badge>
            </TabsTrigger>
            <TabsTrigger value="waiting" className="gap-2">
              <Clock className="h-4 w-4" />
              Aguardando
            </TabsTrigger>
            <TabsTrigger value="quality" className="gap-2">
              <CheckCircle className="h-4 w-4" />
              Qualidade
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {mockWorkOrders.map((order) => (
              <Card key={order.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex items-stretch">
                    {/* Left: Main Info */}
                    <div className="flex-1 p-5">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                            <Car className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-3">
                              <span className="font-display text-xl font-bold">
                                {order.plate}
                              </span>
                              <Badge className={priorityColors[order.priority]}>
                                {order.priority.charAt(0).toUpperCase() +
                                  order.priority.slice(1)}
                              </Badge>
                              <Badge className={stepColors[order.step] || "bg-muted"}>
                                {order.step}
                              </Badge>
                            </div>
                            <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <User className="h-3.5 w-3.5" />
                                {order.customer}
                              </span>
                              <span>{order.vehicle}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">{order.id}</p>
                          <p className="font-medium text-accent">{order.box}</p>
                        </div>
                      </div>

                      {/* Progress */}
                      <div className="mt-4">
                        <div className="mb-2 flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Progresso</span>
                          <span className="font-medium">{order.progress}%</span>
                        </div>
                        <Progress value={order.progress} className="h-2" />
                      </div>

                      {/* Mechanic & Timer */}
                      <div className="mt-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {order.mechanic !== "-" && (
                            <>
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                                {order.mechanic
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")}
                              </div>
                              <span className="font-medium">{order.mechanic}</span>
                            </>
                          )}
                        </div>
                        {order.timer !== "-" && (
                          <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="font-display text-lg font-bold">
                              {order.timer}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex w-48 flex-col gap-2 border-l border-border bg-muted/30 p-4">
                      {order.step === "Aguardando Check-in" && (
                        <Button className="gap-2 bg-success hover:bg-success/90">
                          <Camera className="h-4 w-4" />
                          Check-in
                        </Button>
                      )}
                      {order.step === "Em Diagnóstico" && (
                        <>
                          <Button variant="outline" className="gap-2">
                            <Pause className="h-4 w-4" />
                            Pausar
                          </Button>
                          <Button className="gap-2 bg-accent hover:bg-accent/90">
                            <Send className="h-4 w-4" />
                            Enviar p/ Orçamento
                          </Button>
                        </>
                      )}
                      {order.step === "Em Execução" && (
                        <>
                          <Button variant="outline" className="gap-2">
                            <Camera className="h-4 w-4" />
                            Adicionar Foto
                          </Button>
                          <Button className="gap-2 bg-success hover:bg-success/90">
                            <CheckCircle className="h-4 w-4" />
                            Concluir
                          </Button>
                        </>
                      )}
                      <Button variant="ghost" className="gap-2">
                        <FileText className="h-4 w-4" />
                        Ver Detalhes
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="waiting">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 font-display text-lg font-semibold">
                  Nenhuma OS aguardando
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Todas as ordens de serviço estão em andamento.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="quality">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 font-display text-lg font-semibold">
                  Nenhuma OS em qualidade
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Nenhuma ordem de serviço aguardando inspeção.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
