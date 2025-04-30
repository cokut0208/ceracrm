// supabase/functions/generate-contract-pdf/index.ts
// Sözleşme verilerini çeker, placeholder'ları değiştirir, PDF oluşturur, Storage'a yükler ve DB'yi günceller.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import puppeteer from 'https://deno.land/x/puppeteer@16.2.0/mod.ts'; // Puppeteer versiyonunu kontrol et/kilitle

// --- Helper Fonksiyonlar (Placeholder İşleme) ---

// Nested objelerden değer almak için
const getNestedValue = (obj: any, path: string): string => {
    if (!obj || !path) return '';
    const keys = path.split('.');
    let value = obj;
    try {
        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                // console.warn(`Placeholder path error: Key "${key}" not found in path "${path}"`);
                return ''; // Path bulunamadı veya null değer
            }
        }
        // Son değeri string'e çevir, null/undefined ise boş string yap
        return value !== null && value !== undefined ? String(value) : '';
    } catch (error) {
        console.error(`Error accessing path "${path}":`, error);
        return '';
    }
};

// Ana placeholder değiştirme fonksiyonu
const replacePlaceholders = (templateContent: string, customerData: any, projectData?: any): string => {
    if (!templateContent) return '';
    // Proje verisi null ise boş bir obje olarak ele alalım ki hata vermesin
    const safeProjectData = projectData || {};

    return templateContent.replace(/{{(.*?)}}/g, (match, placeholderPath) => {
        const path = placeholderPath.trim();
        let value = '';

        try {
            if (path.startsWith('customer.')) {
                value = getNestedValue(customerData, path.substring('customer.'.length));
            } else if (path.startsWith('project.')) {
                value = getNestedValue(safeProjectData, path.substring('project.'.length));
            } else if (path === 'date.today') {
                value = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }); // Daha okunaklı format
            } else if (path === 'datetime.now') {
                 value = new Date().toLocaleString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            }
            // Diğer özel placeholderlar eklenebilir (örn: {{user.name}})
        } catch (error) {
             console.error(`Error replacing placeholder {{${path}}}:`, error);
             value = `[Hata: ${path}]`; // Hata durumunda belirt
        }

        // Değer boşsa veya bulunamadıysa, placeholder'ı boşlukla değiştirmek yerine
        // belki bir uyarı metni ekleyebiliriz veya orijinal placeholder'ı bırakabiliriz.
        // Şimdilik boş string veya bulunan değeri dönelim.
        return value || ''; // Boş string döndürmek genellikle daha temiz olur
    });
};

// --- Ana Fonksiyon Mantığı ---

console.log('Function "generate-contract-pdf" initializing...');

