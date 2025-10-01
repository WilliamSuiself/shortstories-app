const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'stories.json');

// Middleware
// Enhanced CORS configuration for production deployment
app.use(cors({
    origin: [
        'https://shortstories.app',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        /^https:\/\/.*\.shortstories\.app$/,  // Allow subdomains
        /^http:\/\/localhost:\d+$/,          // Allow localhost with any port for development
        /^http:\/\/127\.0\.0\.1:\d+$/       // Allow 127.0.0.1 with any port for development
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    optionsSuccessStatus: 200 // For legacy browser support
}));

// Handle preflight requests for all routes
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.header('Access-Control-Max-Age', '86400');
    return res.status(200).end();
  }
  next();
});

app.use(bodyParser.json({ limit: '1mb' }));
app.use(express.static('public'));

// Initialize data file if it doesn't exist
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ stories: [] }, null, 2));
}

// Helper functions
function readStories() {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading stories:', error);
        return { stories: [] };
    }
}

function writeStories(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing stories:', error);
        return false;
    }
}

function validateToken(token) {
    // Simple token validation - in production, use proper JWT validation
    return token && token.length > 0;
}

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
    } else if (Buffer.byteLength(data.content, 'utf8') > 500 * 1024) {
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

// API Routes

// POST /api/publish/story
app.post('/api/publish/story', (req, res) => {
    console.log('Received publish request:', {
        title: req.body.title,
        publishType: req.body.publishType,
        author: req.body.author,
        category: req.body.category
    });
    
    // Validate request data
    const validation = validateStoryData(req.body);
    
    if (validation.missing.length > 0 || validation.errors.length > 0) {
        return res.status(400).json({
            success: false,
            error: 'Invalid request',
            message: validation.missing.length > 0 
                ? `Missing required parameter: ${validation.missing[0]}`
                : validation.errors[0],
            details: {
                missingFields: validation.missing,
                invalidFields: validation.errors
            }
        });
    }
    
    // Validate token
    if (!validateToken(req.body.token)) {
        return res.status(401).json({
            success: false,
            error: 'Authentication failed',
            message: 'Invalid authentication token'
        });
    }
    
    // Create new story
    const storyId = uuidv4();
    const now = new Date().toISOString();
    
    const newStory = {
        id: storyId,
        title: req.body.title.trim(),
        content: req.body.content,
        author: req.body.author || 'Anonymous',
        category: req.body.category || 'Fiction',
        publishType: req.body.publishType,
        userId: 'user_' + req.body.token.substring(0, 8), // Simple user ID from token
        createdAt: now,
        updatedAt: now,
        status: 'published',
        viewCount: 0
    };
    
    // Save to file
    const data = readStories();
    data.stories.push(newStory);
    
    if (!writeStories(data)) {
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'An error occurred while processing the request'
        });
    }
    
    // Return success response
    res.status(201).json({
        success: true,
        message: 'Story published successfully',
        data: {
            storyId: storyId,
            publishedAt: now,
            url: `https://shortstories.app/story/${storyId}`
        }
    });
});

// GET /api/stories - Get all stories
app.get('/api/stories', (req, res) => {
    const data = readStories();
    res.json({
        success: true,
        data: data.stories.map(story => ({
            id: story.id,
            title: story.title,
            author: story.author,
            category: story.category,
            publishType: story.publishType,
            createdAt: story.createdAt,
            viewCount: story.viewCount
        }))
    });
});

// GET /api/story/:id - Get specific story
app.get('/api/story/:id', (req, res) => {
    const data = readStories();
    const story = data.stories.find(s => s.id === req.params.id);
    
    if (!story) {
        return res.status(404).json({
            success: false,
            error: 'Story not found',
            message: 'The requested story does not exist'
        });
    }
    
    // Increment view count
    story.viewCount++;
    writeStories(data);
    
    res.json({
        success: true,
        data: story
    });
});

// Web Routes

// Home page - Story list
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Story detail page
app.get('/story/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'story.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Story Publishing Server running on http://localhost:${PORT}`);
    console.log(`API endpoint: http://localhost:${PORT}/api/publish/story`);
    console.log(`Web interface: http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    process.exit(0);
});