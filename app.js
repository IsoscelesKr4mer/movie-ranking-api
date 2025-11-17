// API Configuration
let apiUrl = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'http://localhost:8000'
    : 'https://movie-ranking-api-ea3e.onrender.com';
let sessionId = null;
let currentComparison = null;
let loadedMovies = [];
let selectedMovieIds = new Set();
let categories = {};
let totalMoviesToRank = 0;
let comparisonsMade = 0;

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
const configSection = document.getElementById('config-section');
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
const backToHomeBtn = document.getElementById('back-to-home-btn');
const backToHomeFromResultsBtn = document.getElementById('back-to-home-from-results-btn');
const backFromSelectionBtn = document.getElementById('back-from-selection-btn');
const rankingIdDisplay = document.getElementById('ranking-id-display');
const resultsRankingId = document.getElementById('results-ranking-id');
const shareTwitterBtn = document.getElementById('share-twitter-btn');
const shareFacebookBtn = document.getElementById('share-facebook-btn');
const shareEmailBtn = document.getElementById('share-email-btn');
const shareCopyLinkBtn = document.getElementById('share-copy-link-btn');
const downloadImageBtn = document.getElementById('download-image-btn');
const shareCardPreview = document.getElementById('share-card-preview');
const shareCardAllMovies = document.getElementById('share-card-all-movies');
const shareCardRankingId = document.getElementById('share-card-ranking-id');
const shareSection = document.getElementById('share-section');
const showShareBtn = document.getElementById('show-share-btn');
const hideShareBtn = document.getElementById('hide-share-btn');

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
if (backToHomeBtn) backToHomeBtn.addEventListener('click', goBackToHome);
if (backToHomeFromResultsBtn) backToHomeFromResultsBtn.addEventListener('click', goBackToHome);
if (backFromSelectionBtn) backFromSelectionBtn.addEventListener('click', goBackToHome);
if (shareTwitterBtn) shareTwitterBtn.addEventListener('click', shareToTwitter);
if (shareFacebookBtn) shareFacebookBtn.addEventListener('click', shareToFacebook);
if (shareEmailBtn) shareEmailBtn.addEventListener('click', shareViaEmail);
if (shareCopyLinkBtn) shareCopyLinkBtn.addEventListener('click', copyShareLink);
if (downloadImageBtn) downloadImageBtn.addEventListener('click', downloadShareImage);
if (showShareBtn) showShareBtn.addEventListener('click', () => {
    if (shareSection) {
        shareSection.classList.remove('hidden');
        shareSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
});
if (hideShareBtn) hideShareBtn.addEventListener('click', () => {
    if (shareSection) {
        shareSection.classList.add('hidden');
    }
});

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
        success: 'bg-green-600/20 dark:bg-green-600/20 border-green-500/30 dark:border-green-500/30 text-green-700 dark:text-green-300',
        error: 'bg-red-600/20 dark:bg-red-600/20 border-red-500/30 dark:border-red-500/30 text-red-700 dark:text-red-300',
        info: 'bg-blue-600/20 dark:bg-blue-600/20 border-blue-500/30 dark:border-blue-500/30 text-blue-700 dark:text-blue-300'
    };
    
    message.className = `glass px-4 py-3 rounded-lg border ${typeStyles[type] || typeStyles.info} backdrop-blur-xl animate-slide-in opacity-100 translate-x-0 transition-all duration-300`;
    message.textContent = text;
    messagesDiv.appendChild(message);

    setTimeout(() => {
        message.classList.add('opacity-0', 'translate-x-full');
        setTimeout(() => message.remove(), 300);
    }, 5000);
}

let lottieAnimation = null;

