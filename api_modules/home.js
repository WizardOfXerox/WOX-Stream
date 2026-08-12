const { getLoklokHeaders, setCorsHeaders, fixCoverUrl, loklokFetch, maskId, robustDeduplicate } = require('./_utils');
const { h5ApiSearch } = require('./search');

// In-Memory RAM Cache for Home Sections (60s TTL)
const homeCache = new Map();
const HOME_CACHE_TTL = 60 * 1000;

module.exports = async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const page = req.query.page || 0;
    const token = req.headers.token || req.query.token || '';
    const isShuffle = req.query.shuffle === 'true' || req.query.forceRefresh === 'true';
    const allowAdultParam = req.query.allowAdult || (req.headers ? req.headers.allowadult : '') || '';
    const cacheKey = `home_v15_${page}_${allowAdultParam === 'true' ? 'adult' : 'safe'}_${req.query.source || 'all'}`;

    // Return from memory cache if fresh (< 60 seconds) and not shuffling
    if (!isShuffle) {
      const cached = homeCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp < HOME_CACHE_TTL)) {
        res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
        return res.status(200).json(cached.data);
      }
    }

    const rawSections = [];
    const headers = getLoklokHeaders(token);

    // 1. Fetch Official Loklok App Home Recommendations & Shelves
    try {
      const getHomeRes = await fetch('https://ga-mobile-api.loklok.tv/cms/app/homePage/getHome', {
        headers,
        signal: AbortSignal.timeout(5000)
      });
      if (getHomeRes.ok) {
        const homeData = await getHomeRes.json();
        if (homeData && homeData.data && Array.isArray(homeData.data.recommendItems)) {
          homeData.data.recommendItems.forEach((shelf, idx) => {
            if (shelf && Array.isArray(shelf.recommendContentVOList) && shelf.recommendContentVOList.length > 0) {
              const validItems = shelf.recommendContentVOList.map(item => {
                if (!item || (!item.id && !item.jumpAddress)) return null;
                const title = item.title || item.name || '';
                if (!title || title.toLowerCase() === 'global' || title.toLowerCase() === 'shorts' || title.toLowerCase() === 'anime') return null;
                let realMediaId = item.id;
                let realCat = item.category !== null && item.category !== undefined ? item.category : '1';

                if (item.jumpAddress && typeof item.jumpAddress === 'string') {
                  const idMatch = item.jumpAddress.match(/id=(\d+)/i);
                  const typeMatch = item.jumpAddress.match(/type=(\d+)/i);
                  if (idMatch) realMediaId = idMatch[1];
                  if (typeMatch) realCat = typeMatch[1];
                }

                if (!realMediaId) return null;

                const coverRaw = item.imageUrl || item.coverVerticalUrl || item.coverHorizontalUrl || item.cover || '';
                return {
                  id: maskId('loklok', realMediaId),
                  category: String(realCat),
                  title,
                  cover: fixCoverUrl(coverRaw),
                  backdrop: fixCoverUrl(item.coverHorizontalUrl || coverRaw),
                  score: item.score ? String(item.score) : '8.8',
                  domainType: String(realCat) === '0' ? 'MOVIE' : 'TV',
                  sourceName: 'Loklok HD',
                  sourceKey: 'loklok'
                };
              }).filter(Boolean);

              if (validItems.length > 0) {
                const rawTitle = shelf.homeSectionName || shelf.title;
                const shelfTitle = rawTitle ? rawTitle.toUpperCase() : (idx === 0 ? '🔥 TRENDING LOKLOK PREMIERES' : `LOKLOK FEATURED SELECTION ${idx}`);
                rawSections.push({
                  title: shelfTitle,
                  type: 'LOKLOK_SHELF',
                  items: robustDeduplicate(validItems)
                });
              }
            }
          });
        }
      }
    } catch (_) {}

    // 2. Fetch Multi-Source Hollywood Shelves
    try {
      const hollywoodModule = require('./hollywood');
      const hwShelves = await hollywoodModule.fetchHollywoodShelves();
      if (Array.isArray(hwShelves) && hwShelves.length > 0) {
        hwShelves.forEach(shelf => {
          if (shelf && shelf.items && shelf.items.length > 0) {
            rawSections.push({
              title: shelf.title || '🌟 HOLLYWOOD CINEMA & SERIES',
              type: 'HOLLYWOOD_SHELF',
              items: robustDeduplicate(shelf.items)
            });
          }
        });
      }
    } catch (_) {}

    // 3. Fetch Asian Short Dramas (Narto)
    try {
      const nartoFetch = require('./narto');
      let nartoItems = [];
      const nartoReq = { url: '/catalog', query: { q: 'billionaire' } };
      const nartoRes = {
        status: function() { return this; },
        json: function(data) { if (data && Array.isArray(data.items)) nartoItems = data.items; }
      };
      await nartoFetch(nartoReq, nartoRes);
      if (nartoItems.length > 0) {
        rawSections.push({
          title: '💎 ASIAN SHORT DRAMAS (BILLIONAIRE & REVENGE)',
          type: 'NARTO_SHELF',
          items: robustDeduplicate(nartoItems.map(nItem => ({
            id: maskId('narto', nItem.slug || nItem.id),
            category: '1',
            title: (nItem.title || '').replace(/^\[narto\]\s*/i, '').trim(),
            cover: nItem.cover,
            score: '9.2',
            domainType: 'SHORT',
            sourceName: 'Narto Drama',
            sourceKey: 'narto',
            isNarto: true
          })))
        });
      }
    } catch (_) {}

    // 4. Upcoming Releases Shelf
    const upcomingList = [
      { id: maskId('hollywood', 'm_671'), category: '0', title: "Harry Potter and the Philosopher's Stone (4K Remaster)", cover: fixCoverUrl('https://image.tmdb.org/t/p/w500/wuMc08IPKEatf9rnMNXvIDxqP4W.jpg'), score: '9.5', releaseDate: 'Coming Dec 2026', domainType: 'MOVIE', sourceName: 'Upcoming Premiere', sourceKey: 'upcoming' },
      { id: maskId('anime', 'sakamoto_days_s1'), category: '1', title: 'Sakamoto Days (Season 1)', cover: fixCoverUrl('https://image.tmdb.org/t/p/w500/wRpCqsJFyKNuh5FMegNPrhzp2NF.jpg'), score: '9.2', releaseDate: 'Coming Jan 2026', domainType: 'TV', sourceName: 'Upcoming Premiere', sourceKey: 'upcoming' },
      { id: maskId('anime', 'solo_leveling_s2'), category: '1', title: 'Solo Leveling Season 2: Arise from the Shadow', cover: fixCoverUrl('https://image.tmdb.org/t/p/w500/geCRueV3ElhRTr0xtJuEWJt6dJ1.jpg'), score: '9.8', releaseDate: 'Coming Jan 2026', domainType: 'TV', sourceName: 'Upcoming Premiere', sourceKey: 'upcoming' },
      { id: maskId('hollywood', 't_66732'), category: '1', title: 'Stranger Things Season 5 (The Final Season)', cover: fixCoverUrl('https://image.tmdb.org/t/p/w500/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg'), score: '9.7', releaseDate: 'Coming Nov 2026', domainType: 'TV', sourceName: 'Upcoming Premiere', sourceKey: 'upcoming' },
      { id: maskId('anime', 'demon_slayer_movie_infinity'), category: '0', title: 'Demon Slayer: Infinity Castle Movie Trilogy', cover: fixCoverUrl('https://image.tmdb.org/t/p/w500/fWVSwgjpT2D78VUh6X8UBd2rorW.jpg'), score: '9.9', releaseDate: 'Coming 2026', domainType: 'MOVIE', sourceName: 'Upcoming Premiere', sourceKey: 'upcoming' },
      { id: maskId('hollywood', 't_93405'), category: '1', title: 'Squid Game Season 3', cover: fixCoverUrl('https://image.tmdb.org/t/p/w500/1QdXdRYfktUSONkl1oD5gc6Be0s.jpg'), score: '9.1', releaseDate: 'Coming Dec 2026', domainType: 'TV', sourceName: 'Upcoming Premiere', sourceKey: 'upcoming' },
      { id: maskId('anime', 'chainsaw_man_reze'), category: '0', title: 'Chainsaw Man The Movie: Reze Arc', cover: fixCoverUrl('https://image.tmdb.org/t/p/w500/iFM1dyFi0rByvEomEkmm7NpQeeb.jpg'), score: '9.5', releaseDate: 'Coming 2026', domainType: 'MOVIE', sourceName: 'Upcoming Premiere', sourceKey: 'upcoming' },
      { id: maskId('hollywood', 'm_569094'), category: '0', title: 'Spider-Man: Beyond the Spider-Verse', cover: fixCoverUrl('https://image.tmdb.org/t/p/w500/9KAe39xqyZnv9J4W3DRGdQqX82h.jpg'), score: '9.8', releaseDate: 'Coming 2026', domainType: 'MOVIE', sourceName: 'Upcoming Premiere', sourceKey: 'upcoming' },
      { id: maskId('hollywood', 'm_83533'), category: '0', title: 'Avatar 3: Fire and Ash', cover: fixCoverUrl('https://image.tmdb.org/t/p/w500/bRBeSHfGHwkEpImlhxPmOcUsaeg.jpg'), score: '9.4', releaseDate: 'Coming Dec 2026', domainType: 'MOVIE', sourceName: 'Upcoming Premiere', sourceKey: 'upcoming' },
      { id: maskId('hollywood', 'm_1003596'), category: '0', title: 'Avengers: Doomsday', cover: fixCoverUrl('https://image.tmdb.org/t/p/w500/bh2OuKvq19jBHsloUVCfPSZZw81.jpg'), score: '9.9', releaseDate: 'Coming May 2026', domainType: 'MOVIE', sourceName: 'Upcoming Premiere', sourceKey: 'upcoming' }
    ];

    rawSections.splice(2, 0, {
      title: '⏳ COMING SOON & UPCOMING RELEASES',
      type: 'COMING_SOON_SECTION',
      items: upcomingList
    });

    // 5. Adult Anime (if allowAdult === 'true')
    if (allowAdultParam === 'true') {
      try {
        const hstreamModule = require('./hstream');
        const hmamaModule = require('./hentaimama');
        const [hsItems, hmItems] = await Promise.all([
          hstreamModule.fetchHstreamCatalog(1, 'view-count', ''),
          hmamaModule.fetchHentaiMamaCatalog(1, '')
        ]);

        const combined = [];
        if (hsItems && hsItems.length > 0) combined.push(...hsItems.slice(0, 6));
        if (hmItems && hmItems.length > 0) combined.push(...hmItems.slice(0, 6));

        const dedupedAdult = robustDeduplicate(combined);
        if (dedupedAdult.length > 0) {
          rawSections.push({ title: '🔞 TRENDING ADULT ANIME (18+)', type: 'ADULT_SECTION', items: dedupedAdult });
        }
      } catch (_) {}
    }

    // 6. GLOBAL CROSS-SECTION DEDUPLICATION (Zero Repeated Titles Across Homepage)
    const globalSeenIds = new Set();
    const globalSeenTitles = new Set();
    const resultSections = [];

    for (const section of rawSections) {
      if (!section || !Array.isArray(section.items)) continue;
      let items = section.items.filter(item => {
        if (!item || !item.title) return false;
        const normTitle = (item.title || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        const idKey = String(item.id || '');

        if (idKey && globalSeenIds.has(idKey)) return false;
        if (normTitle && globalSeenTitles.has(normTitle)) return false;

        if (idKey) globalSeenIds.add(idKey);
        if (normTitle) globalSeenTitles.add(normTitle);
        return true;
      });

      if (isShuffle) {
        items = items.sort(() => Math.random() - 0.5);
      }

      if (items.length > 0) {
        resultSections.push({
          ...section,
          items: items.slice(0, 18)
        });
      }
    }

    // Build featured Banners from top deduplicated items
    const allShelvesItems = resultSections.flatMap(s => s.items || []);
    let bannerPool = robustDeduplicate(allShelvesItems);

    if (isShuffle) {
      bannerPool = bannerPool.sort(() => Math.random() - 0.5);
    }

    const banners = bannerPool.slice(0, 10).map((item, idx) => ({
      id: item.id,
      category: item.category || '0',
      title: item.title,
      cover: item.cover,
      backdrop: item.backdrop || item.cover,
      score: item.score || '9.0',
      description: item.description || 'Watch now in Ultra HD with multi-language audio and subtitle support.',
      rank: idx + 1
    }));

    const responsePayload = {
      success: true,
      sections: resultSections,
      shelves: resultSections,
      banners: banners
    };

    if (!isShuffle) {
      homeCache.set(cacheKey, { timestamp: Date.now(), data: responsePayload });
      if (homeCache.size > 20) {
        const oldestKey = homeCache.keys().next().value;
        homeCache.delete(oldestKey);
      }
    }

    res.setHeader('Cache-Control', isShuffle ? 'no-cache' : 'public, s-maxage=60, stale-while-revalidate=120');
    return res.status(200).json(responsePayload);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
