import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Monthly Payroll Cron Job
 * 
 * This function runs at the start of each month to:
 * 1. Generate payroll for the previous month
 * 2. Generate payslip PDFs for all employees
 * 3. Send email notifications to staff
 * 
 * Designed to be triggered via pg_cron on the 1st of each month
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting monthly payroll cron job...");

    // Call the main generate-monthly-payroll function
    // It defaults to processing the previous month
    const { data, error } = await supabase.functions.invoke("generate-monthly-payroll", {
      body: {}, // No month_year = process previous month
    });

    if (error) {
      console.error("Error invoking generate-monthly-payroll:", error);
      throw error;
    }

    console.log("Monthly payroll generation completed:", data);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Monthly payroll cron completed",
        result: data,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in monthly payroll cron:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
