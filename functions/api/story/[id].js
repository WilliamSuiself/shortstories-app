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
    
    // 空数据数组，KV清空后不再使用硬编码数据
    const emptyStories = [];
    
    console.log('🔍 Fetching story with ID:', storyId);
    console.log('🔍 Environment keys:', Object.keys(env));
    console.log('🔍 STORIES_KV exists:', !!env.STORIES_KV);
    
    try {
        // 从KV读取数据，如果没有数据则返回空
        let stories = emptyStories;
        let dataSource = 'empty';
        
        if (env.STORIES_KV) {
            try {
                console.log('Attempting to read from KV...');
                const storiesData = await env.STORIES_KV.get('stories');
                console.log('KV raw data:', storiesData);
                
                if (storiesData) {
                    const kvData = JSON.parse(storiesData);
                    if (kvData && kvData.stories && Array.isArray(kvData.stories)) {
                        stories = kvData.stories;
                        dataSource = 'kv';
                        console.log('Successfully loaded from KV:', kvData.stories.length, 'stories');
                    }
                }
            } catch (kvError) {
                console.log('KV read failed, returning empty data:', kvError.message);
            }
        }
        
        // Find the specific story
        const story = stories.find(s => s.id === storyId);
        console.log('🔍 Found story:', !!story);
        
        if (!story) {
            console.log('❌ Story not found with ID:', storyId);
            return new Response(JSON.stringify({
                success: false,
                error: 'Not found',
                message: 'Story not found'
            }), {
                status: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }
        
        // Increment view count (optional - you might want to implement this)
        // story.viewCount = (story.viewCount || 0) + 1;
        
        console.log('✅ Returning story:', story.title);
        return new Response(JSON.stringify({
            success: true,
            data: story,
            timestamp: new Date().toISOString(),
            dataSource: dataSource
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
        
    } catch (error) {
        console.error('❌ Error fetching story:', error);
        return new Response(JSON.stringify({
            success: false,
            error: 'Internal server error',
            message: 'An error occurred while fetching the story'
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