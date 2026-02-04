import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface VehicleWithCustomer {
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
  customer: {
    id: string;
    full_name: string;
    phone_number: string;
    email: string | null;
  } | null;
}

export function useVehicleByPlate(plate: string) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['vehicle-by-plate', plate],
    queryFn: async () => {
      if (!profile?.tenant_id || !plate || plate.length < 3) return null;

      const { data, error } = await supabase
        .from('vehicles')
        .select(`
          *,
          customer:customers(id, full_name, phone_number, email)
        `)
        .eq('tenant_id', profile.tenant_id)
        .ilike('plate', `%${plate}%`)
        .limit(5);

      if (error) throw error;
      return data as VehicleWithCustomer[];
    },
    enabled: !!profile?.tenant_id && !!plate && plate.length >= 3,
  });
}

export function useSearchCustomers(search: string) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['customers-search', search],
    queryFn: async () => {
      if (!profile?.tenant_id || !search || search.length < 2) return [];

      const { data, error } = await supabase
        .from('customers')
        .select('id, full_name, phone_number, email')
        .eq('tenant_id', profile.tenant_id)
        .or(`full_name.ilike.%${search}%,phone_number.ilike.%${search}%`)
        .limit(5);

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.tenant_id && !!search && search.length >= 2,
  });
}
