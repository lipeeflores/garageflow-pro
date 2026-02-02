import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface Vehicle {
  id: string;
  tenant_id: string;
  customer_id: string;
  plate: string;
  make: string;
  model: string;
  year: number | null;
  color: string | null;
  chassis: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  customer?: {
    full_name: string;
    phone_number: string;
  };
}

export function useVehicles(search?: string) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['vehicles', search],
    queryFn: async () => {
      if (!profile?.tenant_id) return [];

      let query = supabase
        .from('vehicles')
        .select(`
          *,
          customer:customers(full_name, phone_number)
        `)
        .eq('tenant_id', profile.tenant_id)
        .order('plate');

      if (search) {
        query = query.or(`plate.ilike.%${search}%,make.ilike.%${search}%,model.ilike.%${search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Vehicle[];
    },
    enabled: !!profile?.tenant_id,
  });
}

export function useVehiclesByCustomer(customerId: string | undefined) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['vehicles', 'customer', customerId],
    queryFn: async () => {
      if (!customerId || !profile?.tenant_id) return [];

      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .eq('customer_id', customerId)
        .order('plate');

      if (error) throw error;
      return data as Vehicle[];
    },
    enabled: !!customerId && !!profile?.tenant_id,
  });
}

export function useCreateVehicle() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (vehicle: Omit<Vehicle, 'id' | 'tenant_id' | 'created_at' | 'updated_at' | 'customer'>) => {
      if (!profile?.tenant_id) throw new Error("Tenant not found");

      const { data, error } = await supabase
        .from('vehicles')
        .insert({
          ...vehicle,
          tenant_id: profile.tenant_id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      toast({
        title: "Sucesso",
        description: "Veículo cadastrado com sucesso",
      });
    },
    onError: (error: any) => {
      let message = "Erro ao cadastrar veículo";
      if (error.message?.includes("duplicate")) {
        message = "Já existe um veículo com esta placa";
      }
      toast({
        title: "Erro",
        description: message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateVehicle() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Vehicle> }) => {
      const { data, error } = await supabase
        .from('vehicles')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      toast({
        title: "Sucesso",
        description: "Veículo atualizado com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar veículo",
        variant: "destructive",
      });
    },
  });
}
