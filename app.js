// API Configuration
let apiUrl = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'http://localhost:8000'
    : 'https://movie-ranking-api-ea3e.onrender.com';
let sessionId = null;
let currentComparison = null;
let loadedMovies = [];
let selectedMovieIds = new Set();

// Sync functions for Letterboxd importer
window.syncSessionId = function(id) {
    sessionId = id;
};

window.syncLoadedMovies = function(movies) {
    loadedMovies = movies;
};
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
const comparisonContainer = document.getElementById('comparison-container');
const loading = document.getElementById('loading');
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

// Custom List DOM Elements
const customGroup = document.getElementById('custom-group');
const customListNameInput = document.getElementById('custom-list-name');
const customCsvInput = document.getElementById('custom-csv-input');
const sampleDataBtn = document.getElementById('sample-data-btn');
const clearCustomListBtn = document.getElementById('clear-custom-list-btn');
const importJsonBtn = document.getElementById('import-json-btn');
const customItemCounter = document.getElementById('custom-item-counter');
const customItemsPreview = document.getElementById('custom-items-preview');
const loadCustomListBtn = document.getElementById('load-custom-list-btn');
const toggleCustomListsBtn = document.getElementById('toggle-custom-lists-btn');
const manageCustomListsSection = document.getElementById('manage-custom-lists-section');
const savedCustomLists = document.getElementById('saved-custom-lists');
const customListsSearch = document.getElementById('custom-lists-search');
const exportAllListsBtn = document.getElementById('export-all-lists-btn');

// Past Rankings DOM Elements
const pastRankingsSection = document.getElementById('past-rankings-section');
const historySearch = document.getElementById('history-search');
const pastRankingsList = document.getElementById('past-rankings-list');

// Event Listeners

loadTypeSelect.addEventListener('change', handleLoadTypeChange);
createSessionBtn.addEventListener('click', createSessionAndLoadMovies);
importLetterboxdBtn.addEventListener('click', importLetterboxdList);

// Custom List Event Listeners
if (sampleDataBtn) sampleDataBtn.addEventListener('click', loadSampleData);
if (clearCustomListBtn) clearCustomListBtn.addEventListener('click', clearCustomListInput);
if (importJsonBtn) importJsonBtn.addEventListener('click', importFromJSON);
if (loadCustomListBtn) loadCustomListBtn.addEventListener('click', loadCustomList);
if (toggleCustomListsBtn) toggleCustomListsBtn.addEventListener('click', toggleCustomLists);
if (customListsSearch) customListsSearch.addEventListener('input', filterCustomLists);
if (exportAllListsBtn) exportAllListsBtn.addEventListener('click', exportAllCustomLists);
if (customCsvInput) customCsvInput.addEventListener('input', updateCustomListPreview);
if (historySearch) historySearch.addEventListener('input', (e) => loadPastRankings(e.target.value));
selectAllBtn.addEventListener('click', selectAllMovies);
deselectAllBtn.addEventListener('click', deselectAllMovies);
confirmSelectionBtn.addEventListener('click', confirmSelection);
if (resetBtn) resetBtn.addEventListener('click', reset);
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
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }
});

if (hideShareBtn) hideShareBtn.addEventListener('click', () => {
    if (shareSection) {
        shareSection.classList.add('hidden');
        document.body.style.overflow = ''; // Re-enable scrolling
    }
});

// Close modal when clicking outside
if (shareSection) {
    shareSection.addEventListener('click', (e) => {
        if (e.target === shareSection) {
            shareSection.classList.add('hidden');
            document.body.style.overflow = '';
        }
    });
}

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

var lottieAnimation = null;

