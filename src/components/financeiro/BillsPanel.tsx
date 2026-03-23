import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Building2,
  ShoppingCart,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  Clock,
  DollarSign,
} from "lucide-react";
import { useBills, useBillsSummary, useMarkBillPaid, useDeleteBill, type Bill } from "@/hooks/useBills";
import { BillFormDialog } from "./BillFormDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

function BillStatusBadge({ bill }: { bill: Bill }) {
  const today = new Date().toISOString().split("T")[0];
  const isOverdue = bill.status === "PENDENTE" && bill.due_date < today;

  if (bill.status === "PAGO") return <Badge className="bg-success/10 text-success border-success/20">Pago</Badge>;
  if (bill.status === "CANCELADO") return <Badge variant="secondary">Cancelado</Badge>;
  if (isOverdue || bill.status === "VENCIDO")
    return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Vencido</Badge>;
  return <Badge className="bg-warning/10 text-warning border-warning/20">Pendente</Badge>;
}

function BillRow({ bill }: { bill: Bill }) {
  const markPaid = useMarkBillPaid();
  const deleteBill = useDeleteBill();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isPaid = bill.status === "PAGO";
  const isCancelled = bill.status === "CANCELADO";

  return (
    <>
      <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 p-3 gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={`rounded-full p-2 ${bill.category === "FIXA" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"}`}>
            {bill.category === "FIXA" ? <Building2 className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate">{bill.description}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Vence: {format(new Date(bill.due_date + "T12:00:00"), "dd/MM/yyyy")}</span>
              {bill.supplier && <span>• {bill.supplier}</span>}
              {bill.is_recurring && <span>• Recorrente</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="font-semibold">{formatCurrency(Number(bill.amount))}</p>
            <BillStatusBadge bill={bill} />
          </div>
          {!isPaid && !isCancelled && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1 text-success border-success/30 hover:bg-success/10"
              onClick={() => markPaid.mutate({ id: bill.id, paid_amount: Number(bill.amount) })}
              disabled={markPaid.isPending}
            >
              <CheckCircle2 className="h-3 w-3" />
              Pagar
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{bill.description}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteBill.mutate(bill.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function BillsPanel() {
  const [showForm, setShowForm] = useState(false);
  const [formCategory, setFormCategory] = useState<"FIXA" | "FLUTUANTE" | undefined>();
  const { data: summary } = useBillsSummary();
  const { data: fixedBills, isLoading: loadingFixed } = useBills({ category: "FIXA" });
  const { data: variableBills, isLoading: loadingVariable } = useBills({ category: "FLUTUANTE" });

  const openForm = (cat?: "FIXA" | "FLUTUANTE") => {
    setFormCategory(cat);
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Pendente</CardTitle>
            <div className="rounded-full p-2 bg-warning/10 text-warning">
              <Clock className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary?.totalPending || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vencidas</CardTitle>
            <div className="rounded-full p-2 bg-destructive/10 text-destructive">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{formatCurrency(summary?.totalOverdue || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Despesas Fixas</CardTitle>
            <div className="rounded-full p-2 bg-primary/10 text-primary">
              <Building2 className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary?.totalFixed || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Despesas Flutuantes</CardTitle>
            <div className="rounded-full p-2 bg-accent/10 text-accent">
              <ShoppingCart className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary?.totalVariable || 0)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Bills Tabs */}
      <Tabs defaultValue="fixas" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="fixas" className="gap-2">
              <Building2 className="h-4 w-4" />
              Fixas
            </TabsTrigger>
            <TabsTrigger value="flutuantes" className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              Flutuantes
            </TabsTrigger>
          </TabsList>
          <Button onClick={() => openForm()} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Conta
          </Button>
        </div>

        <TabsContent value="fixas">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Contas Fixas</CardTitle>
                  <CardDescription>Aluguel, funcionários, internet, telefone...</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={() => openForm("FIXA")} className="gap-1">
                  <Plus className="h-3 w-3" />
                  Adicionar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingFixed ? (
                <p className="text-center text-muted-foreground py-8">Carregando...</p>
              ) : !fixedBills?.length ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma conta fixa cadastrada</p>
              ) : (
                <div className="space-y-2">
                  {fixedBills.map((bill) => (
                    <BillRow key={bill.id} bill={bill} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="flutuantes">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Contas Flutuantes</CardTitle>
                  <CardDescription>Peças, ferramentas, equipamentos...</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={() => openForm("FLUTUANTE")} className="gap-1">
                  <Plus className="h-3 w-3" />
                  Adicionar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingVariable ? (
                <p className="text-center text-muted-foreground py-8">Carregando...</p>
              ) : !variableBills?.length ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma conta flutuante cadastrada</p>
              ) : (
                <div className="space-y-2">
                  {variableBills.map((bill) => (
                    <BillRow key={bill.id} bill={bill} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <BillFormDialog open={showForm} onOpenChange={setShowForm} defaultCategory={formCategory} />
    </div>
  );
}
