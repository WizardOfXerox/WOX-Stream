const { getLoklokHeaders, setCorsHeaders, loklokFetch } = require('./_utils');

module.exports = async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const token = req.headers.token || req.body?.token || req.query.token || '';

    if (!token) {
      return res.status(200).json({ success: false, message: 'Unauthenticated playback progress' });
    }

    const { contentId, episodeId, category = '1', progressTime = 0, totalTime = 0 } = req.body || req.query;

    if (!contentId || !episodeId) {
      return res.status(400).json({ success: false, error: 'Missing contentId or episodeId' });
    }

    const pcHeaders = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'lang': 'en',
      'versioncode': '34',
      'clienttype': 'windows_pc_microsoft',
      'aliId': '60A3305FDAAC489AAF4C7DD33B1483B4',
      'deviceid': '60A3305FDAAC489AAF4C7DD33B1483B4',
      'token': token,
      'v-token': token,
      'User-Agent': 'LokLokClient/1.37.0'
    };

    const batchPayload = [{
      category: parseInt(category, 10),
      contentId: String(contentId),
      episodeId: String(episodeId),
      position: Math.floor(progressTime),
      duration: Math.floor(totalTime),
      localTimestamp: Date.now()
    }];

    const data = await loklokFetch('/auth/pc/history/addBatchLog', {
      method: 'POST',
      headers: pcHeaders,
      body: JSON.stringify(batchPayload)
    });

    return res.status(200).json({
      success: true,
      syncedToServer: true,
      loklokResponse: data
    });
  } catch (error) {
    return res.status(200).json({ success: true, syncedToServer: false });
  }
};
