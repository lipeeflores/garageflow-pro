import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useMemo } from "react";

export type AppointmentStatus = 'AGENDADO' | 'CHEGOU' | 'NAO_COMPARECEU' | 'REMARCADO' | 'CANCELADO';

export interface Appointment {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  vehicle_id: string | null;
  scheduled_at: string;
  reason: string;
  status: AppointmentStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  customer?: {
    full_name: string;
    phone_number: string;
  };
  vehicle?: {
    plate: string;
    make: string;
    model: string;
  };
}

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function useAppointments(date?: Date) {
  const { profile } = useAuth();
  const dateKey = date ? formatDateKey(date) : undefined;

  return useQuery({
    queryKey: ['appointments', dateKey],
    queryFn: async () => {
      if (!profile?.tenant_id) return [];

      let query = supabase
        .from('appointments')
        .select(`
          *,
          customer:customers(full_name, phone_number),
          vehicle:vehicles(plate, make, model)
        `)
        .eq('tenant_id', profile.tenant_id)
        .order('scheduled_at');

      if (date) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        query = query
          .gte('scheduled_at', startOfDay.toISOString())
          .lte('scheduled_at', endOfDay.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Appointment[];
    },
    enabled: !!profile?.tenant_id,
  });
}

export function useTodayAppointments() {
  const today = useMemo(() => new Date(), []);
  return useAppointments(today);
}

/**
 * Busca agendamentos de hoje + NAO_COMPARECEU de dias anteriores (para destaque)
 */
export function useTodayAndMissedAppointments() {
  const { profile } = useAuth();
  const todayKey = useMemo(() => formatDateKey(new Date()), []);

  return useQuery<{ today: Appointment[]; missed: Appointment[] }>({
    queryKey: ['appointments', 'today-and-missed', todayKey],
    queryFn: async (): Promise<{ today: Appointment[]; missed: Appointment[] }> => {
      if (!profile?.tenant_id) return { today: [], missed: [] };

      const today = new Date();
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);

      // 1. Agendamentos de hoje (todos os status)
      const { data: todayAppts, error: err1 } = await supabase
        .from('appointments')
        .select(`
          *,
          customer:customers(full_name, phone_number),
          vehicle:vehicles(plate, make, model)
        `)
        .eq('tenant_id', profile.tenant_id)
        .gte('scheduled_at', startOfDay.toISOString())
        .lte('scheduled_at', endOfDay.toISOString())
        .order('scheduled_at');

      if (err1) throw err1;

      // 2. NAO_COMPARECEU de dias anteriores (últimos 7 dias)
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: missedAppts, error: err2 } = await supabase
        .from('appointments')
        .select(`
          *,
          customer:customers(full_name, phone_number),
          vehicle:vehicles(plate, make, model)
        `)
        .eq('tenant_id', profile.tenant_id)
        .eq('status', 'NAO_COMPARECEU')
        .lt('scheduled_at', startOfDay.toISOString())
        .gte('scheduled_at', sevenDaysAgo.toISOString())
        .order('scheduled_at', { ascending: false });

      if (err2) throw err2;

      return {
        today: (todayAppts || []) as Appointment[],
        missed: (missedAppts || []) as Appointment[],
      };
    },
    enabled: !!profile?.tenant_id,
  });
}

export function useTodayScheduledAppointments() {
  const { profile } = useAuth();
  const todayKey = useMemo(() => formatDateKey(new Date()), []);

  return useQuery({
    queryKey: ['appointments', 'today', 'scheduled', todayKey],
    queryFn: async () => {
      if (!profile?.tenant_id) return [];

      const today = new Date();
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          customer:customers(full_name, phone_number),
          vehicle:vehicles(plate, make, model)
        `)
        .eq('tenant_id', profile.tenant_id)
        .eq('status', 'AGENDADO')
        .gte('scheduled_at', startOfDay.toISOString())
        .lte('scheduled_at', endOfDay.toISOString())
        .order('scheduled_at');

      if (error) throw error;
      return data as Appointment[];
    },
    enabled: !!profile?.tenant_id,
  });
}

export function useCreateAppointment() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (appointment: Omit<Appointment, 'id' | 'tenant_id' | 'created_at' | 'updated_at' | 'customer' | 'vehicle'>) => {
      if (!profile?.tenant_id) throw new Error("Tenant not found");

      const { data, error } = await supabase
        .from('appointments')
        .insert({
          ...appointment,
          tenant_id: profile.tenant_id,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast({
        title: "Sucesso",
        description: "Agendamento criado com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao criar agendamento",
        variant: "destructive",
      });
    },
  });
}

export function useUpdateAppointment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Appointment> }) => {
      const { data, error } = await supabase
        .from('appointments')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast({
        title: "Sucesso",
        description: "Agendamento atualizado",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar agendamento",
        variant: "destructive",
      });
    },
  });
}

export function useConvertAppointmentToWorkOrder() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      appointmentId, 
      customerId, 
      vehicleId, 
      reason 
    }: { 
      appointmentId: string; 
      customerId: string; 
      vehicleId: string;
      reason: string;
    }) => {
      if (!profile?.tenant_id) throw new Error("Tenant not found");

      const { error: appointmentError } = await supabase
        .from('appointments')
        .update({ status: 'CHEGOU' })
        .eq('id', appointmentId);

      if (appointmentError) throw appointmentError;

      const { data: workOrder, error: workOrderError } = await supabase
        .from('work_orders')
        .insert({
          tenant_id: profile.tenant_id,
          customer_id: customerId,
          vehicle_id: vehicleId,
          appointment_id: appointmentId,
          initial_complaint: reason,
          workflow_step: 'AGUARDANDO_CHECKIN',
          created_by: user?.id,
        })
        .select()
        .single();

      if (workOrderError) throw workOrderError;
      return workOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['work_orders'] });
      toast({
        title: "Cliente chegou! 🚗",
        description: "Ordem de serviço criada automaticamente.",
      });
    },
    onError: (error) => {
      console.error('Error converting appointment:', error);
      toast({
        title: "Erro",
        description: "Erro ao registrar chegada do cliente",
        variant: "destructive",
      });
    },
  });
}
