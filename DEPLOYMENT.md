# Deployment Guide

This guide will help you deploy the Movie Ranking API to a live hosting service.

## Quick Deploy Options

### 🚀 Option 1: Render (Recommended - Easiest & Free)

**Render** is the easiest option with a free tier and automatic deployments from GitHub.

#### Steps:

1. **Sign up**: Go to [render.com](https://render.com) and sign up with your GitHub account

2. **Create a new Web Service**:
   - Click "New +" → "Web Service"
   - Connect your GitHub account if not already connected
   - Select the `movie-ranking-api` repository

3. **Configure the service**:
   - **Name**: `movie-ranking-api` (or any name you prefer)
   - **Region**: Choose closest to you
   - **Branch**: `main`
   - **Root Directory**: Leave blank
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn movie_ranker_api:app`

4. **Add Environment Variable**:
   - Go to "Environment" section
   - Click "Add Environment Variable"
   - **Key**: `TMDB_API_KEY`
   - **Value**: Your TMDb API key (get it from [themoviedb.org](https://www.themoviedb.org/settings/api))

5. **Deploy**:
   - Click "Create Web Service"
   - Wait for deployment (usually 2-5 minutes)
   - Your API will be live at: `https://your-app-name.onrender.com`

6. **Test your API**:
   ```
   https://your-app-name.onrender.com/api/session/create
   ```

**Free Tier Notes:**
- Free tier spins down after 15 minutes of inactivity
- First request after spin-down takes ~30 seconds to wake up
- Perfect for development and small projects!

---

### 🚂 Option 2: Railway

**Railway** is another excellent option with a free tier.

#### Steps:

1. **Sign up**: Go to [railway.app](https://railway.app) and sign up with GitHub

2. **Create a new project**:
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your `movie-ranking-api` repository

3. **Configure**:
   - Railway will auto-detect it's a Python app
   - It should automatically use the `Procfile`

4. **Add Environment Variable**:
   - Click on your service
   - Go to "Variables" tab
   - Click "New Variable"
   - **Name**: `TMDB_API_KEY`
   - **Value**: Your TMDb API key

5. **Deploy**:
   - Railway will automatically deploy
   - Your API will be live at: `https://your-app-name.up.railway.app`

**Free Tier:**
- $5 credit per month
- Sleeps after inactivity but wakes up quickly

---

### 🦅 Option 3: Fly.io

**Fly.io** offers global deployment with a free tier.

#### Steps:

1. **Install Fly CLI**: 
   ```powershell
   # Using PowerShell
   iwr https://fly.io/install.ps1 -useb | iex
   ```

2. **Sign up**: Go to [fly.io](https://fly.io) and sign up

3. **Create app**:
   ```powershell
   fly launch
   ```
   - Follow the prompts
   - Choose a region
   - Don't deploy yet (we'll add the API key first)

4. **Add secrets**:
   ```powershell
   fly secrets set TMDB_API_KEY=your-api-key-here
   ```

5. **Deploy**:
   ```powershell
   fly deploy
   ```

---

### 🌐 Option 4: PythonAnywhere

**PythonAnywhere** is great for Python apps with a free tier.

#### Steps:

1. **Sign up**: Go to [pythonanywhere.com](https://www.pythonanywhere.com)

2. **Upload your code**:
   - Use the Files tab to upload your files
   - Or use Git to clone your repository

3. **Set up Web App**:
   - Go to Web tab
   - Click "Add a new web app"
   - Choose Flask
   - Point to `movie_ranker_api.py`

4. **Add environment variable**:
   - Edit your WSGI file
   - Add: `os.environ['TMDB_API_KEY'] = 'your-api-key'`

5. **Reload**:
   - Click the reload button
   - Your API will be live at: `yourusername.pythonanywhere.com`

---

## Environment Variables

All platforms require the `TMDB_API_KEY` environment variable:

- **Key**: `TMDB_API_KEY`
- **Value**: Your TMDb API key from [themoviedb.org](https://www.themoviedb.org/settings/api)

## Testing Your Deployed API

Once deployed, test your API:

```bash
# Create a session
curl -X POST https://your-app-url/api/session/create

# The response will include a session_id, use it in the next steps
# Load movies (replace SESSION_ID with actual ID)
curl -X POST https://your-app-url/api/session/SESSION_ID/movies/load \
  -H "Content-Type: application/json" \
  -d '{"year": 2024, "max_movies": 10}'
```

## CORS Configuration

The API is already configured with CORS enabled, so it will work with web frontends from any domain.

## Production Considerations

For production deployments, consider:

1. **Database**: Replace in-memory sessions with Redis or PostgreSQL
2. **Authentication**: Add API keys or OAuth
3. **Rate Limiting**: Prevent abuse
4. **Monitoring**: Add logging and error tracking
5. **SSL/HTTPS**: Most platforms provide this automatically

## Troubleshooting

### API key not working
- Make sure you set `TMDB_API_KEY` environment variable (not `TMDB_API_KEY.txt`)
- Check for typos in the variable name
- Verify your API key is valid

### App won't start
- Check logs in your hosting platform
- Make sure `gunicorn` is in requirements.txt
- Verify `Procfile` is correct

### Port issues
- The app automatically uses the `PORT` environment variable
- Most platforms set this automatically

## Need Help?

- Check your platform's documentation
- Review the logs in your hosting dashboard
- Open an issue on GitHub if you encounter problems

