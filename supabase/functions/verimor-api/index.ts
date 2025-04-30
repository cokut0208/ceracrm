import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.7";
import ky from "npm:ky@0.33.3";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    }
  }
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
      status: 204,
    });
  }

  try {
    // Get the URL path components
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(part => part !== '');
    const action = pathParts[pathParts.length - 1];

    // Make sure we have a valid authorization header
    const authorization = req.headers.get('Authorization')?.split('Bearer ')[1];
    if (!authorization) {
      return new Response(
        JSON.stringify({ error: 'Yetkilendirme başarısız' }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }

    // Get the user from the authorization token
    const { data: { user: authUser } } = await supabaseAdmin.auth.getUser(authorization);
    if (!authUser) {
      return new Response(
        JSON.stringify({ error: 'Geçersiz kullanıcı' }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }

    // Get Verimor configuration
    const { data: verimorConfig, error: configError } = await supabaseAdmin
      .from('verimor_config')
      .select('*')
      .limit(1)
      .single();

    if (configError || !verimorConfig) {
      return new Response(
        JSON.stringify({ error: 'Verimor yapılandırması bulunamadı' }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    // Get the user's extension number and SIP password
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('extension_number, sip_password')
      .eq('id', authUser.id)
      .single();

    if (userError || !userData.extension_number) {
      return new Response(
        JSON.stringify({ error: 'Kullanıcı dahili numarası bulunamadı' }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Parse request body if present
    let requestBody = {};
    if (req.method === "POST") {
      requestBody = await req.json();
    }

    // Process based on action type
    switch (action) {
      case 'initializeWebPhone': {
        // Create a response with credentials for the WebPhone
        return new Response(
          JSON.stringify({
            sipUrl: `sip:${userData.extension_number}@cerabilgi.bulutsantralim.com`,
            username: userData.extension_number,
            password: userData.sip_password || verimorConfig.api_key, // Use SIP password or API key as fallback
            server: "cerabilgi.bulutsantralim.com", // Doğru SIP sunucu adı
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }

      case 'originate': {
        // Validate request body
        const { to } = requestBody as { to: string };
        if (!to) {
          return new Response(
            JSON.stringify({ error: 'Aranacak numara belirtilmedi' }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 400,
            }
          );
        }

        // Call Verimor API to originate a call
        try {
          const response = await ky.post(`${verimorConfig.pbx_url}/originate`, {
            json: {
              auth_username: verimorConfig.api_key,
              auth_password: verimorConfig.api_secret,
              caller: userData.extension_number,
              callee: to,
              auto_answer: true,
            },
            timeout: 10000,
          }).json();

          // Record the call in our database
          const now = new Date().toISOString();
          const { data: callRecord, error: callRecordError } = await supabaseAdmin
            .from('call_records')
            .insert({
              direction: 'outgoing',
              from: userData.extension_number,
              to: to,
              duration: 0,
              status: 'answered', // Initial status
              user_id: authUser.id,
              start_time: now,
              end_time: now, // Will be updated later
            })
            .select()
            .single();

          if (callRecordError) {
            console.error("Çağrı kaydı oluşturulurken hata:", callRecordError);
          }

          return new Response(
            JSON.stringify({
              success: true,
              callId: callRecord?.id || response.uuid || "unknown",
              callRecord,
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            }
          );
        } catch (error) {
          console.error("Verimor API çağrısı sırasında hata:", error);
          return new Response(
            JSON.stringify({ 
              error: 'Çağrı başlatılırken bir hata oluştu',
              details: error.message 
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 500,
            }
          );
        }
      }

      case 'call-history': {
        // Get query parameters
        const limit = parseInt(url.searchParams.get('limit') || '100');
        const page = parseInt(url.searchParams.get('page') || '1');
        const direction = url.searchParams.get('direction');
        const status = url.searchParams.get('status');
        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');
        const userId = url.searchParams.get('userId') || authUser.id;

        // Calculate pagination
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        // Build the query
        let query = supabaseAdmin
          .from('call_records')
          .select('*', { count: 'exact' })
          .eq('user_id', userId)
          .order('start_time', { ascending: false })
          .range(from, to);

        if (direction) {
          query = query.eq('direction', direction);
        }

        if (status) {
          query = query.eq('status', status);
        }

        if (startDate) {
          query = query.gte('start_time', startDate);
        }

        if (endDate) {
          query = query.lte('start_time', endDate);
        }

        // Execute the query
        const { data: calls, error: callsError, count } = await query;

        if (callsError) {
          return new Response(
            JSON.stringify({ error: 'Çağrı geçmişi alınırken bir hata oluştu' }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 500,
            }
          );
        }

        return new Response(
          JSON.stringify({
            calls,
            total: count || 0,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }
      
      case 'call-recording': {
        // Get the call ID from the URL
        const callId = pathParts[pathParts.length - 2]; // Assuming URL is like /verimor-api/call-recording/:id
        
        if (!callId) {
          return new Response(
            JSON.stringify({ error: 'Çağrı ID belirtilmedi' }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 400,
            }
          );
        }
        
        // Get the recording URL
        const { data: callRecord, error: callError } = await supabaseAdmin
          .from('call_records')
          .select('recording_url, user_id')
          .eq('id', callId)
          .single();
          
        if (callError) {
          return new Response(
            JSON.stringify({ error: 'Çağrı kaydı bulunamadı' }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 404,
            }
          );
        }
        
        // Check if the user has permission to access this recording
        if (callRecord.user_id !== authUser.id) {
          const { data: userData } = await supabaseAdmin
            .from('users')
            .select('role')
            .eq('id', authUser.id)
            .single();
            
          // If not the owner and not admin, deny access
          if (!userData || userData.role !== 'admin') {
            return new Response(
              JSON.stringify({ error: 'Bu çağrı kaydını görüntüleme yetkiniz yok' }),
              {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 403,
              }
            );
          }
        }
        
        if (!callRecord.recording_url) {
          return new Response(
            JSON.stringify({ error: 'Bu çağrı için ses kaydı bulunamadı' }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 404,
            }
          );
        }
        
        // Return the recording URL
        return new Response(
          JSON.stringify({
            recordingUrl: callRecord.recording_url,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Geçersiz işlem' }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          }
        );
    }
  } catch (error) {
    console.error("Verimor API hatası:", error);
    return new Response(
      JSON.stringify({ error: `Beklenmeyen hata: ${error.message}` }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});