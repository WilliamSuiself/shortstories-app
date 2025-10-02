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
    
    // KV数据库为空时返回空数组
    const emptyStories = [];
    
    // 添加调试信息
    console.log('Using hardcoded test data temporarily');
    console.log('Environment keys:', Object.keys(env));
    console.log('STORIES_KV exists:', !!env.STORIES_KV);
    console.log('STORIES_KV type:', typeof env.STORIES_KV);
    
    try {
        // 从KV读取数据，如果为空则返回空数组
        let stories = emptyStories;
        let kvStatus = 'empty';
        
        if (env.STORIES_KV) {
            try {
                console.log('Attempting to read from KV...');
                const storiesData = await env.STORIES_KV.get('stories');
                console.log('KV raw data:', storiesData);
                
                if (storiesData) {
                    const kvData = JSON.parse(storiesData);
                    // Handle both formats: direct array or {stories: []} object
                    if (Array.isArray(kvData)) {
                        stories = kvData;
                        kvStatus = 'kv';
                        console.log('Successfully loaded from KV (array format):', kvData.length, 'stories');
                    } else if (kvData && Array.isArray(kvData.stories)) {
                        stories = kvData.stories;
                        kvStatus = 'kv';
                        console.log('Successfully loaded from KV (object format):', kvData.stories.length, 'stories');
                    }
                } else {
                    console.log('No stories data found in KV, returning empty array');
                }
            } catch (kvError) {
                console.log('KV read failed, returning empty array:', kvError.message);
            }
        }
        
        return new Response(JSON.stringify({
            success: true,
            stories: stories,
            kvStatus: kvStatus,
            kvAvailable: !!env.STORIES_KV,
            storiesCount: stories.length
        }), {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
        
    } catch (error) {
        console.error('Error in stories API:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message,
            stories: emptyStories // 出错时返回空数组
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
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