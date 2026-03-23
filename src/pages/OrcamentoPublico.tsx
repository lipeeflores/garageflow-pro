import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Car, 
  User, 
  Phone, 
  CheckCircle, 
  XCircle,
  Wrench,
  Package,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BudgetItem {
  id: string;
  description: string;
  item_type: 'SERVICE' | 'PART';
  quantity: number;
  pricing?: {
    unit_price: number;
    total_price: number;
  } | null;
}

interface WorkOrderData {
  id: string;
  initial_complaint: string | null;
  workflow_step: string;
  created_at: string;
  customer: {
    full_name: string;
    phone_number: string;
  } | null;
  vehicle: {
    plate: string;
    make: string;
    model: string;
    year: number | null;
    color: string | null;
  } | null;
  items: BudgetItem[];
}

export default function OrcamentoPublico() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [workOrder, setWorkOrder] = useState<WorkOrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [decision, setDecision] = useState<'approved' | 'rejected' | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchWorkOrder() {
      if (!id || !token) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('get-public-budget', {
          body: { id, token },
        });

        if (error || data?.error) {
          console.error('Error fetching budget:', error || data?.error);
          setLoading(false);
          return;
        }

        // Check if already approved/rejected
        if (data.workflow_step !== 'AGUARDANDO_APROVACAO') {
          if (['APROVADO', 'EM_EXECUCAO', 'PRONTO_PARA_RETIRADA', 'FINALIZADO'].includes(data.workflow_step)) {
            setDecision('approved');
            setSubmitted(true);
          } else if (data.workflow_step === 'CANCELADO') {
            setDecision('rejected');
            setSubmitted(true);
          }
        }

        // Transform items
        const transformedItems = (data.items || []).map((item: any) => ({
          ...item,
          pricing: item.pricing?.[0] || null
        }));

        setWorkOrder({ ...data, items: transformedItems } as WorkOrderData);
      } catch (error) {
        console.error('Error fetching work order:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchWorkOrder();
  }, [id, token]);

  const handleDecision = async (approve: boolean) => {
    if (!id || !token || submitting) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-public-budget', {
        body: { id, token, action: approve ? 'approve' : 'reject' },
      });

      if (error || data?.error) throw new Error(data?.error || 'Failed');

      setDecision(approve ? 'approved' : 'rejected');
      setSubmitted(true);
      
      toast({
        title: approve ? "Orçamento Aprovado!" : "Orçamento Recusado",
        description: approve 
          ? "Seu veículo entrará em execução em breve." 
          : "O orçamento foi recusado. Entre em contato para mais informações.",
      });
    } catch (error) {
      console.error('Error updating work order:', error);
      toast({
        title: "Erro",
        description: "Não foi possível processar sua decisão. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Carregando orçamento...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!workOrder || !token) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <XCircle className="h-12 w-12 text-destructive" />
            <h2 className="mt-4 font-display text-xl font-bold">Link Inválido</h2>
            <p className="mt-2 text-center text-muted-foreground">
              Este link de orçamento é inválido ou expirou.
              Entre em contato com a oficina para mais informações.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const services = workOrder.items.filter(i => i.item_type === 'SERVICE');
  const parts = workOrder.items.filter(i => i.item_type === 'PART');
  const servicesTotal = services.reduce((sum, i) => sum + (i.pricing?.total_price || 0), 0);
  const partsTotal = parts.reduce((sum, i) => sum + (i.pricing?.total_price || 0), 0);
  const grandTotal = servicesTotal + partsTotal;

  if (submitted) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            {decision === 'approved' ? (
              <>
                <CheckCircle className="h-16 w-16 text-green-500" />
                <h2 className="mt-4 font-display text-2xl font-bold text-green-500">
                  Orçamento Aprovado!
                </h2>
                <p className="mt-2 text-center text-muted-foreground">
                  Seu veículo <strong>{workOrder.vehicle?.plate}</strong> entrará 
                  em execução em breve. Você receberá atualizações por WhatsApp.
                </p>
              </>
            ) : (
              <>
                <XCircle className="h-16 w-16 text-destructive" />
                <h2 className="mt-4 font-display text-2xl font-bold text-destructive">
                  Orçamento Recusado
                </h2>
                <p className="mt-2 text-center text-muted-foreground">
                  O orçamento foi recusado. Entre em contato com a oficina para 
                  discutir alternativas ou agendar a retirada do veículo.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="mx-auto max-w-2xl space-y-6">
        <Card>
          <CardHeader className="text-center pb-4">
            <CardTitle className="font-display text-2xl">Orçamento de Serviço</CardTitle>
            <CardDescription>
              OS-{workOrder.id.slice(0, 8).toUpperCase()} • Criada em{" "}
              {format(new Date(workOrder.created_at), "dd/MM/yyyy", { locale: ptBR })}
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Car className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-display text-xl font-bold">{workOrder.vehicle?.plate}</p>
                  <p className="text-sm text-muted-foreground">
                    {workOrder.vehicle?.make} {workOrder.vehicle?.model}
                    {workOrder.vehicle?.year && ` (${workOrder.vehicle.year})`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{workOrder.customer?.full_name}</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {workOrder.customer?.phone_number}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {workOrder.initial_complaint && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Reclamação Inicial</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{workOrder.initial_complaint}</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Itens do Orçamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {services.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Wrench className="h-4 w-4 text-primary" />
                  <span className="font-medium">Serviços</span>
                </div>
                <div className="space-y-2">
                  {services.map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                      <span className="text-sm">{item.description}</span>
                      <span className="font-medium">
                        {item.pricing?.total_price ? `R$ ${item.pricing.total_price.toFixed(2)}` : '-'}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-right text-sm">
                  <span className="text-muted-foreground">Subtotal: </span>
                  <span className="font-medium">R$ {servicesTotal.toFixed(2)}</span>
                </div>
              </div>
            )}

            {parts.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Package className="h-4 w-4 text-accent" />
                  <span className="font-medium">Peças</span>
                </div>
                <div className="space-y-2">
                  {parts.map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                      <div>
                        <span className="text-sm">{item.description}</span>
                        {item.quantity > 1 && (
                          <Badge variant="secondary" className="ml-2">x{item.quantity}</Badge>
                        )}
                      </div>
                      <span className="font-medium">
                        {item.pricing?.total_price ? `R$ ${item.pricing.total_price.toFixed(2)}` : '-'}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-right text-sm">
                  <span className="text-muted-foreground">Subtotal: </span>
                  <span className="font-medium">R$ {partsTotal.toFixed(2)}</span>
                </div>
              </div>
            )}

            {workOrder.items.length === 0 && (
              <p className="text-center text-muted-foreground py-4">Nenhum item no orçamento</p>
            )}

            <Separator />

            <div className="flex items-center justify-between text-lg">
              <span className="font-medium">Total</span>
              <span className="font-display text-2xl font-bold text-primary">
                R$ {grandTotal.toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                size="lg"
                className="w-full gap-2 bg-green-600 hover:bg-green-700"
                onClick={() => handleDecision(true)}
                disabled={submitting}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
                Aprovar Orçamento
              </Button>
              <Button
                size="lg"
                variant="destructive"
                className="w-full gap-2"
                onClick={() => handleDecision(false)}
                disabled={submitting}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-5 w-5" />}
                Recusar Orçamento
              </Button>
            </div>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Ao aprovar, você autoriza a execução dos serviços e peças listados acima.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
