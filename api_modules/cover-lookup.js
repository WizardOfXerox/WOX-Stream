const { setCorsHeaders, fixCoverUrl } = require('./_utils');
const { searchHollywood } = require('./hollywood');
const { h5ApiSearch } = require('./search');

// In-Memory Cache for Title Cover Lookups
const coverLookupCache = new Map();

async function resolveSingleCover(rawTitle) {
  if (!rawTitle || typeof rawTitle !== 'string') return null;
  const cleanTitle = rawTitle
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/Season\s*\d+/gi, '')
    .replace(/Episode\s*\d+/gi, '')
    .trim();

  const cacheKey = cleanTitle.toLowerCase();
  if (coverLookupCache.has(cacheKey)) {
    return coverLookupCache.get(cacheKey);
  }

  try {
    // 1. Try TMDb Hollywood Search
    const hwResults = await searchHollywood(cleanTitle);
    if (Array.isArray(hwResults) && hwResults.length > 0 && hwResults[0].cover) {
      const cover = hwResults[0].cover;
      coverLookupCache.set(cacheKey, cover);
      return cover;
    }
  } catch (_) {}

  try {
    // 2. Try Loklok H5 Search
    const loklokResults = await h5ApiSearch(cleanTitle);
    if (Array.isArray(loklokResults) && loklokResults.length > 0) {
      const best = loklokResults[0];
      const coverRaw = best.coverVerticalUrl || best.imageUrl || best.cover || '';
      if (coverRaw) {
        const cover = fixCoverUrl(coverRaw);
        coverLookupCache.set(cacheKey, cover);
        return cover;
      }
    }
  } catch (_) {}

  return null;
}

module.exports = async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let titles = [];
    if (req.query && req.query.title) {
      titles = [req.query.title];
    } else if (req.body && Array.isArray(req.body.titles)) {
      titles = req.body.titles;
    } else if (req.query && req.query.titles) {
      try {
        titles = JSON.parse(req.query.titles);
      } catch (_) {
        titles = [req.query.titles];
      }
    }

    if (!Array.isArray(titles) || titles.length === 0) {
      return res.status(400).json({ success: false, error: 'Missing title or titles array' });
    }

    const uniqueTitles = Array.from(new Set(titles.filter(t => typeof t === 'string' && t.trim().length > 0))).slice(0, 50);
    const results = {};

    await Promise.all(uniqueTitles.map(async (title) => {
      const resolved = await resolveSingleCover(title);
      if (resolved) {
        results[title] = resolved;
      }
    }));

    return res.status(200).json({ success: true, covers: results });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
