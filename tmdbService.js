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
  return `${TMDB_IMAGE_BASE}${TMDB_IMAGE_SIZE}${path}`;
}

/**
 * Pick best match from TMDb results using simple heuristic.
 * @param {string} query
 * @param {Array<any>} results
 */
function pickBestMatch(query, results) {
  if (!results || results.length === 0) return null;
  // Prefer first result with votes
  const withVotes = results.filter(r => (r?.vote_count || 0) > 0);
  if (withVotes.length > 0) {
    // Among those, prefer higher vote_average
    withVotes.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
    return withVotes[0];
  }
  // Otherwise, first result
  return results[0];
}

/**
 * Search one title on TMDb.
 * @param {string} title
 * @returns {Promise<EnrichedMovie>}
 */
async function searchOneTitle(title) {
  const url = `https://api.themoviedb.org/3/search/movie?api_key=${encodeURIComponent(TMDB_API_KEY)}&query=${encodeURIComponent(title)}&language=en-US&include_adult=false`;
  const res = await fetch(url);
  if (!res.ok) {
    // Try page=2 once if first page fails
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
 * Enrich titles with TMDb in batches of 10 with 100ms gaps.
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
    // Respect TMDb rate limit (<= 40/s). 10 at a time + 100ms delay is safe.
    if (i + batchSize < titles.length) {
      await new Promise(r => setTimeout(r, 100));
    }
  }
  return results;
}

window.tmdb = {
  configureTmdb,
  enrichTitlesWithTmdb
};


