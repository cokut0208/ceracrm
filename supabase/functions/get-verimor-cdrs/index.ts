// supabase/functions/get-verimor-cdrs/index.ts
// supabase.functions.invoke ile çağrılacak şekilde güncellendi (POST kabul eder, body'den filtre okur)
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

// CORS Ayarları (invoke için gerekli başlıklar eklendi)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // Canlı ortamda uygulamanızın origin adresi ile değiştirin
  "Access-Control-Allow-Methods": "POST, OPTIONS", // Sadece POST ve OPTIONS kabul edilir
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info", // invoke tarafından gönderilen başlıklar
};

// Ortam Değişkenleri (Environment Variables)
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); // Admin yetkisi için
const verimorApiKey = Deno.env.get("VERIMOR_API_KEY"); // Verimor API Anahtarınız

// Gerekli ortam değişkenleri eksikse hata ver ve fonksiyonu durdur
if (!supabaseUrl || !supabaseServiceRoleKey || !verimorApiKey) {
  console.error("Gerekli ortam değişkenleri eksik: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VERIMOR_API_KEY");
  throw new Error("Sunucu yapılandırma hatası.");
}

// Supabase Admin Client (Fonksiyon içinde session tutulmaz)
const supabaseAdmin: SupabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false }
});

console.log("get-verimor-cdrs fonksiyonu başlatıldı (invoke uyumlu).");

// Ana server fonksiyonu
serve(async (req: Request) => {
  console.log(`---> İstek Alındı: ${req.method} ${req.url}`);

  // CORS preflight isteğini handle et
  if (req.method === "OPTIONS") {
    console.log("OPTIONS isteği işleniyor.");
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Sadece POST isteklerini kabul et
  if (req.method !== "POST") {
      console.warn(`İzin verilmeyen metot: ${req.method}`);
      return new Response(JSON.stringify({ error: "Metot izin verilmiyor, POST kullanın" }), {
        status: 405, // Method Not Allowed
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
  }

  try {
    // 1. Kullanıcıyı Doğrula (Authorization başlığından)
    // supabase.functions.invoke JWT'yi otomatik olarak doğrular ve gönderir,
    // ancak biz yine de manuel kontrol ekleyelim.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
       console.warn("Eksik veya geçersiz Authorization başlığı.");
       // 401 Unauthorized hatası döndür
       return new Response(JSON.stringify({ error: "Yetkisiz: Eksik token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userToken = authHeader.replace("Bearer ", "");
    // Kullanıcıyı doğrulamak için getUser kullan
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(userToken);

    // Doğrulama hatası veya kullanıcı bulunamazsa 401 döndür
    if (authError || !user) {
        console.error("Yetkilendirme Hatası veya kullanıcı bulunamadı:", authError?.message || "Kullanıcı yok");
        return new Response(JSON.stringify({ error: `Yetkisiz: ${authError?.message || "Geçersiz token"}` }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    console.log(`Kullanıcı doğrulandı: ${user.id}`);

    // 2. Filtreleri Request Body'den Al (JSON formatında)
    let filters: Record<string, any> = {}; // Filtreleri tutacak obje (Daha spesifik bir tip kullanılabilir)
    try {
        // Request body'sini JSON olarak parse et
        filters = await req.json();
        console.log("Body'den alınan filtreler:", filters);
    } catch (e) {
        // JSON parse hatası olursa 400 Bad Request döndür
        console.warn("JSON body parse edilemedi:", e.message);
        return new Response(JSON.stringify({ error: "Geçersiz istek body'si. JSON formatında filtreler bekleniyor." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. Verimor API URL'ini Oluştur ve Parametreleri Ekle
    const verimorApiUrl = new URL("https://api.bulutsantralim.com/cdrs");
    verimorApiUrl.searchParams.set("key", verimorApiKey); // API Anahtarı zorunlu

    // İzin verilen filtre anahtarları
    const allowedFilters = [
        "start_stamp_from", "start_stamp_to", "recording_present",
        "direction", "caller_id_number", "missed", "destination_number",
        "queue", "limit", "page"
    ];

    // Filtre objesindeki geçerli değerleri URL parametrelerine ekle
    allowedFilters.forEach(filterKey => {
        // Filtre değeri varsa, null/undefined değilse ve "ALL" değilse ekle
        if (filters[filterKey] !== undefined && filters[filterKey] !== null && filters[filterKey] !== "ALL" && filters[filterKey] !== '') {
            verimorApiUrl.searchParams.set(filterKey, String(filters[filterKey]));
        }
    });

     // Limit ve Page için varsayılan değerler (eğer body'de gelmezse)
    if (!verimorApiUrl.searchParams.has("limit")) {
        verimorApiUrl.searchParams.set("limit", filters.limit?.toString() || "25");
    }
    if (!verimorApiUrl.searchParams.has("page")) {
        verimorApiUrl.searchParams.set("page", filters.page?.toString() || "1");
    }

    console.log(`Verimor CDR API çağrılıyor (GET): ${verimorApiUrl.toString()}`);

    // 4. Verimor API'sine GET İsteği Yap
    const verimorResponse = await fetch(verimorApiUrl.toString(), {
      method: "GET",
      headers: { "Accept": "application/json" }, // JSON cevap bekliyoruz
    });

    // 5. Verimor API Cevabını İşle
    const responseBody = await verimorResponse.text(); // Hata durumunda JSON olmayabilir, önce text oku
    console.log(`Verimor API Cevap Durumu: ${verimorResponse.status}`);

    // İstek başarısızsa hata döndür
    if (!verimorResponse.ok) {
      console.error(`Verimor API Hatası (${verimorResponse.status}): ${responseBody}`);
      let clientErrorMessage = `CDR alınırken hata oluştu (${verimorResponse.status}).`;
      if (verimorResponse.status === 400 && responseBody.toLowerCase().includes("gecersiz anahtar")) {
          clientErrorMessage = "API Anahtarı geçersiz veya hatalı.";
      }
      // Hata mesajını doğrudan client'a göndermek yerine loglamak daha güvenli
      return new Response(JSON.stringify({ error: clientErrorMessage }), {
        status: verimorResponse.status >= 500 ? 502 : verimorResponse.status, // 5xx -> 502 Bad Gateway
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Başarılı cevap: JSON olarak parse etmeyi dene
    try {
        const data = JSON.parse(responseBody);
        console.log("CDR'lar başarıyla alındı.");
        // 6. Veriyi Frontend'e Gönder
        return new Response(JSON.stringify(data), {
          status: 200, // OK
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (parseError) {
         // JSON parse hatası olursa 502 Bad Gateway döndür
         console.error("Verimor JSON cevabı parse edilirken hata:", parseError);
         return new Response(JSON.stringify({ error: "Verimor API'sinden geçersiz yanıt alındı." }), {
             status: 502,
             headers: { ...corsHeaders, "Content-Type": "application/json" },
         });
    }

  } catch (error) {
    // Beklenmedik genel hataları yakala ve 500 Internal Server Error döndür
    console.error("!!! get-verimor-cdrs içinde beklenmedik hata:", error);
    return new Response(JSON.stringify({ error: error.message || "İç Sunucu Hatası" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
