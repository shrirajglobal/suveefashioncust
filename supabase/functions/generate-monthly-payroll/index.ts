import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Employee {
  employee_id: string;
  full_name: string;
  per_day_rate: number;
  overtime_rate: number;
  status: string;
  user_id: string | null;
}

interface SalaryRule {
  working_days_per_month: number;
  paid_leaves_allowed: number;
  deduction_per_absent_day: number;
  overtime_multiplier: number;
}

interface AttendanceSummary {
  daysPresent: number;
  leaveDays: number;
  overtimeHours: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the month to process (default: previous month)
    const body = await req.json().catch(() => ({}));
    const targetDate = body.month_year ? new Date(body.month_year + "-01") : new Date();
    
    // If no month specified, use previous month
    if (!body.month_year) {
      targetDate.setMonth(targetDate.getMonth() - 1);
    }
    
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    const monthYear = `${year}-${String(month + 1).padStart(2, '0')}`;
    const monthName = targetDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    
    // Calculate first and last day of month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    console.log(`Generating payroll for ${monthName} (${monthYear})`);

    // Get all active employees
    const { data: employees, error: empError } = await supabase
      .from("employee_master")
      .select("*")
      .eq("status", "active");

    if (empError) throw empError;
    if (!employees || employees.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active employees found", processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = {
      processed: 0,
      skipped: 0,
      errors: [] as string[],
      payrollIds: [] as string[],
    };

    for (const employee of employees as Employee[]) {
      try {
        // Check if payroll already exists for this employee/month
        const { data: existingPayroll } = await supabase
          .from("monthly_payroll")
          .select("payroll_id")
          .eq("employee_id", employee.employee_id)
          .eq("month_year", monthYear)
          .single();

        if (existingPayroll) {
          console.log(`Payroll already exists for ${employee.full_name} (${monthYear})`);
          results.skipped++;
          continue;
        }

        // Get salary rules for employee
        const { data: salaryRule } = await supabase
          .from("salary_rules")
          .select("*")
          .eq("employee_id", employee.employee_id)
          .single();

        const rules: SalaryRule = salaryRule || {
          working_days_per_month: 26,
          paid_leaves_allowed: 0,
          deduction_per_absent_day: 0,
          overtime_multiplier: 1.5,
        };

        // Count attendance for the month
        const { data: attendanceLogs, error: attError } = await supabase
          .from("attendance_logs")
          .select("*")
          .eq("employee_id", employee.employee_id)
          .gte("date", firstDay.toISOString().split('T')[0])
          .lte("date", lastDay.toISOString().split('T')[0]);

        if (attError) throw attError;

        // Calculate attendance summary
        const attendance: AttendanceSummary = {
          daysPresent: 0,
          leaveDays: 0,
          overtimeHours: 0,
        };

        // Group by date to count unique days present
        const dateSet = new Set<string>();
        let inTime: Date | null = null;

        for (const log of attendanceLogs || []) {
          if (log.punch_type === 'IN') {
            dateSet.add(log.date);
            inTime = new Date(log.punch_time);
          } else if (log.punch_type === 'OUT' && inTime) {
            const outTime = new Date(log.punch_time);
            const hoursWorked = (outTime.getTime() - inTime.getTime()) / (1000 * 60 * 60);
            // Consider overtime if worked more than 8 hours
            if (hoursWorked > 8) {
              attendance.overtimeHours += hoursWorked - 8;
            }
            inTime = null;
          }
        }

        attendance.daysPresent = dateSet.size;
        
        // Calculate leave and absent days
        const totalWorkingDays = rules.working_days_per_month;
        const absentDays = Math.max(0, totalWorkingDays - attendance.daysPresent - rules.paid_leaves_allowed);
        attendance.leaveDays = Math.min(rules.paid_leaves_allowed, totalWorkingDays - attendance.daysPresent);

        // Create payroll record
        const { data: payroll, error: payrollError } = await supabase
          .from("monthly_payroll")
          .insert({
            employee_id: employee.employee_id,
            month_year: monthYear,
            total_working_days: totalWorkingDays,
            days_present: attendance.daysPresent,
            leave_days: attendance.leaveDays,
            absent_days: absentDays,
            overtime_hours: Math.round(attendance.overtimeHours * 100) / 100,
            per_day_rate: employee.per_day_rate,
            overtime_rate: employee.overtime_rate,
            deduction_rate: rules.deduction_per_absent_day,
            payment_status: 'pending',
          })
          .select()
          .single();

        if (payrollError) throw payrollError;

        results.processed++;
        results.payrollIds.push(payroll.payroll_id);
        console.log(`Created payroll for ${employee.full_name}: ${payroll.payroll_id}`);

        // Generate payslip
        try {
          await supabase.functions.invoke('generate-payslip', {
            body: { payroll_id: payroll.payroll_id },
          });
        } catch (payslipError) {
          console.error(`Failed to generate payslip for ${employee.full_name}:`, payslipError);
        }

        // Send notification if employee has linked user account and email
        if (employee.user_id) {
          try {
            await supabase.functions.invoke('send-payslip-notification', {
              body: { 
                employee_id: employee.employee_id,
                month_year: monthName,
                payroll_id: payroll.payroll_id,
              },
            });
          } catch (notifError) {
            console.error(`Failed to send notification to ${employee.full_name}:`, notifError);
          }
        }

      } catch (error: any) {
        console.error(`Error processing ${employee.full_name}:`, error);
        results.errors.push(`${employee.full_name}: ${error.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        month_year: monthYear,
        ...results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
