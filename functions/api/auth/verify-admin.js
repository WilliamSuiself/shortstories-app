// Cloudflare Pages Function for admin token verification

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Default admin for fallback
const DEFAULT_ADMIN = {
  username: 'admin',
  id: 'admin_001',
  role: 'admin'
};

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const requestData = await request.json();
    const { token } = requestData;
    
    // Validate input
    if (!token) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Token is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    let adminUser = null;
    
    // Check session in KV (if available)
    if (env.STORIES_KV) {
      try {
        const sessionKey = `admin_session_${token}`;
        const sessionData = await env.STORIES_KV.get(sessionKey);
        
        if (sessionData) {
          adminUser = JSON.parse(sessionData);
        }
      } catch (error) {
        console.error('Error reading admin session from KV:', error);
      }
    }
    
    // Fallback: if token starts with 'admin_token_', assume it's valid for default admin
    if (!adminUser && token.startsWith('admin_token_')) {
      adminUser = {
        ...DEFAULT_ADMIN,
        token,
        loginAt: new Date().toISOString()
      };
    }
    
    if (!adminUser) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid or expired admin token'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      success: true,
      admin: adminUser
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Admin verification error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Handle CORS preflight requests
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}

// Handle other methods
export async function onRequest(context) {
  const { request } = context;
  const method = request.method;
  
  if (method === 'POST') {
    return onRequestPost(context);
  } else if (method === 'OPTIONS') {
    return onRequestOptions();
  } else {
    return new Response(JSON.stringify({
      success: false,
      error: `Method ${method} not allowed`
    }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}