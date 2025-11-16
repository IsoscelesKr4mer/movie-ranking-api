from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os
from typing import List, Dict, Optional
import uuid
from datetime import datetime, timedelta
import csv
import io
import re
from bs4 import BeautifulSoup

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
        "keyword_id": 12360,  # Pixar keyword for Discover endpoint
        "company_id": 3,  # Pixar Animation Studios company ID (for discover)
        "movie_ids": None  # Will fetch from keyword/company
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
        
        # For MCU, prefer keyword with proper filters (ensures only theatrical releases)
        if category == "marvel_mcu" and cat_info.get("keyword_id"):
            company_id = cat_info.get("company_id")
            movies = self._load_from_keyword(cat_info["keyword_id"], max_movies, company_id)
            # If keyword didn't return enough, fall back to collection
            if len(movies) < 20:  # MCU should have ~30+ movies
                print(f"Keyword returned only {len(movies)} movies, trying collection...")
                movies = []
        
        # For Pixar, try company filter first (more reliable than keyword+company combo)
        if category == "pixar" and cat_info.get("company_id"):
            movies = self._load_from_company(cat_info["company_id"], max_movies)
            # If company didn't work, try keyword without company filter
            if not movies or len(movies) < 20:
                print(f"Company filter returned {len(movies)} Pixar movies, trying keyword...")
                if cat_info.get("keyword_id"):
                    movies = self._load_from_keyword(cat_info["keyword_id"], max_movies, None)
        
        # Try collection (most reliable for curated lists, or as fallback)
        if not movies and cat_info.get("collection_id"):
            movies = self._load_from_collection(cat_info["collection_id"], max_movies)
        
        # Fall back to keyword only if collection didn't work (for categories with keywords)
        if not movies and cat_info.get("keyword_id"):
            company_id = cat_info.get("company_id")
            movies = self._load_from_keyword(cat_info["keyword_id"], max_movies, company_id)
        
        # If no collection or movies not loaded, use curated movie IDs
        if not movies and cat_info.get("movie_ids"):
            movie_ids = cat_info["movie_ids"][:max_movies]
            movies = self._load_movies_by_ids(movie_ids)
        
        return movies
    
    def _load_from_keyword(self, keyword_id: int, max_movies: int = 100, company_id: int = None):
        """Load movies from TMDb using keyword with proper filters for theatrical releases only"""
        try:
            url = f"{API_BASE}/discover/movie"
            params = {
                "api_key": API_KEY,
                "with_keywords": keyword_id,
                "sort_by": "release_date.asc",
                "include_adult": False,
                "language": "en-US",
                "without_genres": "99",  # Exclude documentaries
                "with_runtime.gte": 60,  # Only feature films 60+ minutes (excludes shorts and TV specials ~45-55 min)
                # Release types: 2=Theatrical Limited, 3=Theatrical Wide, 4=Digital (streaming)
                # Include both theatrical and digital to catch streaming-exclusive releases
                "with_release_type": "2|3|4",  # Theatrical + Digital releases (includes streaming)
                "include_video": False  # Exclude direct-to-video format (not about streaming platforms)
            }
            
            # Add company filter if provided (e.g., for Pixar - company ID 3)
            if company_id:
                params["with_companies"] = company_id
            
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
                    # Basic validation - API filters should handle most filtering
                    if not movie.get("title") or not movie.get("release_date"):
                        continue
                    
                    # Exclude known TV specials by title (Disney+ specials that slip through)
                    title_lower = movie.get("title", "").lower()
                    special_keywords = [
                        "holiday special",  # The Guardians of the Galaxy Holiday Special
                        "werewolf by night"  # Werewolf by Night (2022 Disney+ special)
                    ]
                    if any(keyword in title_lower for keyword in special_keywords):
                        continue
                    
                    # Additional runtime check - feature films are typically 70+ minutes
                    # (API filter is 60, but some TV specials are 45-60 min)
                    runtime = movie.get("runtime", 0)
                    if runtime > 0 and runtime < 70:  # Skip if runtime is less than 70 minutes
                        continue
                    
                    # Additional safety check: exclude TV movies by genre if present
                    genre_ids = movie.get("genre_ids", [])
                    # 10402 = TV Movie (though with_release_type should exclude these)
                    if 10402 in genre_ids:
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
            
            # Sort movies by release date (earliest first) - API already sorts, but ensure consistency
            all_movies.sort(key=lambda m: m.get("release_date", "") or "9999-12-31")
            
            print(f"Loaded {len(all_movies)} theatrical movies from keyword {keyword_id}")
            return all_movies
        except Exception as e:
            print(f"Error loading from keyword {keyword_id}: {e}")
            return []
    
    def _load_from_company(self, company_id: int, max_movies: int = 100):
        """Load movies from TMDb using company filter (e.g., Pixar Animation Studios)"""
        try:
            url = f"{API_BASE}/discover/movie"
            params = {
                "api_key": API_KEY,
                "with_companies": company_id,
                "sort_by": "release_date.asc",
                "include_adult": False,
                "language": "en-US",
                "without_genres": "99",  # Exclude documentaries
                "with_runtime.gte": 60,  # Only feature films 60+ minutes
                "with_release_type": "2|3|4",  # Theatrical + Digital releases (includes streaming)
                "include_video": False  # Exclude direct-to-video format
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
                    # Basic validation
                    if not movie.get("title") or not movie.get("release_date"):
                        continue
                    
                    # Runtime check - feature films are typically 70+ minutes
                    runtime = movie.get("runtime", 0)
                    if runtime > 0 and runtime < 70:  # Skip if runtime is less than 70 minutes
                        continue
                    
                    # Exclude TV movies by genre if present
                    genre_ids = movie.get("genre_ids", [])
                    if 10402 in genre_ids:  # TV Movie
                        continue
                    
                    formatted_movie = self._format_movie(movie)
                    if formatted_movie:
                        all_movies.append(formatted_movie)
                        
                        if len(all_movies) >= max_movies:
                            break
                
                # Check if there are more pages
                total_pages = data.get("total_pages", 1)
                if page >= total_pages:
                    break
                page += 1
            
            # Sort movies by release date (earliest first)
            all_movies.sort(key=lambda m: m.get("release_date", "") or "9999-12-31")
            
            print(f"Loaded {len(all_movies)} movies from company {company_id}")
            return all_movies
        except Exception as e:
            print(f"Error loading from company {company_id}: {e}")
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
            print(f"Collection {collection_id} has {len(parts)} total parts")
            
            # Filter and load movies (still prefer movies with posters, but include all if needed)
            for movie in parts:
                # Filter: only include actual theatrical movies (collections can include shorts/TV)
                if not movie.get("title"):
                    continue
                    
                # For collections, be lenient - they're already curated
                # Only skip obvious non-movies (no release date might mean unreleased or TV)
                if not movie.get("release_date"):
                    # Skip items without release date (likely unreleased or TV)
                    continue
                
                # Check media type - skip if it's a TV show (if available in data)
                media_type = movie.get("media_type")
                if media_type == "tv":  # Skip TV shows if present
                    continue
                
                # For MCU collection specifically, be very lenient (all should be theatrical movies)
                # Only skip if it has very few votes AND looks like a short/documentary
                vote_count = movie.get("vote_count", 0)
                if vote_count < 5:  # Only skip items with extremely few votes
                    # Check if it's likely a short/documentary by title or other indicators
                    title_lower = movie.get("title", "").lower()
                    if any(word in title_lower for word in ["short", "documentary", "specials", "one-shot"]):
                        continue
                
                formatted_movie = self._format_movie(movie)
                if formatted_movie:  # Make sure formatting succeeded
                    movies.append(formatted_movie)
                    
                    # Stop when we reach max_movies (but don't cut off early)
                    if len(movies) >= max_movies:
                        break
            
            # Sort movies by release date (earliest first)
            movies.sort(key=lambda m: m.get("release_date", "") or "9999-12-31")
            
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
        
        # Sort movies by release date (earliest first)
        movies.sort(key=lambda m: m.get("release_date", "") or "9999-12-31")
        
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
    
    def _search_movie_tmdb(self, title: str, year: Optional[int] = None) -> Optional[Dict]:
        """Search for a movie in TMDb by title and optionally year"""
        try:
            url = f"{API_BASE}/search/movie"
            params = {
                "api_key": API_KEY,
                "query": title,
                "include_adult": False,
                "language": "en-US"
            }
            
            if year:
                params["year"] = year
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            results = data.get("results", [])
            if not results:
                return None
            
            # If year provided, prefer exact match, otherwise use first result
            if year:
                for movie in results:
                    release_date = movie.get("release_date", "")
                    if release_date:
                        release_year = int(release_date.split("-")[0])
                        if release_year == year:
                            # Get full movie details
                            return self._get_movie_details(movie["id"])
            
            # Return first result with full details
            return self._get_movie_details(results[0]["id"])
        except Exception as e:
            print(f"Error searching for movie '{title}' ({year}): {e}")
            return None
    
    def _get_movie_details(self, movie_id: int) -> Optional[Dict]:
        """Get full movie details from TMDb"""
        try:
            url = f"{API_BASE}/movie/{movie_id}"
            params = {"api_key": API_KEY}
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            movie = response.json()
            return self._format_movie(movie)
        except Exception as e:
            print(f"Error getting movie details for ID {movie_id}: {e}")
            return None
    
    def import_letterboxd_csv(self, csv_content: str) -> int:
        """Import movies from a Letterboxd CSV file"""
        if not API_KEY:
            raise ValueError("TMDb API key not configured")
        
        imported_movies = []
        failed_imports = []
        
        # Parse CSV content
        csv_file = io.StringIO(csv_content)
        
        # Letterboxd CSV format: Name,Year,URL (and potentially other columns)
        # Handle both with and without header row
        reader = csv.DictReader(csv_file)
        
        for row in reader:
            # Letterboxd uses "Name" for title, sometimes "Title"
            title = row.get("Name") or row.get("Title") or row.get("name") or row.get("title")
            year_str = row.get("Year") or row.get("year")
            
            if not title:
                continue
            
            # Parse year (handle empty strings, non-numeric values)
            year = None
            if year_str:
                try:
                    year = int(year_str.strip())
                except (ValueError, AttributeError):
                    pass
            
            # Search for movie in TMDb
            movie = self._search_movie_tmdb(title, year)
            
            if movie:
                # Check for duplicates
                if not any(m.get("id") == movie.get("id") for m in imported_movies):
                    imported_movies.append(movie)
            else:
                failed_imports.append({"title": title, "year": year})
        
        # Sort by release date
        imported_movies.sort(key=lambda m: m.get("release_date", "") or "9999-12-31")
        
        # Store imported movies
        self.movies = imported_movies
        
        if failed_imports:
            print(f"Failed to import {len(failed_imports)} movies: {failed_imports[:5]}...")
        
        return len(imported_movies)
    
    def import_letterboxd_url(self, letterboxd_url: str) -> int:
        """Import movies from a Letterboxd list URL"""
        if not API_KEY:
            raise ValueError("TMDb API key not configured")
        
        imported_movies = []
        failed_imports = []
        
        try:
            # Fetch the Letterboxd page
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
            response = requests.get(letterboxd_url, headers=headers, timeout=15)
            response.raise_for_status()
            
            # Debug: Check if response contains film links
            response_text = response.text
            film_link_count = len(re.findall(r'/film/[^/"\'\s]+', response_text))
            print(f"DEBUG: Found {film_link_count} /film/ links in raw HTML response")
            
            # Parse HTML
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Try to find embedded JSON data in script tags (Letterboxd often embeds data here)
            script_tags = soup.find_all('script')
            json_data = None
            for script in script_tags:
                if script.string:
                    # Look for JSON-LD or window.__INITIAL_STATE__ or similar
                    if 'window.__' in script.string or '__INITIAL_STATE__' in script.string or 'film' in script.string.lower():
                        # Try to extract JSON
                        json_match = re.search(r'\{[^{}]*"films?"[^{}]*\}', script.string)
                        if json_match:
                            try:
                                import json
                                json_data = json.loads(json_match.group())
                                print(f"DEBUG: Found embedded JSON data")
                            except:
                                pass
            
            # Also check for data attributes or meta tags
            meta_tags = soup.find_all('meta', property=re.compile(r'film|movie'))
            if meta_tags:
                print(f"DEBUG: Found {len(meta_tags)} film-related meta tags")
            
            # Letterboxd list structure: movies are in <li> elements with class "listitem" or "poster-container"
            # Each contains an <a> tag with href="/film/..." and data-film-slug
            # Try multiple strategies to find film items
            
            film_items = []
            
            # Strategy 1: Look for list items with poster containers (most common for lists)
            film_items = soup.find_all('li', class_=lambda x: x and ('listitem' in ' '.join(x) or 'poster-container' in ' '.join(x)))
            
            if not film_items:
                # Strategy 2: Look for any <li> with a film link inside
                all_li = soup.find_all('li')
                film_items = [li for li in all_li if li.find('a', href=re.compile(r'/film/'))]
            
            if not film_items:
                # Strategy 3: Look for divs with poster classes
                film_items = soup.find_all('div', class_=lambda x: x and ('poster' in ' '.join(x).lower() or 'listitem' in ' '.join(x).lower()))
            
            if not film_items:
                # Strategy 4: Just find all links to /film/ pages and use their parent elements
                film_links = soup.find_all('a', href=re.compile(r'/film/'))
                film_items = [link.find_parent(['li', 'div']) or link for link in film_links]
            
            # Strategy 5: Check if content is in script tags (Letterboxd sometimes embeds JSON)
            if not film_items or len(film_items) < 5:
                # Look for script tags with JSON data
                script_tags = soup.find_all('script', type=re.compile(r'application/json|text/javascript'))
                for script in script_tags:
                    content = script.string
                    if content and '/film/' in content:
                        # Try to extract film links from JSON/JS
                        film_matches = re.findall(r'/film/([^/"\']+)', content)
                        if film_matches:
                            print(f"Found {len(film_matches)} film slugs in script tags")
                            # Create pseudo-items for these
                            for slug in film_matches:
                                # Remove year if present
                                slug_clean = re.sub(r'-\d{4}$', '', slug)
                                # Create a minimal item dict
                                film_items.append({"slug": slug_clean, "href": f"/film/{slug}"})
            
            # Strategy 6: Last resort - find ANY link with /film/ in href (most aggressive)
            if not film_items or len(film_items) < 5:
                all_film_links = soup.find_all('a', href=re.compile(r'/film/'))
                print(f"Strategy 6: Found {len(all_film_links)} total /film/ links in HTML")
                if all_film_links:
                    film_items = all_film_links
            
            # Strategy 7: Try regex extraction directly from response text as last resort
            if not film_items or len(film_items) < 5:
                # Extract all unique film slugs from the raw HTML
                film_slugs = re.findall(r'/film/([^/"\'\s<>?&#]+)', response_text)
                unique_slugs = list(set(film_slugs))
                print(f"Strategy 7: Found {len(unique_slugs)} unique film slugs via regex")
                if unique_slugs:
                    # Filter out obviously wrong matches (like CSS classes, etc.)
                    valid_slugs = [s for s in unique_slugs if len(s) > 3 and not s.startswith('css') and not s.startswith('http')]
                    print(f"Strategy 7: {len(valid_slugs)} valid slugs after filtering")
                    # Create pseudo-items from slugs
                    for slug in valid_slugs[:100]:  # Limit to 100 to avoid too many
                        film_items.append({"slug": slug, "href": f"/film/{slug}"})
            
            print(f"Found {len(film_items)} potential film items on Letterboxd page")
            
            # Debug: Print first few items for troubleshooting
            if film_items:
                print(f"DEBUG: First 3 items: {[str(item)[:100] for item in film_items[:3]]}")
            
            # Extract movie titles and years
            movies_to_search = []
            seen_titles = set()
            
            for item in film_items:
                # Try to extract title and year from various possible structures
                title = None
                year = None
                
                # Handle dict items from script tag parsing
                if isinstance(item, dict):
                    href = item.get('href', '')
                    slug = item.get('slug', '')
                    if slug:
                        title = slug.replace('-', ' ').replace('_', ' ').title()
                        # Try to extract year from original slug if available
                        if 'href' in item and item['href']:
                            year_match = re.search(r'-(\d{4})', item['href'])
                            if year_match:
                                year = int(year_match.group(1))
                    if href and not title:
                        match = re.search(r'/film/([^/?#]+)', href)
                        if match:
                            title_slug = match.group(1)
                            year_match = re.search(r'-(\d{4})$', title_slug)
                            if year_match:
                                year = int(year_match.group(1))
                                title_slug = title_slug[:-5]
                            title = title_slug.replace('-', ' ').replace('_', ' ').title()
                
                # Handle BeautifulSoup Tag objects
                if not title:
                    # First, find the film link (most reliable source)
                    link = None
                    if hasattr(item, 'get') and item.name == 'a':
                        # Item is already a link
                        if item.get('href') and '/film/' in item.get('href', ''):
                            link = item
                    elif hasattr(item, 'find'):
                        # Find link within the item
                        link = item.find('a', href=re.compile(r'/film/'))
                    
                    # Extract from link href (most reliable - format: /film/film-name-year/ or /film/film-name/)
                    if link:
                        href = link.get('href', '')
                        # Extract film slug from URL (e.g., /film/the-matrix-1999/ or /film/the-matrix/)
                        match = re.search(r'/film/([^/?#]+)', href)
                        if match:
                            title_slug = match.group(1)
                            # Check if year is in the slug (e.g., "the-matrix-1999")
                            year_match = re.search(r'-(\d{4})$', title_slug)
                            if year_match:
                                year = int(year_match.group(1))
                                title_slug = title_slug[:-5]  # Remove -YYYY
                            
                            # Convert URL slug to title (replace hyphens with spaces, title case)
                            title = title_slug.replace('-', ' ').replace('_', ' ').title()
                
                # Method 1: Look for film-title or similar in text content
                if not title:
                    title_elem = item.find(class_=lambda x: x and any(word in ' '.join(x).lower() for word in ['film-title', 'film-name', 'title']))
                    if title_elem:
                        title = title_elem.get_text(strip=True)
                
                # Method 2: Look for data attributes (Letterboxd uses data-film-slug, data-film-name, etc.)
                if not title:
                    title = (item.get('data-film-name') or 
                            item.get('data-film-title') or
                            (link and link.get('data-film-name')) or
                            (link and link.get('data-film-title')))
                
                # Method 3: Extract title from img alt attribute (posters have alt text with film name)
                if not title:
                    img = item.find('img')
                    if img:
                        alt_text = img.get('alt', '')
                        if alt_text and alt_text.strip():
                            title = alt_text.strip()
                
                # Extract year from various sources
                if not year:
                    year_elem = item.find(class_=lambda x: x and any(word in ' '.join(x).lower() for word in ['film-year', 'year', 'release-year']))
                    if year_elem:
                        year_text = year_elem.get_text(strip=True)
                        year_match = re.search(r'\d{4}', year_text)
                        if year_match:
                            year = int(year_match.group())
                
                # Also try to extract year from data attributes
                if not year:
                    year_text = (item.get('data-film-year') or 
                                item.get('data-film-release-year') or
                                (link and link.get('data-film-year')) or
                                (link and link.get('data-film-release-year')))
                    if year_text:
                        year_match = re.search(r'\d{4}', str(year_text))
                        if year_match:
                            year = int(year_match.group())
                
                # Try to extract year from the title text itself
                if not year and title:
                    year_match = re.search(r'\s*\((\d{4})\)', title)
                    if year_match:
                        year = int(year_match.group(1))
                        title = re.sub(r'\s*\(\d{4}\)', '', title).strip()
                
                # Also check if year is at the end of title (e.g., "The Matrix 1999")
                if not year and title:
                    year_match = re.search(r'\s+(\d{4})\s*$', title)
                    if year_match:
                        year = int(year_match.group(1))
                        title = title[:-5].strip()
                
                if title:
                    # Normalize title (remove common suffixes, clean up)
                    title = re.sub(r'\s*\([^)]*\)\s*$', '', title).strip()
                    title = re.sub(r'\s*\[[^\]]*\]\s*$', '', title).strip()
                    title = title.strip()
                    
                    # Skip if title is too short or looks invalid
                    if len(title) < 2:
                        continue
                    
                    # Create unique key for deduplication
                    title_key = f"{title.lower()}-{year}" if year else title.lower()
                    if title_key not in seen_titles:
                        seen_titles.add(title_key)
                        movies_to_search.append({"title": title, "year": year})
                        print(f"  Found: {title} ({year or 'no year'})")
            
            print(f"Extracted {len(movies_to_search)} unique movies from Letterboxd")
            
            # Search for each movie in TMDb
            for movie_info in movies_to_search:
                title = movie_info["title"]
                year = movie_info.get("year")
                
                movie = self._search_movie_tmdb(title, year)
                
                if movie:
                    # Check for duplicates by TMDb ID
                    if not any(m.get("id") == movie.get("id") for m in imported_movies):
                        imported_movies.append(movie)
                else:
                    failed_imports.append({"title": title, "year": year})
            
            # Sort by release date
            imported_movies.sort(key=lambda m: m.get("release_date", "") or "9999-12-31")
            
            # Store imported movies
            self.movies = imported_movies
            
            if failed_imports:
                print(f"Failed to import {len(failed_imports)} movies: {failed_imports[:5]}...")
            
            return len(imported_movies)
            
        except requests.RequestException as e:
            raise ValueError(f"Failed to fetch Letterboxd page: {str(e)}")
        except Exception as e:
            raise ValueError(f"Failed to parse Letterboxd page: {str(e)}")
    
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


@app.route('/api/session/<session_id>/movies/import', methods=['POST'])
def import_letterboxd(session_id: str):
    """Import movies from a Letterboxd URL or CSV file"""
    if session_id not in sessions:
        return jsonify({"error": "Session not found"}), 404
    
    data = request.get_json() or {}
    letterboxd_url = data.get('letterboxd_url') or data.get('url')
    
    # Check if URL is provided
    if letterboxd_url:
        try:
            session = sessions[session_id]
            count = session.import_letterboxd_url(letterboxd_url)
            
            return jsonify({
                "message": f"Imported {count} movies from Letterboxd",
                "movie_count": count,
                "loaded_count": count,
                "movies": session.movies
            }), 200
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            return jsonify({"error": f"Failed to import Letterboxd URL: {str(e)}"}), 500
    
    # Fall back to CSV file upload
    if 'file' in request.files:
        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400
        
        # Read file content
        csv_content = file.read().decode('utf-8')
        
        try:
            session = sessions[session_id]
            count = session.import_letterboxd_csv(csv_content)
            
            return jsonify({
                "message": f"Imported {count} movies from Letterboxd CSV",
                "movie_count": count,
                "loaded_count": count,
                "movies": session.movies
            }), 200
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            return jsonify({"error": f"Failed to import Letterboxd CSV: {str(e)}"}), 500
    
    # Check for CSV content in JSON
    if request.is_json:
        csv_content = data.get('csv_content', '')
        if csv_content:
            try:
                session = sessions[session_id]
                count = session.import_letterboxd_csv(csv_content)
                
                return jsonify({
                    "message": f"Imported {count} movies from Letterboxd CSV",
                    "movie_count": count,
                    "loaded_count": count,
                    "movies": session.movies
                }), 200
            except ValueError as e:
                return jsonify({"error": str(e)}), 400
            except Exception as e:
                return jsonify({"error": f"Failed to import Letterboxd CSV: {str(e)}"}), 500
    
    return jsonify({"error": "No Letterboxd URL, CSV file, or CSV content provided"}), 400


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

