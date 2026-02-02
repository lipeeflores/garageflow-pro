import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type DiagnosticRow = Database['public']['Tables']['work_order_diagnostics']['Row'];
type DiagnosticInsert = Database['public']['Tables']['work_order_diagnostics']['Insert'];

export interface WorkOrderDiagnostic extends DiagnosticRow {
  mechanic?: {
    full_name: string;
  } | null;
}

export function useWorkOrderDiagnostics(workOrderId: string | undefined) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['work_order_diagnostics', workOrderId],
    queryFn: async () => {
      if (!workOrderId || !profile?.tenant_id) return [];

      const { data, error } = await supabase
        .from('work_order_diagnostics')
        .select('*')
        .eq('work_order_id', workOrderId)
        .eq('tenant_id', profile.tenant_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch mechanic names
      if (data && data.length > 0) {
        const mechanicIds = [...new Set(data.map(d => d.mechanic_id))];
        
        const { data: mechanics } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', mechanicIds);
        
        const mechanicMap = new Map(mechanics?.map(m => [m.id, m]) ?? []);
        
        return data.map(diagnostic => ({
          ...diagnostic,
          mechanic: mechanicMap.get(diagnostic.mechanic_id) ?? null,
        })) as WorkOrderDiagnostic[];
      }

      return data as WorkOrderDiagnostic[];
    },
    enabled: !!workOrderId && !!profile?.tenant_id,
  });
}

export function useCreateDiagnostic() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (diagnostic: Omit<DiagnosticInsert, 'tenant_id' | 'mechanic_id'>) => {
      if (!profile?.tenant_id || !user?.id) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from('work_order_diagnostics')
        .insert({
          ...diagnostic,
          tenant_id: profile.tenant_id,
          mechanic_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['work_order_diagnostics', variables.work_order_id] });
      queryClient.invalidateQueries({ queryKey: ['work_orders'] });
      toast({
        title: "Sucesso",
        description: "Diagnóstico registrado",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Erro ao registrar diagnóstico",
        variant: "destructive",
      });
      console.error(error);
    },
  });
}

export function useUpdateDiagnostic() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, workOrderId, updates }: { 
      id: string; 
      workOrderId: string;
      updates: Partial<DiagnosticRow>;
    }) => {
      const { data, error } = await supabase
        .from('work_order_diagnostics')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { data, workOrderId };
    },
    onSuccess: ({ workOrderId }) => {
      queryClient.invalidateQueries({ queryKey: ['work_order_diagnostics', workOrderId] });
      toast({
        title: "Sucesso",
        description: "Diagnóstico atualizado",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar diagnóstico",
        variant: "destructive",
      });
      console.error(error);
    },
  });
}
