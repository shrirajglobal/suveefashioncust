import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current time in IST
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
    const istNow = new Date(now.getTime() + istOffset);
    const currentHour = istNow.getUTCHours();

    // Only run during work hours (9 AM to 7 PM IST)
    if (currentHour < 9 || currentHour >= 19) {
      return new Response(
        JSON.stringify({ message: "Outside work hours, skipping" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find salespeople who haven't logged any interaction in the last 2 hours
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();

    // Get all sales_team users
    const { data: salesUsers, error: usersError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "sales_team");

    if (usersError) throw usersError;

    if (!salesUsers || salesUsers.length === 0) {
      return new Response(
        JSON.stringify({ message: "No salespeople found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const salesUserIds = salesUsers.map((u) => u.user_id);

    // Get recent interactions for each salesperson
    const { data: recentInteractions, error: interactionsError } = await supabase
      .from("interactions")
      .select("salesperson_id, interaction_datetime")
      .in("salesperson_id", salesUserIds)
      .gte("interaction_datetime", twoHoursAgo)
      .order("interaction_datetime", { ascending: false });

    if (interactionsError) throw interactionsError;

    // Find salespeople with recent activity
    const activeUserIds = new Set(
      (recentInteractions || []).map((i) => i.salesperson_id)
    );

    // Find inactive salespeople
    const inactiveUserIds = salesUserIds.filter((id) => !activeUserIds.has(id));

    if (inactiveUserIds.length === 0) {
      return new Response(
        JSON.stringify({ message: "All salespeople are active" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get push subscriptions for inactive users
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("user_id")
      .in("user_id", inactiveUserIds);

    if (subError) throw subError;

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: "No push subscriptions for inactive users",
          inactive_count: inactiveUserIds.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userIdsToNotify = [...new Set(subscriptions.map((s) => s.user_id))];

    // Call the send-push-notification function
    const { data: pushResult, error: pushError } = await supabase.functions.invoke(
      "send-push-notification",
      {
        body: {
          user_ids: userIdsToNotify,
          title: "🔔 Time to Connect!",
          body: "You haven't logged any customer interaction in 2 hours. Time to make some calls and generate sales!",
          url: "/",
        },
      }
    );

    if (pushError) {
      console.error("Error sending push notifications:", pushError);
    }

    return new Response(
      JSON.stringify({
        message: "Inactivity check completed",
        total_salespeople: salesUserIds.length,
        inactive_count: inactiveUserIds.length,
        notifications_sent: userIdsToNotify.length,
        push_result: pushResult,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
