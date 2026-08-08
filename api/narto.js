const { getNartoHeaders, maskId } = require('./_utils');
const NARTO_BASE = 'https://narto-drama.com';

async function nartoFetch(url, isJson = true) {
  const headers = getNartoHeaders();
  const res = await fetch(url, { headers });

  if (!res.ok) {
    throw new Error(`Narto HTTP Error: ${res.status}`);
  }

  return isJson ? await res.json() : await res.text();
}

module.exports = async function nartoHandler(req, res) {
  const rawPath = (req.url || '').split('?')[0];
  const subPath = rawPath.replace(/^\/api\/narto/, '').replace(/^\/api/, '').replace(/^\/narto/, '') || '/';
  const query = req.query || {};

  // 1. Search Endpoint
  if (subPath.startsWith('/search')) {
    try {
      const q = query.q || 'billionaire';
      const limit = query.limit || 50;
      const url = `${NARTO_BASE}/search?q=${encodeURIComponent(q)}&limit=${limit}&lang=en-US`;

      const data = await nartoFetch(url, true);

      if (!data || !data.ok || !Array.isArray(data.items)) {
        return res.json({ success: true, items: [] });
      }

      const items = data.items.map(item => {
        let slug = '';
        if (item.url) {
          const match = item.url.match(/\/detail\/watch\/([^?#]+)/);
          if (match) slug = match[1];
        }

        let cover = item.poster_url || '';
        if (cover.startsWith('/')) cover = NARTO_BASE + cover;

        return {
          id: 'narto_' + (slug || item.id),
          nartoId: item.id,
          slug: slug || String(item.id),
          title: item.title,
          description: item.description,
          cover: cover,
          tags: item.tags || [],
          source: 'Narto Drama',
          categoryName: 'Short Drama',
          isNarto: true
        };
      });

      return res.json({ success: true, items });
    } catch (err) {
      console.error('[Narto API Search Error]:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 2. Catalog Endpoint (Aggregates multiple query term requests for rich catalog discovery)
  if (subPath.startsWith('/catalog')) {
    try {
      const searchTerms = ['billionaire', 'dubbed', 'heiress', 'queen', 'love', 'revenge', 'ceo', 'reborn', 'boss', 'marriage', 'secret', 'doctor', 'wife', 'husband', 'prince', 'princess', 'hidden', 'mafia'];
      // Fetch 3 random terms per request to populate rich diverse items
      const shuffle = searchTerms.sort(() => 0.5 - Math.random());
      const selectedTerms = query.q ? [query.q] : shuffle.slice(0, 4);

      let aggregatedMap = new Map();

      for (const term of selectedTerms) {
        try {
          const url = `${NARTO_BASE}/search?q=${encodeURIComponent(term)}&limit=50&lang=en-US`;
          const data = await nartoFetch(url, true);

          if (data && data.ok && Array.isArray(data.items)) {
            data.items.forEach(item => {
              let slug = '';
              if (item.url) {
                const match = item.url.match(/\/detail\/watch\/([^?#]+)/);
                if (match) slug = match[1];
              }

              let cover = item.poster_url || '';
              if (cover.startsWith('/')) cover = NARTO_BASE + cover;

              const cleanTitle = (item.title || '').replace(/^\[narto\]\s*/i, '').trim();
              const key = slug || item.id || cleanTitle;

              if (!aggregatedMap.has(key)) {
                aggregatedMap.set(key, {
                  id: 'narto_' + (slug || item.id),
                  nartoId: item.id,
                  slug: slug || String(item.id),
                  title: cleanTitle,
                  description: item.description,
                  cover: cover,
                  tags: item.tags || [],
                  source: 'Narto Drama',
                  categoryName: 'Short Drama',
                  isNarto: true
                });
              }
            });
          }
        } catch (_) {}
      }

      const items = Array.from(aggregatedMap.values());
      return res.json({ success: true, items });
    } catch (err) {
      console.error('[Narto API Catalog Error]:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 3. Detail Scraper Endpoint (Extracts ALL episodes, direct MP4 URLs and subtitles)
  if (subPath.startsWith('/detail')) {
    try {
      const urlObj = new URL(req.url || '/', 'http://localhost');
      const slug = req.query?.slug || urlObj.searchParams.get('slug') || req.query?.id || urlObj.searchParams.get('id');
      if (!slug) {
        return res.status(400).json({ success: false, error: 'Missing slug or id parameter' });
      }

      const cleanSlug = slug.replace(/^narto_/, '');
      const detailUrl = `${NARTO_BASE}/detail/watch/${encodeURIComponent(cleanSlug)}?lang=en-US`;

      const html = await nartoFetch(detailUrl, false);

      let title = 'Untitled Short Drama';
      const titleMatch = html.match(/<h1[^>]*class=["']movie-title["'][^>]*>([\s\S]*?)<\/h1>/i);
      if (titleMatch) {
        title = titleMatch[1].replace(/<[^>]+>/g, '').trim();
      } else {
        const ogTitle = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
        if (ogTitle) title = ogTitle[1].replace(' - Free Streaming', '').trim();
      }

      let cover = '';
      const coverMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
      if (coverMatch) {
        cover = coverMatch[1];
        if (cover.startsWith('/')) cover = NARTO_BASE + cover;
      }

      let description = '';
      const descMatch = html.match(/<div[^>]*class=["']movie-desc["'][^>]*>([\s\S]*?)<\/div>/i);
      if (descMatch) {
        description = descMatch[1].trim();
      }

      const rawMatch = html.match(/const\s+episodeItemsRaw\s*=\s*([\s\S]*?);/);
      let episodes = [];

      if (rawMatch) {
        try {
          const rawList = JSON.parse(rawMatch[1]);
          episodes = rawList.map((ep, idx) => {
            let playUrl = ep.play_url || ep.direct_play_url || ep.schema_content_url || '';
            let subUrl = ep.subtitle_url || ep.direct_subtitle_url || '';
            if (subUrl && subUrl.startsWith('/')) subUrl = NARTO_BASE + subUrl;

            const subs = [];
            if (Array.isArray(ep.multi_subtitles)) {
              ep.multi_subtitles.forEach(s => {
                let sUrl = s.subtitle_url || '';
                if (sUrl.startsWith('/')) sUrl = NARTO_BASE + sUrl;
                subs.push({
                  lang: s.language_code || 'en-US',
                  label: s.label || 'English',
                  url: `/api/narto/subtitle?url=${encodeURIComponent(sUrl)}`
                });
              });
            }

            if (subs.length === 0 && subUrl) {
              subs.push({
                lang: 'en-US',
                label: 'English',
                url: `/api/narto/subtitle?url=${encodeURIComponent(subUrl)}`
              });
            }

            const epNum = ep.number || ep.route_episode_number || (idx + 1);
            return {
              id: String(epNum),
              episodeNumber: epNum,
              name: ep.title || `Episode ${epNum}`,
              playUrl: playUrl,
              subtitleUrl: subUrl,
              subtitles: subs,
              isPlayable: ep.is_playable !== false
            };
          });
        } catch (parseErr) {
          console.error('[Narto Detail JSON Parse Error]:', parseErr.message);
        }
      }

      if (episodes.length === 0) {
        const epLinks = html.match(/<a[^>]+class=["']episode-item["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi) || [];
        episodes = epLinks.map((linkHtml, idx) => {
          const numMatch = linkHtml.match(/\/(\d+)\?lang=/);
          const epNum = numMatch ? parseInt(numMatch[1]) : (idx + 1);
          return {
            id: String(epNum),
            episodeNumber: epNum,
            name: `Episode ${epNum}`,
            playUrl: '',
            subtitleUrl: '',
            subtitles: [],
            isPlayable: true
          };
        });
      }

      return res.json({
        success: true,
        detail: {
          id: maskId('narto', cleanSlug),
          slug: cleanSlug,
          title: title,
          cover: cover,
          description: description,
          source: 'Narto Drama',
          episodesCount: episodes.length,
          episodes: episodes
        }
      });

    } catch (err) {
      console.error('[Narto API Detail Error]:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 4. Episode Stream Extractor (fetches signed stream URL & subtitles for active episode)
  if (subPath.startsWith('/episode')) {
    try {
      const urlObj = new URL(req.url || '/', 'http://localhost');
      const slug = (req.query?.slug || urlObj.searchParams.get('slug') || req.query?.id || urlObj.searchParams.get('id') || '').replace(/^narto_/, '');
      const epNum = req.query?.episode || urlObj.searchParams.get('episode') || '1';

      if (!slug) {
        return res.status(400).json({ success: false, error: 'Missing slug parameter' });
      }

      const epUrl = `${NARTO_BASE}/detail/watch/${encodeURIComponent(slug)}/${epNum}?lang=en-US`;
      const html = await nartoFetch(epUrl, false);

      const rawMatch = html.match(/const\s+episodeItemsRaw\s*=\s*([\s\S]*?);/);
      if (!rawMatch) {
        return res.status(404).json({ success: false, error: 'Episode data unavailable' });
      }

      const rawList = JSON.parse(rawMatch[1]);
      const ep = rawList.find(e => Number(e.number || e.route_episode_number) === Number(epNum)) || rawList[Number(epNum) - 1] || rawList[0];

      if (!ep) {
        return res.status(404).json({ success: false, error: 'Episode not found' });
      }

      let playUrl = ep.play_url || ep.direct_play_url || ep.schema_content_url || '';
      let subUrl = ep.subtitle_url || ep.direct_subtitle_url || '';
      if (subUrl && subUrl.startsWith('/')) subUrl = NARTO_BASE + subUrl;

      const subs = [];
      if (Array.isArray(ep.multi_subtitles)) {
        ep.multi_subtitles.forEach(s => {
          let sUrl = s.subtitle_url || '';
          if (sUrl.startsWith('/')) sUrl = NARTO_BASE + sUrl;
          // Proxy through our server to avoid CORS
          subs.push({
            lang: s.language_code || 'en-US',
            label: s.label || 'English',
            url: `/api/narto/subtitle?url=${encodeURIComponent(sUrl)}`
          });
        });
      }

      if (subs.length === 0 && subUrl) {
        subs.push({
          lang: 'en-US',
          label: 'English',
          url: `/api/narto/subtitle?url=${encodeURIComponent(subUrl)}`
        });
      }

      return res.json({
        success: true,
        streamUrl: playUrl,
        subtitles: subs
      });

    } catch (err) {
      console.error('[Narto API Episode Error]:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 5. Subtitle Proxy (fetches from Narto, converts SRT→VTT, serves with correct CORS)
  if (subPath.startsWith('/subtitle')) {
    try {
      const urlObj = new URL(req.url || '/', 'http://localhost');
      const subUrl = query.url || urlObj.searchParams.get('url');
      if (!subUrl) {
        res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
        return res.end('WEBVTT\n\n1\n00:00:00.000 --> 00:00:05.000\n[Subtitle unavailable]');
      }

      const fullUrl = subUrl.startsWith('http') ? subUrl : NARTO_BASE + subUrl;
      const subHeaders = getNartoHeaders();
      subHeaders['Referer'] = NARTO_BASE + '/';

      const response = await fetch(fullUrl, {
        headers: subHeaders
      });

      if (!response.ok) {
        res.statusCode = response.status;
        return res.end('Subtitle fetch failed');
      }

      let content = await response.text();

      // Convert SRT to WebVTT if needed
      if (!content.trim().startsWith('WEBVTT')) {
        // SRT format: numbered blocks with timestamps like 00:00:01,000 --> 00:00:03,500
        content = 'WEBVTT\n\n' + content
          .replace(/\r\n/g, '\n')
          .replace(/\r/g, '\n')
          .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2'); // SRT uses commas, VTT uses dots
      }

      res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.end(content);
    } catch (err) {
      console.error('[Narto Subtitle Proxy Error]:', err.message);
      res.statusCode = 500;
      return res.end('Subtitle proxy error');
    }
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ success: false, error: 'Endpoint not found' }));
};
