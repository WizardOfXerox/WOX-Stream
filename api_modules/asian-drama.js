const { setCorsHeaders, maskId, unmaskId } = require('./_utils');

const BASE_URL = 'https://kisskh.co/api';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Referer': 'https://kisskh.co/',
  'Origin': 'https://kisskh.co'
};

const mapDramaItem = (drama) => ({
  id: maskId('drama', drama.id.toString()),
  category: '1', // series
  title: drama.title,
  cover: drama.thumbnail || '',
  score: null,
  domainType: 'TV',
  sourceName: 'Asian Drama',
  sourceKey: 'drama',
  episodeCount: drama.episodesCount || 0
});

const fetchDramaPaginated = async (page = 1, type = 2) => {
  const dramaType = type || 2;
  try {
    const response = await fetch(`${BASE_URL}/DramaList/List?page=${page}&type=${dramaType}&sub=0&country=0&status=0&order=1`, {
      headers: HEADERS
    });
    if (response.ok) {
      const data = await response.json();
      const list = Array.isArray(data) ? data : data.data || [];
      if (list.length > 0) {
        return list.map(mapDramaItem);
      }
    }
  } catch (_) {}

  // Fallback to AniList query if KissKH is unreachable
  try {
    const countries = { '2': 'KR', '3': 'CN', '4': 'TH', '5': 'JP' };
    const country = countries[String(dramaType)] || 'KR';
    const aniQuery = `
      query ($page: Int, $country: CountryCode) {
        Page(page: $page, perPage: 20) {
          media(countryOfOrigin: $country, sort: POPULARITY_DESC) {
            id idMal title { romaji english } coverImage { extraLarge large } averageScore
          }
        }
      }
    `;
    const resAni = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: aniQuery, variables: { page, country } })
    });
    const data = await resAni.json();
    const list = data.data?.Page?.media || [];
    return list.map(item => ({
      id: maskId('drama', item.idMal || item.id),
      category: '1',
      title: item.title.english || item.title.romaji,
      cover: item.coverImage.extraLarge || item.coverImage.large,
      score: item.averageScore ? (item.averageScore / 10).toFixed(1) : '8.5',
      domainType: 'TV',
      sourceName: 'Asian Drama',
      sourceKey: 'drama'
    }));
  } catch (_) {
    return [];
  }
};

const fetchDramaShelves = async () => {
  const sections = [
    { title: 'TRENDING K-DRAMA', type: 2, query: 'drama' },
    { title: 'POPULAR C-DRAMA', type: 3, query: 'chinese drama' },
    { title: 'THAI DRAMA', type: 4, query: 'thai drama' },
    { title: 'JAPANESE DRAMA', type: 5, query: 'japanese drama' }
  ];

  const shelves = [];

  for (const section of sections) {
    try {
      const response = await fetch(`${BASE_URL}/DramaList/List?page=1&type=${section.type}&sub=0&country=0&status=0&order=1`, {
        headers: HEADERS
      });
      if (response.ok) {
        const data = await response.json();
        const list = Array.isArray(data) ? data : data.data || [];
        if (list.length > 0) {
          shelves.push({
            title: section.title,
            type: 'DRAMA_SECTION',
            items: list.slice(0, 12).map(mapDramaItem)
          });
          continue;
        }
      }
    } catch (_) {}

    // Fallback: AniList Asian Drama Query
    try {
      const aniQuery = `
        query ($search: String) {
          Page(page: 1, perPage: 12) {
            media(search: $search, type: ANIME, sort: POPULARITY_DESC) {
              id
              idMal
              title { romaji english }
              coverImage { extraLarge large }
              averageScore
              episodes
            }
          }
        }
      `;
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: aniQuery, variables: { search: section.query } })
      });
      const data = await res.json();
      const list = data.data?.Page?.media || [];
      if (list.length > 0) {
        shelves.push({
          title: section.title,
          type: 'DRAMA_SECTION',
          items: list.map(item => ({
            id: maskId('drama', item.idMal || item.id),
            category: '1',
            title: item.title.english || item.title.romaji,
            cover: item.coverImage.extraLarge || item.coverImage.large,
            score: item.averageScore ? (item.averageScore / 10).toFixed(1) : '8.5',
            domainType: 'TV',
            sourceName: 'Asian Drama',
            sourceKey: 'drama'
          }))
        });
      }
    } catch (_) {}
  }

  return shelves;
};

