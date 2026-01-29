import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CreateSalespersonRequest {
  email: string;
  password: string;
  fullName: string;
  mobileNo?: string;
  salary?: number;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header to verify the requesting user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    // Create client with user's token to verify permissions
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

    // Check if requesting user has admin or accounts role
    const { data: roleData, error: roleError } = await userClient.rpc("is_admin_or_accounts", {
      _user_id: requestingUser.id,
    });

    if (roleError || !roleData) {
      throw new Error("Unauthorized: Only Super Admin or Accounts can create salespeople");
    }

    // Parse request body
    const { email, password, fullName, mobileNo, salary }: CreateSalespersonRequest = await req.json();

    // Validate required fields
    if (!email || !password || !fullName) {
      throw new Error("Email, password, and full name are required");
    }

    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }

    // Create admin client with service role
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Create the user using admin API
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm the email
      user_metadata: { full_name: fullName },
    });

    if (createError) {
      throw new Error(`Failed to create user: ${createError.message}`);
    }

    if (!newUser.user) {
      throw new Error("User creation failed - no user returned");
    }

    const userId = newUser.user.id;

    // Update the profile with additional fields (profile is auto-created by trigger)
    // Wait a moment for the trigger to execute
    await new Promise(resolve => setTimeout(resolve, 500));

    const { error: profileError } = await adminClient
      .from("profiles")
      .update({
        mobile_no: mobileNo || null,
        salary: salary || null,
      })
      .eq("user_id", userId);

    if (profileError) {
      console.error("Failed to update profile:", profileError);
      // Don't throw - user is created, profile update is non-critical
    }

    // Assign the sales_team role
    const { error: roleInsertError } = await adminClient
      .from("user_roles")
      .insert({
        user_id: userId,
        role: "sales_team",
      });

    if (roleInsertError) {
      console.error("Failed to assign role:", roleInsertError);
      throw new Error(`User created but failed to assign role: ${roleInsertError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Salesperson created successfully",
        userId,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error creating salesperson:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
