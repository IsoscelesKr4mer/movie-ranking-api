from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os
from typing import List, Dict, Optional
import uuid
from datetime import datetime, timedelta

app = Flask(__name__)
# Enable CORS for all routes and origins - allow requests from localhost and any domain
CORS(app, origins="*", methods=["GET", "POST", "DELETE", "OPTIONS"], allow_headers=["Content-Type"])

# Configuration
API_BASE = "https://api.themoviedb.org/3"
IMAGE_BASE = "https://image.tmdb.org/t/p/w500"

# Curated Movie Categories
# Categories use either TMDb collection IDs or curated movie ID lists
MOVIE_CATEGORIES = {
    "marvel_mcu": {
        "name": "Marvel Cinematic Universe",
        "description": "All MCU movies",
        "collection_id": 86311,  # Marvel Cinematic Universe Collection
        "keyword_id": 180547,  # MCU keyword for Discover endpoint (better for posters)
        "movie_ids": None  # Will fetch from collection or keyword
    },
    "pixar": {
        "name": "Pixar Movies",
        "description": "All Pixar animated films",
        "collection_id": None,
        "movie_ids": [862, 863, 10193, 301528, 12, 127380, 49026, 260513, 14160, 508439, 508442, 585083, 508947]
    },
    "star_wars": {
        "name": "Star Wars Movies",
        "description": "All Star Wars films",
        "collection_id": 10,  # Star Wars Collection
        "movie_ids": None
    },
    "harry_potter": {
        "name": "Harry Potter Series",
        "description": "All Harry Potter films",
        "collection_id": 1241,  # Harry Potter Collection
        "movie_ids": None
    },
    "fast_furious": {
        "name": "Fast & Furious",
        "description": "The Fast and the Furious franchise",
        "collection_id": 9485,  # Fast & Furious Collection
        "movie_ids": None
    },
    "james_bond": {
        "name": "James Bond Films",
        "description": "James Bond movies",
        "collection_id": 645,  # James Bond Collection
        "movie_ids": None
    },
    "lord_of_the_rings": {
        "name": "Lord of the Rings & The Hobbit",
        "description": "LOTR and Hobbit trilogies",
        "collection_id": 119,  # Lord of the Rings Collection
        "movie_ids": None
    },
    "mission_impossible": {
        "name": "Mission: Impossible",
        "description": "Mission: Impossible franchise",
        "collection_id": 87359,  # Mission: Impossible Collection
        "movie_ids": None
    },
    "batman_christopher_nolan": {
        "name": "Christopher Nolan's Batman Trilogy",
        "description": "The Dark Knight trilogy",
        "collection_id": None,
        "movie_ids": [272, 155, 49026]  # Batman Begins, The Dark Knight, The Dark Knight Rises (49026 corrected)
    },
    "matrix": {
        "name": "The Matrix",
        "description": "The Matrix franchise",
        "collection_id": 469,  # The Matrix Collection
        "movie_ids": None
    },
    "xmen": {
        "name": "X-Men Films",
        "description": "X-Men movie franchise",
        "collection_id": 263,  # X-Men Collection
        "movie_ids": None
    }
}

# Load API key from file or environment variable
def load_api_key():
    # First check environment variable (for deployment)
    api_key = os.getenv("TMDB_API_KEY")
    if api_key:
        return api_key
    
    # Fall back to file (for local development)
    try:
        if os.path.exists("tmdb_api_key.txt"):
            with open("tmdb_api_key.txt", "r") as f:
                return f.read().strip()
    except Exception:
        pass
    return None

API_KEY = load_api_key()

# In-memory session storage (use Redis/database in production)
sessions = {}

