// supabase/functions/get-verimor-recording-url/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

// CORS Ayarları
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // Canlıda uygulamanızın origin'i ile değiştirin
  "Access-Control-Allow-Methods": "POST, OPTIONS", // Sadece POST kabul ediyoruz (dokümantasyona göre)
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Environment Variables
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const verimorApiKey = Deno.env.get("VERIMOR_API_KEY");

if (!supabaseUrl || !supabaseServiceRoleKey || !verimorApiKey) {
  console.error("Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VERIMOR_API_KEY");
  throw new Error("Server configuration error.");
}

// Supabase Admin Client
const supabaseAdmin: SupabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false }
});

console.log("get-verimor-recording-url function initialized.");

serve(async (req: Request) => {
  console.log(`---> Request Received: ${req.method} ${req.url}`);

  // CORS preflight
  if (req.method === "OPTIONS") {
    console.log("Handling OPTIONS request.");
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Sadece POST isteklerini kabul et
  if (req.method !== "POST") {
      console.warn(`Method Not Allowed: ${req.method}`);
      return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    // 1. Kullanıcıyı Doğrula
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
       console.warn("Missing or invalid Authorization header.");
       return new Response(JSON.stringify({ error: "Unauthorized: Missing token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userToken = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(userToken);

    if (authError || !user) {
        console.error("Auth Error or no user:", authError?.message || "No user");
        return new Response(JSON.stringify({ error: `Unauthorized: ${authError?.message || "Invalid token"}` }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    console.log(`User validated: ${user.id}`);

    // 2. call_uuid'yi Request Body'den Al (JSON)
    let callUuid: string | undefined;
    try {
        const body = await req.json();
        callUuid = body.call_uuid;
         if (!callUuid) {
             throw new Error("Missing 'call_uuid' in request body");
         }
    } catch (e) {
         console.warn("Could not parse JSON body or missing call_uuid:", e.message);
         return new Response(JSON.stringify({ error: "Invalid request body. Expecting JSON with 'call_uuid'." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`Requesting recording URL for call_uuid: ${callUuid}`);

    // 3. Verimor API URL'ini Oluştur (Parametreler URL'de)
    // Dokümantasyondaki örnek POST isteği için parametreleri URL'e ekliyor.
    const verimorApiUrl = new URL("https://api.bulutsantralim.com/recording_url/");
    verimorApiUrl.searchParams.set("key", verimorApiKey);
    verimorApiUrl.searchParams.set("call_uuid", callUuid);

    console.log(`Calling Verimor Recording URL API (POST): ${verimorApiUrl.toString()}`);

    // 4. Verimor API'sine POST İsteği Yap (Body boş olabilir veya dokümantasyon belirsiz)
    // Dokümantasyon parametreleri URL'de gösterdiği için body'yi boş gönderelim.
    const verimorResponse = await fetch(verimorApiUrl.toString(), {
      method: "POST",
      headers: {
        "Accept": "*/*", // Dokümantasyondaki gibi
        // Content-Type belirtmeye gerek yok (body boş)
      },
      // body: JSON.stringify({}) // Body boş
    });

    // 5. Verimor API Cevabını İşle
    const responseBody = await verimorResponse.text(); // Başarılı cevap URL olarak text formatında gelir
    console.log(`Verimor API Response Status: ${verimorResponse.status}`);
    // console.log(`Verimor API Response Body: ${responseBody}`); // Debug için

    if (!verimorResponse.ok) {
      console.error(`Verimor API Error (${verimorResponse.status}): ${responseBody}`);
      let clientErrorMessage = `Ses kaydı URL'i alınırken hata oluştu (${verimorResponse.status}).`;
       if (verimorResponse.status === 404 || (verimorResponse.status === 400 && responseBody.toLowerCase().includes("cannot find call"))) {
             clientErrorMessage = "Belirtilen arama kaydı veya ses kaydı bulunamadı.";
       } else if (verimorResponse.status === 400 && responseBody.toLowerCase().includes("gecersiz anahtar")) {
           clientErrorMessage = "API Anahtarı geçersiz veya hatalı.";
       } else if (responseBody) {
           // clientErrorMessage = `Verimor Hatası: ${responseBody}`;
       }
      return new Response(JSON.stringify({ error: clientErrorMessage }), {
        status: verimorResponse.status >= 500 ? 502 : verimorResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Başarılı cevap (URL text olarak geldi)
    const recordingUrl = responseBody;
    console.log(`Successfully obtained recording URL for call_uuid: ${callUuid}`);

    // --- Opsiyonel: Alınan URL'i call_logs'a kaydetme ---
    // Bu, URL'i tekrar tekrar istememek için faydalı olabilir, ancak URL'in 1 saat ömrü var.
    // const { error: updateError } = await supabaseAdmin
    //   .from("call_logs")
    //   .update({ recording_url_temp: recordingUrl }) // Veya kalıcı bir alan
    //   .eq("call_uuid", callUuid);
    // if (updateError) {
    //   console.warn(`Could not update recording_url_temp in DB: ${updateError.message}`);
    // }
    // ----------------------------------------------------

    // 6. URL'i Frontend'e Gönder
    return new Response(JSON.stringify({ recording_url: recordingUrl }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("!!! Unhandled Error in get-verimor-recording-url:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
