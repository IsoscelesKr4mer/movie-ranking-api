// Lightweight client-side Letterboxd parser with pagination and robust selectors
// No external libs. Uses fetch + DOMParser. Caches results for 24h in localStorage.
/**
 * @typedef {Object} ParsedItem
 * @property {number} rank
 * @property {string} title
 * @property {string|null} year
 * @property {string|null} poster_url
 *
 * @typedef {Object} ParsedList
 * @property {ParsedItem[]} items - Ordered items with title and year
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
    // Guard: don't return empty results from cache
    const data = parsed.data;
    if (data && Array.isArray(data.items) && data.items.length > 0) {
      return data;
    }
    // Stale/empty - drop it
    localStorage.removeItem(`lb_cache:${url}`);
    return null;
  } catch {
    return null;
  }
}
function setCache(url, data) {
  try {
    // Only cache when we have at least one item
    if (data && Array.isArray(data.items) && data.items.length > 0) {
      localStorage.setItem(`lb_cache:${url}`, JSON.stringify({ timestamp: Date.now(), data }));
    }
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

  const items = [];

  // FIX: Try ld+json ItemList first (most reliable for shared lists)
  try {
    const jsonScripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
    for (const s of jsonScripts) {
      try {
        const data = JSON.parse(s.textContent || 'null');
        if (data && data.itemListElement && Array.isArray(data.itemListElement)) {
          data.itemListElement.forEach((el) => {
            const it = el && (el.item || el.url || el.name);
            if (!it) return;
            let title = null;
            let year = null;
            if (typeof it === 'object') {
              title = (it.name || it.headline || it.title || '').trim();
              const date = it.datePublished || it.dateCreated || it.dateModified || '';
              if (date) {
                const m = String(date).match(/\b(19|20)\d{2}\b/);
                if (m) year = m[0];
              }
              // Try URL slug for year
              if (!year && it.url) {
                const ym = String(it.url).match(/-(\d{4})\/?$/);
                if (ym) year = ym[1];
              }
            } else if (typeof it === 'string') {
              title = it.trim();
              const ym = it.match(/-(\d{4})\/?$/);
              if (ym) year = ym[1];
            }
            if (title && title.length >= 2) {
              items.push({ title, year: year || null, rank: 0 });
            }
          });
        }
      } catch {}
    }
    if (items.length > 0) {
      console.debug('[LB Parser] ld+json extracted', items.length);
      items.forEach((it, idx) => { it.rank = idx + 1; });
      return items;
    }
  } catch {}

  // Primary selectors per Letterboxd shared lists
  // FIX: include React-LazyPoster components carrying rich data attributes
  const lazyPosterNodes = Array.from(doc.querySelectorAll('.react-component[data-component-class="LazyPoster"]'));
  lazyPosterNodes.forEach(node => {
    const name = node.getAttribute('data-item-name') || node.getAttribute('data-item-full-display-name') || '';
    const slug = node.getAttribute('data-item-slug') || node.getAttribute('data-target-link') || '';
    const posterDataUrl = node.getAttribute('data-poster-url') || '';
    // Try to read image src or lazy-src/srcset (LB uses <img src> or data-src/srcset)
    const img = node.querySelector('img');
    let imgSrc = img ? (img.getAttribute('src') || img.getAttribute('data-src') || '') : '';
    if (!imgSrc && img) {
      const set = img.getAttribute('data-srcset') || img.getAttribute('srcset') || '';
      if (set) {
        const first = set.split(',')[0]?.trim();
        if (first) {
          imgSrc = first.split(' ')[0];
        }
      }
    }
    let title = (name || '').trim();
    let year = null;
    if (title) {
      const m = title.match(/\b(19|20)\d{2}\b/);
      if (m) {
        year = m[0];
      }
      // FIX: strip trailing " (YYYY)" from title; preserve year separately
      title = title.replace(/\s*\(\d{4}\)\s*$/, '').trim();
    }
    if (!year && slug) {
      const y2 = String(slug).match(/-(\d{4})(?:\/|$)/);
      if (y2) year = y2[1];
    }
    if (title && title.length >= 2) {
      let poster_url = null;
      if (imgSrc) {
        // ensure absolute
        poster_url = /^https?:\/\//i.test(imgSrc) ? imgSrc : `https://letterboxd.com${imgSrc}`;
      } else if (posterDataUrl) {
        // data-item gives a relative page to the poster; prefix LB host so it resolves
        poster_url = posterDataUrl.startsWith('http') ? posterDataUrl : `https://letterboxd.com${posterDataUrl}`;
      }
      items.push({ title, year, poster_url: poster_url || null, rank: 0 });
    }
  });

  const candidates = Array.from(doc.querySelectorAll('ul.film-list li, li.film-list-entry, li.poster-container, div.film-list-item, div[class*="film-list-item"], .poster-and-title'));
  candidates.forEach(node => {
    const titleEl = node.querySelector('h2.film-title a, .film-title a, h2 a, .title a');
    let title = titleEl?.textContent?.trim() || '';
    if (!title) return;

    // Year: various selectors
    let year =
      node.querySelector('span.release-year')?.textContent?.trim() ||
      node.querySelector('time[datetime]')?.getAttribute('datetime')?.slice(0, 4) ||
      node.querySelector('.film-meta time')?.textContent?.trim() ||
      node.querySelector('small')?.textContent?.trim() ||
      null;
    // Normalize year text to just YYYY when possible
    if (year) {
      const m = String(year).match(/\b(19|20)\d{2}\b/);
      year = m ? m[0] : null;
    }

  // Poster from image if present (support lazy-loaded attributes)
  const img = node.querySelector('img[alt], img.image, img');
  let poster_url = null;
  if (img) {
    let src = img.getAttribute('src') || img.getAttribute('data-src') || '';
    if (!src) {
      const set = img.getAttribute('data-srcset') || img.getAttribute('srcset') || '';
      const first = set.split(',')[0]?.trim();
      if (first) {
        src = first.split(' ')[0];
      }
    }
    if (src) {
      poster_url = /^https?:\/\//i.test(src) ? src : `https://letterboxd.com${src}`;
    }
  }

    // Basic filtering
    const lower = title.toLowerCase();
    if (lower.includes('tv series') || lower.includes('(tv)') || lower.includes('(short)') || title.length < 3) {
      return;
    }
    // Remove trailing year from title if present to avoid duplication with separate year label
    title = title.replace(/\s*\(\d{4}\)\s*$/, '').trim();

    items.push({ title, year, poster_url, rank: 0 });
  });

  // FIX: data attributes used frequently on LB list entries
  if (items.length === 0) {
    const nodes = doc.querySelectorAll('[data-film-name]');
    nodes.forEach(n => {
      const t = n.getAttribute('data-film-name') || '';
      const y = n.getAttribute('data-film-year') || n.getAttribute('data-film-release-year') || null;
      const img = n.querySelector('img.image, img[alt]');
      const poster_url = img?.getAttribute('src') || null;
      if (t && t.trim().length >= 2) items.push({ title: t.trim(), year: y ? String(y).match(/\b(19|20)\d{2}\b/)?.[0] || null : null, poster_url, rank: 0 });
    });
  }

  // Fallback A: grid/poster lists with .film-poster and title attribute or alt
  if (items.length === 0) {
    doc.querySelectorAll('.film-poster').forEach(div => {
      const titleAttr = div.getAttribute('data-film-name') || div.getAttribute('data-original-title') || div.getAttribute('title');
      if (titleAttr) {
        const text = titleAttr.trim();
        if (text) items.push({ title: text, year: null, rank: 0 });
      } else {
        const img = div.querySelector('img');
        const alt = img?.getAttribute('alt')?.trim();
        let src = img ? (img.getAttribute('src') || img.getAttribute('data-src') || '') : '';
        if (!src && img) {
          const set = img.getAttribute('data-srcset') || img.getAttribute('srcset') || '';
          const first = set.split(',')[0]?.trim();
          if (first) {
            src = first.split(' ')[0];
          }
        }
        const poster = src ? (/^https?:\/\//i.test(src) ? src : `https://letterboxd.com${src}`) : null;
        if (alt) items.push({ title: alt, year: null, poster_url: poster, rank: 0 });
      }
    });
  }

  // Fallback B: generic title links
  if (items.length === 0) {
    doc.querySelectorAll('.title a, .headline-2 a').forEach(a => {
      const text = a.textContent?.trim();
      if (text) items.push({ title: text, year: null, rank: 0 });
    });
  }

  // Skip obvious non-movie entries by heuristic (very short labels like "TV", "Short")
  const filtered = items.filter(it => {
    const normalized = it.title.toLowerCase();
    if (normalized === 'tv' || normalized === 'short') return false;
    if (it.title.length < 2) return false;
    return true;
  });

  // Assign ranks by order
  filtered.forEach((it, idx) => { it.rank = idx + 1; });
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
  const next = doc.querySelector('a.next, a[rel="next"], .pagination-next a');
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
  const allItems = [];
  const visited = new Set();

  while (currentUrl && allItems.length < maxItems) {
    if (visited.has(currentUrl)) break;
    visited.add(currentUrl);

    pageCount += 1;
    onStatus(`Parsing page ${pageCount}...`);
    let html = await fetchHtml(currentUrl);
    // DEBUG: Log beginning of HTML to confirm structure and avoid parsing sidebar/etc
    try {
      console.log('[Letterboxd HTML snippet]', html.substring(0, 2000));
    } catch {}
    let items = extractTitlesFromHtml(html);
    items.forEach(it => {
      if (allItems.length < maxItems) allItems.push(it);
    });

    // If first page produced nothing, retry base list URL immediately (strip /share/...)
    if (pageCount === 1 && allItems.length === 0) {
      try {
        const base = url.replace(/\/share\/.*$/, '').replace(/\/\?page=\d+$/, '');
        if (base && base !== currentUrl) {
          currentUrl = base;
          continue; // retry loop with base URL
        }
      } catch {}
    }

    const nextUrl = getNextPageUrl(html, currentUrl);
    currentUrl = nextUrl || null;
  }

  const result = {
    items: allItems,
    truncated: allItems.length >= maxItems,
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


