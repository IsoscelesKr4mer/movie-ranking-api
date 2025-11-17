// API Configuration
let apiUrl = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'http://localhost:8000'
    : 'https://movie-ranking-api-ea3e.onrender.com';
let sessionId = null;
let currentComparison = null;
let loadedMovies = [];
let selectedMovieIds = new Set();
let categories = {};

// DOM Elements
const loadTypeSelect = document.getElementById('load-type');
const categoryGroup = document.getElementById('category-group');
const yearGroup = document.getElementById('year-group');
const movieCategorySelect = document.getElementById('movie-category');
const movieYearInput = document.getElementById('movie-year');
const maxMoviesInput = document.getElementById('max-movies');
const createSessionBtn = document.getElementById('create-session-btn');
const letterboxdUrlInput = document.getElementById('letterboxd-url');
const importLetterboxdBtn = document.getElementById('import-letterboxd-btn');
const sessionInfo = document.getElementById('session-info');
const sessionIdSpan = document.getElementById('session-id');
const sessionStatusSpan = document.getElementById('session-status');
const selectionSection = document.getElementById('selection-section');
const moviesSelectionGrid = document.getElementById('movies-selection-grid');
const selectAllBtn = document.getElementById('select-all-btn');
const deselectAllBtn = document.getElementById('deselect-all-btn');
const confirmSelectionBtn = document.getElementById('confirm-selection-btn');
const selectedCountSpan = document.getElementById('selected-count');
const rankingSection = document.getElementById('ranking-section');
const comparisonContainer = document.getElementById('comparison-container');
const loading = document.getElementById('loading');
const startRankingBtn = document.getElementById('start-ranking-btn');
const getStatusBtn = document.getElementById('get-status-btn');
const getResultsBtn = document.getElementById('get-results-btn');
const resetBtn = document.getElementById('reset-btn');
const resultsSection = document.getElementById('results-section');
const resultsContainer = document.getElementById('results-container');
const progressSpan = document.getElementById('comparison-progress');

// Event Listeners

loadTypeSelect.addEventListener('change', handleLoadTypeChange);
createSessionBtn.addEventListener('click', createSessionAndLoadMovies);
importLetterboxdBtn.addEventListener('click', importLetterboxdList);
selectAllBtn.addEventListener('click', selectAllMovies);
deselectAllBtn.addEventListener('click', deselectAllMovies);
confirmSelectionBtn.addEventListener('click', confirmSelection);
startRankingBtn.addEventListener('click', startRanking);
getStatusBtn.addEventListener('click', getStatus);
getResultsBtn.addEventListener('click', getResults);
resetBtn.addEventListener('click', reset);

// Choice buttons
document.querySelectorAll('[data-choice]').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const choice = e.target.getAttribute('data-choice');
        makeChoice(choice);
    });
});

// Helper Functions
function showMessage(text, type = 'info') {
    const messagesDiv = document.getElementById('messages');
    const message = document.createElement('div');
    
    const typeStyles = {
        success: 'bg-green-600/20 border-green-500/30 text-green-300',
        error: 'bg-red-600/20 border-red-500/30 text-red-300',
        info: 'bg-blue-600/20 border-blue-500/30 text-blue-300'
    };
    
    message.className = `glass px-4 py-3 rounded-lg border ${typeStyles[type] || typeStyles.info} backdrop-blur-xl animate-slide-in`;
    message.textContent = text;
    messagesDiv.appendChild(message);

    setTimeout(() => {
        message.style.opacity = '0';
        message.style.transform = 'translateX(100%)';
        setTimeout(() => message.remove(), 300);
    }, 5000);
}

function showLoading(show = true) {
    if (show) {
        loading.classList.remove('hidden');
        comparisonContainer.classList.add('hidden');
    } else {
        loading.classList.add('hidden');
    }
}

// Animation helper for ranking badges
function animateRankBadge(element) {
    if (window.Motion && window.Motion.animate && element) {
        // Reset transform first
        element.style.transform = 'scale(1) rotate(0deg)';
        // Small delay to ensure reset
        setTimeout(() => {
            window.Motion.animate(element, 
                { scale: [1, 1.2, 1], rotate: [0, 5, -5, 0] },
                { duration: 0.5, easing: 'ease-out' }
            );
        }, 10);
    }
}

