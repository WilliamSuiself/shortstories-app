// Cloudflare Pages Function for getting individual story details

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400',
};

// Main function handler for GET requests
export async function onRequestGet(context) {
  const { params, env } = context;
  const storyId = params.id;
  
  try {
    if (!storyId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Bad request',
        message: 'Story ID is required'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    let story = null;
    
    // Try to get story from Cloudflare KV
    if (env.STORIES_KV) {
      // First try to get individual story
      story = await env.STORIES_KV.get(`story_${storyId}`, 'json');
      
      // If not found, search in stories list
      if (!story) {
        const data = await env.STORIES_KV.get('stories', 'json');
        if (data && data.stories) {
          story = data.stories.find(s => s.id === storyId);
        }
      }
    }
    
    if (!story) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Not found',
        message: 'Story not found'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    // Increment view count
    if (env.STORIES_KV) {
      story.viewCount = (story.viewCount || 0) + 1;
      
      // Update individual story record
      await env.STORIES_KV.put(`story_${storyId}`, JSON.stringify(story));
      
      // Update in stories list
      const data = await env.STORIES_KV.get('stories', 'json');
      if (data && data.stories) {
        const index = data.stories.findIndex(s => s.id === storyId);
        if (index !== -1) {
          data.stories[index] = story;
          await env.STORIES_KV.put('stories', JSON.stringify(data));
        }
      }
    }
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        story: story,
        timestamp: new Date().toISOString()
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
    
  } catch (error) {
    console.error('Error fetching story:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error',
      message: 'An error occurred while fetching the story'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

// Handle OPTIONS requests for CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    status: 200,
    headers