class MovieRankingSession:
    """Manages a single user's movie ranking session"""
    
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.movies: List[Dict] = []
        self.selected_movies: List[Dict] = []  # Movies selected by user (ones they've seen)
        self.ranked_movies: List[Dict] = []
        self.unseen_movies: List[Dict] = []
        self.is_ranking = False
        self.merge_sort_state = {
            "sorted_sublists": [],
            "current_merge": None,
            "merge_stack": []
        }
        self.current_comparison: Optional[Dict] = None
        self.created_at = datetime.now()
    
    def load_movies(self, year: int = None, max_movies: int = 50, category: str = None):
        """Load movies from TMDb API by year or category"""
        if not API_KEY:
            raise ValueError("TMDb API key not configured")
        
        all_movies = []
        
        if category:
            # Load from category
            all_movies = self._load_movies_from_category(category, max_movies)
        elif year:
            # Load from year (original functionality)
            url = f"{API_BASE}/discover/movie"
            params = {
                "api_key": API_KEY,
                "primary_release_year": year,
                "sort_by": "popularity.desc",
                "page": 1
            }
            
            page = 1
            while len(all_movies) < max_movies and page <= 5:
                params["page"] = page
                response = requests.get(url, params=params, timeout=10)
                response.raise_for_status()
                data = response.json()
                
                for movie in data.get("results", []):
                    if movie.get("poster_path") and movie.get("title"):
                        all_movies.append(self._format_movie(movie))
                        if len(all_movies) >= max_movies:
                            break
                
                if not data.get("results"):
                    break
                page += 1
        else:
            raise ValueError("Must provide either year or category")
        
        self.movies = all_movies[:max_movies]
        # Reset selected movies when new movies are loaded
        self.selected_movies = []
        return len(self.movies)
    
    def _load_movies_from_category(self, category: str, max_movies: int = 50):
        """Load movies from a curated category"""
        if category not in MOVIE_CATEGORIES:
            raise ValueError(f"Unknown category: {category}")
        
        cat_info = MOVIE_CATEGORIES[category]
        movies = []
        
        # Prefer collection for all categories (most reliable and curated)
        # Only use keyword as fallback if collection doesn't work
        if cat_info.get("collection_id"):
            movies = self._load_from_collection(cat_info["collection_id"], max_movies)
        
        # Fall back to keyword only if collection didn't work (and keyword exists)
        if not movies and cat_info.get("keyword_id"):
            movies = self._load_from_keyword(cat_info["keyword_id"], max_movies)
        
        # If no collection or movies not loaded, use curated movie IDs
        if not movies and cat_info.get("movie_ids"):
            movie_ids = cat_info["movie_ids"][:max_movies]
            movies = self._load_movies_by_ids(movie_ids)
        
        return movies
    
    def _load_from_keyword(self, keyword_id: int, max_movies: int = 100):
        """Load movies from TMDb using keyword (best for MCU - ensures all have posters)"""
        try:
            url = f"{API_BASE}/discover/movie"
            params = {
                "api_key": API_KEY,
                "with_keywords": keyword_id,
                "sort_by": "release_date.asc",
                "include_adult": False,
                "language": "en-US"
            }
            
            all_movies = []
            page = 1
            
            # TMDb Discover can return multiple pages
            while len(all_movies) < max_movies and page <= 5:
                params["page"] = page
                response = requests.get(url, params=params, timeout=10)
                response.raise_for_status()
                data = response.json()
                
                results = data.get("results", [])
                if not results:
                    break
                
                for movie in results:
                    # Strict filtering: only theatrical movies with proper releases
                    if not movie.get("title") or not movie.get("release_date"):
                        continue
                    
                    # Filter out low-vote items (shorts, obscure releases, TV movies)
                    vote_count = movie.get("vote_count", 0)
                    if vote_count < 100:  # Require at least 100 votes (real theatrical releases)
                        continue
                    
                    # Exclude documentaries and certain genres
                    genre_ids = movie.get("genre_ids", [])
                    # 99 = Documentary, 10402 = TV Movie
                    if 99 in genre_ids or 10402 in genre_ids:
                        continue
                    
                    formatted_movie = self._format_movie(movie)
                    if formatted_movie:  # Make sure formatting succeeded
                        all_movies.append(formatted_movie)
                        
                        # Stop when we reach max_movies
                        if len(all_movies) >= max_movies:
                            break
                
                # Check if there are more pages
                total_pages = data.get("total_pages", 1)
                if page >= total_pages:
                    break
                page += 1
            
            print(f"Loaded {len(all_movies)} movies from keyword {keyword_id}")
            return all_movies
        except Exception as e:
            print(f"Error loading from keyword {keyword_id}: {e}")
            return []
    
    def _load_from_collection(self, collection_id: int, max_movies: int = 100):
        """Load movies from a TMDb collection"""
        try:
            url = f"{API_BASE}/collection/{collection_id}"
            params = {"api_key": API_KEY}
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            movies = []
            # Get all parts from the collection (TMDb collections can have many movies)
            parts = data.get("parts", [])
            
            # Filter and load movies (still prefer movies with posters, but include all if needed)
            for movie in parts:
                # Filter: only include actual theatrical movies (collections can include shorts/TV)
                if movie.get("title") and movie.get("release_date"):
                    # Skip very old or very new movies that might be shorts/documentaries
                    # Or movies with very low popularity
                    vote_count = movie.get("vote_count", 0)
                    if vote_count < 20:  # Skip low-vote items
                        continue
                    
                    formatted_movie = self._format_movie(movie)
                    if formatted_movie:  # Make sure formatting succeeded
                        movies.append(formatted_movie)
                        
                        # Stop when we reach max_movies (but don't cut off early)
                        if len(movies) >= max_movies:
                            break
            
            print(f"Loaded {len(movies)} movies from collection {collection_id} (total parts: {len(parts)})")
            return movies
        except Exception as e:
            print(f"Error loading from collection {collection_id}: {e}")
            return []
    
    def _load_movies_by_ids(self, movie_ids: List[int]):
        """Load movies by their TMDb IDs"""
        movies = []
        for movie_id in movie_ids:
            try:
                url = f"{API_BASE}/movie/{movie_id}"
                params = {"api_key": API_KEY}
                response = requests.get(url, params=params, timeout=10)
                response.raise_for_status()
                movie = response.json()
                
                if movie.get("poster_path") and movie.get("title"):
                    movies.append(self._format_movie(movie))
            except Exception as e:
                print(f"Error loading movie {movie_id}: {e}")
                continue
        
        return movies
    
    def _format_movie(self, movie: Dict) -> Optional[Dict]:
        """Format a movie from TMDb API response"""
        # Require at least an ID and title
        if not movie.get("id") or not movie.get("title"):
            return None
            
        return {
            "id": movie["id"],
            "title": movie.get("title", ""),
            "poster_path": movie.get("poster_path", ""),
            "poster_url": f"{IMAGE_BASE}{movie.get('poster_path', '')}" if movie.get("poster_path") else "",
            "release_date": movie.get("release_date", ""),
            "vote_average": movie.get("vote_average", 0),
            "overview": (movie.get("overview", "")[:200] + "...") if movie.get("overview") else ""
        }
    
    def select_movies(self, movie_ids: List[int]):
        """Select movies that the user has seen (by their TMDb IDs)"""
        if not self.movies:
            raise ValueError("No movies loaded")
        
        selected = []
        for movie_id in movie_ids:
            movie = next((m for m in self.movies if m.get("id") == movie_id), None)
            if movie:
                selected.append(movie)
        
        self.selected_movies = selected
        return len(self.selected_movies)
    
    def start_ranking(self):
        """Start the ranking process"""
        # Use selected_movies if available, otherwise fall back to all movies
        movies_to_rank = self.selected_movies if self.selected_movies else self.movies
        
        if not movies_to_rank:
            raise ValueError("No movies selected or loaded")
        
        if len(movies_to_rank) < 2:
            raise ValueError("Need at least 2 movies to rank")
        
        self.is_ranking = True
        self.ranked_movies = []
        self.unseen_movies = []
        
        # Filter out unseen movies (for skip functionality during ranking)
        movies_to_rank = [m for m in movies_to_rank if m not in self.unseen_movies]
        
        # Initialize merge sort state
        self.merge_sort_state = {
            "sorted_sublists": [[m] for m in movies_to_rank],
            "current_merge": None,
            "merge_stack": []
        }
        
        # Build initial merge stack
        self._prepare_merge_round()
        
        # Start first comparison
        self.next_comparison()
    
    def _prepare_merge_round(self):
        """Prepare the next round of merges"""
        sublists = self.merge_sort_state["sorted_sublists"]
        
        if len(sublists) <= 1:
            if sublists:
                self.ranked_movies = sublists[0]
            return
        
        new_sublists = []
        i = 0
        while i < len(sublists):
            if i + 1 < len(sublists):
                # Pair up two sublists
                self.merge_sort_state["merge_stack"].append({
                    "left": sublists[i],
                    "right": sublists[i + 1],
                    "left_idx": 0,
                    "right_idx": 0,
                    "result": []
                })
                i += 2
            else:
                # Odd one out, add to next round
                new_sublists.append(sublists[i])
                i += 1
        
        self.merge_sort_state["sorted_sublists"] = new_sublists
    
    def next_comparison(self):
        """Get the next comparison to make"""
        if not self.is_ranking:
            return None
        
        # Check if we have an active merge
        if self.merge_sort_state["current_merge"]:
            merge = self.merge_sort_state["current_merge"]
            left_list = merge["left"]
            right_list = merge["right"]
            left_idx = merge["left_idx"]
            right_idx = merge["right_idx"]
            
            # Check if merge is complete
            if left_idx >= len(left_list) and right_idx >= len(right_list):
                self.merge_sort_state["current_merge"] = None
                return self.next_comparison()
            elif left_idx >= len(left_list):
                # Left exhausted, add remaining right (filter unseen)
                remaining = [m for m in right_list[right_idx:] if m not in self.unseen_movies]
                merge["result"].extend(remaining)
                self._complete_current_merge()
                return self.next_comparison()
            elif right_idx >= len(right_list):
                # Right exhausted, add remaining left (filter unseen)
                remaining = [m for m in left_list[left_idx:] if m not in self.unseen_movies]
                merge["result"].extend(remaining)
                self._complete_current_merge()
                return self.next_comparison()
            else:
                # Need to compare - skip if movies are already unseen
                left_movie = left_list[left_idx]
                right_movie = right_list[right_idx]
                
                # Skip if either movie is already marked as unseen
                if left_movie in self.unseen_movies:
                    merge["left_idx"] += 1
                    return self.next_comparison()
                if right_movie in self.unseen_movies:
                    merge["right_idx"] += 1
                    return self.next_comparison()
                
                self.current_comparison = {
                    "left_movie": left_movie,
                    "right_movie": right_movie,
                    "merge": merge
                }
                return {
                    "left_movie": left_movie,
                    "right_movie": right_movie
                }
        
        # No active merge, get next from stack
        if self.merge_sort_state["merge_stack"]:
            merge = self.merge_sort_state["merge_stack"].pop(0)
            self.merge_sort_state["current_merge"] = merge
            return self.next_comparison()
        else:
            # Current round done, prepare next round
            if len(self.merge_sort_state["sorted_sublists"]) > 1:
                self._prepare_merge_round()
                return self.next_comparison()
            else:
                # All done!
                if self.merge_sort_state["sorted_sublists"]:
                    self.ranked_movies = self.merge_sort_state["sorted_sublists"][0]
                self.finish_ranking()
                return None
    
    def _complete_current_merge(self):
        """Complete the current merge and add result to sorted_sublists"""
        merge = self.merge_sort_state["current_merge"]
        self.merge_sort_state["sorted_sublists"].append(merge["result"])
        self.merge_sort_state["current_merge"] = None
    
    def make_choice(self, choice: str):
        """Handle user's choice: 'left', 'right', or 'skip'"""
        if not self.current_comparison:
            raise ValueError("No active comparison")
        
        left_movie = self.current_comparison["left_movie"]
        right_movie = self.current_comparison["right_movie"]
        merge = self.current_comparison["merge"]
        
        if choice == "skip":
            # User hasn't seen one or both movies
            if left_movie not in self.unseen_movies:
                self.unseen_movies.append(left_movie)
            if right_movie not in self.unseen_movies:
                self.unseen_movies.append(right_movie)
            
            merge["left_idx"] += 1
            merge["right_idx"] += 1
            
        elif choice == "left":
            # Prefer left movie
            if left_movie not in self.unseen_movies:
                merge["result"].append(left_movie)
            merge["left_idx"] += 1
            
        elif choice == "right":
            # Prefer right movie
            if right_movie not in self.unseen_movies:
                merge["result"].append(right_movie)
            merge["right_idx"] += 1
        else:
            raise ValueError(f"Invalid choice: {choice}. Must be 'left', 'right', or 'skip'")
        
        # Get next comparison
        return self.next_comparison()
    
    def finish_ranking(self):
        """Finish the ranking process"""
        self.is_ranking = False
        self.current_comparison = None
        
        # Filter out unseen movies from final ranking
        self.ranked_movies = [m for m in self.ranked_movies if m not in self.unseen_movies]
        
        # Ensure all seen movies are in ranked list
        for movie in self.movies:
            if movie not in self.ranked_movies and movie not in self.unseen_movies:
                self.ranked_movies.append(movie)
    
    def get_status(self):
        """Get current ranking status"""
        total_movies = len(self.movies)
        ranked_count = len(self.ranked_movies)
        
        return {
            "is_ranking": self.is_ranking,
            "total_movies": total_movies,
            "ranked_count": ranked_count,
            "unseen_count": len(self.unseen_movies),
            "has_comparison": self.current_comparison is not None
        }
    
    def get_results(self):
        """Get final ranking results"""
        return {
            "ranked_movies": self.ranked_movies,
            "unseen_movies": self.unseen_movies,
            "total_ranked": len(self.ranked_movies)
        }


