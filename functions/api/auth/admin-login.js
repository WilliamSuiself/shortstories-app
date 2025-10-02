// Cloudflare Pages Function for admin login

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Default admin credentials
const DEFAULT_ADMIN = {
  username: 'admin',
  password: 'admin123',
  id: 'admin_001',
  role: 'admin'
};

// Generate admin token
function generateAdminToken() {
  return 'admin_token_' + Date.now() + '_' + Math.random().toString(36).substr(2, 16);
}

// Simple password verification
function verifyPassword(inputPassword, storedPassword) {
  return inputPassword === storedPassword;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const requestData = await request.json();
    const { username, password } = requestData;
    
    // Validate input
    if (!username || !password) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Username and password are required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Check if KV is available
    if (!env.STORIES_KV) {
      console.warn('STORIES_KV not available, using default admin only');
    }
    
    let isValidAdmin = false;
    let adminUser = null;
    
    // Check default admin credentials
    if (username === DEFAULT_ADMIN.username && verifyPassword(password, DEFAULT_ADMIN.password)) {
      isValidAdmin = true;
      adminUser = {
        id: DEFAULT_ADMIN.id,
        username: DEFAULT_ADMIN.username,
        role: DEFAULT_ADMIN.role,
        token: generateAdminToken(),
        loginAt: new Date().toISOString()
      };
    } else {
      // Check for other admin users in KV (if available)
      if (env.STORIES_KV) {
        try {
          const adminsData = await env.STORIES_KV.get('admins');
          if (adminsData) {
            const admins = JSON.parse(adminsData);
            const foundAdmin = admins.find(admin => 
              admin.username === username && admin.isActive
            );
            
            if (foundAdmin && verifyPassword(password, foundAdmin.password)) {
              isValidAdmin = true;
              adminUser = {
                id: foundAdmin.id,
                username: foundAdmin.username,
                role: foundAdmin.role || 'admin',
                token: generateAdminToken(),
                loginAt: new Date().toISOString()
              };
            }
          }
        } catch (error) {
          console.error('Error reading admins from KV:', error);
        }
      }
    }
    
    if (!isValidAdmin) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid admin credentials'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Store admin session in KV (if available)
    if (env.STORIES_KV && adminUser) {
      try {
        const sessionKey = `admin_session_${adminUser.token}`;
        await env.STORIES_KV.put(sessionKey, JSON.stringify(adminUser), {
          expirationTtl: 24 * 60 * 60 // 24 hours
        });
        console.log('Admin session created:', adminUser.id);
      } catch (error) {
        console.error('Error saving admin session:', error);
      }
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Admin login successful',
      admin: adminUser
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Admin login error:', error);
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

// Handle GET requests
export async function onRequestGet() {
  return new Response(JSON.stringify({
    success: false,
    error: 'Method not allowed. Use POST to login.'
  }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
  } else if (method === 'GET') {
    return onRequestGet();
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