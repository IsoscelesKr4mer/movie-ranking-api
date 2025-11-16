// Lightweight client-side Letterboxd parser with pagination and robust selectors
// No external libs. Uses fetch + DOMParser. Caches results for 24h in localStorage.
//
// SHIFT: We scrape title/year AND poster URLs directly from Letterboxd (including
// LazyPoster data). If the LB image is a placeholder (e.g., contains "empty-poster"),
// we set lbPosterUrl to null so the importer can optionally fetch a TMDb poster.

/**
 * @typedef {Object} ParsedItem
 * @property {number} rank
 * @property {string} title
 * @property {string|null} year
 * @property {string|null} poster_url
 * @property {string|null} lbPosterUrl
 * @property {boolean} [isLbPosterPlaceholder]
 * @property {number} [originalIndex]
 */
 
const LB_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Normalize and validate a Letterboxd share or short URL. If share URL 404s, strip to base.
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
 * Get normalized poster URL from an <img> element, preferring real images over LB placeholders.
 * @param {HTMLImageElement|null} img
 * @returns {{url: string|null, placeholder: boolean}}
 */
function extractPosterFromImg(img) {
  if (!img) return { url: null, placeholder: true };
  let src = img.getAttribute('src') || img.getAttribute('data-src') || '';
  if (!src) {
    const set = img.getAttribute('data-srcset') || img.getAttribute('srcset') || '';
    if (set) {
      const first = set.split(',')[0]?.trim();
      if (first) src = first.split(' ')[0] || '';
    }
  }
  if (!src) return { url: null, placeholder: true };
  const abs = /^https?:\/\//i.test(src) ? src : `https://letterboxd.com${src}`;
  const placeholder = /empty-?poster/i.test(abs);
  return { url: placeholder ? null : abs, placeholder };
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
 * @returns {ParsedItem[]}
 */
function extractTitlesFromHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const items = [];

  // Try ld+json first (reliable for many lists)
  try {
    const jsonScripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
    for (const s of jsonScripts) {
      try {
        const data = JSON.parse(s.textContent || 'null');
        if (data && data.itemListElement && Array.isArray(data.itemListElement)) {
          data.itemListElement.forEach((el, idx) => {
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
              items.push({ rank: idx + 1, title, year: year || null, lbPosterUrl: null, poster_url: null, isLbPosterPlaceholder: true });
            }
          });
        }
      } catch {}
    }
  } catch {}

  // LazyPoster nodes (primary source in many LB list UIs)
  const lazyPosterNodes = Array.from(doc.querySelectorAll('.react-component[data-component-class="LazyPoster"]'));
  lazyPosterNodes.forEach((node, i) => {
    const name = node.getAttribute('data-item-name') || node.getAttribute('data-item-full-display-name') || '';
    const slug = node.getAttribute('data-item-slug') || node.getAttribute('data-target-link') || '';
    const img = node.querySelector('img');
    const posterInfo = extractPosterFromImg(img);
    let title = (name || '').trim();
    let year = null;
    if (title) {
      const m = title.match(/\b(19|20)\d{2}\b/);
      if (m) year = m[0];
      // strip trailing (YYYY) from title text
      title = title.replace(/\s*\(\d{4}\)\s*$/, '').trim();
    }
    if (!year && slug) {
      const y2 = String(slug).match(/-(\d{4})(?:\/|$)/);
      if (y2) year = y2[1];
    }
    if (title && title.length >= 2) {
      items.push({
        rank: i + 1,
        title,
        year: year || null,
        lbPosterUrl: posterInfo.url,
        poster_url: posterInfo.url, // keep for backward compatibility
        isLbPosterPlaceholder: !!posterInfo.placeholder
      });
    }
  });

  // Other list items (film-list-item, poster-container, etc.)
  const candidates = Array.from(doc.querySelectorAll('ul.film-list li.film-list-item, div[class*="film-list-item"], li.poster-container, li.listitem'));
  candidates.forEach((node, idx) => {
    const titleEl = node.querySelector('h2.film-title a, .film-title a, h2 a');
    let title = titleEl?.textContent?.trim() || '';
    if (!title) return;
    let year = null;
    const yNode = node.querySelector('span.release-year, .film-meta time, small, time[datetime]');
    if (yNode) {
      const txt = yNode.getAttribute ? (yNode.getAttribute('datetime') || yNode.textContent) : yNode.textContent;
      const m = String(txt).match(/\b(19|20)\d{2}\b/);
      if (m) year = m[0];
    }
    const img = node.querySelector('img.film-poster-img, .film-poster img, img[src*="ltrbxd"], img[alt], img');
    const posterInfo = extractPosterFromImg(img);
    const lower = title.toLowerCase();
    if (lower.includes('tv series') || lower.includes('(tv)') || lower.includes('short')) return;
    title = title.replace(/\s*\(\d{4}\)\s*$/, '').trim();
    items.push({
      rank: idx + 1,
      title,
      year: year || null,
      lbPosterUrl: posterInfo.url,
      poster_url: posterInfo.url,
      isLbPosterPlaceholder: !!posterInfo.placeholder
    });
  });

  // Fallback: legacy .film-poster blocks
  if (items.length === 0) {
    doc.querySelectorAll('.film-poster').forEach((div, idx) => {
      const titleAttr = div.getAttribute('data-film-name') || div.getAttribute('data-original-title') || div.getAttribute('title') || '';
      const img = div.querySelector('img');
      const posterInfo = extractPosterFromImg(img);
      const title = (titleAttr || '').trim();
      if (title) {
        items.push({
          rank: idx + 1,
          title: title.replace(/\s*\(\d{4}\)\s*$/, '').trim(),
          year: null,
          lbPosterUrl: posterInfo.url,
          poster_url: posterInfo.url,
          isLbPosterPlaceholder: !!posterInfo.placeholder
        });
      }
    });
  }

  // Filter and finalize
  const filtered = items.filter(it => {
    const normalized = (it.title || '').toLowerCase();
    return normalized && normalized.length >= 2 && !normalized.includes('tv series') && !normalized.includes('(tv)') && !normalized.includes('short');
  });
  filtered.forEach((it, i) => { it.rank = i + 1; it.originalIndex = i; });
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
  const next = doc.querySelector('a.next, a[rel=\"next\"], .pagination-next a');
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
 * @returns {Promise<{items: ParsedItem[], truncated: boolean, pagesParsed: number}>}
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
    try {
      console.log('[Letterboxd HTML snippet]', html.substring(0, 2000));
    } catch {}
    const items = extractTitlesFromHtml(html) || [];
    items.forEach(it => {
      if (allItems.length < maxItems) allItems.push(it);
    });

    if (pageCount === 1 && allItems.length === 0) {
      try {
        const base = url.replace(/\/share\/.*$/, '').replace(/\/\?page=\d+$/, '');
        if (base && base !== currentUrl) {
          currentUrl = base;
          continue;
        }
      } catch {}
    }

    const nextUrl = getNextPageUrl(html, currentUrl);
    currentUrl = nextUrl || null;
  }

  const normalizedItems = allItems.map((it, idx) => {
    const lb = it.lbPosterUrl ?? it.poster_url ?? null;
    const abs = lb ? (/^https?:\/\//i.test(lb) ? lb : `https://letterboxd.com${lb}`) : null;
    return {
      rank: typeof it.rank === 'number' ? it.rank : (idx + 1),
      title: it.title,
      year: it.year ? String(it.year) : 'TBD',
      lbPosterUrl: abs,
      poster_url: abs, // keep for backward compatibility
      originalIndex: typeof it.rank === 'number' ? it.rank - 1 : idx
    };
  });

  const result = {
    items: normalizedItems,
    truncated: allItems.length >= maxItems,
    pagesParsed: pageCount
  };
  console.table(result.items.slice(0, 5));
  setCache(url, result);
  return result;
}

// Expose to window
window.parseLetterboxdList = parseLetterboxdList;

// Simple helper to run a full scrape and log a few items
window.testParse = async function testParse(url, limit = 10) {
  const { items } = await parseLetterboxdList(url, 200, (s) => console.log('Scrape:', s));
  console.table(items.slice(0, Math.min(limit, items.length)));
  return items;
};

window.__lb_utils = {
  normalizeLetterboxdUrl,
  extractTitlesFromHtml,
  getNextPageUrl
};


