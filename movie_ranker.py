import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext
import requests
import json
import os
from typing import List, Dict, Optional, Tuple
from functools import cmp_to_key

class MovieRanker:
    def __init__(self, root):
        self.root = root
        self.root.title("Movie Ranking App")
        self.root.geometry("1200x800")
        
        # API Configuration
        self.api_key = None
        self.api_base = "https://api.themoviedb.org/3"
        self.image_base = "https://image.tmdb.org/t/p/w500"
        
        # Data
        self.movies: List[Dict] = []
        self.ranked_movies: List[Dict] = []
        self.unseen_movies: List[Dict] = []
        self.comparison_queue: List[Tuple] = []
        self.current_comparison: Optional[Tuple] = None
        self.is_ranking = False
        
        # Setup UI
        self.setup_ui()
        self.load_api_key()
        
    def setup_ui(self):
        # Main container
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        
        # API Key section
        api_frame = ttk.LabelFrame(main_frame, text="TMDb API Configuration", padding="10")
        api_frame.grid(row=0, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))
        
        ttk.Label(api_frame, text="API Key:").grid(row=0, column=0, padx=(0, 5))
        self.api_key_entry = ttk.Entry(api_frame, width=50, show="*")
        self.api_key_entry.grid(row=0, column=1, padx=(0, 5))
        self.api_key_entry.bind("<KeyRelease>", self.on_api_key_change)
        
        ttk.Button(api_frame, text="Save", command=self.save_api_key).grid(row=0, column=2, padx=(5, 0))
        ttk.Label(api_frame, text="Get your free API key at: https://www.themoviedb.org/settings/api", 
                 font=("Arial", 8)).grid(row=1, column=0, columnspan=3, pady=(5, 0))
        
        # Movie selection section
        selection_frame = ttk.LabelFrame(main_frame, text="Movie Selection", padding="10")
        selection_frame.grid(row=1, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))
        
        ttk.Label(selection_frame, text="Year:").grid(row=0, column=0, padx=(0, 5))
        self.year_entry = ttk.Entry(selection_frame, width=10)
        self.year_entry.insert(0, "2025")
        self.year_entry.grid(row=0, column=1, padx=(0, 10))
        
        ttk.Label(selection_frame, text="Max Movies:").grid(row=0, column=2, padx=(0, 5))
        self.max_movies_entry = ttk.Entry(selection_frame, width=10)
        self.max_movies_entry.insert(0, "50")
        self.max_movies_entry.grid(row=0, column=3, padx=(0, 10))
        
        ttk.Button(selection_frame, text="Load Movies", command=self.load_movies).grid(row=0, column=4, padx=(10, 0))
        ttk.Button(selection_frame, text="Start Ranking", command=self.start_ranking).grid(row=0, column=5, padx=(10, 0))
        
        self.status_label = ttk.Label(selection_frame, text="Ready", foreground="green")
        self.status_label.grid(row=1, column=0, columnspan=6, pady=(10, 0))
        
        # Comparison section
        comparison_frame = ttk.LabelFrame(main_frame, text="Movie Comparison", padding="10")
        comparison_frame.grid(row=2, column=0, columnspan=2, sticky=(tk.W, tk.E, tk.N, tk.S), pady=(0, 10))
        main_frame.rowconfigure(2, weight=1)
        
        # Left movie
        left_frame = ttk.Frame(comparison_frame)
        left_frame.grid(row=0, column=0, padx=10, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        self.left_poster_label = ttk.Label(left_frame, text="No movie", anchor="center")
        self.left_poster_label.grid(row=0, column=0, pady=10)
        
        self.left_title_label = ttk.Label(left_frame, text="", font=("Arial", 12, "bold"), wraplength=300)
        self.left_title_label.grid(row=1, column=0, pady=5)
        
        self.left_info_label = ttk.Label(left_frame, text="", font=("Arial", 9), wraplength=300)
        self.left_info_label.grid(row=2, column=0, pady=5)
        
        ttk.Button(left_frame, text="Prefer This Movie", command=lambda: self.make_choice("left")).grid(row=3, column=0, pady=10)
        
        # VS label
        vs_label = ttk.Label(comparison_frame, text="VS", font=("Arial", 20, "bold"))
        vs_label.grid(row=0, column=1, padx=20)
        
        # Right movie
        right_frame = ttk.Frame(comparison_frame)
        right_frame.grid(row=0, column=2, padx=10, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        self.right_poster_label = ttk.Label(right_frame, text="No movie", anchor="center")
        self.right_poster_label.grid(row=0, column=0, pady=10)
        
        self.right_title_label = ttk.Label(right_frame, text="", font=("Arial", 12, "bold"), wraplength=300)
        self.right_title_label.grid(row=1, column=0, pady=5)
        
        self.right_info_label = ttk.Label(right_frame, text="", font=("Arial", 9), wraplength=300)
        self.right_info_label.grid(row=2, column=0, pady=5)
        
        ttk.Button(right_frame, text="Prefer This Movie", command=lambda: self.make_choice("right")).grid(row=3, column=0, pady=10)
        
        # Haven't seen button
        ttk.Button(comparison_frame, text="Haven't Seen (Skip Both)", 
                  command=lambda: self.make_choice("skip")).grid(row=1, column=0, columnspan=3, pady=10)
        
        # Progress
        self.progress_label = ttk.Label(comparison_frame, text="", font=("Arial", 10))
        self.progress_label.grid(row=2, column=0, columnspan=3, pady=10)
        
        # Results section
        results_frame = ttk.LabelFrame(main_frame, text="Ranked Results", padding="10")
        results_frame.grid(row=3, column=0, columnspan=2, sticky=(tk.W, tk.E, tk.N, tk.S), pady=(0, 10))
        main_frame.rowconfigure(3, weight=1)
        
        # Results text area
        self.results_text = scrolledtext.ScrolledText(results_frame, height=10, width=80)
        self.results_text.grid(row=0, column=0, columnspan=3, sticky=(tk.W, tk.E, tk.N, tk.S))
        results_frame.columnconfigure(0, weight=1)
        results_frame.rowconfigure(0, weight=1)
        
        # Results buttons
        ttk.Button(results_frame, text="Save Results", command=self.save_results).grid(row=1, column=0, padx=5, pady=10)
        ttk.Button(results_frame, text="Load Results", command=self.load_results).grid(row=1, column=1, padx=5, pady=10)
        ttk.Button(results_frame, text="Export to JSON", command=self.export_json).grid(row=1, column=2, padx=5, pady=10)
        
    def load_api_key(self):
        """Load API key from file if it exists"""
        try:
            if os.path.exists("tmdb_api_key.txt"):
                with open("tmdb_api_key.txt", "r") as f:
                    self.api_key = f.read().strip()
                    self.api_key_entry.delete(0, tk.END)
                    self.api_key_entry.insert(0, self.api_key)
        except Exception as e:
            print(f"Error loading API key: {e}")
    
    def save_api_key(self):
        """Save API key to file"""
        try:
            self.api_key = self.api_key_entry.get().strip()
            with open("tmdb_api_key.txt", "w") as f:
                f.write(self.api_key)
            messagebox.showinfo("Success", "API key saved!")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to save API key: {e}")
    
    def on_api_key_change(self, event=None):
        """Update API key when user types"""
        self.api_key = self.api_key_entry.get().strip()
    
    def load_movies(self):
        """Load movies from TMDb API"""
        if not self.api_key:
            messagebox.showerror("Error", "Please enter your TMDb API key first!")
            return
        
        try:
            year = int(self.year_entry.get())
            max_movies = int(self.max_movies_entry.get())
        except ValueError:
            messagebox.showerror("Error", "Please enter valid numbers for year and max movies!")
            return
        
        self.status_label.config(text="Loading movies...", foreground="blue")
        self.root.update()
        
        try:
            # Fetch popular movies for the year
            url = f"{self.api_base}/discover/movie"
            params = {
                "api_key": self.api_key,
                "primary_release_year": year,
                "sort_by": "popularity.desc",
                "page": 1
            }
            
            all_movies = []
            page = 1
            
            while len(all_movies) < max_movies and page <= 5:  # Limit to 5 pages
                params["page"] = page
                response = requests.get(url, params=params, timeout=10)
                response.raise_for_status()
                data = response.json()
                
                for movie in data.get("results", []):
                    if movie.get("poster_path") and movie.get("title"):
                        all_movies.append({
                            "id": movie["id"],
                            "title": movie["title"],
                            "poster_path": movie.get("poster_path", ""),
                            "release_date": movie.get("release_date", ""),
                            "vote_average": movie.get("vote_average", 0),
                            "overview": movie.get("overview", "")[:200] + "..." if movie.get("overview") else ""
                        })
                        if len(all_movies) >= max_movies:
                            break
                
                if not data.get("results"):
                    break
                page += 1
            
            self.movies = all_movies[:max_movies]
            self.status_label.config(
                text=f"Loaded {len(self.movies)} movies from {year}", 
                foreground="green"
            )
            messagebox.showinfo("Success", f"Loaded {len(self.movies)} movies!")
            
        except requests.exceptions.RequestException as e:
            messagebox.showerror("Error", f"Failed to load movies: {e}")
            self.status_label.config(text="Error loading movies", foreground="red")
        except Exception as e:
            messagebox.showerror("Error", f"Unexpected error: {e}")
            self.status_label.config(text="Error loading movies", foreground="red")
    
    def start_ranking(self):
        """Start the ranking process"""
        if not self.movies:
            messagebox.showerror("Error", "Please load movies first!")
            return
        
        if len(self.movies) < 2:
            messagebox.showerror("Error", "Need at least 2 movies to rank!")
            return
        
        self.is_ranking = True
        self.ranked_movies = []
        self.unseen_movies = []
        
        # Filter out movies user hasn't seen (we'll handle this during comparison)
        # Start merge sort with all movies
        self.movies_to_rank = [m for m in self.movies if m not in self.unseen_movies]
        
        # Initialize merge sort state
        self.merge_sort_state = {
            "sorted_sublists": [[m] for m in self.movies_to_rank],  # Start with single-element lists
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
            # Done! All movies are sorted
            if sublists:
                self.ranked_movies = sublists[0]
            return
        
        # Pair up sublists for merging
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
            return
        
        # Check if we have an active merge
        if self.merge_sort_state["current_merge"]:
            merge = self.merge_sort_state["current_merge"]
            left_list = merge["left"]
            right_list = merge["right"]
            left_idx = merge["left_idx"]
            right_idx = merge["right_idx"]
            
            # Check if merge is complete
            if left_idx >= len(left_list) and right_idx >= len(right_list):
                # This merge is done, move to next
                self.merge_sort_state["current_merge"] = None
                self.next_comparison()
                return
            elif left_idx >= len(left_list):
                # Left exhausted, add remaining right (filter unseen)
                remaining = [m for m in right_list[right_idx:] if m not in self.unseen_movies]
                merge["result"].extend(remaining)
                self._complete_current_merge()
                return
            elif right_idx >= len(right_list):
                # Right exhausted, add remaining left (filter unseen)
                remaining = [m for m in left_list[left_idx:] if m not in self.unseen_movies]
                merge["result"].extend(remaining)
                self._complete_current_merge()
                return
            else:
                # Need to compare - but skip if movies are already unseen
                left_movie = left_list[left_idx]
                right_movie = right_list[right_idx]
                
                # Skip if either movie is already marked as unseen
                if left_movie in self.unseen_movies:
                    merge["left_idx"] += 1
                    self.next_comparison()
                    return
                if right_movie in self.unseen_movies:
                    merge["right_idx"] += 1
                    self.next_comparison()
                    return
                
                self.current_comparison = (left_movie, right_movie, merge)
                self.display_comparison(left_movie, right_movie)
                self._update_progress()
                return
        
        # No active merge, get next from stack
        if self.merge_sort_state["merge_stack"]:
            merge = self.merge_sort_state["merge_stack"].pop(0)
            self.merge_sort_state["current_merge"] = merge
            self.next_comparison()
        else:
            # Current round done, prepare next round
            if len(self.merge_sort_state["sorted_sublists"]) > 1:
                self._prepare_merge_round()
                self.next_comparison()
            else:
                # All done!
                if self.merge_sort_state["sorted_sublists"]:
                    self.ranked_movies = self.merge_sort_state["sorted_sublists"][0]
                self.finish_ranking()
    
    def _complete_current_merge(self):
        """Complete the current merge and add result to sorted_sublists"""
        merge = self.merge_sort_state["current_merge"]
        self.merge_sort_state["sorted_sublists"].append(merge["result"])
        self.merge_sort_state["current_merge"] = None
        self.next_comparison()
    
    def _update_progress(self):
        """Update progress label"""
        total_movies = len(self.movies)
        ranked_count = len(self.ranked_movies)
        remaining_merges = len(self.merge_sort_state["merge_stack"])
        if self.merge_sort_state["current_merge"]:
            remaining_merges += 1
        
        # Estimate comparisons (roughly n*log2(n) for merge sort)
        estimated_total = int(total_movies * (total_movies.bit_length() - 1))
        completed = estimated_total - remaining_merges * 2  # Rough estimate
        
        self.progress_label.config(
            text=f"Ranking in progress... ({ranked_count}/{total_movies} movies ranked)"
        )
    
    def display_comparison(self, movie1: Dict, movie2: Dict):
        """Display two movies for comparison"""
        # Left movie
        self.display_movie(movie1, self.left_poster_label, self.left_title_label, self.left_info_label)
        
        # Right movie
        self.display_movie(movie2, self.right_poster_label, self.right_title_label, self.right_info_label)
    
    def display_movie(self, movie: Dict, poster_label, title_label, info_label):
        """Display a single movie"""
        title_label.config(text=movie["title"])
        
        info_text = f"Release: {movie.get('release_date', 'N/A')[:4]}\n"
        info_text += f"Rating: {movie.get('vote_average', 0):.1f}/10"
        info_label.config(text=info_text)
        
        # Load poster image
        if movie.get("poster_path"):
            poster_url = f"{self.image_base}{movie['poster_path']}"
            try:
                response = requests.get(poster_url, timeout=5)
                if response.status_code == 200:
                    from PIL import Image, ImageTk
                    import io
                    
                    img = Image.open(io.BytesIO(response.content))
                    img = img.resize((200, 300), Image.Resampling.LANCZOS)
                    photo = ImageTk.PhotoImage(img)
                    poster_label.config(image=photo, text="")
                    poster_label.image = photo  # Keep a reference
                else:
                    poster_label.config(image="", text="Poster\nNot Available")
            except Exception as e:
                poster_label.config(image="", text="Poster\nNot Available")
        else:
            poster_label.config(image="", text="No Poster")
    
    def make_choice(self, choice: str):
        """Handle user's choice"""
        if not self.current_comparison:
            return
        
        left_movie, right_movie, merge = self.current_comparison
        
        if choice == "skip":
            # User hasn't seen one or both movies
            # Add both to unseen list (don't include in ranking)
            if left_movie not in self.unseen_movies:
                self.unseen_movies.append(left_movie)
            if right_movie not in self.unseen_movies:
                self.unseen_movies.append(right_movie)
            
            # Skip both movies - advance indices to continue merge
            # We'll handle the actual removal when building final list
            merge["left_idx"] += 1
            merge["right_idx"] += 1
            
        elif choice == "left":
            # Prefer left movie (only add if not unseen)
            if left_movie not in self.unseen_movies:
                merge["result"].append(left_movie)
            merge["left_idx"] += 1
            
        elif choice == "right":
            # Prefer right movie (only add if not unseen)
            if right_movie not in self.unseen_movies:
                merge["result"].append(right_movie)
            merge["right_idx"] += 1
        
        # Continue with next comparison
        self.next_comparison()
    
    def finish_ranking(self):
        """Finish the ranking process"""
        self.is_ranking = False
        self.current_comparison = None
        
        # Filter out unseen movies from final ranking
        self.ranked_movies = [m for m in self.ranked_movies if m not in self.unseen_movies]
        
        # Ensure all seen movies are in ranked list (in case any were missed)
        for movie in self.movies:
            if movie not in self.ranked_movies and movie not in self.unseen_movies:
                self.ranked_movies.append(movie)
        
        # Display results
        self.display_results()
        messagebox.showinfo("Complete", f"Ranking complete! Ranked {len(self.ranked_movies)} movies.")
    
    def display_results(self):
        """Display the final ranked results"""
        self.results_text.delete(1.0, tk.END)
        
        self.results_text.insert(tk.END, "=" * 60 + "\n")
        self.results_text.insert(tk.END, "FINAL RANKING\n")
        self.results_text.insert(tk.END, "=" * 60 + "\n\n")
        
        for i, movie in enumerate(self.ranked_movies, 1):
            self.results_text.insert(tk.END, f"{i}. {movie['title']}\n")
            self.results_text.insert(tk.END, f"   Release: {movie.get('release_date', 'N/A')}\n")
            self.results_text.insert(tk.END, f"   Rating: {movie.get('vote_average', 0):.1f}/10\n\n")
        
        if self.unseen_movies:
            self.results_text.insert(tk.END, "\n" + "=" * 60 + "\n")
            self.results_text.insert(tk.END, "MOVIES NOT SEEN (Excluded from ranking)\n")
            self.results_text.insert(tk.END, "=" * 60 + "\n\n")
            for movie in self.unseen_movies:
                self.results_text.insert(tk.END, f"- {movie['title']}\n")
    
    def save_results(self):
        """Save results to a text file"""
        if not self.ranked_movies:
            messagebox.showwarning("Warning", "No results to save!")
            return
        
        try:
            filename = f"movie_ranking_{self.year_entry.get()}.txt"
            with open(filename, "w", encoding="utf-8") as f:
                f.write("=" * 60 + "\n")
                f.write("MOVIE RANKING RESULTS\n")
                f.write("=" * 60 + "\n\n")
                
                for i, movie in enumerate(self.ranked_movies, 1):
                    f.write(f"{i}. {movie['title']}\n")
                    f.write(f"   Release: {movie.get('release_date', 'N/A')}\n")
                    f.write(f"   Rating: {movie.get('vote_average', 0):.1f}/10\n\n")
                
                if self.unseen_movies:
                    f.write("\n" + "=" * 60 + "\n")
                    f.write("MOVIES NOT SEEN\n")
                    f.write("=" * 60 + "\n\n")
                    for movie in self.unseen_movies:
                        f.write(f"- {movie['title']}\n")
            
            messagebox.showinfo("Success", f"Results saved to {filename}!")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to save results: {e}")
    
    def load_results(self):
        """Load results from a file"""
        # This would load a previous ranking session
        messagebox.showinfo("Info", "Load functionality can be extended to restore previous sessions")
    
    def export_json(self):
        """Export results to JSON"""
        if not self.ranked_movies:
            messagebox.showwarning("Warning", "No results to export!")
            return
        
        try:
            filename = f"movie_ranking_{self.year_entry.get()}.json"
            data = {
                "ranked_movies": self.ranked_movies,
                "unseen_movies": self.unseen_movies,
                "year": self.year_entry.get()
            }
            
            with open(filename, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            
            messagebox.showinfo("Success", f"Results exported to {filename}!")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to export results: {e}")

def main():
    root = tk.Tk()
    app = MovieRanker(root)
    root.mainloop()

if __name__ == "__main__":
    main()

