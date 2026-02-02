import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { useWorkOrders, type WorkflowStep } from "@/hooks/useWorkOrders";
import { WorkOrderFormDialog } from "@/components/forms";
import { useAuth } from "@/contexts/AuthContext";

const stepColors: Record<WorkflowStep, string> = {
  AGUARDANDO_CHECKIN: "bg-muted text-muted-foreground",
  CHECKIN_CONCLUIDO: "bg-info/20 text-info",
  EM_DIAGNOSTICO: "bg-warning/20 text-warning",
  AGUARDANDO_ORCAMENTO: "bg-accent/20 text-accent",
  AGUARDANDO_APROVACAO: "bg-info/20 text-info",
  APROVADO: "bg-success/20 text-success",
  EM_EXECUCAO: "bg-primary/20 text-primary",
  EM_QUALIDADE: "bg-purple-100 text-purple-700",
  AJUSTES: "bg-warning/20 text-warning",
  PRONTO_PARA_RETIRADA: "bg-success/20 text-success",
  FINALIZADO: "bg-muted text-muted-foreground",
  CANCELADO: "bg-destructive/20 text-destructive",
};

const stepLabels: Record<WorkflowStep, string> = {
  AGUARDANDO_CHECKIN: "Aguardando Check-in",
  CHECKIN_CONCLUIDO: "Check-in Concluído",
  EM_DIAGNOSTICO: "Em Diagnóstico",
  AGUARDANDO_ORCAMENTO: "Aguardando Orçamento",
  AGUARDANDO_APROVACAO: "Aguardando Aprovação",
  APROVADO: "Aprovado",
  EM_EXECUCAO: "Em Execução",
  EM_QUALIDADE: "Em Qualidade",
  AJUSTES: "Ajustes",
  PRONTO_PARA_RETIRADA: "Pronto p/ Retirada",
  FINALIZADO: "Finalizado",
  CANCELADO: "Cancelado",
};

const priorityColors = {
  BAIXA: "bg-muted text-muted-foreground",
  MEDIA: "bg-warning/20 text-warning",
  ALTA: "bg-destructive/20 text-destructive",
};

export default function Ordens() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const navigate = useNavigate();
  
  const { data: orders, isLoading } = useWorkOrders();
  const { isAdminOrManager } = useAuth();

  const canSeePrices = isAdminOrManager;

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    return orders.filter(order => {
      const matchesSearch = 
        order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.vehicle?.plate?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customer?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || order.workflow_step === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [orders, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    if (!orders) return { emAndamento: 0, aguardando: 0, finalizadasHoje: 0, totalMes: 0 };
    
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const emAndamento = orders.filter(o => 
      ["EM_DIAGNOSTICO", "EM_EXECUCAO", "EM_QUALIDADE", "AJUSTES"].includes(o.workflow_step)
    ).length;

    const aguardando = orders.filter(o => 
      ["AGUARDANDO_CHECKIN", "AGUARDANDO_ORCAMENTO", "AGUARDANDO_APROVACAO"].includes(o.workflow_step)
    ).length;

    const finalizadasHoje = orders.filter(o => 
      o.workflow_step === "FINALIZADO" && 
      new Date(o.updated_at || o.created_at || "") >= startOfToday
    ).length;

    const totalMes = orders.filter(o => 
      new Date(o.created_at || "") >= startOfMonth
    ).length;

    return { emAndamento, aguardando, finalizadasHoje, totalMes };
  }, [orders]);

  if (isLoading) {
    return (
      <AppLayout title="Ordens de Serviço" subtitle="Gerenciamento completo de OS">
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Ordens de Serviço" subtitle="Gerenciamento completo de OS">
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
                <SelectItem value="AGUARDANDO_CHECKIN">Aguardando Check-in</SelectItem>
                <SelectItem value="EM_DIAGNOSTICO">Em Diagnóstico</SelectItem>
                <SelectItem value="AGUARDANDO_ORCAMENTO">Aguardando Orçamento</SelectItem>
                <SelectItem value="AGUARDANDO_APROVACAO">Aguardando Aprovação</SelectItem>
                <SelectItem value="EM_EXECUCAO">Em Execução</SelectItem>
                <SelectItem value="EM_QUALIDADE">Em Qualidade</SelectItem>
                <SelectItem value="PRONTO_PARA_RETIRADA">Pronto p/ Retirada</SelectItem>
                <SelectItem value="FINALIZADO">Finalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <WorkOrderFormDialog />
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
                <p className="font-display text-2xl font-bold">{stats.emAndamento}</p>
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
                <p className="font-display text-2xl font-bold">{stats.aguardando}</p>
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
                <p className="font-display text-2xl font-bold">{stats.finalizadasHoje}</p>
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
                <p className="font-display text-2xl font-bold">{stats.totalMes}</p>
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
            {filteredOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 font-display text-lg font-semibold">
                  Nenhuma ordem encontrada
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {searchQuery || statusFilter !== "all" 
                    ? "Tente ajustar os filtros de busca."
                    : "Crie uma nova ordem de serviço para começar."}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>OS</TableHead>
                    <TableHead>Veículo</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Mecânico</TableHead>
                    <TableHead>Data</TableHead>
                    {canSeePrices && <TableHead className="text-right">Total</TableHead>}
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow 
                      key={order.id} 
                      className="group cursor-pointer"
                      onClick={() => navigate(`/ordens/${order.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-display font-bold">
                            OS-{order.id.slice(0, 8).toUpperCase()}
                          </span>
                          {order.priority && (
                            <Badge className={cn("text-[10px]", priorityColors[order.priority])}>
                              {order.priority.charAt(0) + order.priority.slice(1).toLowerCase()}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Car className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{order.vehicle?.plate || "---"}</p>
                            <p className="text-sm text-muted-foreground">
                              {order.vehicle?.make} {order.vehicle?.model}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>{order.customer?.full_name || "---"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={stepColors[order.workflow_step] || "bg-muted"}>
                          {stepLabels[order.workflow_step]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {order.mechanic?.full_name ? (
                          <div className="flex items-center gap-2">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                              {order.mechanic.full_name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .slice(0, 2)}
                            </div>
                            <span className="text-sm">{order.mechanic.full_name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {order.created_at 
                          ? format(new Date(order.created_at), "dd/MM/yyyy")
                          : "-"}
                      </TableCell>
                      {canSeePrices && (
                        <TableCell className="text-right font-medium">
                          {order.total_amount && order.total_amount > 0 ? (
                            <span className="text-success">
                              R$ {Number(order.total_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell onClick={(e) => e.stopPropagation()}>
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
                            <DropdownMenuItem onClick={() => navigate(`/ordens/${order.id}`)}>
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
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
