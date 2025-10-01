# Story Publishing Test Website

This is a test website for the Story Publishing mobile app. It provides a web interface to receive and display stories published from the mobile app.

## Features

- **REST API**: Implements the `/api/publish/story` endpoint according to the API specification
- **Web Interface**: Beautiful responsive web pages to view published stories
- **Real-time Updates**: Stories appear immediately after publishing from the mobile app
- **Story Management**: View story lists, details, and statistics
- **Data Persistence**: Stories are saved to a JSON file for persistence

## API Endpoints

### POST /api/publish/story
Publish a new story from the mobile app.

**Request Body:**
```json
{
  "title": "Story Title",
  "content": "Story content...",
  "author": "Author Name",
  "category": "Fiction",
  "publishType": "chapter" | "fullstory",
  "token": "authentication_token"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Story published successfully",
  "data": {
    "storyId": "uuid",
    "publishedAt": "2024-01-01T00:00:00.000Z",
    "url": "http://localhost:3000/story/uuid"
  }
}
```

### GET /api/stories
Get all published stories (metadata only).

### GET /api/story/:id
Get a specific story with full content.

## Installation

1. Navigate to the test-website directory:
   ```bash
   cd test-website
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

### Start the Server

```bash
npm start
```

The server will start on `http://localhost:3000`

### Access the Web Interface

- **Home Page**: http://localhost:3000
  - View all published stories
  - See statistics (total stories, chapters, full stories)
  - Auto-refreshes every 30 seconds

- **Story Details**: http://localhost:3000/story/{story-id}
  - View individual story content
  - See story metadata and statistics

### Testing the API

You can test the API using curl or any HTTP client:

```bash
# Test publishing a story
curl -X POST http://localhost:3000/api/publish/story \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Story",
    "content": "This is a test story content...",
    "author": "Test Author",
    "category": "Fiction",
    "publishType": "chapter",
    "token": "test-token-123"
  }'

# Get all stories
curl http://localhost:3000/api/stories

# Get specific story
curl http://localhost:3000/api/story/{story-id}
```

## File Structure

```
test-website/
├── server.js              # Express server with API endpoints
├── package.json           # Node.js dependencies and scripts
├── stories.json          # Data storage (auto-created)
├── public/
│   ├── index.html        # Home page - story list
│   └── story.html        # Story detail page
└── README.md             # This file
```

## Data Storage

Stories are stored in a `stories.json` file in the following format:

```json
{
  "stories": [
    {
      "id": "uuid",
      "title": "Story Title",
      "content": "Story content...",
      "author": "Author Name",
      "category": "Fiction",
      "publishType": "chapter",
      "userId": "user_id",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "status": "published",
      "viewCount": 0
    }
  ]
}
```

## Configuration

- **Port**: The server runs on port 3000 by default
- **CORS**: Enabled for all origins (suitable for testing)
- **Body Parser**: Configured with 1MB limit for story content
- **Static Files**: Served from the `public` directory

## Error Handling

The API provides comprehensive error handling:

- **400 Bad Request**: Missing or invalid request data
- **401 Unauthorized**: Invalid authentication token
- **404 Not Found**: Story not found
- **500 Internal Server Error**: Server-side errors

All errors return a consistent JSON format:

```json
{
  "success": false,
  "error": "Error Type",
  "message": "Detailed error message"
}
```

## Mobile App Integration

To integrate with the mobile app:

1. Update the mobile app's API endpoint to: `http://localhost:3000/api/publish/story`
2. Ensure the request format matches the API specification
3. Handle the JSON response appropriately
4. Test the integration by publishing stories from the app

## Development Notes

- The server automatically creates the `stories.json` file if it doesn't exist
- View counts are incremented each time a story is accessed
- The web interface auto-refreshes to show new stories
- All timestamps are in ISO 8601 format
- Story IDs are generated using UUID v4

## Troubleshooting

### Common Issues

1. **Port already in use**: Change the PORT variable in `server.js`
2. **Permission denied**: Ensure write permissions for the directory
3. **Module not found**: Run `npm install` to install dependencies
4. **CORS errors**: The server is configured to allow all origins for testing

### Logs

The server logs all incoming requests and errors to the console. Check the terminal output for debugging information.

## Security Notes

⚠️ **This is a test server for development purposes only!**

- Token validation is simplified (not production-ready)
- No rate limiting implemented
- CORS is open to all origins
- No HTTPS encryption
- No input sanitization beyond basic validation

For production use, implement proper:
- JWT token validation
- Rate limiting
- Input sanitization
- HTTPS encryption
- Database storage
- User authentication
- Access control