function showLoading(show = true) {
    if (show) {
        loading.classList.remove('hidden');
        comparisonContainer.classList.add('hidden');
        
        // Initialize Lottie animation if not already done
        const spinnerContainer = document.getElementById('lottie-spinner');
        if (spinnerContainer && !lottieAnimation && typeof lottie !== 'undefined') {
            // Use a simple loading animation JSON (we'll use a built-in one or create inline)
            // For now, create a simple rotating circle animation
            const animationData = {
                "v": "5.5.7",
                "fr": 30,
                "ip": 0,
                "op": 60,
                "w": 80,
                "h": 80,
                "nm": "Loading",
                "ddd": 0,
                "assets": [],
                "layers": [{
                    "ddd": 0,
                    "ind": 1,
                    "ty": 4,
                    "nm": "Circle",
                    "sr": 1,
                    "ks": {
                        "o": {"a": 0, "k": 100},
                        "r": {"a": 1, "k": [
                            {"i": {"x": [0.833], "y": [0.833]}, "o": {"x": [0.167], "y": [0.167]}, "t": 0, "s": [0]},
                            {"t": 60, "s": [360]}
                        ]},
                        "p": {"a": 0, "k": [40, 40, 0]},
                        "a": {"a": 0, "k": [0, 0, 0]},
                        "s": {"a": 0, "k": [100, 100, 100]}
                    },
                    "ao": 0,
                    "shapes": [{
                        "ty": "gr",
                        "it": [{
                            "d": 1,
                            "ty": "el",
                            "s": {"a": 0, "k": [60, 60]},
                            "p": {"a": 0, "k": [0, 0]},
                            "nm": "Ellipse Path 1"
                        }, {
                            "ty": "st",
                            "c": {"a": 0, "k": [1, 1, 1, 1]},
                            "o": {"a": 0, "k": 100},
                            "w": {"a": 0, "k": 3},
                            "lc": 1,
                            "lj": 1,
                            "ml": 4,
                            "bm": 0,
                            "nm": "Stroke 1"
                        }, {
                            "ty": "tr",
                            "p": {"a": 0, "k": [0, 0]},
                            "a": {"a": 0, "k": [0, 0]},
                            "s": {"a": 0, "k": [100, 100]},
                            "r": {"a": 0, "k": 0},
                            "o": {"a": 0, "k": 100},
                            "sk": {"a": 0, "k": 0},
                            "sa": {"a": 0, "k": 0},
                            "nm": "Transform"
                        }],
                        "nm": "Ellipse 1",
                        "mn": "ADBE Vector Group"
                    }],
                    "ip": 0,
                    "op": 60,
                    "st": 0,
                    "bm": 0
                }],
                "markers": []
            };
            
            lottieAnimation = lottie.loadAnimation({
                container: spinnerContainer,
                renderer: 'svg',
                loop: true,
                autoplay: true,
                animationData: animationData
            });
        } else if (spinnerContainer && !lottieAnimation) {
            // Fallback: simple CSS spinner if Lottie not available
            spinnerContainer.innerHTML = '<div class="inline-block w-12 h-12 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>';
        }
    } else {
        loading.classList.add('hidden');
        if (lottieAnimation) {
            lottieAnimation.destroy();
            lottieAnimation = null;
        }
    }
}

