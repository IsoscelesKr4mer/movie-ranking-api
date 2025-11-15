# Test script for deployed Movie Ranking API
# Replace YOUR_APP_URL with your Render URL (e.g., https://movie-ranking-api.onrender.com)

param(
    [Parameter(Mandatory=$false)]
    [string]$BaseUrl = "https://movie-ranking-api.onrender.com"
)

Write-Host "🧪 Testing Movie Ranking API at: $BaseUrl" -ForegroundColor Cyan
Write-Host ""

# Test 1: Create a session
Write-Host "1️⃣  Creating a session..." -ForegroundColor Yellow
try {
    $sessionResponse = Invoke-RestMethod -Uri "$BaseUrl/api/session/create" -Method Post -ContentType "application/json"
    $sessionId = $sessionResponse.session_id
    Write-Host "✅ Session created! Session ID: $sessionId" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "❌ Failed to create session: $_" -ForegroundColor Red
    exit 1
}

# Test 2: Load movies
Write-Host "2️⃣  Loading movies for 2024..." -ForegroundColor Yellow
try {
    $loadBody = @{
        year = 2024
        max_movies = 10
    } | ConvertTo-Json
    
    $loadResponse = Invoke-RestMethod -Uri "$BaseUrl/api/session/$sessionId/movies/load" `
        -Method Post `
        -Body $loadBody `
        -ContentType "application/json"
    
    Write-Host "✅ Movies loaded! Count: $($loadResponse.loaded_count)" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "❌ Failed to load movies: $_" -ForegroundColor Red
    Write-Host "Make sure your TMDB_API_KEY environment variable is set correctly on Render." -ForegroundColor Yellow
    exit 1
}

# Test 3: Get status
Write-Host "3️⃣  Getting session status..." -ForegroundColor Yellow
try {
    $statusResponse = Invoke-RestMethod -Uri "$BaseUrl/api/session/$sessionId/status" -Method Get
    Write-Host "✅ Status retrieved!" -ForegroundColor Green
    Write-Host "   Movies: $($statusResponse.movie_count)" -ForegroundColor Gray
    Write-Host "   Is Ranking: $($statusResponse.is_ranking)" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "⚠️  Status check failed: $_" -ForegroundColor Yellow
}

Write-Host "🎉 API is working correctly!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Cyan
Write-Host "   - Start ranking: POST $BaseUrl/api/session/$sessionId/ranking/start" -ForegroundColor Gray
Write-Host "   - Make choices: POST $BaseUrl/api/session/$sessionId/ranking/choice" -ForegroundColor Gray
Write-Host "   - View API docs in README_API.md" -ForegroundColor Gray

