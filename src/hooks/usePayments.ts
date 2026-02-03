import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Database } from "@/integrations/supabase/types";

export type PaymentMethod = Database["public"]["Enums"]["payment_method"];

export interface Payment {
  id: string;
  tenant_id: string;
  work_order_id: string;
  amount: number;
  payment_method: PaymentMethod;
  notes: string | null;
  paid_at: string | null;
  processed_by: string | null;
  created_at: string | null;
}

export interface CreatePaymentData {
  work_order_id: string;
  amount: number;
  payment_method: PaymentMethod;
  notes?: string;
}

export function usePayments(workOrderId: string) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['payments', workOrderId],
    queryFn: async () => {
      if (!profile?.tenant_id) return [];

      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .eq('work_order_id', workOrderId)
        .order('paid_at', { ascending: false });

      if (error) throw error;
      return data as Payment[];
    },
    enabled: !!profile?.tenant_id && !!workOrderId,
  });
}

export function useCreatePayment() {
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreatePaymentData) => {
      if (!profile?.tenant_id || !user?.id) {
        throw new Error("Not authenticated");
      }

      // 1. Create payment record
      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .insert({
          tenant_id: profile.tenant_id,
          work_order_id: data.work_order_id,
          amount: data.amount,
          payment_method: data.payment_method,
          notes: data.notes || null,
          processed_by: user.id,
          paid_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      // 2. Create financial entry (RECEITA)
      const { error: entryError } = await supabase
        .from('financial_entries')
        .insert({
          tenant_id: profile.tenant_id,
          work_order_id: data.work_order_id,
          payment_id: payment.id,
          amount: data.amount,
          entry_type: 'RECEITA',
          category: paymentMethodLabels[data.payment_method],
          description: `Pagamento OS ${data.work_order_id.slice(0, 8).toUpperCase()}`,
        });

      if (entryError) throw entryError;

      return payment;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payments', variables.work_order_id] });
      queryClient.invalidateQueries({ queryKey: ['work_order', variables.work_order_id] });
      queryClient.invalidateQueries({ queryKey: ['financial_entries'] });
    },
  });
}

export function useTotalPaid(workOrderId: string) {
  const { data: payments } = usePayments(workOrderId);
  return payments?.reduce((sum, p) => sum + Number(p.amount), 0) ?? 0;
}

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  PIX: "Pix",
  CARTAO: "Cartão",
  DINHEIRO: "Dinheiro",
  MARCAR: "Marcar (Fiado)",
};

export const paymentMethodIcons: Record<PaymentMethod, string> = {
  PIX: "📱",
  CARTAO: "💳",
  DINHEIRO: "💵",
  MARCAR: "📝",
};
