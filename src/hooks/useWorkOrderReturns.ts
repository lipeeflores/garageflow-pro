import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface WorkOrderReturn {
  id: string;
  tenant_id: string;
  original_work_order_id: string;
  return_work_order_id: string;
  mechanic_blamed_id: string | null;
  reason: string;
  return_date: string;
  created_at: string | null;
  original_work_order?: {
    id: string;
    vehicle?: {
      plate: string;
      make: string;
      model: string;
    };
    customer?: {
      full_name: string;
    };
  };
  return_work_order?: {
    id: string;
    workflow_step: string;
  };
  mechanic_blamed?: {
    id: string;
    full_name: string;
  };
}

export interface CreateReturnData {
  original_work_order_id: string;
  reason: string;
  mechanic_blamed_id?: string;
  vehicle_id: string;
  customer_id: string;
  initial_complaint: string;
}

const RETURN_PENALTY_POINTS = 10;

export interface WorkOrderReturnData {
  asOriginal: WorkOrderReturn[];
  asReturn: WorkOrderReturn | undefined;
}

// Get returns for a specific work order (as original or as return)
export function useWorkOrderReturns(workOrderId: string) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['work_order_returns', workOrderId],
    queryFn: async (): Promise<WorkOrderReturnData> => {
      if (!profile?.tenant_id) {
        return { asOriginal: [], asReturn: undefined };
      }

      // Get returns where this is the original work order
      const { data: asOriginal, error: err1 } = await supabase
        .from('work_order_returns')
        .select(`
          *,
          return_work_order:work_orders!work_order_returns_return_work_order_id_fkey (
            id,
            workflow_step
          ),
          mechanic_blamed:profiles!work_order_returns_mechanic_blamed_id_fkey (
            id,
            full_name
          )
        `)
        .eq('tenant_id', profile.tenant_id)
        .eq('original_work_order_id', workOrderId);

      if (err1) throw err1;

      // Get returns where this is the return work order
      const { data: asReturn, error: err2 } = await supabase
        .from('work_order_returns')
        .select(`
          *,
          original_work_order:work_orders!work_order_returns_original_work_order_id_fkey (
            id,
            vehicle:vehicles (
              plate,
              make,
              model
            ),
            customer:customers (
              full_name
            )
          )
        `)
        .eq('tenant_id', profile.tenant_id)
        .eq('return_work_order_id', workOrderId);

      if (err2) throw err2;

      return {
        asOriginal: asOriginal as unknown as WorkOrderReturn[],
        asReturn: asReturn?.[0] as unknown as WorkOrderReturn | undefined
      };
    },
    enabled: !!profile?.tenant_id && !!workOrderId,
  });
}

// Get all returns for the tenant
export function useAllReturns() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['all_work_order_returns', profile?.tenant_id],
    queryFn: async () => {
      if (!profile?.tenant_id) return [];

      const { data, error } = await supabase
        .from('work_order_returns')
        .select(`
          *,
          original_work_order:work_orders!work_order_returns_original_work_order_id_fkey (
            id,
            vehicle:vehicles (
              plate,
              make,
              model
            ),
            customer:customers (
              full_name
            )
          ),
          return_work_order:work_orders!work_order_returns_return_work_order_id_fkey (
            id,
            workflow_step
          ),
          mechanic_blamed:profiles!work_order_returns_mechanic_blamed_id_fkey (
            id,
            full_name
          )
        `)
        .eq('tenant_id', profile.tenant_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as WorkOrderReturn[];
    },
    enabled: !!profile?.tenant_id,
  });
}

// Create a return work order with penalty
export function useCreateReturn() {
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateReturnData) => {
      if (!profile?.tenant_id || !user?.id) {
        throw new Error("Not authenticated");
      }

      // 1. Create the new return work order
      const { data: newWorkOrder, error: woError } = await supabase
        .from('work_orders')
        .insert({
          tenant_id: profile.tenant_id,
          customer_id: data.customer_id,
          vehicle_id: data.vehicle_id,
          initial_complaint: data.initial_complaint,
          order_type: 'RETORNO',
          original_work_order_id: data.original_work_order_id,
          created_by: user.id,
          workflow_step: 'AGUARDANDO_CHECKIN',
        })
        .select()
        .single();

      if (woError) throw woError;

      // 2. Create the return record linking both work orders
      const { data: returnRecord, error: returnError } = await supabase
        .from('work_order_returns')
        .insert({
          tenant_id: profile.tenant_id,
          original_work_order_id: data.original_work_order_id,
          return_work_order_id: newWorkOrder.id,
          mechanic_blamed_id: data.mechanic_blamed_id || null,
          reason: data.reason,
        })
        .select()
        .single();

      if (returnError) throw returnError;

      // 3. Apply penalty to the blamed mechanic (if specified)
      if (data.mechanic_blamed_id) {
        const { error: penaltyError } = await supabase
          .from('ranking_penalties')
          .insert({
            tenant_id: profile.tenant_id,
            profile_id: data.mechanic_blamed_id,
            work_order_id: data.original_work_order_id,
            penalty_points: RETURN_PENALTY_POINTS,
            reason: `Retorno de garantia: ${data.reason}`,
          });

        if (penaltyError) {
          console.error('Failed to apply penalty:', penaltyError);
          // Don't throw - the return was created successfully
        }
      }

      // 4. Add event to original work order
      await supabase.from('work_order_events').insert({
        tenant_id: profile.tenant_id,
        work_order_id: data.original_work_order_id,
        event_type: 'RETORNO_CRIADO',
        description: `OS de retorno criada: ${newWorkOrder.id.slice(0, 8).toUpperCase()}. Motivo: ${data.reason}`,
        actor_id: user.id,
        new_data: {
          return_work_order_id: newWorkOrder.id,
          mechanic_blamed_id: data.mechanic_blamed_id,
          reason: data.reason,
        },
      });

      return { workOrder: newWorkOrder, returnRecord };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['work_order_returns'] });
      queryClient.invalidateQueries({ queryKey: ['work_orders'] });
      queryClient.invalidateQueries({ queryKey: ['work_order', variables.original_work_order_id] });
      queryClient.invalidateQueries({ queryKey: ['work_order_events'] });
      queryClient.invalidateQueries({ queryKey: ['ranking_penalties'] });
      queryClient.invalidateQueries({ queryKey: ['mechanic_ranking'] });
    },
  });
}
