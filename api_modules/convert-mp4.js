const { spawn } = require('child_process');
const { setCorsHeaders } = require('./_utils');

module.exports = async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const rawUrl = req.query.url || req.query.streamUrl || '';
    const subUrl = req.query.subUrl || '';
    const subLang = req.query.subLang || 'en';
    const subName = req.query.subName || 'Subtitle';
    const format = (req.query.format || 'mp4').toLowerCase();
    const title = req.query.title || 'wox_stream_download';
    
    if (!rawUrl) {
      return res.status(400).json({ success: false, error: 'Missing m3u8 stream url parameter' });
    }

    const cleanTitle = title.replace(/[^a-zA-Z0-9_\-\.\s]/g, '').trim() || 'video';
    const ext = format === 'mkv' ? 'mkv' : 'mp4';
    const fileName = subUrl ? `${cleanTitle}_[${subName}].${ext}` : `${cleanTitle}.${ext}`;

    const mimeType = ext === 'mkv' ? 'video/x-matroska' : 'video/mp4';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);

    console.log(`🎬 Starting ${ext.toUpperCase()} Conversion Stream for: "${fileName}" (Subtitles: ${subUrl ? subName : 'None'})`);

    const args = [
      '-headers', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\r\n',
      '-i', rawUrl
    ];

    if (subUrl) {
      args.push(
        '-headers', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\r\n',
        '-i', subUrl
      );
    }

    // Video stream copy + AAC 2-channel Stereo Audio re-encoding with Bitstream Filter
    args.push(
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-ar', '44100',
      '-ac', '2',
      '-bsf:a', 'aac_adtstoasc'
    );

    if (subUrl) {
      const subCodec = ext === 'mkv' ? 'srt' : 'mov_text';
      args.push(
        '-c:s', subCodec,
        '-metadata:s:s:0', `language=${subLang}`,
        '-metadata:s:s:0', `title=${subName}`
      );
    }

    if (ext === 'mp4') {
      args.push('-movflags', 'frag_keyframe+empty_moov', '-f', 'mp4');
    } else {
      args.push('-f', 'matroska');
    }

    args.push('pipe:1');

    const ffmpeg = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });

    ffmpeg.stdout.pipe(res);

    ffmpeg.stderr.on('data', (data) => {
      // Optional logging
    });

    req.on('close', () => {
      if (!ffmpeg.killed) {
        console.log(`⚠️ Client disconnected. Terminating FFmpeg process for ${fileName}`);
        ffmpeg.kill('SIGKILL');
      }
    });

    ffmpeg.on('error', (err) => {
      console.error("FFmpeg error:", err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: err.message });
      }
    });

  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
};
