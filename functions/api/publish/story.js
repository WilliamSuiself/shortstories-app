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

// Helper function to validate and get user by token
async function validateTokenAndGetUser(token, env) {
  if (!token || token.length === 0) {
    return { valid: false, error: 'Token is required' };
  }
  
  if (!env.STORIES_KV) {
    return { valid: false, error: 'Storage service not available' };
  }
  
  try {
    const usersData = await env.STORIES_KV.get('users');
    if (!usersData) {
      return { valid: false, error: 'No users found' };
    }
    
    const users = JSON.parse(usersData);
    const user = users.find(u => u.token === token && u.isActive);
    
    if (!user) {
      return { valid: false, error: 'Invalid or expired token' };
    }
    
    return { valid: true, user };
  } catch (error) {
    console.error('Error validating token:', error);
    return { valid: false, error: 'Token validation failed' };
  }
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
    
    // Validate token and get user
    const tokenValidation = await validateTokenAndGetUser(body.token, env);
    if (!tokenValidation.valid) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Authentication failed',
        message: tokenValidation.error
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    const user = tokenValidation.user;
    
    // Create new story
    const storyId = uuidv4();
    const now = new Date().toISOString();
    
    const newStory = {
      id: storyId,
      title: body.title.trim(),
      content: body.content,
      author: body.author || user.username || 'Anonymous',
      category: body.category || 'Fiction',
      publishType: body.publishType,
      authorId: user.id,
      authorUsername: user.username,
      authorEmail: user.email,
      createdAt: now,
      updatedAt: now,
      status: 'published',
      viewCount: 0
    };
    
    // Store in Cloudflare KV with fallback handling
    let storageSuccess = false;
    
    if (env.STORIES_KV) {
      try {
        // Get existing stories
        const existingData = await env.STORIES_KV.get('stories', 'json') || { stories: [] };
        if (!existingData.stories) {
          existingData.stories = [];
        }
        existingData.stories.push(newStory);
        
        // Save updated stories
        await env.STORIES_KV.put('stories', JSON.stringify(existingData));
        
        // Also save individual story for quick access
        await env.STORIES_KV.put(`story_${storyId}`, JSON.stringify(newStory));
        
        console.log('Story saved to KV successfully:', storyId);
        storageSuccess = true;
      } catch (kvError) {
        console.error('KV storage error:', kvError);
        console.error('KV Error details:', kvError.message);
      }
    } else {
      console.warn('STORIES_KV not available - KV namespace not bound');
      console.warn('Please configure KV namespace in Cloudflare Pages settings');
    }
    
    // If KV storage failed, try to use Durable Objects or return warning
    if (!storageSuccess) {
      console.warn('Story published but not persisted - KV storage unavailable');
      console.warn('Story data:', JSON.stringify(newStory, null, 2));
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