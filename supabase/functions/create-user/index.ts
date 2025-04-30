// supabase/functions/create-user/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Gerekli Environment Variable'ları kontrol et
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  console.error("SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY environment variable'ları ayarlanmalı.");
  // Uygulama başlatılırken hata fırlatmak yerine, istek geldiğinde hata dönebiliriz.
}

console.log('create-user function started.');

Deno.serve(async (req) => {
  console.log(`Request received: ${req.method}`);

  // CORS Preflight isteğini handle et
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    return new Response('ok', { headers: corsHeaders });
  }

  // Environment variable kontrolünü burada yapalım ki her istekte kontrol edilsin
  if (!supabaseUrl || !serviceRoleKey) {
     console.error("Supabase URL veya Service Role Key eksik!");
     return new Response(JSON.stringify({ error: "Sunucu yapılandırma hatası." }), {
       headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       status: 500,
     });
   }

  try {
    // İstek gövdesini al
    const body = await req.json();
    console.log('Request body:', body);
    const { email, password, name, surname, verimor_extension, roles } = body;

    // Gerekli alanları kontrol et
    if (!email || !password || !name || !surname || !verimor_extension || !roles) {
        throw new Error('Eksik bilgi gönderildi.');
    }

    // Admin client oluştur (Service Role Key ile)
    // Dikkat: Bu client tüm RLS kurallarını bypass eder! Sadece güvenli backend ortamında kullanılmalı.
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            // autoRefreshToken ve persistSession client tarafı içindir, admin client'ta false olmalı
            autoRefreshToken: false,
            persistSession: false
        }
    });
    console.log('Supabase admin client created.');

    // --- İşlem Adımları ---

    // 1. Auth kullanıcısını oluştur
    console.log(`Creating auth user for ${email}...`);
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Kullanıcının emailini doğrulaması gereksin (isteğe bağlı)
      // user_metadata: { name: name, surname: surname } // Auth metadata'sına da ekleyebilirsin
    });

    if (authError) {
      console.error('Auth user creation error:', authError);
      throw new Error(`Auth kullanıcısı oluşturulamadı: ${authError.message}`);
    }
    const userId = authData.user.id;
    console.log(`Auth user created successfully: ${userId}`);

    // 2. Personnel kaydını oluştur
    console.log(`Creating personnel record for user ${userId}...`);
    const { data: personnelData, error: personnelError } = await supabaseAdmin
      .from('personnel')
      .insert({
        user_id: userId,
        name: name,
        surname: surname,
        email: email, // Personnel tablosunda da email tutuyorsan
        verimor_extension: verimor_extension,
        // created_at otomatik oluşmuyorsa: created_at: new Date().toISOString()
      })
      .select('id') // Yeni personelin ID'sini al
      .single(); // Tek bir kayıt eklendiğinden emin ol

    if (personnelError) {
      console.error('Personnel record creation error:', personnelError);
      // Opsiyonel: Eğer personel eklenemezse oluşturulan auth kullanıcısını silmek isteyebilirsin
      // await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(`Personel kaydı oluşturulamadı: ${personnelError.message}`);
    }
    const personnelId = personnelData.id;
    console.log(`Personnel record created successfully: ${personnelId}`);

    // 3. Rolleri ata (personnel_roles)
    if (roles && Array.isArray(roles) && roles.length > 0) {
      console.log(`Assigning roles for personnel ${personnelId}:`, roles);
       const roleInserts = roles.map((roleId: number | string) => ({ // Gelen ID number mı string mi kontrol et
         personnel_id: personnelId,
         role_id: parseInt(String(roleId), 10) // ID'nin integer olduğundan emin ol
       }));

       const { error: rolesError } = await supabaseAdmin
         .from('personnel_roles')
         .insert(roleInserts);

       if (rolesError) {
         console.error('Role assignment error:', rolesError);
         // Opsiyonel: Roller atanamazsa kullanıcıyı ve personel kaydını silmek isteyebilirsin
         // await supabaseAdmin.from('personnel').delete().eq('id', personnelId);
         // await supabaseAdmin.auth.admin.deleteUser(userId);
         throw new Error(`Roller atanamadı: ${rolesError.message}`);
       }
       console.log('Roles assigned successfully.');
    } else {
        console.log('No roles provided to assign.');
    }

    // Başarılı yanıt
    console.log('User creation process completed successfully.');
    return new Response(JSON.stringify({ message: 'Personel başarıyla oluşturuldu', userId, personnelId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    // Hata yanıtı
    console.error("Error in create-user function:", error);
    return new Response(JSON.stringify({ error: error.message || 'Bilinmeyen bir sunucu hatası oluştu.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400, // Veya hatanın türüne göre 500
    });
  }
});

// Not: /supabase/functions/_shared/cors.ts dosyasını oluşturup gerekli CORS başlıklarını tanımlaman gerekebilir.
// Örnek cors.ts:
/*
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Veya spesifik domain: 'http://localhost:3000'
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
*/