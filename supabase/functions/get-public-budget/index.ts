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
      // First check current status
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
        customer:customers(full_name, phone_number),
        vehicle:vehicles(plate, make, model, year, color),
        items:work_order_items(
          id, 
          description, 
          item_type, 
          quantity,
          pricing:work_order_pricing(unit_price, total_price)
        )
      `)
      .eq("id", id)
      .single();

    if (error || !data) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
