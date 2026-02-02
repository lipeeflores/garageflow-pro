import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

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

export function useAppointments(date?: Date) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['appointments', date?.toISOString()],
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
  return useAppointments(new Date());
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
