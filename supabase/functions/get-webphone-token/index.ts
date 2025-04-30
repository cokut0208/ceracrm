// Supabase Edge Function: supabase/functions/get-verimor-webphone-token/index.ts
// Kullanıcının dahilisini bulur ve Verimor'dan webphone token'ı alır.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

// CORS Ayarları
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // Canlıda uygulamanızın origin'i ile değiştirin
  "Access-Control-Allow-Methods": "GET, OPTIONS", // Sadece GET kabul ediyoruz
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Supabase ve Verimor API Anahtarları (Environment Variables)
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); // Personnel tablosunu okumak için Service Role Key
const verimorApiKey = Deno.env.get("VERIMOR_API_KEY"); // Verimor API Anahtarınız

if (!supabaseUrl || !supabaseServiceRoleKey || !verimorApiKey) {
  console.error("Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VERIMOR_API_KEY");
  throw new Error("Server configuration error.");
}

// Supabase Admin Client
const supabaseAdmin: SupabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false }
});

console.log("get-verimor-webphone-token function initialized.");

serve(async (req: Request) => {
  console.log(`---> Request Received: ${req.method} ${req.url}`);

  // CORS preflight
  if (req.method === "OPTIONS") {
    console.log("Handling OPTIONS request.");
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Sadece GET isteklerini kabul et
  if (req.method !== "GET") {
      console.warn(`Method Not Allowed: ${req.method}`);
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
  }

  try {
    // 1. Kullanıcıyı Doğrula (Authorization Header'dan)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
       console.warn("Missing or invalid Authorization header.");
       return new Response(JSON.stringify({ error: "Unauthorized: Missing token" }), {
         status: 401,
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       });
    }
    const userToken = authHeader.replace("Bearer ", "");

    // Geçici bir Supabase client oluşturup kullanıcıyı al (Service Role Key kullanmadan)
    // Bu, RLS'nin düzgün çalışmasını sağlar ve sadece kullanıcının kendi bilgilerine erişmesini garanti eder (eğer RLS varsa)
    // Ancak personnel tablosunu okumak için admin client'a ihtiyacımız var.
    // Güvenlik açısından, user id'yi doğrulamak için anon key ile bir client kullanmak daha iyi olabilir.
    // Şimdilik service_role ile devam edelim ama bu bir güvenlik değerlendirmesi gerektirir.
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(userToken);

    if (authError) {
        console.error("Auth Error:", authError.message);
        return new Response(JSON.stringify({ error: `Unauthorized: ${authError.message}` }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
     if (!user) {
        console.warn("No user found for the provided token.");
        return new Response(JSON.stringify({ error: "Unauthorized: Invalid token" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    console.log(`User validated: ${user.id}`);

    // 2. Kullanıcının Dahili Numarasını Al (personnel tablosundan)
    const { data: personnelData, error: personnelError } = await supabaseAdmin
      .from("personnel")
      .select("verimor_extension")
      .eq("user_id", user.id) // user_id kolonu olduğunu varsayıyoruz
      .single(); // Tek bir kayıt bekliyoruz

    if (personnelError) {
        console.error(`Error fetching personnel for user ${user.id}:`, personnelError);
        // Kullanıcı bulundu ama personel kaydı bulunamadıysa 404 daha uygun olabilir
        if (personnelError.code === 'PGRST116') { // "Not found" hatası
             console.warn(`No personnel record found for user ${user.id}`);
             return new Response(JSON.stringify({ error: "User has no associated extension number" }), {
                 status: 404, // Not Found
                 headers: { ...corsHeaders, "Content-Type": "application/json" },
             });
        }
        // Diğer veritabanı hataları için 500
        return new Response(JSON.stringify({ error: "Database error fetching personnel data" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    if (!personnelData?.verimor_extension) {
        console.warn(`Personnel record found for user ${user.id}, but verimor_extension is null or empty.`);
        return new Response(JSON.stringify({ error: "Extension number is missing for this user" }), {
            status: 404, // Veya 400 Bad Request
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const extension = personnelData.verimor_extension;
    console.log(`Found extension ${extension} for user ${user.id}`);

    // 3. Verimor API'sini Çağırarak Token Al
    const verimorApiUrl = "https://api.bulutsantralim.com/webphone_tokens";
    const verimorPayload = {
      key: verimorApiKey,
      extension: extension.toString(), // Emin olmak için string'e çevir
    };

    console.log(`Calling Verimor API at ${verimorApiUrl} for extension ${extension}`);
    const verimorResponse = await fetch(verimorApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "*/*", // Dokümantasyondaki gibi
      },
      body: JSON.stringify(verimorPayload),
    });

    // 4. Verimor API Cevabını İşle
    if (!verimorResponse.ok) {
      const errorText = await verimorResponse.text(); // Hata mesajı text olarak gelir
      console.error(`Verimor API Error (${verimorResponse.status}): ${errorText}`);
      // Verimor'dan gelen hatayı doğrudan client'a göndermek bilgi sızdırabilir.
      // Daha genel bir hata mesajı vermek daha güvenli olabilir.
      let clientErrorMessage = "Failed to get webphone token from provider.";
      if (verimorResponse.status === 400) {
          // Verimor'un 400 hatalarını daha anlaşılır hale getirebiliriz
          if (errorText.includes("missing extension")) clientErrorMessage = "Provider error: Extension missing in request.";
          else if (errorText.includes("cannot find user for extension")) clientErrorMessage = "Provider error: Invalid extension number.";
          else if (errorText.includes("cannot find employee for extension")) clientErrorMessage = "Provider error: No personnel account for this extension.";
          else clientErrorMessage = `Provider error: ${errorText}`; // Diğer 400 hataları
      }

      return new Response(JSON.stringify({ error: clientErrorMessage }), {
        status: verimorResponse.status === 400 ? 400 : 502, // 400 Bad Request veya 502 Bad Gateway
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Başarılı cevap: Token text olarak gelir
    const webphoneToken = await verimorResponse.text();
    console.log(`Successfully obtained webphone token for extension ${extension}`);

    // 5. Token'ı Frontend'e Gönder
    return new Response(JSON.stringify({ token: webphoneToken }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("!!! Unhandled Error in get-verimor-webphone-token:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
