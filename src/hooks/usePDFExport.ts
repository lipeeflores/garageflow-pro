import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { generateWorkOrderPDF } from "@/lib/pdf/workOrderReport";
import { generateBudgetPDF } from "@/lib/pdf/budgetReport";
import { generateFinancialPDF } from "@/lib/pdf/financialReport";
import { generateCustomerHistoryPDF } from "@/lib/pdf/customerHistoryReport";

export function usePDFExport() {
  const { profile } = useAuth();
  const { toast } = useToast();

  const exportWorkOrderPDF = async (workOrderId: string) => {
    try {
      if (!profile?.tenant_id) {
        throw new Error("Tenant não encontrado");
      }

      // Fetch work order with all related data
      const { data: workOrder, error: woError } = await supabase
        .from('work_orders')
        .select(`
          *,
          customer:customers(full_name, phone_number, email),
          vehicle:vehicles(plate, make, model, year, color)
        `)
        .eq('id', workOrderId)
        .single();

      if (woError) throw woError;

      // Fetch mechanic info
      let mechanic = null;
      if (workOrder.current_mechanic_id) {
        const { data: mechanicData } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', workOrder.current_mechanic_id)
          .single();
        mechanic = mechanicData;
      }

      // Fetch items with pricing
      const { data: items } = await supabase
        .from('work_order_items')
        .select(`
          description,
          item_type,
          quantity,
          pricing:work_order_pricing(unit_price, total_price)
        `)
        .eq('work_order_id', workOrderId);

      // Fetch diagnostics
      const { data: diagnostics } = await supabase
        .from('work_order_diagnostics')
        .select('technical_report, created_at, mechanic_id')
        .eq('work_order_id', workOrderId)
        .order('created_at', { ascending: false });

      // Get mechanic names for diagnostics
      const mechanicIds = [...new Set(diagnostics?.map(d => d.mechanic_id).filter(Boolean) || [])];
      const { data: mechanicsData } = mechanicIds.length > 0
        ? await supabase.from('profiles').select('id, full_name').in('id', mechanicIds)
        : { data: [] };
      
      const mechanicMap: Record<string, string> = {};
      mechanicsData?.forEach(m => { mechanicMap[m.id] = m.full_name; });

      // Fetch checkin
      const { data: checkin } = await supabase
        .from('work_order_checkins')
        .select('km_current, fuel_level, customer_items, observations')
        .eq('work_order_id', workOrderId)
        .maybeSingle();

      // Fetch events
      const { data: events } = await supabase
        .from('work_order_events')
        .select('event_type, description, created_at')
        .eq('work_order_id', workOrderId)
        .order('created_at', { ascending: false });

      await generateWorkOrderPDF({
        id: workOrder.id,
        created_at: workOrder.created_at!,
        workflow_step: workOrder.workflow_step,
        initial_complaint: workOrder.initial_complaint,
        total_amount: workOrder.total_amount,
        priority: workOrder.priority,
        box_location: workOrder.box_location,
        expected_delivery_date: workOrder.expected_delivery_date,
        customer: {
          full_name: workOrder.customer?.full_name || 'Cliente',
          phone_number: workOrder.customer?.phone_number || '-',
          email: workOrder.customer?.email,
        },
        vehicle: {
          plate: workOrder.vehicle?.plate || '-',
          make: workOrder.vehicle?.make || '-',
          model: workOrder.vehicle?.model || '-',
          year: workOrder.vehicle?.year,
          color: workOrder.vehicle?.color,
        },
        mechanic,
        items: (items || []).map(item => ({
          description: item.description,
          item_type: item.item_type,
          quantity: item.quantity,
          pricing: Array.isArray(item.pricing) && item.pricing[0] 
            ? { unit_price: item.pricing[0].unit_price, total_price: item.pricing[0].total_price }
            : undefined,
        })),
        diagnostics: (diagnostics || []).map(d => ({
          technical_report: d.technical_report,
          created_at: d.created_at!,
          mechanic_name: mechanicMap[d.mechanic_id],
        })),
        checkin: checkin || undefined,
        events: events || [],
      });

      toast({
        title: "PDF Gerado",
        description: "O relatório da OS foi baixado com sucesso.",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Erro",
        description: "Erro ao gerar o PDF. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const exportBudgetPDF = async (workOrderId: string, notes?: string) => {
    try {
      if (!profile?.tenant_id) {
        throw new Error("Tenant não encontrado");
      }

      // Fetch work order with customer and vehicle
      const { data: workOrder, error: woError } = await supabase
        .from('work_orders')
        .select(`
          id,
          created_at,
          total_amount,
          customer:customers(full_name, phone_number, email),
          vehicle:vehicles(plate, make, model, year)
        `)
        .eq('id', workOrderId)
        .single();

      if (woError) throw woError;

      // Fetch items with pricing
      const { data: items } = await supabase
        .from('work_order_items')
        .select(`
          description,
          item_type,
          quantity,
          pricing:work_order_pricing(unit_price, total_price, is_approved)
        `)
        .eq('work_order_id', workOrderId);

      generateBudgetPDF({
        id: workOrder.id,
        created_at: workOrder.created_at!,
        customer: {
          full_name: workOrder.customer?.full_name || 'Cliente',
          phone_number: workOrder.customer?.phone_number || '-',
          email: workOrder.customer?.email,
        },
        vehicle: {
          plate: workOrder.vehicle?.plate || '-',
          make: workOrder.vehicle?.make || '-',
          model: workOrder.vehicle?.model || '-',
          year: workOrder.vehicle?.year,
        },
        items: (items || []).map(item => ({
          description: item.description,
          item_type: item.item_type,
          quantity: item.quantity,
          pricing: Array.isArray(item.pricing) && item.pricing[0] 
            ? { 
                unit_price: item.pricing[0].unit_price, 
                total_price: item.pricing[0].total_price,
                is_approved: item.pricing[0].is_approved || false,
              }
            : undefined,
        })),
        total_amount: workOrder.total_amount || 0,
        validity_days: 15,
        notes,
      });

      toast({
        title: "PDF Gerado",
        description: "O orçamento foi baixado com sucesso.",
      });
    } catch (error) {
      console.error('Error generating budget PDF:', error);
      toast({
        title: "Erro",
        description: "Erro ao gerar o orçamento. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const exportFinancialPDF = async (startDate: Date, endDate: Date) => {
    try {
      if (!profile?.tenant_id) {
        throw new Error("Tenant não encontrado");
      }

      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];

      // Fetch financial entries
      const { data: entries } = await supabase
        .from('financial_entries')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .gte('entry_date', startStr)
        .lte('entry_date', endStr)
        .order('entry_date', { ascending: false });

      // Fetch payments
      const { data: payments } = await supabase
        .from('payments')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .gte('paid_at', startDate.toISOString())
        .lte('paid_at', endDate.toISOString())
        .order('paid_at', { ascending: false });

      // Calculate summary
      const totalRevenue = (entries || [])
        .filter(e => e.entry_type === 'RECEITA')
        .reduce((sum, e) => sum + e.amount, 0);
      
      const totalExpenses = (entries || [])
        .filter(e => e.entry_type === 'DESPESA')
        .reduce((sum, e) => sum + e.amount, 0);

      // Fetch completed work orders for the period
      const { data: workOrders } = await supabase
        .from('work_orders')
        .select('total_amount')
        .eq('tenant_id', profile.tenant_id)
        .eq('workflow_step', 'FINALIZADO')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      const workOrdersCompleted = workOrders?.length || 0;
      const averageTicket = workOrdersCompleted > 0 
        ? (workOrders || []).reduce((sum, wo) => sum + (wo.total_amount || 0), 0) / workOrdersCompleted
        : 0;

      // Revenue by category
      const categoryMap = new Map<string, number>();
      (entries || [])
        .filter(e => e.entry_type === 'RECEITA')
        .forEach(e => {
          const cat = e.category || 'Sem Categoria';
          categoryMap.set(cat, (categoryMap.get(cat) || 0) + e.amount);
        });
      
      const revenueByCategory = Array.from(categoryMap.entries())
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount);

      // Payment method breakdown
      const methodMap = new Map<string, { amount: number; count: number }>();
      (payments || []).forEach(p => {
        const current = methodMap.get(p.payment_method) || { amount: 0, count: 0 };
        methodMap.set(p.payment_method, { 
          amount: current.amount + p.amount, 
          count: current.count + 1 
        });
      });
      
      const paymentMethodBreakdown = Array.from(methodMap.entries())
        .map(([method, data]) => ({ method, ...data }))
        .sort((a, b) => b.amount - a.amount);

      generateFinancialPDF({
        startDate,
        endDate,
        entries: entries || [],
        payments: payments || [],
        summary: {
          totalRevenue,
          totalExpenses,
          netProfit: totalRevenue - totalExpenses,
          averageTicket,
          workOrdersCompleted,
        },
        revenueByCategory,
        paymentMethodBreakdown,
      });

      toast({
        title: "PDF Gerado",
        description: "O relatório financeiro foi baixado com sucesso.",
      });
    } catch (error) {
      console.error('Error generating financial PDF:', error);
      toast({
        title: "Erro",
        description: "Erro ao gerar o relatório financeiro. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const exportCustomerHistoryPDF = async (customerId: string) => {
    try {
      if (!profile?.tenant_id) {
        throw new Error("Tenant não encontrado");
      }

      // Fetch customer
      const { data: customer, error: custError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

      if (custError) throw custError;

      // Fetch vehicles
      const { data: vehicles } = await supabase
        .from('vehicles')
        .select('plate, make, model, year')
        .eq('customer_id', customerId);

      // Fetch work orders
      const { data: workOrders } = await supabase
        .from('work_orders')
        .select(`
          id,
          created_at,
          workflow_step,
          initial_complaint,
          total_amount,
          vehicle:vehicles(plate)
        `)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      // Fetch payments for customer's work orders
      const workOrderIds = workOrders?.map(wo => wo.id) || [];
      const { data: payments } = workOrderIds.length > 0
        ? await supabase
            .from('payments')
            .select('amount, payment_method, paid_at')
            .in('work_order_id', workOrderIds)
            .order('paid_at', { ascending: false })
        : { data: [] };

      // Calculate stats
      const totalSpent = workOrders?.reduce((sum, wo) => sum + (wo.total_amount || 0), 0) || 0;
      const totalOrders = workOrders?.length || 0;
      const averageTicket = totalOrders > 0 ? totalSpent / totalOrders : 0;
      const firstVisit = workOrders?.length 
        ? workOrders[workOrders.length - 1].created_at 
        : null;
      const lastVisit = workOrders?.length ? workOrders[0].created_at : null;

      generateCustomerHistoryPDF({
        customer: {
          id: customer.id,
          full_name: customer.full_name,
          phone_number: customer.phone_number,
          email: customer.email,
          cpf_cnpj: customer.cpf_cnpj,
          address: customer.address,
          created_at: customer.created_at!,
        },
        vehicles: vehicles || [],
        workOrders: (workOrders || []).map(wo => ({
          id: wo.id,
          created_at: wo.created_at!,
          workflow_step: wo.workflow_step,
          initial_complaint: wo.initial_complaint,
          total_amount: wo.total_amount,
          vehicle_plate: (wo.vehicle as { plate: string })?.plate || '-',
        })),
        payments: payments || [],
        stats: {
          totalOrders,
          totalSpent,
          averageTicket,
          firstVisit,
          lastVisit,
        },
      });

      toast({
        title: "PDF Gerado",
        description: "O histórico do cliente foi baixado com sucesso.",
      });
    } catch (error) {
      console.error('Error generating customer history PDF:', error);
      toast({
        title: "Erro",
        description: "Erro ao gerar o histórico. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  return {
    exportWorkOrderPDF,
    exportBudgetPDF,
    exportFinancialPDF,
    exportCustomerHistoryPDF,
  };
}
