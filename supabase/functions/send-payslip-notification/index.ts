import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  employee_id: string;
  month_year: string;
  payroll_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.log("RESEND_API_KEY not configured, skipping email notification");
      return new Response(
        JSON.stringify({ message: "Email notifications not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(resendApiKey);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { employee_id, month_year, payroll_id }: NotificationRequest = await req.json();

    // Get employee details with user email
    const { data: employee, error: empError } = await supabase
      .from("employee_master")
      .select(`
        full_name,
        user_id,
        profiles:user_id (email)
      `)
      .eq("employee_id", employee_id)
      .single();

    if (empError || !employee) {
      throw new Error("Employee not found");
    }

    // Get email from profiles if available
    const email = (employee as any).profiles?.email;
    if (!email) {
      console.log(`No email found for employee ${employee.full_name}`);
      return new Response(
        JSON.stringify({ message: "No email configured for employee" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get payroll details
    const { data: payroll } = await supabase
      .from("monthly_payroll")
      .select("net_salary")
      .eq("payroll_id", payroll_id)
      .single();

    const netSalary = payroll?.net_salary ? `₹${Number(payroll.net_salary).toLocaleString('en-IN')}` : 'N/A';
    // Payslips are private. Direct the user to sign in and download from the app.
    const appUrl = Deno.env.get("APP_URL") ?? "https://suveefashioncust.lovable.app";
    const payslipUrl = `${appUrl}/hr`;

    // Send email notification
    const emailResponse = await resend.emails.send({
      from: "Payroll <noreply@yourdomain.com>", // Replace with your verified domain
      to: [email],
      subject: `Your Payslip for ${month_year} is Ready`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1a365d; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
            .salary-box { background: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .salary-amount { font-size: 32px; font-weight: bold; color: #1a365d; }
            .button { display: inline-block; background: #1a365d; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Payslip Ready</h1>
            </div>
            <div class="content">
              <p>Dear ${employee.full_name},</p>
              <p>Your payslip for <strong>${month_year}</strong> has been generated and is now available.</p>
              
              <div class="salary-box">
                <p style="margin: 0; color: #666;">Net Salary</p>
                <p class="salary-amount">${netSalary}</p>
              </div>
              
              <p style="text-align: center;">
                <a href="${payslipUrl}" class="button">View Payslip</a>
              </p>
              
              <p>If you have any questions about your payslip, please contact the HR/Accounts department.</p>
              
              <p>Best regards,<br>HR Team</p>
            </div>
            <div class="footer">
              <p>This is an automated notification. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Notification email sent:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, message: "Notification sent" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error sending notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
