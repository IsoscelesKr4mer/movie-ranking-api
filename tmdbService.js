// TMDb helper with batching and basic match selection
/**
 * @typedef {Object} EnrichedMovie
 * @property {number|null} id
 * @property {string} title
 * @property {string|null} poster_url
 * @property {string|null} release_date
 * @property {boolean} matched
 * @property {object|null} raw
 */

const TMDB_IMAGE_SIZE = 'w500';
let TMDB_API_KEY = null;
let TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/';

/**
 * Configure TMDb API key and fetch configuration once for secure base url.
 * Falls back to default image base if config fails.
 * NOTE: The scraper-first import no longer requires client-side TMDb, but
 * these helpers remain for optional high‑res poster enhancement.
 * @param {string} apiKey
 */
async function configureTmdb(apiKey) {
  TMDB_API_KEY = apiKey;
  try {
    const res = await fetch(`https://api.themoviedb.org/3/configuration?api_key=${encodeURIComponent(TMDB_API_KEY)}`);
    if (!res.ok) throw new Error('TMDb config failed');
    const data = await res.json();
    const base = data?.images?.secure_base_url || data?.images?.base_url;
    if (base) {
      TMDB_IMAGE_BASE = base;
    }
  } catch (e) {
    // keep default
    console.warn('TMDb configuration fetch failed, using default image base:', e?.message || e);
  }
}

function posterUrlFromPath(path) {
  if (!path) return null;
  return `${TMDB_IMAGE_SIZE === 'w500' ? TMDB_IMAGE_BASE + TMDB_IMAGE_SIZE : TMDB_IMAGE_BASE + TMDB_IMAGE_SIZE}${path}`;
}

/**
 * Pick best match from TMDb results using simple heuristic.
 * @param {string} query
 * @param {Array<any>} results
 */
function pickBestMatch(query, results) {
  if (!results || results.length === 0) return null;
  const withVotes = results.filter(r => (r?.vote_count || 0) > 0);
  if (withVotes.length > 0) {
    withVotes.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
    return withVotes[0];
  }
  return results[0];
}

/**
 * DIRECT TMDb search (kept for non-import features).
 * @param {string} title
 * @returns {Promise<EnrichedMovie>}
 */
async function searchOneTitle(title) {
  const url = `https://api.themoviedb.org/3/search/movie?api_key=${encodeURIComponent(TMDB_API_KEY)}&query=${encodeURIComponent(title)}&language=en-US&include_adult=false`;
  const res = await fetch(url);
  if (!res.ok) {
    const res2 = await fetch(url + '&page=2');
    if (!res2.ok) {
      return { id: null, title, poster_url: null, release_date: null, matched: false, raw: null };
    }
    const data2 = await res2.json();
    const best2 = pickBestMatch(title, data2.results || []);
    return best2 ? {
      id: best2.id ?? null,
      title: best2.title || title,
      poster_url: posterUrlFromPath(best2.poster_path),
      release_date: best2.release_date || null,
      matched: true,
      raw: best2
    } : { id: null, title, poster_url: null, release_date: null, matched: false, raw: data2 };
  }
  const data = await res.json();
  const best = pickBestMatch(title, data.results || []);
  return best ? {
    id: best.id ?? null,
    title: best.title || title,
    poster_url: posterUrlFromPath(best.poster_path),
    release_date: best.release_date || null,
    matched: true,
    raw: best
  } : { id: null, title, poster_url: null, release_date: null, matched: false, raw: data };
}

/**
 * HYBRID FIX: Poster-only enrichment via backend /api/tmdb/enrich
 * Uses server-side TMDb key and returns poster URLs when LB poster is missing.
 * @param {string} title
 * @param {string|null} year
 * @returns {Promise<string|null>} poster URL or null
 */
async function getPoster(title, year) {
  const base = (window.API_BASE || '').replace(/\/$/, '');
  if (!base) return null;
  try {
    const res = await fetch(`${base}/api/tmdb/enrich`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ title, year: year || null }] })
    });
    if (!res.ok) return null;
    const data = await res.json();
    const item = (data?.items || [])[0];
    return (item && item.poster_url) ? item.poster_url : null;
  } catch {
    return null;
  }
}

/**
 * HYBRID FIX: Batch poster enrichment for items missing posters.
 * @param {Array<{title:string, year:string|null}>} items
 * @param {{concurrency?: number, onProgress?: (done:number,total:number)=>void}} [opts]
 * @returns {Promise<Array<string|null>>} array of poster URLs (or null)
 */
async function getPostersBatch(items, opts = {}) {
  const base = (window.API_BASE || '').replace(/\/$/, '');
  const concurrency = opts.concurrency || 10;
  const onProgress = opts.onProgress || (() => {});
  if (!base || !Array.isArray(items) || items.length === 0) return [];

  const results = new Array(items.length).fill(null);
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    try {
      const res = await fetch(`${base}/api/tmdb/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: chunk })
      });
      if (res.ok) {
        const data = await res.json();
        (data.items || []).forEach((row, idx) => {
          results[i + idx] = row && row.poster_url ? row.poster_url : null;
        });
      }
    } catch {}
    onProgress(Math.min(i + chunk.length, items.length), items.length);
    if (i + concurrency < items.length) {
      await new Promise(r => setTimeout(r, 100));
    }
  }
  return results;
}

/**
 * Enrich titles with TMDb in batches of 10 with 100ms gaps.
 * (Deprecated for core import; kept for other features.)
 * @param {string[]} titles
 * @param {(done:number,total:number)=>void} onProgress
 * @returns {Promise<EnrichedMovie[]>}
 */
async function enrichTitlesWithTmdb(titles, onProgress = () => {}) {
  const results = [];
  const batchSize = 10;
  for (let i = 0; i < titles.length; i += batchSize) {
    const batch = titles.slice(i, i + batchSize);
    const settled = await Promise.allSettled(batch.map(t => searchOneTitle(t)));
    settled.forEach(s => {
      if (s.status === 'fulfilled') results.push(s.value);
      else results.push({ id: null, title: batch[results.length - i] || '', poster_url: null, release_date: null, matched: false, raw: null });
    });
    onProgress(Math.min(i + batch.length, titles.length), titles.length);
    if (i + batchSize < items.length) {
      await new Promise(r => setTimeout(r, 100));
    }
  }
  return results;
}

window.tmdb = {
  configureTmdb,
  enrichTitlesWithTmdb, // legacy
  getPoster,
  getPostersBatch
};


