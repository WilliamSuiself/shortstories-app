// Cloudflare Pages Function for user registration

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Generate unique user ID
function generateUserId() {
  return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Generate user token
function generateUserToken() {
  return 'token_' + Date.now() + '_' + Math.random().toString(36).substr(2, 16);
}

// Hash password (simple implementation for demo)
function hashPassword(password) {
  // In production, use proper password hashing like bcrypt
  return btoa(password + 'salt_key_2024');
}

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const requestData = await request.json();
    const { username, email, password } = requestData;
    
    // Validate input
    if (!username || !email || !password) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Username, email and password are required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Check if KV is available
    if (!env.STORIES_KV) {
      console.warn('STORIES_KV not available, registration failed');
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
      users = [];
    }
    
    // Check if user already exists
    const existingUser = users.find(user => 
      user.email === email || user.username === username
    );
    
    if (existingUser) {
      return new Response(JSON.stringify({
        success: false,
        error: 'User with this email or username already exists'
      }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Create new user
    const newUser = {
      id: generateUserId(),
      username,
      email,
      password: hashPassword(password),
      token: generateUserToken(),
      createdAt: new Date().toISOString(),
      isActive: true
    };
    
    // Add user to list
    users.push(newUser);
    
    // Save users to KV
    try {
      await env.STORIES_KV.put('users', JSON.stringify(users));
      console.log('User registered successfully:', newUser.id);
    } catch (error) {
      console.error('Error saving user to KV:', error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to save user data'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Return success response (don't include password)
    const { password: _, ...userResponse } = newUser;
    
    return new Response(JSON.stringify({
      success: true,
      message: 'User registered successfully',
      user: userResponse
    }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
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

// Handle GET requests (return method not allowed)
export async function onRequestGet() {
  return new Response(JSON.stringify({
    success: false,
    error: 'Method not allowed. Use POST to register.'
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