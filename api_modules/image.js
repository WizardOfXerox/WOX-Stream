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

    const decodedUrl = decodeURIComponent(rawUrl);
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

    // 4. Fetch from upstream CDN if not cached with identity rotation
    const upstreamHeaders = getLoklokHeaders();
    if (decodedUrl.includes('narto-drama.com') || decodedUrl.includes('netshort.com')) {
      upstreamHeaders['Referer'] = 'https://narto-drama.com/';
    } else {
      upstreamHeaders['Referer'] = 'https://www.loklok.com/';
    }

    const imageResponse = await fetch(decodedUrl, {
      headers: upstreamHeaders
    });

    if (!imageResponse.ok) {
      return res.status(imageResponse.status).end('Image fetch failed');
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

  } catch (error) {
    return res.status(500).end(error.message);
  }
};
