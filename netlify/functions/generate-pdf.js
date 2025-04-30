// netlify/functions/generate-pdf.js
const puppeteer = require('puppeteer-core');
const chrome = require('@sparticuz/chrome-aws-lambda'); // Paketin adını değiştiriyoruz
const { createClient } = require('@supabase/supabase-js');

// Supabase bağlantı bilgileri - Bunları Netlify Environment Variables'dan alacağız
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // YİNE SERVICE KEY! Gizli tut.

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Netlify fonksiyonları bu 'handler' fonksiyonunu çalıştırır
exports.handler = async (event, context) => {
    // Sadece POST isteklerini kabul et (Netlify'da event.httpMethod kullanılır)
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: 'Method Not Allowed',
            headers: { 'Allow': 'POST' }
        };
    }

    let browser = null;

    try {
        console.log("Netlify function received request...");

        // İstek body'sini al (Netlify'da event.body string'dir, parse etmek gerekir)
        const body = JSON.parse(event.body || '{}'); // Boş gelme ihtimaline karşı {}
        const { htmlContent, contractId, customerId } = body;

        // Gerekli veriler geldi mi kontrol et
        if (!htmlContent || !contractId || !customerId) {
            console.error("Missing required data in request body");
            return {
                statusCode: 400,
                body: JSON.stringify({ success: false, error: 'Missing required data: htmlContent, contractId, customerId' })
            };
        }

        console.log(`Processing contractId: ${contractId} for customerId: ${customerId}`);

        // Puppeteer'ı serverless için optimize edilmiş ayarlarla başlat
        console.log("Launching Puppeteer...");
        browser = await puppeteer.launch({
            args: chrome.args,
            executablePath: await chrome.executablePath || process.env.CHROME_EXECUTABLE_PATH,
            headless: chrome.headless,
            ignoreHTTPSErrors: true,
        });
        console.log("Puppeteer launched successfully.");

        const page = await browser.newPage();
        console.log("Setting HTML content...");
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        console.log("HTML content set.");

        console.log("Generating PDF buffer...");
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, /* ...diğer margin ayarları... */ });
        console.log(`PDF buffer generated (size: ${pdfBuffer.length} bytes).`);

        await browser.close(); // Tarayıcıyı hemen kapat, işi bitti
        browser = null; // Kapandığını işaretle

        const filePath = `contracts/<span class="math-inline">\{customerId\}/</span>{contractId}_${Date.now()}.pdf`;
        const storageBucketName = 'generated-contracts';

        console.log(`Uploading PDF to Supabase Storage: <span class="math-inline">\{storageBucketName\}/</span>{filePath}`);
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
            .from(storageBucketName)
            .upload(filePath, pdfBuffer, { contentType: 'application/pdf', upsert: true });

        if (uploadError) {
            console.error("Supabase Storage upload error:", uploadError);
            throw new Error(`Failed to upload PDF to Storage: ${uploadError.message}`);
        }
        console.log("PDF uploaded successfully to Supabase Storage.");

        // Başarılı yanıtı döndür
        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, filePath: filePath }) // JSON string olarak dönülmeli
        };

    } catch (error) {
        console.error('Error in Netlify function:', error);
        if (browser) await browser.close(); // Hata olursa da tarayıcıyı kapatmayı dene
        // Hata durumunda 500 ve hata mesajını döndür
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, error: error.message || 'An unknown error occurred' })
        };
    }
};