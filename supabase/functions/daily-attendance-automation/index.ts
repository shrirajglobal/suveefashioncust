import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Employee {
  employee_id: string;
  full_name: string;
}

interface AttendanceLog {
  log_id: string;
  employee_id: string;
  punch_type: "IN" | "OUT";
  selfie_image_url: string | null;
  gps_latitude: number | null;
  gps_longitude: number | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the date to process (default: yesterday for end-of-day processing)
    const body = await req.json().catch(() => ({}));
    const targetDate = body.date 
      ? new Date(body.date) 
      : new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
    
    const dateStr = targetDate.toISOString().split('T')[0];
    const dayOfWeek = targetDate.getDay(); // 0 = Sunday, 6 = Saturday

    console.log(`Processing attendance automation for ${dateStr}`);

    // Skip weekends (configurable - you can adjust this)
    if (dayOfWeek === 0) {
      console.log("Sunday - skipping automation");
      return new Response(
        JSON.stringify({ message: "Sunday - skipped", date: dateStr }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = {
      date: dateStr,
      absent_marked: 0,
      incomplete_punches: 0,
      missing_selfie: 0,
      missing_gps: 0,
      errors: [] as string[],
    };

    // Get all active employees
    const { data: employees, error: empError } = await supabase
      .from("employee_master")
      .select("employee_id, full_name")
      .eq("status", "active");

    if (empError) throw empError;
    if (!employees || employees.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active employees", ...results }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all attendance logs for the target date
    const { data: allLogs, error: logsError } = await supabase
      .from("attendance_logs")
      .select("*")
      .eq("date", dateStr);

    if (logsError) throw logsError;

    // Group logs by employee
    const logsByEmployee = new Map<string, AttendanceLog[]>();
    for (const log of allLogs || []) {
      const existing = logsByEmployee.get(log.employee_id) || [];
      existing.push(log);
      logsByEmployee.set(log.employee_id, existing);
    }

    // Process each employee
    for (const employee of employees as Employee[]) {
      try {
        const employeeLogs = logsByEmployee.get(employee.employee_id) || [];

        // Check 1: No attendance at all = Absent
        if (employeeLogs.length === 0) {
          const { error: flagError } = await supabase
            .from("attendance_flags")
            .upsert({
              employee_id: employee.employee_id,
              date: dateStr,
              flag_type: "absent",
              description: `${employee.full_name} had no attendance recorded for ${dateStr}`,
            }, { onConflict: "employee_id,date,flag_type" });

          if (!flagError) results.absent_marked++;
          continue;
        }

        // Check 2: Incomplete punches (IN without OUT or vice versa)
        const inCount = employeeLogs.filter(l => l.punch_type === "IN").length;
        const outCount = employeeLogs.filter(l => l.punch_type === "OUT").length;

        if (inCount !== outCount) {
          const { error: flagError } = await supabase
            .from("attendance_flags")
            .upsert({
              employee_id: employee.employee_id,
              date: dateStr,
              flag_type: "incomplete_punch",
              description: `${employee.full_name} has incomplete punches: ${inCount} IN, ${outCount} OUT`,
            }, { onConflict: "employee_id,date,flag_type" });

          if (!flagError) results.incomplete_punches++;
        }

        // Check 3: Missing selfie
        const missingSelfie = employeeLogs.some(l => !l.selfie_image_url);
        if (missingSelfie) {
          const { error: flagError } = await supabase
            .from("attendance_flags")
            .upsert({
              employee_id: employee.employee_id,
              date: dateStr,
              flag_type: "missing_selfie",
              description: `${employee.full_name} has punch(es) without selfie verification`,
            }, { onConflict: "employee_id,date,flag_type" });

          if (!flagError) results.missing_selfie++;
        }

        // Check 4: Missing GPS
        const missingGPS = employeeLogs.some(l => !l.gps_latitude || !l.gps_longitude);
        if (missingGPS) {
          const { error: flagError } = await supabase
            .from("attendance_flags")
            .upsert({
              employee_id: employee.employee_id,
              date: dateStr,
              flag_type: "missing_gps",
              description: `${employee.full_name} has punch(es) without GPS location`,
            }, { onConflict: "employee_id,date,flag_type" });

          if (!flagError) results.missing_gps++;
        }

      } catch (error: any) {
        console.error(`Error processing ${employee.full_name}:`, error);
        results.errors.push(`${employee.full_name}: ${error.message}`);
      }
    }

    console.log("Daily automation completed:", results);

    return new Response(
      JSON.stringify({ success: true, ...results }),
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
