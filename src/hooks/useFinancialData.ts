import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { startOfMonth, endOfMonth, subMonths, format, startOfDay, endOfDay } from "date-fns";

export interface DailyRevenue {
  date: string;
  amount: number;
}

export interface MonthlyRevenue {
  month: string;
  amount: number;
}

export interface ServiceStats {
  description: string;
  count: number;
  totalValue: number;
}

export interface FinancialSummary {
  todayRevenue: number;
  monthRevenue: number;
  lastMonthRevenue: number;
  avgTicket: number;
  totalOrders: number;
  pendingAmount: number;
}

// Get daily revenue for the current month
export function useDailyRevenue() {
  const { profile } = useAuth();
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  return useQuery({
    queryKey: ['daily_revenue', profile?.tenant_id, format(now, 'yyyy-MM')],
    queryFn: async () => {
      if (!profile?.tenant_id) return [];

      const { data, error } = await supabase
        .from('financial_entries')
        .select('entry_date, amount')
        .eq('tenant_id', profile.tenant_id)
        .eq('entry_type', 'RECEITA')
        .gte('entry_date', monthStart.toISOString())
        .lte('entry_date', monthEnd.toISOString())
        .order('entry_date', { ascending: true });

      if (error) throw error;

      // Group by date
      const grouped: Record<string, number> = {};
      data?.forEach(entry => {
        const date = format(new Date(entry.entry_date), 'yyyy-MM-dd');
        grouped[date] = (grouped[date] || 0) + Number(entry.amount);
      });

      // Convert to array
      const result: DailyRevenue[] = Object.entries(grouped).map(([date, amount]) => ({
        date,
        amount
      }));

      return result;
    },
    enabled: !!profile?.tenant_id,
  });
}

// Get monthly revenue for the last 6 months
export function useMonthlyRevenue() {
  const { profile } = useAuth();
  const now = new Date();
  const sixMonthsAgo = subMonths(startOfMonth(now), 5);

  return useQuery({
    queryKey: ['monthly_revenue', profile?.tenant_id],
    queryFn: async () => {
      if (!profile?.tenant_id) return [];

      const { data, error } = await supabase
        .from('financial_entries')
        .select('entry_date, amount')
        .eq('tenant_id', profile.tenant_id)
        .eq('entry_type', 'RECEITA')
        .gte('entry_date', sixMonthsAgo.toISOString())
        .order('entry_date', { ascending: true });

      if (error) throw error;

      // Group by month
      const grouped: Record<string, number> = {};
      data?.forEach(entry => {
        const month = format(new Date(entry.entry_date), 'yyyy-MM');
        grouped[month] = (grouped[month] || 0) + Number(entry.amount);
      });

      // Convert to array with month names
      const result: MonthlyRevenue[] = Object.entries(grouped).map(([month, amount]) => ({
        month: format(new Date(month + '-01'), 'MMM/yy'),
        amount
      }));

      return result;
    },
    enabled: !!profile?.tenant_id,
  });
}

