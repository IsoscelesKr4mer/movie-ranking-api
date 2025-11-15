# Movie Ranking API

A REST API backend for ranking movies using a merge sort algorithm with binary comparisons. Users can load movies from The Movie Database (TMDb) and rank them through a series of binary choices.

## Features

- 🎬 **TMDb Integration**: Fetch movies by year with posters and metadata
- 🔄 **Merge Sort Algorithm**: Efficient ranking through binary comparisons
- 🎯 **Session Management**: Each user gets their own ranking session
- 🚫 **Skip Unseen Movies**: Option to exclude movies you haven't seen
- 🌐 **RESTful API**: Clean endpoints ready for frontend integration
- 🔒 **CORS Enabled**: Ready for web frontend frameworks

## Setup

### Prerequisites

- Python 3.8 or higher
- TMDb API key (free at [themoviedb.org](https://www.themoviedb.org/settings/api))

### Installation

1. **Clone the repository**:
   ```bash
   git clone <your-repo-url>
   cd movie-ranking-api
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure API Key**:
   Create a file named `tmdb_api_key.txt` in the project root with your TMDb API key:
   ```
   your-api-key-here
   ```
   
   ⚠️ **Important**: This file is in `.gitignore` and will NOT be committed to GitHub.

4. **Run the server**:
   ```bash
   python movie_ranker_api.py
   ```
   
   The API will start on `http://localhost:5000`

## API Documentation

See [README_API.md](README_API.md) for complete API documentation.

### Quick Start

1. **Create a session**:
   ```bash
   POST /api/session/create
   ```

2. **Load movies**:
   ```bash
   POST /api/session/<session_id>/movies/load
   {
     "year": 2025,
     "max_movies": 50
   }
   ```

3. **Start ranking**:
   ```bash
   POST /api/session/<session_id>/ranking/start
   ```

4. **Make choices**:
   ```bash
   POST /api/session/<session_id>/ranking/choice
   {
     "choice": "left"  // or "right" or "skip"
   }
   ```

5. **Get results**:
   ```bash
   GET /api/session/<session_id>/ranking/results
   ```

## Project Structure

```
.
├── movie_ranker_api.py    # Main Flask API server
├── movie_ranker.py        # Original GUI version (optional)
├── requirements.txt       # Python dependencies
├── README.md             # This file
├── README_API.md         # Detailed API documentation
└── .gitignore           # Git ignore rules
```

## How It Works

The ranking system uses a **merge sort algorithm**:

1. Movies are initially in individual "sorted" lists (each containing 1 movie)
2. Lists are paired and merged by asking the user to compare movies
3. The merge process continues until all movies are in one sorted list
4. The final list represents the complete ranking

This approach ensures efficient ranking with O(n log n) comparisons.

## Development

### Running in Development Mode

```bash
python movie_ranker_api.py
```

The server runs with debug mode enabled by default.

### Testing the API

You can test the API using curl, Postman, or any HTTP client:

```bash
# Create a session
curl -X POST http://localhost:5000/api/session/create

# Load movies (replace SESSION_ID)
curl -X POST http://localhost:5000/api/session/SESSION_ID/movies/load \
  -H "Content-Type: application/json" \
  -d '{"year": 2025, "max_movies": 10}'
```

## Production Deployment

For production, consider:

- Using a production WSGI server (gunicorn, uWSGI)
- Storing sessions in a database (Redis, PostgreSQL)
- Adding authentication/authorization
- Implementing rate limiting
- Using environment variables for configuration
- Setting up proper logging and monitoring

### Example with Gunicorn

```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 movie_ranker_api:app
```

## License

This project is open source and available for personal and commercial use.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues or questions, please open an issue on GitHub.

