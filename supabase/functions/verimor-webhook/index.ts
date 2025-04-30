// Supabase Edge Function: supabase/functions/verimor-webhook/index.ts
// Verimor olay bildirimlerini (ringing, answer, hangup) işler ve call_logs tablosunu günceller.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

// CORS Ayarları (Geliştirme için *, canlıda kısıtlayın)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization", // Gerekirse ek başlıklar
};

// Supabase Konfigürasyonu (Environment Variables'dan okunur)
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); // Admin Key!

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase URL or Service Role Key is missing!");
  // Fonksiyonun başlamasını engellemek iyi olabilir
  throw new Error("Missing Supabase environment variables.");
}

// Supabase Admin Client (Edge Function içinde session tutulmaz)
const supabaseAdmin: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  }
});

console.log("Verimor Webhook Handler Initialized.");

// Ana Server Fonksiyonu
serve(async (req: Request) => {
  console.log(`---> Request Received: ${req.method} ${req.url}`);

  // CORS preflight isteği
  if (req.method === "OPTIONS") {
    console.log("Handling OPTIONS request.");
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Sadece POST metodu kabul edilir
    if (req.method !== "POST") {
      console.warn(`Method Not Allowed: ${req.method}`);
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // İçerik tipini kontrol et (Verimor form data gönderir)
    const contentType = req.headers.get("content-type");
    console.log(`Content-Type: ${contentType}`);
    // if (!contentType || !contentType.includes("application/x-www-form-urlencoded")) {
    //   console.warn("Unexpected Content-Type, attempting to parse as form data anyway.");
    // }

    // Form verisini parse et
    const formData = await req.formData();
    const data: Record<string, any> = {};
    let hasData = false;
    for (const [key, value] of formData.entries()) {
      data[key] = value;
      hasData = true;
    }
    console.log("Parsed Form Data:", data);

    // Verimor URL doğrulama testi veya boş istek kontrolü
    if (!hasData || !data.event_type) {
      console.log("Request has no data or event_type. Likely a validation test or invalid request. Responding OK.");
      return new Response(JSON.stringify({ success: true, message: "Webhook received (no event processed)." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Olay tipine göre yönlendir
    const eventType = data.event_type;
    console.log(`Processing event_type: ${eventType}`);

    switch (eventType) {
      case "ringing":
        await handleRinging(data, supabaseAdmin);
        break;
      case "answer":
        await handleAnswer(data, supabaseAdmin);
        break;
      case "hangup":
      case "user_hangup": // İkisi de çağrı sonlanması, aynı şekilde işlenebilir
        await handleHangup(data, supabaseAdmin);
        break;
      default:
        console.log(`Unhandled event_type: ${eventType}`);
        // Bilinmeyen olaylar için de başarılı dönmek, Verimor'un tekrar denemesini engeller
    }

    console.log(`Event ${eventType} processed successfully.`);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("!!! Error processing webhook:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500, // Hata durumunda 500 dön
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// --- Olay İşleyici Fonksiyonlar ---

/**
 * `ringing` olayını işler: Yeni çağrı geldiğinde tetiklenir.
 * call_logs tablosuna yeni bir kayıt ekler veya mevcut kaydı günceller.
 */
async function handleRinging(data: Record<string, any>, supabase: SupabaseClient) {
  const callUuid = data.call_uuid;
  if (!callUuid) throw new Error("[Ringing] Missing call_uuid");

  console.log(`[Ringing] Processing call: ${callUuid}`);

  const direction = data.direction || null;
  const callerIdNumber = data.caller_id_number || null;
  const destinationNumber = data.destination_number || null;
  const dialedUser = data.dialed_user || null; // Aranan dahili (varsa)

  // İlişkili kayıtları bul
  const relatedCustomerId = await findRelatedCustomerId(callerIdNumber, destinationNumber, direction, supabase);
  const relatedPersonnelId = await findRelatedPersonnelId(callerIdNumber, destinationNumber, direction, dialedUser, supabase); // dialedUser'a göre personel ara

  const insertData = {
    call_uuid: callUuid,
    direction: direction,
    caller_id_number: callerIdNumber,
    caller_id_name: data.caller_id_name || null, // Verimor gönderiyorsa
    destination_number: destinationNumber,
    // destination_name: null, // Verimor'dan gelmiyor, şimdilik null
    start_stamp: data.start_stamp ? new Date(data.start_stamp).toISOString() : null,
    answered: false, // Başlangıçta false
    missed: null, // Henüz belli değil
    related_customer_id: relatedCustomerId,
    related_personnel_id: relatedPersonnelId, // Aranan/Hedeflenen personele göre
    // Diğer alanlar varsayılan veya null olacak
  };

  console.log(`[Ringing] Upserting data for ${callUuid}:`, insertData);
  const { error } = await supabase
    .from("call_logs")
    .upsert(insertData, { onConflict: "call_uuid" }); // UUID varsa güncelle, yoksa ekle

  if (error) {
    console.error(`[Ringing] Error upserting call log for ${callUuid}:`, error);
    throw new Error(`[Ringing] DB Upsert failed: ${error.message}`);
  }
  console.log(`[Ringing] Upsert successful for ${callUuid}`);
}

/**
 * `answer` olayını işler: Çağrı cevaplandığında tetiklenir.
 * İlgili call_logs kaydını günceller.
 */
async function handleAnswer(data: Record<string, any>, supabase: SupabaseClient) {
  const callUuid = data.call_uuid;
  if (!callUuid) throw new Error("[Answer] Missing call_uuid");

  console.log(`[Answer] Processing call: ${callUuid}`);

  const connectedUser = data.connected_user || null; // Cevaplayan dahili

  // Cevaplayan personele göre ID bul (eğer ringing'deki dialed_user'dan farklıysa önemli)
  const relatedPersonnelId = await findRelatedPersonnelId(data.caller_id_number, data.destination_number, data.direction, connectedUser, supabase);

  const updateData = {
    answer_stamp: data.answer_stamp ? new Date(data.answer_stamp).toISOString() : null,
    answered: true, // Cevaplandı
    missed: false, // Kaçan çağrı değil
    // Sadece cevaplayan personel ID'sini güncellemek daha doğru olabilir
    // Eğer ringing'de bulunan personel ile aynıysa tekrar güncellemeye gerek yok.
    // Bu yüzden bu alanı sadece ID değiştiyse güncellemek daha mantıklı olabilir.
    // Şimdilik her durumda güncelleyelim:
    related_personnel_id: relatedPersonnelId,
    connected_user: connectedUser, // DB'de bu alan varsa ekleyin (şemada yoktu)
  };

  console.log(`[Answer] Updating data for ${callUuid}:`, updateData);
  const { error } = await supabase
    .from("call_logs")
    .update(updateData)
    .eq("call_uuid", callUuid);

  if (error) {
    // Önemli: Eğer ringing olayı hiç gelmediyse veya DB'de kayıt yoksa bu update hata verebilir.
    // Bu durumu loglayıp devam etmek genellikle daha iyidir, hangup olayı durumu toparlayabilir.
    console.error(`[Answer] Error updating call log for ${callUuid}:`, error);
    // throw new Error(`[Answer] DB Update failed: ${error.message}`);
  } else {
    console.log(`[Answer] Update successful for ${callUuid}`);
  }
}

/**
 * `hangup` veya `user_hangup` olayını işler: Çağrı sonlandığında tetiklenir.
 * İlgili call_logs kaydını son bilgilerle günceller.
 */
async function handleHangup(data: Record<string, any>, supabase: SupabaseClient) {
  const callUuid = data.call_uuid;
  if (!callUuid) throw new Error("[Hangup] Missing call_uuid");

  console.log(`[Hangup] Processing call: ${callUuid}`);

  // String boolean'ları gerçek boolean'a çevir
  const answered = data.answered === 'true';
  const recordingPresent = data.recording_present === 'true';

  // Süreleri string'den integer saniyeye çevir (DB 'interval' kabul etse de integer göndermek daha güvenli)
  const parseDuration = (durationStr: string | null | undefined): number | null => {
    if (durationStr === null || durationStr === undefined || durationStr === '') return null;
    const seconds = parseInt(durationStr, 10);
    return isNaN(seconds) ? null : seconds;
  };

  const durationSeconds = parseDuration(data.duration); // Toplam süre (çalma+konuşma)
  const queueWaitDurationSeconds = parseDuration(data.queue_wait_duration); // Kuyrukta bekleme
  // talk_duration Verimor dokümanında yok, ama varsa alalım. Yoksa, cevaplandıysa duration, değilse 0 olabilir.
  const talkDurationSeconds = parseDuration(data.talk_duration) ?? (answered ? durationSeconds : 0);

  // Kaçan çağrı durumunu belirle
  const missedCall = !answered;

  const updateData = {
    end_stamp: data.end_stamp ? new Date(data.end_stamp).toISOString() : null,
    // Süreleri saniye (integer) olarak gönderiyoruz, DB'nin interval'e çevirmesi beklenir
    // VEYA DB şemasını integer'a çevirebilirsiniz.
    duration: durationSeconds !== null ? `${durationSeconds} seconds` : null, // Interval formatına uygun string
    talk_duration: talkDurationSeconds !== null ? `${talkDurationSeconds} seconds` : null, // Interval formatına uygun string
    queue_wait_duration: queueWaitDurationSeconds !== null ? `${queueWaitDurationSeconds} seconds` : null, // Interval formatına uygun string
    answered: answered, // Hesaplanan boolean değer
    missed: missedCall, // Hesaplanan boolean değer
    recording_present: recordingPresent, // Hesaplanan boolean değer
    hangup_cause: data.hangup_cause || null,
    sip_hangup_disposition: data.sip_hangup_disposition || null, // 'caller' veya 'callee'
    queue: data.queue || null, // Kuyruk/Grup numarası
    result: data.result || null, // Verimor'dan geliyorsa (dokümanda yoktu ama kodunuzda vardı)
    failure_status: data.failure_status || null, // Başarısızlık durumu
    failure_phrase: data.failure_phrase || null, // Başarısızlık mesajı
    // `recording_url_temp` alanı Verimor'dan bu event ile geliyorsa buraya eklenmeli.
    // Genellikle kayıt URL'si ayrı bir event veya API çağrısı ile alınır.
    // recording_url_temp: data.recording_url || null,
  };

  console.log(`[Hangup] Updating data for ${callUuid}:`, updateData);
  const { error } = await supabase
    .from("call_logs")
    .update(updateData)
    .eq("call_uuid", callUuid);

  if (error) {
    console.error(`[Hangup] Error updating call log for ${callUuid}:`, error);
    // Hangup kritik, hata durumunda loglamak önemli
    // throw new Error(`[Hangup] DB Update failed: ${error.message}`);
  } else {
    console.log(`[Hangup] Update successful for ${callUuid}`);
  }
}


// --- Yardımcı Fonksiyonlar ---

/**
 * Verilen numaralara ve çağrı yönüne göre ilgili müşteri ID'sini bulur.
 */
async function findRelatedCustomerId(callerNumber: string | null, destinationNumber: string | null, direction: string | null, supabase: SupabaseClient): Promise<string | null> {
  const searchNumber = direction === "inbound" ? callerNumber : destinationNumber;
  if (!searchNumber) {
    // console.log("[FindCustomer] No number to search.");
    return null;
  }

  try {
    // 1. customers.phone ile eşleşme
    const { data: customer, error: customerErr } = await supabase
      .from("customers")
      .select("id")
      .eq("phone", searchNumber)
      .maybeSingle();

    if (customerErr) console.error("[FindCustomer] Error searching customers:", customerErr.message);
    if (customer) {
      console.log(`[FindCustomer] Found direct match in customers: ${customer.id} for ${searchNumber}`);
      return customer.id;
    }

    // 2. customer_contacts.phone ile eşleşme
    const { data: contact, error: contactErr } = await supabase
      .from("customer_contacts")
      .select("customer_id")
      .eq("phone", searchNumber)
      .maybeSingle();

    if (contactErr) console.error("[FindCustomer] Error searching customer_contacts:", contactErr.message);
    if (contact) {
      console.log(`[FindCustomer] Found match in contacts: ${contact.customer_id} for ${searchNumber}`);
      return contact.customer_id;
    }

  } catch (e) {
    console.error("[FindCustomer] Exception:", e);
  }

  // console.log(`[FindCustomer] No match found for ${searchNumber}`);
  return null;
}

/**
 * Verilen dahili numaraya (veya yön/numaralara) göre ilgili personel ID'sini bulur.
 */
async function findRelatedPersonnelId(callerNumber: string | null, destinationNumber: string | null, direction: string | null, relevantUser: string | null, supabase: SupabaseClient): Promise<string | null> {
  let searchExtension: string | null = null;

  // Öncelik her zaman olaydaki `dialed_user` veya `connected_user`'a verilir
  if (relevantUser) {
    searchExtension = relevantUser;
  } else {
    // Yoksa, direction'a göre mantıklı olan numarayı kullan
    // Inbound -> Hedef numara (genellikle dahili)
    // Outbound -> Arayan numara (genellikle dahili)
    // Internal -> İkisi de olabilir, hangisi daha çok dahiliye benziyorsa? Şimdilik inbound gibi davranalım.
    searchExtension = (direction === "inbound" || direction === "internal") ? destinationNumber : (direction === 'outbound' ? callerNumber : null);
  }

  if (!searchExtension) {
    // console.log("[FindPersonnel] No extension to search.");
    return null;
  }

  try {
    // personnel.verimor_extension ile eşleşme
    const { data: personnel, error: personnelErr } = await supabase
      .from("personnel")
      .select("id")
      .eq("verimor_extension", searchExtension) // Şemanızdaki kolon adı
      .maybeSingle();

    if (personnelErr) console.error("[FindPersonnel] Error searching personnel:", personnelErr.message);
    if (personnel) {
      console.log(`[FindPersonnel] Found match: ${personnel.id} for extension ${searchExtension}`);
      return personnel.id;
    }

  } catch (e) {
    console.error("[FindPersonnel] Exception:", e);
  }

  // console.log(`[FindPersonnel] No match found for extension ${searchExtension}`);
  return null;
}
