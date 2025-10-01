// Cloudflare Pages Function for story publishing API
// This replaces the Express.js server for serverless deployment

import { v4 as uuidv4 } from 'uuid';

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400',
};

// Helper function to validate token
function validateToken(token) {
  return token && token.length > 0;
}

// Helper function to validate story data
function validateStoryData(data) {
  const errors = [];
  const missing = [];
  
  if (!data.title || data.title.trim() === '') {
    missing.push('title');
  } else if (data.title.length > 200) {
    errors.push('title exceeds maximum length (200 characters)');
  }
  
  if (!data.content || data.content.trim() === '') {
    missing.push('content');
  } else if (new Blob([data.content]).size > 500 * 1024) {
    errors.push('content exceeds maximum size (500KB)');
  }
  
  if (!data.publishType) {
    missing.push('publishType');
  } else if (!['chapter', 'fullstory'].includes(data.publishType)) {
    errors.push('publishType must be "chapter" or "fullstory"');
  }
  
  if (!data.token) {
    missing.push('token');
  }
  
  return { missing, errors };
}

// Main function handler
export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    // Parse request body
    const body = await request.json();
    
    console.log('Received publish request:', {
      title: body.title,
      publishType: body.publishType,
      author: body.author,
      category: body.category
    });
    
    // Validate request data
    const validation = validateStoryData(body);
    
    if (validation.missing.length > 0 || validation.errors.length > 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid request',
        message: validation.missing.length > 0 
          ? `Missing required parameter: ${validation.missing[0]}`
          : validation.errors[0],
        details: {
          missingFields: validation.missing,
          invalidFields: validation.errors
        }
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    // Validate token
    if (!validateToken(body.token)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Authentication failed',
        message: 'Invalid authentication token'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    // Create new story
    const storyId = uuidv4();
    const now = new Date().toISOString();
    
    const newStory = {
      id: storyId,
      title: body.title.trim(),
      content: body.content,
      author: body.author || 'Anonymous',
      category: body.category || 'Fiction',
      publishType: body.publishType,
      userId: 'user_' + body.token.substring(0, 8),
      createdAt: now,
      updatedAt: now,
      status: 'published',
      viewCount: 0
    };
    
    // Store in Cloudflare KV (you'll need to bind a KV namespace)
    if (env.STORIES_KV) {
      // Get existing stories
      const existingData = await env.STORIES_KV.get('stories', 'json') || { stories: [] };
      existingData.stories.push(newStory);
      
      // Save updated stories
      await env.STORIES_KV.put('stories', JSON.stringify(existingData));
      
      // Also save individual story for quick access
      await env.STORIES_KV.put(`story_${storyId}`, JSON.stringify(newStory));
    }
    
    // Return success response
    return new Response(JSON.stringify({
      success: true,
      message: 'Story published successfully',
      data: {
        storyId: storyId,
        publishedAt: now,
        url: `https://shortstories.app/story/${storyId}`
      }
    }), {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
    
  } catch (error) {
    console.error('Error processing request:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error',
      message: 'An error occurred while processing the request'
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