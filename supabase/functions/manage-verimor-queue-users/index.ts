// supabase/functions/manage-verimor-queue-users/index.ts
// Kuyruğa dahili ekler/çıkarır/sıralar (invoke uyumlu - POST)
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

console.log("manage-verimor-queue-users fonksiyonu başlatıldı (POST kabul eder).");

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
    // 1. Kullanıcıyı Doğrula (Admin yetkisi kontrolü eklenebilir)
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
    // İsteğe bağlı: Sadece admin rolündeki kullanıcıların bu işlemi yapmasını sağla
    // const { data: rolesData, error: rolesError } = await supabaseAdmin.rpc('get_user_roles', { user_id_param: user.id });
    // if (rolesError || !rolesData?.includes('admin')) {
    //    console.warn(`Kullanıcı ${user.id} admin yetkisine sahip değil.`);
    //    return new Response(JSON.stringify({ error: "Bu işlem için yetkiniz yok." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    // }

    // 2. queue_number ve user_list'i Request Body'den Al (JSON)
    let queueNumber: string | undefined;
    let userList: string | undefined; // Virgülle ayrılmış string
    try {
        const body = await req.json();
        queueNumber = body.queue_number;
        userList = body.user_list; // Frontend'den virgülle ayrılmış string olarak gelmeli
         if (!queueNumber || userList === undefined || userList === null) { // user_list boş olabilir (kuyruğu boşaltmak için)
             throw new Error("Request body içinde 'queue_number' veya 'user_list' eksik");
         }
    } catch (e) {
         console.warn("JSON body parse edilemedi veya gerekli alanlar eksik:", e.message);
         return new Response(JSON.stringify({ error: "Geçersiz istek body'si. JSON formatında 'queue_number' ve 'user_list' bekleniyor." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    console.log(`Kuyruk yönetiliyor: queue_number: ${queueNumber}, user_list: ${userList}`);


    // 3. Verimor API URL'ini Oluştur
    const verimorApiUrl = new URL("https://api.bulutsantralim.com/queue/manage_users");
    verimorApiUrl.searchParams.set("key", verimorApiKey);
    verimorApiUrl.searchParams.set("queue_number", queueNumber);
    verimorApiUrl.searchParams.set("user_list", userList); // Virgülle ayrılmış liste

    console.log(`Verimor Manage Queue Users API çağrılıyor (GET): ${verimorApiUrl.toString()}`);

    // 4. Verimor API'sine GET İsteği Yap (Dokümantasyona göre GET)
    const verimorResponse = await fetch(verimorApiUrl.toString(), {
      method: "GET", // Dokümantasyon GET diyor!
      headers: { "Accept": "*/*" }, // Dokümantasyon * /* diyor
    });

    // 5. Verimor API Cevabını İşle
    const responseBody = await verimorResponse.text(); // Başarılı cevap "OK" metni
    console.log(`Verimor API Cevap Durumu: ${verimorResponse.status}`);
    console.log(`Verimor API Cevap Body: ${responseBody}`);

    if (!verimorResponse.ok || responseBody.trim().toUpperCase() !== 'OK') {
      console.error(`Verimor API Hatası (${verimorResponse.status}): ${responseBody}`);
      let clientErrorMessage = `Kuyruk güncellenirken hata oluştu (${verimorResponse.status}).`;
       if (verimorResponse.status === 400) {
            if (responseBody.toLowerCase().includes("gecersiz anahtar")) clientErrorMessage = "API Anahtarı geçersiz veya hatalı.";
            else if (responseBody.toLowerCase().includes("queue_number value null")) clientErrorMessage = "Geçersiz veya eksik kuyruk numarası.";
            else if (responseBody.toLowerCase().includes("user_list value null")) clientErrorMessage = "Geçersiz veya eksik dahili listesi.";
            else if (responseBody.toLowerCase().includes("user value null")) clientErrorMessage = "Listede geçersiz dahili numarası var.";
            else clientErrorMessage = `Verimor Hatası: ${responseBody}`;
       } else if (verimorResponse.status === 429) {
            clientErrorMessage = "API istek limiti aşıldı (Dakikada 10 istek). Lütfen biraz bekleyin.";
       }
      return new Response(JSON.stringify({ error: clientErrorMessage }), {
        status: verimorResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Başarılı cevap ("OK")
    console.log(`Kuyruk (${queueNumber}) başarıyla güncellendi.`);
    return new Response(JSON.stringify({ success: true, message: "Kuyruk başarıyla güncellendi." }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("!!! manage-verimor-queue-users içinde beklenmedik hata:", error);
    return new Response(JSON.stringify({ error: error.message || "İç Sunucu Hatası" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
