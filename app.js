// API Configuration
let apiUrl = 'https://movie-ranking-api-ea3e.onrender.com';
let sessionId = null;
let currentComparison = null;

// DOM Elements
const apiUrlInput = document.getElementById('api-url');
const movieYearInput = document.getElementById('movie-year');
const maxMoviesInput = document.getElementById('max-movies');
const createSessionBtn = document.getElementById('create-session-btn');
const sessionInfo = document.getElementById('session-info');
const sessionIdSpan = document.getElementById('session-id');
const sessionStatusSpan = document.getElementById('session-status');
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
apiUrlInput.addEventListener('change', (e) => {
    apiUrl = e.target.value.replace(/\/$/, ''); // Remove trailing slash
});

createSessionBtn.addEventListener('click', createSessionAndLoadMovies);
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
    message.className = `message ${type}`;
    message.textContent = text;
    messagesDiv.appendChild(message);

    setTimeout(() => {
        message.remove();
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

async function apiCall(endpoint, method = 'GET', body = null) {
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
        const response = await fetch(url, options);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `HTTP error! status: ${response.status}`);
        }

        return data;
    } catch (error) {
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
        const year = parseInt(movieYearInput.value);
        const maxMovies = parseInt(maxMoviesInput.value);

        const loadData = await apiCall(
            `/api/session/${sessionId}/movies/load`,
            'POST',
            { year, max_movies: maxMovies }
        );

        sessionStatusSpan.textContent = `Loaded ${loadData.loaded_count} movies`;
        rankingSection.classList.remove('hidden');
        showMessage(`Loaded ${loadData.loaded_count} movies!`, 'success');
        showLoading(false);

    } catch (error) {
        showLoading(false);
        console.error('Failed to create session or load movies:', error);
    }
}

async function startRanking() {
    if (!sessionId) {
        showMessage('Please create a session first', 'error');
        return;
    }

    try {
        showLoading(true);
        const data = await apiCall(`/api/session/${sessionId}/ranking/start`, 'POST');

        if (data.comparison) {
            currentComparison = data.comparison;
            displayComparison(data.comparison, data.status);
            showMessage('Ranking started!', 'success');
        } else {
            showMessage('No movies to rank', 'error');
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

    comparisonContainer.classList.remove('hidden');
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
            displayResults(data.results);
            comparisonContainer.classList.add('hidden');
            resultsSection.classList.remove('hidden');
        } else if (data.comparison) {
            // Continue with next comparison
            currentComparison = data.comparison;
            displayComparison(data.comparison, data.status);
            showMessage(`Choice recorded! (${choice})`, 'info');
        } else {
            showMessage('Unexpected response from server', 'error');
        }

        showLoading(false);

    } catch (error) {
        showLoading(false);
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
        item.className = 'result-item';

        const rank = index + 1;
        item.innerHTML = `
            <div class="rank">#${rank}</div>
            <img src="${movie.poster_url || 'https://via.placeholder.com/200x300?text=No+Poster'}" 
                 alt="${movie.title}">
            <h4>${movie.title}</h4>
            <p>⭐ ${movie.vote_average || 'N/A'}</p>
            <p>${movie.release_date?.substring(0, 4) || 'N/A'}</p>
        `;

        resultsContainer.appendChild(item);
    });

    if (data.unseen_movies && data.unseen_movies.length > 0) {
        const unseenDiv = document.createElement('div');
        unseenDiv.style.gridColumn = '1 / -1';
        unseenDiv.style.marginTop = '30px';
        unseenDiv.innerHTML = `
            <h3>Unseen Movies (${data.unseen_movies.length})</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 15px; margin-top: 15px;">
                ${data.unseen_movies.map(movie => `
                    <div class="result-item">
                        <img src="${movie.poster_url || 'https://via.placeholder.com/200x300?text=No+Poster'}" 
                             alt="${movie.title}">
                        <h4>${movie.title}</h4>
                    </div>
                `).join('')}
            </div>
        `;
        resultsContainer.appendChild(unseenDiv);
    }
}

function reset() {
    if (confirm('Are you sure you want to reset? This will clear your current session.')) {
        sessionId = null;
        currentComparison = null;
        sessionInfo.classList.add('hidden');
        rankingSection.classList.add('hidden');
        comparisonContainer.classList.add('hidden');
        resultsSection.classList.add('hidden');
        resultsContainer.innerHTML = '';
        showMessage('Session reset', 'info');
    }
}

// Initialize
showMessage('Movie Ranking App loaded! Create a session to begin.', 'info');

