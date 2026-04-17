import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Returns a short-lived signed URL for a payslip file.
 * Authorization rules:
 *  - Admin / Accounts: can fetch any payslip
 *  - Staff: can only fetch payslips that belong to their own employee record
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { payroll_id } = await req.json();
    if (!payroll_id || typeof payroll_id !== "string") {
      return new Response(
        JSON.stringify({ error: "payroll_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Look up the payroll record (file path + owning employee)
    const { data: payroll, error: payrollError } = await adminClient
      .from("monthly_payroll")
      .select("payroll_id, employee_id, payslip_url")
      .eq("payroll_id", payroll_id)
      .single();

    if (payrollError || !payroll) {
      return new Response(
        JSON.stringify({ error: "Payroll record not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!payroll.payslip_url) {
      return new Response(
        JSON.stringify({ error: "Payslip not yet generated" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authorization: admin/accounts OR the owning employee
    const { data: isAdmin } = await userClient.rpc("is_admin_or_accounts", {
      _user_id: user.id,
    });

    let allowed = !!isAdmin;
    if (!allowed) {
      const { data: employeeId } = await userClient.rpc("get_employee_id", {
        _user_id: user.id,
      });
      allowed = employeeId && employeeId === payroll.employee_id;
    }

    if (!allowed) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // payslip_url may be a legacy public URL or a storage path. Normalise to a path.
    let filePath = payroll.payslip_url as string;
    const marker = "/payslips/";
    const idx = filePath.indexOf(marker);
    if (idx >= 0) {
      filePath = filePath.substring(idx + marker.length);
    }

    const { data: signed, error: signError } = await adminClient.storage
      .from("payslips")
      .createSignedUrl(filePath, 60 * 10); // 10 minutes

    if (signError || !signed) {
      console.error("Signed URL error:", signError);
      return new Response(
        JSON.stringify({ error: "Failed to create signed URL" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ url: signed.signedUrl }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("get-payslip-url error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch payslip URL" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
