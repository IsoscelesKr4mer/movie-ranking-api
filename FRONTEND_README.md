# Frontend - Movie Ranking App

A simple HTML/CSS/JavaScript frontend for testing the Movie Ranking API before sending to Lovable.

## Files

- `index.html` - Main HTML structure
- `style.css` - Styling and layout
- `app.js` - JavaScript API integration and UI logic

## How to Use

1. **Open the frontend**:
   - Simply open `index.html` in your web browser
   - Or use a local server:
     ```bash
     # Python
     python -m http.server 8000
     
     # Or Node.js (if you have http-server installed)
     npx http-server
     ```
   - Then navigate to `http://localhost:8000`

2. **Configure**:
   - The API URL is pre-configured to your deployed API
   - Adjust the year and max movies if needed

3. **Create Session**:
   - Click "Create Session & Load Movies"
   - This will create a session and load movies from TMDb

4. **Start Ranking**:
   - Click "Start Ranking"
   - You'll see two movie posters side by side
   - Click on your preferred movie or "Skip" if you haven't seen both

5. **View Results**:
   - Once ranking is complete, click "View Results"
   - See your complete ranked list

## Features

- ✅ Create and manage sessions
- ✅ Load movies from TMDb by year
- ✅ Interactive movie comparison interface
- ✅ Real-time progress tracking
- ✅ View final ranked results
- ✅ Responsive design

## API Integration

The frontend connects to your deployed API at:
`https://movie-ranking-api-ea3e.onrender.com`

You can change this in the "API URL" field or by editing `app.js`.

## Next Steps for Lovable

This frontend is intentionally simple for testing. When you're ready to send to Lovable:

1. The API is already deployed and ready
2. Lovable can build a sleeker UI using the same API endpoints
3. All API endpoints are documented in `README_API.md`

## Troubleshooting

- **CORS errors**: Make sure the API has CORS enabled (already configured)
- **API not responding**: Check if your Render service is running (may take 30 seconds to wake up)
- **No movies loading**: Verify your TMDB_API_KEY is set correctly on Render

