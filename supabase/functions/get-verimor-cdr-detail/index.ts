// supabase/functions/get-verimor-cdr-detail/index.ts
// invoke ile çağrılacak şekilde güncellendi (POST kabul eder, body'den call_uuid okur)
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

// CORS Ayarları (POST eklendi)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // Canlıda uygulamanızın origin'i ile değiştirin
  "Access-Control-Allow-Methods": "POST, OPTIONS", // GET yerine POST
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

// Environment Variables
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const verimorApiKey = Deno.env.get("VERIMOR_API_KEY");

if (!supabaseUrl || !supabaseServiceRoleKey || !verimorApiKey) {
  console.error("Gerekli ortam değişkenleri eksik");
  throw new Error("Sunucu yapılandırma hatası.");
}

// Supabase Admin Client
const supabaseAdmin: SupabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false }
});

console.log("get-verimor-cdr-detail fonksiyonu başlatıldı (invoke uyumlu).");

serve(async (req: Request) => {
  console.log(`---> İstek Alındı: ${req.method} ${req.url}`);

  // CORS preflight
  if (req.method === "OPTIONS") {
    console.log("OPTIONS isteği işleniyor.");
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Sadece POST kabul et
  if (req.method !== "POST") {
      console.warn(`İzin verilmeyen metot: ${req.method}`);
      return new Response(JSON.stringify({ error: "Metot izin verilmiyor, POST kullanın" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    // 1. Kullanıcıyı Doğrula
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
       console.warn("Eksik veya geçersiz Authorization başlığı.");
       return new Response(JSON.stringify({ error: "Yetkisiz: Eksik token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userToken = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(userToken);

    if (authError || !user) {
        console.error("Yetkilendirme Hatası veya kullanıcı bulunamadı:", authError?.message || "Kullanıcı yok");
        return new Response(JSON.stringify({ error: `Yetkisiz: ${authError?.message || "Geçersiz token"}` }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    console.log(`Kullanıcı doğrulandı: ${user.id}`);

    // 2. call_uuid'yi Request Body'den Al (JSON)
    let callUuid: string | undefined;
    try {
        const body = await req.json();
        callUuid = body.call_uuid;
         if (!callUuid) {
             throw new Error("Request body içinde 'call_uuid' eksik");
         }
    } catch (e) {
         console.warn("JSON body parse edilemedi veya call_uuid eksik:", e.message);
         return new Response(JSON.stringify({ error: "Geçersiz istek body'si. JSON formatında 'call_uuid' bekleniyor." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`Detaylar alınıyor: call_uuid: ${callUuid}`);

    // 3. Verimor API URL'ini Oluştur (Parametreler URL'de)
    const verimorApiUrl = new URL(`https://api.bulutsantralim.com/cdrs/${callUuid}`);
    verimorApiUrl.searchParams.set("key", verimorApiKey); // API Key zorunlu

    console.log(`Verimor CDR Detay API çağrılıyor (GET): ${verimorApiUrl.toString()}`);

    // 4. Verimor API'sine GET İsteği Yap (Detay endpoint'i GET)
    const verimorResponse = await fetch(verimorApiUrl.toString(), {
      method: "GET",
      headers: { "Accept": "application/json" },
    });

    // 5. Verimor API Cevabını İşle
    const responseBody = await verimorResponse.text();
    console.log(`Verimor API Cevap Durumu: ${verimorResponse.status}`);

    if (!verimorResponse.ok) {
      console.error(`Verimor API Hatası (${verimorResponse.status}): ${responseBody}`);
      let clientErrorMessage = `Arama detayı alınırken hata oluştu (${verimorResponse.status}).`;
       if (verimorResponse.status === 404) {
             clientErrorMessage = "Belirtilen arama kaydı bulunamadı.";
       } else if (verimorResponse.status === 400 && responseBody.toLowerCase().includes("gecersiz anahtar")) {
           clientErrorMessage = "API Anahtarı geçersiz veya hatalı.";
       }
      return new Response(JSON.stringify({ error: clientErrorMessage }), {
        status: verimorResponse.status >= 500 ? 502 : verimorResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Başarılı cevap
    try {
        const data = JSON.parse(responseBody);
        console.log(`Detaylar başarıyla alındı: call_uuid: ${callUuid}`);
        // 6. Veriyi Frontend'e Gönder
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
     } catch (parseError) {
         console.error("Verimor JSON cevabı parse edilirken hata:", parseError);
         return new Response(JSON.stringify({ error: "Verimor API'sinden geçersiz yanıt alındı." }), {
             status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
         });
    }

  } catch (error) {
    console.error("!!! get-verimor-cdr-detail içinde beklenmedik hata:", error);
    return new Response(JSON.stringify({ error: error.message || "İç Sunucu Hatası" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
