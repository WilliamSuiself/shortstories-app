// Cloudflare Pages Function for getting stories list

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400',
};

// Main function handler for GET requests
export async function onRequestGet(context) {
  const { env } = context;
  
  try {
    let stories = [];
    let kvStatus = 'unknown';
    
    // Try to get stories from Cloudflare KV
    if (env.STORIES_KV) {
      kvStatus = 'available';
      try {
        const data = await env.STORIES_KV.get('stories', 'json');
        console.log('KV raw data:', data);
        
        if (data && data.stories && Array.isArray(data.stories)) {
          stories = data.stories;
          console.log('✅ Loaded', stories.length, 'stories from KV');
          kvStatus = 'success';
        } else if (data) {
          console.warn('⚠️ KV data exists but invalid format:', typeof data, data);
          kvStatus = 'invalid_format';
        } else {
          console.log('📭 No stories found in KV - empty database');
          kvStatus = 'empty';
        }
      } catch (kvError) {
        console.error('❌ KV read error:', kvError.message);
        console.error('KV Error stack:', kvError.stack);
        kvStatus = 'error';
      }
    } else {
      console.warn('🚫 STORIES_KV not available - KV namespace not bound');
      console.warn('Please configure KV namespace in Cloudflare Pages settings');
      kvStatus = 'not_bound';
    }
    
    // Ensure stories is always an array
    if (!Array.isArray(stories)) {
      console.warn('⚠️ Stories is not an array, converting:', typeof stories);
      stories = [];
    }
    
    // Sort stories by creation date (newest first)
    stories.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Return stories with summary info (exclude full content)
    const storiesSummary = stories.map(story => ({
      id: story.id,
      title: story.title,
      author: story.author,
      category: story.category,
      publishType: story.publishType,
      createdAt: story.createdAt,
      status: story.status,
      viewCount: story.viewCount || 0,
      preview: story.content ? story.content.substring(0, 200) + '...' : ''
    }));
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        stories: storiesSummary,
        total: storiesSummary.length,
        timestamp: new Date().toISOString(),
        debug: {
          kvStatus: kvStatus,
          kvAvailable: !!env.STORIES_KV,
          storiesIsArray: Array.isArray(stories),
          originalStoriesLength: stories.length
        }
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
    
  } catch (error) {
    console.error('Error fetching stories:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error',
      message: 'An error occurred while fetching stories'
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
    headers: corsHeaders
  });
}