async function apiCall(endpoint, method = 'GET', body = null, timeout = 90000) {
    const url = `${apiUrl}${endpoint}`;
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
        },
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        // Create a timeout promise for Render's cold start (up to 90 seconds)
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Request timeout - Render may be spinning up. Please wait...')), timeout);
        });

        // Race between fetch and timeout
        const response = await Promise.race([
            fetch(url, options),
            timeoutPromise
        ]);

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `HTTP error! status: ${response.status}`);
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        
        // Don't show error message for timeout on category loading (it will retry)
        if (endpoint === '/api/categories' && error.message.includes('timeout')) {
            throw error; // Let loadCategories handle the retry
        }
        
        showMessage(`Error: ${error.message}`, 'error');
        throw error;
    }
}

// Main Functions
async function createSessionAndLoadMovies() {
    try {
        showLoading(true);
        showMessage('Creating session...', 'info');

        // Create session
        const sessionData = await apiCall('/api/session/create', 'POST');
        sessionId = sessionData.session_id;
        sessionIdSpan.textContent = sessionId;
        sessionInfo.classList.remove('hidden');
        sessionStatusSpan.textContent = 'Session created';

        showMessage('Session created! Loading movies...', 'success');

        // Load movies
        const loadType = loadTypeSelect.value;
        const maxMovies = parseInt(maxMoviesInput.value);
        let loadPayload = { max_movies: maxMovies };
        
        if (loadType === 'category') {
            const category = movieCategorySelect.value;
            if (!category) {
                showMessage('Please select a category', 'error');
                showLoading(false);
                return;
            }
            loadPayload.category = category;
        } else {
            const year = parseInt(movieYearInput.value);
            if (!year) {
                showMessage('Please enter a year', 'error');
                showLoading(false);
                return;
            }
            loadPayload.year = year;
        }

        const loadData = await apiCall(
            `/api/session/${sessionId}/movies/load`,
            'POST',
            loadPayload
        );

        loadedMovies = loadData.movies || [];
        sessionStatusSpan.textContent = `Loaded ${loadData.loaded_count} movies`;
        
        // Show selection section instead of going straight to ranking
        selectionSection.classList.remove('hidden');
        displayMoviesForSelection(loadedMovies);
        selectedMovieIds.clear();
        updateSelectedCount();
        
        showMessage(`Loaded ${loadData.loaded_count} movies! Select the ones you have seen.`, 'success');
        showLoading(false);

    } catch (error) {
        showLoading(false);
        console.error('Failed to create session or load movies:', error);
    }
}

// Import Letterboxd List (client-side parsing + TMDb enrichment)
async function importLetterboxdList() {
    try {
        const letterboxdUrl = letterboxdUrlInput.value.trim();
        if (!letterboxdUrl) {
            showMessage('Please enter a Letterboxd list URL', 'error');
            return;
        }
        if (!letterboxdUrl.match(/^https?:\/\/(www\.)?(letterboxd\.com|boxd\.it)/)) {
            showMessage('Please enter a valid Letterboxd URL (letterboxd.com or boxd.it)', 'error');
            return;
        }

        showLoading(true);
        showMessage('Parsing and importing Letterboxd list...', 'info');

        await window.runLetterboxdImport(letterboxdUrl);

        // After importToSession completes, we should have loadedMovies populated from server
        selectedMovieIds.clear();
        updateSelectedCount();
        sessionStatusSpan.textContent = `Imported ${loadedMovies.length} movies`;
        showLoading(false);

    } catch (error) {
        showMessage(`Failed to import Letterboxd list: ${error.message}`, 'error');
        showLoading(false);
    }
}

