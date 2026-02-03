import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SearchResult {
  id: string;
  type: "customer" | "vehicle" | "workorder";
  title: string;
  subtitle: string;
  url: string;
}

export function useGlobalSearch(query: string) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  // Debounce the query
  useMemo(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: customers, isLoading: loadingCustomers } = useQuery({
    queryKey: ["search-customers", debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) return [];
      
      const { data, error } = await supabase
        .from("customers")
        .select("id, full_name, phone_number, email")
        .or(`full_name.ilike.%${debouncedQuery}%,phone_number.ilike.%${debouncedQuery}%,email.ilike.%${debouncedQuery}%`)
        .limit(5);

      if (error) throw error;
      return data || [];
    },
    enabled: debouncedQuery.length >= 2,
  });

  const { data: vehicles, isLoading: loadingVehicles } = useQuery({
    queryKey: ["search-vehicles", debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) return [];
      
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, plate, make, model, customer_id, customers(full_name)")
        .or(`plate.ilike.%${debouncedQuery}%,make.ilike.%${debouncedQuery}%,model.ilike.%${debouncedQuery}%`)
        .limit(5);

      if (error) throw error;
      return data || [];
    },
    enabled: debouncedQuery.length >= 2,
  });

  const { data: workOrders, isLoading: loadingWorkOrders } = useQuery({
    queryKey: ["search-workorders", debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) return [];
      
      const { data, error } = await supabase
        .from("work_orders")
        .select(`
          id, 
          workflow_step, 
          created_at,
          vehicles(plate, make, model),
          customers(full_name)
        `)
        .or(`id.ilike.%${debouncedQuery}%`)
        .limit(5);

      if (error) {
        // If ID search fails, try searching by vehicle plate or customer name
        const { data: dataByRelation, error: relationError } = await supabase
          .from("work_orders")
          .select(`
            id, 
            workflow_step, 
            created_at,
            vehicles!inner(plate, make, model),
            customers!inner(full_name)
          `)
          .or(`vehicles.plate.ilike.%${debouncedQuery}%,customers.full_name.ilike.%${debouncedQuery}%`)
          .limit(5);
        
        if (relationError) return [];
        return dataByRelation || [];
      }
      return data || [];
    },
    enabled: debouncedQuery.length >= 2,
  });

  const results: SearchResult[] = useMemo(() => {
    const items: SearchResult[] = [];

    customers?.forEach((customer) => {
      items.push({
        id: customer.id,
        type: "customer",
        title: customer.full_name,
        subtitle: customer.phone_number || customer.email || "",
        url: `/clientes`,
      });
    });

    vehicles?.forEach((vehicle) => {
      const customerName = (vehicle.customers as any)?.full_name || "";
      items.push({
        id: vehicle.id,
        type: "vehicle",
        title: `${vehicle.plate} - ${vehicle.make} ${vehicle.model}`,
        subtitle: customerName,
        url: `/veiculos`,
      });
    });

    workOrders?.forEach((wo) => {
      const vehicleInfo = (wo.vehicles as any);
      const customerName = (wo.customers as any)?.full_name || "";
      items.push({
        id: wo.id,
        type: "workorder",
        title: vehicleInfo ? `${vehicleInfo.plate} - ${vehicleInfo.make} ${vehicleInfo.model}` : `OS ${wo.id.slice(0, 8)}`,
        subtitle: `${customerName} • ${wo.workflow_step.replace(/_/g, " ")}`,
        url: `/ordens/${wo.id}`,
      });
    });

    return items;
  }, [customers, vehicles, workOrders]);

  const isLoading = loadingCustomers || loadingVehicles || loadingWorkOrders;

  return { results, isLoading, query: debouncedQuery };
}