# API Endpoints

@app.route('/', methods=['GET'])
def root():
    """Root endpoint with API information"""
    return jsonify({
        "name": "Movie Ranking API",
        "version": "1.0.0",
        "description": "REST API for ranking movies using merge sort algorithm",
            "endpoints": {
                "health": "/api/health",
                "categories": "/api/categories",
                "create_session": "/api/session/create",
                "load_movies": "/api/session/<session_id>/movies/load",
                "select_movies": "/api/session/<session_id>/movies/select",
                "start_ranking": "/api/session/<session_id>/ranking/start",
                "get_current": "/api/session/<session_id>/ranking/current",
                "make_choice": "/api/session/<session_id>/ranking/choice",
                "get_status": "/api/session/<session_id>/ranking/status",
                "get_results": "/api/session/<session_id>/ranking/results",
                "delete_session": "/api/session/<session_id>"
            },
        "documentation": "See README_API.md for detailed API documentation",
        "github": "https://github.com/IsoscelesKr4mer/movie-ranking-api"
    }), 200

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "api_key_configured": API_KEY is not None
    }), 200


@app.route('/api/session/create', methods=['POST'])
def create_session():
    """Create a new ranking session"""
    session_id = str(uuid.uuid4())
    sessions[session_id] = MovieRankingSession(session_id)
    
    return jsonify({
        "session_id": session_id,
        "message": "Session created"
    }), 201


