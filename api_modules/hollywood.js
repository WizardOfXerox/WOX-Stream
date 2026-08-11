const { setCorsHeaders, maskId, unmaskId, fixCoverUrl } = require('./_utils');

const TMDB_API_KEY = '4e44d9029b1270a757cddc766a1bcb63';
const tmdbCache = new Map();

// Helper to fetch TMDB API with caching
async function fetchTmdb(endpoint) {
  if (tmdbCache.has(endpoint)) {
    return tmdbCache.get(endpoint);
  }
  try {
    const sep = endpoint.includes('?') ? '&' : '?';
    const res = await fetch(`https://api.themoviedb.org/3${endpoint}${sep}api_key=${TMDB_API_KEY}`, {
      signal: AbortSignal.timeout(6000),
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data) {
      if (tmdbCache.size > 200) {
        const firstKey = tmdbCache.keys().next().value;
        tmdbCache.delete(firstKey);
      }
      tmdbCache.set(endpoint, data);
    }
    return data;
  } catch (err) {
    console.error(`TMDB fetch error for ${endpoint}:`, err.message);
    return null;
  }
}

function mapTmdbItem(item, isMovie) {
  if (!item || !item.id) return null;
  const prefix = isMovie ? 'm_' : 't_';
  const category = isMovie ? '0' : '1';
  const domainType = isMovie ? 'MOVIE' : 'TV';
  const title = item.title || item.name || 'Untitled';
  const poster = item.poster_path 
    ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
    : (item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : '');
  const score = item.vote_average ? item.vote_average.toFixed(1) : '8.5';
  const year = (item.release_date || item.first_air_date || '').substring(0, 4);

  return {
    id: maskId('hollywood', `${prefix}${item.id}`),
    category,
    title,
    cover: fixCoverUrl(poster),
    backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : '',
    score,
    year,
    domainType,
    sourceName: 'Hollywood',
    sourceKey: 'hollywood'
  };
}

async function fetchHollywoodPaginated(page = 1, type = '', sort = 'count') {
  const isMovie = type !== 'TV';
  const p = Math.max(1, parseInt(page, 10) || 1);
  const endpoint = isMovie
    ? (sort === 'score' ? `/movie/top_rated?page=${p}` : (sort === 'up' ? `/movie/now_playing?page=${p}` : `/trending/movie/week?page=${p}`))
    : (sort === 'score' ? `/tv/top_rated?page=${p}` : (sort === 'up' ? `/tv/on_the_air?page=${p}` : `/trending/tv/week?page=${p}`));

  const data = await fetchTmdb(endpoint);
  if (data && Array.isArray(data.results) && data.results.length > 0) {
    return data.results.map(i => mapTmdbItem(i, isMovie)).filter(Boolean);
  }

  // Curated fallback
  const curated = [
    { id: 155, title: 'The Dark Knight', poster_path: '/qJ2tW6WMUDux911r6m7haRef0WH.jpg', vote_average: 8.5, release_date: '2008-07-18', overview: 'Batman raises the stakes in his war on crime.' },
    { id: 27205, title: 'Inception', poster_path: '/oYuLE1hZ8Q1V22bCX2l9n6pBxuv.jpg', vote_average: 8.4, release_date: '2010-07-16', overview: 'Cobb, a skilled thief who steals secrets from deep within the subconscious during dream states.' },
    { id: 157336, title: 'Interstellar', poster_path: '/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg', vote_average: 8.4, release_date: '2014-11-05', overview: 'A team of explorers travel through a wormhole in space in an attempt to ensure humanity survival.' }
  ];
  return curated.map(m => mapTmdbItem(m, true)).filter(Boolean);
}

async function fetchHollywoodShelves() {
  const shelves = [];

  const [trendingMovies, trendingTv, topRatedMovies, actionMovies] = await Promise.all([
    fetchTmdb('/trending/movie/week'),
    fetchTmdb('/trending/tv/week'),
    fetchTmdb('/movie/top_rated'),
    fetchTmdb('/discover/movie?with_genres=28&sort_by=popularity.desc')
  ]);

  if (trendingMovies && Array.isArray(trendingMovies.results) && trendingMovies.results.length > 0) {
    shelves.push({
      title: "TRENDING HOLLYWOOD MOVIES",
      items: trendingMovies.results.slice(0, 12).map(i => mapTmdbItem(i, true)).filter(Boolean)
    });
  }

  if (trendingTv && Array.isArray(trendingTv.results) && trendingTv.results.length > 0) {
    shelves.push({
      title: "POPULAR TV SERIES",
      items: trendingTv.results.slice(0, 12).map(i => mapTmdbItem(i, false)).filter(Boolean)
    });
  }

  if (topRatedMovies && Array.isArray(topRatedMovies.results) && topRatedMovies.results.length > 0) {
    shelves.push({
      title: "TOP RATED BLOCKBUSTERS",
      items: topRatedMovies.results.slice(0, 12).map(i => mapTmdbItem(i, true)).filter(Boolean)
    });
  }

  if (actionMovies && Array.isArray(actionMovies.results) && actionMovies.results.length > 0) {
    shelves.push({
      title: "HIGH-OCTANE ACTION HITS",
      items: actionMovies.results.slice(0, 12).map(i => mapTmdbItem(i, true)).filter(Boolean)
    });
  }

  return shelves;
}

async function searchHollywood(query) {
  if (!query || !query.trim()) return [];
  const q = query.trim();

  // 1. If numeric TMDB ID directly
  if (/^\d+$/.test(q)) {
    const movieData = await fetchTmdb(`/movie/${q}`);
    if (movieData && movieData.id) {
      return [mapTmdbItem(movieData, true)];
    }
  }

  if (q.toLowerCase().includes('documentary')) {
    const docData = await fetchTmdb('/discover/movie?with_genres=99');
    if (docData && Array.isArray(docData.results) && docData.results.length > 0) {
      return docData.results.map(r => mapTmdbItem(r, true)).filter(Boolean);
    }
  }

  // 2. Multi-search on TMDB
  const searchData = await fetchTmdb(`/search/multi?query=${encodeURIComponent(q)}&include_adult=false`);
  if (searchData && Array.isArray(searchData.results) && searchData.results.length > 0) {
    return searchData.results
      .filter(r => r.media_type === 'movie' || r.media_type === 'tv')
      .map(r => mapTmdbItem(r, r.media_type === 'movie'))
      .filter(Boolean);
  }

  return [];
}

async function getDetail(maskedId, reqQuery = {}) {
  const unmasked = unmaskId(maskedId);
  if (!unmasked || unmasked.provider !== 'hollywood') {
    throw new Error("Invalid Hollywood ID");
  }

  const rawId = unmasked.id;
  const isMovie = rawId.startsWith('m_') || rawId.startsWith('movie_') || (!rawId.startsWith('t_') && !rawId.startsWith('tv_') && reqQuery.category === '0');
  const tmdbId = rawId.replace(/^(m_|movie_|t_|tv_)/i, '');

  let season = reqQuery.season || '1';
  let episode = reqQuery.episode || '1';

  if (reqQuery.episodeId && typeof reqQuery.episodeId === 'string') {
    const match = reqQuery.episodeId.match(/s(\d+)e(\d+)/i);
    if (match) {
      season = match[1];
      episode = match[2];
    }
  }

  // Fetch full details from TMDB
  const tmdbData = await fetchTmdb(`/${isMovie ? 'movie' : 'tv'}/${tmdbId}`);

  const title = tmdbData ? (tmdbData.title || tmdbData.name || `TMDB: ${tmdbId}`) : `Title ${tmdbId}`;
  const posterPath = tmdbData && tmdbData.poster_path 
    ? `https://image.tmdb.org/t/p/w500${tmdbData.poster_path}`
    : (tmdbData && tmdbData.backdrop_path ? `https://image.tmdb.org/t/p/w780${tmdbData.backdrop_path}` : '');
  const description = tmdbData && tmdbData.overview && tmdbData.overview.trim().length > 10
    ? tmdbData.overview
    : 'A captivating cinematic experience streaming in high definition from multiple source nodes.';
  const score = tmdbData && tmdbData.vote_average ? tmdbData.vote_average.toFixed(1) : '8.5';
  const year = tmdbData ? (tmdbData.release_date || tmdbData.first_air_date || '').substring(0, 4) : '2024';
  const genres = tmdbData && Array.isArray(tmdbData.genres) 
    ? tmdbData.genres.map(g => g.name).join(', ') 
    : (isMovie ? 'Movie, Hollywood' : 'TV Series, Drama');

  const detail = {
    id: maskedId,
    title,
    cover: fixCoverUrl(posterPath),
    backdrop: tmdbData && tmdbData.backdrop_path ? `https://image.tmdb.org/t/p/w1280${tmdbData.backdrop_path}` : '',
    description,
    score,
    year,
    genres,
    category: isMovie ? '0' : '1',
    domainType: isMovie ? 'MOVIE' : 'TV',
    streamType: 'embed',
    sourceKey: 'hollywood',
    sourceName: 'Hollywood',
    isMovie,
    embedServers: [],
    episodes: [],
    seasons: [],
    mirrors: [
      { id: maskedId, sourceKey: 'hollywood', sourceName: 'Hollywood High-Speed Server', isDefault: true }
    ]
  };

  if (isMovie) {
    detail.embedServers = [
      { name: 'VidLink (Fast HD)', url: `https://vidlink.pro/movie/${tmdbId}` },
      { name: 'VidSrc (Multi-Sub)', url: `https://vidsrc.to/embed/movie/${tmdbId}` },
      { name: 'Embed.su (Full HD)', url: `https://embed.su/embed/movie/${tmdbId}` },
      { name: 'VidBinge (Ad-Free)', url: `https://vidbinge.dev/embed/movie/${tmdbId}` },
      { name: 'SuperEmbed', url: `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1` }
    ];
    detail.episodes = [{ id: '1', name: 'Full Movie', episodeNumber: 1 }];
  } else {
    detail.embedServers = [
      { name: 'VidLink (Fast HD)', url: `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}` },
      { name: 'VidSrc (Multi-Sub)', url: `https://vidsrc.to/embed/tv/${tmdbId}/${season}/${episode}` },
      { name: 'Embed.su (Full HD)', url: `https://embed.su/embed/tv/${tmdbId}/${season}/${episode}` },
      { name: 'VidBinge (Ad-Free)', url: `https://vidbinge.dev/embed/tv/${tmdbId}/${season}/${episode}` },
      { name: 'SuperEmbed', url: `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&s=${season}&e=${episode}` }
    ];

    // Build real episodes list across ALL seasons
    const numSeasons = tmdbData && tmdbData.number_of_seasons ? Math.min(10, tmdbData.number_of_seasons) : 1;
    const seasonPromises = [];
    for (let s = 1; s <= numSeasons; s++) {
      seasonPromises.push(fetchTmdb(`/tv/${tmdbId}/season/${s}`));
    }

    const seasonsData = await Promise.all(seasonPromises);
    const allEpisodes = [];
    const allSeasons = [];

    seasonsData.forEach((sData, idx) => {
      const sNum = idx + 1;
      if (sData && Array.isArray(sData.episodes) && sData.episodes.length > 0) {
        const epList = sData.episodes.map(ep => ({
          id: `s${sNum}e${ep.episode_number}`,
          seasonNumber: sNum,
          episodeNumber: ep.episode_number,
          name: `S${sNum} E${ep.episode_number}: ${ep.name || `Episode ${ep.episode_number}`}`,
          overview: ep.overview || ''
        }));
        allEpisodes.push(...epList);
        allSeasons.push({ seasonNumber: sNum, name: `Season ${sNum}`, episodes: epList });
      }
    });

    if (allEpisodes.length === 0) {
      const epCount = (tmdbData && tmdbData.number_of_episodes) ? Math.min(30, tmdbData.number_of_episodes) : 12;
      allEpisodes.push(...Array.from({ length: epCount }, (_, i) => ({
        id: `s1e${i + 1}`,
        seasonNumber: 1,
        episodeNumber: i + 1,
        name: `Episode ${i + 1}`
      })));
    }

    detail.episodes = allEpisodes;
    detail.seasons = allSeasons;
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
      return res.json({ success: true, detail, data: detail, ...detail });
    }

    if ((action === 'stream' || action === 'episode') && id) {
      const detail = await getDetail(id, req.query);
      if (detail && detail.embedServers && detail.embedServers.length > 0) {
        return res.json({
          success: true,
          playUrl: detail.embedServers[0].url,
          streamType: 'embed',
          embedServers: detail.embedServers
        });
      }
    }

    return res.status(400).json({ success: false, error: 'Invalid parameters' });
  } catch (err) {
    console.error('Hollywood handler error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = handler;
module.exports.fetchHollywoodPaginated = fetchHollywoodPaginated;
module.exports.fetchHollywoodShelves = fetchHollywoodShelves;
module.exports.searchHollywood = searchHollywood;
module.exports.getDetail = getDetail;