// Animation helper for ranking badges
function animateRankBadge(element) {
    if (element) {
        // Use Tailwind classes for animation
        element.classList.add('transition-all', 'duration-500', 'ease-out');
        element.classList.add('scale-110', 'rotate-3');
        setTimeout(() => {
            element.classList.remove('scale-110', 'rotate-3');
            element.classList.add('scale-100', 'rotate-0');
        }, 250);
        setTimeout(() => {
            element.classList.remove('scale-100', 'rotate-0', 'transition-all', 'duration-500', 'ease-out');
        }, 500);
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
        // Don't log expected timeout errors for category loading (they're handled by retry logic)
        if (endpoint === '/api/categories' && error.message.includes('timeout')) {
            throw error; // Let loadCategories handle the retry silently
        }
        
        console.error('API Error:', error);
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
        
        if (!loadedMovies || loadedMovies.length === 0) {
            showMessage('No movies were loaded. Please try a different category or year.', 'error');
            showLoading(false);
            return;
        }
        
        // Hide setup section and show selection section
        configSection.classList.add('hidden');
        if (sessionInfo) sessionInfo.classList.add('hidden');
        selectionSection.classList.remove('hidden');
        
        // Ensure movies grid is visible
        if (!moviesSelectionGrid) {
            console.error('movies-selection-grid element not found!');
            showMessage('Error: Movies grid element not found', 'error');
            showLoading(false);
            return;
        }
        
        displayMoviesForSelection(loadedMovies);
        selectedMovieIds.clear();
        updateSelectedCount();
        
        // Scroll to selection section
        setTimeout(() => {
            selectionSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
        
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
    if (!moviesSelectionGrid) {
        console.error('moviesSelectionGrid is null!');
        return;
    }
    
    if (!movies || movies.length === 0) {
        console.warn('No movies to display');
        moviesSelectionGrid.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-center py-8">No movies found.</p>';
        return;
    }
    
    moviesSelectionGrid.innerHTML = '';
    
    movies.forEach((movie, index) => {
        const item = document.createElement('div');
        item.className = 'masonry-item';
        item.dataset.movieId = movie.id;
        
        const year = movie.release_date?.substring(0, 4) || 'N/A';
        const posterUrl = movie.poster_url || 'https://via.placeholder.com/300x450?text=No+Poster';
        
        item.innerHTML = `
            <div class="modern-card rounded-2xl overflow-hidden transition-all duration-300 hover:scale-105 cursor-pointer relative group shadow-md hover:shadow-xl">
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
                     class="w-full h-auto max-h-[140px] object-contain neumorphic"
                     onerror="this.src='https://via.placeholder.com/300x450?text=No+Poster'">
                <div class="p-1.5">
                    <h5 class="text-xs font-semibold text-black dark:text-white mb-0.5 line-clamp-2 min-h-[2rem] leading-tight">${movie.title}</h5>
                    <p class="text-xs text-gray-600 dark:text-gray-400">${year}</p>
                </div>
            </div>
        `;
        
        const card = item.querySelector('.modern-card');
        if (card) {
            card.addEventListener('click', () => toggleMovieSelection(movie.id, item));
        }
        
        // Add entrance animation with Tailwind classes
        item.classList.add('opacity-0', 'translate-y-5', 'transition-all', 'duration-400', 'ease-out');
        setTimeout(() => {
            item.classList.remove('opacity-0', 'translate-y-5');
            item.style.transitionDelay = `${index * 0.03}s`;
        }, 10);
        
        moviesSelectionGrid.appendChild(item);
    });
}

function toggleMovieSelection(movieId, element) {
    const card = element.querySelector('.modern-card');
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
            const card = element.querySelector('.modern-card');
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
        const card = item.querySelector('.modern-card');
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
        
        // Reset progress tracking
        totalMoviesToRank = movieIdsArray.length;
        comparisonsMade = 0;
        
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
        // Reset comparison counter when starting
        comparisonsMade = 0;
        const data = await apiCall(`/api/session/${sessionId}/ranking/start`, 'POST');

        if (data.comparison) {
            currentComparison = data.comparison;
            displayComparison(data.comparison, data.status);
            // Don't show message - comparison is visible
        } else {
            showMessage('No movies to rank', 'error');
            document.body.classList.remove('overflow-hidden');
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
    const leftPoster = document.getElementById('left-poster');
    const leftPosterUrl = leftMovie.poster_url || 'https://via.placeholder.com/300x450?text=No+Poster';
    leftPoster.src = leftPosterUrl;
    leftPoster.alt = leftMovie.title;
    if (leftPosterUrl.includes('w500')) {
        leftPoster.srcset = `${leftPosterUrl.replace('w500', 'w300')} 300w, ${leftPosterUrl.replace('w500', 'w500')} 500w, ${leftPosterUrl.replace('w500', 'w780')} 780w`;
        leftPoster.sizes = '(max-width: 640px) 300px, (max-width: 1024px) 500px, 780px';
    } else if (leftPosterUrl.includes('image.tmdb.org')) {
        // Handle other TMDb image sizes
        const baseUrl = leftPosterUrl.split('/').slice(0, -1).join('/');
        leftPoster.srcset = `${baseUrl}/w300 300w, ${baseUrl}/w500 500w, ${baseUrl}/w780 780w`;
        leftPoster.sizes = '(max-width: 640px) 300px, (max-width: 1024px) 500px, 780px';
    }

    // Right movie
    document.getElementById('right-title').textContent = rightMovie.title;
    document.getElementById('right-year').textContent = `Year: ${rightMovie.release_date?.substring(0, 4) || 'N/A'}`;
    document.getElementById('right-rating').textContent = `⭐ ${rightMovie.vote_average || 'N/A'}`;
    document.getElementById('right-overview').textContent = rightMovie.overview || 'No overview available';
    const rightPoster = document.getElementById('right-poster');
    const rightPosterUrl = rightMovie.poster_url || 'https://via.placeholder.com/300x450?text=No+Poster';
    rightPoster.src = rightPosterUrl;
    rightPoster.alt = rightMovie.title;
    if (rightPosterUrl.includes('w500')) {
        rightPoster.srcset = `${rightPosterUrl.replace('w500', 'w300')} 300w, ${rightPosterUrl.replace('w500', 'w500')} 500w, ${rightPosterUrl.replace('w500', 'w780')} 780w`;
        rightPoster.sizes = '(max-width: 640px) 300px, (max-width: 1024px) 500px, 780px';
    } else if (rightPosterUrl.includes('image.tmdb.org')) {
        // Handle other TMDb image sizes
        const baseUrl = rightPosterUrl.split('/').slice(0, -1).join('/');
        rightPoster.srcset = `${baseUrl}/w300 300w, ${baseUrl}/w500 500w, ${baseUrl}/w780 780w`;
        rightPoster.sizes = '(max-width: 640px) 300px, (max-width: 1024px) 500px, 780px';
    }

    // Progress - calculate based on comparisons made
    if (totalMoviesToRank > 0) {
        // Estimate total comparisons needed for merge sort: approximately n*log2(n)
        const estimatedTotalComparisons = totalMoviesToRank > 1 
            ? Math.ceil(totalMoviesToRank * Math.log2(totalMoviesToRank))
            : 0;
        
        // Calculate progress percentage
        let progressPercentage = 0;
        if (estimatedTotalComparisons > 0) {
            progressPercentage = Math.min(100, Math.max(0, (comparisonsMade / estimatedTotalComparisons) * 100));
        }
        
        // Update progress bar
        const progressBar = document.getElementById('progress-bar');
        if (progressBar) {
            progressBar.style.width = `${progressPercentage}%`;
        }
    }

    // Update ranking ID display
    if (rankingIdDisplay && sessionId) {
        rankingIdDisplay.textContent = sessionId;
    }

    // Hide config section and controls, show comparison
    const configSection = document.getElementById('config-section');
    if (configSection) {
        configSection.classList.add('hidden');
    }
    const rankingControls = document.getElementById('ranking-controls');
    if (rankingControls) {
        rankingControls.classList.add('hidden');
    }
    comparisonContainer.classList.remove('hidden');
    
    // Prevent body scroll when comparison is active
    document.body.classList.add('overflow-hidden');
    
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
            document.body.classList.remove('overflow-hidden');
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
            comparisonsMade++; // Increment comparison counter
            currentComparison = data.comparison;
            displayComparison(data.comparison, data.status);
            // Don't show message for every choice to reduce clutter
        } else {
            showMessage('Unexpected response from server', 'error');
            document.body.classList.remove('overflow-hidden');
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
    
    // Store for sharing
    window.lastRankedMovies = rankedMovies;
    
    // Update ranking ID in results
    if (resultsRankingId && sessionId) {
        resultsRankingId.textContent = sessionId;
    }
    
    // Update share card with all ranked movies
    if (shareCardAllMovies && rankedMovies.length > 0) {
        shareCardAllMovies.innerHTML = '';
        
        // Update share card ranking ID
        // ID removed from share card display
        
        // Calculate grid columns based on movie count to fit without scrolling
        let gridCols = 2;
        if (movieCount <= 4) gridCols = movieCount;
        else if (movieCount <= 6) gridCols = 3;
        else if (movieCount <= 8) gridCols = 4;
        else if (movieCount <= 10) gridCols = 5;
        else gridCols = Math.ceil(Math.sqrt(movieCount));
        
        shareCardAllMovies.className = `grid gap-2 sm:gap-3 overflow-hidden`;
        shareCardAllMovies.style.gridTemplateColumns = `repeat(${gridCols}, minmax(0, 1fr))`;
        
        rankedMovies.forEach((movie, idx) => {
            const rank = idx + 1;
            const movieDiv = document.createElement('div');
            movieDiv.className = 'text-center flex flex-col';
            const posterUrl = movie.poster_url || 'https://via.placeholder.com/150x225?text=No+Poster';
            movieDiv.innerHTML = `
                <div class="relative flex-shrink-0 mb-1">
                    <div class="absolute -top-1 -left-1 z-10 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-xs shadow-lg">
                        ${rank}
                    </div>
                    <img src="${posterUrl}" 
                         alt="${movie.title}"
                         class="w-full h-auto object-contain rounded"
                         style="max-height: 120px;"
                         onerror="this.src='https://via.placeholder.com/150x225?text=No+Poster'">
                </div>
                <p class="text-xs text-gray-700 dark:text-gray-300 line-clamp-2 font-medium leading-tight mt-auto">${movie.title}</p>
            `;
            shareCardAllMovies.appendChild(movieDiv);
        });
    }

    rankedMovies.forEach((movie, index) => {
        const item = document.createElement('div');
        const rank = index + 1;
        const posterUrl = movie.poster_url || 'https://via.placeholder.com/300x450?text=No+Poster';
        const year = movie.release_date?.substring(0, 4) || 'N/A';
        const rating = movie.vote_average || 'N/A';
        
        item.innerHTML = `
            <div class="modern-card rounded-2xl overflow-hidden transition-all duration-300 hover:scale-105 relative shadow-md hover:shadow-xl" role="article" aria-label="Rank ${rank}: ${movie.title}">
                <div class="absolute top-3 left-3 z-10 rank-badge">
                    <div class="bg-white/10 backdrop-blur-sm text-white font-bold rounded-full w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-sm sm:text-lg shadow-lg border border-white/20">
                        #${rank}
                    </div>
                </div>
                <div class="poster-glow">
                    <img src="${posterUrl}" 
                         ${posterUrl.includes('w500') ? `srcset="${posterUrl.replace('w500', 'w300')} 300w, ${posterUrl.replace('w500', 'w500')} 500w, ${posterUrl.replace('w500', 'w780')} 780w" sizes="(max-width: 640px) 150px, (max-width: 1024px) 180px, 200px"` : ''}
                         alt="${movie.title} poster"
                         class="w-full h-auto max-h-[280px] object-contain"
                         loading="lazy"
                         decoding="async">
                </div>
                <div class="p-3">
                    <h4 class="text-sm font-semibold text-black dark:text-white mb-2 line-clamp-2 min-h-[2.5rem]">${movie.title}</h4>
                    <div class="flex items-center justify-between text-xs">
                        <span class="text-yellow-400">⭐ ${rating}</span>
                        <span class="text-gray-600 dark:text-gray-400">${year}</span>
                    </div>
                </div>
            </div>
        `;

        const badge = item.querySelector('.rank-badge');
        if (badge) {
            // Use Tailwind classes for animation
            item.classList.add('opacity-0', 'scale-90', 'transition-all', 'duration-500', 'ease-out');
            setTimeout(() => {
                item.classList.remove('opacity-0', 'scale-90');
                item.style.transitionDelay = `${index * 0.05}s`;
            }, 10);
            
            // Animate badge on hover
            const card = item.querySelector('.modern-card');
            if (card) {
                card.addEventListener('mouseenter', () => {
                    animateRankBadge(badge.querySelector('div'));
                });
            }
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
                        <div class="modern-card rounded-2xl overflow-hidden transition-all duration-300 opacity-60 hover:opacity-80">
                            <img src="${movie.poster_url || 'https://via.placeholder.com/300x450?text=No+Poster'}" 
                                 alt="${movie.title}"
                                 class="w-full h-auto max-h-[200px] object-contain neumorphic">
                            <div class="p-2">
                                <h4 class="text-xs font-semibold text-black dark:text-white line-clamp-2 min-h-[2.5rem]">${movie.title}</h4>
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

function goBackToHome() {
    // Hide all sections
    selectionSection.classList.add('hidden');
    rankingSection.classList.add('hidden');
    comparisonContainer.classList.add('hidden');
    resultsSection.classList.add('hidden');
    
    // Show config section
    const configSection = document.getElementById('config-section');
    if (configSection) {
        configSection.classList.remove('hidden');
    }
    
    // Re-enable body scroll
    document.body.style.overflow = '';
    
    // Show ranking controls if they exist
    const rankingControls = document.getElementById('ranking-controls');
    if (rankingControls) {
        rankingControls.classList.remove('hidden');
    }
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
        
        // Show config section
        const configSection = document.getElementById('config-section');
        if (configSection) {
            configSection.classList.remove('hidden');
        }
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
        showMessage('Session reset', 'info');
    }
}

function getShareUrl() {
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?ranking=${sessionId}`;
}

function getShareText() {
    const rankedMovies = window.lastRankedMovies || [];
    if (rankedMovies.length > 0) {
        const top3 = rankedMovies.slice(0, 3).map((m, i) => `${i + 1}. ${m.title}`).join('\n');
        return `Check out my movie rankings!\n\nTop 3:\n${top3}\n\nView full ranking: ${getShareUrl()}`;
    }
    return `Check out my movie rankings! View them here: ${getShareUrl()}`;
}

function shareToTwitter() {
    const text = encodeURIComponent(getShareText());
    const url = `https://twitter.com/intent/tweet?text=${text}`;
    window.open(url, '_blank', 'width=550,height=420');
}

function shareToFacebook() {
    const url = encodeURIComponent(getShareUrl());
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank', 'width=550,height=420');
}

function shareViaEmail() {
    const subject = encodeURIComponent('My Movie Rankings');
    const body = encodeURIComponent(getShareText());
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
}

function copyShareLink() {
    const url = getShareUrl();
    navigator.clipboard.writeText(url).then(() => {
        showMessage('Link copied to clipboard!', 'success');
    }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showMessage('Link copied to clipboard!', 'success');
    });
}

function downloadShareImage() {
    if (!shareCardPreview) return;
    
    // Check if html2canvas is available
    if (typeof html2canvas === 'undefined') {
        showMessage('Image generator not loaded. Please refresh the page.', 'error');
        return;
    }
    
    // Wait a bit for images to load, then generate
    showMessage('Generating image... This may take a moment.', 'info');
    
    // Wait for images to load
    const images = shareCardPreview.querySelectorAll('img');
    const imagePromises = Array.from(images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = resolve; // Continue even if some images fail
            setTimeout(resolve, 2000); // Timeout after 2 seconds
        });
    });
    
    Promise.all(imagePromises).then(() => {
        // Scroll to top of share card for better image capture
        shareCardPreview.scrollIntoView({ behavior: 'auto', block: 'start' });
        
        setTimeout(() => {
            html2canvas(shareCardPreview, {
                backgroundColor: '#0a0a0f',
                scale: 2,
                useCORS: true,
                logging: false,
                scrollX: 0,
                scrollY: 0,
                windowWidth: shareCardPreview.scrollWidth,
                windowHeight: shareCardPreview.scrollHeight
            }).then(canvas => {
                const link = document.createElement('a');
                link.download = `movie-ranking-${sessionId || 'ranking'}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
                showMessage('Image downloaded!', 'success');
            }).catch(err => {
                console.error('Error generating image:', err);
                showMessage('Failed to generate image. Make sure all images are loaded.', 'error');
            });
        }, 500);
    });
}

// Initialize
console.log('Initializing Movie Ranking App...');
console.log('API URL:', apiUrl);
// Expose to other modules that may need it (parser/importer)
window.API_BASE = apiUrl;

// Check for share link parameter
const urlParams = new URLSearchParams(window.location.search);
const rankingId = urlParams.get('ranking');

if (rankingId) {
    // Load results from share link
    loadResultsFromShare(rankingId);
} else {
    // Normal initialization
    loadCategories();
    showMessage('Movie Ranking App loaded! Create a session to begin.', 'info');
}

async function loadResultsFromShare(shareSessionId) {
    try {
        showLoading(true);
        
        // Hide setup section
        const configSection = document.getElementById('config-section');
        if (configSection) {
            configSection.classList.add('hidden');
        }
        
        // Get results from API
        const data = await apiCall(`/api/session/${shareSessionId}/ranking/results`, 'GET');
        
        if (data.ranked_movies && data.ranked_movies.length > 0) {
            // Set session ID for sharing
            sessionId = shareSessionId;
            
            // Display results
            displayResults(data);
            resultsSection.classList.remove('hidden');
            
            // Scroll to results
            setTimeout(() => {
                resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
            
            showMessage('Ranking loaded from share link!', 'success');
        } else {
            showMessage('No ranking found for this link. It may have expired.', 'error');
            loadCategories();
        }
        
        showLoading(false);
    } catch (error) {
        showLoading(false);
        showMessage('Failed to load ranking from share link. It may have expired.', 'error');
        console.error('Failed to load share link:', error);
        // Fall back to normal initialization
        loadCategories();
    }
}

async function loadCategories(retryCount = 0) {
    const maxRetries = 3;
    
    try {
        // Show loading message on first attempt or if retrying
        if (retryCount === 0) {
            movieCategorySelect.innerHTML = '<option value="">Loading categories...</option>';
        } else if (retryCount === 1) {
            movieCategorySelect.innerHTML = '<option value="">Waiting for Render to wake up (this may take 50+ seconds)...</option>';
            showMessage('Render free tier is spinning up. This may take 50+ seconds on the first request.', 'info');
        }
        
        const data = await apiCall('/api/categories', 'GET', null, 90000); // 90 second timeout for cold start
        
        categories = data.categories || {};
        
        // Populate category dropdown
        movieCategorySelect.innerHTML = '<option value="">Select a category...</option>';
        
        if (Object.keys(categories).length === 0) {
            movieCategorySelect.innerHTML = '<option value="">No categories available</option>';
            showMessage('No categories found. The API may still be deploying.', 'info');
            console.warn('No categories in response');
            return;
        }
        
        for (const [id, info] of Object.entries(categories)) {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = `${info.name} - ${info.description}`;
            movieCategorySelect.appendChild(option);
        }
        if (retryCount > 0) {
            showMessage('Categories loaded successfully!', 'success');
        }
    } catch (error) {
        if (retryCount < maxRetries) {
            // Retry with exponential backoff (10s, 20s, 30s)
            const delay = (retryCount + 1) * 10000;
            movieCategorySelect.innerHTML = `<option value="">Retrying in ${delay / 1000} seconds... (Attempt ${retryCount + 1}/${maxRetries})</option>`;
            
            // Only log retry attempts, not the error itself (expected for cold starts)
            if (error.message.includes('timeout')) {
                console.log(`Render cold start detected. Retrying in ${delay / 1000}s...`);
            } else {
                console.warn('Category load error (will retry):', error.message);
            }
            
            setTimeout(() => {
                loadCategories(retryCount + 1);
            }, delay);
        } else {
            // Only log final failures
            console.error('Failed to load categories after all retries:', error);
            movieCategorySelect.innerHTML = '<option value="">Error loading categories</option>';
            showMessage(`Failed to load categories after ${maxRetries} attempts. The server may be down.`, 'error');
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

