// UI glue for scraping Letterboxd and importing into a backend session.
// SHIFT: The import flow now relies on scraped Letterboxd data (title/year/poster)
// for accuracy, eliminating the need to query TMDb during import. The tmdbService
// remains available for other app features (e.g., optional high‑res poster lookups),
// but the default import avoids TMDb to prevent mismatches (e.g., "F1", "Friendship").
/**
 * Run the importer flow:
 * - Scrape Letterboxd titles/years/posters (with pagination)
 * - Preview with ✓ when both title and poster are present
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
   * ✓ indicates we have both a title and a poster URL from the LB scrape.
   * @param {Array<any>} movies
   */
  function renderPreview(movies) {
    const grid = document.getElementById('movies-selection-grid');
    const selectionSection = document.getElementById('selection-section');
    if (!grid || !selectionSection) return;
    grid.innerHTML = '';
    movies.forEach((m, idx) => {
      const item = document.createElement('div');
      item.className = 'masonry-item';
      item.dataset.movieId = m.id || `nomatch-${idx}`;
      const complete = Boolean(m.matched);
      const yearText = (m.release_date && m.release_date.split('-')[0]) || 'TBD';
      const posterUrl = m.poster_url || 'https://via.placeholder.com/300x450?text=No+Poster';
      item.innerHTML = `
        <div class="glass rounded-xl overflow-hidden border border-white/10 transition-smooth glass-hover cursor-pointer relative group">
          <div class="absolute top-2 right-2 z-10 w-8 h-8 ${complete ? 'bg-green-500' : 'bg-red-500'} rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" title="${complete ? 'Complete (title + poster)' : 'Missing poster/title'}">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${complete ? 'M5 13l4 4L19 7' : 'M6 18L18 6M6 6l12 12'}"></path>
            </svg>
          </div>
          <div class="absolute top-2 right-2 z-10 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center opacity-100 selected-checkmark hidden">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <img loading="lazy" src="${posterUrl}" 
               alt="${m.title}"
               class="w-full h-auto max-h-[200px] object-cover neumorphic"
               onerror="this.src='https://via.placeholder.com/300x450?text=No+Poster'">
          <div class="p-2">
            <h5 class="text-xs font-semibold text-black dark:text-white mb-1 line-clamp-2 min-h-[2.5rem]">${m.title}</h5>
            <p class="text-xs text-gray-600 dark:text-gray-400">${yearText}</p>
          </div>
        </div>
      `;
      const card = item.querySelector('.glass');
      if (card && typeof toggleMovieSelection === 'function') {
        card.addEventListener('click', () => {
          const movieId = m.id || `nomatch-${idx}`;
          toggleMovieSelection(movieId, item);
        });
      }
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
    // Create session
    const sessionData = await apiCall('/api/session/create', 'POST');
    window.sessionId = sessionData.session_id;
    document.getElementById('session-id').textContent = window.sessionId;
    document.getElementById('session-info').classList.remove('hidden');
    document.getElementById('session-status').textContent = 'Session created';

    // Build a single ordered list preserving the original ranks using LB-scraped data
    const orderedItems = (parsed.items || []).map((p) => ({
      title: p.title,
      year: p.year || null,
      poster_url: p.poster_url || p.posterUrl || null
    }));

    const setResp = await apiCall(
      `/api/session/${window.sessionId}/movies/set_bulk`,
      'POST',
      { items: orderedItems }
    );
    addMessage(`Imported ${setResp.loaded_count} movies from Letterboxd! Select the ones you want to rank.`, 'success');

    // Display for selection (reuse app.js helper)
    window.loadedMovies = setResp.movies || [];
    document.getElementById('selection-section').classList.remove('hidden');
    if (typeof displayMoviesForSelection === 'function') {
      displayMoviesForSelection(window.loadedMovies);
    } else {
      renderPreview(movies); // Pass the original movies array to renderPreview
    }
  }

  /**
   * Main orchestrator used by app.js
   * @param {string} url
   */
  async function runLetterboxdImport(url) {
    setStatus('');
    try {
      setStatus('Scraping list...');
      const parsed = await window.parseLetterboxdList(url, 200, (s) => setStatus(s));
      if (!parsed.items || parsed.items.length === 0) {
        throw new Error('No titles found. Ensure the list is public.');
      }
      if (parsed.truncated) {
        addMessage('List truncated to first 200 items to avoid overload.', 'info');
      }

      // HYBRID FIX: fetch TMDb posters only for items lacking a real LB poster
      const needs = [];
      const indexMap = [];
      (parsed.items || []).forEach((p, idx) => {
        const hasLbPoster = Boolean(p.lbPosterUrl || p.posterUrl || p.poster_url);
        if (!hasLbPoster) {
          needs.push({ title: p.title, year: p.year && p.year !== 'TBD' ? p.year : null });
          indexMap.push(idx);
        }
      });

      let posterResults = [];
      if (needs.length > 0 && window.tmdb && typeof window.tmdb.getPostersBatch === 'function') {
        setStatus(`Fetching ${needs.length} posters from TMDb...`);
        posterResults = await window.tmdb.getPostersBatch(needs, { concurrency: 10, onProgress: (d, t) => setStatus(`Fetching posters: ${d}/${t}`) });
      }
      // Apply TMDb posters back to parsed items
      posterResults.forEach((url, i) => {
        const at = indexMap[i];
        if (url) {
          parsed.items[at].tmdbPosterUrl = url;
        }
      });

      // Build preview models from scraped + optional TMDb poster
      const enriched = (parsed.items || []).map((p) => {
        const poster = p.tmdbPosterUrl || p.lbPosterUrl || p.posterUrl || p.poster_url || null;
        return {
          id: null,
          matched: Boolean(p.title) && Boolean(p.lbPosterUrl || poster),
          title: (p.title || '').replace(/\s*\(\d{4}\)\s*$/, '').trim(),
          release_date: p.year && p.year !== 'TBD' ? `${p.year}-01-01` : null,
          requested_year: p.year && p.year !== 'TBD' ? p.year : null,
          year_match: true,
          poster_url: poster,
          _posterSource: p.tmdbPosterUrl ? 'tmdb' : (p.lbPosterUrl ? 'letterboxd' : 'placeholder')
        };
      });

      // Display preview with indication of poster source
      const grid = document.getElementById('movies-selection-grid');
      const selectionSection = document.getElementById('selection-section');
      if (grid && selectionSection) {
        grid.innerHTML = '';
        enriched.forEach((m, idx) => {
          const item = document.createElement('div');
          item.className = 'masonry-item';
          item.dataset.movieId = m.id || `nomatch-${idx}`;
          const complete = Boolean(m.matched);
          const yearText = (m.release_date && m.release_date.split('-')[0]) || 'TBD';
          const posterTitle = m._posterSource === 'tmdb' ? 'Poster from TMDb' : (m._posterSource === 'letterboxd' ? 'Poster from Letterboxd' : 'No poster available');
          const posterUrl = m.poster_url || 'https://via.placeholder.com/300x450?text=No+Poster';
          item.innerHTML = `
            <div class="glass rounded-xl overflow-hidden border border-white/10 transition-smooth glass-hover cursor-pointer relative group">
              <div class="absolute top-2 right-2 z-10 w-8 h-8 ${complete ? 'bg-green-500' : 'bg-red-500'} rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" title="${complete ? 'Complete (title + poster)' : 'Missing poster/title'}">
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${complete ? 'M5 13l4 4L19 7' : 'M6 18L18 6M6 6l12 12'}"></path>
                </svg>
              </div>
              <div class="absolute top-2 right-2 z-10 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center opacity-100 selected-checkmark hidden">
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
              <img loading="lazy" src="${posterUrl}" 
                   alt="${m.title}" title="${posterTitle}"
                   class="w-full h-auto max-h-[200px] object-cover neumorphic"
                   onerror="this.src='https://via.placeholder.com/300x450?text=No+Poster'">
              <div class="p-2">
                <h5 class="text-xs font-semibold text-black dark:text-white mb-1 line-clamp-2 min-h-[2.5rem]">${m.title}</h5>
                <p class="text-xs text-gray-600 dark:text-gray-400">${yearText}</p>
              </div>
            </div>
          `;
          const card = item.querySelector('.glass');
          if (card && typeof toggleMovieSelection === 'function') {
            card.addEventListener('click', () => {
              const movieId = m.id || `nomatch-${idx}`;
              toggleMovieSelection(movieId, item);
            });
          }
          grid.appendChild(item);
        });
        selectionSection.classList.remove('hidden');
      }

      setStatus('Creating session and importing...');
      // Send LB poster or TMDb poster if present; preserve order
      const orderedItems = (parsed.items || []).map((p) => ({
        title: p.title,
        year: p.year || null,
        poster_url: p.tmdbPosterUrl || p.lbPosterUrl || p.posterUrl || p.poster_url || null
      }));

      const setResp = await apiCall(
        `/api/session/${window.sessionId || (await (async ()=>{ const sd=await apiCall('/api/session/create','POST'); window.sessionId=sd.session_id; document.getElementById('session-id').textContent=window.sessionId; document.getElementById('session-info').classList.remove('hidden'); document.getElementById('session-status').textContent='Session created'; return sd; })()).session_id}/movies/set_bulk`,
        'POST',
        { items: orderedItems }
      );
      addMessage(`Imported ${setResp.loaded_count} movies from Letterboxd! Select the ones you want to rank.`, 'success');

      // Show selection grid with final posters
      window.loadedMovies = setResp.movies || [];
      document.getElementById('selection-section').classList.remove('hidden');
      if (typeof displayMoviesForSelection === 'function') {
        displayMoviesForSelection(window.loadedMovies);
      } else {
        // Fallback render
        renderPreview(enriched);
      }

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


