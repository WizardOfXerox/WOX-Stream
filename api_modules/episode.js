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
    let { contentId: rawContentId, episodeId, category = '1', definition = 'GROOT_HD' } = req.query;
    if (!category || category === 'undefined' || category === 'null') {
      category = '1';
    }

    const rawToken = req.headers.token || req.query.token || '';
    const token = sanitizeToken(rawToken);

    if (!rawContentId || !episodeId || rawContentId === 'undefined' || episodeId === 'undefined') {
      return res.status(400).json({ success: false, error: 'Missing or invalid contentId/episodeId' });
    }

    const { provider, id: contentId } = unmaskId(rawContentId);

    // Delegate Viva One / VivaMax / Viva MovieBox episode requests to Viva handler
    if (provider === 'vivaone' || provider === 'vivamax' || provider === 'vivamb' || String(rawContentId).startsWith('viva')) {
      const vivaHandler = require('./viva');
      req.query.action = 'episode';
      req.query.id = rawContentId;
      req.query.episodeId = episodeId;
      return vivaHandler(req, res);
    }

    // Delegate Hstream episode stream requests
    if (provider === 'hstream') {
      const hstreamModule = require('./hstream');
      const playInfo = await hstreamModule.getHstreamPlayUrl(episodeId);
      if (playInfo && playInfo.playUrl) {
        return res.status(200).json({
          success: true,
          mediaUrl: playInfo.playUrl,
          playUrl: playInfo.playUrl,
          subtitles: playInfo.subtitles || [],
          qualities: [{ quality: '1080P', url: playInfo.playUrl }]
        });
      }
      return res.status(404).json({ success: false, error: 'Hstream video stream not found' });
    }

    // Delegate HentaiMama episode stream requests
    if (provider === 'hentaimama') {
      const hmamaModule = require('./hentaimama');
      const playInfo = await hmamaModule.getHentaiMamaPlayUrl(episodeId);
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

    // Delegate Narto Drama episode requests to Narto handler
    if (provider === 'narto' || String(rawContentId).startsWith('narto_')) {
      const nartoHandler = require('./narto');
      req.url = `/episode?slug=${encodeURIComponent(contentId)}&episode=${encodeURIComponent(episodeId)}`;
      return nartoHandler(req, res);
    }

    const headers = getLoklokHeaders(token);
    const categoriesToTry = Array.from(new Set([String(category), '0', '1', '2']));
    const definitionsToTry = ['GROOT_FULL_HD', 'GROOT_FD', 'GROOT_HD', 'GROOT_SD', 'GROOT_LD'];
    
    // Fetch episode subtitles and real episode ID from detail API
    let subtitles = [];
    let targetEpId = episodeId;

    for (const cat of categoriesToTry) {
      try {
        const detailData = await loklokFetch(`/movieDrama/get?id=${contentId}&category=${cat}`, { headers });
        if ((detailData.code === '00000' || detailData.code === '000000') && detailData.data && (detailData.data.episodeVo || detailData.data.name)) {
          const rawEpisodes = Array.isArray(detailData.data.episodeVo) ? detailData.data.episodeVo : (detailData.data.episodeVo ? [detailData.data.episodeVo] : []);
          const targetEp = rawEpisodes.find(ep => String(ep.id) === String(episodeId)) || 
                           rawEpisodes.find(ep => String(ep.seriesNo) === String(episodeId)) || 
                           rawEpisodes[parseInt(episodeId, 10) - 1] || 
                           rawEpisodes[0];
          
          if (targetEp) {
            targetEpId = String(targetEp.id);
            if (targetEp.subtitlingList || targetEp.subtitles) {
              const rawSubs = targetEp.subtitlingList || targetEp.subtitles;
              subtitles = rawSubs.map(s => ({
                html: s.language || s.languageAbbr || 'Subtitle',
                lang: s.languageAbbr || s.language || 'en',
                rawUrl: s.subtitlingUrl || s.url,
                url: `/api/subtitle?url=${encodeURIComponent(s.subtitlingUrl || s.url)}`
              })).filter(s => s.url);
            }
            break;
          }
        }
      } catch (_) {}
    }

    let rawStreamUrl = '';
    let usedDefinition = definition;
    let fileSize = 0;
    let totalDuration = 0;
    let usedCategory = category;
    let usedEpId = targetEpId || episodeId;

    // Try targetEpId first, with fallback to original episodeId
    const episodeIdsToTry = Array.from(new Set([String(targetEpId), String(episodeId)]));

    // Reverse-engineered H5 API helper for signed Loklok media preview stream retrieval
    const { H5_RSA_PUBLIC_KEY, h5GenKey, h5GetSign, h5RsaEncrypt } = require('./search');

    async function h5ApiGetMediaInfo(targetContentId, targetEpId, catVal, defVal) {
      const randomKey = h5GenKey(16);
      const currentTime = Date.now();
      const tz = 0 - new Date().getTimezoneOffset() / 60;
      const queryData = {
        category: String(catVal),
        contentId: String(targetContentId),
        definition: String(defVal),
        episodeId: String(targetEpId)
      };
      const sign = h5GetSign(queryData, randomKey, currentTime);
      const aesKey = h5RsaEncrypt(randomKey);

      const hosts = ['https://h5-api.loklok.site', 'https://h5-api.hehekang.com'];
      const cfProxy = 'https://wox-stream-proxy.wizardofxerox.workers.dev/?url=';

      for (const host of hosts) {
        const targetUrl = `${host}/cms/v2/h5/media/previewInfo?category=${catVal}&contentId=${targetContentId}&episodeId=${targetEpId}&definition=${defVal}`;
        const urlsToTry = [targetUrl, `${cfProxy}${encodeURIComponent(targetUrl)}`];

        for (const url of urlsToTry) {
          try {
            const res = await fetch(url, {
              method: 'GET',
              headers: {
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
              signal: AbortSignal.timeout(10000)
            });
            if (!res.ok) continue;
            const data = await res.json();
            if (data.code === '00000' && data.data && data.data.mediaUrl) {
              return data.data;
            }
          } catch (_) {}
        }
      }
      return null;
    }

    // Outer loop through category fallbacks (0: Movie, 1: Series, 2: Variety)
    for (const cat of categoriesToTry) {
      for (const epId of episodeIdsToTry) {
        for (const def of definitionsToTry) {
          const h5Media = await h5ApiGetMediaInfo(contentId, epId, cat, def);
          if (h5Media && h5Media.mediaUrl) {
            rawStreamUrl = h5Media.mediaUrl;
            usedDefinition = def;
            usedCategory = cat;
            usedEpId = epId;
            fileSize = h5Media.size || 0;
            totalDuration = h5Media.totalDuration || 0;
            break;
          }
          try {
            const endpoint = `/media/previewInfo?category=${cat}&contentId=${contentId}&episodeId=${epId}&definition=${def}`;
            const data = await loklokFetch(endpoint, { headers });

            if ((data.code === '00000' || data.code === '000000') && data.data && data.data.mediaUrl) {
              rawStreamUrl = data.data.mediaUrl;
              usedDefinition = def;
              usedCategory = cat;
              usedEpId = epId;
              fileSize = data.data.size || 0;
              totalDuration = data.data.totalDuration || 0;
              break;
            }
          } catch (_) {}
        }
        if (rawStreamUrl) break;
      }
      if (rawStreamUrl) break;
    }

    // Fallback: Retry with guest headers if user token previewInfo failed
    if (!rawStreamUrl && token) {
      const guestHeaders = getLoklokHeaders('');
      for (const cat of categoriesToTry) {
        for (const epId of episodeIdsToTry) {
          for (const def of definitionsToTry) {
            try {
              const endpoint = `/media/previewInfo?category=${cat}&contentId=${contentId}&episodeId=${epId}&definition=${def}`;
              const data = await loklokFetch(endpoint, { headers: guestHeaders });

              if ((data.code === '00000' || data.code === '000000') && data.data && data.data.mediaUrl) {
                rawStreamUrl = data.data.mediaUrl;
                usedDefinition = def;
                usedCategory = cat;
                usedEpId = epId;
                fileSize = data.data.size || 0;
                totalDuration = data.data.totalDuration || 0;
                break;
              }
            } catch (_) {}
          }
          if (rawStreamUrl) break;
        }
        if (rawStreamUrl) break;
      }
    }

    if (!rawStreamUrl) {
      return res.status(200).json({ success: false, error: 'No media stream URL found for this episode.' });
    }

    // Fetch all available quality definitions for this episode and sort by stream size/bitrate descending
    const rawStreamsMap = new Map();
    // Seed with the stream we already found during resolution
    rawStreamsMap.set(rawStreamUrl, {
      code: usedDefinition,
      size: fileSize,
      rawStreamUrl: rawStreamUrl
    });

    // Query remaining definitions (skip the one we already have)
    const remainingDefs = definitionsToTry.filter(d => d !== usedDefinition);
    for (const def of remainingDefs) {
      try {
        const endpoint = `/media/previewInfo?category=${usedCategory}&contentId=${contentId}&episodeId=${usedEpId}&definition=${def}`;
        const qRes = await loklokFetch(endpoint, { headers });
        if ((qRes.code === '00000' || qRes.code === '000000') && qRes.data && qRes.data.mediaUrl) {
          const streamUrl = qRes.data.mediaUrl;
          if (!rawStreamsMap.has(streamUrl)) {
            rawStreamsMap.set(streamUrl, {
              code: def,
              size: qRes.data.size || 0,
              rawStreamUrl: streamUrl
            });
          }
        }
      } catch (_) {}
    }

    // Sort unique stream URLs by size descending (largest bitrate/file size first)
    const sortedStreams = Array.from(rawStreamsMap.values()).sort((a, b) => b.size - a.size);
    const labelTiers = ['1080p Full HD', '720p HD', '480p SD', '360p LD'];
    const qualities = sortedStreams.map((item, idx) => ({
      code: item.code,
      label: labelTiers[idx] || '360p LD',
      size: item.size,
      sizeFormatted: formatBytes(item.size),
      rawStreamUrl: item.rawStreamUrl
    }));

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
