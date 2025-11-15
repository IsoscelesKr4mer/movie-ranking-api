"""
Simple test script for the Movie Ranking API
Run this after starting the API server to test the endpoints
"""
import requests
import json

BASE_URL = "http://localhost:5000"

def test_api():
    """Test the API endpoints"""
    print("Testing Movie Ranking API...\n")
    
    # 1. Health check
    print("1. Testing health check...")
    response = requests.get(f"{BASE_URL}/api/health")
    print(f"   Status: {response.status_code}")
    print(f"   Response: {json.dumps(response.json(), indent=2)}\n")
    
    # 2. Create session
    print("2. Creating session...")
    response = requests.post(f"{BASE_URL}/api/session/create")
    session_data = response.json()
    session_id = session_data["session_id"]
    print(f"   Session ID: {session_id}\n")
    
    # 3. Load movies
    print("3. Loading movies (2025, max 10)...")
    response = requests.post(
        f"{BASE_URL}/api/session/{session_id}/movies/load",
        json={"year": 2025, "max_movies": 10}
    )
    movies_data = response.json()
    print(f"   Loaded {movies_data['movie_count']} movies\n")
    
    # 4. Start ranking
    print("4. Starting ranking...")
    response = requests.post(f"{BASE_URL}/api/session/{session_id}/ranking/start")
    ranking_data = response.json()
    print(f"   Status: {ranking_data.get('message', 'Started')}\n")
    
    if "comparison" in ranking_data:
        print("5. Making test choices...")
        choice_count = 0
        current_data = ranking_data
        
        # Make a few choices
        while "comparison" in current_data and choice_count < 3:
            choice = "left" if choice_count % 2 == 0 else "right"
            print(f"   Choice {choice_count + 1}: Choosing '{choice}'...")
            response = requests.post(
                f"{BASE_URL}/api/session/{session_id}/ranking/choice",
                json={"choice": choice}
            )
            current_data = response.json()
            choice_count += 1
        
        print(f"   Made {choice_count} choices\n")
    
    # 6. Get status
    print("6. Getting status...")
    response = requests.get(f"{BASE_URL}/api/session/{session_id}/ranking/status")
    status = response.json()
    print(f"   Status: {json.dumps(status, indent=2)}\n")
    
    print("Test complete!")

if __name__ == "__main__":
    try:
        test_api()
    except requests.exceptions.ConnectionError:
        print("Error: Could not connect to API server.")
        print("Make sure the server is running: python movie_ranker_api.py")
    except Exception as e:
        print(f"Error: {e}")

