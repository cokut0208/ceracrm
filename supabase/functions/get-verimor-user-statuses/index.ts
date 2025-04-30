// supabase/functions/get-verimor-user-statuses/index.ts
// POST isteklerini kabul edecek şekilde güncellendi (invoke uyumlu)
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

// CORS Ayarları (POST eklendi, GET kaldırıldı)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // Canlıda kısıtla
  "Access-Control-Allow-Methods": "POST, OPTIONS", // Sadece POST ve OPTIONS
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

console.log("get-verimor-user-statuses fonksiyonu başlatıldı (POST kabul eder).");

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

    // 2. Filtreleri Request Body'den Al (Opsiyonel - invoke body gönderebilir)
    let filters: { user?: string; status?: string } = {};
    try {
        // Body boş olabilir, hata vermemesi için kontrol edelim
        if (req.headers.get("content-length") !== "0" && req.body) {
            filters = await req.json();
            console.log("Body'den alınan filtreler:", filters);
        } else {
             console.log("Request body boş veya yok, filtre uygulanmayacak.");
        }
    } catch (e) {
        // Body parse edilemezse logla ama devam et (filtresiz çağrı)
        console.warn("JSON body parse edilemedi (opsiyonel filtreler için):", e.message);
    }

    // 3. Verimor API URL'ini Oluştur
    const verimorApiUrl = new URL("https://api.bulutsantralim.com/user_statuses");
    verimorApiUrl.searchParams.set("key", verimorApiKey);

    // Filtreleri ekle (varsa)
    if (filters.user) {
        verimorApiUrl.searchParams.set("user", filters.user);
    }
    if (filters.status) {
        verimorApiUrl.searchParams.set("status", filters.status);
    }

    console.log(`Verimor User Status API çağrılıyor (GET): ${verimorApiUrl.toString()}`);

    // 4. Verimor API'sine GET İsteği Yap (Verimor endpoint'i GET bekliyor)
    const verimorResponse = await fetch(verimorApiUrl.toString(), {
      method: "GET",
      headers: { "Accept": "application/json" },
    });

    // 5. Verimor API Cevabını İşle
    const responseBody = await verimorResponse.text();
    console.log(`Verimor API Cevap Durumu: ${verimorResponse.status}`);

    if (!verimorResponse.ok) {
      console.error(`Verimor API Hatası (${verimorResponse.status}): ${responseBody}`);
      let clientErrorMessage = `Dahili durumları alınırken hata oluştu (${verimorResponse.status}).`;
      if (verimorResponse.status === 429) { clientErrorMessage = "API istek limiti aşıldı. Lütfen biraz bekleyin."; }
      else if (verimorResponse.status === 400 && responseBody.toLowerCase().includes("gecersiz anahtar")) { clientErrorMessage = "API Anahtarı geçersiz veya hatalı."; }
      return new Response(JSON.stringify({ error: clientErrorMessage }), { status: verimorResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Başarılı cevap
    try {
        const data = JSON.parse(responseBody);
        console.log("Dahili durumları başarıyla alındı.");
        return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
     } catch (parseError) {
         console.error("Verimor JSON cevabı parse edilirken hata:", parseError);
         return new Response(JSON.stringify({ error: "Verimor API'sinden geçersiz yanıt alındı." }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

  } catch (error) {
    console.error("!!! get-verimor-user-statuses içinde beklenmedik hata:", error);
    return new Response(JSON.stringify({ error: error.message || "İç Sunucu Hatası" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
