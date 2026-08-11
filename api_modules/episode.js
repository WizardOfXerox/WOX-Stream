const { getLoklokHeaders, setCorsHeaders, loklokFetch, sanitizeToken, unmaskId } = require('./_utils');

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return 'Unknown size';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

module.exports = async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let rawContentId = req.query.contentId || req.query.id;
    let episodeId = req.query.episodeId || req.query.episode || '1';
    let category = req.query.category || '1';
    let definition = req.query.definition || 'GROOT_HD';

    if (!category || category === 'undefined' || category === 'null') {
      category = '1';
    }

    const rawToken = req.headers.token || req.query.token || '';
    const token = sanitizeToken(rawToken);

    if (!rawContentId || !episodeId || rawContentId === 'undefined' || episodeId === 'undefined') {
      return res.status(400).json({ success: false, error: 'Missing or invalid contentId/episodeId' });
    }

    const { provider, id: contentId } = unmaskId(rawContentId);

    // Delegate Hstream episode stream requests
    if (provider === 'hstream') {
      const hstreamModule = require('./hstream');
      let targetPath = episodeId;
      if (!String(targetPath).startsWith('/hentai/')) {
        const detail = await hstreamModule.getHstreamDetail(rawContentId);
        if (detail && detail.episodes && detail.episodes.length > 0) {
          const ep = detail.episodes.find(e => String(e.episodeNumber) === String(episodeId)) || detail.episodes[0];
          targetPath = ep.id;
        }
      }
      const playInfo = await hstreamModule.getHstreamPlayUrl(targetPath);
      if (playInfo && playInfo.playUrl) {
        return res.status(200).json({
          success: true,
          mediaUrl: playInfo.playUrl,
          playUrl: playInfo.playUrl,
          subtitles: playInfo.subtitles || [],
          qualities: [{ quality: '1080P HD', label: '1080P HD', url: playInfo.playUrl }]
        });
      }
      return res.status(404).json({ success: false, error: 'Hstream video stream not found' });
    }

    // Delegate HentaiMama episode stream requests
    if (provider === 'hentaimama') {
      const hmamaModule = require('./hentaimama');
      let targetPath = episodeId;
      if (!String(targetPath).includes('/episodes/')) {
        const detail = await hmamaModule.getHentaiMamaDetail(rawContentId);
        if (detail && detail.episodes && detail.episodes.length > 0) {
          const ep = detail.episodes.find(e => String(e.episodeNumber) === String(episodeId)) || detail.episodes[0];
          targetPath = ep.id;
        }
      }
      const playInfo = await hmamaModule.getHentaiMamaPlayUrl(targetPath);
      if (playInfo && playInfo.playUrl) {
        return res.status(200).json({
          success: true,
          mediaUrl: playInfo.playUrl,
          playUrl: playInfo.playUrl,
          subtitles: playInfo.subtitles || [],
          qualities: [{ quality: 'HD', url: playInfo.playUrl }]
        });
      }
      return res.status(404).json({ success: false, error: 'HentaiMama video stream not found' });
    }

    // Delegate Hollywood episode stream requests
    if (provider === 'hollywood') {
      const hollywoodModule = require('./hollywood');
      const detailRes = await hollywoodModule.getDetail(rawContentId, req.query);
      if (detailRes && detailRes.embedServers && detailRes.embedServers.length > 0) {
        const { extractStream } = require('./extractors');
        for (const server of detailRes.embedServers) {
          try {
            const extracted = await extractStream(server.url);
            if (extracted && extracted.url) {
              const proxiedUrl = `/api/stream?url=${encodeURIComponent(extracted.url)}&referer=${encodeURIComponent(extracted.referer || '')}`;
              return res.status(200).json({
                success: true,
                playUrl: proxiedUrl,
                mediaUrl: proxiedUrl,
                streamUrl: proxiedUrl,
                streamType: extracted.type || 'hls',
                subtitles: extracted.subtitles || [],
                qualities: [{ quality: 'HD', label: 'HD', url: proxiedUrl }],
                embedServers: detailRes.embedServers
              });
            }
          } catch (_) {}
        }
        const playUrl = detailRes.embedServers[0].url;
        return res.status(200).json({
          success: true,
          playUrl,
          mediaUrl: playUrl,
          streamUrl: playUrl,
          streamType: 'embed',
          embedServers: detailRes.embedServers,
          subtitles: []
        });
      }
      return res.status(404).json({ success: false, error: 'Hollywood stream not found' });
    }

    // Delegate Anime episode stream requests
    if (provider === 'anime') {
      const animeModule = require('./anime-provider');
      const detailRes = await animeModule.getAnimeDetail(rawContentId);
      if (detailRes && detailRes.detail && detailRes.detail.episodes) {
        const ep = detailRes.detail.episodes.find(e => String(e.id) === String(episodeId)) || detailRes.detail.episodes[0];
        const playUrl = ep ? (ep.embedUrl || ep.playUrl) : null;
        if (playUrl) {
          try {
            const { extractStream } = require('./extractors');
            const extracted = await extractStream(playUrl);
            if (extracted && extracted.url) {
              const proxiedUrl = `/api/stream?url=${encodeURIComponent(extracted.url)}&referer=${encodeURIComponent(extracted.referer || '')}`;
              return res.status(200).json({
                success: true,
                playUrl: proxiedUrl,
                mediaUrl: proxiedUrl,
                streamUrl: proxiedUrl,
                streamType: extracted.type || 'hls',
                subtitles: extracted.subtitles || [],
                qualities: [{ quality: 'HD', label: 'HD', url: proxiedUrl }]
              });
            }
          } catch (_) {}
          return res.status(200).json({
            success: true,
            playUrl,
            mediaUrl: playUrl,
            streamUrl: playUrl,
            streamType: 'embed',
            subtitles: []
          });
        }
      }
      return res.status(404).json({ success: false, error: 'Anime stream not found' });
    }

    // Delegate Asian Drama episode stream requests
    if (provider === 'drama') {
      const dramaModule = require('./asian-drama');
      const detailRes = await dramaModule.getDramaDetail(rawContentId);
      if (detailRes && detailRes.detail && detailRes.detail.episodes) {
        const ep = detailRes.detail.episodes.find(e => String(e.id) === String(episodeId)) || detailRes.detail.episodes[0];
        const playUrl = ep ? (ep.embedUrl || ep.playUrl) : null;
        if (playUrl) {
          try {
            const { extractStream } = require('./extractors');
            const extracted = await extractStream(playUrl);
            if (extracted && extracted.url) {
              const proxiedUrl = `/api/stream?url=${encodeURIComponent(extracted.url)}&referer=${encodeURIComponent(extracted.referer || '')}`;
              return res.status(200).json({
                success: true,
                playUrl: proxiedUrl,
                mediaUrl: proxiedUrl,
                streamUrl: proxiedUrl,
                streamType: extracted.type || 'hls',
                subtitles: extracted.subtitles || [],
                qualities: [{ quality: 'HD', label: 'HD', url: proxiedUrl }]
              });
            }
          } catch (_) {}
          return res.status(200).json({
            success: true,
            playUrl,
            mediaUrl: playUrl,
            streamUrl: playUrl,
            streamType: 'embed',
            subtitles: []
          });
        }
      }
      return res.status(404).json({ success: false, error: 'Asian drama stream not found' });
    }

    // Delegate Classics archive stream requests
    if (provider === 'classics') {
      try {
        const url = `https://archive.org/metadata/${contentId}`;
        const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (response.ok) {
          const data = await response.json();
          const files = data.files || [];
          const videoFiles = files.filter(f => {
            if (!f.name) return false;
            const name = f.name.toLowerCase();
            const format = (f.format || '').toLowerCase();
            return format.includes('mpeg') || format.includes('h.264') || format.includes('video') || format.includes('mp4') || name.endsWith('.mp4') || name.endsWith('.ogv') || name.endsWith('.webm') || name.endsWith('.mkv');
          });
          videoFiles.sort((a, b) => (parseInt(b.size, 10) || 0) - (parseInt(a.size, 10) || 0));
          const streamUrl = videoFiles.length > 0 ? `https://archive.org/download/${contentId}/${videoFiles[0].name}` : `https://archive.org/embed/${contentId}`;
          return res.status(200).json({
            success: true,
            playUrl: streamUrl,
            mediaUrl: streamUrl,
            streamUrl: streamUrl,
            streamType: videoFiles.length > 0 ? 'mp4' : 'embed',
            subtitles: [],
            qualities: [{ quality: 'Original HD', label: 'Original HD', url: streamUrl }]
          });
        }
      } catch (_) {}
      return res.status(200).json({
        success: true,
        playUrl: `https://archive.org/embed/${contentId}`,
        mediaUrl: `https://archive.org/embed/${contentId}`,
        streamUrl: `https://archive.org/embed/${contentId}`,
        streamType: 'embed',
        subtitles: []
      });
    }

    // Delegate Narto Drama episode requests to Narto handler
    if (provider === 'narto' || String(rawContentId).startsWith('narto_')) {
      const nartoHandler = require('./narto');
      req.query = req.query || {};
      req.query.slug = contentId.replace(/^narto_/, '');
      req.query.episode = episodeId;
      req.url = `/episode?slug=${encodeURIComponent(req.query.slug)}&episode=${encodeURIComponent(episodeId)}`;
      return nartoHandler(req, res);
    }

    const headers = getLoklokHeaders(token);
    const categoriesToTry = Array.from(new Set([String(category), '0', '1', '2']));
    const definitionsToTry = ['GROOT_FULL_HD', 'GROOT_FD', 'GROOT_HD', 'GROOT_SD', 'GROOT_LD'];
    
    // Fetch episode subtitles and real episode ID from detail API
    let subtitles = [];
    let targetEpId = episodeId;

    const tryExtractSubtitles = async (hdrs) => {
      for (const cat of categoriesToTry) {
        try {
          const detailData = await loklokFetch(`/movieDrama/get?id=${contentId}&category=${cat}`, { headers: hdrs });
          if ((detailData.code === '00000' || detailData.code === '000000') && detailData.data && (detailData.data.episodeVo || detailData.data.name)) {
            const rawEpisodes = Array.isArray(detailData.data.episodeVo) ? detailData.data.episodeVo : (detailData.data.episodeVo ? [detailData.data.episodeVo] : []);
            const targetEp = rawEpisodes.find(ep => String(ep.id) === String(episodeId)) || 
                             rawEpisodes.find(ep => String(ep.seriesNo) === String(episodeId)) || 
                             rawEpisodes[parseInt(episodeId, 10) - 1] || 
                             rawEpisodes[0];
            
            if (targetEp) {
              targetEpId = String(targetEp.id);
              const rawSubs = targetEp.subtitlingList || targetEp.subtitles || detailData.data.subtitlingList || [];
              if (rawSubs && rawSubs.length > 0) {
                subtitles = rawSubs.map(s => ({
                  html: s.language || s.languageAbbr || 'Subtitle',
                  label: s.language || s.languageAbbr || 'Subtitle',
                  lang: s.languageAbbr || s.language || 'en',
                  rawUrl: s.subtitlingUrl || s.url,
                  url: `/api/subtitle?url=${encodeURIComponent(s.subtitlingUrl || s.url)}`
                })).filter(s => s.url);
              }
              return true;
            }
          }
        } catch (_) {}
      }
      return false;
    };

    const subSuccess = await tryExtractSubtitles(headers);
    if (!subSuccess || subtitles.length === 0) {
      await tryExtractSubtitles(getLoklokHeaders(''));
    }

    let rawStreamUrl = '';
    let usedDefinition = definition;
    let fileSize = 0;
    let totalDuration = 0;
    let usedCategory = category;
    let usedEpId = targetEpId || episodeId;

    // Try targetEpId first, with fallback to '0' (Loklok movie ep), original episodeId, and contentId
    const episodeIdsToTry = Array.from(new Set([String(targetEpId), '0', String(episodeId), String(contentId)])).filter(id => id && id !== 'undefined' && id !== 'null');

    const fetchDefinitionStream = async (def, catVal, epIdVal) => {
      try {
        const endpoint = `/media/previewInfo?category=${catVal}&contentId=${contentId}&episodeId=${epIdVal}&definition=${def}`;
        const qRes = await loklokFetch(endpoint, { headers });
        if ((qRes.code === '00000' || qRes.code === '000000') && qRes.data && qRes.data.mediaUrl) {
          return { code: def, size: qRes.data.size || 0, rawStreamUrl: qRes.data.mediaUrl, totalDuration: qRes.data.totalDuration || 0 };
        }
      } catch (_) {}

      try {
        const endpoint = `/media/previewInfo?category=${catVal}&contentId=${contentId}&episodeId=${epIdVal}&definition=${def}`;
        const qRes = await loklokFetch(endpoint, { headers: getLoklokHeaders('') });
        if ((qRes.code === '00000' || qRes.code === '000000') && qRes.data && qRes.data.mediaUrl) {
          return { code: def, size: qRes.data.size || 0, rawStreamUrl: qRes.data.mediaUrl, totalDuration: qRes.data.totalDuration || 0 };
        }
      } catch (_) {}

      return null;
    };

    // Outer loop through category fallbacks (0: Movie, 1: Series, 2: Variety)
    for (const cat of categoriesToTry) {
      for (const epId of episodeIdsToTry) {
        for (const def of definitionsToTry) {
          const resData = await fetchDefinitionStream(def, cat, epId);
          if (resData && resData.rawStreamUrl) {
            rawStreamUrl = resData.rawStreamUrl;
            usedDefinition = def;
            usedCategory = cat;
            usedEpId = epId;
            fileSize = resData.size || 0;
            totalDuration = resData.totalDuration || 0;
            break;
          }
        }
        if (rawStreamUrl) break;
      }
      if (rawStreamUrl) break;
    }

    if (!rawStreamUrl) {
      return res.status(200).json({ success: false, error: 'No media stream URL found for this episode.' });
    }

    // Fetch all available quality definitions for this episode using signed H5 API and fallback headers
    const rawStreamsMap = new Map();
    if (rawStreamUrl) {
      rawStreamsMap.set(rawStreamUrl, {
        code: usedDefinition,
        size: fileSize,
        rawStreamUrl: rawStreamUrl
      });
    }

    const remainingDefs = definitionsToTry.filter(d => d !== usedDefinition);
    for (const def of remainingDefs) {
      const resData = await fetchDefinitionStream(def, usedCategory, usedEpId);
      if (resData && resData.rawStreamUrl && !rawStreamsMap.has(resData.rawStreamUrl)) {
        rawStreamsMap.set(resData.rawStreamUrl, resData);
      }
    }

    // Sort unique stream URLs by size descending (largest bitrate/file size first)
    const sortedStreams = Array.from(rawStreamsMap.values()).sort((a, b) => b.size - a.size);

    const defLabelMap = {
      'GROOT_HD': '1080p Full HD',
      'GROOT_SD': '720p HD',
      'GROOT_FD': '480p SD',
      'GROOT_LD': '360p LD'
    };

    const qualities = sortedStreams.map((item, idx) => {
      const mappedLabel = defLabelMap[item.code] || (idx === 0 ? '1080p Full HD' : idx === 1 ? '720p HD' : idx === 2 ? '480p SD' : '360p LD');
      const proxiedUrl = `/api/stream?url=${encodeURIComponent(item.rawStreamUrl)}`;
      return {
        code: item.code,
        quality: mappedLabel,
        resolution: mappedLabel,
        label: mappedLabel,
        size: item.size,
        sizeFormatted: formatBytes(item.size),
        rawStreamUrl: item.rawStreamUrl,
        url: proxiedUrl,
        streamUrl: proxiedUrl
      };
    });

    // Ensure the default stream URL is the highest quality (largest size) stream
    if (qualities.length > 0 && qualities[0].rawStreamUrl) {
      rawStreamUrl = qualities[0].rawStreamUrl;
      fileSize = qualities[0].size || fileSize;
    }

    const proxiedStreamUrl = `/api/stream?url=${encodeURIComponent(rawStreamUrl)}`;

    return res.status(200).json({
      success: true,
      contentId,
      episodeId,
      category: usedCategory,
      definition: usedDefinition,
      fileSize,
      fileSizeFormatted: formatBytes(fileSize),
      totalDuration,
      rawStreamUrl,
      downloadUrl: rawStreamUrl,
      streamUrl: proxiedStreamUrl,
      playUrl: proxiedStreamUrl,
      subtitles,
      qualities: qualities.length > 0 ? qualities : [{ code: usedDefinition, label: '1080p Full HD', sizeFormatted: formatBytes(fileSize), rawStreamUrl }]
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
