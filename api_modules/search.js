const crypto = require('crypto');
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

// In-Memory RAM Cache for H5 Loklok Search (5 min TTL)
const h5SearchMemCache = new Map();
const H5_SEARCH_TTL = 5 * 60 * 1000;

async function h5ApiSearch(keyword) {
  if (!keyword || !keyword.trim()) return [];
  const cleanKw = keyword.trim();
  const cacheKey = cleanKw.toLowerCase();

  const cached = h5SearchMemCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < H5_SEARCH_TTL)) {
    return cached.data;
  }

  const randomKey = h5GenKey(16);
  const currentTime = Date.now();
  const body = { searchKeyWord: cleanKw, size: 50, sort: '', searchType: '' };
  const sign = h5GetSign(body, randomKey, currentTime);
  const aesKey = h5RsaEncrypt(randomKey);
  const tz = 0 - new Date().getTimezoneOffset() / 60;

  const endpoints = [
    'https://h5-api.loklok.site/cms/v2/h5/search/searchWithKeyWord',
    'https://h5-api.hehekang.com/cms/v2/h5/search/searchWithKeyWord',
    `https://wox-stream-proxy.wizardofxerox.workers.dev/?url=${encodeURIComponent('https://h5-api.loklok.site/cms/v2/h5/search/searchWithKeyWord')}`,
    `https://wox-stream-proxy.wizardofxerox.workers.dev/?url=${encodeURIComponent('https://h5-api.hehekang.com/cms/v2/h5/search/searchWithKeyWord')}`
  ];

  const headers = {
    'Content-Type': 'application/json',
    'sign': sign,
    'aesKey': aesKey,
    'currentTime': currentTime.toString(),
    'clientType': 'H5',
    'versionCode': '32',
    'lang': 'en',
    'deviceid': h5GenKey(32),
    'timezone': `GMT${tz < 0 ? tz : '+' + tz}`,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
    'Referer': 'https://h5.loklok.site/',
    'Origin': 'https://h5.loklok.site'
  };

  const fetchEndpoint = async (url) => {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3500)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data && data.code === '00000') {
      const results = (data.data && data.data.searchResults) || (Array.isArray(data.data) ? data.data : []);
      return results.map(item => ({
        id: String(item.id),
        name: item.name || item.title,
        coverVerticalUrl: item.coverVerticalUrl || item.coverHorizontalUrl || '',
        domainType: item.domainType,
        score: item.score || '8.5'
      }));
    }
    throw new Error(`Loklok code ${data ? data.code : 'unknown'}`);
  };

  try {
    const results = await Promise.any(endpoints.map(ep => fetchEndpoint(ep)));
    if (Array.isArray(results) && results.length > 0) {
      h5SearchMemCache.set(cacheKey, { timestamp: Date.now(), data: results });
      if (h5SearchMemCache.size > 200) {
        const firstKey = h5SearchMemCache.keys().next().value;
        h5SearchMemCache.delete(firstKey);
      }
      return results;
    }
  } catch (_) {}

  return [];
}

