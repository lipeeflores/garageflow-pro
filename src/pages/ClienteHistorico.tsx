import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Car,
  FileText,
  DollarSign,
  Calendar,
  Clock,
  User,
  Edit,
  History,
  Download,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCustomerHistory } from "@/hooks/useCustomerHistory";
import { usePDFExport } from "@/hooks/usePDFExport";
import { cn } from "@/lib/utils";

const workflowStepLabels: Record<string, string> = {
  AGUARDANDO_CHECKIN: 'Aguardando Check-in',
  CHECKIN_CONCLUIDO: 'Check-in Concluído',
  EM_DIAGNOSTICO: 'Em Diagnóstico',
  AGUARDANDO_ORCAMENTO: 'Aguardando Orçamento',
  AGUARDANDO_APROVACAO: 'Aguardando Aprovação',
  APROVADO: 'Aprovado',
  EM_EXECUCAO: 'Em Execução',
  EM_QUALIDADE: 'Em Qualidade',
  AJUSTES: 'Ajustes',
  PRONTO_PARA_RETIRADA: 'Pronto para Retirada',
  FINALIZADO: 'Finalizado',
  CANCELADO: 'Cancelado',
};

const workflowStepColors: Record<string, string> = {
  AGUARDANDO_CHECKIN: 'bg-muted text-muted-foreground',
  CHECKIN_CONCLUIDO: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  EM_DIAGNOSTICO: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  AGUARDANDO_ORCAMENTO: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  AGUARDANDO_APROVACAO: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  APROVADO: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  EM_EXECUCAO: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  EM_QUALIDADE: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  AJUSTES: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  PRONTO_PARA_RETIRADA: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  FINALIZADO: 'bg-success/20 text-success',
  CANCELADO: 'bg-destructive/20 text-destructive',
};

