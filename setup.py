"""
Setup script for Movie Ranking API
"""
import os

def create_api_key_file():
    """Create template for API key file"""
    if not os.path.exists("tmdb_api_key.txt"):
        with open("tmdb_api_key.txt", "w") as f:
            f.write("# Enter your TMDb API key here\n")
            f.write("# Get your free API key at: https://www.themoviedb.org/settings/api\n")
            f.write("# \n")
            f.write("YOUR_API_KEY_HERE\n")
        print("Created tmdb_api_key.txt template")
        print("Please edit it with your actual API key")
    else:
        print("tmdb_api_key.txt already exists")

if __name__ == "__main__":
    print("Setting up Movie Ranking API...")
    create_api_key_file()
    print("\nSetup complete!")
    print("Next steps:")
    print("1. Edit tmdb_api_key.txt with your TMDb API key")
    print("2. Install dependencies: pip install -r requirements.txt")
    print("3. Run the server: python movie_ranker_api.py")

