const { getLoklokHeaders, setCorsHeaders, fixCoverUrl, loklokFetch, sanitizeToken, unmaskId, maskId } = require('./_utils');

// In-Memory RAM Cache for Media Details (120s TTL)
const detailCache = new Map();
const DETAIL_CACHE_TTL = 120 * 1000;

module.exports = async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const rawId = req.query.id;
    const initialCategory = req.query.category || '1';
    const rawToken = req.headers.token || req.query.token || '';
    const token = sanitizeToken(rawToken);

    if (!rawId || rawId === 'undefined' || rawId === 'null') {
      return res.status(400).json({ success: false, error: 'Invalid or missing media id' });
    }

    const cacheKey = `detail_${rawId}_${initialCategory}`;
    const cached = detailCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < DETAIL_CACHE_TTL)) {
      res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');
      return res.status(200).json(cached.data);
    }

    const { provider, id } = unmaskId(rawId);

    // Delegate Narto Drama items directly to Narto handler
    if (provider === 'narto' || String(rawId).startsWith('narto_')) {
      const nartoHandler = require('./narto');
      req.query = req.query || {};
      req.query.slug = id.replace(/^narto_/, '');
      req.query.id = req.query.slug;
      req.url = `/detail?slug=${encodeURIComponent(req.query.slug)}`;
      return nartoHandler(req, res);
    }

    // Delegate Hollywood items
    if (provider === 'hollywood') {
      delete require.cache[require.resolve('./hollywood')];
      const hollywoodHandler = require('./hollywood');
      req.query.action = 'detail';
      req.query.id = rawId;
      return hollywoodHandler(req, res);
    }

    // Delegate Anime items
    if (provider === 'anime') {
      const animeHandler = require('./anime-provider');
      req.query.action = 'detail';
      req.query.id = rawId;
      return animeHandler(req, res);
    }

    // Delegate Asian Drama items
    if (provider === 'drama') {
      const dramaHandler = require('./asian-drama');
      req.query.action = 'detail';
      req.query.id = rawId;
      return dramaHandler(req, res);
    }

    // Delegate Classics items
    if (provider === 'classics') {
      const classicsHandler = require('./classics');
      req.query.action = 'detail';
      req.query.id = rawId;
      return classicsHandler(req, res);
    }

    // Delegate Hstream adult anime items
    if (provider === 'hstream') {
      const hstreamModule = require('./hstream');
      const detail = await hstreamModule.getHstreamDetail(rawId);
      if (detail) return res.status(200).json({ success: true, detail, data: detail, ...detail });
      return res.status(404).json({ success: false, error: 'Hstream title not found' });
    }

    // Delegate HentaiMama adult anime items
    if (provider === 'hentaimama') {
      const hmamaModule = require('./hentaimama');
      const detail = await hmamaModule.getHentaiMamaDetail(rawId);
      if (detail) return res.status(200).json({ success: true, detail, data: detail, ...detail });
      return res.status(404).json({ success: false, error: 'HentaiMama title not found' });
    }

    // Delegate Adult items
    if (provider === 'adult') {
      const adultHandler = require('./adult');
      req.query.action = 'detail';
      req.query.id = rawId;
      return adultHandler(req, res);
    }

    const headers = getLoklokHeaders(token);
    
    // Reverse-engineered H5 API helper for signed Loklok detail retrieval
    const { H5_RSA_PUBLIC_KEY, h5GenKey, h5GetSign, h5RsaEncrypt } = require('./search');
    
    async function h5ApiGetDetail(targetId, catVal) {
      const randomKey = h5GenKey(16);
      const currentTime = Date.now();
      const tz = 0 - new Date().getTimezoneOffset() / 60;
      const queryData = { category: String(catVal), id: String(targetId) };
      const sign = h5GetSign(queryData, randomKey, currentTime);
      const aesKey = h5RsaEncrypt(randomKey);

      const hosts = ['https://h5-api.loklok.site', 'https://h5-api.hehekang.com'];
      const cfProxy = 'https://wox-stream-proxy.wizardofxerox.workers.dev/?url=';

      for (const host of hosts) {
        const targetUrl = `${host}/cms/v2/h5/movieDrama/get?id=${targetId}&category=${catVal}`;
        const urlsToTry = [targetUrl, `${cfProxy}${encodeURIComponent(targetUrl)}`];

        for (const url of urlsToTry) {
          try {
            const res = await fetch(url, {
              method: 'GET',
              headers: {
                'sign': sign,
                'aesKey': aesKey,
                'currentTime': currentTime.toString(),
                'clientType': 'H5',
                'versionCode': '32',
                'lang': 'en',
                'deviceid': h5GenKey(32),
                'timezone': `GMT${tz < 0 ? tz : '+' + tz}`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://h5.loklok.site/',
                'Origin': 'https://h5.loklok.site'
              },
              signal: AbortSignal.timeout(10000)
            });
            if (!res.ok) continue;
            const data = await res.json();
            if (data.code === '00000' && data.data) {
              return data.data;
            }
          } catch (_) {}
        }
      }
      return null;
    }

    // Category retry list: try specified category first, then fallback to 0 (Movie) and 1 (TV Series)
    const categoriesToTry = Array.from(new Set([String(initialCategory), '0', '1', '2']));
    let drama = null;
    let usedCategory = initialCategory;

    for (const cat of categoriesToTry) {
      // Primary: Mobile CMS API (ga-mobile-api.loklok.tv)
      try {
        const data = await loklokFetch(`/movieDrama/get?id=${id}&category=${cat}`, { headers });
        if ((data.code === '00000' || data.code === '000000') && data.data && (data.data.name || data.data.title || data.data.episodeVo)) {
          drama = data.data;
          usedCategory = cat;
          break;
        }
      } catch (_) {}

      // Secondary: Signed H5 API fallback
      drama = await h5ApiGetDetail(id, cat);
      if (drama && (drama.name || drama.title || drama.episodeVo)) {
        usedCategory = cat;
        break;
      }
    }

    if (!drama) {
      return res.status(200).json({ success: false, error: 'This title is temporarily unavailable on Loklok servers.' });
    }

    const coverRaw = drama.coverVerticalUrl || drama.coverHorizontalUrl || drama.cover || '';
    const cover = fixCoverUrl(coverRaw);

    const rawEpisodes = Array.isArray(drama.episodeVo) ? drama.episodeVo : (drama.episodeVo ? [drama.episodeVo] : []);

    const episodes = rawEpisodes.map((ep, idx) => {
      const episodeId = ep.id;
      const episodeName = ep.seriesNo ? `Episode ${ep.seriesNo}` : (ep.name || `Episode ${idx + 1}`);
      
      const definitions = (ep.definitionList || []).map(def => ({
        code: def.code,
        description: def.description || def.fullDescription || 'HD'
      }));

      const subtitles = (ep.subtitlingList || ep.subtitles || []).map(sub => ({
        lang: sub.language || sub.languageAbbr || 'Subtitle',
        url: sub.subtitlingUrl || sub.url || ''
      })).filter(s => s.url);

      return {
        id: String(episodeId),
        name: episodeName,
        episodeNumber: ep.seriesNo || (idx + 1),
        definitions: definitions,
        subtitles: subtitles
      };
    });

    const normTitle = (drama.name || drama.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const mirrors = [
      { id: maskId('loklok', drama.id), sourceKey: 'loklok', sourceName: 'Server Alpha (HD)', isDefault: true }
    ];



    const rawLikeList = Array.isArray(drama.likeList) ? drama.likeList : (Array.isArray(drama.likeDramaList) ? drama.likeDramaList : []);
    const likeList = rawLikeList.map(item => ({
      id: maskId('loklok', item.id),
      title: item.name || item.title || 'Untitled',
      cover: fixCoverUrl(item.coverVerticalUrl || item.coverHorizontalUrl || item.cover || ''),
      score: item.score || '8.5',
      category: String(item.category || item.domainType || '1')
    }));

    const rawRelatedList = Array.isArray(drama.relatedDramaList) ? drama.relatedDramaList : (Array.isArray(drama.refList) ? drama.refList : []);
    const relatedList = rawRelatedList.map(item => ({
      id: maskId('loklok', item.id),
      title: item.name || item.title || 'Untitled',
      cover: fixCoverUrl(item.coverVerticalUrl || item.coverHorizontalUrl || item.cover || ''),
      score: item.score || '8.5',
      category: String(item.category || item.domainType || '1')
    }));

    const detailPayload = {
      success: true,
      detail: {
        id: maskId('loklok', drama.id),
        title: drama.name || drama.title || 'Untitled',
        cover: cover,
        description: drama.introduction || drama.description || 'No description available.',
        year: drama.year || '',
        area: drama.areaName || '',
        category: String(drama.category || usedCategory),
        genres: (drama.tagList || []).map(t => t.name).join(', '),
        score: drama.score || null,
        mirrors: mirrors,
        episodes: episodes,
        likeList: likeList,
        relatedList: relatedList
      }
    };

    detailCache.set(cacheKey, { timestamp: Date.now(), data: detailPayload });
    if (detailCache.size > 100) {
      const oldest = detailCache.keys().next().value;
      detailCache.delete(oldest);
    }

    res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');
    return res.status(200).json(detailPayload);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
