import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, User, Car, ChevronRight } from "lucide-react";

interface WorkOrder {
  id: string;
  plate: string;
  customer: string;
  vehicle: string;
  mechanic?: string;
  priority: "baixa" | "media" | "alta";
  time?: string;
}

interface KanbanColumn {
  id: string;
  title: string;
  color: string;
  orders: WorkOrder[];
}

const mockColumns: KanbanColumn[] = [
  {
    id: "aguardando_checkin",
    title: "Aguardando Check-in",
    color: "bg-info",
    orders: [
      {
        id: "1",
        plate: "ABC-1234",
        customer: "João Silva",
        vehicle: "Honda Civic 2020",
        priority: "alta",
        time: "09:30",
      },
      {
        id: "2",
        plate: "DEF-5678",
        customer: "Maria Santos",
        vehicle: "Toyota Corolla 2019",
        priority: "media",
        time: "10:00",
      },
    ],
  },
  {
    id: "em_diagnostico",
    title: "Em Diagnóstico",
    color: "bg-warning",
    orders: [
      {
        id: "3",
        plate: "GHI-9012",
        customer: "Pedro Oliveira",
        vehicle: "VW Golf 2021",
        mechanic: "Carlos",
        priority: "media",
        time: "45min",
      },
    ],
  },
  {
    id: "aguardando_orcamento",
    title: "Aguardando Orçamento",
    color: "bg-accent",
    orders: [
      {
        id: "4",
        plate: "JKL-3456",
        customer: "Ana Costa",
        vehicle: "Fiat Argo 2022",
        priority: "baixa",
      },
    ],
  },
  {
    id: "em_execucao",
    title: "Em Execução",
    color: "bg-primary",
    orders: [
      {
        id: "5",
        plate: "MNO-7890",
        customer: "Lucas Lima",
        vehicle: "Chevrolet Onix 2020",
        mechanic: "Roberto",
        priority: "alta",
        time: "1h 30min",
      },
      {
        id: "6",
        plate: "PQR-1122",
        customer: "Fernanda Dias",
        vehicle: "Hyundai HB20 2021",
        mechanic: "Carlos",
        priority: "media",
        time: "2h 15min",
      },
    ],
  },
  {
    id: "pronto",
    title: "Pronto p/ Retirada",
    color: "bg-success",
    orders: [
      {
        id: "7",
        plate: "STU-3344",
        customer: "Ricardo Alves",
        vehicle: "Renault Kwid 2022",
        priority: "baixa",
      },
    ],
  },
];

const priorityColors = {
  baixa: "bg-muted text-muted-foreground",
  media: "bg-warning/20 text-warning",
  alta: "bg-destructive/20 text-destructive",
};

export function WorkflowKanban() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {mockColumns.map((column) => (
        <div
          key={column.id}
          className="flex w-72 shrink-0 flex-col rounded-xl border border-border bg-muted/30"
        >
          {/* Column Header */}
          <div className="flex items-center gap-3 border-b border-border p-4">
            <div className={cn("h-3 w-3 rounded-full", column.color)} />
            <h3 className="font-display text-sm font-semibold text-foreground">
              {column.title}
            </h3>
            <Badge variant="secondary" className="ml-auto">
              {column.orders.length}
            </Badge>
          </div>

          {/* Column Content */}
          <div className="flex flex-1 flex-col gap-3 p-3">
            {column.orders.map((order) => (
              <Card
                key={order.id}
                className="group cursor-pointer border-border bg-card transition-all duration-200 hover:border-accent hover:shadow-soft"
              >
                <CardContent className="p-4">
                  {/* Header */}
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-display text-base font-bold text-foreground">
                      {order.plate}
                    </span>
                    <Badge className={cn("text-[10px]", priorityColors[order.priority])}>
                      {order.priority.charAt(0).toUpperCase() + order.priority.slice(1)}
                    </Badge>
                  </div>

                  {/* Info */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="h-3.5 w-3.5" />
                      <span className="truncate">{order.customer}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Car className="h-3.5 w-3.5" />
                      <span className="truncate">{order.vehicle}</span>
                    </div>
                    {order.mechanic && (
                      <div className="flex items-center gap-2 text-foreground">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                          {order.mechanic.charAt(0)}
                        </div>
                        <span>{order.mechanic}</span>
                      </div>
                    )}
                    {order.time && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{order.time}</span>
                      </div>
                    )}
                  </div>

                  {/* Action */}
                  <div className="mt-3 flex items-center justify-end opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="flex items-center gap-1 text-xs font-medium text-accent">
                      Ver detalhes
                      <ChevronRight className="h-3 w-3" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}

            {column.orders.length === 0 && (
              <div className="flex flex-1 items-center justify-center py-8">
                <p className="text-sm text-muted-foreground">Nenhuma OS</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
