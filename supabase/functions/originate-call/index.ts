// Function to originate calls using Verimor API
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Create a Supabase client with the Auth key
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const verimorApiKey = Deno.env.get("VERIMOR_API_KEY") || "";

const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing Authorization header");
    }

    // Validate user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse query parameters or JSON body to get extension and destination
    let extension: string;
    let destination: string;
    
    if (req.method === "GET") {
      const url = new URL(req.url);
      extension = url.searchParams.get("extension") || "";
      destination = url.searchParams.get("destination") || "";
      
      if (!extension || !destination) {
        throw new Error("Missing extension or destination parameter");
      }
    } else if (req.method === "POST") {
      const body = await req.json();
      extension = body.extension;
      destination = body.destination;
      
      if (!extension || !destination) {
        throw new Error("Missing extension or destination in request body");
      }
    } else {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Format destination number (remove spaces, etc.)
    destination = destination.replace(/\s+/g, "");
    
    // Call Verimor API to originate call
    const verimorResponse = await fetch("https://api.verimor.com.tr/v2/originate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${verimorApiKey}`
      },
      body: JSON.stringify({
        caller: extension,
        callee: destination,
        auto_answer: true
      })
    });
    
    if (!verimorResponse.ok) {
      const errorText = await verimorResponse.text();
      throw new Error(`Verimor API error: ${errorText}`);
    }
    
    const apiResponse = await verimorResponse.json();
    
    return new Response(JSON.stringify({ 
      success: true,
      message: "Arama başlatıldı",
      call_uuid: apiResponse.uuid
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (error) {
    console.error("Error originating call:", error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});