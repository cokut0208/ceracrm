// supabase/functions/get-verimor-queue-users/index.ts
// Belirli bir kuyruktaki dahilileri listeler (invoke uyumlu - POST)
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

// CORS Ayarları
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // Canlıda kısıtla
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

console.log("get-verimor-queue-users fonksiyonu başlatıldı (POST kabul eder).");

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

    // 2. queue_number'ı Request Body'den Al (JSON)
    let queueNumber: string | undefined;
    try {
        const body = await req.json();
        queueNumber = body.queue_number;
         if (!queueNumber) {
             throw new Error("Request body içinde 'queue_number' eksik");
         }
    } catch (e) {
         console.warn("JSON body parse edilemedi veya queue_number eksik:", e.message);
         return new Response(JSON.stringify({ error: "Geçersiz istek body'si. JSON formatında 'queue_number' bekleniyor." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    console.log(`Kuyruk dahilileri alınıyor: queue_number: ${queueNumber}`);


    // 3. Verimor API URL'ini Oluştur
    const verimorApiUrl = new URL("https://api.bulutsantralim.com/queue/user_list");
    verimorApiUrl.searchParams.set("key", verimorApiKey);
    verimorApiUrl.searchParams.set("queue_number", queueNumber);

    console.log(`Verimor Queue User List API çağrılıyor (GET): ${verimorApiUrl.toString()}`);

    // 4. Verimor API'sine GET İsteği Yap
    const verimorResponse = await fetch(verimorApiUrl.toString(), {
      method: "GET",
      headers: { "Accept": "application/json" },
    });

    // 5. Verimor API Cevabını İşle
    const responseBody = await verimorResponse.text();
    console.log(`Verimor API Cevap Durumu: ${verimorResponse.status}`);

    if (!verimorResponse.ok) {
      console.error(`Verimor API Hatası (${verimorResponse.status}): ${responseBody}`);
      let clientErrorMessage = `Kuyruk dahilileri alınırken hata oluştu (${verimorResponse.status}).`;
       if (verimorResponse.status === 400) {
            if (responseBody.toLowerCase().includes("gecersiz anahtar")) clientErrorMessage = "API Anahtarı geçersiz veya hatalı.";
            else if (responseBody.toLowerCase().includes("queue_number value null")) clientErrorMessage = "Geçersiz veya eksik kuyruk numarası.";
            else clientErrorMessage = `Verimor Hatası: ${responseBody}`;
       }
      return new Response(JSON.stringify({ error: clientErrorMessage }), {
        status: verimorResponse.status >= 500 ? 502 : verimorResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Başarılı cevap
    try {
        const data = JSON.parse(responseBody); // Cevap bir JSON dizisi olmalı
        console.log(`Kuyruk (${queueNumber}) dahilileri başarıyla alındı.`);
        return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
     } catch (parseError) {
         console.error("Verimor JSON cevabı parse edilirken hata:", parseError);
         return new Response(JSON.stringify({ error: "Verimor API'sinden geçersiz yanıt alındı." }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

  } catch (error) {
    console.error("!!! get-verimor-queue-users içinde beklenmedik hata:", error);
    return new Response(JSON.stringify({ error: error.message || "İç Sunucu Hatası" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
