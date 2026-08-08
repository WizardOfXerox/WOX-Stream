const { getLoklokHeaders, setCorsHeaders, fixCoverUrl, loklokFetch, sanitizeToken, unmaskId, maskId } = require('./_utils');

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

    const { provider, id } = unmaskId(rawId);

    // Delegate Viva One / VivaMax / Viva MovieBox items directly to Viva handler
    if (provider === 'vivaone' || provider === 'vivamax' || provider === 'vivamb' || String(rawId).startsWith('viva')) {
      const vivaHandler = require('./viva');
      req.query.action = 'detail';
      req.query.id = rawId;
      return vivaHandler(req, res);
    }

    // Delegate Narto Drama items directly to Narto handler
    if (provider === 'narto' || String(rawId).startsWith('narto_')) {
      const nartoHandler = require('./narto');
      req.url = `/detail?slug=${encodeURIComponent(id)}`;
      return nartoHandler(req, res);
    }

    // Delegate Hollywood items
    if (provider === 'hollywood') {
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
      if (detail) return res.status(200).json({ success: true, detail });
      return res.status(404).json({ success: false, error: 'Hstream title not found' });
    }

    // Delegate HentaiMama adult anime items
    if (provider === 'hentaimama') {
      const hmamaModule = require('./hentaimama');
      const detail = await hmamaModule.getHentaiMamaDetail(rawId);
      if (detail) return res.status(200).json({ success: true, detail });
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
    
    // Category retry list: try specified category first, then fallback to 0 (Movie) and 1 (TV Series)
    const categoriesToTry = Array.from(new Set([String(initialCategory), '0', '1', '2']));
    let drama = null;
    let usedCategory = initialCategory;

    for (const cat of categoriesToTry) {
      try {
        const data = await loklokFetch(`/movieDrama/get?id=${id}&category=${cat}`, { headers });
        if ((data.code === '00000' || data.code === '000000') && data.data && (data.data.name || data.data.title || data.data.episodeVo)) {
          drama = data.data;
          usedCategory = cat;
          break;
        }
      } catch (_) {}
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

    try {
      const { VIVA_CATALOG_ITEMS, VIVA_CONFIGS } = require('./viva');
      if (Array.isArray(VIVA_CATALOG_ITEMS)) {
        const matchedViva = VIVA_CATALOG_ITEMS.filter(v => v.title.toLowerCase().replace(/[^a-z0-9]/g, '') === normTitle);
        matchedViva.forEach(v => {
          const cfg = VIVA_CONFIGS[v.sourceKey] || { name: 'Viva' };
          mirrors.push({
            id: maskId(v.sourceKey, v.id),
            sourceKey: v.sourceKey,
            sourceName: cfg.name
          });
        });
      }
    } catch (_) {}

    return res.status(200).json({
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
        episodes: episodes
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