function cleanTitle(t) {
  if (!t) return '';
  return String(t)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘`´]/g, "'")
    .replace(/[（【]/g, '(')
    .replace(/[）】]/g, ')')
    .replace(/^\[(?:narto|loklok|hollywood|classics|anime|adult)\]\s*/gi, '')
    .replace(/\s*\[(?:english|hindi|indonesian|tagalog|portuguese|spanish|french|german|japanese|korean|chinese|dubbed|subbed|dub|sub|uncensored|hd|4k|1080p|720p|bahasa)\]/gi, '')
    .replace(/\s*\([^)]*(?:india|korea|japan|philippines|china|indonesia|thailand|vietnam|us|uk|dubbed|subbed|dub|sub|uncensored|hd|4k|1080p|720p|english|hindi|indonesian|tagalog|portuguese|spanish|french|german|bahasa)[^)]*\)/gi, '')
    .replace(/\s*\b(?:tagalog|english|hindi|indonesian|portuguese|spanish|french|german|dubbed|subbed)\b$/gi, '')
    .trim();
}

function normalizeTitle(t) {
  return cleanTitle(t).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function deduplicateResults(items) {
  if (!Array.isArray(items)) return [];

  const map = new Map();
  const seenIds = new Set();
  const seasonKeysSet = new Set();

  const cleanedItems = items.filter(item => {
    if (!item || !item.title || !item.id) return false;
    if (seenIds.has(item.id)) return false;
    seenIds.add(item.id);
    item.cleanTitle = cleanTitle(item.title);
    return true;
  });

  cleanedItems.forEach(item => {
    const isSeasoned = /\bseason\s*\d+|\bs\d{1,2}|\bpart\.?\s*\d+/i.test(item.cleanTitle);
    if (isSeasoned) {
      const baseName = item.cleanTitle
        .replace(/\s*[-:]?\s*season\s*\d+/gi, '')
        .replace(/\s*\bseason\s*\d+\b/gi, '')
        .replace(/\s*\bs\d{1,2}\b/gi, '')
        .replace(/\s*[-:]?\s*part\.?\s*\d+/gi, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
      if (baseName) seasonKeysSet.add(baseName);
    }
  });

  for (const item of cleanedItems) {
    const domain = String(item.domainType || item.category || '1').toUpperCase();
    const rawNorm = item.cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
    const isBareParent = seasonKeysSet.has(rawNorm) && !/\bseason\s*\d+|\bs\d{1,2}|\bpart/i.test(item.cleanTitle);

    let targetKey = `${rawNorm}_${domain}`;
    if (isBareParent) {
      targetKey = `${rawNorm}season1_${domain}`;
    }

    const currentMirror = {
      id: item.id,
      sourceKey: item.sourceKey || (item.isNarto ? 'narto' : 'loklok'),
      sourceName: item.sourceName || (item.isNarto ? 'Narto Drama' : 'Loklok HD'),
      category: item.category
    };

    if (!map.has(targetKey)) {
      map.set(targetKey, {
        ...item,
        title: item.cleanTitle,
        mirrors: [currentMirror]
      });
    } else {
      const existing = map.get(targetKey);
      if (!existing.mirrors) {
        existing.mirrors = [
          { id: existing.id, sourceKey: existing.sourceKey || 'loklok', sourceName: existing.sourceName || 'Main Server' }
        ];
      }
      if (!existing.mirrors.some(m => m.id === item.id)) {
        existing.mirrors.push(currentMirror);
      }
      if ((!existing.cover || existing.cover.includes('placeholder') || existing.cover.includes('snssb')) && item.cover && item.cover.includes('tmdb')) {
        existing.cover = item.cover;
      }
      if (!existing.score && item.score) {
        existing.score = item.score;
      }
    }
  }

  return Array.from(map.values());
}

const SCRIPTED_DRAMAS_BLACKLIST = new Set([
  'game of thrones', 'house of the dragon', 'breaking bad', 'better call saul',
  'stranger things', 'the walking dead', 'squid game', 'the last of us',
  'run on', 'the king\'s man', 'the man with the golden gun', 'the old man & the gun',
  'vikings', 'the boys', 'succession', 'peaky blinders', 'chernobyl',
  'sherlock', 'the witcher', 'dark', 'westworld', 'fargo', 'true detective',
  'prison break', 'money heist', 'the crown', 'ozark', 'dexter', 'lost',
  'severance', 'the bear', 'shogun', 'fallout', 'the sopranos', 'the wire'
]);

const TYPE_CONFIG = {
  'MOVIE,TVSPECIAL': {
    name: 'movie',
    queries: [
      'movie', 'film', 'cinema', 'action movie', 'romance movie', 'comedy movie',
      'horror movie', 'sci-fi movie', 'hollywood movie', 'blockbuster', 'thriller movie',
      'adventure movie', 'fantasy movie', 'animated movie', '2025 movie', '2026 movie',
      'marvel movie', 'dc movie', 'disney movie', 'feature film'
    ],
    match: (domain, textBlob, item) => {
      const d = String(domain || item.domainType || item.category || '').toUpperCase();
      if (d === 'MOVIE' || d === '0' || item.sourceKey === 'hollywood' || item.sourceKey === 'classics') return true;
      if (d === 'TV' || d === '1' || d === 'COMIC' || d === 'MINISERIES' || d === 'VARIETY' || d === 'TALK' || d === 'DOCUMENTARY' || item.sourceKey === 'narto' || item.sourceKey === 'anime' || item.sourceKey === 'drama') return false;
      return textBlob.includes('movie') || textBlob.includes('film') || textBlob.includes('cinema');
    }
  },
  'TV,SETI,VARIETY,TALK,COMIC,DOCUMENTARY': {
    name: 'tv series',
    queries: ['Crash Landing on You', 'Queen of Tears', 'Business Proposal', 'Lovely Runner', 'series', 'drama', 'k-drama', 'c-drama', 'korean drama', 'chinese drama', 'tv series'],
    match: (domain, textBlob, item) => {
      const d = String(domain || item.domainType || item.category || '').toUpperCase();
      if (d === 'TV' || d === '1' || item.sourceKey === 'drama') return true;
      if (d === 'MOVIE' || d === '0' || item.sourceKey === 'hollywood' || item.sourceKey === 'classics') return false;
      return textBlob.includes('series') || textBlob.includes('drama') || textBlob.includes('k-drama') || textBlob.includes('season');
    }
  },
  'COMIC': {
    name: 'anime',
    queries: ['Demon Slayer', 'Attack on Titan', 'Jujutsu Kaisen', 'One Piece', 'Frieren', 'anime', 'animation', 'Solo Leveling', 'Chainsaw Man', 'Spy x Family', 'Bleach', 'Naruto', 'Black Clover', 'My Hero Academia', 'Dragon Ball', 'Hunter x Hunter', 'Death Note', 'Tokyo Ghoul', 'Wind Breaker', 'Kaiju No. 8', 'Dan Da Dan'],
    match: (domain, textBlob, item) => {
      const d = String(domain || item.domainType || item.category || '').toUpperCase();
      if (d === 'COMIC' || item.sourceKey === 'anime') return true;
      if (d === 'MOVIE' || d === '0') return false;
      return textBlob.includes('anime') || textBlob.includes('animation') || textBlob.includes('manga') || textBlob.includes('comic') || textBlob.includes('japanese');
    }
  },
  'VARIETY,TALK': {
    name: 'variety show',
    queries: ['Running Man', 'Single Inferno', 'Culinary Class Wars', 'Knowing Bros', '2 Days 1 Night', 'Sixth Sense', 'The Devils Plan', 'Heart Signal', 'Transit Love', 'variety show', 'reality show'],
    match: (domain, textBlob, item) => {
      const d = String(domain || item.domainType || item.category || '').toUpperCase();
      if (d === 'VARIETY' || d === '3') return true;
      if (d === 'MOVIE' || d === '0') return false;
      return textBlob.includes('variety') || textBlob.includes('reality show') || textBlob.includes('game show') || textBlob.includes('running man');
    }
  },
  'TALK': {
    name: 'talk show',
    queries: ['The Tonight Show', 'Jimmy Kimmel', 'Late Night', 'Graham Norton', 'Ellen', 'Last Week Tonight', 'Salon Drip', 'Suchwita', 'talk show', 'interview show', 'podcast'],
    match: (domain, textBlob, item) => {
      const d = String(domain || item.domainType || item.category || '').toUpperCase();
      if (d === 'TALK' || d === '5') return true;
      if (d === 'MOVIE' || d === '0') return false;
      return textBlob.includes('talk show') || textBlob.includes('interview') || textBlob.includes('podcast') || textBlob.includes('late night');
    }
  },
  'DOCUMENTARY': {
    name: 'documentary',
    queries: ['documentary', 'planet earth', 'our planet', 'blue planet', 'cosmos', 'national geographic', 'the last dance', 'wildlife', 'history', 'nature'],
    match: (domain, textBlob, item) => {
      const d = String(domain || item.domainType || item.category || '').toUpperCase();
      if (d === 'DOCUMENTARY' || d === '25' || item.sourceKey === 'hollywood') return true;
      return textBlob.includes('documentary') || textBlob.includes('docuseries') || textBlob.includes('bbc earth') || textBlob.includes('nature');
    }
  },
  'MINISERIES': {
    name: 'short drama',
    queries: ['short drama', 'billionaire drama', 'revenge drama', 'shorts', 'dramabox', 'shortmax', 'mini series'],
    match: (domain, textBlob, item) => {
      const d = String(domain || item.domainType || item.category || '').toUpperCase();
      if (d === 'MINISERIES' || item.sourceKey === 'narto' || item.isNarto) return true;
      if (d === 'MOVIE' || d === '0') return false;
      return textBlob.includes('short drama') || textBlob.includes('shorts') || textBlob.includes('dramabox') || textBlob.includes('miniseries');
    }
  }
};

const REGION_CONFIG = {
  '61': {
    name: 'America',
    queries: ['hollywood', 'american', 'usa movie', 'us series'],
    terms: ['us', 'usa', 'america', 'american', 'hollywood', 'western', 'united states'],
    match: (textBlob, item) => item.sourceKey === 'hollywood' || textBlob.includes('hollywood') || textBlob.includes('america') || textBlob.includes('american') || textBlob.includes('usa') || (item.sourceKey === 'loklok' && !textBlob.includes('korea') && !textBlob.includes('japan') && !textBlob.includes('china') && !textBlob.includes('thai') && !textBlob.includes('filipino') && !textBlob.includes('indonesian') && !textBlob.includes('indian'))
  },
  '53': {
    name: 'Korea',
    queries: ['korean drama', 'k-drama', 'korean movie', 'korean show', 'korea'],
    terms: ['korea', 'korean', 'k-drama', 'kdrama', 'seoul', 'south korea'],
    match: (textBlob, item) => textBlob.includes('korea') || textBlob.includes('korean') || textBlob.includes('k-drama') || textBlob.includes('kdrama') || textBlob.includes('seoul')
  },
  '60': {
    name: 'U.K',
    queries: ['british', 'uk series', 'bbc drama', 'london movie', 'england'],
    terms: ['uk', 'u.k', 'british', 'england', 'united kingdom', 'london', 'bbc'],
    match: (textBlob, item) => textBlob.includes('british') || textBlob.includes('uk') || textBlob.includes('u.k') || textBlob.includes('england') || textBlob.includes('bbc') || textBlob.includes('london')
  },
  '44': {
    name: 'Japan',
    queries: ['japanese anime', 'japanese drama', 'japanese movie', 'tokyo'],
    terms: ['japan', 'japanese', 'anime', 'tokyo', 'manga'],
    match: (textBlob, item) => item.sourceKey === 'anime' || textBlob.includes('japan') || textBlob.includes('japanese') || textBlob.includes('anime') || textBlob.includes('tokyo') || textBlob.includes('manga')
  },
  '57': {
    name: 'Thailand',
    queries: ['thai drama', 'thai movie', 'thailand series', 'bangkok'],
    terms: ['thailand', 'thai', 'bangkok'],
    match: (textBlob, item) => textBlob.includes('thai') || textBlob.includes('thailand') || textBlob.includes('bangkok')
  },
  '37': {
    name: 'Europe',
    queries: ['european movie', 'french cinema', 'spanish drama', 'german movie'],
    terms: ['europe', 'european', 'france', 'french', 'germany', 'german', 'spain', 'spanish', 'italy', 'italian'],
    match: (textBlob, item) => textBlob.includes('europe') || textBlob.includes('european') || textBlob.includes('french') || textBlob.includes('german') || textBlob.includes('spanish') || textBlob.includes('italian')
  },
  '37,60,58,50,54,55': {
    name: 'Europe',
    queries: ['european movie', 'french cinema', 'spanish drama', 'german movie', 'british drama'],
    terms: ['europe', 'european', 'france', 'french', 'germany', 'german', 'spain', 'spanish', 'italy', 'italian', 'uk', 'british'],
    match: (textBlob, item) => textBlob.includes('europe') || textBlob.includes('european') || textBlob.includes('french') || textBlob.includes('german') || textBlob.includes('spanish') || textBlob.includes('italian') || textBlob.includes('british') || textBlob.includes('uk')
  },
  '32,56': {
    name: 'China',
    queries: ['chinese drama', 'c-drama', 'taiwanese drama', 'hong kong movie', 'mandarin'],
    terms: ['china', 'chinese', 'c-drama', 'cdrama', 'taiwan', 'taiwanese', 'hong kong', 'cantonese', 'mandarin'],
    match: (textBlob, item) => item.sourceKey === 'narto' || item.isNarto || textBlob.includes('china') || textBlob.includes('chinese') || textBlob.includes('c-drama') || textBlob.includes('cdrama') || textBlob.includes('taiwan') || textBlob.includes('hong kong') || textBlob.includes('mandarin')
  },
  '41': {
    name: 'Indonesia',
    queries: ['indonesian movie', 'indonesian drama', 'jakarta film'],
    terms: ['indonesia', 'indonesian', 'jakarta'],
    match: (textBlob, item) => textBlob.includes('indonesia') || textBlob.includes('indonesian') || textBlob.includes('jakarta')
  },
  '34': {
    name: 'Philippines',
    queries: ['filipino movie', 'pinoy drama', 'tagalog series', 'philippines'],
    terms: ['philippines', 'filipino', 'pinoy', 'tagalog', 'manila'],
    match: (textBlob, item) => textBlob.includes('philippines') || textBlob.includes('filipino') || textBlob.includes('pinoy') || textBlob.includes('tagalog') || textBlob.includes('manila')
  },
  '40': {
    name: 'India',
    queries: ['bollywood movie', 'hindi drama', 'indian movie', 'tamil cinema'],
    terms: ['india', 'indian', 'bollywood', 'hindi', 'tamil', 'telugu'],
    match: (textBlob, item) => textBlob.includes('india') || textBlob.includes('indian') || textBlob.includes('bollywood') || textBlob.includes('hindi') || textBlob.includes('tamil') || textBlob.includes('telugu')
  },
  '27': {
    name: 'Australia',
    queries: ['australian movie', 'australia series', 'sydney film'],
    terms: ['australia', 'australian', 'sydney'],
    match: (textBlob, item) => textBlob.includes('australia') || textBlob.includes('australian') || textBlob.includes('sydney')
  },
  '26,28,29,30': { name: 'Other', queries: [], terms: [], match: () => true }
};

const GENRE_CONFIG = {
  '10': { name: 'Romance', queries: ['romance', 'love story', 'romantic', 'dating', 'marriage'], terms: ['romance', 'romantic', 'love', 'dating', 'marriage', 'lover', 'heart', 'affair', 'billionaire', 'crush', 'wedding', 'sweet', 'kiss'] },
  '1': { name: 'Action', queries: ['action movie', 'fight battle', 'martial arts', 'kung fu', 'combat', 'superhero'], terms: ['action', 'fight', 'battle', 'warrior', 'avengers', 'martial', 'kung fu', 'combat', 'gun', 'sniper', 'hero', 'superhero', 'mission'] },
  '13': { name: 'Fantasy', queries: ['fantasy magic', 'supernatural', 'dragon demon', 'reborn immortal'], terms: ['fantasy', 'magic', 'dragon', 'demon', 'reborn', 'god', 'immortal', 'fairy', 'witch', 'wizard', 'supernatural', 'curse', 'titan', 'jujutsu', 'slayer', 'myth'] },
  '23': { name: 'Animation', queries: ['anime animation', 'animated movie', 'cartoon', 'pixar disney'], terms: ['animation', 'animated', 'anime', 'cartoon', 'comic', 'disney', 'pixar', 'manga'] },
  '16': { name: 'Suspense', queries: ['suspense mystery', 'detective investigation', 'secret truth', 'murder mystery'], terms: ['suspense', 'mystery', 'detective', 'secret', 'investigation', 'clue', 'puzzle', 'murder', 'killer', 'disappearance', 'truth'] },
  '19': { name: 'Sci-Fi', queries: ['sci-fi space', 'alien galaxy', 'cyber future', 'robot ai', 'time travel'], terms: ['sci-fi', 'scifi', 'science fiction', 'space', 'alien', 'cyber', 'future', 'robot', 'galaxy', 'planet', 'universe', 'time travel', 'ai', 'matrix'] },
  '5': { name: 'Horror', queries: ['horror ghost', 'zombie dead', 'evil demon', 'scary haunted'], terms: ['horror', 'ghost', 'zombie', 'dead', 'evil', 'scary', 'haunted', 'demon', 'creepy', 'curse', 'monster', 'blood', 'fear'] },
  '6': { name: 'Comedy', queries: ['comedy funny', 'hilarious parody', 'humor sitcom'], terms: ['comedy', 'funny', 'hilarious', 'humor', 'joke', 'laugh', 'comic', 'parody', 'sitcom', 'fun'] },
  '2': { name: 'Crime', queries: ['crime mafia', 'police detective', 'gangster boss', 'heist robbery'], terms: ['crime', 'criminal', 'police', 'cop', 'mafia', 'boss', 'gangster', 'detective', 'prison', 'jail', 'heist', 'robbery', 'underworld', 'drug'] },
  '3': { name: 'Adventure', queries: ['adventure quest', 'treasure journey', 'island jungle', 'wilderness expedition'], terms: ['adventure', 'quest', 'journey', 'treasure', 'explore', 'island', 'jungle', 'expedition', 'survive', 'wilderness'] },
  '9': { name: 'Thriller', queries: ['psychological thriller', 'stalker escape', 'danger hostage trap'], terms: ['thriller', 'stalker', 'escape', 'trap', 'hostage', 'danger', 'chase', 'dark', 'tension', 'twisted', 'psychological'] },
  '64': { name: 'LGBTQ', queries: ['bl drama', 'boys love series', 'gl drama', 'queer romance'], terms: ['lgbtq', 'lgbt', 'queer', 'gay', 'lesbian', 'bl', 'gl', 'boys love', 'girls love', 'rainbow'] },
  '8': { name: 'Drama', queries: ['drama family story', 'emotional life drama'], terms: ['drama', 'family', 'life', 'story', 'emotional', 'tear', 'society', 'conflict', 'destiny'] },
  '24': { name: 'Variety Show', queries: ['variety show', 'reality challenge', 'game show idol', 'running man'], terms: ['variety', 'show', 'game', 'idol', 'reality', 'challenge', 'running man'] },
  '63': { name: 'Family', queries: ['family movie', 'kids children', 'parent home story'], terms: ['family', 'kids', 'children', 'parent', 'mother', 'father', 'home'] },
  '65': { name: 'Musical', queries: ['musical music', 'dance song film', 'band concert'], terms: ['musical', 'music', 'song', 'sing', 'dance', 'band', 'concert'] },
  '14': { name: 'War', queries: ['war battle movie', 'soldier military army', 'wwii historical'], terms: ['war', 'battle', 'soldier', 'military', 'army', 'wwii', 'combat', 'conflict'] },
  '7': { name: 'Catastrophe', queries: ['catastrophe disaster movie', 'earthquake tsunami apocalypse'], terms: ['catastrophe', 'disaster', 'earthquake', 'tsunami', 'virus', 'pandemic', 'apocalypse', 'flood'] },
  '25': { name: 'Documentary', queries: ['documentary true story', 'nature wildlife bbc', 'history biography'], terms: ['documentary', 'history', 'nature', 'biography', 'wildlife', 'true story'] },
  '20': { name: 'Other', queries: [], terms: [] }
};

const GENRE_MAP = Object.fromEntries(Object.entries(GENRE_CONFIG).map(([k, v]) => [k, (v.queries && v.queries[0]) || v.name.toLowerCase()]));
const AREA_KEYWORDS = Object.fromEntries(Object.entries(REGION_CONFIG).map(([k, v]) => [k, v.terms]));

function filterAndSortCategoryResults(results, { params = '', area = '', category = '', order = 'count', source = '', keyword = '' }) {
  if (!Array.isArray(results) || results.length === 0) return [];

  const genreInfo = GENRE_CONFIG[category] || (category ? { name: category, terms: [category.toLowerCase()] } : null);
  const regionInfo = REGION_CONFIG[area] || (area ? { name: area, terms: [area.toLowerCase()], match: (t) => t.includes(area.toLowerCase()) } : null);
  const typeInfo = TYPE_CONFIG[params] || null;

  let filtered = results.filter(item => {
    if (!item || !item.id) return false;
    const title = String(item.title || item.name || '').toLowerCase();
    const domain = String(item.domainType || '').toUpperCase();
    const itemCat = String(item.category || item.categoryName || '').toLowerCase();
    const srcName = String(item.sourceName || '').toLowerCase();
    const srcKey = String(item.sourceKey || '').toLowerCase();
    const tags = (Array.isArray(item.tags) ? item.tags.join(' ') : String(item.genres || '')).toLowerCase();
    const desc = String(item.description || '').toLowerCase();
    const textBlob = `${title} ${tags} ${desc} ${itemCat} ${srcName} ${srcKey}`;

    // Keyword filter inside category/source
    if (keyword && keyword.trim()) {
      const kwWords = keyword.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const isKwMatch = kwWords.every(w => textBlob.includes(w));
      if (!isKwMatch) return false;
    }

    // Source Filter
    if (source && source !== 'all') {
      const sLower = source.toLowerCase();
      if (sLower === 'adult') {
        if (!item.isAdult && !srcKey.includes('hstream') && !srcKey.includes('hentaimama') && !srcKey.includes('adult')) return false;
      } else {
        if (!srcKey.includes(sLower) && !srcName.includes(sLower)) return false;
      }
    }

    // When adult source is specifically selected, bypass regular mainstream category filters
    if (source && source.toLowerCase() === 'adult') return true;

    // 1. Exact Type Filter
    if (typeInfo && typeof typeInfo.match === 'function') {
      if (!typeInfo.match(domain, textBlob, item)) return false;
    }

    // 2. Region Filter
    if (regionInfo) {
      if (typeof regionInfo.match === 'function') {
        if (!regionInfo.match(textBlob, item)) return false;
      } else if (regionInfo.terms && regionInfo.terms.length > 0) {
        if (!regionInfo.terms.some(t => textBlob.includes(t))) return false;
      }
    }

    // 3. Genre Filter
    if (genreInfo && genreInfo.terms && genreInfo.terms.length > 0) {
      const isGenreMatched = genreInfo.terms.some(t => textBlob.includes(t));
      if (!isGenreMatched) return false;
    }

    return true;
  });

  // 4. Sort Order
  if (order === 'score') {
    filtered.sort((a, b) => parseFloat(b.score || '8.0') - parseFloat(a.score || '8.0'));
  } else if (order === 'up') {
    filtered.sort((a, b) => String(b.id || '').localeCompare(String(a.id || '')));
  } else {
    filtered.sort((a, b) => parseFloat(b.score || '8.0') - parseFloat(a.score || '8.0'));
  }

  return filtered;
}

// In-Memory RAM Cache for Search (60s TTL)
const searchCache = new Map();
const SEARCH_CACHE_TTL = 60 * 1000;

async function searchHandler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const rawToken = (req.headers ? req.headers.token : '') || req.query.token || '';
    const token = sanitizeToken(rawToken);
    const headers = getLoklokHeaders(token);

    const keyword = req.query.q || req.query.keyword || (req.body && (req.body.q || req.body.keyword)) || '';
    const page = req.query.page || (req.body && req.body.page) || 0;
    const isFast = req.query.fast === 'true';
    const reqSource = (req.query.source || (req.body && req.body.source) || '').toLowerCase();

    const cacheKey = `search_${keyword || ''}_${req.query.params || ''}_${req.query.area || ''}_${req.query.category || ''}_${req.query.source || ''}_${page || '0'}_${req.query.order || ''}_${req.query.fast || ''}`;
    const cached = searchCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < SEARCH_CACHE_TTL)) {
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=180');
      return res.status(200).json(cached.data);
    }

    const pageSize = 12;

    let vivaItems = [];

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

          const [loklokRes, nartoRes, hwRes] = await Promise.allSettled([
            loklokFetch('/search/v1/searchWithKeyWord', {
              method: 'POST',
              headers: { ...headers, 'Content-Type': 'application/json' },
              body: JSON.stringify({ searchKeyWord: keyword.trim(), size: 20, sort: '', searchType: '' })
            }),
            fetch(`https://narto-drama.com/search?q=${encodeURIComponent(keyword.trim())}&limit=10&lang=en-US`, {
              headers: getNartoHeaders(),
              signal: AbortSignal.timeout(4000)
            }).then(r => r.json()),
            require('./hollywood').searchHollywood(keyword.trim())
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

          if (hwRes.status === 'fulfilled' && Array.isArray(hwRes.value)) {
            hwRes.value.forEach(hwItem => {
              const itemTitle = hwItem.title || 'Untitled';
              if (!fastResults.some(r => String(r.title).toLowerCase() === itemTitle.toLowerCase())) {
                fastResults.push({
                  id: hwItem.id,
                  category: hwItem.category,
                  title: itemTitle,
                  cover: hwItem.cover,
                  score: hwItem.score || '8.5',
                  domainType: hwItem.domainType,
                  sourceName: 'Hollywood'
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
        return !!(item && (item.name || item.title));
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
      let nartoData = null;
      try {
        const nartoUrl = `https://narto-drama.com/search?q=${encodeURIComponent(keyword.trim())}&limit=20&lang=en-US`;
        const nartoHeaders = getNartoHeaders();
        const nartoRes = await fetch(nartoUrl, { headers: nartoHeaders, signal: AbortSignal.timeout(4000) });
        nartoData = await nartoRes.json();
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
          });
        }
      } catch (nartoErr) {
        debugInfo.nartoError = nartoErr.message;
      }

      // Search Hollywood (TMDB Movies & TV Series)
      let hwRes = [];
      try {
        const hwModule = require('./hollywood');
        hwRes = await hwModule.searchHollywood(keyword.trim());
        if (hwRes && Array.isArray(hwRes)) {
          results.push(...hwRes);
        }
      } catch (hwErr) {
        debugInfo.hollywoodError = hwErr.message;
      }

      // Search Anime
      let animeRes = [];
      try {
        const animeModule = require('./anime-provider');
        animeRes = await animeModule.searchAnime(keyword.trim());
        if (animeRes && Array.isArray(animeRes)) {
          results.push(...animeRes);
        }
      } catch (aniErr) {
        debugInfo.animeError = aniErr.message;
      }

      // Search Asian Drama
      let dramaRes = [];
      try {
        const dramaModule = require('./asian-drama');
        dramaRes = await dramaModule.searchDrama(keyword.trim());
        if (dramaRes && Array.isArray(dramaRes)) {
          results.push(...dramaRes);
        }
      } catch (drErr) {
        debugInfo.dramaError = drErr.message;
      }

      // Search Classics (Only if explicitly requested)
      let classicsRes = [];
      if (reqSource === 'classics') {
        try {
          const classicsModule = require('./classics');
          classicsRes = await classicsModule.searchClassics(keyword.trim());
          if (classicsRes && Array.isArray(classicsRes)) {
            results.push(...classicsRes);
          }
        } catch (clErr) {
          debugInfo.classicsError = clErr.message;
        }
      }

      // Search Adult (if allowAdult === 'true')
      let hsItems = [];
      let hmItems = [];
      const allowAdultParam = req.query.allowAdult || (req.headers ? req.headers.allowadult : '') || '';
      if (allowAdultParam === 'true') {
        try {
          const hstreamModule = require('./hstream');
          const hmamaModule = require('./hentaimama');
          const [hsData, hmData] = await Promise.all([
            hstreamModule.fetchHstreamCatalog(1, 'view-count', keyword.trim()),
            hmamaModule.fetchHentaiMamaCatalog(1, keyword.trim())
          ]);
          if (hsData && Array.isArray(hsData)) {
            hsItems = hsData;
            results.push(...hsData);
          }
          if (hmData && Array.isArray(hmData)) {
            hmItems = hmData;
            results.push(...hmData);
          }
        } catch (adErr) {
          debugInfo.adultError = adErr.message;
        }
      }

      const sourceCounts = {
        loklok: filteredLoklok.length,
        hollywood: (hwRes && Array.isArray(hwRes)) ? hwRes.length : 0,
        narto: (nartoData && Array.isArray(nartoData.items)) ? nartoData.items.length : 0,
        anime: (animeRes && Array.isArray(animeRes)) ? animeRes.length : 0,
        drama: (dramaRes && Array.isArray(dramaRes)) ? dramaRes.length : 0,
        classics: (classicsRes && Array.isArray(classicsRes)) ? classicsRes.length : 0,
        adult: hsItems.length + hmItems.length
      };

      const disableDedup = req.query.dedup === 'false' || req.query.disableDedup === 'true' || req.query.disable_dedup === 'true' || req.query.dedup === '0' || (req.body && (req.body.dedup === 'false' || req.body.disableDedup === 'true' || req.body.disable_dedup === 'true'));

      if (!disableDedup) {
        results = deduplicateResults(results);
      }

      // Relevancy Sorting: exact matches & word-boundary matches first
      const qLower = keyword.trim().toLowerCase();
      const wordRegex = new RegExp('\\b' + qLower.replace(/[^a-z0-9]/g, '') + '\\b', 'i');

      results.sort((a, b) => {
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

      if (reqSource && reqSource !== 'all') {
        results = results.filter(item => {
          const srcKey = String(item.sourceKey || '').toLowerCase();
          const srcName = String(item.sourceName || '').toLowerCase();
          if (reqSource === 'adult') return item.isAdult || srcKey.includes('hstream') || srcKey.includes('hentaimama') || srcKey.includes('adult');
          return srcKey.includes(reqSource) || srcName.includes(reqSource);
        });
      }

      console.log(`🔍 [Search Dispatch] Query: "${keyword.trim()}" | Source: ${reqSource || 'all'} | Loklok: ${sourceCounts.loklok} | Hollywood: ${sourceCounts.hollywood} | Narto: ${sourceCounts.narto} | Anime: ${sourceCounts.anime} | Drama: ${sourceCounts.drama} | Total: ${results.length}`);

      const kwPayload = {
        success: true,
        results,
        sourceCounts,
        debugInfo: {
          ...debugInfo,
          sourceCounts,
          total: results.length
        }
      };

      if (results.length > 0) {
        searchCache.set(cacheKey, { timestamp: Date.now(), data: kwPayload });
        if (searchCache.size > 150) {
          const oldest = searchCache.keys().next().value;
          searchCache.delete(oldest);
        }
      }

      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=180');
      return res.status(200).json(kwPayload);

    } else {
      // Category multi-filter search API
      const pageSize = 48;
      const pageIdx = parseInt(page, 10) || 0;

      const rawParams = req.query.params || (req.body && req.body.params) || '';
      const area = req.query.area || (req.body && req.body.area) || '';
      const category = req.query.category || (req.body && req.body.category) || '';
      const year = req.query.year || (req.body && req.body.year) || '';
      const order = req.query.order || (req.body && req.body.order) || 'count';
      const sortCursor = req.query.sort || (req.body && req.body.sort) || '';
      const catKw = req.query.keyword || (req.body && req.body.keyword) || '';

      const filterOpts = { params: rawParams, area, category, order, source: reqSource, keyword: catKw };

      if (reqSource === 'narto') {
        const genreName = GENRE_MAP[category] || category || '';
        let nartoItems = [];
        try {
          const nartoFetch = require('./narto');
          const nartoReq = { url: `/catalog`, query: { q: genreName } };
          const nartoRes = {
            status: function() { return this; },
            json: function(data) { if (data && data.items) nartoItems = data.items; }
          };
          await nartoFetch(nartoReq, nartoRes);
        } catch (_) {}

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

        let mapped = nartoItems.map(nItem => ({
          id: maskId('narto', nItem.id),
          category: '1',
          title: (nItem.title || '').replace(/^\[narto\]\s*/i, '').trim(),
          cover: nItem.cover,
          score: '9.0',
          domainType: 'SHORT',
          sourceName: 'Narto Drama',
          sourceKey: 'narto',
          isNarto: true,
          tags: ['shorts', 'short drama', 'china', 'korea', 'asian', 'romance', 'billionaire', 'revenge', genreName].filter(Boolean)
        }));

        mapped = filterAndSortCategoryResults(mapped, filterOpts);
        const startIndex = (pageIdx * pageSize) % Math.max(1, mapped.length);
        let pageSlice = mapped.slice(startIndex, startIndex + pageSize);
        let nextCursor = (pageSlice.length > 0 && pageIdx < 6) ? `narto_page_${pageIdx + 1}` : '';
        return res.status(200).json({ success: true, results: pageSlice, nextCursor });

      } else if (reqSource === 'hollywood') {
        let hwItems = [];
        try {
          const hwModule = require('./hollywood');
          const hwRes = await hwModule.fetchHollywoodShelves(pageIdx + 1);
          const list = Array.isArray(hwRes) ? hwRes : (hwRes && hwRes.shelves ? hwRes.shelves : []);
          list.forEach(s => hwItems.push(...(s.items || [])));
        } catch (_) {}
        hwItems = hwItems.map(item => ({
          ...item,
          tags: ['movie', 'america', 'hollywood', 'western', ...(Array.isArray(item.tags) ? item.tags : []), ...(Array.isArray(item.genres) ? item.genres : [])]
        }));
        hwItems = filterAndSortCategoryResults(hwItems, filterOpts);
        return res.status(200).json({ success: true, results: hwItems, nextCursor: '' });

      } else if (reqSource === 'anime') {
        let aniItems = [];
        try {
          const aniModule = require('./anime-provider');
          const aniRes = await aniModule.fetchAnimeShelves();
          const list = Array.isArray(aniRes) ? aniRes : (aniRes && aniRes.shelves ? aniRes.shelves : []);
          list.forEach(s => aniItems.push(...(s.items || [])));
        } catch (_) {}
        aniItems = aniItems.map(item => ({
          ...item,
          tags: ['anime', 'japan', 'animation', ...(Array.isArray(item.tags) ? item.tags : []), ...(Array.isArray(item.genres) ? item.genres : [])]
        }));
        aniItems = filterAndSortCategoryResults(aniItems, filterOpts);
        return res.status(200).json({ success: true, results: aniItems, nextCursor: '' });

      } else if (reqSource === 'drama') {
        let dramaItems = [];
        try {
          const dramaModule = require('./asian-drama');
          const dramaRes = await dramaModule.fetchDramaShelves();
          const list = Array.isArray(dramaRes) ? dramaRes : (dramaRes && dramaRes.shelves ? dramaRes.shelves : []);
          list.forEach(s => dramaItems.push(...(s.items || [])));
        } catch (_) {}
        dramaItems = dramaItems.map(drItem => ({
          ...drItem,
          tags: ['drama', 'series', 'tv', 'korea', 'china', 'japan', 'asian', ...(Array.isArray(drItem.tags) ? drItem.tags : [])]
        }));
        dramaItems = filterAndSortCategoryResults(dramaItems, filterOpts);
        return res.status(200).json({ success: true, results: dramaItems, nextCursor: '' });

      } else if (reqSource === 'classics') {
        let classicsItems = [];
        try {
          const classicsModule = require('./classics');
          const p = pageIdx + 1;
          classicsItems = await classicsModule.fetchClassicsPaginated(p, 'feature_films');
        } catch (_) {}
        classicsItems = filterAndSortCategoryResults(classicsItems, filterOpts);
        const nextCursor = (classicsItems.length > 0 && pageIdx < 6) ? `classics_page_${pageIdx + 1}` : '';
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
        adultItems = filterAndSortCategoryResults(adultItems, filterOpts);
        const nextCursor = (adultItems.length > 0 && pageIdx < 6) ? `adult_page_${pageIdx + 1}` : '';
        return res.status(200).json({ success: true, results: adultItems, nextCursor });
      }

      // Default/All Sources or Loklok Category Multi-Filter
      let searchKwTerms = [];
      const genreEntry = GENRE_CONFIG[category] || null;
      const genreName = genreEntry ? (genreEntry.queries && genreEntry.queries[0] ? genreEntry.queries[0] : genreEntry.name.toLowerCase()) : '';
      const regionEntry = REGION_CONFIG[area] || null;
      const areaName = regionEntry ? (regionEntry.queries && regionEntry.queries[0] ? regionEntry.queries[0] : regionEntry.name.toLowerCase()) : '';
      const typeEntry = TYPE_CONFIG[rawParams] || null;
      const typeName = typeEntry ? typeEntry.name : '';

      // High precision combination queries
      if (areaName && genreName && typeName) searchKwTerms.push(`${areaName} ${genreName} ${typeName}`);
      if (areaName && genreName) searchKwTerms.push(`${areaName} ${genreName}`);
      if (genreName && typeName) searchKwTerms.push(`${genreName} ${typeName}`);
      if (areaName && typeName) searchKwTerms.push(`${areaName} ${typeName}`);

      // Anchor queries for specific type
      if (typeEntry && Array.isArray(typeEntry.queries)) {
        searchKwTerms.push(...typeEntry.queries);
      }
      // Anchor queries for specific genre
      if (genreEntry && Array.isArray(genreEntry.queries)) {
        searchKwTerms.push(...genreEntry.queries);
      }
      // Anchor queries for specific region
      if (regionEntry && Array.isArray(regionEntry.queries)) {
        searchKwTerms.push(...regionEntry.queries);
      }

      if (searchKwTerms.length === 0) {
        searchKwTerms.push(
          'movie', 'film', 'drama', 'series', 'k-drama', 'c-drama',
          'anime', 'animation', 'action', 'romance', 'comedy', 'thriller',
          'horror', 'sci-fi', 'fantasy', 'adventure', 'mystery', 'crime',
          'Demon Slayer', 'Attack on Titan', 'Crash Landing on You', 'Queen of Tears',
          'Avengers', 'Spider-Man', 'Harry Potter'
        );
      }

      const uniqueKws = [...new Set(searchKwTerms)].filter(Boolean).slice(0, 20);

      const loklokPromises = uniqueKws.map(async kw => {
        try {
          const res = await h5ApiSearch(kw);
          if (Array.isArray(res)) {
            return res.map(item => ({
              ...item,
              searchKw: kw
            }));
          }
          return [];
        } catch (_) {
          return [];
        }
      });
      const loklokResultsSettled = await Promise.allSettled(loklokPromises);
      
      let rawResults = [];
      loklokResultsSettled.forEach(r => {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) {
          rawResults.push(...r.value);
        }
      });

      let loklokItems = rawResults.map(item => {
        const itemDomain = item.domainType === 0 ? 'MOVIE' : (item.domainType === 1 ? 'TV' : String(item.domainType || '1'));
        return {
          id: maskId('loklok', item.id),
          category: String(item.category || itemDomain || '1'),
          title: item.name || item.title || 'Untitled',
          cover: fixCoverUrl(item.coverVerticalUrl || item.imageUrl || item.cover || ''),
          score: item.score || null,
          domainType: itemDomain,
          sort: item.sort || '',
          sourceName: 'Loklok HD',
          sourceKey: 'loklok',
          tags: [item.searchKw, genreName, areaName].filter(Boolean)
        };
      });

      if (reqSource === 'loklok') {
        const finalFiltered = filterAndSortCategoryResults(loklokItems, filterOpts);
        const nextCursor = (finalFiltered.length > 0 && pageIdx < 8) ? `loklok_page_${pageIdx + 1}` : '';
        return res.status(200).json({ success: true, results: finalFiltered, nextCursor });
      }

      // ALL SOURCES: query all auxiliary providers in parallel
      let nartoItems = [];
      let hollywoodItems = [];
      let animeItems = [];
      let dramaItems = [];

      const subTasks = [];
      subTasks.push((async () => {
        try {
          const nartoFetch = require('./narto');
          let nItems = [];
          const nartoReq = { url: `/catalog`, query: { q: genreName || 'romance' } };
          const nartoRes = {
            status: function() { return this; },
            json: function(d) { if (d && d.items) nItems = d.items; }
          };
          await Promise.race([
            nartoFetch(nartoReq, nartoRes),
            new Promise(resolve => setTimeout(resolve, 1500))
          ]);
          return { type: 'narto', items: nItems.slice(0, 30).map(nItem => ({
            id: maskId('narto', nItem.id),
            category: '1',
            title: String(nItem.title || '').replace(/^\[narto\]\s*/i, '').trim(),
            cover: nItem.cover,
            score: '9.0',
            domainType: 'SHORT',
            sourceName: 'Narto Drama',
            sourceKey: 'narto',
            isNarto: true,
            tags: ['shorts', 'short drama', 'china', 'korea', 'asian', 'romance', 'billionaire', 'revenge', genreName].filter(Boolean)
          })) };
        } catch (_) { return null; }
      })());

      subTasks.push((async () => {
        try {
          const hwModule = require('./hollywood');
          const hwRes = await Promise.race([
            hwModule.fetchHollywoodShelves(pageIdx + 1),
            new Promise(r => setTimeout(() => r([]), 1500))
          ]);
          const list = Array.isArray(hwRes) ? hwRes : (hwRes && hwRes.shelves ? hwRes.shelves : []);
          const items = [];
          list.forEach(s => items.push(...(s.items || [])));
          return { type: 'hollywood', items: items.slice(0, 30).map(hwItem => ({
            ...hwItem,
            domainType: 'MOVIE',
            category: '0',
            sourceKey: 'hollywood',
            tags: ['movie', 'america', 'hollywood', 'western', ...(Array.isArray(hwItem.tags) ? hwItem.tags : [])]
          })) };
        } catch (_) { return null; }
      })());

      subTasks.push((async () => {
        try {
          const aniModule = require('./anime-provider');
          const aniRes = await Promise.race([
            aniModule.fetchAnimeShelves(),
            new Promise(r => setTimeout(() => r([]), 1500))
          ]);
          const list = Array.isArray(aniRes) ? aniRes : (aniRes && aniRes.shelves ? aniRes.shelves : []);
          const items = [];
          list.forEach(s => items.push(...(s.items || [])));
          return { type: 'anime', items: items.slice(0, 30).map(aniItem => ({
            ...aniItem,
            domainType: 'COMIC',
            category: 'COMIC',
            sourceKey: 'anime',
            tags: ['anime', 'japan', 'animation', ...(Array.isArray(aniItem.tags) ? aniItem.tags : [])]
          })) };
        } catch (_) { return null; }
      })());

      subTasks.push((async () => {
        try {
          const dramaModule = require('./asian-drama');
          const dramaRes = await Promise.race([
            dramaModule.fetchDramaShelves(),
            new Promise(r => setTimeout(() => r([]), 1500))
          ]);
          const list = Array.isArray(dramaRes) ? dramaRes : (dramaRes && dramaRes.shelves ? dramaRes.shelves : []);
          const items = [];
          list.forEach(s => items.push(...(s.items || [])));
          return { type: 'drama', items: items.slice(0, 30).map(drItem => ({
            ...drItem,
            domainType: 'TV',
            category: '1',
            sourceKey: 'drama',
            tags: ['drama', 'series', 'tv', 'korea', 'china', 'japan', 'asian', ...(Array.isArray(drItem.tags) ? drItem.tags : [])]
          })) };
        } catch (_) { return null; }
      })());

      const settledSub = await Promise.allSettled(subTasks);
      settledSub.forEach(s => {
        if (s.status === 'fulfilled' && s.value) {
          if (s.value.type === 'narto') nartoItems = s.value.items;
          else if (s.value.type === 'hollywood') hollywoodItems = s.value.items;
          else if (s.value.type === 'anime') animeItems = s.value.items;
          else if (s.value.type === 'drama') dramaItems = s.value.items;
        }
      });

      let combinedResults = [
        ...loklokItems,
        ...nartoItems,
        ...hollywoodItems,
        ...animeItems,
        ...dramaItems
      ];

      const disableDedup = req.query.dedup === 'false' || req.query.disableDedup === 'true' || req.query.disable_dedup === 'true' || req.query.dedup === '0' || (req.body && (req.body.dedup === 'false' || req.body.disableDedup === 'true' || req.body.disable_dedup === 'true'));

      const finalItems = disableDedup ? combinedResults : robustDeduplicate(combinedResults);
      const finalFiltered = filterAndSortCategoryResults(finalItems, filterOpts);

      let nextCursor = (finalFiltered.length > 0 && pageIdx < 8) ? `page_${pageIdx + 1}` : '';
      const payload = { success: true, results: finalFiltered, nextCursor };

      searchCache.set(cacheKey, { timestamp: Date.now(), data: payload });
      if (searchCache.size > 150) {
        const oldestKey = searchCache.keys().next().value;
        searchCache.delete(oldestKey);
      }

      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=180');
      return res.status(200).json(payload);
    }
  } catch (error) {
    console.error('API search handler error:', error.message);
    return res.status(200).json({ success: true, results: [], error: error.message });
  }
};

searchHandler.H5_RSA_PUBLIC_KEY = H5_RSA_PUBLIC_KEY;
searchHandler.h5GenKey = h5GenKey;
searchHandler.h5GetSign = h5GetSign;
searchHandler.h5RsaEncrypt = h5RsaEncrypt;
searchHandler.h5ApiSearch = h5ApiSearch;

module.exports = searchHandler;
