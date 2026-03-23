import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { id, token, action } = await req.json();

    if (!id || !token) {
      return new Response(JSON.stringify({ error: "Missing id or token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate token
    const expectedToken = id.slice(0, 8).toUpperCase();
    if (token.toUpperCase() !== expectedToken) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle approval/rejection action
    if (action === "approve" || action === "reject") {
      const { data: wo } = await supabase
        .from("work_orders")
        .select("workflow_step")
        .eq("id", id)
        .single();

      if (!wo || wo.workflow_step !== "AGUARDANDO_APROVACAO") {
        return new Response(JSON.stringify({ error: "Order not awaiting approval" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const newStep = action === "approve" ? "APROVADO" : "CANCELADO";
      const { error } = await supabase
        .from("work_orders")
        .update({ workflow_step: newStep })
        .eq("id", id);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, step: newStep }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch work order data
    const { data, error } = await supabase
      .from("work_orders")
      .select(`
        id,
        initial_complaint,
        workflow_step,
        created_at,
        total_amount,
        customer:customers(full_name, phone_number),
        vehicle:vehicles(plate, make, model, year, color)
      `)
      .eq("id", id)
      .single();

    if (error || !data) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch items separately to join with pricing
    const { data: items } = await supabase
      .from("work_order_items")
      .select("id, description, item_type, quantity")
      .eq("work_order_id", id);

    // Fetch pricing for all items
    const itemIds = (items || []).map((i: any) => i.id);
    let pricingMap: Record<string, any> = {};
    
    if (itemIds.length > 0) {
      const { data: pricing } = await supabase
        .from("work_order_pricing")
        .select("work_order_item_id, unit_price, total_price")
        .in("work_order_item_id", itemIds);
      
      (pricing || []).forEach((p: any) => {
        pricingMap[p.work_order_item_id] = {
          unit_price: p.unit_price,
          total_price: p.total_price,
        };
      });
    }

    // Fetch diagnostics
    const { data: diagnostics } = await supabase
      .from("work_order_diagnostics")
      .select("technical_report, created_at, mechanic_id")
      .eq("work_order_id", id)
      .order("created_at", { ascending: false });

    // Fetch mechanic names for diagnostics
    let diagnosticsWithNames = diagnostics || [];
    if (diagnostics && diagnostics.length > 0) {
      const mechanicIds = [...new Set(diagnostics.map((d: any) => d.mechanic_id))];
      const { data: mechanics } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", mechanicIds);
      const mechanicMap: Record<string, string> = {};
      (mechanics || []).forEach((m: any) => { mechanicMap[m.id] = m.full_name; });
      diagnosticsWithNames = diagnostics.map((d: any) => ({
        technical_report: d.technical_report,
        created_at: d.created_at,
        mechanic_name: mechanicMap[d.mechanic_id] || null,
      }));
    }

    // Combine items with pricing
    const itemsWithPricing = (items || []).map((item: any) => ({
      ...item,
      pricing: pricingMap[item.id] ? [pricingMap[item.id]] : [],
    }));

    return new Response(JSON.stringify({ ...data, items: itemsWithPricing, diagnostics: diagnosticsWithNames }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
