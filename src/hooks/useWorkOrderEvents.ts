import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

type WorkOrderEventRow = Database['public']['Tables']['work_order_events']['Row'];

export interface WorkOrderEvent extends WorkOrderEventRow {
  actor?: {
    full_name: string;
  } | null;
}

export function useWorkOrderEvents(workOrderId: string | undefined) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['work_order_events', workOrderId],
    queryFn: async () => {
      if (!workOrderId || !profile?.tenant_id) return [];

      const { data, error } = await supabase
        .from('work_order_events')
        .select('*')
        .eq('work_order_id', workOrderId)
        .eq('tenant_id', profile.tenant_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch actor names
      if (data && data.length > 0) {
        const actorIds = [...new Set(data.filter(e => e.actor_id).map(e => e.actor_id))];
        
        if (actorIds.length > 0) {
          const { data: actors } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', actorIds as string[]);
          
          const actorMap = new Map(actors?.map(a => [a.id, a]) ?? []);
          
          return data.map(event => ({
            ...event,
            actor: event.actor_id ? actorMap.get(event.actor_id) ?? null : null,
          })) as WorkOrderEvent[];
        }
      }

      return data as WorkOrderEvent[];
    },
    enabled: !!workOrderId && !!profile?.tenant_id,
  });
}