function displayMoviesForSelection(movies) {
    moviesSelectionGrid.innerHTML = '';
    
    movies.forEach((movie, index) => {
        const item = document.createElement('div');
        item.className = 'masonry-item';
        item.dataset.movieId = movie.id;
        
        const year = movie.release_date?.substring(0, 4) || 'N/A';
        const posterUrl = movie.poster_url || 'https://via.placeholder.com/300x450?text=No+Poster';
        
        item.innerHTML = `
            <div class="glass rounded-xl overflow-hidden border border-white/10 transition-smooth glass-hover cursor-pointer relative group">
                <div class="absolute top-2 right-2 z-10 w-8 h-8 bg-green-500/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                </div>
                <div class="absolute top-2 right-2 z-10 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center opacity-100 selected-checkmark hidden">
                    <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                </div>
                <img src="${posterUrl}" 
                     alt="${movie.title}"
                     class="w-full h-auto neumorphic"
                     onerror="this.src='https://via.placeholder.com/300x450?text=No+Poster'">
                <div class="p-3">
                    <h5 class="text-sm font-semibold text-white mb-1 line-clamp-2">${movie.title}</h5>
                    <p class="text-xs text-gray-400">${year}</p>
                </div>
            </div>
        `;
        
        const card = item.querySelector('.glass');
        card.addEventListener('click', () => toggleMovieSelection(movie.id, item));
        
        // Add entrance animation
        if (window.Motion && window.Motion.animate) {
            item.style.opacity = '0';
            item.style.transform = 'translateY(20px)';
            setTimeout(() => {
                window.Motion.animate(item, 
                    { opacity: [0, 1], y: [20, 0] },
                    { duration: 0.4, delay: index * 0.03, easing: 'ease-out' }
                );
            }, 10);
        }
        
        moviesSelectionGrid.appendChild(item);
    });
}

function toggleMovieSelection(movieId, element) {
    const card = element.querySelector('.glass');
    const checkmark = element.querySelector('.selected-checkmark');
    
    if (selectedMovieIds.has(movieId)) {
        selectedMovieIds.delete(movieId);
        card.classList.remove('ring-2', 'ring-green-500', 'border-green-500');
        checkmark?.classList.add('hidden');
        checkmark?.classList.remove('opacity-100');
    } else {
        selectedMovieIds.add(movieId);
        card.classList.add('ring-2', 'ring-green-500', 'border-green-500');
        checkmark?.classList.remove('hidden');
        checkmark?.classList.add('opacity-100');
        animateRankBadge(checkmark);
    }
    updateSelectedCount();
}

function selectAllMovies() {
    loadedMovies.forEach(movie => {
        selectedMovieIds.add(movie.id);
        const element = document.querySelector(`[data-movie-id="${movie.id}"]`);
        if (element) {
            const card = element.querySelector('.glass');
            const checkmark = element.querySelector('.selected-checkmark');
            card?.classList.add('ring-2', 'ring-green-500', 'border-green-500');
            checkmark?.classList.remove('hidden');
            checkmark?.classList.add('opacity-100');
        }
    });
    updateSelectedCount();
}

function deselectAllMovies() {
    selectedMovieIds.clear();
    document.querySelectorAll('.masonry-item').forEach(item => {
        const card = item.querySelector('.glass');
        const checkmark = item.querySelector('.selected-checkmark');
        card?.classList.remove('ring-2', 'ring-green-500', 'border-green-500');
        checkmark?.classList.add('hidden');
        checkmark?.classList.remove('opacity-100');
    });
    updateSelectedCount();
}

function updateSelectedCount() {
    selectedCountSpan.textContent = selectedMovieIds.size;
}

async function confirmSelection() {
    if (!sessionId) {
        showMessage('Please create a session first', 'error');
        return;
    }
    
    if (selectedMovieIds.size < 2) {
        showMessage("Please select at least 2 movies you've seen", 'error');
        return;
    }
    
    try {
        showLoading(true);
        const movieIdsArray = Array.from(selectedMovieIds);
        
        const data = await apiCall(
            `/api/session/${sessionId}/movies/select`,
            'POST',
            { movie_ids: movieIdsArray }
        );
        
        showMessage(`Selected ${data.selected_count} movies! Starting ranking...`, 'success');
        
        // Hide selection section and show ranking section
        selectionSection.classList.add('hidden');
        rankingSection.classList.remove('hidden');
        
        showLoading(false);
        
        // Auto-start ranking after selection
        setTimeout(() => {
            startRanking();
        }, 500);
        
    } catch (error) {
        showLoading(false);
        console.error('Failed to confirm selection:', error);
    }
}

