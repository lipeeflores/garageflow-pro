import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  FileText,
  MoreHorizontal,
  ChevronRight,
  Car,
  User,
  Clock,
  DollarSign,
  Filter,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface WorkOrder {
  id: string;
  plate: string;
  customer: string;
  vehicle: string;
  step: string;
  mechanic: string;
  createdAt: string;
  total: string;
  priority: "baixa" | "media" | "alta";
}

const mockOrders: WorkOrder[] = [
  {
    id: "OS-001",
    plate: "ABC-1234",
    customer: "João Silva",
    vehicle: "Honda Civic 2020",
    step: "Em Diagnóstico",
    mechanic: "Carlos Silva",
    createdAt: "02/02/2026",
    total: "R$ 850,00",
    priority: "alta",
  },
  {
    id: "OS-002",
    plate: "DEF-5678",
    customer: "Maria Santos",
    vehicle: "Toyota Corolla 2019",
    step: "Em Execução",
    mechanic: "Roberto Santos",
    createdAt: "01/02/2026",
    total: "R$ 1.250,00",
    priority: "media",
  },
  {
    id: "OS-003",
    plate: "GHI-9012",
    customer: "Pedro Oliveira",
    vehicle: "VW Golf 2021",
    step: "Aguardando Orçamento",
    mechanic: "André Lima",
    createdAt: "01/02/2026",
    total: "-",
    priority: "media",
  },
  {
    id: "OS-004",
    plate: "JKL-3456",
    customer: "Ana Costa",
    vehicle: "Fiat Argo 2022",
    step: "Pronto p/ Retirada",
    mechanic: "Carlos Silva",
    createdAt: "30/01/2026",
    total: "R$ 580,00",
    priority: "baixa",
  },
  {
    id: "OS-005",
    plate: "MNO-7890",
    customer: "Lucas Lima",
    vehicle: "Chevrolet Onix 2020",
    step: "Finalizado",
    mechanic: "Roberto Santos",
    createdAt: "28/01/2026",
    total: "R$ 2.150,00",
    priority: "alta",
  },
];

const stepColors: Record<string, string> = {
  "Aguardando Check-in": "bg-muted text-muted-foreground",
  "Em Diagnóstico": "bg-warning/20 text-warning",
  "Aguardando Orçamento": "bg-accent/20 text-accent",
  "Aguardando Aprovação": "bg-info/20 text-info",
  "Em Execução": "bg-primary/20 text-primary",
  "Em Qualidade": "bg-purple-100 text-purple-700",
  "Pronto p/ Retirada": "bg-success/20 text-success",
  Finalizado: "bg-muted text-muted-foreground",
};

const priorityColors = {
  baixa: "bg-muted text-muted-foreground",
  media: "bg-warning/20 text-warning",
  alta: "bg-destructive/20 text-destructive",
};

export default function Ordens() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredOrders = mockOrders.filter(
    (order) =>
      (order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.plate.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customer.toLowerCase().includes(searchQuery.toLowerCase())) &&
      (statusFilter === "all" || order.step === statusFilter)
  );

  return (
    <AppLayout
      title="Ordens de Serviço"
      subtitle="Gerenciamento completo de OS"
    >
      <div className="space-y-6 animate-fade-in">
        {/* Actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 gap-3">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por OS, placa ou cliente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="Em Diagnóstico">Em Diagnóstico</SelectItem>
                <SelectItem value="Aguardando Orçamento">Aguardando Orçamento</SelectItem>
                <SelectItem value="Em Execução">Em Execução</SelectItem>
                <SelectItem value="Pronto p/ Retirada">Pronto p/ Retirada</SelectItem>
                <SelectItem value="Finalizado">Finalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button className="gap-2 bg-accent hover:bg-accent/90">
            <Plus className="h-4 w-4" />
            Nova OS
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Em Andamento</p>
                <p className="font-display text-2xl font-bold">4</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10 text-warning">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Aguardando</p>
                <p className="font-display text-2xl font-bold">2</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Finalizadas Hoje</p>
                <p className="font-display text-2xl font-bold">3</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Car className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total do Mês</p>
                <p className="font-display text-2xl font-bold">48</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display">Lista de Ordens</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>OS</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Mecânico</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id} className="group cursor-pointer">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-display font-bold">{order.id}</span>
                        <Badge className={cn("text-[10px]", priorityColors[order.priority])}>
                          {order.priority.charAt(0).toUpperCase() + order.priority.slice(1)}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Car className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{order.plate}</p>
                          <p className="text-sm text-muted-foreground">
                            {order.vehicle}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{order.customer}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={stepColors[order.step] || "bg-muted"}>
                        {order.step}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                          {order.mechanic
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </div>
                        <span className="text-sm">{order.mechanic}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {order.createdAt}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {order.total !== "-" ? (
                        <span className="text-success">{order.total}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <ChevronRight className="mr-2 h-4 w-4" />
                            Ver detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <FileText className="mr-2 h-4 w-4" />
                            Imprimir OS
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
