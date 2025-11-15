# Movie Ranking App

A Python GUI application that helps you rank movies using a merge sort algorithm with binary choices. The app fetches movies from The Movie Database (TMDb) API and presents them in pairs for you to compare and rank.

## Features

- **TMDb API Integration**: Fetches movies by year with artwork/posters
- **Merge Sort Ranking**: Uses merge sort algorithm to efficiently rank movies through binary comparisons
- **Beautiful GUI**: Displays movie posters and information side-by-side
- **Haven't Seen Option**: Skip movies you haven't seen (they'll be excluded from ranking)
- **Save/Export**: Save rankings as text files or JSON

## Setup

1. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Get a TMDb API Key**:
   - Go to https://www.themoviedb.org/settings/api
   - Create a free account if you don't have one
   - Request an API key
   - Copy your API key

3. **Run the application**:
   ```bash
   python movie_ranker.py
   ```

4. **Configure API Key**:
   - Enter your TMDb API key in the app
   - Click "Save" to store it locally (saved in `tmdb_api_key.txt`)

## Usage

1. **Load Movies**:
   - Enter a year (e.g., 2025)
   - Set maximum number of movies to load (default: 50)
   - Click "Load Movies"

2. **Start Ranking**:
   - Click "Start Ranking"
   - The app will present two movies at a time

3. **Make Choices**:
   - Click "Prefer This Movie" for the movie you like better
   - Click "Haven't Seen (Skip Both)" if you haven't seen one or both movies
   - Continue until all movies are ranked

4. **View Results**:
   - The final ranking appears in the results section
   - Click "Save Results" to save as a text file
   - Click "Export to JSON" to export as JSON

## How It Works

The app uses a **merge sort algorithm** to rank movies:

1. Starts with individual movies (each is a sorted list of 1)
2. Pairs up lists and merges them by asking you to compare movies
3. Continues merging until all movies are in one sorted list
4. The final list is your complete ranking

This approach is efficient and ensures all movies are properly compared to create an accurate ranking.

## Files

- `movie_ranker.py` - Main application
- `requirements.txt` - Python dependencies
- `tmdb_api_key.txt` - Your saved API key (created after first save)
- `movie_ranking_YYYY.txt` - Saved ranking results
- `movie_ranking_YYYY.json` - Exported JSON results

## Notes

- The app requires an internet connection to fetch movies and posters
- API key is stored locally in plain text (keep it secure)
- Movie posters are loaded from TMDb's CDN
- The merge sort algorithm ensures O(n log n) comparisons

## Troubleshooting

- **"Failed to load movies"**: Check your API key and internet connection
- **"Poster Not Available"**: Some movies may not have posters in TMDb
- **Slow loading**: Large movie sets may take time to load and rank