@app.route('/api/categories', methods=['GET'])
def get_categories():
    """Get list of available movie categories"""
    categories = {}
    for cat_id, cat_info in MOVIE_CATEGORIES.items():
        categories[cat_id] = {
            "name": cat_info["name"],
            "description": cat_info["description"]
        }
    
    return jsonify({
        "categories": categories
    }), 200


@app.route('/api/session/<session_id>/movies/load', methods=['POST'])
def load_movies(session_id: str):
    """Load movies for a session by year or category"""
    if session_id not in sessions:
        return jsonify({"error": "Session not found"}), 404
    
    data = request.get_json() or {}
    year = data.get('year')
    category = data.get('category')
    # For categories, allow more movies by default (categories can be large like MCU with 30+ movies)
    max_movies = data.get('max_movies', 100 if category else 50)
    
    if not year and not category:
        return jsonify({"error": "Must provide either 'year' or 'category'"}), 400
    
    try:
        session = sessions[session_id]
        count = session.load_movies(year=year, max_movies=max_movies, category=category)
        
        return jsonify({
            "message": f"Loaded {count} movies",
            "movie_count": count,
            "loaded_count": count,
            "movies": session.movies
        }), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Failed to load movies: {str(e)}"}), 500


@app.route('/api/session/<session_id>/movies/select', methods=['POST'])
def select_movies(session_id: str):
    """Select movies that the user has seen"""
    if session_id not in sessions:
        return jsonify({"error": "Session not found"}), 404
    
    data = request.get_json() or {}
    movie_ids = data.get('movie_ids', [])
    
    if not isinstance(movie_ids, list):
        return jsonify({"error": "movie_ids must be a list"}), 400
    
    try:
        session = sessions[session_id]
        count = session.select_movies(movie_ids)
        
        return jsonify({
            "message": f"Selected {count} movies",
            "selected_count": count,
            "selected_movies": session.selected_movies
        }), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Failed to select movies: {str(e)}"}), 500


