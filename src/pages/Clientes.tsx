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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Search,
  Phone,
  Mail,
  Car,
  FileText,
  MoreHorizontal,
  History,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useCustomersWithStats } from "@/hooks/useCustomerHistory";
import { CustomerFormDialog } from "@/components/forms";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Clientes() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  
  const { data: customers, isLoading } = useCustomersWithStats(searchQuery);

  const stats = useMemo(() => {
    if (!customers) return { total: 0, vehicles: 0, os: 0 };
    return {
      total: customers.length,
      vehicles: customers.reduce((acc, c) => acc + c.vehicle_count, 0),
      os: customers.reduce((acc, c) => acc + c.os_count, 0),
    };
  }, [customers]);

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

  return (
    <AppLayout title="Clientes" subtitle="Gerenciamento de clientes da oficina">
      <div className="space-y-6 animate-fade-in">
        {/* Actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone ou email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <CustomerFormDialog />
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Phone className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Clientes</p>
                {isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="font-display text-2xl font-bold">{stats.total}</p>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <Car className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Veículos Cadastrados</p>
                {isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="font-display text-2xl font-bold">{stats.vehicles}</p>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de OS</p>
                {isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="font-display text-2xl font-bold">{stats.os}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display">Lista de Clientes</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : customers?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground">Nenhum cliente encontrado.</p>
                <CustomerFormDialog 
                  trigger={
                    <Button variant="outline" className="mt-4">
                      <Plus className="mr-2 h-4 w-4" />
                      Cadastrar primeiro cliente
                    </Button>
                  }
                />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead className="text-center">Veículos</TableHead>
                    <TableHead className="text-center">OS</TableHead>
                    <TableHead>Última Visita</TableHead>
                    <TableHead className="text-right">Total Gasto</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers?.map((customer) => (
                    <TableRow 
                      key={customer.id} 
                      className="group cursor-pointer"
                      onClick={() => navigate(`/clientes/${customer.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                            {customer.full_name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <span className="font-medium">{customer.full_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-sm">
                            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                            {customer.phone_number}
                          </div>
                          {customer.email && (
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Mail className="h-3.5 w-3.5" />
                              {customer.email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{customer.vehicle_count}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{customer.os_count}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(customer.last_visit)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-success">
                        {formatCurrency(customer.total_spent)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="opacity-0 group-hover:opacity-100"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/clientes/${customer.id}`);
                            }}>
                              <History className="mr-2 h-4 w-4" />
                              Ver histórico
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/veiculos?customer=${customer.id}`);
                            }}>
                              <Car className="mr-2 h-4 w-4" />
                              Ver veículos
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/ordens?customer=${customer.id}`);
                            }}>
                              <FileText className="mr-2 h-4 w-4" />
                              Histórico de OS
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
