const { setCorsHeaders } = require('./_utils');
const { extractStream } = require('./extractors');

module.exports = async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const embedUrl = req.query.url;
  if (!embedUrl) {
    return res.status(400).json({ success: false, error: 'Missing url parameter' });
  }

  try {
    const decoded = decodeURIComponent(embedUrl);
    const result = await extractStream(decoded);
    if (result && result.url) {
      return res.json({
        success: true,
        streamUrl: result.url,
        streamType: result.type || 'hls',
        subtitles: result.subtitles || [],
        referer: result.referer || ''
      });
    }
    return res.json({ success: false, error: 'Extraction failed', fallbackUrl: decoded });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message, fallbackUrl: embedUrl });
  }
};