export default function ClienteHistorico() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useCustomerHistory(id);
  const { exportCustomerHistoryPDF } = usePDFExport();

  if (isLoading) {
    return (
      <AppLayout title="Histórico do Cliente" subtitle="Carregando...">
        <div className="space-y-6">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (error || !data?.customer) {
    return (
      <AppLayout title="Histórico do Cliente" subtitle="Cliente não encontrado">
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">Cliente não encontrado ou você não tem permissão para acessá-lo.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/clientes')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Clientes
          </Button>
        </div>
      </AppLayout>
    );
  }

  const { customer, vehicles, workOrders, payments, timeline } = data;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return format(new Date(dateString), "dd/MM/yyyy", { locale: ptBR });
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '-';
    return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  return (
    <AppLayout 
      title={customer.full_name} 
      subtitle="Histórico completo do cliente"
    >
      <div className="space-y-6 animate-fade-in">
        {/* Header with back button and export */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/clientes')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Clientes
          </Button>
          
          <Button 
            variant="outline" 
            className="gap-2"
            onClick={() => id && exportCustomerHistoryPDF(id)}
          >
            <Download className="h-4 w-4" />
            Exportar Histórico PDF
          </Button>
        </div>

        {/* Customer Info Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                  {customer.full_name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div>
                  <h2 className="font-display text-2xl font-bold">{customer.full_name}</h2>
                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      {customer.phone_number}
                    </div>
                    {customer.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        {customer.email}
                      </div>
                    )}
                    {customer.address && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        {customer.address}
                      </div>
                    )}
                  </div>
                  {customer.cpf_cnpj && (
                    <Badge variant="secondary" className="mt-2">
                      CPF/CNPJ: {customer.cpf_cnpj}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-lg border p-4 text-center">
                  <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Car className="h-5 w-5" />
                  </div>
                  <p className="mt-2 font-display text-2xl font-bold">{customer.vehicle_count}</p>
                  <p className="text-xs text-muted-foreground">Veículos</p>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <FileText className="h-5 w-5" />
                  </div>
                  <p className="mt-2 font-display text-2xl font-bold">{customer.os_count}</p>
                  <p className="text-xs text-muted-foreground">Ordens</p>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-lg bg-success/10 text-success">
                    <DollarSign className="h-5 w-5" />
                  </div>
                  <p className="mt-2 font-display text-lg font-bold">{formatCurrency(customer.total_spent)}</p>
                  <p className="text-xs text-muted-foreground">Total Gasto</p>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <p className="mt-2 font-display text-sm font-bold">{formatDate(customer.last_visit)}</p>
                  <p className="text-xs text-muted-foreground">Última Visita</p>
                </div>
              </div>
            </div>

            {customer.internal_notes && (
              <div className="mt-6 rounded-lg bg-muted/50 p-4">
                <p className="text-sm font-medium text-muted-foreground">Observações Internas</p>
                <p className="mt-1 text-sm">{customer.internal_notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="timeline" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="timeline" className="gap-2">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Timeline</span>
            </TabsTrigger>
            <TabsTrigger value="vehicles" className="gap-2">
              <Car className="h-4 w-4" />
              <span className="hidden sm:inline">Veículos</span>
              <Badge variant="secondary" className="ml-1">{vehicles.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="orders" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">OS</span>
              <Badge variant="secondary" className="ml-1">{workOrders.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-2">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Pagamentos</span>
              <Badge variant="secondary" className="ml-1">{payments.length}</Badge>
            </TabsTrigger>
          </TabsList>

          {/* Timeline Tab */}
          <TabsContent value="timeline">
            <Card>
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Histórico de Atividades
                </CardTitle>
              </CardHeader>
              <CardContent>
                {timeline.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma atividade registrada ainda.
                  </p>
                ) : (
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                    <div className="space-y-6">
                      {timeline.map((item) => (
                        <div key={item.id} className="relative pl-10">
                          <div className={cn(
                            "absolute left-2 top-1 h-5 w-5 rounded-full flex items-center justify-center",
                            item.type === 'work_order' && "bg-accent text-accent-foreground",
                            item.type === 'payment' && "bg-success text-success-foreground",
                            item.type === 'appointment' && "bg-primary text-primary-foreground"
                          )}>
                            {item.type === 'work_order' && <FileText className="h-3 w-3" />}
                            {item.type === 'payment' && <DollarSign className="h-3 w-3" />}
                            {item.type === 'appointment' && <Calendar className="h-3 w-3" />}
                          </div>
                          <div className="rounded-lg border p-4">
                            <div className="flex items-center justify-between">
                              <p className="font-medium">{item.description}</p>
                              <span className="text-xs text-muted-foreground">
                                {formatDateTime(item.date)}
                              </span>
                            </div>
                            {item.metadata && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {item.type === 'work_order' && item.metadata.workflow_step && (
                                  <Badge className={workflowStepColors[item.metadata.workflow_step as string]}>
                                    {workflowStepLabels[item.metadata.workflow_step as string]}
                                  </Badge>
                                )}
                                {item.type === 'work_order' && item.metadata.total_amount && (
                                  <Badge variant="outline">
                                    {formatCurrency(item.metadata.total_amount as number)}
                                  </Badge>
                                )}
                                {item.type === 'payment' && item.metadata.amount && (
                                  <Badge className="bg-success/20 text-success">
                                    {formatCurrency(item.metadata.amount as number)}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Vehicles Tab */}
          <TabsContent value="vehicles">
            <Card>
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <Car className="h-5 w-5" />
                  Veículos do Cliente
                </CardTitle>
              </CardHeader>
              <CardContent>
                {vehicles.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum veículo cadastrado.
                  </p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {vehicles.map((vehicle) => (
                      <div
                        key={vehicle.id}
                        className="rounded-lg border p-4 hover:border-accent transition-colors cursor-pointer"
                        onClick={() => navigate(`/veiculos?plate=${vehicle.plate}`)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                            <Car className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-bold text-lg">{vehicle.plate}</p>
                            <p className="text-sm text-muted-foreground">
                              {vehicle.make} {vehicle.model}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                          {vehicle.year && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {vehicle.year}
                            </span>
                          )}
                          {vehicle.color && (
                            <span className="flex items-center gap-1">
                              <div 
                                className="h-3 w-3 rounded-full border" 
                                style={{ backgroundColor: vehicle.color.toLowerCase() }}
                              />
                              {vehicle.color}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Work Orders Tab */}
          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Ordens de Serviço
                </CardTitle>
              </CardHeader>
              <CardContent>
                {workOrders.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma ordem de serviço registrada.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Veículo</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Mecânico</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {workOrders.map((order) => (
                        <TableRow 
                          key={order.id} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/ordens/${order.id}`)}
                        >
                          <TableCell className="text-muted-foreground">
                            {formatDate(order.created_at)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Car className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{order.vehicle?.plate}</span>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {order.initial_complaint || '-'}
                          </TableCell>
                          <TableCell>
                            {order.current_mechanic ? (
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                {order.current_mechanic.full_name}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={workflowStepColors[order.workflow_step]}>
                              {workflowStepLabels[order.workflow_step]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {order.total_amount ? formatCurrency(order.total_amount) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments">
            <Card>
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Histórico de Pagamentos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {payments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum pagamento registrado.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Método</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment) => (
                        <TableRow 
                          key={payment.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/ordens/${payment.work_order_id}`)}
                        >
                          <TableCell className="text-muted-foreground">
                            {formatDateTime(payment.paid_at)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {payment.payment_method === 'PIX' && 'PIX'}
                              {payment.payment_method === 'CARTAO' && 'Cartão'}
                              {payment.payment_method === 'DINHEIRO' && 'Dinheiro'}
                              {payment.payment_method === 'MARCAR' && 'A Prazo'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium text-success">
                            {formatCurrency(payment.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