const searchDrama = async (query) => {
  try {
    const response = await fetch(`${BASE_URL}/DramaList/Search?q=${encodeURIComponent(query)}&type=0`, {
      headers: HEADERS
    });
    if (!response.ok) return [];
    
    const data = await response.json();
    return (Array.isArray(data) ? data : []).map(mapDramaItem);
  } catch (error) {
    console.error('Search failed:', error);
    return [];
  }
};

const getDramaDetail = async (id) => {
  const unmasked = unmaskId(id);
  const rawId = unmasked.id;
  
  try {
    const response = await fetch(`${BASE_URL}/DramaList/Drama/${rawId}?is498=false`, {
      headers: HEADERS
    });
    
    if (response.ok) {
      const drama = await response.json();
      return {
        success: true,
        detail: {
          id: id,
          title: drama.title || 'Asian Drama',
          cover: drama.thumbnail || '',
          description: drama.description || '',
          year: drama.releaseDate ? drama.releaseDate.substring(0, 4) : '',
          category: '1',
          genres: 'Drama',
          score: '8.5',
          sourceName: 'Asian Drama',
          sourceKey: 'drama',
          streamType: 'hls',
          episodes: (drama.episodes || []).map(ep => ({
            id: ep.id.toString(),
            name: `Episode ${ep.number || ep.id}`,
            episodeNumber: ep.number || 1
          }))
        }
      };
    }
  } catch (_) {}

  // Fallback for Asian Drama when KissKH API fails
  return {
    success: true,
    detail: {
      id: id,
      title: 'Asian Drama',
      cover: '',
      description: 'Streaming from HD Asian Drama Server',
      year: '2024',
      category: '1',
      genres: 'Drama',
      score: '8.5',
      sourceName: 'Asian Drama',
      sourceKey: 'drama',
      streamType: 'embed',
      episodes: [{ id: '1', name: 'Episode 1', episodeNumber: 1, embedUrl: `https://vidsrc.to/embed/tv/${rawId}/1/1` }]
    }
  };
};

const getDramaEpisode = async (episodeId) => {
  try {
    const streamRes = await fetch(`${BASE_URL}/DramaList/Episode/${episodeId}.png?err=false&ts=&time=`, {
      headers: HEADERS
    });
    
    if (!streamRes.ok) throw new Error('Failed to fetch stream');
    const streamData = await streamRes.json();
    
    const subRes = await fetch(`${BASE_URL}/Sub/${episodeId}`, {
      headers: HEADERS
    });
    
    let subtitles = [];
    if (subRes.ok) {
      const subData = await subRes.json();
      if (Array.isArray(subData)) {
        subtitles = subData.map(s => ({
          url: s.src,
          lang: s.label,
          default: s.default || false
        }));
      }
    }
    
    return {
      success: true,
      streamUrl: streamData.Video,
      streamType: 'hls',
      subtitles,
      streamHeaders: { 'Referer': 'https://kisskh.co/', 'Origin': 'https://kisskh.co' }
    };
  } catch (error) {
    console.error('Episode failed:', error);
    return { success: false, error: error.message };
  }
};

const handler = async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, q, id, episodeId } = req.query;

  try {
    switch (action) {
      case 'catalog': {
        const shelves = await fetchDramaShelves();
        return res.json({ success: true, data: shelves });
      }
      case 'search': {
        if (!q) return res.json({ success: false, error: 'Missing query' });
        const results = await searchDrama(q);
        return res.json({ success: true, data: results });
      }
      case 'detail': {
        if (!id) return res.json({ success: false, error: 'Missing id' });
        const result = await getDramaDetail(id);
        return res.json(result);
      }
      case 'episode': {
        if (!episodeId) return res.json({ success: false, error: 'Missing episodeId' });
        const result = await getDramaEpisode(episodeId);
        return res.json(result);
      }
      default:
        return res.status(400).json({ success: false, error: 'Invalid action' });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

module.exports = handler;
module.exports.fetchDramaShelves = fetchDramaShelves;
module.exports.fetchDramaPaginated = fetchDramaPaginated;
module.exports.searchDrama = searchDrama;
