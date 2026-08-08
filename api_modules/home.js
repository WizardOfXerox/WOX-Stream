const { getLoklokHeaders, setCorsHeaders, fixCoverUrl, loklokFetch, maskId } = require('./_utils');

module.exports = async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const page = req.query.page || 0;
    const token = req.headers.token || req.query.token || '';
    const headers = getLoklokHeaders(token);

    const data = await loklokFetch(`/homePage/getHome?page=${page}`, { headers });
    
    if ((data.code !== '00000' && data.code !== '000000') || !data.data) {
      console.warn('Loklok homePage/getHome endpoint error code:', data.code);
    }

    const recommendItems = (data && data.data && data.data.recommendItems) ? data.data.recommendItems : [];
    const resultSections = [];

    // Categories to skip if returned as home shortcuts
    const skipCategories = ['global', 'shorts', 'anime', 'movie', 'k-drama', 'western', 'horror', 'animated film', 'thai', 'hot variety show'];

    for (const section of recommendItems) {
      const sectionName = section.homeSectionName || 'Recommendations';
      const sectionType = section.homeSectionType || '';
      
      // Skip Banners, Category Blocks, and Top Picks category shortcuts
      if (
        sectionType === 'BANNER' ||
        sectionType === 'BLOCK_GROUP' ||
        sectionType === 'CATEGORY_ENTER' ||
        sectionType === 'CATEGORY_GROUP' ||
        sectionName.toLowerCase().includes('top picks')
      ) {
        continue;
      }

      const rawMedia = section.media || section.recommendContentVOList || [];
      const items = rawMedia.map(item => {
        const id = item.jumpAddress ? (item.jumpAddress.match(/id=([^&]+)/) || [])[1] || item.id : item.id;
        const category = (item.category !== undefined && item.category !== null) ? String(item.category) : (item.domainType || '1');
        const title = item.title || item.name || item.videoName || 'Untitled';
        const coverRaw = item.coverVerticalUrl || item.imageUrl || item.cover || '';
        const cover = fixCoverUrl(coverRaw);

        return {
          id: maskId('loklok', id),
          category: String(category),
          title: title,
          cover: cover,
          score: item.score || null,
          domainType: item.domainType
        };
      }).filter(item => {
        if (!item.id || !item.title) return false;
        if (skipCategories.includes(item.title.toLowerCase())) return false;
        return true;
      });

      if (items.length > 0) {
        resultSections.push({
          title: sectionName,
          type: sectionType,
          items: items
        });
      }
    }

    const loklokSectionsCount = resultSections.length;

    // Fallback: If Loklok home endpoint returned 0 Loklok items (e.g. cloud hosting IP restrictions), populate from Loklok catalog search
    if (loklokSectionsCount === 0) {
      try {
        const searchUrl = `${LOKLOK_API_BASE}/search/v1/search`;
        const searchRes = await fetch(searchUrl, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ size: 24, params: 'MOVIE,TV,VARIETY,COMIC,DOCUMENTARY', area: '', category: '', year: '', order: 'count', sort: '' })
        });
        const searchData = await searchRes.json();
        const searchResults = (searchData && searchData.data && Array.isArray(searchData.data.searchResults)) ? searchData.data.searchResults : [];

        if (searchResults.length > 0) {
          const loklokItems = searchResults.map(item => ({
            id: maskId('loklok', item.id),
            category: String(item.category || item.domainType || '1'),
            title: item.title || item.name || item.videoName || 'Untitled',
            cover: fixCoverUrl(item.coverVerticalUrl || item.imageUrl || item.cover || ''),
            score: item.score || null,
            domainType: item.domainType
          }));

          resultSections.unshift({
            title: '🔥 TRENDING LOKLOK MOVIES & SHOWS',
            type: 'SINGLE_ALBUM',
            items: loklokItems.slice(0, 12)
          });
          resultSections.unshift({
            title: '✨ POPULAR LOKLOK RELEASES',
            type: 'SINGLE_ALBUM',
            items: loklokItems.slice(12, 24)
          });
        }
      } catch (err) {
        console.error('Loklok search fallback error on home:', err.message);
      }
    }

    // Concurrently fetch multi-source shelves (Asian Short Dramas, Classics, Adult Anime)
    const allowAdultParam = req.query.allowAdult || (req.headers ? req.headers.allowadult : '') || '';

    const extraTasks = [];

    // Task 1: Asian Dramas (Narto)
    extraTasks.push((async () => {
      try {
        const nartoFetch = require('./narto');
        let nartoItems = [];
        const nartoReq = { url: '/catalog', query: { q: '' } };
        const nartoRes = {
          status: function() { return this; },
          json: function(data) { if (data && data.items) nartoItems = data.items; }
        };
        await nartoFetch(nartoReq, nartoRes);

        if (nartoItems.length > 0) {
          const formatted = nartoItems.slice(0, 10).map(nItem => ({
            id: maskId('narto', nItem.id),
            category: '1',
            title: String(nItem.title || '').replace(/^\[narto\]\s*/i, '').trim(),
            cover: nItem.cover,
            score: '9.0',
            domainType: 'SHORT',
            sourceName: 'Narto Drama',
            isNarto: true
          }));
          return { title: '🔥 POPULAR ASIAN SHORT DRAMAS', type: 'NARTO_SECTION', items: formatted };
        }
      } catch (_) {}
      return null;
    })());

    // Task 2: Classics Archive
    extraTasks.push((async () => {
      try {
        const classicsModule = require('./classics');
        const classicsRes = await classicsModule.fetchClassicsShelves();
        if (classicsRes && classicsRes.shelves && Array.isArray(classicsRes.shelves)) {
          return classicsRes.shelves.filter(s => s.items && s.items.length > 0);
        }
      } catch (_) {}
      return null;
    })());

    // Task 3: Adult Anime (if allowAdult === 'true')
    if (allowAdultParam === 'true') {
      extraTasks.push((async () => {
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

          if (combined.length > 0) {
            return { title: '🔞 TRENDING ADULT ANIME (18+)', type: 'ADULT_SECTION', items: combined };
          }
        } catch (_) {}
        return null;
      })());
    }

    const settled = await Promise.allSettled(extraTasks);
    settled.forEach(res => {
      if (res.status === 'fulfilled' && res.value) {
        if (Array.isArray(res.value)) {
          res.value.forEach(s => { if (s && s.items && s.items.length > 0) resultSections.push(s); });
        } else if (res.value.items && res.value.items.length > 0) {
          resultSections.push(res.value);
        }
      }
    });

    return res.status(200).json({
      success: true,
      sections: resultSections
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
