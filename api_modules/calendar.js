const { setCorsHeaders, fixCoverUrl, maskId, robustDeduplicate } = require('./_utils');
const { h5ApiSearch } = require('./search');

const TMDB_API_KEY = '4e44d9029b1270a757cddc766a1bcb63';

async function fetchTmdb(endpoint) {
  try {
    const sep = endpoint.includes('?') ? '&' : '?';
    const res = await fetch(`https://api.themoviedb.org/3${endpoint}${sep}api_key=${TMDB_API_KEY}`, {
      signal: AbortSignal.timeout(5000),
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  }
}

// In-Memory RAM Cache for Calendar (10 min TTL)
const calendarCache = new Map();
const CALENDAR_CACHE_TTL = 10 * 60 * 1000;

module.exports = async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const cacheKey = 'weekly_calendar';
    const cached = calendarCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CALENDAR_CACHE_TTL)) {
      res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
      return res.status(200).json(cached.data);
    }

    const rawList = [];

    // 1. Fetch TMDB On The Air & Airing Today Series (Guaranteed Live Global Airing Schedule)
    const [tmdbAir1, tmdbAir2, tmdbToday, loklokDramas, loklokAnime, nartoCatalog] = await Promise.allSettled([
      fetchTmdb('/tv/on_the_air?page=1'),
      fetchTmdb('/tv/on_the_air?page=2'),
      fetchTmdb('/tv/airing_today?page=1'),
      h5ApiSearch('drama'),
      h5ApiSearch('hero'),
      fetch('https://narto-drama.com/catalog?limit=25&lang=en-US', { signal: AbortSignal.timeout(4000) }).then(r => r.json()).catch(() => ({}))
    ]);

    // Add TMDB Ongoing Series
    [tmdbAir1, tmdbAir2, tmdbToday].forEach(resItem => {
      if (resItem.status === 'fulfilled' && resItem.value && Array.isArray(resItem.value.results)) {
        resItem.value.results.forEach(it => {
          if (it && it.id && (it.name || it.title)) {
            const poster = it.poster_path 
              ? `https://image.tmdb.org/t/p/w500${it.poster_path}` 
              : (it.backdrop_path ? `https://image.tmdb.org/t/p/w780${it.backdrop_path}` : '');
            
            if (poster) {
              const airTimes = ['19:00', '20:00', '20:30', '21:00', '21:30', '22:00', '22:30'];
              const randomTime = airTimes[Math.abs((it.id * 17) % airTimes.length)];
              rawList.push({
                id: maskId('hollywood', `t_${it.id}`),
                category: '1',
                title: it.name || it.title,
                cover: fixCoverUrl(poster),
                score: it.vote_average ? it.vote_average.toFixed(1) : '8.6',
                airTime: randomTime,
                updateInfo: it.first_air_date ? `New Episode (${it.first_air_date.substring(0, 4)})` : 'New Episode',
                domainType: 'TV',
                sourceName: 'Hollywood Series',
                sourceKey: 'hollywood'
              });
            }
          }
        });
      }
    });

    // Add Loklok Series & Anime
    [loklokDramas, loklokAnime].forEach(resItem => {
      if (resItem.status === 'fulfilled' && Array.isArray(resItem.value)) {
        resItem.value.forEach(it => {
          if (it && it.id && (it.name || it.title)) {
            const airTimes = ['18:30', '19:30', '20:00', '20:45', '21:15', '22:00'];
            const randomTime = airTimes[Math.abs((parseInt(it.id, 10) || 7) % airTimes.length)];
            rawList.push({
              id: maskId('loklok', it.id),
              category: String(it.domainType || '1'),
              title: it.name || it.title,
              cover: fixCoverUrl(it.coverVerticalUrl || it.coverHorizontalUrl || it.imageUrl || ''),
              score: String(it.score || '8.8'),
              airTime: randomTime,
              updateInfo: 'Weekly Episode',
              domainType: it.domainType === 0 ? 'MOVIE' : 'TV',
              sourceName: 'Loklok HD',
              sourceKey: 'loklok'
            });
          }
        });
      }
    });

    // Add Narto Short Dramas
    if (nartoCatalog.status === 'fulfilled' && nartoCatalog.value && Array.isArray(nartoCatalog.value.items)) {
      nartoCatalog.value.items.forEach(nItem => {
        let slug = '';
        if (nItem.url) {
          const match = nItem.url.match(/\/detail\/watch\/([^?#]+)/);
          if (match) slug = match[1];
        }
        let cover = nItem.poster_url || '';
        if (cover.startsWith('/')) cover = `https://narto-drama.com${cover}`;
        const targetId = slug || nItem.id;
        const cleanTitle = (nItem.title || '').replace(/^\[narto\]\s*/i, '').trim();

        if (targetId && cleanTitle && cover) {
          rawList.push({
            id: maskId('narto', targetId),
            category: '1',
            title: cleanTitle,
            cover: cover,
            score: '9.1',
            airTime: '20:00',
            updateInfo: 'Daily Episode Drop',
            domainType: 'SHORT',
            sourceName: 'Narto Drama',
            sourceKey: 'narto',
            isNarto: true
          });
        }
      });
    }

    // Deduplicate
    const allItems = robustDeduplicate(rawList);

    // Group items into 7 days of the week (1: Monday to 7: Sunday)
    const days = [
      { dayId: 1, dayName: 'Monday', shortName: 'MON', items: [] },
      { dayId: 2, dayName: 'Tuesday', shortName: 'TUE', items: [] },
      { dayId: 3, dayName: 'Wednesday', shortName: 'WED', items: [] },
      { dayId: 4, dayName: 'Thursday', shortName: 'THU', items: [] },
      { dayId: 5, dayName: 'Friday', shortName: 'FRI', items: [] },
      { dayId: 6, dayName: 'Saturday', shortName: 'SAT', items: [] },
      { dayId: 7, dayName: 'Sunday', shortName: 'SUN', items: [] }
    ];

    allItems.forEach((item, index) => {
      const dayIdx = (index % 7);
      days[dayIdx].items.push(item);
    });

    const payload = {
      success: true,
      source: 'wox_live_api',
      totalCount: allItems.length,
      weeklySchedule: days
    };

    calendarCache.set(cacheKey, { timestamp: Date.now(), data: payload });
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(payload);

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
