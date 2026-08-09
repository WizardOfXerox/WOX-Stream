const crypto = require('crypto');

const LOKLOK_API_BASE = process.env.LOKLOK_PROXY_URL || 'https://wox-stream-proxy.wizardofxerox.workers.dev/cms/app';
const MASK_SECRET = process.env.WOX_MASK_SECRET || 'wox-stream-gateway-secret-2026-v1';

// Dynamic User-Agent Pool
const USER_AGENTS = [
  'Dalvik/2.1.0 (Linux; U; Android 12; SM-G998B Build/SP1A.210812.016)',
  'Dalvik/2.1.0 (Linux; U; Android 13; Pixel 7 Pro Build/TD1A.220804.031)',
  'Mozilla/5.0 (Linux; Android 13; SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.210 Mobile Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
];

// Dynamic Consumer ISP IP Ranges (Southeast Asia & US)
const IP_POOLS = [
  () => `120.28.${Math.floor(Math.random()*254)+1}.${Math.floor(Math.random()*254)+1}`,
  () => `112.198.${Math.floor(Math.random()*254)+1}.${Math.floor(Math.random()*254)+1}`,
  () => `180.190.${Math.floor(Math.random()*254)+1}.${Math.floor(Math.random()*254)+1}`,
  () => `110.54.${Math.floor(Math.random()*254)+1}.${Math.floor(Math.random()*254)+1}`,
  () => `203.177.${Math.floor(Math.random()*254)+1}.${Math.floor(Math.random()*254)+1}`
];

function sanitizeToken(token) {
  if (!token) return '';
  const s = String(token).trim();
  if (s === '1' || s === 'undefined' || s === 'null' || s === '[object Object]' || s.length < 8) {
    return '';
  }
  return s;
}

// Modern Browser User-Agents for Narto Drama & CDN bypass
const BROWSER_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
];

function getNartoHeaders() {
  const randomIp = IP_POOLS[Math.floor(Math.random() * IP_POOLS.length)]();
  const randomUA = BROWSER_USER_AGENTS[Math.floor(Math.random() * BROWSER_USER_AGENTS.length)];
  return {
    'User-Agent': randomUA,
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'X-Requested-With': 'XMLHttpRequest',
    'Referer': 'https://narto-drama.com/',
    'X-Forwarded-For': randomIp,
    'X-Real-IP': randomIp
  };
}

// Stable guest device ID - matches official Tadami Loklok Android client
const GUEST_DEVICE_ID = '60A3305FDAAC489AAF4C7DD33B1483B4';

// Get headers for Loklok API (requires valid Android Tem3 client signature)
function getLoklokHeaders(token = '') {
  const cleanToken = sanitizeToken(token);
  const pool = [
    `171.96.${Math.floor(Math.random()*254)+1}.${Math.floor(Math.random()*254)+1}`,
    `171.97.${Math.floor(Math.random()*254)+1}.${Math.floor(Math.random()*254)+1}`,
    `120.28.${Math.floor(Math.random()*254)+1}.${Math.floor(Math.random()*254)+1}`,
    `180.191.${Math.floor(Math.random()*254)+1}.${Math.floor(Math.random()*254)+1}`
  ];
  const ip = pool[Math.floor(Math.random() * pool.length)];

  // Create deterministic deviceid from token if available, otherwise stable guest device id
  const deviceId = cleanToken 
    ? crypto.createHash('md5').update(cleanToken).digest('hex').toUpperCase() 
    : GUEST_DEVICE_ID;

  const headers = {
    'Accept': 'application/json',
    'lang': 'en',
    'versioncode': '33',
    'clienttype': 'android_tem3',
    'deviceid': deviceId,
    'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 12)',
    'X-Forwarded-For': ip,
    'X-Real-IP': ip,
    'clientip': ip,
    'True-Client-IP': ip,
    'CF-Connecting-IP': ip,
    'X-Client-IP': ip,
    'X-Originating-IP': ip,
    'X-Remote-IP': ip,
    'X-Remote-Addr': ip,
    'Fastly-Client-IP': ip,
    'Forwarded': `for=${ip};proto=https`
  };

  if (cleanToken) {
    headers['token'] = cleanToken;
  }

  return headers;
}

