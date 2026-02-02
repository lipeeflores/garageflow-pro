import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface Customer {
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
}

export function useCustomers(search?: string) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['customers', search],
    queryFn: async () => {
      if (!profile?.tenant_id) return [];

      let query = supabase
        .from('customers')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .order('full_name');

      if (search) {
        query = query.or(`full_name.ilike.%${search}%,phone_number.ilike.%${search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Customer[];
    },
    enabled: !!profile?.tenant_id,
  });
}

export function useCustomer(id: string | undefined) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      if (!id || !profile?.tenant_id) return null;

      const { data, error } = await supabase
        .from('customers')
        .select(`
          *,
          vehicles(*)
        `)
        .eq('id', id)
        .eq('tenant_id', profile.tenant_id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id && !!profile?.tenant_id,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (customer: Omit<Customer, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>) => {
      if (!profile?.tenant_id) throw new Error("Tenant not found");

      const { data, error } = await supabase
        .from('customers')
        .insert({
          ...customer,
          tenant_id: profile.tenant_id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({
        title: "Sucesso",
        description: "Cliente cadastrado com sucesso",
      });
    },
    onError: (error: any) => {
      let message = "Erro ao cadastrar cliente";
      if (error.message?.includes("duplicate")) {
        message = "Já existe um cliente com este telefone";
      }
      toast({
        title: "Erro",
        description: message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Customer> }) => {
      const { data, error } = await supabase
        .from('customers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer'] });
      toast({
        title: "Sucesso",
        description: "Cliente atualizado com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar cliente",
        variant: "destructive",
      });
    },
  });
}