function showLoading(show = true) {
    if (show) {
        if (!loading) return;
        loading.classList.remove('hidden');
        if (comparisonContainer) comparisonContainer.classList.add('hidden');
        
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
        if (loading) loading.classList.add('hidden');
        if (typeof lottieAnimation !== 'undefined' && lottieAnimation) {
            try {
                lottieAnimation.destroy();
            } catch (e) {
                // Ignore destroy errors
            }
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
        
        // Save session state
        saveSessionState();

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

        // Check if function exists
        if (typeof window.runLetterboxdImport !== 'function') {
            showMessage('Letterboxd importer not loaded. Please refresh the page.', 'error');
            showLoading(false);
            return;
        }

        await window.runLetterboxdImport(letterboxdUrl);

        // After importToSession completes, we should have loadedMovies populated from server
        selectedMovieIds.clear();
        updateSelectedCount();
        sessionStatusSpan.textContent = `Imported ${loadedMovies.length} movies`;
        showLoading(false);
        
        // Save session state
        saveSessionState();

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
    // Use window.loadedMovies if available (from Letterboxd import), otherwise use local loadedMovies
    const moviesToSelect = window.loadedMovies && window.loadedMovies.length > 0 ? window.loadedMovies : loadedMovies;
    
    if (!moviesToSelect || moviesToSelect.length === 0) {
        showMessage('No movies loaded to select', 'error');
        return;
    }
    
    moviesToSelect.forEach(movie => {
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
    // Check both local sessionId and window.sessionId (from Letterboxd import)
    const currentSessionId = sessionId || window.sessionId;
    if (!currentSessionId) {
        showMessage('Please create a session first', 'error');
        return;
    }
    
    // Sync window.sessionId to local if it exists
    if (window.sessionId && !sessionId) {
        sessionId = window.sessionId;
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
            `/api/session/${sessionId || window.sessionId}/movies/select`,
            'POST',
            { movie_ids: movieIdsArray }
        );
        
        showMessage(`Selected ${data.selected_count} movies! Starting ranking...`, 'success');
        
        // Hide selection section
        selectionSection.classList.add('hidden');
        
        showLoading(false);
        
        // Save session state
        saveSessionState();
        
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
    // Check both local sessionId and window.sessionId (from Letterboxd import)
    const currentSessionId = sessionId || window.sessionId;
    if (!currentSessionId) {
        showMessage('Please create a session and select movies first', 'error');
        return;
    }
    
    // Sync window.sessionId to local if it exists
    if (window.sessionId && !sessionId) {
        sessionId = window.sessionId;
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
            
            // Save session state
            saveSessionState();
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
        // Use a more accurate upper bound: n*log2(n) + n for worst case
        const estimatedTotalComparisons = totalMoviesToRank > 1 
            ? Math.ceil(totalMoviesToRank * (Math.log2(totalMoviesToRank) + 1))
            : 0;
        
        // Calculate progress percentage
        let progressPercentage = 0;
        if (estimatedTotalComparisons > 0) {
            // Use a smoother progress calculation that accounts for uncertainty
            // Cap at 95% until actually complete to avoid showing 100% prematurely
            progressPercentage = Math.min(95, Math.max(0, (comparisonsMade / estimatedTotalComparisons) * 100));
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

    // Hide config section, show comparison
    const configSection = document.getElementById('config-section');
    if (configSection) {
        configSection.classList.add('hidden');
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
            // Ranking is complete! Set progress to 100%
            const progressBar = document.getElementById('progress-bar');
            if (progressBar) {
                progressBar.style.width = '100%';
            }
            
            showMessage('Ranking complete!', 'success');
            comparisonContainer.classList.add('hidden');
            // Re-enable body scroll
            document.body.classList.remove('overflow-hidden');
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
            
            // Save session state after each comparison
            saveSessionState();
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
    
    // Save to history
    saveRankingToHistory(rankedMovies, data.unseen_movies || []);
    
    // Update share card with all ranked movies
    const shareCardTopMovies = document.getElementById('share-card-top-movies');
    if (shareCardAllMovies && rankedMovies.length > 0) {
        // Clear existing content
        shareCardAllMovies.innerHTML = '';
        if (shareCardTopMovies) shareCardTopMovies.innerHTML = '';
        
        const movieCount = rankedMovies.length;
        
        // Display top 3 movies prominently
        if (shareCardTopMovies && movieCount >= 3) {
            const top3 = rankedMovies.slice(0, 3);
            top3.forEach((movie, idx) => {
                const rank = idx + 1;
                const medalColors = [
                    'from-yellow-400 to-yellow-600', // Gold
                    'from-gray-300 to-gray-500',     // Silver
                    'from-amber-600 to-amber-800'    // Bronze
                ];
                const medalEmojis = ['🥇', '🥈', '🥉'];
                const posterUrl = movie.poster_url || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'150\' height=\'225\'%3E%3Crect fill=\'%23ddd\' width=\'150\' height=\'225\'/%3E%3Ctext fill=\'%23999\' font-family=\'sans-serif\' font-size=\'14\' x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dominant-baseline=\'middle\'%3ENo Poster%3C/text%3E%3C/svg%3E';
                
                const topMovieDiv = document.createElement('div');
                topMovieDiv.className = 'flex flex-col items-center';
                topMovieDiv.innerHTML = `
                    <div class="relative w-full aspect-[2/3] mb-2 rounded-lg overflow-hidden bg-white/10 backdrop-blur-sm border border-white/20 shadow-xl">
                        <div class="absolute top-1 right-1 z-20 bg-gradient-to-r ${medalColors[idx]} text-white font-bold rounded-full w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-xs sm:text-sm shadow-lg border-2 border-white">
                            ${medalEmojis[idx]}
                        </div>
                        <img src="${posterUrl}" 
                             alt="${movie.title}"
                             class="w-full h-full object-cover"
                             loading="eager">
                    </div>
                    <p class="text-[10px] sm:text-xs text-white font-semibold text-center line-clamp-2 leading-tight px-1 drop-shadow-md">${movie.title}</p>
                `;
                shareCardTopMovies.appendChild(topMovieDiv);
            });
        } else if (shareCardTopMovies && movieCount > 0) {
            // If less than 3 movies, show what we have
            rankedMovies.slice(0, movieCount).forEach((movie, idx) => {
                const rank = idx + 1;
                const posterUrl = movie.poster_url || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'150\' height=\'225\'%3E%3Crect fill=\'%23ddd\' width=\'150\' height=\'225\'/%3E%3Ctext fill=\'%23999\' font-family=\'sans-serif\' font-size=\'14\' x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dominant-baseline=\'middle\'%3ENo Poster%3C/text%3E%3C/svg%3E';
                
                const topMovieDiv = document.createElement('div');
                topMovieDiv.className = 'flex flex-col items-center';
                topMovieDiv.innerHTML = `
                    <div class="relative w-full aspect-[2/3] mb-2 rounded-lg overflow-hidden bg-white/10 backdrop-blur-sm border border-white/20 shadow-xl">
                        <div class="absolute top-1 right-1 z-20 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold rounded-full w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-xs sm:text-sm shadow-lg border-2 border-white">
                            ${rank}
                        </div>
                        <img src="${posterUrl}" 
                             alt="${movie.title}"
                             class="w-full h-full object-cover"
                             loading="eager">
                    </div>
                    <p class="text-[10px] sm:text-xs text-white font-semibold text-center line-clamp-2 leading-tight px-1 drop-shadow-md">${movie.title}</p>
                `;
                shareCardTopMovies.appendChild(topMovieDiv);
            });
        }
        
        // Display remaining movies in a grid (skip top 3 if we have 3+)
        const remainingMovies = movieCount > 3 ? rankedMovies.slice(3) : [];
        if (remainingMovies.length > 0) {
            // Calculate grid columns for remaining movies - optimize for 4:5 aspect ratio
            let gridCols = 3;
            if (remainingMovies.length <= 6) gridCols = 3;
            else if (remainingMovies.length <= 12) gridCols = 4;
            else if (remainingMovies.length <= 20) gridCols = 5;
            else gridCols = 5; // Max 5 columns for readability
            
            shareCardAllMovies.className = `grid gap-1 sm:gap-1.5 overflow-hidden`;
            shareCardAllMovies.style.gridTemplateColumns = `repeat(${gridCols}, minmax(0, 1fr))`;
            shareCardAllMovies.style.gridAutoRows = '1fr';
            
            remainingMovies.forEach((movie, idx) => {
                const rank = idx + 4; // Start from rank 4
                const movieDiv = document.createElement('div');
                movieDiv.className = 'text-center flex flex-col min-h-0';
                const posterUrl = movie.poster_url || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'150\' height=\'225\'%3E%3Crect fill=\'%23ddd\' width=\'150\' height=\'225\'/%3E%3Ctext fill=\'%23999\' font-family=\'sans-serif\' font-size=\'14\' x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dominant-baseline=\'middle\'%3ENo Poster%3C/text%3E%3C/svg%3E';
                movieDiv.innerHTML = `
                    <div class="relative flex-shrink-0 mb-1 flex-1 min-h-0 flex items-center justify-center bg-white/5 backdrop-blur-sm rounded border border-white/10">
                        <div class="absolute top-0.5 left-0.5 z-20 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center text-[8px] sm:text-[10px] shadow-md border border-white/30">
                            ${rank}
                        </div>
                        <img src="${posterUrl}" 
                             alt="${movie.title}"
                             class="w-full h-full object-cover rounded"
                             loading="eager">
                    </div>
                    <p class="text-[8px] sm:text-[10px] text-white/90 line-clamp-1 font-medium leading-tight mt-auto px-0.5 drop-shadow-sm">${movie.title}</p>
                `;
                shareCardAllMovies.appendChild(movieDiv);
            });
        } else if (movieCount <= 3) {
            // If 3 or fewer movies total, show them all in top section and leave grid empty
            shareCardAllMovies.style.display = 'none';
        }
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
    comparisonContainer.classList.add('hidden');
    resultsSection.classList.add('hidden');
    
    // Show config section
    const configSection = document.getElementById('config-section');
    if (configSection) {
        configSection.classList.remove('hidden');
    }
    
    // Re-enable body scroll
    document.body.style.overflow = '';
    
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
        comparisonContainer.classList.add('hidden');
        document.body.style.overflow = '';
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

async function shareToTwitter() {
    // Generate image first, then upload and share
    if (shareCardPreview && typeof html2canvas !== 'undefined') {
        showMessage('Generating image for sharing...', 'info');
        try {
            const imageDataUrl = await generateShareImage();
            if (imageDataUrl) {
                // Upload image to imgur for sharing
                try {
                    const blob = await (await fetch(imageDataUrl)).blob();
                    const formData = new FormData();
                    formData.append('image', blob);
                    
                    const uploadResponse = await fetch('https://api.imgur.com/3/image', {
                        method: 'POST',
                        headers: {
                            'Authorization': 'Client-ID 546c25a59c58ad7' // Public imgur client ID
                        },
                        body: formData
                    });
                    
                    if (uploadResponse.ok) {
                        const uploadData = await uploadResponse.json();
                        if (uploadData.success && uploadData.data && uploadData.data.link) {
                            const imageUrl = uploadData.data.link;
                            const text = encodeURIComponent(getShareText());
                            const url = `https://x.com/intent/tweet?text=${text}&url=${encodeURIComponent(imageUrl)}`;
                            window.open(url, '_blank', 'width=550,height=420');
                            showMessage('Image uploaded! Opening X to share...', 'success');
                            return;
                        }
                    }
                } catch (uploadError) {
                    console.warn('Failed to upload to imgur:', uploadError);
                }
                
                // Fallback: download image and share text
                const text = encodeURIComponent(getShareText() + '\n\nCheck out the image below!');
                const url = `https://x.com/intent/tweet?text=${text}`;
                window.open(url, '_blank', 'width=550,height=420');
                setTimeout(() => downloadShareImage(), 500);
            } else {
                // Fallback to text-only share
                const text = encodeURIComponent(getShareText());
                const url = `https://x.com/intent/tweet?text=${text}`;
                window.open(url, '_blank', 'width=550,height=420');
            }
        } catch (e) {
            console.error('Failed to generate image:', e);
            // Fallback to text-only share
            const text = encodeURIComponent(getShareText());
            const url = `https://x.com/intent/tweet?text=${text}`;
            window.open(url, '_blank', 'width=550,height=420');
        }
    } else {
        const text = encodeURIComponent(getShareText());
        const url = `https://x.com/intent/tweet?text=${text}`;
        window.open(url, '_blank', 'width=550,height=420');
    }
}

async function shareToFacebook() {
    // Generate image first, then upload and share
    if (shareCardPreview && typeof html2canvas !== 'undefined') {
        showMessage('Generating image for sharing...', 'info');
        try {
            const imageDataUrl = await generateShareImage();
            if (imageDataUrl) {
                // Upload image to imgur for sharing
                try {
                    const blob = await (await fetch(imageDataUrl)).blob();
                    const formData = new FormData();
                    formData.append('image', blob);
                    
                    const uploadResponse = await fetch('https://api.imgur.com/3/image', {
                        method: 'POST',
                        headers: {
                            'Authorization': 'Client-ID 546c25a59c58ad7' // Public imgur client ID
                        },
                        body: formData
                    });
                    
                    if (uploadResponse.ok) {
                        const uploadData = await uploadResponse.json();
                        if (uploadData.success && uploadData.data && uploadData.data.link) {
                            const imageUrl = uploadData.data.link;
                            // Facebook doesn't support direct image sharing via URL, but we can share the link
                            const url = encodeURIComponent(getShareUrl());
                            window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank', 'width=550,height=420');
                            showMessage('Image uploaded! Share the link on Facebook.', 'success');
                            return;
                        }
                    }
                } catch (uploadError) {
                    console.warn('Failed to upload to imgur:', uploadError);
                }
                
                // Fallback: download image
                setTimeout(() => downloadShareImage(), 500);
            }
        } catch (e) {
            console.error('Failed to generate image:', e);
        }
    }
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

// Convert image to data URL using fetch to avoid CORS issues
async function imageToDataUrl(img) {
    // Skip if already a data URL or placeholder
    if (img.src.startsWith('data:') || img.src.includes('placeholder')) {
        return img.src;
    }
    
    // Skip if image hasn't loaded properly
    if (!img.complete || img.naturalWidth === 0 || img.naturalHeight === 0) {
        return img.src;
    }
    
    // List of CORS proxies to try (in order of preference)
    const proxies = [
        `https://api.allorigins.win/get?url=${encodeURIComponent(img.src)}`,
        `https://corsproxy.io/?${encodeURIComponent(img.src)}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(img.src)}`
    ];
    
    // Try direct fetch first
    try {
        const response = await fetch(img.src, { mode: 'cors' });
        if (response.ok) {
            const blob = await response.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => resolve(null); // Try proxy instead
                reader.readAsDataURL(blob);
            });
        }
    } catch (e) {
        // Direct fetch failed, try proxies
    }
    
    // Try each proxy in order
    for (const proxyUrl of proxies) {
        try {
            let response;
            let blob;
            
            if (proxyUrl.includes('allorigins.win')) {
                // allorigins.win returns JSON with contents
                response = await fetch(proxyUrl);
                if (response.ok) {
                    const data = await response.json();
                    const imgResponse = await fetch(data.contents);
                    blob = await imgResponse.blob();
                } else {
                    continue; // Try next proxy
                }
            } else {
                // Other proxies return the image directly
                response = await fetch(proxyUrl);
                if (response.ok) {
                    blob = await response.blob();
                } else {
                    continue; // Try next proxy
                }
            }
            
            if (blob) {
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => resolve(null); // Try next proxy
                    reader.readAsDataURL(blob);
                });
            }
        } catch (proxyError) {
            // Try next proxy
            continue;
        }
    }
    
    // All methods failed, return original (will cause tainted canvas but at least we tried)
    console.warn('Could not convert image to data URL, will use original (may cause tainted canvas):', img.src);
    return img.src;
}

// Load image and convert to data URL for html2canvas
async function ensureImageLoaded(img) {
    return new Promise(async (resolve) => {
        // Skip placeholder images and data URLs - they don't need conversion
        if (img.src && (img.src.includes('via.placeholder.com') || img.src.includes('placeholder') || img.src.startsWith('data:'))) {
            resolve();
            return;
        }
        
        // Wait for image to load (even if CORS fails, it may still display)
        const convertImage = async () => {
            try {
                const dataUrl = await imageToDataUrl(img);
                if (dataUrl && dataUrl.startsWith('data:')) {
                    // Successfully converted to data URL
                    img.setAttribute('data-original-src', img.src);
                    img.src = dataUrl;
                } else if (dataUrl && dataUrl !== img.src) {
                    // Got a different URL (maybe from proxy), use it
                    img.setAttribute('data-original-src', img.src);
                    img.src = dataUrl;
                }
                // If dataUrl === img.src, conversion failed, keep original
            } catch (e) {
                // Keep original src if conversion fails - image will still display
                console.warn('Failed to convert image (will use original):', e);
            }
        };
        
        if (img.complete && img.naturalHeight !== 0 && img.naturalWidth !== 0) {
            // Image is already loaded
            await convertImage();
            resolve();
            return;
        }
        
        const timeout = setTimeout(() => {
            resolve(); // Resolve anyway after timeout
        }, 10000); // Increased timeout for proxy requests
        
        img.onload = async () => {
            clearTimeout(timeout);
            await convertImage();
            resolve();
        };
        
        img.onerror = () => {
            clearTimeout(timeout);
            resolve(); // Resolve even on error
        };
        
        // Force reload if needed
        if (!img.src || img.src === '') {
            const originalSrc = img.getAttribute('data-src') || img.getAttribute('data-original-src') || img.getAttribute('src');
            if (originalSrc) {
                img.src = originalSrc;
            }
        }
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
    showMessage('Converting images for download... This may take a moment.', 'info');
    
    // Ensure all images are loaded and converted to data URLs before capturing
    const images = shareCardPreview.querySelectorAll('img');
    const imagePromises = Array.from(images).map(img => ensureImageLoaded(img));
    
    Promise.all(imagePromises).then(() => {
        showMessage('Generating image...', 'info');
        // Scroll to top of share card for better image capture
        shareCardPreview.scrollIntoView({ behavior: 'auto', block: 'start' });
        
        setTimeout(() => {
            html2canvas(shareCardPreview, {
                backgroundColor: null,
                scale: 2,
                useCORS: true, // Now that images are data URLs, we can use CORS
                allowTaint: false, // No taint since images are data URLs
                logging: false,
                scrollX: 0,
                scrollY: 0,
                windowWidth: shareCardPreview.scrollWidth,
                windowHeight: shareCardPreview.scrollHeight,
                ignoreElements: (element) => {
                    // Ignore elements that are hidden or have no content
                    return element.style.display === 'none' || element.offsetWidth === 0 || element.offsetHeight === 0;
                }
            }).then(canvas => {
                // Convert canvas to blob and download
                canvas.toBlob((blob) => {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.download = `movie-ranking-${sessionId || 'ranking'}.png`;
                    link.href = url;
                    link.click();
                    URL.revokeObjectURL(url);
                    showMessage('Image downloaded!', 'success');
                }, 'image/png');
            }).catch(error => {
                console.error('Failed to generate image:', error);
                showMessage('Failed to generate image. Please try again.', 'error');
            });
        }, 500);
    });
}

// Helper function to generate share image and return data URL
async function generateShareImage() {
    if (!shareCardPreview || typeof html2canvas === 'undefined') return null;
    
    // Ensure all images are loaded
    const images = shareCardPreview.querySelectorAll('img');
    await Promise.all(Array.from(images).map(img => ensureImageLoaded(img)));
    
    return new Promise((resolve) => {
        setTimeout(() => {
            html2canvas(shareCardPreview, {
                backgroundColor: null,
                scale: 2,
                useCORS: true, // Now that images are data URLs, we can use CORS
                allowTaint: false, // No taint since images are data URLs
                logging: false,
                scrollX: 0,
                scrollY: 0,
                windowWidth: shareCardPreview.scrollWidth,
                windowHeight: shareCardPreview.scrollHeight,
                ignoreElements: (element) => {
                    // Ignore elements that are hidden or have no content
                    return element.style.display === 'none' || element.offsetWidth === 0 || element.offsetHeight === 0;
                }
            }).then(canvas => {
                const dataUrl = canvas.toDataURL('image/png');
                resolve(dataUrl);
            }).catch(error => {
                console.error('Failed to generate image:', error);
                resolve(null);
            });
        }, 500);
    });
}

// ==================== SESSION PERSISTENCE FUNCTIONS ====================

function saveSessionState() {
    if (!sessionId) return;
    
    try {
        const state = {
            sessionId,
            lastActive: Date.now(),
            currentStep: getCurrentStep(), // 'loading', 'selecting', 'ranking', 'complete'
            listName: getCurrentListName(),
            movies: loadedMovies,
            selectedMovieIds: Array.from(selectedMovieIds),
            comparisonsMade,
            totalMoviesToRank,
            currentComparison,
            // Don't save final results here - those go to history
        };
        
        localStorage.setItem('active_ranking_session', JSON.stringify(state));
    } catch (e) {
        console.warn('Failed to save session:', e);
    }
}

function getCurrentStep() {
    if (resultsSection && !resultsSection.classList.contains('hidden')) return 'complete';
    if (comparisonContainer && !comparisonContainer.classList.contains('hidden')) return 'ranking';
    if (selectionSection && !selectionSection.classList.contains('hidden')) return 'selecting';
    return 'loading';
}

function getCurrentListName() {
    const loadType = loadTypeSelect.value;
    if (loadType === 'category') {
        const option = movieCategorySelect.options[movieCategorySelect.selectedIndex];
        return option ? option.text : 'Category';
    }
    if (loadType === 'year') {
        return `${movieYearInput.value} Movies`;
    }
    if (loadType === 'custom') {
        return customListNameInput ? (customListNameInput.value || 'Custom List') : 'Custom List';
    }
    return 'Movies';
}

function checkForActiveSession() {
    try {
        const saved = localStorage.getItem('active_ranking_session');
        if (!saved) return;
        
        const state = JSON.parse(saved);
        
        // Check if session is too old (24 hours)
        const age = Date.now() - state.lastActive;
        if (age > 24 * 60 * 60 * 1000) {
            localStorage.removeItem('active_ranking_session');
            return;
        }
        
        // Show recovery modal
        showSessionRecoveryModal(state, age);
    } catch (e) {
        console.warn('Failed to check for session:', e);
        localStorage.removeItem('active_ranking_session');
    }
}

function showSessionRecoveryModal(state, age) {
    const minutes = Math.floor(age / 60000);
    const timeAgo = minutes < 60 ? `${minutes} minutes ago` : `${Math.floor(minutes / 60)} hours ago`;
    
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm';
    modal.innerHTML = `
        <div class="modern-card rounded-2xl p-6 max-w-md">
            <h3 class="text-xl font-bold text-white mb-3">Continue Ranking?</h3>
            <p class="text-gray-300 mb-4">
                You have an in-progress ranking from ${timeAgo}:<br>
                <strong class="text-white">${state.listName || 'Unknown List'}</strong><br>
                <span class="text-sm text-gray-400">${state.comparisonsMade || 0} comparisons made</span>
            </p>
            <div class="flex gap-3">
                <button onclick="restoreSession()" class="btn-primary flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-cyan-700 transition-all">Continue</button>
                <button onclick="clearSession()" class="btn-secondary flex-1 px-4 py-2 bg-gray-600/50 text-white font-medium rounded-lg hover:bg-gray-600/70 transition-all">Start Fresh</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    window.sessionRecoveryModal = modal;
    
    // Expose restoreSession to global scope
    window.restoreSession = restoreSession;
    window.clearSession = clearSession;
}

function restoreSession() {
    try {
        const saved = localStorage.getItem('active_ranking_session');
        if (!saved) {
            showMessage('No session found to restore', 'error');
            return;
        }
        
        const state = JSON.parse(saved);
        
        // Restore global state
        sessionId = state.sessionId;
        loadedMovies = state.movies || [];
        comparisonsMade = state.comparisonsMade || 0;
        totalMoviesToRank = state.totalMoviesToRank || 0;
        currentComparison = state.currentComparison || null;
        
        // Hide config, show appropriate section
        configSection.classList.add('hidden');
        
        if (state.currentStep === 'selecting') {
            selectionSection.classList.remove('hidden');
            displayMoviesForSelection(state.movies);
            
            // Restore selected movies
            (state.selectedMovieIds || []).forEach(id => {
                const element = document.querySelector(`[data-movie-id="${id}"]`);
                if (element) {
                    selectedMovieIds.add(id);
                    const card = element.querySelector('.modern-card');
                    const checkmark = element.querySelector('.selected-checkmark');
                    card?.classList.add('ring-2', 'ring-green-500');
                    checkmark?.classList.remove('hidden');
                }
            });
            updateSelectedCount();
            
        } else if (state.currentStep === 'ranking' && state.currentComparison) {
            comparisonContainer.classList.remove('hidden');
            displayComparison(state.currentComparison, {});
            document.body.classList.add('overflow-hidden');
            
        } else if (state.currentStep === 'complete') {
            // Session was complete, just clear it
            clearSession();
            return;
        }
        
        showMessage('Session restored! Continue where you left off.', 'success');
        
        // Remove modal
        if (window.sessionRecoveryModal) {
            window.sessionRecoveryModal.remove();
            window.sessionRecoveryModal = null;
        }
        
        // Update session info
        if (sessionIdSpan) sessionIdSpan.textContent = sessionId;
        if (sessionStatusSpan) sessionStatusSpan.textContent = `Restored session`;
        if (sessionInfo) sessionInfo.classList.remove('hidden');
        
    } catch (e) {
        console.error('Failed to restore session:', e);
        showMessage('Failed to restore session', 'error');
        clearSession();
    }
}

function clearSession() {
    try {
        localStorage.removeItem('active_ranking_session');
        if (window.sessionRecoveryModal) {
            window.sessionRecoveryModal.remove();
            window.sessionRecoveryModal = null;
        }
        showMessage('Starting fresh session', 'info');
    } catch (e) {
        console.warn('Failed to clear session:', e);
    }
}

function clearSessionManually() {
    if (confirm('Clear active session? This will reset your current ranking.')) {
        clearSession();
        reset();
    }
}

function saveRankingToHistory(rankedMovies, unseenMovies = []) {
    try {
        const history = JSON.parse(localStorage.getItem('ranking_history') || '[]');
        
        const ranking = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            listName: getCurrentListName(),
            type: loadTypeSelect.value, // 'category', 'year', 'custom'
            rankedMovies: rankedMovies,
            unseenMovies: unseenMovies,
            totalComparisons: comparisonsMade
        };
        
        history.unshift(ranking); // Add to beginning
        
        // Keep only last 50 rankings
        if (history.length > 50) {
            history.length = 50;
        }
        
        localStorage.setItem('ranking_history', JSON.stringify(history));
        
        // Clear active session
        localStorage.removeItem('active_ranking_session');
        
    } catch (e) {
        console.warn('Failed to save ranking history:', e);
    }
}

// ==================== PAST RANKINGS FUNCTIONS ====================

function togglePastRankings() {
    if (!pastRankingsSection) return;
    pastRankingsSection.classList.toggle('hidden');
    if (!pastRankingsSection.classList.contains('hidden')) {
        loadPastRankings();
    }
}

function loadPastRankings(searchTerm = '') {
    if (!pastRankingsList) return;
    
    try {
        const history = JSON.parse(localStorage.getItem('ranking_history') || '[]');
        
        const filtered = searchTerm 
            ? history.filter(r => r.listName.toLowerCase().includes(searchTerm.toLowerCase()))
            : history;
        
        if (filtered.length === 0) {
            pastRankingsList.innerHTML = '<p class="text-gray-400">No past rankings found</p>';
            return;
        }
        
        pastRankingsList.innerHTML = filtered.map(ranking => `
            <div class="glass rounded-lg p-4 mb-3">
                <div class="flex justify-between items-start mb-2">
                    <div class="flex-1">
                        <h4 class="font-semibold text-white">${ranking.listName}</h4>
                        <p class="text-xs text-gray-400">
                            ${new Date(ranking.timestamp).toLocaleString()} • 
                            ${ranking.rankedMovies.length} ranked • 
                            ${ranking.totalComparisons} comparisons
                        </p>
                    </div>
                    <div class="flex gap-1 ml-2">
                        ${ranking.rankedMovies.slice(0, 3).map(m => `
                            <img src="${m.poster_url}" alt="${m.title}" 
                                 class="w-8 h-12 object-cover rounded" 
                                 onerror="this.src='https://via.placeholder.com/50x75'">
                        `).join('')}
                    </div>
                </div>
                <div class="flex gap-2 mt-3">
                    <button onclick="viewPastRanking('${ranking.id}')" class="btn-minimal text-xs px-3 py-1">View</button>
                    <button onclick="reRankList('${ranking.id}')" class="btn-minimal text-xs px-3 py-1">Re-rank</button>
                    <button onclick="deletePastRanking('${ranking.id}')" class="btn-minimal text-xs px-3 py-1 text-red-400">Delete</button>
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.warn('Failed to load past rankings:', e);
        pastRankingsList.innerHTML = '<p class="text-gray-400">Error loading rankings</p>';
    }
}

function viewPastRanking(id) {
    try {
        const history = JSON.parse(localStorage.getItem('ranking_history') || '[]');
        const ranking = history.find(r => r.id === id);
        
        if (!ranking) {
            showMessage('Ranking not found', 'error');
            return;
        }
        
        // Display results
        displayResults({
            ranked_movies: ranking.rankedMovies,
            unseen_movies: ranking.unseenMovies || []
        });
        
        resultsSection.classList.remove('hidden');
        configSection.classList.add('hidden');
        if (pastRankingsSection) pastRankingsSection.classList.add('hidden');
        
        // Show comparison count
        showMessage(`Completed in ${ranking.totalComparisons} comparisons`, 'info');
    } catch (e) {
        console.warn('Failed to view past ranking:', e);
        showMessage('Failed to load ranking', 'error');
    }
}

function reRankList(id) {
    try {
        const history = JSON.parse(localStorage.getItem('ranking_history') || '[]');
        const ranking = history.find(r => r.id === id);
        
        if (!ranking) {
            showMessage('Ranking not found', 'error');
            return;
        }
        
        // Load same movies and start fresh ranking
        loadedMovies = ranking.rankedMovies.concat(ranking.unseenMovies || []);
        
        configSection.classList.add('hidden');
        if (pastRankingsSection) pastRankingsSection.classList.add('hidden');
        selectionSection.classList.remove('hidden');
        
        displayMoviesForSelection(loadedMovies);
        showMessage(`Re-ranking "${ranking.listName}"`, 'info');
        
        // Create new session
        createSessionForReRanking(ranking.listName, loadedMovies);
    } catch (e) {
        console.warn('Failed to re-rank list:', e);
        showMessage('Failed to start re-ranking', 'error');
    }
}

async function createSessionForReRanking(listName, items) {
    try {
        showLoading(true);
        
        // Create session
        const sessionData = await apiCall('/api/session/create', 'POST');
        sessionId = sessionData.session_id;
        sessionIdSpan.textContent = sessionId;
        sessionInfo.classList.remove('hidden');
        sessionStatusSpan.textContent = `Loaded ${items.length} items`;
        
        showLoading(false);
        saveSessionState();
    } catch (error) {
        showLoading(false);
        console.error('Failed to create session for re-ranking:', error);
    }
}

function deletePastRanking(id) {
    if (!confirm('Delete this ranking?')) return;
    
    try {
        let history = JSON.parse(localStorage.getItem('ranking_history') || '[]');
        history = history.filter(r => r.id !== id);
        localStorage.setItem('ranking_history', JSON.stringify(history));
        
        loadPastRankings();
        showMessage('Ranking deleted', 'info');
    } catch (e) {
        console.warn('Failed to delete past ranking:', e);
        showMessage('Failed to delete ranking', 'error');
    }
}

function exportAllRankings() {
    try {
        const history = JSON.parse(localStorage.getItem('ranking_history') || '[]');
        const json = JSON.stringify(history, null, 2);
        navigator.clipboard.writeText(json).then(() => {
            showMessage('All rankings copied to clipboard', 'success');
        }).catch(() => {
            showMessage('Failed to copy to clipboard', 'error');
        });
    } catch (e) {
        console.warn('Failed to export all rankings:', e);
        showMessage('Failed to export rankings', 'error');
    }
}

// Add beforeunload warning during active ranking
window.addEventListener('beforeunload', (e) => {
    // Only warn if actively ranking (not on results screen)
    if (sessionId && currentComparison && comparisonContainer && !comparisonContainer.classList.contains('hidden')) {
        e.preventDefault();
        e.returnValue = 'You have an active ranking in progress. Are you sure you want to leave?';
        return e.returnValue;
    }
});

// Expose functions to global scope for onclick handlers
window.loadCustomListById = loadCustomListById;
window.editCustomList = editCustomList;
window.exportCustomList = exportCustomList;
window.deleteCustomList = deleteCustomList;
window.togglePastRankings = togglePastRankings;
window.viewPastRanking = viewPastRanking;
window.reRankList = reRankList;
window.deletePastRanking = deletePastRanking;
window.exportAllRankings = exportAllRankings;
window.clearSessionManually = clearSessionManually;

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
    
    // Check for active session on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkForActiveSession);
    } else {
        checkForActiveSession();
    }
    
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

// ==================== CUSTOM LIST FUNCTIONS ====================

function loadSampleData() {
    if (!customCsvInput) return;
    const sampleData = `Wraith,https://via.placeholder.com/300x450?text=Wraith
Pathfinder,https://via.placeholder.com/300x450?text=Pathfinder
Bloodhound,https://via.placeholder.com/300x450?text=Bloodhound`;
    customCsvInput.value = sampleData;
    updateCustomListPreview();
}

function clearCustomListInput() {
    if (customListNameInput) customListNameInput.value = '';
    if (customCsvInput) customCsvInput.value = '';
    if (customItemCounter) customItemCounter.textContent = '0 items added';
    if (customItemsPreview) {
        customItemsPreview.innerHTML = '<p class="text-xs text-gray-500 dark:text-gray-500">Preview will appear here</p>';
    }
}

function updateCustomListPreview() {
    if (!customCsvInput || !customItemsPreview || !customItemCounter) return;
    
    const csvInput = customCsvInput.value.trim();
    if (!csvInput) {
        customItemsPreview.innerHTML = '<p class="text-xs text-gray-500 dark:text-gray-500">Preview will appear here</p>';
        customItemCounter.textContent = '0 items added';
        return;
    }
    
    const lines = csvInput.split('\n').filter(line => line.trim());
    const items = [];
    
    lines.forEach((line, index) => {
        const [name, imageUrl] = line.split(',').map(s => s.trim());
        if (name) {
            items.push({
                id: -(index + 1),
                title: name,
                poster_url: imageUrl || `https://via.placeholder.com/300x450?text=${encodeURIComponent(name)}`,
                release_date: null,
                vote_average: 0,
                overview: ""
            });
        }
    });
    
    customItemCounter.textContent = `${items.length} items added`;
    
    if (items.length === 0) {
        customItemsPreview.innerHTML = '<p class="text-xs text-gray-500 dark:text-gray-500">Preview will appear here</p>';
        return;
    }
    
    // Display preview grid
    customItemsPreview.innerHTML = `
        <div class="grid grid-cols-3 sm:grid-cols-4 gap-2">
            ${items.slice(0, 8).map(item => `
                <div class="text-center">
                    <img src="${item.poster_url}" alt="${item.title}" 
                         class="w-full h-auto rounded mb-1 object-cover"
                         onerror="this.src='https://via.placeholder.com/100x150?text=${encodeURIComponent(item.title)}'">
                    <p class="text-xs text-gray-300 line-clamp-1">${item.title}</p>
                </div>
            `).join('')}
        </div>
        ${items.length > 8 ? `<p class="text-xs text-gray-400 mt-2">+${items.length - 8} more items</p>` : ''}
    `;
}

function createCustomList() {
    if (!customListNameInput || !customCsvInput) return null;
    
    const listName = customListNameInput.value.trim();
    const csvInput = customCsvInput.value.trim();
    
    if (!listName) {
        showMessage('Please enter a list name', 'error');
        return null;
    }
    
    if (!csvInput) {
        showMessage('Please add some items', 'error');
        return null;
    }
    
    const lines = csvInput.split('\n').filter(line => line.trim());
    const items = [];
    
    lines.forEach((line, index) => {
        const [name, imageUrl] = line.split(',').map(s => s.trim());
        if (name) {
            items.push({
                id: -(index + 1),
                title: name,
                poster_url: imageUrl || `https://via.placeholder.com/300x450?text=${encodeURIComponent(name)}`,
                release_date: null,
                vote_average: 0,
                overview: ""
            });
        }
    });
    
    if (items.length < 2) {
        showMessage('Need at least 2 items to rank', 'error');
        return null;
    }
    
    return items;
}

function saveCustomList(listName, items) {
    try {
        const lists = JSON.parse(localStorage.getItem('custom_ranking_lists') || '[]');
        
        const newList = {
            id: Date.now().toString(),
            name: listName,
            created: Date.now(),
            items: items
        };
        
        lists.push(newList);
        localStorage.setItem('custom_ranking_lists', JSON.stringify(lists));
        
        showMessage(`Saved "${listName}" with ${items.length} items`, 'success');
        loadCustomListsFromStorage();
    } catch (e) {
        console.warn('Failed to save custom list:', e);
        showMessage('Failed to save list. Storage may be full.', 'error');
    }
}

function loadCustomListsFromStorage() {
    if (!savedCustomLists) return;
    
    try {
        const lists = JSON.parse(localStorage.getItem('custom_ranking_lists') || '[]');
        
        if (lists.length === 0) {
            savedCustomLists.innerHTML = '<p class="text-gray-400">No saved lists yet</p>';
            return;
        }
        
        savedCustomLists.innerHTML = lists.map(list => `
            <div class="glass rounded-lg p-4 mb-3">
                <div class="flex justify-between items-start mb-2">
                    <div class="flex-1">
                        <h4 class="font-semibold text-white">${list.name}</h4>
                        <p class="text-xs text-gray-400">${list.items.length} items • ${new Date(list.created).toLocaleDateString()}</p>
                    </div>
                    <div class="flex gap-1 ml-2">
                        ${list.items.slice(0, 3).map(item => `
                            <img src="${item.poster_url}" alt="${item.title}" 
                                 class="w-8 h-12 object-cover rounded" 
                                 onerror="this.src='https://via.placeholder.com/50x75'">
                        `).join('')}
                    </div>
                </div>
                <div class="flex gap-2 mt-3">
                    <button onclick="loadCustomListById('${list.id}')" class="btn-minimal text-xs px-3 py-1">Load</button>
                    <button onclick="editCustomList('${list.id}')" class="btn-minimal text-xs px-3 py-1">Edit</button>
                    <button onclick="exportCustomList('${list.id}')" class="btn-minimal text-xs px-3 py-1">Export</button>
                    <button onclick="deleteCustomList('${list.id}')" class="btn-minimal text-xs px-3 py-1 text-red-400">Delete</button>
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.warn('Failed to load custom lists:', e);
        savedCustomLists.innerHTML = '<p class="text-gray-400">Error loading lists</p>';
    }
}

function loadCustomList() {
    if (!customListNameInput) return;
    
    const items = createCustomList();
    if (!items) return;
    
    const listName = customListNameInput.value.trim();
    
    // Create session first
    createSessionForCustomList(listName, items);
}

async function createSessionForCustomList(listName, items) {
    try {
        showLoading(true);
        showMessage('Creating session...', 'info');
        
        // Create session
        const sessionData = await apiCall('/api/session/create', 'POST');
        sessionId = sessionData.session_id;
        sessionIdSpan.textContent = sessionId;
        sessionInfo.classList.remove('hidden');
        sessionStatusSpan.textContent = 'Session created';
        
        // For custom lists, we'll use the existing selection flow
        // Store items in loadedMovies
        loadedMovies = items;
        sessionStatusSpan.textContent = `Loaded ${items.length} custom items`;
        
        // Hide setup section and show selection section
        configSection.classList.add('hidden');
        if (sessionInfo) sessionInfo.classList.add('hidden');
        selectionSection.classList.remove('hidden');
        
        displayMoviesForSelection(items);
        selectedMovieIds.clear();
        updateSelectedCount();
        
        // Scroll to selection section
        setTimeout(() => {
            selectionSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
        
        showMessage(`Loaded ${items.length} custom items! Select the ones you want to rank.`, 'success');
        showLoading(false);
        
        // Save session state
        saveSessionState();
        
    } catch (error) {
        showLoading(false);
        console.error('Failed to create session for custom list:', error);
    }
}

function loadCustomListById(listId) {
    try {
        const lists = JSON.parse(localStorage.getItem('custom_ranking_lists') || '[]');
        const list = lists.find(l => l.id === listId);
        
        if (!list) {
            showMessage('List not found', 'error');
            return;
        }
        
        // Use existing movie loading flow
        createSessionForCustomList(list.name, list.items);
        
    } catch (e) {
        console.warn('Failed to load custom list:', e);
        showMessage('Failed to load list', 'error');
    }
}

function editCustomList(listId) {
    try {
        const lists = JSON.parse(localStorage.getItem('custom_ranking_lists') || '[]');
        const list = lists.find(l => l.id === listId);
        
        if (!list) {
            showMessage('List not found', 'error');
            return;
        }
        
        // Switch to custom list mode
        loadTypeSelect.value = 'custom';
        handleLoadTypeChange();
        
        // Populate form
        if (customListNameInput) customListNameInput.value = list.name;
        if (customCsvInput) {
            customCsvInput.value = list.items.map(item => {
                const url = item.poster_url || '';
                return `${item.title}${url ? ',' + url : ''}`;
            }).join('\n');
        }
        updateCustomListPreview();
        
        showMessage('List loaded for editing', 'info');
        
    } catch (e) {
        console.warn('Failed to edit custom list:', e);
        showMessage('Failed to load list for editing', 'error');
    }
}

function exportCustomList(listId) {
    try {
        const lists = JSON.parse(localStorage.getItem('custom_ranking_lists') || '[]');
        const list = lists.find(l => l.id === listId);
        
        if (!list) return;
        
        const json = JSON.stringify(list, null, 2);
        navigator.clipboard.writeText(json).then(() => {
            showMessage('List copied to clipboard as JSON', 'success');
        }).catch(() => {
            showMessage('Failed to copy to clipboard', 'error');
        });
    } catch (e) {
        console.warn('Failed to export custom list:', e);
        showMessage('Failed to export list', 'error');
    }
}

function importFromJSON() {
    const json = prompt('Paste JSON list:');
    if (!json) return;
    
    try {
        const list = JSON.parse(json);
        if (!list.name || !list.items || list.items.length < 2) {
            throw new Error('Invalid format');
        }
        
        const lists = JSON.parse(localStorage.getItem('custom_ranking_lists') || '[]');
        list.id = Date.now().toString();
        list.created = Date.now();
        lists.push(list);
        localStorage.setItem('custom_ranking_lists', JSON.stringify(lists));
        
        loadCustomListsFromStorage();
        showMessage('List imported successfully', 'success');
    } catch (e) {
        console.warn('Failed to import JSON:', e);
        showMessage('Invalid JSON format', 'error');
    }
}

function deleteCustomList(listId) {
    if (!confirm('Delete this list?')) return;
    
    try {
        let lists = JSON.parse(localStorage.getItem('custom_ranking_lists') || '[]');
        lists = lists.filter(l => l.id !== listId);
        localStorage.setItem('custom_ranking_lists', JSON.stringify(lists));
        
        loadCustomListsFromStorage();
        showMessage('List deleted', 'info');
    } catch (e) {
        console.warn('Failed to delete custom list:', e);
        showMessage('Failed to delete list', 'error');
    }
}

function toggleCustomLists() {
    if (!manageCustomListsSection) return;
    manageCustomListsSection.classList.toggle('hidden');
    if (!manageCustomListsSection.classList.contains('hidden')) {
        loadCustomListsFromStorage();
    }
}

function filterCustomLists() {
    if (!customListsSearch || !savedCustomLists) return;
    
    const searchTerm = customListsSearch.value.toLowerCase();
    const listItems = savedCustomLists.querySelectorAll('.glass');
    
    listItems.forEach(item => {
        const text = item.textContent.toLowerCase();
        if (text.includes(searchTerm)) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
}

function exportAllCustomLists() {
    try {
        const lists = JSON.parse(localStorage.getItem('custom_ranking_lists') || '[]');
        const json = JSON.stringify(lists, null, 2);
        navigator.clipboard.writeText(json).then(() => {
            showMessage('All lists copied to clipboard', 'success');
        }).catch(() => {
            showMessage('Failed to copy to clipboard', 'error');
        });
    } catch (e) {
        console.warn('Failed to export all lists:', e);
        showMessage('Failed to export lists', 'error');
    }
}

function handleLoadTypeChange() {
    const loadType = loadTypeSelect.value;
    if (loadType === 'category') {
        categoryGroup.classList.remove('hidden');
        yearGroup.classList.add('hidden');
        if (customGroup) customGroup.classList.add('hidden');
    } else if (loadType === 'year') {
        categoryGroup.classList.add('hidden');
        yearGroup.classList.remove('hidden');
        if (customGroup) customGroup.classList.add('hidden');
    } else if (loadType === 'custom') {
        categoryGroup.classList.add('hidden');
        yearGroup.classList.add('hidden');
        if (customGroup) customGroup.classList.remove('hidden');
        loadCustomListsFromStorage(); // Show saved lists
    }
}

