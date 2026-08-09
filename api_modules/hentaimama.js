/**
 * HentaiMama API Module for WOX-Stream
 * Base URL: https://hentaimama.io
 */

const { setCorsHeaders, maskId, unmaskId } = require('./_utils');

const BASE_URL = 'https://hentaimama.io';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': `${BASE_URL}/`
};

async function fetchHentaiMamaCatalog(page = 1, query = '') {
  try {
    const url = query && query.trim()
      ? `${BASE_URL}/page/${page}/?s=${encodeURIComponent(query.trim().replace(/[^\w]/g, ' '))}`
      : `${BASE_URL}/tvshows/page/${page}/`;

    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return [];
    const html = await res.text();

    const items = [];
    const articleRegex = /<article[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>[\s\S]*?<img[^>]+(?:data-src|src)="([^"]+)"[^>]*>[\s\S]*?<h3[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/gi;
    let match;

    while ((match = articleRegex.exec(html)) !== null) {
      const href = match[1];
      const cover = match[2];
      const rawTitle = match[3].replace(/<[^>]+>/g, '').trim();

      const slugMatch = href.match(/\/(?:tvshows|hentai)\/([^/?#]+)/);
      if (!slugMatch) continue;
      const targetSlug = slugMatch[1].trim('/');

      const cleanTitle = rawTitle.replace(/\s*-\s*\d+$/i, '').trim();

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
    const targetUrl = `${BASE_URL}/tvshows/${rawSlug}/`;

    let pageRes = await fetch(targetUrl, { headers: HEADERS });
    if (!pageRes.ok) {
      pageRes = await fetch(`${BASE_URL}/hentai/${rawSlug}/`, { headers: HEADERS });
    }
    if (!pageRes.ok) return null;
    const html = await pageRes.text();

    const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || html.match(/<div class="data"><h3>([\s\S]*?)<\/h3>/i);
    const rawTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : rawSlug;

    const descMatch = html.match(/<div class="wp-content">[\s\S]*?<p>([\s\S]*?)<\/p>/i);
    const description = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : '';

    const imgMatch = html.match(/<div class="poster">[\s\S]*?<img[^>]+(?:data-src|src)="([^"]+)"/i);
    const cover = imgMatch ? imgMatch[1] : '';

    // Episodes
    const epRegex = /<div class="season_m">[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>[\s\S]*?<span class="c">([\s\S]*?)<\/span>/gi;
    let epMatch;
    const episodes = [];

    while ((epMatch = epRegex.exec(html)) !== null) {
      const epHref = epMatch[1];
      const epText = epMatch[2].replace(/<[^>]+>/g, '').trim();

      const epNumMatch = epText.match(/(\d+\.?\d*)/);
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
        id: `/hentai/${rawSlug}/`,
        name: 'Episode 1',
        episodeNumber: 1,
        definitions: ['HD', '720P'],
        subtitles: []
      });
    }

    return {
      id: id,
      title: rawTitle,
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
    const fullUrl = epPath.startsWith('http') ? epPath : `${BASE_URL}${epPath}`;
    const pageRes = await fetch(fullUrl, { headers: HEADERS });
    if (!pageRes.ok) return null;
    const html = await pageRes.text();

    let iframeUrl = '';
    const actionMatch = html.match(/action:\s*['"]get_player_contents['"][\s\S]*?a:\s*['"]?(\d+)['"]?/i);
    const actionVal = actionMatch ? actionMatch[1] : '';

    if (actionVal) {
      try {
        const params = new URLSearchParams();
        params.append('action', 'get_player_contents');
        params.append('a', actionVal);

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
          const ajaxJson = await ajaxRes.json();
          if (Array.isArray(ajaxJson) && ajaxJson.length > 0) {
            for (const field of ajaxJson) {
              const match = field.match(/src=["']([^"']+)["']/i);
              if (match) {
                iframeUrl = match[1];
                break;
              }
            }
          }
        }
      } catch (_) {}
    }

    if (!iframeUrl) {
      const fallbackIframe = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
      if (fallbackIframe) iframeUrl = fallbackIframe[1];
    }

    if (!iframeUrl) return null;

    if (iframeUrl.startsWith('//')) iframeUrl = 'https:' + iframeUrl;
    iframeUrl = iframeUrl.replace(/\\\//g, '/');

    const iframeRes = await fetch(iframeUrl, {
      headers: { ...HEADERS, 'Referer': fullUrl }
    });

    if (!iframeRes.ok) return null;
    const iframeHtml = await iframeRes.text();

    const mp4Match = iframeHtml.match(/file:\s*["']([^"']+\.(?:mp4|m3u8)[^"']*)["']/i) || 
                     iframeHtml.match(/(https?:[^\s"']+\.(?:mp4|m3u8)[^\s"']*)/i) || 
                     iframeHtml.match(/<source[^>]+src=["']([^"']+)["']/i);

    if (!mp4Match) return null;

    return {
      playUrl: mp4Match[1],
      format: 'mp4',
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
