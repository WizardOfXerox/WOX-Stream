/**
 * Hstream API Module for WOX-Stream
 * Base URL: https://hstream.moe
 */

const { setCorsHeaders, maskId, unmaskId } = require('./_utils');

const BASE_URL = 'https://hstream.moe';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': BASE_URL
};

async function fetchHstreamCatalog(page = 1, order = 'view-count', query = '') {
  try {
    const url = query && query.trim()
      ? `${BASE_URL}/search?search=${encodeURIComponent(query.trim())}&page=${page}`
      : `${BASE_URL}/search?order=${encodeURIComponent(order)}&page=${page}`;

    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return [];
    const html = await res.text();

    const items = [];
    const linkRegex = /<a[^>]+href="([^"]*\/hentai\/[^"]*)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[^>]*alt="([^"]+)"/gi;
    let match;

    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1];
      const cover = match[2];
      const rawTitle = match[3];

      const matchSlug = href.match(/\/hentai\/([^/?#]+)/);
      if (!matchSlug) continue;
      const pathSegment = matchSlug[1].trim('/');
      const base = pathSegment.replace(/-\d+$/, '');
      const cleanSegment = base || pathSegment;

      const cleanTitle = rawTitle.replace(/\s*-\s*\d+$/i, '').replace(/^\[narto\]\s*/i, '').trim();

      let fullCover = cover;
      if (cover.startsWith('/')) fullCover = BASE_URL + cover;

      items.push({
        id: maskId('hstream', cleanSegment),
        category: '1',
        title: cleanTitle,
        cover: fullCover,
        score: '9.5',
        domainType: 'TV',
        sourceName: 'Hstream 18+',
        sourceKey: 'hstream',
        isAdult: true
      });
    }

    const map = new Map();
    items.forEach(it => {
      if (!map.has(it.id)) map.set(it.id, it);
    });
    return Array.from(map.values());
  } catch (err) {
    console.error('Hstream catalog error:', err.message);
    return [];
  }
}

async function getHstreamDetail(id) {
  try {
    const { id: rawSlug } = unmaskId(id);
    const targetUrl = `${BASE_URL}/hentai/${rawSlug}`;

    const pageRes = await fetch(targetUrl, { headers: HEADERS });
    if (!pageRes.ok) return null;
    const html = await pageRes.text();

    const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const rawTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : rawSlug;
    const cleanTitle = rawTitle.replace(/\s*-\s*\d+$/i, '').trim();

    const descMatch = html.match(/<meta[^>]+name="twitter:description"[^>]+content="([^"]+)"/i) || html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i);
    const description = descMatch ? descMatch[1].trim() : '';

    const imgMatch = html.match(/<img[^>]+src="([^"]*\/cover-ep-[^"]*)"/i) || html.match(/<img[^>]+src="([^"]*\/hentai\/[^"]*)"/i);
    let cover = imgMatch ? imgMatch[1] : '';
    if (cover.startsWith('/')) cover = BASE_URL + cover;

    const epRegex = /<a[^>]+href="([^"]*\/hentai\/[^"]+)"[^>]*>/gi;
    let epMatch;
    const episodes = [];
    const seenEps = new Set();

    while ((epMatch = epRegex.exec(html)) !== null) {
      const epHref = epMatch[1];
      if (!epHref.includes(`/hentai/${rawSlug}`)) continue;
      if (seenEps.has(epHref)) continue;
      seenEps.add(epHref);

      const epNumStr = epHref.substring(epHref.lastIndexOf('-') + 1).replace(/\/.*$/, '');
      const epNum = parseFloat(epNumStr) || (episodes.length + 1);

      episodes.push({
        id: epHref.replace(/^https?:\/\/[^/]+/, ''),
        name: `Episode ${epNumStr || epNum}`,
        episodeNumber: epNum,
        definitions: ['1080P', '720P'],
        subtitles: []
      });
    }

    if (episodes.length === 0) {
      episodes.push({
        id: `/hentai/${rawSlug}-1`,
        name: 'Episode 1',
        episodeNumber: 1,
        definitions: ['1080P', '720P'],
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
      score: '9.5',
      sourceName: 'Hstream 18+',
      sourceKey: 'hstream',
      episodes: episodes
    };
  } catch (err) {
    console.error('Hstream detail error:', err.message);
    return null;
  }
}

async function getHstreamPlayUrl(epPath) {
  try {
    let cleanPath = epPath.startsWith('http') ? epPath.replace(/^https?:\/\/[^/]+/, '') : epPath;
    if (!cleanPath.startsWith('/hentai/')) cleanPath = `/hentai/${cleanPath}`;

    // If path is a series root path like `/hentai/overflow`, append `-1` to target episode 1
    if (!cleanPath.match(/-\d+$/)) {
      cleanPath = `${cleanPath}-1`;
    }

    const fullUrl = `${BASE_URL}${cleanPath}`;
    const pageRes = await fetch(fullUrl, { headers: HEADERS });
    if (!pageRes.ok) return null;

    const rawCookies = pageRes.headers.getSetCookie ? pageRes.headers.getSetCookie() : [pageRes.headers.get('set-cookie')];
    const cookieHeader = rawCookies.map(c => String(c || '').split(';')[0]).filter(Boolean).join('; ');

    const xsrfMatch = cookieHeader.match(/XSRF-TOKEN=([^;]+)/);
    if (!xsrfMatch) return null;
    const xsrfToken = decodeURIComponent(xsrfMatch[1]);

    const html = await pageRes.text();
    const eidMatch = html.match(/<input[^>]*id=["']e_id["'][^>]*value=["']([^"']+)["']/i) ||
                     html.match(/value=["']([^"']+)["'][^>]*id=["']e_id["']/i);
    if (!eidMatch) return null;
    const episodeId = eidMatch[1];

    const apiHeaders = {
      'User-Agent': HEADERS['User-Agent'],
      'Referer': fullUrl,
      'Origin': BASE_URL,
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-XSRF-TOKEN': xsrfToken,
      'Cookie': cookieHeader
    };

    const apiRes = await fetch(`${BASE_URL}/player/api`, {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify({ episode_id: episodeId })
    });

    if (!apiRes.ok) return null;
    const apiJson = await apiRes.json();

    if (!apiJson.stream_url || !apiJson.stream_domains || apiJson.stream_domains.length === 0) {
      return null;
    }

    const domain = apiJson.stream_domains[0];
    const baseStream = `${domain}/${apiJson.stream_url}`;
    const playUrl = `${baseStream}/x264.720p.mp4`;

    return {
      success: true,
      playUrl: playUrl,
      mediaUrl: playUrl,
      streamUrl: playUrl,
      streamType: 'mp4',
      subtitles: [{ url: `${baseStream}/eng.ass`, lang: 'English' }]
    };
  } catch (err) {
    console.error('Hstream play url error:', err.message);
    return null;
  }
}

module.exports = {
  fetchHstreamCatalog,
  getHstreamDetail,
  getHstreamPlayUrl
};
