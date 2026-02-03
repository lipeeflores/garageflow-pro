import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface CustomerWithStats {
  id: string;
  tenant_id: string;
  full_name: string;
  phone_number: string;
  email: string | null;
  cpf_cnpj: string | null;
  address: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
  vehicle_count: number;
  os_count: number;
  last_visit: string | null;
  total_spent: number;
}

export interface CustomerHistoryData {
  customer: CustomerWithStats | null;
  vehicles: Array<{
    id: string;
    plate: string;
    make: string;
    model: string;
    year: number | null;
    color: string | null;
    created_at: string;
  }>;
  workOrders: Array<{
    id: string;
    created_at: string;
    workflow_step: string;
    initial_complaint: string | null;
    total_amount: number | null;
    vehicle: {
      plate: string;
      make: string;
      model: string;
    };
    current_mechanic: {
      full_name: string;
    } | null;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    payment_method: string;
    paid_at: string | null;
    work_order_id: string;
  }>;
  timeline: Array<{
    id: string;
    type: 'work_order' | 'payment' | 'appointment';
    date: string;
    description: string;
    metadata?: Record<string, unknown>;
  }>;
}

export function useCustomersWithStats(search?: string) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['customers-with-stats', search],
    queryFn: async (): Promise<CustomerWithStats[]> => {
      if (!profile?.tenant_id) return [];

      // Fetch customers
      let customerQuery = supabase
        .from('customers')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .order('full_name');

      if (search) {
        customerQuery = customerQuery.or(`full_name.ilike.%${search}%,phone_number.ilike.%${search}%,email.ilike.%${search}%`);
      }

      const { data: customers, error: customersError } = await customerQuery;
      if (customersError) throw customersError;
      if (!customers || customers.length === 0) return [];

      const customerIds = customers.map(c => c.id);

      // Fetch vehicles count per customer
      const { data: vehicleCounts } = await supabase
        .from('vehicles')
        .select('customer_id')
        .eq('tenant_id', profile.tenant_id)
        .in('customer_id', customerIds);

      // Fetch work orders with totals per customer
      const { data: workOrders } = await supabase
        .from('work_orders')
        .select('customer_id, total_amount, created_at')
        .eq('tenant_id', profile.tenant_id)
        .in('customer_id', customerIds)
        .order('created_at', { ascending: false });

      // Aggregate stats
      const vehicleCountMap: Record<string, number> = {};
      vehicleCounts?.forEach(v => {
        vehicleCountMap[v.customer_id] = (vehicleCountMap[v.customer_id] || 0) + 1;
      });

      const osStatsMap: Record<string, { count: number; total: number; lastVisit: string | null }> = {};
      workOrders?.forEach(wo => {
        if (!osStatsMap[wo.customer_id]) {
          osStatsMap[wo.customer_id] = { count: 0, total: 0, lastVisit: null };
        }
        osStatsMap[wo.customer_id].count += 1;
        osStatsMap[wo.customer_id].total += wo.total_amount || 0;
        if (!osStatsMap[wo.customer_id].lastVisit) {
          osStatsMap[wo.customer_id].lastVisit = wo.created_at;
        }
      });

      return customers.map(customer => ({
        ...customer,
        vehicle_count: vehicleCountMap[customer.id] || 0,
        os_count: osStatsMap[customer.id]?.count || 0,
        last_visit: osStatsMap[customer.id]?.lastVisit || null,
        total_spent: osStatsMap[customer.id]?.total || 0,
      }));
    },
    enabled: !!profile?.tenant_id,
  });
}

