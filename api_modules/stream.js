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

    let targetUrlString = rawUrl;
    if (typeof targetUrlString === 'string' && (targetUrlString.startsWith('http%3A') || targetUrlString.startsWith('https%3A') || targetUrlString.startsWith('http%253A') || targetUrlString.startsWith('https%253A'))) {
      try { targetUrlString = decodeURIComponent(targetUrlString); } catch (_) {}
    }
    const targetUrl = new URL(targetUrlString);
    const cleanPath = targetUrl.pathname.toLowerCase();

    const isNartoStream = targetUrlString.includes('narto-drama.com') || targetUrlString.includes('mydramawave.com') || targetUrlString.includes('netshort.com');
    let customReferer = req.query.referer ? decodeURIComponent(req.query.referer) : '';
    if (!customReferer) {
      const host = targetUrl.hostname.toLowerCase();
      if (host.includes('narto-drama.com') || host.includes('mydramawave.com') || host.includes('netshort.com')) {
        customReferer = 'https://narto-drama.com/';
      } else if (host.includes('ane-h.xyz') || host.includes('shoujo-h.org') || host.includes('hstream')) {
        customReferer = 'https://hstream.moe/';
      } else if (host.includes('gdvid.info') || host.includes('hentaimama')) {
        customReferer = 'https://hentaimama.io/';
      } else if (host.includes('vidsrc') || host.includes('cloudorchestranova') || host.includes('comityofcognomen')) {
        customReferer = 'https://cloudorchestranova.com/';
      }
    }

    const fetchHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9'
    };

    if (customReferer) {
      fetchHeaders['Referer'] = customReferer;
      try { fetchHeaders['Origin'] = new URL(customReferer).origin; } catch (_) {}
    }

    if (req.headers.range) {
      fetchHeaders['Range'] = req.headers.range;
    }

    const streamResponse = await fetch(targetUrlString, {
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
      const refQuery = customReferer ? `&referer=${encodeURIComponent(customReferer)}` : '';

      // Rewrite relative segment lines and tag URIs to route via /api/stream proxy
      const rewrittenM3u8 = m3u8Text.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
          // Handle URI="..." in #EXT-X-MEDIA and #EXT-X-STREAM-INF tags
          if (trimmed.includes('URI=')) {
            return line.replace(/URI=["']([^"']+)["']/g, (match, p1) => {
              let fullSeg = p1.startsWith('http') ? p1 : (p1.startsWith('/') ? targetUrl.origin + p1 : baseUrl + p1);
              return `URI="/api/stream?url=${encodeURIComponent(fullSeg)}${refQuery}"`;
            });
          }
          return line;
        }
        let fullSegmentUrl = trimmed;
        if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
          fullSegmentUrl = trimmed.startsWith('/') ? targetUrl.origin + trimmed : baseUrl + trimmed;
        }
        if (targetUrl.search && !fullSegmentUrl.includes('?')) {
          fullSegmentUrl += targetUrl.search;
        } else if (targetUrl.search && fullSegmentUrl.includes('?')) {
          fullSegmentUrl += '&' + targetUrl.search.substring(1);
        }
        return `/api/stream?url=${encodeURIComponent(fullSegmentUrl)}${refQuery}`;
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
