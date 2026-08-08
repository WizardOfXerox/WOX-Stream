const { setCorsHeaders, getNartoHeaders } = require('./_utils');

function srtToVtt(srtText) {
  let vtt = 'WEBVTT\n\n' + srtText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  vtt = vtt.replace(/(\d\d:\d\d:\d\d),(\d\d\d)/g, '$1.$2');
  return vtt;
}

module.exports = async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const rawUrl = req.query.url;
    if (!rawUrl) {
      res.statusCode = 400;
      return res.end('Missing subtitle URL');
    }

    const decodedUrl = decodeURIComponent(rawUrl);
    const headers = getNartoHeaders();
    if (decodedUrl.includes('narto-drama.com') || decodedUrl.includes('mydramawave.com') || decodedUrl.includes('netshort.com')) {
      headers['Referer'] = 'https://narto-drama.com/';
    } else {
      headers['Referer'] = 'https://www.loklok.com/';
    }

    const subResponse = await fetch(decodedUrl, { headers });

    if (!subResponse.ok) {
      res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
      return res.end('WEBVTT\n\n1\n00:00:00.000 --> 00:00:05.000\n[Subtitle unavailable]');
    }

    const srtContent = await subResponse.text();
    const vttContent = srtToVtt(srtContent);

    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.end(vttContent);
  } catch (error) {
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    return res.end('WEBVTT\n\n1\n00:00:00.000 --> 00:00:05.000\n[Subtitle error]');
  }
};