@app.route('/api/session/<session_id>/ranking/start', methods=['POST'])
def start_ranking(session_id: str):
    """Start the ranking process"""
    if session_id not in sessions:
        return jsonify({"error": "Session not found"}), 404
    
    try:
        session = sessions[session_id]
        session.start_ranking()
        
        # Get first comparison
        comparison = session.next_comparison()
        
        if comparison:
            return jsonify({
                "message": "Ranking started",
                "comparison": comparison,
                "status": session.get_status()
            }), 200
        else:
            return jsonify({
                "message": "Ranking complete (no comparisons needed)",
                "results": session.get_results()
            }), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Failed to start ranking: {str(e)}"}), 500


@app.route('/api/session/<session_id>/ranking/current', methods=['GET'])
def get_current_comparison(session_id: str):
    """Get the current comparison"""
    if session_id not in sessions:
        return jsonify({"error": "Session not found"}), 404
    
    session = sessions[session_id]
    
    if not session.is_ranking:
        return jsonify({
            "error": "Ranking not in progress",
            "status": session.get_status()
        }), 400
    
    if session.current_comparison:
        return jsonify({
            "comparison": {
                "left_movie": session.current_comparison["left_movie"],
                "right_movie": session.current_comparison["right_movie"]
            },
            "status": session.get_status()
        }), 200
    else:
        # Try to get next comparison
        comparison = session.next_comparison()
        if comparison:
            return jsonify({
                "comparison": comparison,
                "status": session.get_status()
            }), 200
        else:
            return jsonify({
                "message": "No more comparisons",
                "results": session.get_results()
            }), 200


