// Lightweight client-side Letterboxd parser with pagination and robust selectors
// No external libs. Uses fetch + DOMParser. Caches results for 24h in localStorage.
/**
 * @typedef {Object} ParsedList
 * @property {string[]} titles - Ordered film titles as they appear on the list
 * @property {boolean} truncated - True if we capped to maxItems
 * @property {number} pagesParsed - Number of pages parsed
 */
 
const LB_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Normalize and validate a Letterboxd share or short URL. If share URL 404s, fallback to base.
 * @param {string} url
 * @returns {string}
 */
function normalizeLetterboxdUrl(url) {
  const trimmed = url.trim();
  if (!/^https?:\/\/(www\.)?(letterboxd\.com|boxd\.it)/i.test(trimmed)) {
    throw new Error('Please paste a valid Letterboxd URL (letterboxd.com or boxd.it)');
  }
  return trimmed;
}

/**
 * Get and set cache by URL key
 */
function getCache(url) {
  try {
    const raw = localStorage.getItem(`lb_cache:${url}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || Date.now() - parsed.timestamp > LB_CACHE_TTL_MS) {
      localStorage.removeItem(`lb_cache:${url}`);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}
function setCache(url, data) {
  try {
    localStorage.setItem(`lb_cache:${url}`, JSON.stringify({ timestamp: Date.now(), data }));
  } catch {
    // ignore quota errors
  }
}

/**
 * Fetch HTML text with redirect support.
 * @param {string} url
 * @returns {Promise<string>}
 */
async function fetchHtml(url) {
  // Always go through our backend proxy to avoid browser CORS
  const base = (window.API_BASE || '').replace(/\/$/, '');
  if (!base) {
    throw new Error('API base not configured for Letterboxd fetch');
  }
  const res = await fetch(`${base}/api/letterboxd/fetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Proxy fetch failed (${res.status})`);
  }
  const data = await res.json();
  if (!data || typeof data.html !== 'string') {
    throw new Error('Invalid proxy response');
  }
  return data.html;
}

/**
 * Extract titles from a single page HTML string.
 * Tries multiple selectors for robustness and preserves exact text.
 * @param {string} html
 * @returns {string[]} titles in DOM order
 */
function extractTitlesFromHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const titles = [];

  // Primary: list items with film-list-item and <h2 class="film-title">
  doc.querySelectorAll('.film-list-item h2.film-title, li.listitem h2.film-title').forEach(h2 => {
    const text = h2.textContent?.trim();
    if (text) titles.push(text);
  });

  // Fallback A: grid/poster lists with .film-poster and title attribute or alt
  if (titles.length === 0) {
    doc.querySelectorAll('.film-poster').forEach(div => {
      const titleAttr = div.getAttribute('data-film-name') || div.getAttribute('data-original-title') || div.getAttribute('title');
      if (titleAttr) {
        const text = titleAttr.trim();
        if (text) titles.push(text);
      } else {
        const img = div.querySelector('img[alt]');
        const text = img?.getAttribute('alt')?.trim();
        if (text) titles.push(text);
      }
    });
  }

  // Fallback B: generic title links
  if (titles.length === 0) {
    doc.querySelectorAll('.title a, .headline-2 a').forEach(a => {
      const text = a.textContent?.trim();
      if (text) titles.push(text);
    });
  }

  // Skip obvious non-movie entries by heuristic (very short labels like "TV", "Short")
  const filtered = titles.filter(t => {
    const normalized = t.toLowerCase();
    if (normalized === 'tv' || normalized === 'short') return false;
    if (t.length < 2) return false;
    return true;
  });

  return filtered;
}

/**
 * Find next page link href if exists.
 * @param {string} html
 * @param {string} baseUrl
 * @returns {string|null}
 */
function getNextPageUrl(html, baseUrl) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const next = doc.querySelector('a.next, a[rel="next"]');
  if (next && next.getAttribute('href')) {
    const href = next.getAttribute('href');
    try {
      return new URL(href, baseUrl).toString();
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Parse any public Letterboxd list share URL into ordered titles with pagination.
 * @param {string} inputUrl
 * @param {number} maxItems
 * @param {(status: string) => void} onStatus
 * @returns {Promise<ParsedList>}
 */
async function parseLetterboxdList(inputUrl, maxItems = 200, onStatus = () => {}) {
  const url = normalizeLetterboxdUrl(inputUrl);

  const cached = getCache(url);
  if (cached) {
    return cached;
  }

  let currentUrl = url;
  let pageCount = 0;
  const all = [];
  const visited = new Set();

  while (currentUrl && all.length < maxItems) {
    if (visited.has(currentUrl)) break;
    visited.add(currentUrl);

    pageCount += 1;
    onStatus(`Parsing page ${pageCount}...`);
    const html = await fetchHtml(currentUrl);
    const titles = extractTitlesFromHtml(html);
    titles.forEach(t => {
      if (all.length < maxItems) all.push(t);
    });

    const nextUrl = getNextPageUrl(html, currentUrl);
    currentUrl = nextUrl || null;
  }

  const result = {
    titles: all,
    truncated: all.length >= maxItems,
    pagesParsed: pageCount
  };
  setCache(url, result);
  return result;
}

// Expose to window
window.parseLetterboxdList = parseLetterboxdList;
window.__lb_utils = {
  normalizeLetterboxdUrl,
  extractTitlesFromHtml,
  getNextPageUrl
};


