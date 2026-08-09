const { setCorsHeaders, getNartoHeaders } = require('./_utils');

function srtToVtt(rawText) {
  if (!rawText) return 'WEBVTT\n\n';
  let text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Convert ASS / SSA format to WebVTT
  if (text.includes('[Events]') || text.includes('Dialogue:')) {
    const lines = text.split('\n');
    let vtt = 'WEBVTT\n\n';
    let cueIndex = 1;

    for (const line of lines) {
      if (line.startsWith('Dialogue:')) {
        const parts = line.substring(9).split(',');
        if (parts.length >= 10) {
          const start = parts[1].trim();
          const end = parts[2].trim();
          const dialogText = parts.slice(9).join(',').replace(/\\N/gi, '\n').replace(/\{[^}]+\}/g, '').trim();

          const formatAssTime = (t) => {
            const match = t.match(/^(\d+):(\d\d):(\d\d)\.(\d+)$/);
            if (match) {
              const h = match[1].padStart(2, '0');
              const m = match[2];
              const s = match[3];
              const ms = match[4].padEnd(3, '0').substring(0, 3);
              return `${h}:${m}:${s}.${ms}`;
            }
            return t;
          };

          const vttStart = formatAssTime(start);
          const vttEnd = formatAssTime(end);

          if (dialogText) {
            vtt += `${cueIndex++}\n${vttStart} --> ${vttEnd}\n${dialogText}\n\n`;
          }
        }
      }
    }
    return vtt;
  }

  // SRT Format
  let vtt = 'WEBVTT\n\n' + text;
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
