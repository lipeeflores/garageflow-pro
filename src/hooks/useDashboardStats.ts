import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { startOfDay, endOfDay, startOfMonth, endOfMonth, differenceInMinutes, format } from "date-fns";

export interface DashboardStats {
  activeOrders: number;
  pendingBudget: number;
  todayVehicles: number;
  arrivedVehicles: number;
  avgTimePerOS: number; // in minutes
  todayRevenue: number;
}

export function useDashboardStats() {
  const { profile } = useAuth();
  const now = new Date();

  return useQuery({
    queryKey: ['dashboard_stats', profile?.tenant_id, format(now, 'yyyy-MM-dd')],
    queryFn: async (): Promise<DashboardStats> => {
      if (!profile?.tenant_id) {
        return {
          activeOrders: 0,
          pendingBudget: 0,
          todayVehicles: 0,
          arrivedVehicles: 0,
          avgTimePerOS: 0,
          todayRevenue: 0,
        };
      }

      const todayStart = startOfDay(now);
      const todayEnd = endOfDay(now);
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);

      // Active orders (not finalized or cancelled)
      const { data: activeOrdersData, error: activeError } = await supabase
        .from('work_orders')
        .select('id', { count: 'exact' })
        .eq('tenant_id', profile.tenant_id)
        .not('workflow_step', 'in', '("FINALIZADO","CANCELADO")');

      if (activeError) console.error('Error fetching active orders:', activeError);

      // Pending budget
      const { data: pendingData, error: pendingError } = await supabase
        .from('work_orders')
        .select('id', { count: 'exact' })
        .eq('tenant_id', profile.tenant_id)
        .eq('workflow_step', 'AGUARDANDO_ORCAMENTO');

      if (pendingError) console.error('Error fetching pending budget:', pendingError);

      // Today appointments
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('appointments')
        .select('id, status')
        .eq('tenant_id', profile.tenant_id)
        .gte('scheduled_at', todayStart.toISOString())
        .lte('scheduled_at', todayEnd.toISOString());

      if (appointmentsError) console.error('Error fetching appointments:', appointmentsError);

      const todayVehicles = appointmentsData?.length || 0;
      const arrivedVehicles = appointmentsData?.filter(a => a.status === 'CHEGOU').length || 0;

      // Average time per OS (from time_entries for finalized orders this month)
      const { data: timeEntriesData, error: timeError } = await supabase
        .from('time_entries')
        .select(`
          start_time,
          end_time,
          work_order:work_orders!inner(
            id,
            workflow_step,
            updated_at
          )
        `)
        .eq('tenant_id', profile.tenant_id)
        .not('end_time', 'is', null);

      if (timeError) console.error('Error fetching time entries:', timeError);

      // Calculate average time per OS
      let totalMinutes = 0;
      let osCount = 0;
      const osTimeMap: Record<string, number> = {};

      timeEntriesData?.forEach((entry) => {
        if (entry.start_time && entry.end_time && entry.work_order) {
          const orderId = entry.work_order.id;
          const minutes = differenceInMinutes(new Date(entry.end_time), new Date(entry.start_time));
          
          if (!osTimeMap[orderId]) {
            osTimeMap[orderId] = 0;
          }
          osTimeMap[orderId] += minutes;
        }
      });

      // Calculate average from completed OS
      const osIds = Object.keys(osTimeMap);
      osIds.forEach((id) => {
        totalMinutes += osTimeMap[id];
        osCount++;
      });

      const avgTimePerOS = osCount > 0 ? Math.round(totalMinutes / osCount) : 0;

      // Today's revenue
      const { data: revenueData, error: revenueError } = await supabase
        .from('financial_entries')
        .select('amount')
        .eq('tenant_id', profile.tenant_id)
        .eq('entry_type', 'RECEITA')
        .gte('entry_date', todayStart.toISOString())
        .lte('entry_date', todayEnd.toISOString());

      if (revenueError) console.error('Error fetching revenue:', revenueError);

      const todayRevenue = revenueData?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;

      return {
        activeOrders: activeOrdersData?.length || 0,
        pendingBudget: pendingData?.length || 0,
        todayVehicles,
        arrivedVehicles,
        avgTimePerOS,
        todayRevenue,
      };
    },
    enabled: !!profile?.tenant_id,
    refetchInterval: 60000, // Refresh every minute
  });
}

// Format minutes to hours and minutes string
export function formatDuration(minutes: number): string {
  if (minutes === 0) return "--";
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours === 0) {
    return `${mins}min`;
  }
  
  if (mins === 0) {
    return `${hours}h`;
  }
  
  return `${hours}h ${mins}min`;
}

// Format currency
export function formatCurrency(value: number): string {
  if (value === 0) return "R$ --";
  
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}
