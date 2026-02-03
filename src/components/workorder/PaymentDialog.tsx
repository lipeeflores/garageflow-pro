import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  CreditCard, 
  Banknote, 
  Smartphone, 
  FileText,
  Check,
  Loader2,
  DollarSign,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  usePayments, 
  useCreatePayment, 
  useTotalPaid,
  paymentMethodLabels,
  paymentMethodIcons,
  type PaymentMethod,
} from "@/hooks/usePayments";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const formSchema = z.object({
  amount: z.coerce.number().positive("Valor deve ser maior que zero"),
  payment_method: z.enum(["PIX", "CARTAO", "DINHEIRO", "MARCAR"] as const),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface PaymentDialogProps {
  workOrderId: string;
  totalAmount: number;
  trigger?: React.ReactNode;
}

const paymentMethods: { value: PaymentMethod; label: string; icon: React.ReactNode; color: string }[] = [
  { value: "PIX", label: "Pix", icon: <Smartphone className="h-5 w-5" />, color: "bg-emerald-500" },
  { value: "CARTAO", label: "Cartão", icon: <CreditCard className="h-5 w-5" />, color: "bg-blue-500" },
  { value: "DINHEIRO", label: "Dinheiro", icon: <Banknote className="h-5 w-5" />, color: "bg-green-600" },
  { value: "MARCAR", label: "Fiado", icon: <FileText className="h-5 w-5" />, color: "bg-amber-500" },
];

export function PaymentDialog({ workOrderId, totalAmount, trigger }: PaymentDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const { data: payments, isLoading: loadingPayments } = usePayments(workOrderId);
  const createPayment = useCreatePayment();
  const totalPaid = useTotalPaid(workOrderId);
  
  const remaining = Math.max(0, totalAmount - totalPaid);
  const isPaidInFull = remaining === 0 && totalAmount > 0;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: remaining,
      payment_method: "PIX",
      notes: "",
    },
  });

  const onSubmit = async (data: FormData) => {
    try {
      await createPayment.mutateAsync({
        work_order_id: workOrderId,
        amount: data.amount,
        payment_method: data.payment_method,
        notes: data.notes,
      });

      toast({
        title: "Pagamento registrado! ✅",
        description: `${paymentMethodLabels[data.payment_method]} - R$ ${data.amount.toFixed(2)}`,
      });

      form.reset({ amount: Math.max(0, remaining - data.amount), payment_method: "PIX", notes: "" });
      
      // Close if paid in full
      if (data.amount >= remaining) {
        setOpen(false);
      }
    } catch (error) {
      console.error("Payment error:", error);
      toast({
        title: "Erro ao registrar pagamento",
        description: "Tente novamente",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button className="w-full gap-2" variant={isPaidInFull ? "outline" : "default"}>
            <DollarSign className="h-4 w-4" />
            {isPaidInFull ? "Ver Pagamentos" : "Registrar Pagamento"}
          </Button>
        </DialogTrigger>
      )}
      
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-accent" />
            Pagamentos
          </DialogTitle>
          <DialogDescription>
            Registre os pagamentos desta ordem de serviço.
          </DialogDescription>
        </DialogHeader>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 p-4 bg-muted/30 rounded-xl">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Total OS</p>
            <p className="text-lg font-bold font-display">{formatCurrency(totalAmount)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Pago</p>
            <p className="text-lg font-bold font-display text-green-600">{formatCurrency(totalPaid)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Restante</p>
            <p className={cn(
              "text-lg font-bold font-display",
              remaining > 0 ? "text-amber-600" : "text-green-600"
            )}>
              {formatCurrency(remaining)}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        {isPaidInFull ? (
          <div className="flex items-center justify-center gap-2 p-3 bg-green-100 dark:bg-green-950/30 rounded-lg text-green-700 dark:text-green-400">
            <Check className="h-5 w-5" />
            <span className="font-medium">Pagamento completo!</span>
          </div>
        ) : remaining < totalAmount && (
          <div className="flex items-center justify-center gap-2 p-3 bg-amber-100 dark:bg-amber-950/30 rounded-lg text-amber-700 dark:text-amber-400">
            <Clock className="h-5 w-5" />
            <span className="font-medium">Pagamento parcial - Falta {formatCurrency(remaining)}</span>
          </div>
        )}

        {/* Payment History */}
        {payments && payments.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Histórico de Pagamentos</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {payments.map((payment) => (
                <div 
                  key={payment.id}
                  className="flex items-center justify-between p-2.5 bg-background rounded-lg border"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{paymentMethodIcons[payment.payment_method]}</span>
                    <div>
                      <p className="text-sm font-medium">
                        {paymentMethodLabels[payment.payment_method]}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {payment.paid_at && format(new Date(payment.paid_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="font-mono">
                    {formatCurrency(Number(payment.amount))}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* New Payment Form */}
        {!isPaidInFull && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor do Pagamento</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          R$
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0,00"
                          className="pl-10 text-lg font-mono"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="payment_method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Forma de Pagamento</FormLabel>
                    <FormControl>
                      <div className="grid grid-cols-4 gap-2">
                        {paymentMethods.map((method) => (
                          <button
                            key={method.value}
                            type="button"
                            onClick={() => field.onChange(method.value)}
                            className={cn(
                              "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all",
                              field.value === method.value
                                ? "border-accent bg-accent/10 scale-105"
                                : "border-border hover:border-accent/50"
                            )}
                          >
                            <div className={cn(
                              "p-2 rounded-lg text-white",
                              method.color
                            )}>
                              {method.icon}
                            </div>
                            <span className="text-xs font-medium">{method.label}</span>
                          </button>
                        ))}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.watch("payment_method") === "MARCAR" && (
                <div className="flex items-start gap-2 p-3 bg-amber-100 dark:bg-amber-950/30 rounded-lg text-amber-700 dark:text-amber-400 text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>Pagamento marcado como "Fiado" será registrado, mas o valor ainda está pendente.</p>
                </div>
              )}

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações (opcional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Ex: Pagamento em 2x no cartão..."
                        className="min-h-[60px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={createPayment.isPending}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="gap-2 bg-green-600 hover:bg-green-700"
                  disabled={createPayment.isPending}
                >
                  {createPayment.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Registrando...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Confirmar Pagamento
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}

        {isPaidInFull && (
          <DialogFooter>
            <Button onClick={() => setOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