export function useCustomerHistory(customerId: string | undefined) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['customer-history', customerId],
    queryFn: async (): Promise<CustomerHistoryData> => {
      if (!customerId || !profile?.tenant_id) {
        return { customer: null, vehicles: [], workOrders: [], payments: [], timeline: [] };
      }

      // Fetch customer
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .eq('tenant_id', profile.tenant_id)
        .single();

      if (customerError) throw customerError;

      // Fetch vehicles
      const { data: vehicles } = await supabase
        .from('vehicles')
        .select('id, plate, make, model, year, color, created_at')
        .eq('customer_id', customerId)
        .eq('tenant_id', profile.tenant_id)
        .order('created_at', { ascending: false });

      // Fetch work orders with vehicle info
      const { data: workOrders } = await supabase
        .from('work_orders')
        .select(`
          id,
          created_at,
          workflow_step,
          initial_complaint,
          total_amount,
          current_mechanic_id,
          vehicle:vehicles(plate, make, model)
        `)
        .eq('customer_id', customerId)
        .eq('tenant_id', profile.tenant_id)
        .order('created_at', { ascending: false });

      // Fetch mechanic names
      const mechanicIds = [...new Set(workOrders?.map(wo => wo.current_mechanic_id).filter(Boolean) || [])];
      const { data: mechanics } = mechanicIds.length > 0
        ? await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', mechanicIds)
        : { data: [] };

      const mechanicMap: Record<string, string> = {};
      mechanics?.forEach(m => {
        mechanicMap[m.id] = m.full_name;
      });

      // Fetch payments for customer's work orders
      const workOrderIds = workOrders?.map(wo => wo.id) || [];
      const { data: payments } = workOrderIds.length > 0
        ? await supabase
            .from('payments')
            .select('id, amount, payment_method, paid_at, work_order_id')
            .in('work_order_id', workOrderIds)
            .order('paid_at', { ascending: false })
        : { data: [] };

      // Fetch appointments
      const { data: appointments } = await supabase
        .from('appointments')
        .select('id, scheduled_at, reason, status')
        .eq('customer_id', customerId)
        .eq('tenant_id', profile.tenant_id)
        .order('scheduled_at', { ascending: false });

      // Build timeline
      const timeline: CustomerHistoryData['timeline'] = [];

      workOrders?.forEach(wo => {
        timeline.push({
          id: `wo-${wo.id}`,
          type: 'work_order',
          date: wo.created_at!,
          description: `Ordem de Serviço criada - ${wo.vehicle?.plate || 'Veículo'}`,
          metadata: { workflow_step: wo.workflow_step, total_amount: wo.total_amount },
        });
      });

      payments?.forEach(p => {
        timeline.push({
          id: `pay-${p.id}`,
          type: 'payment',
          date: p.paid_at || '',
          description: `Pagamento recebido - ${formatPaymentMethod(p.payment_method)}`,
          metadata: { amount: p.amount, method: p.payment_method },
        });
      });

      appointments?.forEach(a => {
        timeline.push({
          id: `apt-${a.id}`,
          type: 'appointment',
          date: a.scheduled_at,
          description: `Agendamento - ${a.reason}`,
          metadata: { status: a.status },
        });
      });

      // Sort timeline by date descending
      timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Calculate customer stats
      const customerWithStats: CustomerWithStats = {
        ...customer,
        vehicle_count: vehicles?.length || 0,
        os_count: workOrders?.length || 0,
        last_visit: workOrders?.[0]?.created_at || null,
        total_spent: workOrders?.reduce((sum, wo) => sum + (wo.total_amount || 0), 0) || 0,
      };

      return {
        customer: customerWithStats,
        vehicles: vehicles || [],
        workOrders: (workOrders || []).map(wo => ({
          id: wo.id,
          created_at: wo.created_at,
          workflow_step: wo.workflow_step,
          initial_complaint: wo.initial_complaint,
          total_amount: wo.total_amount,
          vehicle: wo.vehicle as { plate: string; make: string; model: string },
          current_mechanic: wo.current_mechanic_id 
            ? { full_name: mechanicMap[wo.current_mechanic_id] || 'Desconhecido' }
            : null,
        })),
        payments: payments || [],
        timeline,
      };
    },
    enabled: !!customerId && !!profile?.tenant_id,
  });
}

function formatPaymentMethod(method: string): string {
  const methods: Record<string, string> = {
    PIX: 'PIX',
    CARTAO: 'Cartão',
    DINHEIRO: 'Dinheiro',
    MARCAR: 'A Prazo',
  };
  return methods[method] || method;
}
