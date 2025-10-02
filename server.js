const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'stories.json');
const USERS_FILE = path.join(__dirname, 'users.json');

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

// Initialize data files if they don't exist
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ stories: [] }, null, 2));
}

if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify({ users: [] }, null, 2));
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

// User management functions
function readUsers() {
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading users:', error);
        return { users: [] };
    }
}

function writeUsers(data) {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing users:', error);
        return false;
    }
}

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

function validateToken(token) {
    if (!token || token.length === 0) return null;
    
    const userData = readUsers();
    const user = userData.users.find(u => u.token === token);
    return user || null;
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

// POST /api/auth/register
app.post('/api/auth/register', (req, res) => {
    console.log('Received registration request:', {
        username: req.body.username,
        email: req.body.email
    });
    
    const { username, email, password } = req.body;
    
    // Validate input
    if (!username || !email || !password) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields',
            message: 'Username, email, and password are required'
        });
    }
    
    // Check if user already exists
    const userData = readUsers();
    const existingUser = userData.users.find(u => u.email === email || u.username === username);
    
    if (existingUser) {
        return res.status(409).json({
            success: false,
            error: 'User already exists',
            message: 'A user with this email or username already exists'
        });
    }
    
    // Create new user
    const userId = uuidv4();
    const token = generateToken();
    const now = new Date().toISOString();
    
    const newUser = {
        id: userId,
        username: username.trim(),
        email: email.trim().toLowerCase(),
        password: hashPassword(password),
        token: token,
        createdAt: now,
        lastLoginAt: now,
        isActive: true
    };
    
    userData.users.push(newUser);
    
    if (!writeUsers(userData)) {
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Failed to create user account'
        });
    }
    
    res.status(201).json({
        success: true,
        message: 'User registered successfully',
        user: {
            id: userId,
            username: newUser.username,
            email: newUser.email,
            token: token
        }
    });
});

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
    console.log('Received login request:', {
        email: req.body.email
    });
    
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields',
            message: 'Email and password are required'
        });
    }
    
    // Find user
    const userData = readUsers();
    const user = userData.users.find(u => u.email === email.toLowerCase());
    
    if (!user) {
        return res.status(401).json({
            success: false,
            error: 'Invalid credentials',
            message: 'Invalid email or password'
        });
    }
    
    // Verify password
    const hashedPassword = hashPassword(password);
    if (user.password !== hashedPassword) {
        return res.status(401).json({
            success: false,
            error: 'Invalid credentials',
            message: 'Invalid email or password'
        });
    }
    
    // Check if user is active
    if (!user.isActive) {
        return res.status(403).json({
            success: false,
            error: 'Account disabled',
            message: 'Your account has been disabled'
        });
    }
    
    // Update user token and last login
    const newToken = generateToken();
    user.token = newToken;
    user.lastLoginAt = new Date().toISOString();
    
    if (!writeUsers(userData)) {
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Failed to update user session'
        });
    }
    
    res.json({
        success: true,
        message: 'Login successful',
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            token: newToken
        }
    });
});

// POST /api/auth/admin-login
app.post('/api/auth/admin-login', (req, res) => {
    const { username, password } = req.body;
    
    // Default admin credentials
    const ADMIN_USERNAME = 'admin';
    const ADMIN_PASSWORD = 'admin123';
    
    if (!username || !password) {
        return res.status(400).json({
            success: false,
            error: 'Missing credentials',
            message: 'Username and password are required'
        });
    }
    
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        const adminToken = 'admin_' + generateToken();
        
        return res.json({
            success: true,
            message: 'Admin login successful',
            token: adminToken,
            user: {
                username: 'admin',
                role: 'administrator'
            }
        });
    }
    
    return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        message: 'Invalid admin credentials'
    });
});

// GET /api/admin/data - Get admin data
app.get('/api/admin/data', (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token || !token.startsWith('admin_')) {
        return res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: 'Admin access required'
        });
    }
    
    const type = req.query.type;
    
    if (type === 'users') {
        const userData = readUsers();
        return res.json({
            success: true,
            data: userData.users.map(user => ({
                id: user.id,
                username: user.username,
                email: user.email,
                createdAt: user.createdAt,
                lastLoginAt: user.lastLoginAt,
                isActive: user.isActive
            }))
        });
    }
    
    if (type === 'stories') {
        const storyData = readStories();
        return res.json({
            success: true,
            data: storyData.stories
        });
    }
    
    if (type === 'dashboard') {
        const userData = readUsers();
        const storyData = readStories();
        
        return res.json({
            success: true,
            data: {
                totalUsers: userData.users.length,
                totalStories: storyData.stories.length,
                activeUsers: userData.users.filter(u => u.isActive).length,
                recentStories: storyData.stories.slice(-5).reverse()
            }
        });
    }
    
    return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'Invalid data type requested'
    });
});

// DELETE /api/admin/data - Delete admin data
app.delete('/api/admin/data', (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token || !token.startsWith('admin_')) {
        return res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: 'Admin access required'
        });
    }
    
    const { type, id } = req.query;
    
    if (type === 'user') {
        const userData = readUsers();
        const userIndex = userData.users.findIndex(u => u.id === id);
        
        if (userIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        userData.users.splice(userIndex, 1);
        writeUsers(userData);
        
        return res.json({
            success: true,
            message: 'User deleted successfully'
        });
    }
    
    if (type === 'story') {
        const storyData = readStories();
        const storyIndex = storyData.stories.findIndex(s => s.id === id);
        
        if (storyIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Story not found'
            });
        }
        
        storyData.stories.splice(storyIndex, 1);
        writeStories(storyData);
        
        return res.json({
            success: true,
            message: 'Story deleted successfully'
        });
    }
    
    return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'Invalid delete type'
    });
});

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
    
    // Validate token and get user
    const user = validateToken(req.body.token);
    if (!user) {
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
        author: req.body.author || user.username,
        category: req.body.category || 'Fiction',
        publishType: req.body.publishType,
        authorId: user.id,
        authorUsername: user.username,
        authorEmail: user.email,
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

// Admin page
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
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