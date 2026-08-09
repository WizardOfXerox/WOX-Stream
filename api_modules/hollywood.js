const { setCorsHeaders, maskId, unmaskId } = require('./_utils');

// Timeout fetch utility
async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

async function fetchVapi(endpoint) {
  try {
    const res = await fetchWithTimeout(`https://vidsrc.to/vapi${endpoint}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.result ? data.result : null;
  } catch (e) {
    console.error(`VAPI fetch error for ${endpoint}:`, e);
    return null;
  }
}

function mapVapiItem(item, isMovie) {
  const tmdb_id = item.tmdb_id || item.imdb_id;
  if (!tmdb_id) return null;
  
  const prefix = isMovie ? 'm_' : 't_';
  const category = isMovie ? '0' : '1';
  const domainType = isMovie ? 'MOVIE' : 'TV';
  
  return {
    id: maskId('hollywood', `${prefix}${tmdb_id}`),
    category,
    title: item.title || 'Unknown Title',
    cover: `https://img.vidsrc.vip/poster/${isMovie ? 'movie' : 'tv'}/${tmdb_id}.jpg`,
    score: null,
    domainType,
    sourceName: 'Hollywood',
    sourceKey: 'hollywood'
  };
}
async function fetchHollywoodPaginated(page = 1, type = '', sort = 'count') {
  const isMovie = type !== 'TV';
  const endpoint = sort === 'add' ? `/${isMovie ? 'movie' : 'tv'}/add/${page}` : `/${isMovie ? 'movie' : 'tv'}/new/${page}`;
  const vapiItems = await fetchVapi(endpoint);
  if (vapiItems && vapiItems.length > 0) {
    return vapiItems.map(i => mapVapiItem(i, isMovie)).filter(Boolean);
  }
  
  // Fallback: If page 1 return curated popular movies, if page > 1 return empty to signal end
  if (page === 1) {
    const popularMovies = [
      { id: '550', title: 'Fight Club', year: '1999', cover: 'https://image.tmdb.org/t/p/w500/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg' },
      { id: '27205', title: 'Inception', year: '2010', cover: 'https://image.tmdb.org/t/p/w500/oYuLE1hZ8Q1V22bCX2l9n6pBxuv.jpg' },
      { id: '157336', title: 'Interstellar', year: '2014', cover: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg' },
      { id: '155', title: 'The Dark Knight', year: '2008', cover: 'https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg' },
      { id: '19995', title: 'Avatar', year: '2009', cover: 'https://image.tmdb.org/t/p/w500/kyeqWdyUXW608qlYkRqosgbbJyK.jpg' },
      { id: '299536', title: 'Avengers: Infinity War', year: '2018', cover: 'https://image.tmdb.org/t/p/w500/7WsyChLLEzcqIInsightt1yX0OH8a.jpg' },
      { id: '299534', title: 'Avengers: Endgame', year: '2019', cover: 'https://image.tmdb.org/t/p/w500/or06FN3Dka5tukK1e9vtnWknVGF.jpg' },
      { id: '603', title: 'The Matrix', year: '2003', cover: 'https://image.tmdb.org/t/p/w500/f89U3HXqXmvu2EUBSEgZaWFrmGl.jpg' },
      { id: '597', title: 'Titanic', year: '1997', cover: 'https://image.tmdb.org/t/p/w500/9xjZS2rlVxm8SFx8kFi3YwScWdC.jpg' },
      { id: '671', title: "Harry Potter and the Philosopher's Stone", year: '2001', cover: 'https://image.tmdb.org/t/p/w500/wuMc22ipmy2Oi2svqYe23r9v32C.jpg' },
      { id: '120', title: 'The Lord of the Rings: The Fellowship of the Ring', year: '2001', cover: 'https://image.tmdb.org/t/p/w500/6oom5WUlCTCh2ist1mKWvyswsNv.jpg' },
      { id: '24428', title: 'The Avengers', year: '2012', cover: 'https://image.tmdb.org/t/p/w500/RYMX2wcKSpAr242RGlBvMB8RSx.jpg' }
    ];
    return popularMovies.map(m => ({
      id: maskId('hollywood', `m_${m.id}`),
      category: '0',
      title: m.title,
      cover: m.cover,
      score: '8.8',
      domainType: 'MOVIE',
      sourceName: 'Hollywood',
      sourceKey: 'hollywood'
    }));
  }
  return [];
}

async function fetchHollywoodShelves() {
  const shelves = [];
  
  const [newMovies, newTv, addedMovies, addedTv] = await Promise.all([
    fetchVapi('/movie/new'),
    fetchVapi('/tv/new'),
    fetchVapi('/movie/add'),
    fetchVapi('/tv/add')
  ]);

  if (newMovies && newMovies.length > 0) {
    shelves.push({
      title: "NEW MOVIE RELEASES",
      items: newMovies.slice(0, 12).map(i => mapVapiItem(i, true)).filter(Boolean)
    });
  }
  
  if (newTv && newTv.length > 0) {
    shelves.push({
      title: "NEW TV SHOWS",
      items: newTv.slice(0, 12).map(i => mapVapiItem(i, false)).filter(Boolean)
    });
  }
  
  if (addedMovies && addedMovies.length > 0) {
    shelves.push({
      title: "RECENTLY ADDED MOVIES",
      items: addedMovies.slice(0, 12).map(i => mapVapiItem(i, true)).filter(Boolean)
    });
  }
  
  if (addedTv && addedTv.length > 0) {
    shelves.push({
      title: "RECENTLY ADDED TV",
      items: addedTv.slice(0, 12).map(i => mapVapiItem(i, false)).filter(Boolean)
    });
  }
  
  if (shelves.length === 0) {
    // Curated popular Hollywood blockbusters fallback
    const popularMovies = [
      { id: '550', title: 'Fight Club', year: '1999', cover: 'https://image.tmdb.org/t/p/w500/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg' },
      { id: '27205', title: 'Inception', year: '2010', cover: 'https://image.tmdb.org/t/p/w500/oYuLE1hZ8Q1V22bCX2l9n6pBxuv.jpg' },
      { id: '157336', title: 'Interstellar', year: '2014', cover: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg' },
      { id: '155', title: 'The Dark Knight', year: '2008', cover: 'https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg' },
      { id: '19995', title: 'Avatar', year: '2009', cover: 'https://image.tmdb.org/t/p/w500/kyeqWdyUXW608qlYkRqosgbbJyK.jpg' },
      { id: '299536', title: 'Avengers: Infinity War', year: '2018', cover: 'https://image.tmdb.org/t/p/w500/7WsyChLLEzcqIInsightt1yX0OH8a.jpg' },
      { id: '299534', title: 'Avengers: Endgame', year: '2019', cover: 'https://image.tmdb.org/t/p/w500/or06FN3Dka5tukK1e9vtnWknVGF.jpg' },
      { id: '603', title: 'The Matrix', year: '2003', cover: 'https://image.tmdb.org/t/p/w500/f89U3HXqXmvu2EUBSEgZaWFrmGl.jpg' },
      { id: '597', title: 'Titanic', year: '1997', cover: 'https://image.tmdb.org/t/p/w500/9xjZS2rlVxm8SFx8kFi3YwScWdC.jpg' },
      { id: '671', title: "Harry Potter and the Philosopher's Stone", year: '2001', cover: 'https://image.tmdb.org/t/p/w500/wuMc22ipmy2Oi2svqYe23r9v32C.jpg' },
      { id: '120', title: 'The Lord of the Rings: The Fellowship of the Ring', year: '2001', cover: 'https://image.tmdb.org/t/p/w500/6oom5WUlCTCh2ist1mKWvyswsNv.jpg' },
      { id: '24428', title: 'The Avengers', year: '2012', cover: 'https://image.tmdb.org/t/p/w500/RYMX2wcKSpAr242RGlBvMB8RSx.jpg' }
    ];

    shelves.push({
      title: "HOLLYWOOD BLOCKBUSTERS",
      items: popularMovies.map(m => ({
        id: maskId('hollywood', `m_${m.id}`),
        category: '0',
        title: m.title,
        cover: m.cover,
        score: '8.8',
        domainType: 'MOVIE',
        sourceName: 'Hollywood',
        sourceKey: 'hollywood'
      }))
    });
  }

  return shelves;
}

async function searchHollywood(query) {
  // Try finding an exact TMDB match if query looks like a number
  if (/^\d+$/.test(query.trim())) {
    return [
      {
        id: maskId('hollywood', `m_${query.trim()}`),
        category: '0',
        title: `Movie TMDB: ${query.trim()}`,
        cover: `https://img.vidsrc.vip/poster/movie/${query.trim()}.jpg`,
        score: null,
        domainType: 'MOVIE',
        sourceName: 'Hollywood',
        sourceKey: 'hollywood'
      },
      {
        id: maskId('hollywood', `t_${query.trim()}`),
        category: '1',
        title: `TV TMDB: ${query.trim()}`,
        cover: `https://img.vidsrc.vip/poster/tv/${query.trim()}.jpg`,
        score: null,
        domainType: 'TV',
        sourceName: 'Hollywood',
        sourceKey: 'hollywood'
      }
    ];
  }
  
  return [
    {
       id: maskId('hollywood', 'm_0'),
       category: '0',
       title: 'Search by TMDB ID directly for best results',
       cover: '',
       score: null,
       domainType: 'MOVIE',
       sourceName: 'Hollywood',
       sourceKey: 'hollywood'
    }
  ];
}

async function getDetail(maskedId, reqQuery) {
  const unmasked = unmaskId(maskedId);
  if (!unmasked || unmasked.provider !== 'hollywood') {
    throw new Error("Invalid Hollywood ID");
  }
  
  const rawId = unmasked.id;
  const isMovie = rawId.startsWith('m_');
  const tmdbId = rawId.substring(2);
  
  const season = reqQuery.season || '1';
  const episode = reqQuery.episode || '1';
  
  const detail = {
    id: maskedId,
    title: `TMDB ID: ${tmdbId}`,
    cover: `https://img.vidsrc.vip/poster/${isMovie ? 'movie' : 'tv'}/${tmdbId}.jpg`,
    description: 'Streaming from multiple HD sources',
    streamType: 'embed',
    sourceKey: 'hollywood',
    sourceName: 'Hollywood',
    isMovie,
    embedServers: [],
    episodes: []
  };
  
  if (isMovie) {
    detail.embedServers = [
      { name: 'VidLink', url: `https://vidlink.pro/movie/${tmdbId}` },
      { name: 'VidSrc', url: `https://vidsrc.to/embed/movie/${tmdbId}` },
      { name: 'Embed.su', url: `https://embed.su/embed/movie/${tmdbId}` },
      { name: 'VidBinge', url: `https://vidbinge.dev/embed/movie/${tmdbId}` }
    ];
    detail.episodes = [{ id: '1', name: 'Full Movie', episodeNumber: 1 }];
  } else {
    detail.embedServers = [
      { name: 'VidLink', url: `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}` },
      { name: 'VidSrc', url: `https://vidsrc.to/embed/tv/${tmdbId}/${season}/${episode}` },
      { name: 'Embed.su', url: `https://embed.su/embed/tv/${tmdbId}/${season}/${episode}` },
      { name: 'VidBinge', url: `https://vidbinge.dev/embed/tv/${tmdbId}/${season}/${episode}` }
    ];
    detail.episodes = [{ id: `s${season}e${episode}`, name: `S${season} E${episode}`, episodeNumber: parseInt(episode, 10) || 1 }];
  }
  
  return detail;
}

const handler = async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  const { action, id, q, tmdbId, type, season, episode } = req.query;
  
  try {
    if (action === 'catalog' || !action) {
      const shelves = await fetchHollywoodShelves();
      return res.json({ success: true, shelves });
    }
    
    if (action === 'detail' && id) {
      const detail = await getDetail(id, req.query);
      return res.json({ success: true, detail });
    }
    
    if (action === 'search' && q) {
      const results = await searchHollywood(q);
      return res.json({ success: true, results });
    }
    
    if (action === 'resolve' && tmdbId && type) {
      const s = season || '1';
      const e = episode || '1';
      const embedServers = type === 'movie' 
        ? [
            { name: 'VidLink', url: `https://vidlink.pro/movie/${tmdbId}` },
            { name: 'VidSrc', url: `https://vidsrc.to/embed/movie/${tmdbId}` },
            { name: 'Embed.su', url: `https://embed.su/embed/movie/${tmdbId}` },
            { name: 'VidBinge', url: `https://vidbinge.dev/embed/movie/${tmdbId}` }
          ]
        : [
            { name: 'VidLink', url: `https://vidlink.pro/tv/${tmdbId}/${s}/${e}` },
            { name: 'VidSrc', url: `https://vidsrc.to/embed/tv/${tmdbId}/${s}/${e}` },
            { name: 'Embed.su', url: `https://embed.su/embed/tv/${tmdbId}/${s}/${e}` },
            { name: 'VidBinge', url: `https://vidbinge.dev/embed/tv/${tmdbId}/${s}/${e}` }
          ];
          
      return res.json({ success: true, embedServers });
    }
    
    return res.status(400).json({ success: false, error: 'Invalid action or parameters' });
  } catch (err) {
    console.error('Hollywood Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = handler;
module.exports.fetchHollywoodShelves = fetchHollywoodShelves;
module.exports.fetchHollywoodPaginated = fetchHollywoodPaginated;
module.exports.searchHollywood = searchHollywood;
module.exports.getDetail = getDetail;
