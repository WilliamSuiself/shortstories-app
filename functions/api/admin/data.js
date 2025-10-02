// Cloudflare Pages Function for admin data management

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Verify admin token
async function verifyAdminToken(token, env) {
  if (!token) return null;
  
  // Check session in KV (if available)
  if (env.STORIES_KV) {
    try {
      const sessionKey = `admin_session_${token}`;
      const sessionData = await env.STORIES_KV.get(sessionKey);
      
      if (sessionData) {
        return JSON.parse(sessionData);
      }
    } catch (error) {
      console.error('Error reading admin session from KV:', error);
    }
  }
  
  // Fallback: if token starts with 'admin_token_', assume it's valid
  if (token.startsWith('admin_token_')) {
    return {
      id: 'admin_001',
      username: 'admin',
      role: 'admin'
    };
  }
  
  return null;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  const dataType = url.searchParams.get('type'); // 'users' or 'stories'
  
  try {
    // Verify admin token
    const admin = await verifyAdminToken(token, env);
    if (!admin) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized: Invalid admin token'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Check if KV is available
    if (!env.STORIES_KV) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Storage service not available'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    let data = [];
    let totalCount = 0;
    
    if (dataType === 'users') {
      // Get users data
      try {
        const usersData = await env.STORIES_KV.get('users');
        if (usersData) {
          const users = JSON.parse(usersData);
          // Remove passwords from response
          data = users.map(user => {
            const { password, ...userWithoutPassword } = user;
            return userWithoutPassword;
          });
          totalCount = data.length;
        }
      } catch (error) {
        console.error('Error reading users from KV:', error);
      }
    } else if (dataType === 'stories') {
      // Get stories data
      try {
        const storiesData = await env.STORIES_KV.get('stories');
        if (storiesData) {
          const parsedData = JSON.parse(storiesData);
          
          // Ensure data is an array
          if (Array.isArray(parsedData)) {
            data = parsedData;
          } else if (parsedData && parsedData.stories && Array.isArray(parsedData.stories)) {
            // Handle case where data is wrapped in an object
            data = parsedData.stories;
          } else {
            console.error('Stories data is not in expected format:', parsedData);
            data = [];
          }
          
          totalCount = data.length;
          
          // Sort by creation date (newest first)
          if (data.length > 0) {
            data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          }
        }
      } catch (error) {
        console.error('Error reading stories from KV:', error);
        data = [];
      }
    } else {
      // Get dashboard stats
      try {
        const [usersData, storiesData] = await Promise.all([
          env.STORIES_KV.get('users'),
          env.STORIES_KV.get('stories')
        ]);
        
        let userCount = 0;
        let storyCount = 0;
        let activeUsers = 0;
        
        if (usersData) {
          const users = JSON.parse(usersData);
          userCount = users.length;
          activeUsers = users.filter(user => user.isActive).length;
        }
        
        if (storiesData) {
          const stories = JSON.parse(storiesData);
          storyCount = stories.length;
        }
        
        data = {
          userCount,
          storyCount,
          activeUsers,
          lastUpdated: new Date().toISOString()
        };
      } catch (error) {
        console.error('Error reading dashboard data from KV:', error);
      }
    }
    
    return new Response(JSON.stringify({
      success: true,
      data,
      totalCount,
      dataType: dataType || 'dashboard'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Admin data error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Handle DELETE requests (for deleting users or stories)
export async function onRequestDelete(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  const dataType = url.searchParams.get('type'); // 'user' or 'story'
  const itemId = url.searchParams.get('id');
  
  try {
    // Verify admin token
    const admin = await verifyAdminToken(token, env);
    if (!admin) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized: Invalid admin token'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (!itemId || !dataType) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Item ID and type are required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Check if KV is available
    if (!env.STORIES_KV) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Storage service not available'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (dataType === 'user') {
      // Delete user
      try {
        const usersData = await env.STORIES_KV.get('users');
        if (usersData) {
          let users = JSON.parse(usersData);
          const userIndex = users.findIndex(user => user.id === itemId);
          
          if (userIndex === -1) {
            return new Response(JSON.stringify({
              success: false,
              error: 'User not found'
            }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          users.splice(userIndex, 1);
          await env.STORIES_KV.put('users', JSON.stringify(users));
        }
      } catch (error) {
        console.error('Error deleting user:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to delete user'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } else if (dataType === 'story') {
      // Delete story
      try {
        const storiesData = await env.STORIES_KV.get('stories');
        if (storiesData) {
          let stories = JSON.parse(storiesData);
          const storyIndex = stories.findIndex(story => story.id === itemId);
          
          if (storyIndex === -1) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Story not found'
            }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          stories.splice(storyIndex, 1);
          await env.STORIES_KV.put('stories', JSON.stringify(stories));
          
          // Also delete individual story record
          await env.STORIES_KV.delete(`story_${itemId}`);
        }
      } catch (error) {
        console.error('Error deleting story:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to delete story'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: `${dataType} deleted successfully`
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Admin delete error:', error);
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
  
  if (method === 'GET') {
    return onRequestGet(context);
  } else if (method === 'DELETE') {
    return onRequestDelete(context);
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