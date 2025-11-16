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
      item.innerHTML = `
        <div class="checkmark" title="${m.matched ? 'TMDb match found' : 'No TMDb match'}">${m.matched ? '✓' : '✗'}</div>
        <img loading="lazy" src="${m.poster_url || 'https://via.placeholder.com/150x225?text=No+Poster'}" 
             alt="${m.title}"
             onerror="this.src='https://via.placeholder.com/150x225?text=No+Poster'">
        <h5>${m.title}</h5>
        <p style="font-size: 0.8rem; color: #666;">${(m.release_date || '').split('-')[0] || 'TBD'}</p>
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
  async function importToSession(movies) {
    const matched = movies.filter(m => m.matched && m.id);
    if (matched.length === 0) {
      throw new Error('No TMDb matches to import.');
    }
    // Create session
    const sessionData = await apiCall('/api/session/create', 'POST');
    window.sessionId = sessionData.session_id;
    document.getElementById('session-id').textContent = window.sessionId;
    document.getElementById('session-info').classList.remove('hidden');
    document.getElementById('session-status').textContent = 'Session created';

    // Set movies for session
    const payload = { tmdb_ids: matched.map(m => m.id) };
    const setResp = await apiCall(`/api/session/${window.sessionId}/movies/set`, 'POST', payload);
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
   * @param {string} tmdbApiKey
   */
  async function runLetterboxdImport(url, tmdbApiKey) {
    setStatus('');
    try {
      setStatus('Parsing list...');
      const parsed = await window.parseLetterboxdList(url, 200, (s) => setStatus(s));
      if (!parsed.titles || parsed.titles.length === 0) {
        throw new Error('No titles found. Ensure the list is public.');
      }
      if (parsed.truncated) {
        addMessage('List truncated to first 200 items to avoid overload.', 'info');
      }

      setStatus('Configuring TMDb...');
      await window.tmdb.configureTmdb(tmdbApiKey);

      setStatus('Matching titles on TMDb...');
      let lastPct = -1;
      const enriched = await window.tmdb.enrichTitlesWithTmdb(parsed.titles, (done, total) => {
        const pct = Math.floor((done / total) * 100);
        if (pct !== lastPct) {
          setStatus(`Matching TMDb: ${pct}% (${done}/${total})`);
          lastPct = pct;
        }
      });

      // Display preview with checkmarks
      renderPreview(enriched);

      setStatus('Creating session and importing...');
      await importToSession(enriched);

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


