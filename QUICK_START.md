# Quick Start Guide

## 1. Install Dependencies

```bash
pip install -r requirements.txt
```

## 2. Set Up API Key

Create `tmdb_api_key.txt` in this directory with your TMDb API key:

```
fe268d69c026126830e3bf70a6af44b1
```

⚠️ This file is already in `.gitignore` and won't be committed to GitHub.

## 3. Run the Server

```bash
python movie_ranker_api.py
```

The API will start on `http://localhost:5000`

## 4. Test the API (Optional)

In another terminal:

```bash
python test_api.py
```

## 5. Push to GitHub

See `GITHUB_SETUP.md` for detailed instructions, or run:

```bash
# Create repo on GitHub first, then:
git remote add origin https://github.com/YOUR_USERNAME/movie-ranking-api.git
git branch -M main
git push -u origin main
```

## API Endpoints

- `POST /api/session/create` - Create a new session
- `POST /api/session/<id>/movies/load` - Load movies by year
- `POST /api/session/<id>/ranking/start` - Start ranking
- `GET /api/session/<id>/ranking/current` - Get current comparison
- `POST /api/session/<id>/ranking/choice` - Make a choice (left/right/skip)
- `GET /api/session/<id>/ranking/results` - Get final results

See `README_API.md` for complete documentation.

