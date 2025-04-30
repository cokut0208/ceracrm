import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.7";

// Supabase client with admin privileges
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    }
  }
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AdminCreateRequest {
  email: string;
  password: string;
  name: string;
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
      status: 204,
    });
  }

  try {
    // Parse request body
    const body: AdminCreateRequest = await req.json();
    const { email, password, name } = body;

    if (!email || !password || !name) {
      return new Response(
        JSON.stringify({ error: "Email, password ve name alanları zorunludur" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // 1. Create auth user with admin email/password
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Skip email verification
    });

    if (authError) {
      return new Response(
        JSON.stringify({ error: `Auth kullanıcısı oluşturulurken hata: ${authError.message}` }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // 2. Insert admin data into users table
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .upsert({
        id: authData.user.id,
        email,
        name,
        role: "admin",
        department: "Yönetim",
        position: "Sistem Yöneticisi",
        status: "active",
        extension_number: "100",
      })
      .select()
      .single();

    if (userError) {
      return new Response(
        JSON.stringify({ error: `Kullanıcı tablosuna veri eklenirken hata: ${userError.message}` }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // 3. Add permissions
    const permissions = [
      "user:create", "user:read", "user:update", "user:delete",
      "department:create", "department:read", "department:update", "department:delete",
      "call:make", "call:receive", "call:record", "call:listen", "call:report",
      "customer:create", "customer:read", "customer:update", "customer:delete"
    ];

    const permissionRecords = permissions.map(permission => ({
      user_id: userData.id,
      permission
    }));

    const { error: permissionError } = await supabaseAdmin
      .from("user_permissions")
      .upsert(permissionRecords);

    if (permissionError) {
      return new Response(
        JSON.stringify({ error: `İzinler eklenirken hata: ${permissionError.message}` }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Success response
    return new Response(
      JSON.stringify({
        success: true,
        message: "Admin kullanıcısı başarıyla oluşturuldu",
        user: userData,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: `Beklenmeyen hata: ${error.message}` }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});