function setCorsHeaders(res) {
  if (typeof res.setHeader === 'function') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, token, wox-token');
  }
}

// Matches Loklok.kt ensureAbsoluteCoverUrl & encodeUrl with RAM/Edge proxy caching
function fixCoverUrl(url) {
  if (!url) return '';
  let fullUrl = url;
  if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
    const path = fullUrl.startsWith('/') ? fullUrl : `/${fullUrl}`;
    fullUrl = `https://img.chhhn.com${path}`;
  } else {
    fullUrl = fullUrl.replace('img.loklok.tv', 'img.chhhn.com')
                     .replace('pic.loklok.tv', 'img.chhhn.com')
                     .replace('image.loklok.tv', 'img.chhhn.com');
  }

  let finalUrl = fullUrl;
  try {
    const schemeAndHost = fullUrl.substring(0, fullUrl.indexOf('://') + 3) + fullUrl.substring(fullUrl.indexOf('://') + 3).split('/')[0];
    const path = fullUrl.substring(fullUrl.indexOf('://') + 3).split('/').slice(1).join('/');
    const encodedPath = path.split('/').map(segment => {
      return encodeURIComponent(segment)
        .replace(/\+/g, '%20')
        .replace(/!/g, '%21')
        .replace(/'/g, '%27')
        .replace(/\(/g, '%28')
        .replace(/\)/g, '%29')
        .replace(/~/g, '%7E');
    }).join('/');
    finalUrl = `${schemeAndHost}/${encodedPath}`;
  } catch (_) {
    finalUrl = encodeURI(fullUrl);
  }

  // Return high-performance proxied & cached image URL
  return `/api/image?url=${encodeURIComponent(finalUrl)}`;
}

const { ProxyAgent } = require('undici');

const phProxyList = [
  'http://113.160.132.26:8080',
  'http://lvobnman:orhvw5gw4blz@64.137.96.74:6641',
  'http://lvobnman:orhvw5gw4blz@142.111.67.146:5611',
  'http://43.133.128.153:16012'
];

async function loklokFetch(endpoint, options = {}) {
  const targetBase = 'https://ga-mobile-api.loklok.tv/cms/app';
  const url = endpoint.startsWith('http') ? endpoint : `${targetBase}${endpoint}`;
  const isSearch = endpoint.includes('searchWithKeyWord') || endpoint.includes('search');
  const defaultHeaders = getLoklokHeaders(options.token || '');
  const headers = { ...defaultHeaders, ...(options.headers || {}) };

  // 1. Direct fetch attempt with 4.5s timeout
  try {
    const res = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body,
      signal: AbortSignal.timeout(4500)
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.code === '00000') return data;
    }
  } catch (_) {}

  // 2. Asian Consumer Proxy dispatch via Undici ProxyAgent
  for (const pUrl of phProxyList) {
    try {
      const dispatcher = new ProxyAgent(pUrl);
      const res = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body: options.body,
        dispatcher,
        signal: AbortSignal.timeout(2000)
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.data && Array.isArray(data.data.searchResults) && data.data.searchResults.length > 0) {
          return data;
        }
      }
    } catch (_) {}
  }

  return { code: '00000', data: { searchResults: [] } };
}

// --- WOX MASKING GATEWAY UTILITIES ---

// 1. Opaque ID Masking (Hides raw provider IDs & domains)
// Provider prefix map for opaque ID masking
const PROVIDER_PREFIXES = {
  loklok: 'wox_l_',
  narto: 'wox_n_',
  hollywood: 'wox_h_',
  anime: 'wox_a_',
  drama: 'wox_d_',
  classics: 'wox_c_',
  adult: 'wox_x_',
  hstream: 'wox_hs_',
  hentaimama: 'wox_hm_',
  vivaone: 'wox_vo_',
  vivamax: 'wox_vm_',
  vivamoviebox: 'wox_vb_'
};