// Get top services by count and value
export function useTopServices() {
  const { profile } = useAuth();
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  return useQuery({
    queryKey: ['top_services', profile?.tenant_id, format(now, 'yyyy-MM')],
    queryFn: async () => {
      if (!profile?.tenant_id) return [];

      const { data, error } = await supabase
        .from('work_order_items')
        .select(`
          description,
          quantity,
          work_order_pricing (
            total_price
          )
        `)
        .eq('tenant_id', profile.tenant_id)
        .eq('item_type', 'SERVICE');

      if (error) throw error;

      // Group by description
      const grouped: Record<string, { count: number; totalValue: number }> = {};
      data?.forEach(item => {
        const desc = item.description;
        if (!grouped[desc]) {
          grouped[desc] = { count: 0, totalValue: 0 };
        }
        grouped[desc].count += item.quantity;
        grouped[desc].totalValue += Number(item.work_order_pricing?.total_price || 0);
      });

      // Convert to array and sort by count
      const result: ServiceStats[] = Object.entries(grouped)
        .map(([description, stats]) => ({
          description,
          count: stats.count,
          totalValue: stats.totalValue
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return result;
    },
    enabled: !!profile?.tenant_id,
  });
}

// Get financial summary
export function useFinancialSummary() {
  const { profile } = useAuth();
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));

  return useQuery({
    queryKey: ['financial_summary', profile?.tenant_id, format(now, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!profile?.tenant_id) {
        return {
          todayRevenue: 0,
          monthRevenue: 0,
          lastMonthRevenue: 0,
          avgTicket: 0,
          totalOrders: 0,
          pendingAmount: 0
        } as FinancialSummary;
      }

      // Today's revenue
      const { data: todayData } = await supabase
        .from('financial_entries')
        .select('amount')
        .eq('tenant_id', profile.tenant_id)
        .eq('entry_type', 'RECEITA')
        .gte('entry_date', todayStart.toISOString())
        .lte('entry_date', todayEnd.toISOString());

      const todayRevenue = todayData?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;

      // This month's revenue
      const { data: monthData } = await supabase
        .from('financial_entries')
        .select('amount')
        .eq('tenant_id', profile.tenant_id)
        .eq('entry_type', 'RECEITA')
        .gte('entry_date', monthStart.toISOString())
        .lte('entry_date', monthEnd.toISOString());

      const monthRevenue = monthData?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;

      // Last month's revenue
      const { data: lastMonthData } = await supabase
        .from('financial_entries')
        .select('amount')
        .eq('tenant_id', profile.tenant_id)
        .eq('entry_type', 'RECEITA')
        .gte('entry_date', lastMonthStart.toISOString())
        .lte('entry_date', lastMonthEnd.toISOString());

      const lastMonthRevenue = lastMonthData?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;

      // Count finalized work orders this month
      const { data: ordersData, count } = await supabase
        .from('work_orders')
        .select('total_amount', { count: 'exact' })
        .eq('tenant_id', profile.tenant_id)
        .eq('workflow_step', 'FINALIZADO')
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString());

      const totalOrders = count || 0;
      const avgTicket = totalOrders > 0 ? monthRevenue / totalOrders : 0;

      // Pending amount (work orders in progress with total_amount)
      const { data: pendingData } = await supabase
        .from('work_orders')
        .select('total_amount')
        .eq('tenant_id', profile.tenant_id)
        .in('workflow_step', ['PRONTO_PARA_RETIRADA', 'APROVADO', 'EM_EXECUCAO', 'EM_QUALIDADE']);

      const pendingAmount = pendingData?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;

      return {
        todayRevenue,
        monthRevenue,
        lastMonthRevenue,
        avgTicket,
        totalOrders,
        pendingAmount
      } as FinancialSummary;
    },
    enabled: !!profile?.tenant_id,
  });
}

// Get payment method distribution
export function usePaymentMethodStats() {
  const { profile } = useAuth();
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  return useQuery({
    queryKey: ['payment_method_stats', profile?.tenant_id, format(now, 'yyyy-MM')],
    queryFn: async () => {
      if (!profile?.tenant_id) return [];

      const { data, error } = await supabase
        .from('payments')
        .select('payment_method, amount')
        .eq('tenant_id', profile.tenant_id)
        .gte('paid_at', monthStart.toISOString())
        .lte('paid_at', monthEnd.toISOString());

      if (error) throw error;

      // Group by payment method
      const grouped: Record<string, number> = {};
      data?.forEach(payment => {
        const method = payment.payment_method;
        grouped[method] = (grouped[method] || 0) + Number(payment.amount);
      });

      const methodLabels: Record<string, string> = {
        PIX: 'Pix',
        CARTAO: 'Cartão',
        DINHEIRO: 'Dinheiro',
        MARCAR: 'Fiado'
      };

      return Object.entries(grouped).map(([method, amount]) => ({
        method: methodLabels[method] || method,
        amount,
        fill: method === 'PIX' ? 'hsl(var(--chart-1))' : 
              method === 'CARTAO' ? 'hsl(var(--chart-2))' :
              method === 'DINHEIRO' ? 'hsl(var(--chart-3))' :
              'hsl(var(--chart-4))'
      }));
    },
    enabled: !!profile?.tenant_id,
  });
}
