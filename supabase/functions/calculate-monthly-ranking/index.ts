import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface MechanicScore {
  profile_id: string;
  tenant_id: string;
  completed_os_count: number;
  generated_labor_value: number;
  return_penalty_points: number;
  punctuality_penalty_points: number;
  total_work_time_minutes: number;
  avg_time_per_os_minutes: number;
  score: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for optional month parameter
    let targetMonth: Date;
    try {
      const body = await req.json();
      targetMonth = body.month ? new Date(body.month) : new Date();
    } catch {
      targetMonth = new Date();
    }

    // Get first and last day of the target month
    const monthStart = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
    const monthEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0, 23, 59, 59);
    const monthKey = `${targetMonth.getFullYear()}-${String(targetMonth.getMonth() + 1).padStart(2, "0")}-01`;

    console.log(`Calculating ranking for month: ${monthKey}`);
    console.log(`Period: ${monthStart.toISOString()} to ${monthEnd.toISOString()}`);

    // Get all mechanics (users with MECHANIC role)
    const { data: mechanics, error: mechanicsError } = await supabase
      .from("user_roles")
      .select("user_id, tenant_id")
      .eq("role", "MECHANIC");

    if (mechanicsError) {
      console.error("Error fetching mechanics:", mechanicsError);
      throw mechanicsError;
    }

    // Get profiles for these mechanics
    const mechanicIds = mechanics?.map(m => m.user_id) || [];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", mechanicIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    console.log(`Found ${mechanics?.length || 0} mechanics`);

    const scores: MechanicScore[] = [];

    for (const mechanic of mechanics || []) {
      const profileId = mechanic.user_id;
      const tenantId = mechanic.tenant_id;

      const profileData = profileMap.get(profileId);
      console.log(`Processing mechanic: ${profileData?.full_name || profileId} (${profileId})`);

      // 1. Count completed work orders for this mechanic in the month
      const { data: completedOrders, error: ordersError } = await supabase
        .from("work_orders")
        .select("id")
        .eq("current_mechanic_id", profileId)
        .eq("workflow_step", "FINALIZADO")
        .gte("updated_at", monthStart.toISOString())
        .lte("updated_at", monthEnd.toISOString());

      if (ordersError) {
        console.error(`Error fetching orders for ${profileId}:`, ordersError);
        continue;
      }

      const completedOsCount = completedOrders?.length || 0;
      const completedOrderIds = completedOrders?.map((o) => o.id) || [];

      // 2. Calculate labor value (sum of SERVICE type items)
      let generatedLaborValue = 0;
      if (completedOrderIds.length > 0) {
        const { data: laborItems, error: laborError } = await supabase
          .from("work_order_items")
          .select("id, work_order_pricing(total_price)")
          .eq("item_type", "SERVICE")
          .in("work_order_id", completedOrderIds);

        if (!laborError && laborItems) {
          generatedLaborValue = laborItems.reduce((sum, item) => {
            const pricing = item.work_order_pricing as any;
            return sum + (pricing?.total_price || 0);
          }, 0);
        }
      }

      // 3. Get return penalties for this month
      const { data: returnPenalties, error: returnError } = await supabase
        .from("ranking_penalties")
        .select("penalty_points")
        .eq("profile_id", profileId)
        .ilike("reason", "%retorno%")
        .gte("created_at", monthStart.toISOString())
        .lte("created_at", monthEnd.toISOString());

      const returnPenaltyPoints = returnPenalties?.reduce(
        (sum, p) => sum + (p.penalty_points || 0),
        0
      ) || 0;

      // 4. Calculate punctuality penalties from timeclock events
      let punctualityPenaltyPoints = 0;

      // Get mechanic's default times from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("default_start_time, default_lunch_start, default_lunch_end, default_end_time")
        .eq("id", profileId)
        .single();

      if (profile) {
        // Get all ENTRADA events for the month
        const { data: entryEvents } = await supabase
          .from("timeclock_events")
          .select("event_time")
          .eq("profile_id", profileId)
          .eq("event_type", "ENTRADA")
          .gte("event_time", monthStart.toISOString())
          .lte("event_time", monthEnd.toISOString());

        // Check for late arrivals (more than 10 minutes late)
        const defaultStartTime = profile.default_start_time || "08:00:00";
        const [defaultHour, defaultMin] = defaultStartTime.split(":").map(Number);

        for (const event of entryEvents || []) {
          const eventDate = new Date(event.event_time);
          const eventHour = eventDate.getHours();
          const eventMin = eventDate.getMinutes();

          const lateMinutes =
            (eventHour - defaultHour) * 60 + (eventMin - defaultMin);

          if (lateMinutes > 10) {
            // 1 point penalty for every 10 minutes late
            punctualityPenaltyPoints += Math.ceil(lateMinutes / 10);
          }
        }
      }

      // Also add any explicit punctuality penalties
      const { data: explicitPunctualityPenalties } = await supabase
        .from("ranking_penalties")
        .select("penalty_points")
        .eq("profile_id", profileId)
        .ilike("reason", "%pontualidade%")
        .gte("created_at", monthStart.toISOString())
        .lte("created_at", monthEnd.toISOString());

      punctualityPenaltyPoints += explicitPunctualityPenalties?.reduce(
        (sum, p) => sum + (p.penalty_points || 0),
        0
      ) || 0;

      // 5. Calculate total work time from time_entries
      let totalWorkTimeMinutes = 0;
      if (completedOrderIds.length > 0) {
        const { data: timeEntries } = await supabase
          .from("time_entries")
          .select("start_time, end_time")
          .eq("profile_id", profileId)
          .in("work_order_id", completedOrderIds)
          .not("end_time", "is", null);

        for (const entry of timeEntries || []) {
          if (entry.start_time && entry.end_time) {
            const start = new Date(entry.start_time);
            const end = new Date(entry.end_time);
            totalWorkTimeMinutes += (end.getTime() - start.getTime()) / 60000;
          }
        }
      }

      // 6. Calculate average time per OS
      const avgTimePerOsMinutes =
        completedOsCount > 0 ? totalWorkTimeMinutes / completedOsCount : 0;

      // 7. Calculate final score using the formula:
      // (OS Completadas * 10) + (Valor Mão de Obra / 100) - (Penalidade Retorno * 5) - (Penalidade Pontualidade * 2)
      const score = Math.round(
        completedOsCount * 10 +
        generatedLaborValue / 100 -
        returnPenaltyPoints * 5 -
        punctualityPenaltyPoints * 2
      );

      console.log(`Mechanic ${profileId} score breakdown:`, {
        completedOsCount,
        generatedLaborValue,
        returnPenaltyPoints,
        punctualityPenaltyPoints,
        totalWorkTimeMinutes: Math.round(totalWorkTimeMinutes),
        avgTimePerOsMinutes: Math.round(avgTimePerOsMinutes),
        score,
      });

      scores.push({
        profile_id: profileId,
        tenant_id: tenantId,
        completed_os_count: completedOsCount,
        generated_labor_value: generatedLaborValue,
        return_penalty_points: returnPenaltyPoints,
        punctuality_penalty_points: punctualityPenaltyPoints,
        total_work_time_minutes: Math.round(totalWorkTimeMinutes),
        avg_time_per_os_minutes: Math.round(avgTimePerOsMinutes),
        score: Math.max(0, score), // Don't allow negative scores
      });
    }

    // Upsert all scores to ranking_scores table
    for (const scoreData of scores) {
      const { error: upsertError } = await supabase
        .from("ranking_scores")
        .upsert(
          {
            profile_id: scoreData.profile_id,
            tenant_id: scoreData.tenant_id,
            month: monthKey,
            score: scoreData.score,
            completed_os_count: scoreData.completed_os_count,
            generated_labor_value: scoreData.generated_labor_value,
            return_penalty_points: scoreData.return_penalty_points,
            punctuality_penalty_points: scoreData.punctuality_penalty_points,
            total_work_time_minutes: scoreData.total_work_time_minutes,
            avg_time_per_os_minutes: scoreData.avg_time_per_os_minutes,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "profile_id,month",
          }
        );

      if (upsertError) {
        console.error(`Error upserting score for ${scoreData.profile_id}:`, upsertError);
      }
    }

    console.log(`Successfully calculated ranking for ${scores.length} mechanics`);

    return new Response(
      JSON.stringify({
        success: true,
        month: monthKey,
        mechanics_processed: scores.length,
        scores: scores.map((s) => ({
          profile_id: s.profile_id,
          score: s.score,
          completed_os: s.completed_os_count,
          labor_value: s.generated_labor_value,
        })),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error calculating ranking:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
