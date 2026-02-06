import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PayrollData {
  payroll_id: string;
  employee_id: string;
  month_year: string;
  total_working_days: number;
  days_present: number;
  leave_days: number;
  absent_days: number;
  overtime_hours: number;
  per_day_rate: number;
  overtime_rate: number;
  deduction_rate: number;
  gross_salary: number;
  total_deductions: number;
  net_salary: number;
  payment_status: string;
  employee_master: {
    full_name: string;
    department: string;
    role: string;
    joining_date: string;
  };
}

function generatePayslipHTML(data: PayrollData): string {
  const employee = data.employee_master;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Payslip - ${employee.full_name} - ${data.month_year}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; padding: 40px; background: #fff; }
    .container { max-width: 800px; margin: 0 auto; border: 2px solid #333; padding: 30px; }
    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
    .header h1 { color: #1a365d; font-size: 24px; }
    .header h2 { color: #666; font-size: 16px; margin-top: 5px; }
    .section { margin-bottom: 20px; }
    .section-title { background: #1a365d; color: white; padding: 8px 15px; font-weight: bold; margin-bottom: 10px; }
    .row { display: flex; justify-content: space-between; padding: 8px 15px; border-bottom: 1px solid #eee; }
    .row:last-child { border-bottom: none; }
    .label { color: #666; }
    .value { font-weight: 600; }
    .total-row { background: #f0f4f8; font-weight: bold; }
    .net-salary { background: #1a365d; color: white; font-size: 18px; }
    .status { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; text-transform: uppercase; }
    .status-paid { background: #c6f6d5; color: #22543d; }
    .status-pending { background: #fed7d7; color: #822727; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
    .two-col { display: flex; gap: 20px; }
    .two-col > div { flex: 1; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>PAYSLIP</h1>
      <h2>For the month of ${data.month_year}</h2>
    </div>
    
    <div class="two-col">
      <div class="section">
        <div class="section-title">Employee Details</div>
        <div class="row"><span class="label">Name</span><span class="value">${employee.full_name}</span></div>
        <div class="row"><span class="label">Department</span><span class="value">${employee.department}</span></div>
        <div class="row"><span class="label">Role</span><span class="value">${employee.role}</span></div>
        <div class="row"><span class="label">Joining Date</span><span class="value">${employee.joining_date}</span></div>
      </div>
      
      <div class="section">
        <div class="section-title">Attendance Summary</div>
        <div class="row"><span class="label">Working Days</span><span class="value">${data.total_working_days}</span></div>
        <div class="row"><span class="label">Days Present</span><span class="value">${data.days_present}</span></div>
        <div class="row"><span class="label">Leave Days</span><span class="value">${data.leave_days}</span></div>
        <div class="row"><span class="label">Absent Days</span><span class="value">${data.absent_days}</span></div>
        <div class="row"><span class="label">Overtime Hours</span><span class="value">${data.overtime_hours}</span></div>
      </div>
    </div>
    
    <div class="two-col">
      <div class="section">
        <div class="section-title">Earnings</div>
        <div class="row"><span class="label">Per Day Rate</span><span class="value">₹${Number(data.per_day_rate).toFixed(2)}</span></div>
        <div class="row"><span class="label">Days Present × Rate</span><span class="value">₹${(data.days_present * Number(data.per_day_rate)).toFixed(2)}</span></div>
        <div class="row"><span class="label">Overtime Rate</span><span class="value">₹${Number(data.overtime_rate).toFixed(2)}/hr</span></div>
        <div class="row"><span class="label">Overtime Earnings</span><span class="value">₹${(Number(data.overtime_hours) * Number(data.overtime_rate)).toFixed(2)}</span></div>
        <div class="row total-row"><span class="label">Gross Salary</span><span class="value">₹${Number(data.gross_salary).toFixed(2)}</span></div>
      </div>
      
      <div class="section">
        <div class="section-title">Deductions</div>
        <div class="row"><span class="label">Deduction Rate/Day</span><span class="value">₹${Number(data.deduction_rate).toFixed(2)}</span></div>
        <div class="row"><span class="label">Absent Days × Rate</span><span class="value">₹${(data.absent_days * Number(data.deduction_rate)).toFixed(2)}</span></div>
        <div class="row total-row"><span class="label">Total Deductions</span><span class="value">₹${Number(data.total_deductions).toFixed(2)}</span></div>
      </div>
    </div>
    
    <div class="section">
      <div class="row net-salary">
        <span>NET SALARY</span>
        <span>₹${Number(data.net_salary).toFixed(2)}</span>
      </div>
    </div>
    
    <div class="section">
      <div class="row">
        <span class="label">Payment Status</span>
        <span class="status ${data.payment_status === 'paid' ? 'status-paid' : 'status-pending'}">${data.payment_status}</span>
      </div>
    </div>
    
    <div class="footer">
      <p>This is a computer-generated payslip and does not require a signature.</p>
      <p>Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
    </div>
  </div>
</body>
</html>
  `;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { payroll_id } = await req.json();

    if (!payroll_id) {
      return new Response(
        JSON.stringify({ error: "payroll_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch payroll data with employee details
    const { data: payrollData, error: fetchError } = await supabase
      .from("monthly_payroll")
      .select(`
        *,
        employee_master (
          full_name,
          department,
          role,
          joining_date
        )
      `)
      .eq("payroll_id", payroll_id)
      .single();

    if (fetchError || !payrollData) {
      return new Response(
        JSON.stringify({ error: "Payroll record not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate HTML payslip
    const htmlContent = generatePayslipHTML(payrollData as PayrollData);
    
    // Create filename
    const fileName = `payslip_${payrollData.employee_master.full_name.replace(/\s+/g, '_')}_${payrollData.month_year.replace(/\s+/g, '_')}.html`;
    const filePath = `${payrollData.employee_id}/${fileName}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from("payslips")
      .upload(filePath, htmlContent, {
        contentType: "text/html",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: "Failed to upload payslip" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("payslips")
      .getPublicUrl(filePath);

    const payslipUrl = urlData.publicUrl;

    // Update payroll record with payslip URL
    const { error: updateError } = await supabase
      .from("monthly_payroll")
      .update({ payslip_url: payslipUrl })
      .eq("payroll_id", payroll_id);

    if (updateError) {
      console.error("Update error:", updateError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        payslip_url: payslipUrl,
        message: "Payslip generated successfully" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
