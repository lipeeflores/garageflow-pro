import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Bill {
  id: string;
  tenant_id: string;
  description: string;
  amount: number;
  category: "FIXA" | "FLUTUANTE";
  status: "PENDENTE" | "PAGO" | "VENCIDO" | "CANCELADO";
  due_date: string;
  paid_at: string | null;
  paid_amount: number | null;
  supplier: string | null;
  notes: string | null;
  is_recurring: boolean;
  recurrence_day: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type BillInsert = Omit<Bill, "id" | "created_at" | "updated_at" | "status" | "paid_at" | "paid_amount">;

export function useBills(filter?: { category?: "FIXA" | "FLUTUANTE"; status?: string }) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["bills", profile?.tenant_id, filter],
    queryFn: async () => {
      if (!profile?.tenant_id) return [];

      let query = supabase
        .from("bills")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .order("due_date", { ascending: true });

      if (filter?.category) {
        query = query.eq("category", filter.category);
      }
      if (filter?.status) {
        query = query.eq("status", filter.status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Bill[];
    },
    enabled: !!profile?.tenant_id,
  });
}

export function useBillsSummary() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["bills_summary", profile?.tenant_id],
    queryFn: async () => {
      if (!profile?.tenant_id) return { totalPending: 0, totalOverdue: 0, totalFixed: 0, totalVariable: 0 };

      const { data, error } = await supabase
        .from("bills")
        .select("amount, category, status, due_date")
        .eq("tenant_id", profile.tenant_id)
        .in("status", ["PENDENTE", "VENCIDO"]);

      if (error) throw error;

      const now = new Date().toISOString().split("T")[0];
      let totalPending = 0, totalOverdue = 0, totalFixed = 0, totalVariable = 0;

      (data as Bill[])?.forEach((bill) => {
        const amount = Number(bill.amount);
        if (bill.status === "VENCIDO" || (bill.status === "PENDENTE" && bill.due_date < now)) {
          totalOverdue += amount;
        } else {
          totalPending += amount;
        }
        if (bill.category === "FIXA") totalFixed += amount;
        else totalVariable += amount;
      });

      return { totalPending, totalOverdue, totalFixed, totalVariable };
    },
    enabled: !!profile?.tenant_id,
  });
}

export function useCreateBill() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuth();

  return useMutation({
    mutationFn: async (bill: Omit<BillInsert, "tenant_id" | "created_by">) => {
      if (!profile?.tenant_id) throw new Error("Sem tenant");

      const { data, error } = await supabase
        .from("bills")
        .insert({
          ...bill,
          tenant_id: profile.tenant_id,
          created_by: user?.id || null,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["bills_summary"] });
      toast.success("Conta adicionada com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao adicionar conta: " + error.message);
    },
  });
}

export function useUpdateBill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<Bill>) => {
      const { data, error } = await supabase
        .from("bills")
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["bills_summary"] });
      toast.success("Conta atualizada");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar: " + error.message);
    },
  });
}

export function useDeleteBill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bills").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["bills_summary"] });
      toast.success("Conta removida");
    },
    onError: (error) => {
      toast.error("Erro ao remover: " + error.message);
    },
  });
}

export function useMarkBillPaid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, paid_amount }: { id: string; paid_amount: number }) => {
      const { data, error } = await supabase
        .from("bills")
        .update({
          status: "PAGO",
          paid_at: new Date().toISOString(),
          paid_amount,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["bills_summary"] });
      toast.success("Conta marcada como paga");
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
    },
  });
}
