// Cloudflare Pages Function for user login

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Hash password (simple implementation for demo)
function hashPassword(password) {
  // In production, use proper password hashing like bcrypt
  return btoa(password + 'salt_key_2024');
}

// Generate new user token
function generateUserToken() {
  return 'token_' + Date.now() + '_' + Math.random().toString(36).substr(2, 16);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const requestData = await request.json();
    const { email, password } = requestData;
    
    // Validate input
    if (!email || !password) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Email and password are required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Check if KV is available
    if (!env.STORIES_KV) {
      console.warn('STORIES_KV not available, login failed');
      return new Response(JSON.stringify({
        success: false,
        error: 'Storage service not available'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Get existing users
    let users = [];
    try {
      const existingUsers = await env.STORIES_KV.get('users');
      if (existingUsers) {
        users = JSON.parse(existingUsers);
      }
    } catch (error) {
      console.error('Error reading users from KV:', error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to access user data'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Find user by email
    const user = users.find(u => u.email === email);
    
    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid email or password'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Verify password
    const hashedPassword = hashPassword(password);
    if (user.password !== hashedPassword) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid email or password'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Check if user is active
    if (!user.isActive) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Account is deactivated'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Generate new token for security
    user.token = generateUserToken();
    user.lastLoginAt = new Date().toISOString();
    
    // Update user in KV
    try {
      await env.STORIES_KV.put('users', JSON.stringify(users));
      console.log('User logged in successfully:', user.id);
    } catch (error) {
      console.error('Error updating user token in KV:', error);
      // Continue with login even if token update fails
    }
    
    // Return success response (don't include password)
    const { password: _, ...userResponse } = user;
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Login successful',
      user: userResponse
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Login error:', error);
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