import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CreateEmployeeRequest {
  email: string;
  password: string;
  fullName: string;
  department: string;
  role: string;
  salaryType: "monthly" | "daily" | "hourly";
  baseSalary: number;
  perDayRate: number;
  overtimeRate: number;
  joiningDate: string;
  reportingManagerId?: string;
  mobileNo?: string;
  isSalesPerson: boolean;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the requesting user is admin or accounts
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: requestingUser }, error: userError } = await userClient.auth.getUser();
    if (userError || !requestingUser) {
      throw new Error("Unauthorized: Invalid user token");
    }

    const { data: roleData, error: roleError } = await userClient.rpc("is_admin_or_accounts", {
      _user_id: requestingUser.id,
    });

    if (roleError || !roleData) {
      throw new Error("Unauthorized: Only Super Admin or Accounts can create employees");
    }

    const body: CreateEmployeeRequest = await req.json();
    const {
      email,
      password,
      fullName,
      department,
      role,
      salaryType,
      baseSalary,
      perDayRate,
      overtimeRate,
      joiningDate,
      reportingManagerId,
      mobileNo,
      isSalesPerson,
    } = body;

    // Validate required fields
    if (!email || !password || !fullName || !department || !role) {
      throw new Error("Email, password, full name, department, and role are required");
    }

    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Check if user already exists with this email
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    let userId: string;

    if (existingUser) {
      // User already exists - link to this employee record
      userId = existingUser.id;
      
      // Check if already an employee
      const { data: existingEmployee } = await adminClient
        .from("employee_master")
        .select("employee_id")
        .eq("user_id", userId)
        .single();
        
      if (existingEmployee) {
        throw new Error("This user is already registered as an employee");
      }
    } else {
      // Create new auth user
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

      if (createError) {
        throw new Error(`Failed to create user: ${createError.message}`);
      }

      if (!newUser.user) {
        throw new Error("User creation failed - no user returned");
      }

      userId = newUser.user.id;

      // Wait for profile trigger to execute
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Create employee_master record
    const { data: employee, error: empError } = await adminClient
      .from("employee_master")
      .insert({
        user_id: userId,
        full_name: fullName,
        department,
        role,
        salary_type: salaryType,
        base_salary: baseSalary || 0,
        per_day_rate: perDayRate || 0,
        overtime_rate: overtimeRate || 0,
        joining_date: joiningDate || new Date().toISOString().split('T')[0],
        reporting_manager_id: reportingManagerId || null,
        status: "active",
      })
      .select("employee_id")
      .single();

    if (empError) {
      throw new Error(`Failed to create employee record: ${empError.message}`);
    }

    // Update profile with mobile number and salary if provided
    const { error: profileError } = await adminClient
      .from("profiles")
      .update({
        mobile_no: mobileNo || null,
        salary: baseSalary || null,
        full_name: fullName,
      })
      .eq("user_id", userId);

    if (profileError) {
      console.error("Failed to update profile:", profileError);
    }

    // Create default salary rules for the employee
    const { error: rulesError } = await adminClient
      .from("salary_rules")
      .insert({
        employee_id: employee.employee_id,
        working_days_per_month: 26,
        paid_leaves_allowed: 2,
        deduction_per_absent_day: perDayRate || 0,
        overtime_multiplier: 1.5,
      });

    if (rulesError) {
      console.error("Failed to create salary rules:", rulesError);
    }

    // Assign role based on isSalesPerson flag
    if (isSalesPerson) {
      // Check if sales_team role already exists
      const { data: existingRole } = await adminClient
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role", "sales_team")
        .single();

      if (!existingRole) {
        const { error: roleInsertError } = await adminClient
          .from("user_roles")
          .insert({
            user_id: userId,
            role: "sales_team",
          });

        if (roleInsertError) {
          console.error("Failed to assign sales_team role:", roleInsertError);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Employee created successfully",
        employeeId: employee.employee_id,
        userId,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error creating employee:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
