const { getLoklokHeaders, getNartoHeaders, setCorsHeaders, fixCoverUrl, LOKLOK_API_BASE, sanitizeToken, maskId, loklokFetch, robustDeduplicate } = require('./_utils');

function deduplicateResults(items) {
  return robustDeduplicate(items);
}

// ===== Reverse-Engineered H5 Web API Signed Client =====
// Extracted from h5.loklok.site Nuxt 3 bundle (entry.4f52e398.js)
// This JSON API is NOT IP-blocked — only signature-protected.

const H5_RSA_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC7GW1zgx9/ssgCjoZhuCvISy5N
s9T2UgAzjJqS2uTGuCVtZsN3TE5wd4OIeiVG2TVDH2Gxlzrxd5jg7P6IiUKqsli
SdZxx/ceqLDawKgvO8mJ+hJJsuIxSL7Bi6T0p+xH6ibw4orGfCFUJhGryE9hqp9q
TRiHOMvgC2si1VqrgaQIDAQAB
-----END PUBLIC KEY-----`;

function h5GenKey(len = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let r = '';
  for (let i = 0; i < len; i++) r += chars.charAt(Math.floor(Math.random() * 62));
  return r;
}

function h5ConvertObj(obj = {}, sorted = false) {
  const pairs = [];
  for (const key in obj) {
    const val = obj[key];
    if (val == null) continue;
    if (Array.isArray(val)) {
      val.forEach((v, idx) => {
        if (typeof v === 'object' && v !== null) pairs.push(key + '=' + h5ConvertObj(v, true));
        else pairs.push(key + '[' + idx + ']=' + v);
      });
    } else if (typeof val === 'object') {
      pairs.push(key + '=' + h5ConvertObj(val, true));
    } else {
      pairs.push(key + '=' + val);
    }
  }
  if (sorted) {
    const grouped = {};
    pairs.forEach(p => {
      const [k, ...rest] = p.split('=');
      const v = rest.join('=');
      grouped[k] ? grouped[k].push(v) : (grouped[k] = [v]);
    });
    return Object.keys(grouped).sort().map(k => grouped[k].join('')).join('');
  }
  return pairs.map(p => p.substring(p.indexOf('=') + 1)).join('');
}

function h5GetSign(data, randomKey, timestamp) {
  const encoded = Buffer.from(h5ConvertObj(data, true), 'utf8').toString('base64');
  const raw = `${timestamp}${encoded}`.replace(/[+]/g, '-').replace(/\//g, '_');
  const cipher = crypto.createCipheriv('aes-128-ecb', Buffer.from(randomKey, 'utf8'), null);
  const encrypted = cipher.update(raw, 'utf8', 'base64') + cipher.final('base64');
  return crypto.createHash('md5').update(encrypted).digest('hex');
}

function h5RsaEncrypt(data) {
  return crypto.publicEncrypt(
    { key: H5_RSA_PUBLIC_KEY, padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(data, 'utf8')
  ).toString('base64');
}

async function h5ApiSearch(keyword) {
  if (!keyword || !keyword.trim()) return [];
  const randomKey = h5GenKey(16);
  const currentTime = Date.now();
  const body = { searchKeyWord: keyword.trim(), size: 50, sort: '', searchType: '' };
  const sign = h5GetSign(body, randomKey, currentTime);
  const aesKey = h5RsaEncrypt(randomKey);
  const tz = 0 - new Date().getTimezoneOffset() / 60;

  const hosts = ['https://h5-api.loklok.site', 'https://h5-api.hehekang.com'];
  const cfProxy = 'https://wox-stream-proxy.wizardofxerox.workers.dev/?url=';

  for (const host of hosts) {
    const targetEndpoint = `${host}/cms/v2/h5/search/searchWithKeyWord`;
    const urlsToTry = [
      targetEndpoint,
      `${cfProxy}${encodeURIComponent(targetEndpoint)}`
    ];

    for (const url of urlsToTry) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
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
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(10000)
        });
        if (!res.ok) continue;
        const data = await res.json();
        if (data.code === '00000') {
          const results = (data.data && data.data.searchResults) || (Array.isArray(data.data) ? data.data : []);
          if (results.length > 0) {
            return results.map(item => ({
              id: String(item.id),
              name: item.name || item.title,
              coverVerticalUrl: item.coverVerticalUrl || item.coverHorizontalUrl || '',
              domainType: item.domainType,
              score: item.score || '8.5'
            }));
          }
        }
      } catch (err) {
        console.error('h5ApiSearch error with', url, ':', err.message);
      }
    }
  }
  return [];
}

function cleanTitle(t) {
  return String(t || '')
    .replace(/^\[narto\]\s*/i, '')
    .replace(/\s*\((?:india|korea|japan|philippines|china|indonesia|thailand|vietnam|us|uk|dubbed|dubbing|sub|uncensored|hd)\)/gi, '')
    .trim();
}

function normalizeTitle(t) {
  return cleanTitle(t).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function deduplicateResults(items) {
  const map = new Map();
  items.forEach(item => {
    const norm = normalizeTitle(item.title);
    if (!norm) return;
    const currentMirror = {
      id: item.id,
      sourceKey: item.sourceKey || (item.isNarto ? 'narto' : (item.isViva ? 'viva' : 'loklok')),
      sourceName: item.sourceName || (item.isNarto ? 'Narto Drama' : (item.isViva ? 'Viva' : 'Loklok HD')),
      category: item.category
    };

    if (!map.has(norm)) {
      map.set(norm, {
        ...item,
        title: cleanTitle(item.title),
        mirrors: [currentMirror]
      });
    } else {
      const existing = map.get(norm);
      if (!existing.mirrors.some(m => m.id === item.id)) {
        existing.mirrors.push(currentMirror);
      }
    }
  });
  return Array.from(map.values());
}

module.exports = async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const rawToken = (req.headers ? req.headers.token : '') || req.query.token || '';
    const token = sanitizeToken(rawToken);
    const headers = getLoklokHeaders(token);

    let keyword = req.query.q || req.query.keyword || '';
    if (req.body && req.body.keyword) keyword = req.body.keyword;

    const reqSource = (req.query.source || (req.body && req.body.source) || '').toLowerCase();
    const page = req.query.page || 0;
    const pageSize = 12;

    let vivaItems = [];

    const isFast = req.query.fast === 'true';

    if (keyword && keyword.trim()) {
      if (isFast) {
        let fastResults = [];
        try {
          const h5Items = await h5ApiSearch(keyword);
          if (h5Items && h5Items.length > 0) {
            h5Items.forEach(item => {
              fastResults.push({
                id: maskId('loklok', item.id),
                category: String(item.category || item.domainType || '1'),
                title: item.name || item.title || 'Untitled',
                cover: fixCoverUrl(item.coverVerticalUrl || item.coverHorizontalUrl || item.cover || ''),
                score: item.score || '8.5',
                domainType: item.domainType,
                sourceName: 'Loklok HD'
              });
            });
          }

          const [loklokRes, nartoRes] = await Promise.allSettled([
            loklokFetch('/search/v1/searchWithKeyWord', {
              method: 'POST',
              headers: { ...headers, 'Content-Type': 'application/json' },
              body: JSON.stringify({ searchKeyWord: keyword.trim(), size: 10, sort: '', searchType: '' })
            }),
            fetch(`https://narto-drama.com/search?q=${encodeURIComponent(keyword.trim())}&limit=10&lang=en-US`, {
              headers: getNartoHeaders(),
              signal: AbortSignal.timeout(4000)
            }).then(r => r.json())
          ]);

          if (loklokRes.status === 'fulfilled' && loklokRes.value && loklokRes.value.data && loklokRes.value.data.searchResults) {
            loklokRes.value.data.searchResults.forEach(item => {
              const itemTitle = item.name || item.title || 'Untitled';
              if (!fastResults.some(r => String(r.title).toLowerCase() === itemTitle.toLowerCase())) {
                fastResults.push({
                  id: maskId('loklok', item.id),
                  category: String(item.category || item.domainType || '1'),
                  title: itemTitle,
                  cover: fixCoverUrl(item.coverVerticalUrl || item.imageUrl || item.cover || ''),
                  score: item.score || null,
                  domainType: item.domainType,
                  sourceName: 'Loklok HD'
                });
              }
            });
          }

          if (nartoRes.status === 'fulfilled' && nartoRes.value && Array.isArray(nartoRes.value.items)) {
            nartoRes.value.items.forEach(nItem => {
              let slug = '';
              if (nItem.url) {
                const match = nItem.url.match(/\/detail\/watch\/([^?#]+)/);
                if (match) slug = match[1];
              }
              let cover = nItem.poster_url || '';
              if (cover.startsWith('/')) cover = 'https://narto-drama.com' + cover;
              const targetId = slug || nItem.id;
              const cleanTitle = (nItem.title || '').replace(/^\[narto\]\s*/i, '').trim();

              if (targetId && cleanTitle) {
                fastResults.push({
                  id: maskId('narto', targetId),
                  category: '1',
                  title: cleanTitle,
                  cover: cover,
                  score: '9.0',
                  domainType: 'SHORT',
                  sourceName: 'Narto Drama',
                  isNarto: true
                });
              }
            });
          }
        } catch (_) {}

        const qWords = keyword.trim().toLowerCase().split(/\s+/).filter(w => w.length > 1);
        if (qWords.length > 0) {
          fastResults = fastResults.filter(item => {
            const tLower = String(item.title || '').toLowerCase();
            return qWords.some(w => tLower.includes(w));
          });
        }

        fastResults = deduplicateResults(fastResults);

        const qLower = keyword.trim().toLowerCase();
        const wordRegex = new RegExp('\\b' + qLower.replace(/[^a-z0-9]/g, '') + '\\b', 'i');

        fastResults.sort((a, b) => {
          const getScore = (item) => {
            const t = String(item.title || '').toLowerCase();
            const tClean = t.replace(/[^a-z0-9\s]/g, '');
            let base = 0;
            if (t === qLower || tClean === qLower) base = 100;
            else if (t.startsWith(qLower)) base = 80;
            else if (wordRegex.test(tClean)) base = 60;
            else if (t.includes(qLower)) base = 40;

            const isLoklok = !item.isNarto && !item.isViva && item.sourceName === 'Loklok HD';
            const sourceBonus = isLoklok ? 30 : 0;
            return base + sourceBonus;
          };

          const aScore = getScore(a);
          const bScore = getScore(b);

          if (aScore !== bScore) return bScore - aScore;
          return 0;
        });

        return res.status(200).json({
          success: true,
          results: fastResults,
          total: fastResults.length,
          page: 0
        });
      }

      let rawResults = [];
      let debugInfo = { ok: false, error: null, count: 0, code: null };

      // 1. Query H5 Gateway SSR Scraper first (Unrestricted Global Access)
      if (keyword && keyword.trim()) {
        try {
          const h5Results = await h5ApiSearch(keyword);
          debugInfo.h5Count = h5Results ? h5Results.length : 0;
          if (h5Results && h5Results.length > 0) {
            debugInfo.h5Sample = h5Results.slice(0, 3);
            rawResults = h5Results;
            debugInfo.ok = true;
            debugInfo.h5First = true;
            debugInfo.count = rawResults.length;
          }
        } catch (h5Err) {
          debugInfo.h5Error = h5Err.message;
        }
      }

      // 2. Query mobile API search endpoint as secondary source
      try {
        const data = await loklokFetch('/search/v1/searchWithKeyWord', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            searchKeyWord: keyword.trim(),
            size: 50,
            sort: '',
            searchType: ''
          })
        });
        if (data && data.data && Array.isArray(data.data.searchResults)) {
          data.data.searchResults.forEach(mItem => {
            if (!rawResults.some(r => String(r.id) === String(mItem.id))) {
              rawResults.push(mItem);
            }
          });
        }
      } catch (err) {
        if (!debugInfo.error) debugInfo.error = err.message;
      }

      // Query words for filtering Loklok items & secondary sources
      const queryWords = keyword.trim().toLowerCase().split(/\s+/).filter(w => w.length > 1);

      let filteredLoklok = rawResults.filter(item => {
        const titleLower = String(item.name || item.title || '').toLowerCase();
        return queryWords.length === 0 || queryWords.some(w => titleLower.includes(w));
      });

      let results = filteredLoklok.map(item => {
        const id = item.id;
        const category = item.category || item.domainType || '1';
        const title = item.name || item.title || 'Untitled';
        const coverRaw = item.coverVerticalUrl || item.imageUrl || item.cover || '';
        const cover = fixCoverUrl(coverRaw);

        return {
          id: maskId('loklok', id),
          category: String(category),
          title: title,
          cover: cover,
          score: item.score || null,
          domainType: item.domainType,
          sourceName: 'Loklok HD',
          isLoklok: true
        };
      });

      // Also search Narto Drama for short dramas matching keyword, appending after Loklok items
      try {
        const nartoUrl = `https://narto-drama.com/search?q=${encodeURIComponent(keyword.trim())}&limit=20&lang=en-US`;
        const nartoHeaders = getNartoHeaders();
        const nartoRes = await fetch(nartoUrl, { headers: nartoHeaders, signal: AbortSignal.timeout(4000) });
        const nartoData = await nartoRes.json();
        if (nartoData && Array.isArray(nartoData.items)) {
          nartoData.items.forEach(nItem => {
            let slug = '';
            if (nItem.url) {
              const match = nItem.url.match(/\/detail\/watch\/([^?#]+)/);
              if (match) slug = match[1];
            }
            let cover = nItem.poster_url || '';
            if (cover.startsWith('/')) cover = 'https://narto-drama.com' + cover;
            const targetId = slug || nItem.id;
            const cleanTitle = (nItem.title || '').replace(/^\[narto\]\s*/i, '').trim();

            if (targetId && cleanTitle) {
              const tLower = cleanTitle.toLowerCase();
              if (queryWords.length === 0 || queryWords.some(w => tLower.includes(w))) {
                results.push({
                  id: maskId('narto', targetId),
                  category: '1',
                  title: cleanTitle,
                  cover: cover,
                  score: '9.0',
                  domainType: 'SHORT',
                  sourceName: 'Narto Drama',
                  isNarto: true
                });
              }
            }
          });
        }
      } catch (_) {}

      // Append matched Viva items
      if (vivaItems.length > 0) {
        vivaItems.forEach(vItem => {
          const tLower = String(vItem.title || '').toLowerCase();
          if (queryWords.length === 0 || queryWords.some(w => tLower.includes(w))) {
            results.push({
              id: vItem.id,
              category: String(vItem.category || 1),
              title: vItem.title,
              cover: vItem.cover,
              score: vItem.score || '9.0',
              domainType: 'MOVIE',
              sourceName: vItem.sourceName,
              sourceKey: vItem.sourceKey,
              isViva: true
            });
          }
        });
      }

      // Search Anime
      try {
        const animeModule = require('./anime-provider');
        const animeRes = await animeModule.searchAnime(keyword.trim());
        if (animeRes && Array.isArray(animeRes)) {
          const filtered = animeRes.filter(item => {
            const tLower = String(item.title || '').toLowerCase();
            return queryWords.length === 0 || queryWords.some(w => tLower.includes(w));
          });
          results.push(...filtered);
        }
      } catch (_) {}

      // Search Asian Drama
      try {
        const dramaModule = require('./asian-drama');
        const dramaRes = await dramaModule.searchDrama(keyword.trim());
        if (dramaRes && Array.isArray(dramaRes)) {
          const filtered = dramaRes.filter(item => {
            const tLower = String(item.title || '').toLowerCase();
            return queryWords.length === 0 || queryWords.some(w => tLower.includes(w));
          });
          results.push(...filtered);
        }
      } catch (_) {}

      // Search Classics
      try {
        const classicsModule = require('./classics');
        const classicsRes = await classicsModule.searchClassics(keyword.trim());
        if (classicsRes && Array.isArray(classicsRes)) {
          const filtered = classicsRes.filter(item => {
            const tLower = String(item.title || '').toLowerCase();
            return queryWords.length === 0 || queryWords.some(w => tLower.includes(w));
          });
          results.push(...filtered);
        }
      } catch (_) {}

      // Search Adult (if allowAdult === 'true')
      const allowAdultParam = req.query.allowAdult || (req.headers ? req.headers.allowadult : '') || '';
      if (allowAdultParam === 'true') {
        try {
          const hstreamModule = require('./hstream');
          const hmamaModule = require('./hentaimama');
          const [hsItems, hmItems] = await Promise.all([
            hstreamModule.fetchHstreamCatalog(1, 'view-count', keyword.trim()),
            hmamaModule.fetchHentaiMamaCatalog(1, keyword.trim())
          ]);
          if (hsItems && Array.isArray(hsItems)) {
            results.push(...hsItems.filter(item => {
              const tLower = String(item.title || '').toLowerCase();
              return queryWords.length === 0 || queryWords.some(w => tLower.includes(w));
            }));
          }
          if (hmItems && Array.isArray(hmItems)) {
            results.push(...hmItems.filter(item => {
              const tLower = String(item.title || '').toLowerCase();
              return queryWords.length === 0 || queryWords.some(w => tLower.includes(w));
            }));
          }
        } catch (_) {}
      }

      results = deduplicateResults(results);

      // Relevancy Sorting: exact matches & word-boundary matches first
      const qLower = keyword.trim().toLowerCase();
      const wordRegex = new RegExp('\\b' + qLower.replace(/[^a-z0-9]/g, '') + '\\b', 'i');

      results.sort((a, b) => {
        const aTitle = String(a.title || '').toLowerCase();
        const bTitle = String(b.title || '').toLowerCase();
        const aClean = aTitle.replace(/[^a-z0-9\s]/g, '');
        const bClean = bTitle.replace(/[^a-z0-9\s]/g, '');

        const getScore = (item) => {
          const t = String(item.title || '').toLowerCase();
          const tClean = t.replace(/[^a-z0-9\s]/g, '');
          let base = 0;
          if (t === qLower || tClean === qLower) base = 100;
          else if (t.startsWith(qLower)) base = 80;
          else if (wordRegex.test(tClean)) base = 60;
          else if (t.includes(qLower)) base = 40;

          // Extra bonus for official Loklok HD main catalog titles
          const isLoklok = !item.isNarto && !item.isViva && item.sourceName === 'Loklok HD';
          const sourceBonus = isLoklok ? 30 : 0;
          return base + sourceBonus;
        };

        const aScore = getScore(a);
        const bScore = getScore(b);

        if (aScore !== bScore) return bScore - aScore;
        return 0;
      });

      return res.status(200).json({ success: true, results, debugInfo });

    } else {
      // Category multi-filter search API
      const reqSource = (req.query.source || (req.body && req.body.source) || '').toLowerCase();
      const pageSize = 12;

      if (reqSource === 'vivaone' || reqSource === 'vivamax' || reqSource === 'vivamb' || reqSource === 'viva moviebox') {
        const sourceMap = { vivaone: 'vivaone', vivamax: 'vivamax', vivamb: 'vivamoviebox', 'viva moviebox': 'vivamoviebox' };
        const targetSrc = sourceMap[reqSource] || reqSource;
        const pageIdx = parseInt(page, 10) || 0;

        let vivaCatalog = [];
        try {
          const vivaHandler = require('./viva');
          const vivaReq = { query: { action: 'catalog', source: targetSrc } };
          const vivaRes = {
            status: function() { return this; },
            json: function(data) { if (data && data.items) vivaCatalog = data.items; }
          };
          await vivaHandler(vivaReq, vivaRes);
        } catch (_) {}

        const startIndex = pageIdx * pageSize;
        const pageSlice = vivaCatalog.slice(startIndex, startIndex + pageSize);

        let results = pageSlice.map(vItem => ({
          id: vItem.id,
          category: String(vItem.category || 1),
          title: vItem.title,
          cover: vItem.cover,
          score: vItem.score || '9.0',
          domainType: 'MOVIE',
          sourceName: vItem.sourceName,
          sourceKey: vItem.sourceKey,
          isViva: true
        }));

        let nextCursor = startIndex + pageSize < vivaCatalog.length ? `${reqSource}_page_${pageIdx + 1}` : '';
        return res.status(200).json({ success: true, results, nextCursor });
      } else if (reqSource === 'narto') {
        const pageIdx = parseInt(page, 10) || 0;
        const subTypeFilter = req.query.params || req.query.category || '';
        let nartoItems = [];
        try {
          const nartoFetch = require('./narto');
          const nartoReq = { url: `/catalog`, query: { q: subTypeFilter } };
          const nartoRes = {
            status: function() { return this; },
            json: function(data) { if (data && data.items) nartoItems = data.items; }
          };
          await nartoFetch(nartoReq, nartoRes);
        } catch (_) {}

        // Fallback: If filtered list is small, fetch default catalog items to fill page
        if (nartoItems.length < pageSize) {
          try {
            const nartoFetch = require('./narto');
            const fallbackReq = { url: `/catalog`, query: { q: '' } };
            const fallbackRes = {
              status: function() { return this; },
              json: function(data) {
                if (data && Array.isArray(data.items)) {
                  nartoItems.push(...data.items);
                }
              }
            };
            await nartoFetch(fallbackReq, fallbackRes);
          } catch (_) {}
        }

        const startIndex = (pageIdx * pageSize) % Math.max(1, nartoItems.length);
        let pageSlice = nartoItems.slice(startIndex, startIndex + pageSize);

        if (pageSlice.length < pageSize && nartoItems.length > 0) {
          pageSlice = pageSlice.concat(nartoItems.slice(0, pageSize - pageSlice.length));
        }

        let results = pageSlice.map(nItem => {
          const cleanTitle = (nItem.title || '').replace(/^\[narto\]\s*/i, '').trim();
          return {
            id: maskId('narto', nItem.id),
            category: '1',
            title: cleanTitle,
            cover: nItem.cover,
            score: '9.0',
            domainType: 'SHORT',
            sourceName: 'Narto Drama',
            sourceKey: 'narto',
            isNarto: true
          };
        });

        let nextCursor = `narto_page_${pageIdx + 1}`;
        return res.status(200).json({ success: true, results, nextCursor });
      } else if (reqSource === 'hollywood') {
        let hwItems = [];
        try {
          const hwModule = require('./hollywood');
          const hwRes = await hwModule.fetchHollywoodShelves();
          const list = Array.isArray(hwRes) ? hwRes : (hwRes && hwRes.shelves ? hwRes.shelves : []);
          list.forEach(s => hwItems.push(...(s.items || [])));
        } catch (_) {}
        return res.status(200).json({ success: true, results: hwItems, nextCursor: '' });
      } else if (reqSource === 'anime') {
        let aniItems = [];
        try {
          const aniModule = require('./anime-provider');
          const aniRes = await aniModule.fetchAnimeShelves();
          const list = Array.isArray(aniRes) ? aniRes : (aniRes && aniRes.shelves ? aniRes.shelves : []);
          list.forEach(s => aniItems.push(...(s.items || [])));
        } catch (_) {}
        return res.status(200).json({ success: true, results: aniItems, nextCursor: '' });
      } else if (reqSource === 'drama') {
        let dramaItems = [];
        try {
          const dramaModule = require('./asian-drama');
          const dramaRes = await dramaModule.fetchDramaShelves();
          const list = Array.isArray(dramaRes) ? dramaRes : (dramaRes && dramaRes.shelves ? dramaRes.shelves : []);
          list.forEach(s => dramaItems.push(...(s.items || [])));
        } catch (_) {}
        return res.status(200).json({ success: true, results: dramaItems, nextCursor: '' });
      } else if (reqSource === 'classics') {
        let classicsItems = [];
        try {
          const classicsModule = require('./classics');
          const p = pageIdx + 1;
          classicsItems = await classicsModule.fetchClassicsPaginated(p, 'feature_films');
        } catch (_) {}
        const nextCursor = classicsItems.length > 0 ? `classics_page_${pageIdx + 1}` : '';
        return res.status(200).json({ success: true, results: classicsItems, nextCursor });
      } else if (reqSource === 'adult' || reqSource === 'hstream' || reqSource === 'hentaimama') {
        let adultItems = [];
        try {
          const hstreamModule = require('./hstream');
          const hmamaModule = require('./hentaimama');
          const p = pageIdx + 1;
          const [hsItems, hmItems] = await Promise.all([
            hstreamModule.fetchHstreamCatalog(p, 'view-count', ''),
            hmamaModule.fetchHentaiMamaCatalog(p, '')
          ]);
          if (hsItems) adultItems.push(...hsItems);
          if (hmItems) adultItems.push(...hmItems);
        } catch (_) {}
        adultItems = deduplicateResults(adultItems);
        const nextCursor = adultItems.length > 0 ? `adult_page_${pageIdx + 1}` : '';
        return res.status(200).json({ success: true, results: adultItems, nextCursor });
      }

      const rawParams = req.query.params || (req.body && req.body.params) || '';
      const params = rawParams.trim() ? rawParams.trim() : 'MOVIE,TV,VARIETY,COMIC,DOCUMENTARY,TVSPECIAL,MINISERIES,SETI,TALK';
      
      const area = req.query.area || (req.body && req.body.area) || '';
      const category = req.query.category || (req.body && req.body.category) || '';
      const year = req.query.year || (req.body && req.body.year) || '';
      const order = req.query.order || (req.body && req.body.order) || 'count';

      const sortCursor = req.query.sort || (req.body && req.body.sort) || '';

      const payload = {
        size: 30,
        params: params,
        area: area,
        category: category,
        year: year,
        order: order,
        sort: sortCursor
      };

      let categoryRes = await fetch(`${LOKLOK_API_BASE}/search/v1/search?page=${page}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000)
      });
      let data = await categoryRes.json();

      let rawResults = (data.data && data.data.searchResults) ? data.data.searchResults : [];

      // Fallback: If strict category/sort returned fewer than 6 items for specialized types, try fallback query
      if (rawResults.length < 6 && (category || area || order === 'score')) {
        const fallbackPayload = {
          ...payload,
          category: '', // clear strict genre category restriction
          order: 'count' // default to popularity count
        };
        const fallbackRes = await fetch(`${LOKLOK_API_BASE}/search/v1/search?page=${page}`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify(fallbackPayload)
        });
        const fallbackData = await fallbackRes.json();
        if (fallbackData.data && Array.isArray(fallbackData.data.searchResults) && fallbackData.data.searchResults.length > rawResults.length) {
          rawResults = fallbackData.data.searchResults;
        }
      }

        let results = rawResults.map(item => ({
          id: maskId('loklok', item.id),
          category: String(item.category || item.domainType || '1'),
          title: item.name || item.title || 'Untitled',
          cover: fixCoverUrl(item.coverVerticalUrl || item.imageUrl || item.cover || ''),
          score: item.score || null,
          domainType: item.domainType,
          sort: item.sort || '',
          sourceName: 'Loklok HD',
          sourceKey: 'loklok'
        }));

        // Only append extra sources when no strict conflicting regional/genre filter is selected!
        const hasStrictArea = !!area;
        const hasStrictCategory = !!category;

        if (!reqSource || reqSource === 'all') {
          let extraItems = [];
          const isAsianRegion = !hasStrictArea || ['53', '44', '57', '32,56', '41', '34', '40'].includes(area);
          const isGeneralCatalog = !hasStrictArea && !hasStrictCategory;
          const allowAdultParam = req.query.allowAdult || (req.headers ? req.headers.allowadult : '') || '';

          const subTasks = [];

          // Task 1: Narto Asian Dramas
          if (isAsianRegion) {
            subTasks.push((async () => {
              try {
                const nartoFetch = require('./narto');
                let nartoItems = [];
                const genreQuery = category || (area === '53' ? 'korea' : '');
                const nartoReq = { url: `/catalog`, query: { q: genreQuery } };
                const nartoRes = {
                  status: function() { return this; },
                  json: function(data) { if (data && data.items) nartoItems = data.items; }
                };
                await Promise.race([
                  nartoFetch(nartoReq, nartoRes),
                  new Promise(resolve => setTimeout(resolve, 1200))
                ]);
                const nartoSlice = nartoItems.slice((page * 6) % Math.max(1, nartoItems.length - 6), ((page * 6) % Math.max(1, nartoItems.length - 6)) + 6);
                return nartoSlice.map(nItem => ({
                  id: maskId('narto', nItem.id),
                  category: '1',
                  title: String(nItem.title || '').replace(/^\[narto\]\s*/i, '').trim(),
                  cover: nItem.cover,
                  score: '9.0',
                  domainType: 'SHORT',
                  sourceName: 'Narto Drama',
                  sourceKey: 'narto',
                  isNarto: true
                }));
              } catch (_) { return []; }
            })());
          }

          // Task 2: Classics Archive
          if (isGeneralCatalog) {
            subTasks.push((async () => {
              try {
                const classicsModule = require('./classics');
                const classicsItems = await Promise.race([
                  classicsModule.fetchClassicsPaginated(page + 1, 'feature_films'),
                  new Promise(resolve => setTimeout(() => resolve([]), 1200))
                ]);
                return classicsItems ? classicsItems.slice(0, 6) : [];
              } catch (_) { return []; }
            })());
          }

          // Task 3: Adult Anime (Hstream & HentaiMama)
          if (allowAdultParam === 'true' && isGeneralCatalog) {
            subTasks.push((async () => {
              try {
                const hstreamModule = require('./hstream');
                const hmamaModule = require('./hentaimama');
                const [hsItems, hmItems] = await Promise.all([
                  Promise.race([hstreamModule.fetchHstreamCatalog(page + 1, 'view-count', ''), new Promise(r => setTimeout(() => r([]), 1200))]),
                  Promise.race([hmamaModule.fetchHentaiMamaCatalog(page + 1, ''), new Promise(r => setTimeout(() => r([]), 1200))])
                ]);
                const resList = [];
                if (hsItems && hsItems.length > 0) resList.push(...hsItems.slice(0, 4));
                if (hmItems && hmItems.length > 0) resList.push(...hmItems.slice(0, 4));
                return resList;
              } catch (_) { return []; }
            })());
          }

          const settledSub = await Promise.allSettled(subTasks);
          settledSub.forEach(s => {
            if (s.status === 'fulfilled' && Array.isArray(s.value)) {
              extraItems.push(...s.value);
            }
          });

          // Interleave results
          if (extraItems.length > 0) {
            let interleaved = [];
            const maxLen = Math.max(results.length, extraItems.length);
            for (let i = 0; i < maxLen; i++) {
              if (i < results.length) interleaved.push(results[i]);
              if (i < extraItems.length) interleaved.push(extraItems[i]);
            }
            results = interleaved;
          }
        }

        const lastRawItem = rawResults.length > 0 ? rawResults[rawResults.length - 1] : null;
        let nextCursor = (lastRawItem || results.length > 0) ? (lastRawItem?.sort || `page_${page + 1}`) : '';
        results = deduplicateResults(results);
        return res.status(200).json({ success: true, results, nextCursor });
    }
  } catch (error) {
    console.error('API search handler error:', error.message);
    return res.status(200).json({ success: true, results: [], error: error.message });
  }
};
