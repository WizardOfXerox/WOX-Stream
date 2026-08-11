/**
 * HentaiMama API Module for WOX-Stream
 * Base URL: https://hentaimama.io
 */

const { setCorsHeaders, maskId, unmaskId, fixCoverUrl } = require('./_utils');

const BASE_URL = 'https://hentaimama.io';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Referer': `${BASE_URL}/`
};

function decodeHTMLEntities(str) {
  if (!str) return '';
  return String(str)
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchHentaiMamaCatalog(page = 1, query = '') {
  try {
    const url = query && query.trim()
      ? `${BASE_URL}/page/${page}/?s=${encodeURIComponent(query.trim().replace(/[^\w]/g, ' '))}`
      : `${BASE_URL}/tvshows/page/${page}/`;

    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return [];
    const html = await res.text();

    const items = [];
    const articleRegex = /<article[^>]*>([\s\S]*?)<\/article>/gi;
    let match;

    while ((match = articleRegex.exec(html)) !== null) {
      const snippet = match[1];
      const hrefMatch = snippet.match(/href=["']([^"']+)["']/i);
      if (!hrefMatch) continue;
      const href = hrefMatch[1];

      const slugMatch = href.match(/\/(?:tvshows|hentai|episodes)\/([^/?#]+)/);
      if (!slugMatch) continue;
      const targetSlug = slugMatch[1].trim('/');

      // Robust title extraction & decoding
      const titleMatch = snippet.match(/<h3[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i) || snippet.match(/alt=["']([^"']+)["']/i);
      const rawTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : targetSlug;
      const cleanTitle = decodeHTMLEntities(rawTitle.replace(/\s*-\s*\d+$/i, '').trim());

      // Robust image extraction (skip data:image 1x1 lazyload placeholders)
      const imgMatch = snippet.match(/data-lazy-src=["']([^"']+)["']/i) ||
                       snippet.match(/data-src=["']([^"']+)["']/i) ||
                       snippet.match(/srcset=["'](https?:\/\/[^\s"']+)["']/i) ||
                       snippet.match(/src=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i);

      let cover = imgMatch ? imgMatch[1] : '';
      if (cover.startsWith('/')) cover = BASE_URL + cover;
      cover = fixCoverUrl(cover);

      items.push({
        id: maskId('hentaimama', targetSlug),
        category: '1',
        title: cleanTitle,
        cover: cover,
        score: '9.0',
        domainType: 'TV',
        sourceName: 'HentaiMama 18+',
        sourceKey: 'hentaimama',
        isAdult: true
      });
    }

    const map = new Map();
    items.forEach(it => {
      if (!map.has(it.id)) map.set(it.id, it);
    });
    return Array.from(map.values());
  } catch (err) {
    console.error('HentaiMama catalog error:', err.message);
    return [];
  }
}

async function getHentaiMamaDetail(id) {
  try {
    const { id: rawSlug } = unmaskId(id);

    // Try tvshows endpoint first, then hentai endpoint
    let targetUrl = `${BASE_URL}/tvshows/${rawSlug}/`;
    let pageRes = await fetch(targetUrl, { headers: HEADERS });
    if (!pageRes.ok) {
      targetUrl = `${BASE_URL}/hentai/${rawSlug}/`;
      pageRes = await fetch(targetUrl, { headers: HEADERS });
    }
    if (!pageRes.ok) return null;
    const html = await pageRes.text();

    // Robust title extraction (filter out header navbar logo <h1 class="text">Hentaimama</h1>)
    const allH1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)];
    let rawTitle = '';
    for (const m of allH1s) {
      const text = m[1].replace(/<[^>]+>/g, '').trim();
      if (text && text.toLowerCase() !== 'hentaimama') {
        rawTitle = text;
        break;
      }
    }
    if (!rawTitle) {
      const h3Match = html.match(/<div class="data"><h3>([\s\S]*?)<\/h3>/i);
      if (h3Match) rawTitle = h3Match[1].replace(/<[^>]+>/g, '').trim();
    }
    if (!rawTitle) rawTitle = rawSlug.replace(/-/g, ' ');

    const cleanTitle = decodeHTMLEntities(rawTitle);

    // Description extraction
    const descMatch = html.match(/<div class="wp-content">[\s\S]*?<p>([\s\S]*?)<\/p>/i) ||
                      html.match(/<div class="entry-content">[\s\S]*?<p>([\s\S]*?)<\/p>/i);
    const description = descMatch ? decodeHTMLEntities(descMatch[1].replace(/<[^>]+>/g, '').trim()) : '';

    // Robust Poster image extraction (supports data-src, data-lazy-src, and noscript img)
    const imgMatch = html.match(/<div class="poster">[\s\S]*?<img[^>]+data-src=["']([^"']+)["']/i) ||
                     html.match(/data-src=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i) ||
                     html.match(/data-lazy-src=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i) ||
                     html.match(/<noscript><img[^>]+src=["']([^"']+)["']/i);

    let cover = imgMatch ? (imgMatch[1] || imgMatch[2]) : '';
    if (cover.startsWith('/')) cover = BASE_URL + cover;
    cover = fixCoverUrl(cover);

    // Episodes extraction
    const epRegex = /<a[^>]+href="([^"]*\/episodes\/[^"]+)"[^>]*>/gi;
    let epMatch;
    const episodes = [];
    const seenEps = new Set();

    while ((epMatch = epRegex.exec(html)) !== null) {
      const epHref = epMatch[1];
      if (seenEps.has(epHref)) continue;
      seenEps.add(epHref);

      const epNumMatch = epHref.match(/episode-(\d+\.?\d*)/i);
      const epNum = epNumMatch ? parseFloat(epNumMatch[1]) : (episodes.length + 1);

      episodes.push({
        id: epHref.replace(/^https?:\/\/[^/]+/, ''),
        name: `Episode ${epNum}`,
        episodeNumber: epNum,
        definitions: ['HD', '720P'],
        subtitles: []
      });
    }

    if (episodes.length === 0) {
      episodes.push({
        id: `/episodes/${rawSlug}-episode-1/`,
        name: 'Episode 1',
        episodeNumber: 1,
        definitions: ['HD', '720P'],
        subtitles: []
      });
    }

    return {
      id: id,
      title: cleanTitle,
      cover: cover,
      description: description,
      year: '2024',
      category: '1',
      genres: 'Hentai, Adult, Anime',
      score: '9.0',
      sourceName: 'HentaiMama 18+',
      sourceKey: 'hentaimama',
      episodes: episodes
    };
  } catch (err) {
    console.error('HentaiMama detail error:', err.message);
    return null;
  }
}

async function getHentaiMamaPlayUrl(epPath) {
  try {
    let cleanPath = epPath.startsWith('http') ? epPath.replace(/^https?:\/\/[^/]+/, '') : epPath;
    if (!cleanPath.startsWith('/episodes/')) {
      const slug = cleanPath.replace(/^\/(?:hentai|tvshows)\//, '').replace(/\/$/, '');
      cleanPath = `/episodes/${slug}-episode-1/`;
    }

    const fullUrl = `${BASE_URL}${cleanPath}`;
    const pageRes = await fetch(fullUrl, { headers: HEADERS });
    if (!pageRes.ok) return null;
    const html = await pageRes.text();

    let directMp4 = '';

    // Step 1: Query admin-ajax.php using idpost parameter
    const idpostMatch = html.match(/name=["']idpost["'][^>]*value=["']([^"']+)["']/i) ||
                        html.match(/value=["']([^"']+)["'][^>]*name=["']idpost["']/i);

    if (idpostMatch) {
      const params = new URLSearchParams();
      params.append('action', 'get_player_contents');
      params.append('a', idpostMatch[1]);

      const ajaxRes = await fetch(`${BASE_URL}/wp-admin/admin-ajax.php`, {
        method: 'POST',
        headers: {
          ...HEADERS,
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': fullUrl,
          'Origin': BASE_URL
        },
        body: params.toString()
      });

      if (ajaxRes.ok) {
        const ajaxData = await ajaxRes.json();
        if (Array.isArray(ajaxData) && ajaxData.length > 0) {
          for (const embedItem of ajaxData) {
            const srcMatch = embedItem.match(/src=["']([^"']+)["']/i);
            if (srcMatch) {
              let iframeUrl = srcMatch[1];
              if (iframeUrl.startsWith('//')) iframeUrl = 'https:' + iframeUrl;

              // Fetch inner player php HTML to extract direct MP4 link
              const iframeRes = await fetch(iframeUrl, { headers: { ...HEADERS, 'Referer': fullUrl } });
              if (iframeRes.ok) {
                const iframeHtml = await iframeRes.text();
                const mp4Match = iframeHtml.match(/(https?:[^\s"']+\.mp4[^\s"']*)/i) ||
                                 iframeHtml.match(/file:\s*["']([^"']+\.mp4[^"']*)["']/i) ||
                                 iframeHtml.match(/<source[^>]+src=["']([^"']+)["']/i);
                if (mp4Match) {
                  directMp4 = mp4Match[1];
                  break;
                }
              }
            }
          }
        }
      }
    }

    // Step 2: Fallback to HTML player containers if AJAX endpoint returned null
    if (!directMp4) {
      const fallbackIframe = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
      if (fallbackIframe) {
        let iframeUrl = fallbackIframe[1];
        if (iframeUrl.startsWith('//')) iframeUrl = 'https:' + iframeUrl;
        const iframeRes = await fetch(iframeUrl, { headers: { ...HEADERS, 'Referer': fullUrl } });
        if (iframeRes.ok) {
          const iframeHtml = await iframeRes.text();
          const mp4Match = iframeHtml.match(/(https?:[^\s"']+\.mp4[^\s"']*)/i);
          if (mp4Match) directMp4 = mp4Match[1];
        }
      }
    }

    if (!directMp4) return null;

    return {
      success: true,
      playUrl: directMp4,
      mediaUrl: directMp4,
      streamUrl: directMp4,
      streamType: 'mp4',
      subtitles: []
    };
  } catch (err) {
    console.error('HentaiMama play url error:', err.message);
    return null;
  }
}

module.exports = {
  fetchHentaiMamaCatalog,
  getHentaiMamaDetail,
  getHentaiMamaPlayUrl
};
