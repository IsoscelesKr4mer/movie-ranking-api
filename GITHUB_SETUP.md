# GitHub Setup Guide

Follow these steps to push your Movie Ranking API to GitHub.

## Step 1: Create GitHub Repository

1. Go to [GitHub](https://github.com) and sign in
2. Click the "+" icon in the top right → "New repository"
3. Name it: `movie-ranking-api` (or any name you prefer)
4. Description: "REST API for ranking movies using merge sort algorithm"
5. Choose **Public** or **Private**
6. **DO NOT** initialize with README, .gitignore, or license (we already have these)
7. Click "Create repository"

## Step 2: Add Files and Commit

Run these commands in your terminal (in the project directory):

```bash
# Add all files (except those in .gitignore)
git add .

# Check what will be committed
git status

# Make your first commit
git commit -m "Initial commit: Movie Ranking API with TMDb integration"
```

## Step 3: Connect to GitHub and Push

After creating the repository on GitHub, you'll see instructions. Use these commands:

```bash
# Add the remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/movie-ranking-api.git

# Rename branch to main (if needed)
git branch -M main

# Push to GitHub
git push -u origin main
```

## Step 4: Verify

1. Go to your repository on GitHub
2. You should see all your files
3. Make sure `tmdb_api_key.txt` is **NOT** visible (it's in .gitignore)

## Important Notes

✅ **Files that WILL be committed:**
- `movie_ranker_api.py`
- `requirements.txt`
- `README.md`
- `README_API.md`
- `.gitignore`
- `LICENSE`
- `setup.py`
- `test_api.py`

❌ **Files that will NOT be committed (protected by .gitignore):**
- `tmdb_api_key.txt` (your API key - keep this secret!)
- `__pycache__/` (Python cache files)
- `*.log` (log files)
- `movie_ranking_*.txt` (generated ranking files)

## Next Steps After Pushing

1. **Add a repository description** on GitHub
2. **Add topics/tags**: `python`, `flask`, `api`, `movie-ranking`, `tmdb`
3. **Consider adding**:
   - GitHub Actions for CI/CD
   - Issue templates
   - Pull request templates

## Troubleshooting

### If you get authentication errors:
- Use a Personal Access Token instead of password
- Or use SSH: `git remote set-url origin git@github.com:USERNAME/REPO.git`

### If you need to update the remote URL:
```bash
git remote set-url origin https://github.com/YOUR_USERNAME/movie-ranking-api.git
```

### To check your remote:
```bash
git remote -v
```