@app.route('/api/session/<session_id>/ranking/choice', methods=['POST'])
def make_choice(session_id: str):
    """Make a choice in the ranking"""
    if session_id not in sessions:
        return jsonify({"error": "Session not found"}), 404
    
    data = request.get_json()
    if not data or 'choice' not in data:
        return jsonify({"error": "Missing 'choice' field"}), 400
    
    choice = data['choice'].lower()
    if choice not in ['left', 'right', 'skip']:
        return jsonify({"error": "Choice must be 'left', 'right', or 'skip'"}), 400
    
    try:
        session = sessions[session_id]
        comparison = session.make_choice(choice)
        
        if comparison:
            return jsonify({
                "message": "Choice recorded",
                "comparison": comparison,
                "status": session.get_status()
            }), 200
        else:
            # Ranking complete
            return jsonify({
                "message": "Ranking complete",
                "results": session.get_results(),
                "status": session.get_status()
            }), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Failed to process choice: {str(e)}"}), 500


@app.route('/api/session/<session_id>/ranking/status', methods=['GET'])
def get_status(session_id: str):
    """Get ranking status"""
    if session_id not in sessions:
        return jsonify({"error": "Session not found"}), 404
    
    session = sessions[session_id]
    return jsonify({
        "status": session.get_status(),
        "has_results": len(session.ranked_movies) > 0
    }), 200


@app.route('/api/session/<session_id>/ranking/results', methods=['GET'])
def get_results(session_id: str):
    """Get final ranking results"""
    if session_id not in sessions:
        return jsonify({"error": "Session not found"}), 404
    
    session = sessions[session_id]
    return jsonify(session.get_results()), 200


@app.route('/api/session/<session_id>', methods=['DELETE'])
def delete_session(session_id: str):
    """Delete a session"""
    if session_id not in sessions:
        return jsonify({"error": "Session not found"}), 404
    
    del sessions[session_id]
    return jsonify({"message": "Session deleted"}), 200


if __name__ == '__main__':
    # Clean up old sessions on startup (older than 24 hours)
    print("Starting Movie Ranking API...")
    if not API_KEY:
        print("WARNING: TMDb API key not found. Please set TMDB_API_KEY environment variable or create tmdb_api_key.txt with your API key.")
    else:
        print("TMDb API key loaded successfully.")
    
    # Get port from environment variable (for deployment) or use 5000
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_ENV") == "development"
    app.run(debug=debug, host='0.0.0.0', port=port)

