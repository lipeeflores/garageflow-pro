import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type WorkOrderRow = Database['public']['Tables']['work_orders']['Row'];
type WorkOrderInsert = Database['public']['Tables']['work_orders']['Insert'];
type WorkOrderUpdate = Database['public']['Tables']['work_orders']['Update'];

export type WorkflowStep = WorkOrderRow['workflow_step'];
export type BoxLocation = WorkOrderRow['box_location'];
export type Priority = WorkOrderRow['priority'];
export type OrderType = WorkOrderRow['order_type'];

export interface WorkOrder extends WorkOrderRow {
  customer?: {
    full_name: string;
    phone_number: string;
  } | null;
  vehicle?: {
    plate: string;
    make: string;
    model: string;
    year: number | null;
    color: string | null;
  } | null;
  mechanic?: {
    full_name: string;
  } | null;
}

export function useWorkOrders(filters?: { workflow_step?: WorkflowStep[] }) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['work_orders', filters],
    queryFn: async () => {
      if (!profile?.tenant_id) return [];

      let query = supabase
        .from('work_orders')
        .select(`
          *,
          customer:customers(full_name, phone_number),
          vehicle:vehicles(plate, make, model, year, color)
        `)
        .eq('tenant_id', profile.tenant_id)
        .order('created_at', { ascending: false });

      if (filters?.workflow_step && filters.workflow_step.length > 0) {
        query = query.in('workflow_step', filters.workflow_step);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Fetch mechanic names separately
      if (data && data.length > 0) {
        const mechanicIds = [...new Set(data.filter(wo => wo.current_mechanic_id).map(wo => wo.current_mechanic_id))];
        
        if (mechanicIds.length > 0) {
          const { data: mechanics } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', mechanicIds as string[]);
          
          const mechanicMap = new Map(mechanics?.map(m => [m.id, m]) ?? []);
          
          return data.map(wo => ({
            ...wo,
            mechanic: wo.current_mechanic_id ? mechanicMap.get(wo.current_mechanic_id) ?? null : null,
          })) as WorkOrder[];
        }
      }
      
      return data as WorkOrder[];
    },
    enabled: !!profile?.tenant_id,
  });
}

export function useWorkOrder(id: string | undefined) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['work_order', id],
    queryFn: async () => {
      if (!id || !profile?.tenant_id) return null;

      const { data, error } = await supabase
        .from('work_orders')
        .select(`
          *,
          customer:customers(full_name, phone_number, email),
          vehicle:vehicles(plate, make, model, year, color, chassis),
          checkin:work_order_checkins(*),
          diagnostics:work_order_diagnostics(*),
          items:work_order_items(*)
        `)
        .eq('id', id)
        .eq('tenant_id', profile.tenant_id)
        .single();

      if (error) throw error;
      
      // Fetch mechanic separately
      if (data?.current_mechanic_id) {
        const { data: mechanic } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', data.current_mechanic_id)
          .single();
        
        return { ...data, mechanic } as WorkOrder;
      }
      
      return data as WorkOrder;
    },
    enabled: !!id && !!profile?.tenant_id,
  });
}

export function useUpdateWorkOrder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: WorkOrderUpdate }) => {
      const { data, error } = await supabase
        .from('work_orders')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work_orders'] });
      queryClient.invalidateQueries({ queryKey: ['work_order'] });
      toast({
        title: "Sucesso",
        description: "Ordem de serviço atualizada",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar ordem de serviço",
        variant: "destructive",
      });
      console.error(error);
    },
  });
}

export function useCreateWorkOrder() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (workOrder: Omit<WorkOrderInsert, 'tenant_id'>) => {
      if (!profile?.tenant_id) throw new Error("Tenant not found");

      const { data, error } = await supabase
        .from('work_orders')
        .insert({
          ...workOrder,
          tenant_id: profile.tenant_id,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work_orders'] });
      toast({
        title: "Sucesso",
        description: "Ordem de serviço criada",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Erro ao criar ordem de serviço",
        variant: "destructive",
      });
      console.error(error);
    },
  });
}
