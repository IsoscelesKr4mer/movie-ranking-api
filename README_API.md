# Movie Ranking API

A Flask REST API backend for ranking movies using merge sort algorithm. This API is designed to be consumed by a frontend application (e.g., built with Lovable).

## Features

- **RESTful API**: Clean endpoints for all ranking operations
- **Session Management**: Each user gets their own session
- **TMDb Integration**: Fetches movies with artwork
- **Merge Sort Ranking**: Efficient binary comparison algorithm
- **CORS Enabled**: Ready for frontend integration

## Setup

1. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **API Key**: The API key should already be in `tmdb_api_key.txt`

3. **Run the server**:
   ```bash
   python movie_ranker_api.py
   ```

   The API will run on `http://localhost:5000`

## API Endpoints

### Health Check
```
GET /api/health
```
Check if API is running and API key is configured.

**Response:**
```json
{
  "status": "healthy",
  "api_key_configured": true
}
```

### Create Session
```
POST /api/session/create
```
Create a new ranking session. Returns a session ID.

**Response:**
```json
{
  "session_id": "uuid-here",
  "message": "Session created"
}
```

### Load Movies
```
POST /api/session/<session_id>/movies/load
Content-Type: application/json

{
  "year": 2025,
  "max_movies": 50
}
```

**Response:**
```json
{
  "message": "Loaded 50 movies",
  "movie_count": 50,
  "movies": [
    {
      "id": 123,
      "title": "Movie Title",
      "poster_path": "/path.jpg",
      "poster_url": "https://image.tmdb.org/t/p/w500/path.jpg",
      "release_date": "2025-01-01",
      "vote_average": 8.5,
      "overview": "Movie description..."
    }
  ]
}
```

### Start Ranking
```
POST /api/session/<session_id>/ranking/start
```
Start the ranking process. Returns the first comparison.

**Response:**
```json
{
  "message": "Ranking started",
  "comparison": {
    "left_movie": {...},
    "right_movie": {...}
  },
  "status": {
    "is_ranking": true,
    "total_movies": 50,
    "ranked_count": 0,
    "unseen_count": 0,
    "has_comparison": true
  }
}
```

### Get Current Comparison
```
GET /api/session/<session_id>/ranking/current
```
Get the current movie pair to compare.

**Response:**
```json
{
  "comparison": {
    "left_movie": {...},
    "right_movie": {...}
  },
  "status": {...}
}
```

### Make Choice
```
POST /api/session/<session_id>/ranking/choice
Content-Type: application/json

{
  "choice": "left"  // or "right" or "skip"
}
```

**Response (if more comparisons):**
```json
{
  "message": "Choice recorded",
  "comparison": {
    "left_movie": {...},
    "right_movie": {...}
  },
  "status": {...}
}
```

**Response (if complete):**
```json
{
  "message": "Ranking complete",
  "results": {
    "ranked_movies": [...],
    "unseen_movies": [...],
    "total_ranked": 45
  },
  "status": {...}
}
```

### Get Status
```
GET /api/session/<session_id>/ranking/status
```
Get current ranking status.

**Response:**
```json
{
  "status": {
    "is_ranking": true,
    "total_movies": 50,
    "ranked_count": 25,
    "unseen_count": 5,
    "has_comparison": true
  },
  "has_results": false
}
```

### Get Results
```
GET /api/session/<session_id>/ranking/results
```
Get final ranking results.

**Response:**
```json
{
  "ranked_movies": [
    {
      "id": 123,
      "title": "Best Movie",
      "poster_url": "...",
      ...
    },
    ...
  ],
  "unseen_movies": [...],
  "total_ranked": 45
}
```

### Delete Session
```
DELETE /api/session/<session_id>
```
Delete a session.

## Usage Flow

1. **Create a session**: `POST /api/session/create`
2. **Load movies**: `POST /api/session/<id>/movies/load` with year and max_movies
3. **Start ranking**: `POST /api/session/<id>/ranking/start`
4. **Loop until complete**:
   - Get current comparison: `GET /api/session/<id>/ranking/current`
   - Make choice: `POST /api/session/<id>/ranking/choice` with "left", "right", or "skip"
   - Repeat until ranking is complete
5. **Get results**: `GET /api/session/<id>/ranking/results`

## Frontend Integration (Lovable)

The API is CORS-enabled and ready for frontend integration. Example frontend flow:

```javascript
// 1. Create session
const session = await fetch('/api/session/create', { method: 'POST' })
  .then(r => r.json());

// 2. Load movies
await fetch(`/api/session/${session.session_id}/movies/load`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ year: 2025, max_movies: 50 })
});

// 3. Start ranking
let response = await fetch(`/api/session/${session.session_id}/ranking/start`, {
  method: 'POST'
}).then(r => r.json());

// 4. Loop through comparisons
while (response.comparison) {
  // Display comparison to user
  // Wait for user choice
  
  response = await fetch(`/api/session/${session.session_id}/ranking/choice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ choice: 'left' }) // or 'right' or 'skip'
  }).then(r => r.json());
}

// 5. Get final results
const results = await fetch(`/api/session/${session.session_id}/ranking/results`)
  .then(r => r.json());
```

## Notes

- Sessions are stored in memory (use Redis/database for production)
- API key is loaded from `tmdb_api_key.txt`
- All endpoints return JSON
- Error responses include an "error" field with message

## Production Considerations

- Use a proper database (PostgreSQL, MongoDB) for session storage
- Add authentication/authorization
- Implement rate limiting
- Add request validation
- Use environment variables for configuration
- Add logging and monitoring
- Deploy with gunicorn or similar WSGI server

