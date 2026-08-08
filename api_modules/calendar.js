const { setCorsHeaders, fixCoverUrl, loklokFetch, getLoklokHeaders } = require('./_utils');

module.exports = async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const token = req.query.token || req.headers.token || '';
    const headers = getLoklokHeaders(token);

    // Fetch pages 0 and 1 from Loklok live home API
    const [p0, p1] = await Promise.all([
      loklokFetch('/homePage/getHome?page=0', { headers }).catch(() => ({})),
      loklokFetch('/homePage/getHome?page=1', { headers }).catch(() => ({}))
    ]);

    const rawList = [];

    [p0, p1].forEach(pageObj => {
      if (pageObj && pageObj.data && Array.isArray(pageObj.data.recommendItems)) {
        pageObj.data.recommendItems.forEach(section => {
          const list = section.recommendContentVOList || [];
          list.forEach(item => {
            const rawTitle = item.title || item.videoName || item.name || '';
            const rawId = item.jumpAddress ? (item.jumpAddress.match(/id=([^&]+)/) || [])[1] || item.id : item.id;
            const coverRaw = item.imageUrl || item.coverVerticalUrl || item.cover || '';

            if (rawId && rawTitle && rawTitle.length > 1) {
              rawList.push({
                id: String(rawId),
                category: item.category || '1',
                title: rawTitle,
                cover: fixCoverUrl(coverRaw),
                score: item.score || '8.5',
                updateDay: item.updateDay || (Math.floor(Math.random() * 7) + 1),
                airTime: item.releaseTime || '20:00',
                updateInfo: section.homeSectionName || 'New Release'
              });
            }
          });
        });
      }
    });

    // Fallback if homePage returned 0 items on Vercel cloud IP
    if (rawList.length === 0) {
      try {
        const searchData = await loklokFetch('/search/v1/search', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ size: 35, params: 'MOVIE,TV,COMIC,MINISERIES', area: '', category: '', year: '', order: 'count', sort: '' })
        });
        const searchResults = (searchData && searchData.data && Array.isArray(searchData.data.searchResults)) ? searchData.data.searchResults : [];

        searchResults.forEach(item => {
          const rawTitle = item.title || item.name || item.videoName || '';
          if (item.id && rawTitle) {
            rawList.push({
              id: String(item.id),
              category: String(item.category || item.domainType || '1'),
              title: rawTitle,
              cover: fixCoverUrl(item.coverVerticalUrl || item.imageUrl || item.cover || ''),
              score: item.score || '8.5',
              updateDay: (Math.floor(Math.random() * 7) + 1),
              airTime: '20:00',
              updateInfo: 'Weekly Release'
            });
          }
        });
      } catch (err) {
        console.error('Calendar fallback error:', err.message);
      }
    }

    // Remove duplicates
    const uniqueMap = new Map();
    rawList.forEach(item => {
      if (!uniqueMap.has(item.id)) {
        uniqueMap.set(item.id, item);
      }
    });

    const allItems = Array.from(uniqueMap.values());

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

    return res.status(200).json({
      success: true,
      source: 'wox_live_api',
      totalCount: allItems.length,
      weeklySchedule: days
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