serve(async (req: Request) => {
    // CORS Headers (Tarayıcıdan direkt çağrı için önemli)
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*', // Veya kendi domain'iniz: 'https://sizin-uygulama.com'
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS', // OPTIONS isteğini de handle et
    };

    // OPTIONS isteğini handle et (preflight)
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    let contractId: string | null = null;
    let supabaseAdmin: SupabaseClient | null = null;
    const storageBucketName = 'generated-contracts'; // !!! BUCKET ADINI KONTROL ET !!!

    try {
        const body = await req.json();
        contractId = body.contractId;

        if (!contractId) {
            throw new Error('Contract ID gereklidir.');
        }
        console.log(`Processing contract ID: ${contractId}`);

        // Admin client oluştur (Ortam değişkenleri ayarlı olmalı!)
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!supabaseUrl || !serviceRoleKey) {
            throw new Error('Supabase URL veya Service Role Key ortam değişkenleri ayarlanmamış.');
        }
        supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
             auth: {
                 // RLS'i tamamen bypass etmek için
                 autoRefreshToken: false,
                 persistSession: false
             }
         });
        console.log("Supabase admin client created.");

        // 1. Gerekli verileri çek (Sözleşme, Şablon, Müşteri, Proje)
        console.log("Fetching contract data...");
        const { data: contractData, error: contractError } = await supabaseAdmin
            .from('contracts')
            .select(`
                id, customer_id, project_id, template_id,
                template:contract_templates!inner(id, name, content),
                customer:customers!inner(*, responsible_personnel:personnel(id, name, surname)),
                project:projects(*, responsible_personnel:personnel(id, name, surname))
            `)
            .eq('id', contractId)
            .single();

        if (contractError) throw new Error(`Sözleşme verisi çekilemedi: ${contractError.message}`);
        if (!contractData) throw new Error(`Sözleşme bulunamadı: ${contractId}`);
        console.log("Contract data fetched successfully.");

        const { template, customer, project } = contractData; // project null olabilir
        if (!template || !customer) throw new Error("Şablon veya müşteri bilgisi eksik.");

        // 2. Placeholder'ları değiştir
        console.log("Replacing placeholders...");
        const populatedHtml = replacePlaceholders(template.content, customer, project);
        console.log("Placeholders replaced.");
        // console.log("Populated HTML:", populatedHtml); // Debug için HTML'i logla (hassas veri içerebilir!)

        // 3. PDF Oluşturma (Puppeteer)
        let pdfBuffer: Uint8Array | null = null;
        let browser = null;
        console.log('Starting PDF generation...');
        try {
             // Deno Deploy için gerekli olabilecek argümanlar
             const browserArgs = [
                 '--no-sandbox',
                 '--disable-setuid-sandbox',
                 '--disable-dev-shm-usage', // Daha küçük /tmp alanı için
                 '--disable-gpu', // GPU gerektirmez
                 '--headless', // Başsız mod
                 '--single-process' // Bazı ortamlarda yardımcı olabilir
             ];
             console.log(`Launching browser with args: ${browserArgs.join(' ')}`);
             browser = await puppeteer.launch({ args: browserArgs });
             console.log('Browser launched.');
             const page = await browser.newPage();
             console.log('Page created.');

             // İçeriği ayarla ve yüklenmesini bekle
             await page.setContent(populatedHtml, { waitUntil: 'networkidle0' });
             console.log('Content set on page.');

             // PDF oluştur
             pdfBuffer = await page.pdf({
                 format: 'A4',
                 printBackground: true,
                 margin: { top: '25mm', right: '20mm', bottom: '25mm', left: '20mm' } // Kenar boşlukları
                 // DisplayHeaderFooter, headerTemplate, footerTemplate gibi opsiyonlar eklenebilir
             });
             console.log(`PDF generated successfully (${pdfBuffer?.length} bytes).`);

        } catch (pdfError) {
             console.error("PDF generation error:", pdfError);
             throw new Error(`PDF oluşturulamadı: ${pdfError.message || pdfError}`);
        } finally {
              if (browser) {
                  console.log('Closing browser...');
                  await browser.close();
                  console.log('Browser closed.');
              }
        }

        if (!pdfBuffer) {
            throw new Error("PDF buffer oluşturulamadı (null).");
        }

        // 4. PDF'i Supabase Storage'a yükle
        const filePath = `contracts/${customer.id}/${contractId}_${Date.now()}.pdf`; // Daha benzersiz isim
        console.log(`Uploading PDF to Storage: ${storageBucketName}/${filePath}`);

        const { error: uploadError } = await supabaseAdmin.storage
            .from(storageBucketName)
            .upload(filePath, pdfBuffer, { contentType: 'application/pdf', upsert: true });

        if (uploadError) throw new Error(`PDF Storage'a yüklenemedi: ${uploadError.message}`);
        console.log("PDF uploaded successfully.");

        // 5. 'contracts' tablosunu güncelle
        console.log("Updating contract record in database...");
        const { error: updateError } = await supabaseAdmin
            .from('contracts')
            .update({ generated_file_path: filePath, status: 'generated_file' })
            .eq('id', contractId);

        if (updateError) {
            // Rollback: Storage'dan dosyayı silmeyi dene
            console.error("Contract record update failed, rolling back storage upload...");
            try { await supabaseAdmin.storage.from(storageBucketName).remove([filePath]); } catch(e){ console.error("Rollback remove failed:", e); }
            throw new Error(`Sözleşme kaydı güncellenemedi: ${updateError.message}`);
        }
        console.log("Contract record updated successfully.");

        // 6. Başarılı yanıtı döndür
        return new Response(JSON.stringify({ success: true, filePath: filePath }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (error) {
        console.error('Edge Function Execution Error:', error);
        // Hata durumunda da CORS headerlarını ekleyelim
        return new Response(JSON.stringify({ error: error.message || 'Bilinmeyen bir sunucu hatası oluştu.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
});

/*
 * Gerekli Ortam Değişkenleri (Supabase Proje Ayarları -> Edge Functions):
 * - SUPABASE_URL: Projenizin URL'si
 * - SUPABASE_SERVICE_ROLE_KEY: Projenizin Service Role Key'i (Dikkatli kullanın!)
 *
 * Gerekli Supabase Ayarları:
 * - 'generated_contracts' adında bir Storage Bucket oluşturun.
 * - Bucket için Erişim Politikaları ayarlayın:
 * - Edge Function'ın yazma (insert, update) izni olmalı (SERVICE_ROLE yeterli olur).
 * - Giriş yapmış kullanıcıların okuma (select) izni olmalı (indirme için). Örnek Policy:
 * - SELECT: `(bucket_id = 'generated_contracts') AND (storage.foldername(name))[1] = 'contracts' AND auth.uid() IS NOT NULL` (Sadece contracts klasöründekileri okuyabilir)
 * - INSERT/UPDATE/DELETE: (Hiçbiri veya sadece admin/fonksiyon)
 *
 * Deployment:
 * 1. Supabase CLI ile login olun: `supabase login`
 * 2. Fonksiyonu deploy edin: `supabase functions deploy generate-contract-pdf --no-verify-jwt`
 */