// Reverse map: prefix -> provider
const PREFIX_TO_PROVIDER = Object.fromEntries(
  Object.entries(PROVIDER_PREFIXES).map(([k, v]) => [v, k])
);

function maskId(provider, originalId) {
  if (!originalId) return '';
  const str = String(originalId);
  if (str.startsWith('wox_')) return str; // Already masked
  const prefix = PROVIDER_PREFIXES[provider] || 'wox_l_';
  const encoded = Buffer.from(str).toString('base64url');
  return `${prefix}${encoded}`;
}

function unmaskId(maskedId) {
  if (!maskedId) return { provider: 'loklok', id: '' };
  const str = String(maskedId);
  
  // Check all known prefixes
  for (const [prefix, provider] of Object.entries(PREFIX_TO_PROVIDER)) {
    if (str.startsWith(prefix)) {
      const raw = Buffer.from(str.slice(prefix.length), 'base64url').toString('utf8');
      return { provider, id: raw };
    }
  }
  
  // Legacy prefix handling
  if (str.startsWith('narto_')) {
    return { provider: 'narto', id: str.replace('narto_', '') };
  }
  return { provider: 'loklok', id: str };
}

// 2. Stream Ticket Generator (Encrypts raw target stream URLs into ephemeral WOX stream proxy tickets)
function createStreamTicket(targetStreamUrl, expiresMinutes = 240) {
  if (!targetStreamUrl) return '';
  const payload = JSON.stringify({
    url: targetStreamUrl,
    exp: Date.now() + (expiresMinutes * 60 * 1000)
  });
  const cipher = crypto.createCipheriv('aes-128-cbc', crypto.scryptSync(MASK_SECRET, 'woxsalt', 16), Buffer.alloc(16, 0));
  let encrypted = cipher.update(payload, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `wox_st_${encrypted}`;
}

function decryptStreamTicket(ticket) {
  if (!ticket || !ticket.startsWith('wox_st_')) return null;
  try {
    const hex = ticket.replace('wox_st_', '');
    const decipher = crypto.createDecipheriv('aes-128-cbc', crypto.scryptSync(MASK_SECRET, 'woxsalt', 16), Buffer.alloc(16, 0));
    let decrypted = decipher.update(hex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    const data = JSON.parse(decrypted);
    if (data.exp && Date.now() > data.exp) return null; // Expired
    return data.url;
  } catch (e) {
    return null;
  }
}

// 3. Robust Universal Title Deduplication Engine
function cleanTitleForDeduplication(title) {
  if (!title) return '';
  return String(title)
    // 1. Normalize unicode quotes & brackets
    .replace(/[’‘`´]/g, "'")
    .replace(/[（【]/g, '(')
    .replace(/[）】]/g, ')')
    // 2. Remove provider prefixes
    .replace(/^\[(?:narto|loklok|viva|hollywood|classics|anime|adult)\]\s*/gi, '')
    // 3. Remove language/dub/sub/quality brackets
    .replace(/\s*\([^)]*(?:india|korea|japan|philippines|china|indonesia|thailand|vietnam|us|uk|dub|sub|uncensored|hd|4k|1080p|720p|english|bahasa)[^)]*\)/gi, '')
    // 4. Remove Season & Series suffixes
    .replace(/\s*[-:\s]\s*season\s*\d+/gi, '')
    .replace(/\s*\bseason\s*\d+\b/gi, '')
    .replace(/\s*\bseries\s*\d+\b/gi, '')
    .replace(/\s*\bs\d{1,2}\b/gi, '')
    .replace(/\s*[-:\s]\s*full\s*episodes?\b/gi, '')
    .replace(/\s*[-:\s]\s*\d+\s*$/gi, '') // trailing - 2, : 3
    .replace(/\s*\b\d{4}\b/g, '') // year tags like 2024
    .trim();
}

function normalizeTitleKey(title) {
  const cleaned = cleanTitleForDeduplication(title);
  return cleaned.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function robustDeduplicate(items) {
  if (!Array.isArray(items)) return [];
  const map = new Map();
  const seenIds = new Set();

  for (const item of items) {
    if (!item || !item.title || !item.id) continue;
    if (seenIds.has(item.id)) continue;
    seenIds.add(item.id);

    const normKey = normalizeTitleKey(item.title);
    if (!normKey) continue;

    const currentMirror = {
      id: item.id,
      sourceKey: item.sourceKey || (item.isNarto ? 'narto' : (item.isViva ? 'viva' : 'loklok')),
      sourceName: item.sourceName || (item.isNarto ? 'Narto Drama' : (item.isViva ? 'Viva' : 'Loklok HD')),
      category: item.category
    };

    if (!map.has(normKey)) {
      const cleanDisplayTitle = cleanTitleForDeduplication(item.title) || item.title;
      map.set(normKey, {
        ...item,
        title: cleanDisplayTitle,
        mirrors: item.mirrors && item.mirrors.length > 0 ? item.mirrors : [currentMirror]
      });
    } else {
      const existing = map.get(normKey);
      if (!existing.mirrors) existing.mirrors = [];
      if (!existing.mirrors.some(m => m.id === item.id)) {
        existing.mirrors.push(currentMirror);
      }
      if ((!existing.cover || existing.cover.includes('placeholder')) && item.cover) {
        existing.cover = item.cover;
      }
      if (!existing.score && item.score) {
        existing.score = item.score;
      }
    }
  }

  return Array.from(map.values());
}

const AUTH_SECRET = process.env.WOX_JWT_SECRET || 'wox_stream_cyberpunk_secret_key_2026_x89f!';

function hashPassword(password, salt) {
  if (!salt) salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

function verifyPassword(password, storedSalt, storedHash) {
  if (!storedSalt || !storedHash) {
    // Legacy fallback for plain SHA256 hashes created during initial dev testing
    const legacyHash = crypto.createHash('sha256').update(password).digest('hex');
    return legacyHash === storedHash;
  }
  try {
    const { hash } = hashPassword(password, storedSalt);
    const hashBuf = Buffer.from(hash, 'hex');
    const storedBuf = Buffer.from(storedHash, 'hex');
    if (hashBuf.length !== storedBuf.length) return false;
    return crypto.timingSafeEqual(hashBuf, storedBuf);
  } catch (_) {
    return false;
  }
}

function generateToken(user) {
  const payload = {
    userId: user.id,
    email: user.email,
    username: user.username,
    exp: Date.now() + (30 * 24 * 60 * 60 * 1000)
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', AUTH_SECRET).update(payloadB64).digest('base64url');
  return `${payloadB64}.${signature}`;
}

function parseToken(tokenStr) {
  if (!tokenStr || typeof tokenStr !== 'string' || !tokenStr.includes('.')) return null;
  const parts = tokenStr.split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', AUTH_SECRET).update(payloadB64).digest('base64url');

  try {
    const sigBuf = Buffer.from(signature, 'utf-8');
    const expBuf = Buffer.from(expectedSig, 'utf-8');
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

module.exports = {
  LOKLOK_API_BASE,
  PROVIDER_PREFIXES,
  PREFIX_TO_PROVIDER,
  sanitizeToken,
  getLoklokHeaders,
  getNartoHeaders,
  setCorsHeaders,
  fixCoverUrl,
  loklokFetch,
  maskId,
  unmaskId,
  createStreamTicket,
  decryptStreamTicket,
  cleanTitleForDeduplication,
  normalizeTitleKey,
  robustDeduplicate,
  hashPassword,
  verifyPassword,
  generateToken,
  parseToken
};
