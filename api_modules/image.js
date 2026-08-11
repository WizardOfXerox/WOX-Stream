const { setCorsHeaders, getLoklokHeaders } = require('./_utils');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// High-Performance In-Memory LRU Image Cache (RAM)
const memoryCache = new Map();
const MAX_MEM_ITEMS = 500; // Store up to 500 images in RAM for <1ms response

// Disk Cache Directory
const cacheDir = path.join(os.tmpdir(), 'loklok_img_cache');
if (!fs.existsSync(cacheDir)) {
  try { fs.mkdirSync(cacheDir, { recursive: true }); } catch (_) {}
}

function getCacheKey(url) {
  return crypto.createHash('md5').update(url).digest('hex');
}

module.exports = async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const rawUrl = req.query.url;
    if (!rawUrl) {
      return res.status(400).end('Missing image URL');
    }

    let decodedUrl = rawUrl;
    while (typeof decodedUrl === 'string' && (decodedUrl.includes('/api/image') || decodedUrl.includes('%2Fapi%2Fimage'))) {
      const match = decodedUrl.match(/[?&]url=([^&]+)/);
      if (match) {
        try { decodedUrl = decodeURIComponent(match[1]); } catch (_) { break; }
      } else {
        break;
      }
    }

    for (let i = 0; i < 5; i++) {
      if (typeof decodedUrl === 'string' && (decodedUrl.startsWith('http%3A') || decodedUrl.startsWith('https%3A') || decodedUrl.startsWith('http%253A') || decodedUrl.startsWith('https%253A'))) {
        try { decodedUrl = decodeURIComponent(decodedUrl); } catch (_) { break; }
      } else {
        break;
      }
    }

    while (/^https?:\/\/img\.chhhn\.com\/https?:\/\//i.test(decodedUrl)) {
      decodedUrl = decodedUrl.replace(/^https?:\/\/img\.chhhn\.com\//i, '');
    }

    decodedUrl = String(decodedUrl)
      .replace('img.snssb.com', 'img.chhhn.com')
      .replace('pic.loklok.tv', 'img.chhhn.com')
      .replace('image.loklok.tv', 'img.chhhn.com')
      .replace('img.loklok.tv', 'img.chhhn.com');

    while (/^https?:\/\/img\.chhhn\.com\/https?:\/\//i.test(decodedUrl)) {
      decodedUrl = decodedUrl.replace(/^https?:\/\/img\.chhhn\.com\//i, '');
    }

    try {
      decodedUrl = new URL(decodedUrl).href;
    } catch (_) {
      try {
        decodedUrl = new URL(decodeURIComponent(decodedUrl)).href;
      } catch (_) {
        decodedUrl = encodeURI(decodedUrl);
      }
    }

    const key = getCacheKey(decodedUrl);
    const etag = `"${key}"`;

    // 1. Check ETag (If browser already cached it)
    if (req.headers['if-none-match'] === etag) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('ETag', etag);
      return res.status(304).end();
    }

    // 2. Check RAM Memory Cache (<1ms Instant Response)
    if (memoryCache.has(key)) {
      const cached = memoryCache.get(key);
      res.setHeader('Content-Type', cached.contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('ETag', etag);
      return res.end(cached.buffer);
    }

    // 3. Check Disk Cache
    const diskPath = path.join(cacheDir, key);
    const metaPath = path.join(cacheDir, `${key}.json`);

    if (fs.existsSync(diskPath) && fs.existsSync(metaPath)) {
      try {
        const buffer = fs.readFileSync(diskPath);
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

        // Store in RAM for next request
        if (memoryCache.size >= MAX_MEM_ITEMS) {
          const firstKey = memoryCache.keys().next().value;
          memoryCache.delete(firstKey);
        }
        memoryCache.set(key, { buffer, contentType: meta.contentType });

        res.setHeader('Content-Type', meta.contentType);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('ETag', etag);
        return res.end(buffer);
      } catch (_) {}
    }

    // 4. Fetch from upstream CDN with clean browser headers
    const upstreamHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Sec-Fetch-Dest': 'image',
      'Sec-Fetch-Mode': 'no-cors',
      'Sec-Fetch-Site': 'cross-site'
    };

    try {
      const imageResponse = await fetch(decodedUrl, {
        headers: upstreamHeaders,
        signal: AbortSignal.timeout(6000)
      });

      if (!imageResponse.ok) {
        // Return styled fallback SVG instead of broken 404
        const svgFallback = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#1e1b4b"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><circle cx="150" cy="200" r="36" fill="#312e81" opacity="0.8"/><path d="M142 184 L164 200 L142 216 Z" fill="#818cf8"/><text x="50%" y="270" fill="#94a3b8" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="600" text-anchor="middle" letter-spacing="1.5">WOX STREAM</text></svg>`;
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.end(svgFallback);
      }

      const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
      const arrayBuffer = await imageResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Save to RAM
      if (memoryCache.size >= MAX_MEM_ITEMS) {
        const firstKey = memoryCache.keys().next().value;
        memoryCache.delete(firstKey);
      }
      memoryCache.set(key, { buffer, contentType });

      // Save to Disk Cache asynchronously
      try {
        fs.writeFile(diskPath, buffer, () => {});
        fs.writeFile(metaPath, JSON.stringify({ contentType }), () => {});
      } catch (_) {}

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('ETag', etag);
      return res.end(buffer);
    } catch (_) {
      const svgFallback = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#1e1b4b"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><circle cx="150" cy="200" r="36" fill="#312e81" opacity="0.8"/><path d="M142 184 L164 200 L142 216 Z" fill="#818cf8"/><text x="50%" y="270" fill="#94a3b8" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="600" text-anchor="middle" letter-spacing="1.5">WOX STREAM</text></svg>`;
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.end(svgFallback);
    }

  } catch (error) {
    const svgFallback = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450"><rect width="100%" height="100%" fill="#0f172a"/><text x="50%" y="50%" fill="#64748b" font-family="system-ui, sans-serif" font-size="14" text-anchor="middle">WOX STREAM</text></svg>`;
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.end(svgFallback);
  }
};