async function startRanking() {
    if (!sessionId) {
        showMessage('Please create a session and select movies first', 'error');
        return;
    }

    try {
        showLoading(true);
        const data = await apiCall(`/api/session/${sessionId}/ranking/start`, 'POST');

        if (data.comparison) {
            currentComparison = data.comparison;
            displayComparison(data.comparison, data.status);
            // Don't show message - comparison is visible
        } else {
            showMessage('No movies to rank', 'error');
            document.body.style.overflow = '';
            const rankingControls = document.getElementById('ranking-controls');
            if (rankingControls) {
                rankingControls.classList.remove('hidden');
            }
        }
        showLoading(false);

    } catch (error) {
        showLoading(false);
        console.error('Failed to start ranking:', error);
    }
}

async function getCurrentComparison() {
    if (!sessionId) {
        return;
    }

    try {
        const data = await apiCall(`/api/session/${sessionId}/ranking/current`, 'GET');
        if (data.comparison) {
            currentComparison = data.comparison;
            displayComparison(data.comparison, data.status);
        }
    } catch (error) {
        console.error('Failed to get current comparison:', error);
    }
}

function displayComparison(comparison, status) {
    const leftMovie = comparison.left_movie;
    const rightMovie = comparison.right_movie;

    // Left movie
    document.getElementById('left-title').textContent = leftMovie.title;
    document.getElementById('left-year').textContent = `Year: ${leftMovie.release_date?.substring(0, 4) || 'N/A'}`;
    document.getElementById('left-rating').textContent = `⭐ ${leftMovie.vote_average || 'N/A'}`;
    document.getElementById('left-overview').textContent = leftMovie.overview || 'No overview available';
    document.getElementById('left-poster').src = leftMovie.poster_url || 'https://via.placeholder.com/300x450?text=No+Poster';
    document.getElementById('left-poster').alt = leftMovie.title;

    // Right movie
    document.getElementById('right-title').textContent = rightMovie.title;
    document.getElementById('right-year').textContent = `Year: ${rightMovie.release_date?.substring(0, 4) || 'N/A'}`;
    document.getElementById('right-rating').textContent = `⭐ ${rightMovie.vote_average || 'N/A'}`;
    document.getElementById('right-overview').textContent = rightMovie.overview || 'No overview available';
    document.getElementById('right-poster').src = rightMovie.poster_url || 'https://via.placeholder.com/300x450?text=No+Poster';
    document.getElementById('right-poster').alt = rightMovie.title;

    // Progress
    if (status) {
        const progress = status.ranked_count || 0;
        const total = status.total_movies || 0;
        progressSpan.textContent = `Progress: ${progress} / ${total} movies ranked`;
    }

    // Hide controls and show comparison
    const rankingControls = document.getElementById('ranking-controls');
    if (rankingControls) {
        rankingControls.classList.add('hidden');
    }
    comparisonContainer.classList.remove('hidden');
    
    // Prevent body scroll when comparison is active
    document.body.style.overflow = 'hidden';
    
    // Scroll to top to show comparison
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function makeChoice(choice) {
    if (!sessionId || !currentComparison) {
        showMessage('Please start ranking first', 'error');
        return;
    }

    try {
        showLoading(true);
        const data = await apiCall(
            `/api/session/${sessionId}/ranking/choice`,
            'POST',
            { choice }
        );

        if (data.message === 'Ranking complete' && data.results) {
            // Ranking is complete!
            showMessage('Ranking complete!', 'success');
            comparisonContainer.classList.add('hidden');
            // Re-enable body scroll
            document.body.style.overflow = '';
            const rankingControls = document.getElementById('ranking-controls');
            if (rankingControls) {
                rankingControls.classList.remove('hidden');
            }
            displayResults(data.results);
            resultsSection.classList.remove('hidden');
            // Scroll to results
            setTimeout(() => {
                resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        } else if (data.comparison) {
            // Continue with next comparison
            currentComparison = data.comparison;
            displayComparison(data.comparison, data.status);
            // Don't show message for every choice to reduce clutter
        } else {
            showMessage('Unexpected response from server', 'error');
            document.body.style.overflow = '';
        }

        showLoading(false);

    } catch (error) {
        showLoading(false);
        document.body.style.overflow = '';
        console.error('Failed to make choice:', error);
    }
}

async function getStatus() {
    if (!sessionId) {
        showMessage('Please create a session first', 'error');
        return;
    }

    try {
        const data = await apiCall(`/api/session/${sessionId}/ranking/status`, 'GET');
        const status = data.status;

        let statusText = `Movies: ${status.total_movies || 0}, `;
        statusText += `Ranked: ${status.ranked_count || 0}, `;
        statusText += `Unseen: ${status.unseen_count || 0}`;

        sessionStatusSpan.textContent = statusText;
        showMessage('Status updated', 'info');

        if (status.is_ranking && status.has_comparison) {
            await getCurrentComparison();
        }

    } catch (error) {
        console.error('Failed to get status:', error);
    }
}

async function getResults() {
    if (!sessionId) {
        showMessage('Please create a session first', 'error');
        return;
    }

    try {
        showLoading(true);
        const data = await apiCall(`/api/session/${sessionId}/ranking/results`, 'GET');

        if (data.ranked_movies && data.ranked_movies.length > 0) {
            displayResults(data);
            resultsSection.classList.remove('hidden');
            showMessage('Results loaded!', 'success');
        } else {
            showMessage('No results yet. Complete the ranking first.', 'info');
        }

        showLoading(false);

    } catch (error) {
        showLoading(false);
        console.error('Failed to get results:', error);
    }
}

function displayResults(data) {
    resultsContainer.innerHTML = '';

    const rankedMovies = data.ranked_movies || [];

    rankedMovies.forEach((movie, index) => {
        const item = document.createElement('div');
        item.className = 'masonry-item';
        const rank = index + 1;
        const posterUrl = movie.poster_url || 'https://via.placeholder.com/300x450?text=No+Poster';
        const year = movie.release_date?.substring(0, 4) || 'N/A';
        const rating = movie.vote_average || 'N/A';
        
        item.innerHTML = `
            <div class="glass rounded-xl overflow-hidden border border-white/10 transition-smooth glass-hover relative">
                <div class="absolute top-3 left-3 z-10 rank-badge">
                    <div class="bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-full w-12 h-12 flex items-center justify-center text-lg shadow-lg neumorphic">
                        #${rank}
                    </div>
                </div>
                <img src="${posterUrl}" 
                     alt="${movie.title}"
                     class="w-full h-auto neumorphic">
                <div class="p-4">
                    <h4 class="text-base font-semibold text-white mb-2 line-clamp-2">${movie.title}</h4>
                    <div class="flex items-center justify-between text-sm">
                        <span class="text-yellow-400">⭐ ${rating}</span>
                        <span class="text-gray-400">${year}</span>
                    </div>
                </div>
            </div>
        `;

        const badge = item.querySelector('.rank-badge');
        if (badge && window.Motion && window.Motion.animate) {
            item.style.opacity = '0';
            item.style.transform = 'scale(0.8)';
            setTimeout(() => {
                window.Motion.animate(item, 
                    { opacity: [0, 1], scale: [0.8, 1] },
                    { duration: 0.5, delay: index * 0.05, easing: 'ease-out' }
                );
            }, 10);
            
            // Animate badge on hover
            const card = item.querySelector('.glass');
            card.addEventListener('mouseenter', () => {
                animateRankBadge(badge.querySelector('div'));
            });
        }
        
        resultsContainer.appendChild(item);
    });

    if (data.unseen_movies && data.unseen_movies.length > 0) {
        const unseenDiv = document.createElement('div');
        unseenDiv.className = 'col-span-full mt-8';
        unseenDiv.innerHTML = `
            <div class="glass rounded-2xl p-6 neumorphic mb-6">
                <h3 class="text-xl font-semibold text-white mb-4">Unseen Movies (${data.unseen_movies.length})</h3>
            </div>
            <div class="masonry-grid">
                ${data.unseen_movies.map((movie, idx) => {
                    const item = document.createElement('div');
                    item.className = 'masonry-item';
                    item.innerHTML = `
                        <div class="glass rounded-xl overflow-hidden border border-white/10 transition-smooth glass-hover opacity-60">
                            <img src="${movie.poster_url || 'https://via.placeholder.com/300x450?text=No+Poster'}" 
                                 alt="${movie.title}"
                                 class="w-full h-auto neumorphic">
                            <div class="p-3">
                                <h4 class="text-sm font-semibold text-white line-clamp-2">${movie.title}</h4>
                            </div>
                        </div>
                    `;
                    resultsContainer.appendChild(item);
                    return '';
                }).join('')}
            </div>
        `;
        resultsContainer.appendChild(unseenDiv);
    }
}

function reset() {
    if (confirm('Are you sure you want to reset? This will clear your current session.')) {
        sessionId = null;
        currentComparison = null;
        loadedMovies = [];
        selectedMovieIds.clear();
        sessionInfo.classList.add('hidden');
        selectionSection.classList.add('hidden');
        rankingSection.classList.add('hidden');
        comparisonContainer.classList.add('hidden');
        document.body.style.overflow = '';
        const rankingControls = document.getElementById('ranking-controls');
        if (rankingControls) {
            rankingControls.classList.remove('hidden');
        }
        resultsSection.classList.add('hidden');
        resultsContainer.innerHTML = '';
        moviesSelectionGrid.innerHTML = '';
        updateSelectedCount();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        showMessage('Session reset', 'info');
    }
}

// Initialize
console.log('Initializing Movie Ranking App...');
console.log('API URL:', apiUrl);
// Expose to other modules that may need it (parser/importer)
window.API_BASE = apiUrl;
loadCategories();
showMessage('Movie Ranking App loaded! Create a session to begin.', 'info');

async function loadCategories(retryCount = 0) {
    const maxRetries = 3;
    
    try {
        // Show loading message on first attempt or if retrying
        if (retryCount === 0) {
            movieCategorySelect.innerHTML = '<option value="">Loading categories...</option>';
            console.log('Loading categories...');
        } else if (retryCount === 1) {
            movieCategorySelect.innerHTML = '<option value="">Waiting for Render to wake up (this may take 50+ seconds)...</option>';
            showMessage('Render free tier is spinning up. This may take 50+ seconds on the first request.', 'info');
            console.log('Retrying category load - Render may be spinning up...');
        }
        
        console.log(`Attempting to fetch categories (attempt ${retryCount + 1})...`);
        const data = await apiCall('/api/categories', 'GET', null, 90000); // 90 second timeout for cold start
        console.log('Categories response:', data);
        
        categories = data.categories || {};
        
        // Populate category dropdown
        movieCategorySelect.innerHTML = '<option value="">Select a category...</option>';
        
        if (Object.keys(categories).length === 0) {
            movieCategorySelect.innerHTML = '<option value="">No categories available</option>';
            showMessage('No categories found. The API may still be deploying.', 'info');
            console.warn('No categories in response');
            return;
        }
        
        console.log(`Loading ${Object.keys(categories).length} categories into dropdown`);
        for (const [id, info] of Object.entries(categories)) {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = `${info.name} - ${info.description}`;
            movieCategorySelect.appendChild(option);
        }
        
        console.log('Categories loaded successfully!');
        if (retryCount > 0) {
            showMessage('Categories loaded successfully!', 'success');
        }
    } catch (error) {
        console.error('Failed to load categories:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            retryCount: retryCount
        });
        
        if (retryCount < maxRetries) {
            // Retry with exponential backoff (10s, 20s, 30s)
            const delay = (retryCount + 1) * 10000;
            movieCategorySelect.innerHTML = `<option value="">Retrying in ${delay / 1000} seconds... (Attempt ${retryCount + 1}/${maxRetries})</option>`;
            console.log(`Scheduling retry in ${delay}ms`);
            
            setTimeout(() => {
                console.log('Executing retry...');
                loadCategories(retryCount + 1);
            }, delay);
        } else {
            movieCategorySelect.innerHTML = '<option value="">Error loading categories - Check console for details</option>';
            showMessage(`Failed to load categories after ${maxRetries} attempts. Error: ${error.message}. Check browser console (F12) for details.`, 'error');
            console.error('Final failure - no more retries');
        }
    }
}

function handleLoadTypeChange() {
    const loadType = loadTypeSelect.value;
    if (loadType === 'category') {
        categoryGroup.classList.remove('hidden');
        yearGroup.classList.add('hidden');
    } else {
        categoryGroup.classList.add('hidden');
        yearGroup.classList.remove('hidden');
    }
}

