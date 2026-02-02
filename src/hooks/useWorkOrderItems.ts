import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type WorkOrderItemRow = Database['public']['Tables']['work_order_items']['Row'];
type WorkOrderItemInsert = Database['public']['Tables']['work_order_items']['Insert'];
type WorkOrderPricingRow = Database['public']['Tables']['work_order_pricing']['Row'];

export interface WorkOrderItem extends WorkOrderItemRow {
  pricing?: WorkOrderPricingRow | null;
}

export function useWorkOrderItems(workOrderId: string | undefined) {
  const { profile, isAdminOrManager } = useAuth();

  return useQuery({
    queryKey: ['work_order_items', workOrderId],
    queryFn: async () => {
      if (!workOrderId || !profile?.tenant_id) return [];

      const { data: items, error } = await supabase
        .from('work_order_items')
        .select('*')
        .eq('work_order_id', workOrderId)
        .eq('tenant_id', profile.tenant_id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Only fetch pricing if user is admin/manager
      if (isAdminOrManager && items && items.length > 0) {
        const { data: pricing } = await supabase
          .from('work_order_pricing')
          .select('*')
          .in('work_order_item_id', items.map(i => i.id));

        const pricingMap = new Map(pricing?.map(p => [p.work_order_item_id, p]) ?? []);

        return items.map(item => ({
          ...item,
          pricing: pricingMap.get(item.id) ?? null,
        })) as WorkOrderItem[];
      }

      return items as WorkOrderItem[];
    },
    enabled: !!workOrderId && !!profile?.tenant_id,
  });
}

export function useCreateWorkOrderItem() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (item: Omit<WorkOrderItemInsert, 'tenant_id'>) => {
      if (!profile?.tenant_id) throw new Error("Tenant not found");

      const { data, error } = await supabase
        .from('work_order_items')
        .insert({
          ...item,
          tenant_id: profile.tenant_id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['work_order_items', variables.work_order_id] });
      toast({
        title: "Sucesso",
        description: "Item adicionado à OS",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Erro ao adicionar item",
        variant: "destructive",
      });
      console.error(error);
    },
  });
}

export function useDeleteWorkOrderItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, workOrderId }: { id: string; workOrderId: string }) => {
      const { error } = await supabase
        .from('work_order_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return workOrderId;
    },
    onSuccess: (workOrderId) => {
      queryClient.invalidateQueries({ queryKey: ['work_order_items', workOrderId] });
      toast({
        title: "Sucesso",
        description: "Item removido da OS",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Erro ao remover item",
        variant: "destructive",
      });
      console.error(error);
    },
  });
}
