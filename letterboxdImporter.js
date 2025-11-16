// UI glue for parsing Letterboxd and enriching via TMDb, then importing into a backend session
/**
 * Run the importer flow:
 * - Parse Letterboxd titles (with pagination)
 * - Configure TMDb and enrich
 * - Preview results with checkmarks
 * - Create session and set movies server-side for downstream ranking
 */
(function () {
  const statusEl = document.getElementById('lb-import-status');
  const messagesDiv = document.getElementById('messages');

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text || '';
  }

  function addMessage(text, type = 'info') {
    const message = document.createElement('div');
    message.className = `message ${type}`;
    message.textContent = text;
    messagesDiv.appendChild(message);
    setTimeout(() => message.remove(), 5000);
  }

  /**
   * Render a quick preview list into selection grid (rank preserved).
   * Uses a checkmark/✗ to indicate TMDb match status.
   * @param {Array<import('./tmdbService').EnrichedMovie>} movies
   */
  function renderPreview(movies) {
    const grid = document.getElementById('movies-selection-grid');
    const selectionSection = document.getElementById('selection-section');
    if (!grid || !selectionSection) return;
    grid.innerHTML = '';
    movies.forEach((m, idx) => {
      const item = document.createElement('div');
      item.className = 'movie-select-item';
      item.dataset.movieId = m.id || `nomatch-${idx}`;
      const mismatch = m.matched && m.requested_year && m.release_date && !m.year_match;
      item.innerHTML = `
        <div class="checkmark" title="${m.matched ? (m.year_match ? 'TMDb match (year matched)' : 'TMDb match (year mismatch ?)') : 'No TMDb match'}">${m.matched ? (mismatch ? '?' : '✓') : '✗'}</div>
        <img loading="lazy" src="${m.poster_url || m.fallback_poster || 'https://via.placeholder.com/150x225?text=No+Poster'}" 
             alt="${m.title}"
             onerror="this.src='https://via.placeholder.com/150x225?text=No+Poster'">
        <h5>${m.title}</h5>
        <p style="font-size: 0.8rem; color: #666;">${(m.release_date || '').split('-')[0] || 'TBD'}${m.requested_year ? ` (req ${m.requested_year})` : ''}</p>
      `;
      grid.appendChild(item);
    });
    selectionSection.classList.remove('hidden');
  }

  /**
   * Import enriched movies to backend session by setting the session movie list.
   * Expects a global apiCall and updates global session state; we only send matched movies with valid IDs.
   * @param {Array<any>} movies
   */
  async function importToSession(movies, parsed) {
    const matched = movies.filter(m => m.matched && m.id);
    // Build fallbacks using original parsed items
    const fallbacks = [];
    movies.forEach((m, idx) => {
      if (!m.matched || (m.requested_year && !m.year_match)) {
        const p = parsed.items[idx];
        if (p && p.title) {
          fallbacks.push({
            title: p.title,
            year: p.year || null,
            poster_url: p.poster_url || null
          });
        }
      }
    });
    // Create session
    const sessionData = await apiCall('/api/session/create', 'POST');
    window.sessionId = sessionData.session_id;
    document.getElementById('session-id').textContent = window.sessionId;
    document.getElementById('session-info').classList.remove('hidden');
    document.getElementById('session-status').textContent = 'Session created';

    // Set movies for session (support mixed: tmdb matches + fallbacks with poster)
    let setResp;
    if (fallbacks.length > 0) {
      const payload = { tmdb_ids: matched.map(m => m.id), fallbacks };
      setResp = await apiCall(`/api/session/${window.sessionId}/movies/set_mixed`, 'POST', payload);
    } else {
      const payload = { tmdb_ids: matched.map(m => m.id) };
      setResp = await apiCall(`/api/session/${window.sessionId}/movies/set`, 'POST', payload);
    }
    addMessage(`Imported ${setResp.loaded_count} movies from Letterboxd! Select the ones you want to rank.`, 'success');

    // Display for selection (reuse app.js helper)
    window.loadedMovies = setResp.movies || [];
    document.getElementById('selection-section').classList.remove('hidden');
    if (typeof displayMoviesForSelection === 'function') {
      displayMoviesForSelection(window.loadedMovies);
    } else {
      renderPreview(matched);
    }
  }

  /**
   * Main orchestrator used by app.js
   * @param {string} url
   */
  async function runLetterboxdImport(url) {
    setStatus('');
    try {
      setStatus('Parsing list...');
      const parsed = await window.parseLetterboxdList(url, 200, (s) => setStatus(s));
      if (!parsed.items || parsed.items.length === 0) {
        throw new Error('No titles found. Ensure the list is public.');
      }
      if (parsed.truncated) {
        addMessage('List truncated to first 200 items to avoid overload.', 'info');
      }

      setStatus('Matching titles on TMDb...');
      // Send title + year for precise matching
      const payloadItems = parsed.items.map(it => ({ title: it.title, year: it.year || null }));
      const enrichResp = await apiCall('/api/tmdb/enrich', 'POST', { items: payloadItems });
      const enriched = enrichResp.items || [];

      // Display preview with checkmarks
      renderPreview(enriched);

      setStatus('Creating session and importing...');
      await importToSession(enriched, parsed);

      setStatus('Done!');
    } catch (e) {
      console.error(e);
      setStatus('');
      addMessage(e?.message || 'Failed to import Letterboxd list', 'error');
      throw e;
    }
  }

  window.runLetterboxdImport = runLetterboxdImport;
})();


