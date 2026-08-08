const { setCorsHeaders, getLoklokHeaders, getNartoHeaders, decryptStreamTicket, createStreamTicket } = require('./_utils');

module.exports = async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let rawUrl = req.query.url;
    const ticket = req.query.ticket;

    if (ticket) {
      const decrypted = decryptStreamTicket(ticket);
      if (decrypted) rawUrl = decrypted;
    }

    if (!rawUrl) {
      return res.status(400).end('Missing stream URL or ticket');
    }

    let decodedUrl = decodeURIComponent(rawUrl);
    if (decodedUrl.includes('%25') || decodedUrl.includes('%2b') || decodedUrl.includes('%2B')) {
      try { decodedUrl = decodeURIComponent(decodedUrl); } catch (_) {}
    }
    const targetUrl = new URL(decodedUrl);
    const cleanPath = targetUrl.pathname.toLowerCase();

    const isNartoStream = decodedUrl.includes('narto-drama.com') || decodedUrl.includes('mydramawave.com') || decodedUrl.includes('netshort.com');
    const fetchHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9'
    };

    if (isNartoStream) {
      fetchHeaders['Referer'] = 'https://narto-drama.com/';
    }

    if (req.headers.range) {
      fetchHeaders['Range'] = req.headers.range;
    }

    const streamResponse = await fetch(targetUrl.href, {
      headers: fetchHeaders,
      redirect: 'follow'
    });

    if (!streamResponse.ok) {
      return res.status(streamResponse.status).end(`Stream proxy failed: ${streamResponse.statusText}`);
    }

    const contentType = (streamResponse.headers.get('content-type') || '').toLowerCase();
    const isTsChunk = cleanPath.endsWith('.ts') || contentType.includes('mp2t') || contentType.includes('octet-stream');
    const isM3u8 = (cleanPath.endsWith('.m3u8') || contentType.includes('mpegurl') || contentType.includes('m3u8')) && !isTsChunk;

    if (isM3u8) {
      let m3u8Text = await streamResponse.text();
      
      const rawPath = targetUrl.origin + targetUrl.pathname;
      const baseUrl = rawPath.substring(0, rawPath.lastIndexOf('/') + 1);

      // Rewrite relative segment lines and tag URIs to route via /api/stream proxy
      const rewrittenM3u8 = m3u8Text.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
          // Handle URI="..." in #EXT-X-MEDIA and #EXT-X-STREAM-INF tags
          if (trimmed.includes('URI=')) {
            return line.replace(/URI=["']([^"']+)["']/g, (match, p1) => {
              let fullSeg = p1.startsWith('http') ? p1 : (p1.startsWith('/') ? targetUrl.origin + p1 : baseUrl + p1);
              return `URI="/api/stream?url=${encodeURIComponent(fullSeg)}"`;
            });
          }
          return line;
        }
        let fullSegmentUrl = trimmed;
        if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
          fullSegmentUrl = trimmed.startsWith('/') ? targetUrl.origin + trimmed : baseUrl + trimmed;
        }
        return `/api/stream?url=${encodeURIComponent(fullSegmentUrl)}`;
      }).join('\n');

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      return res.end(rewrittenM3u8);

    } else {
      // Stream raw TS video binary chunks
      const acceptRanges = streamResponse.headers.get('accept-ranges');
      const contentLength = streamResponse.headers.get('content-length');
      const contentRange = streamResponse.headers.get('content-range');

      res.setHeader('Content-Type', 'video/mp2t');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);
      if (contentLength) res.setHeader('Content-Length', contentLength);
      if (contentRange) res.setHeader('Content-Range', contentRange);

      const arrayBuffer = await streamResponse.arrayBuffer();
      return res.end(Buffer.from(arrayBuffer));
    }
  } catch (error) {
    return res.status(500).end(error.message);
  }
};
