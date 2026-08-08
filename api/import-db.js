const { setCorsHeaders, fixCoverUrl } = require('./_utils');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

module.exports = async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    let bodyData = req.body;

    // Handle stringified JSON body
    if (typeof bodyData === 'string') {
      try {
        bodyData = JSON.parse(bodyData);
      } catch (_) {}
    }

    // 1. If user uploaded JSON export directly
    if (bodyData && Array.isArray(bodyData.history)) {
      return res.status(200).json({
        success: true,
        count: bodyData.history.length,
        items: bodyData.history
      });
    }

    // 2. If user uploaded binary base64 or raw rrclient.db
    let dbBuffer = null;
    if (bodyData && bodyData.dbBase64) {
      dbBuffer = Buffer.from(bodyData.dbBase64, 'base64');
    } else if (Buffer.isBuffer(req.body)) {
      dbBuffer = req.body;
    }

    if (!dbBuffer) {
      return res.status(400).json({ success: false, error: 'No database file content provided.' });
    }

    // Write temp file for python SQLite parser
    const tmpFile = path.join(os.tmpdir(), `loklok_import_${Date.now()}.db`);
    fs.writeFileSync(tmpFile, dbBuffer);

    const scriptPath = path.join(__dirname, '..', 'parse_db_buffer.py');
    exec(`python "${scriptPath}" "${tmpFile}"`, { cwd: path.join(__dirname, '..') }, (error, stdout, stderr) => {
      // Clean up temp file
      try { fs.unlinkSync(tmpFile); } catch (_) {}

      if (error || !stdout) {
        return res.status(500).json({ success: false, error: 'Failed to parse SQLite database file.' });
      }

      try {
        const rawItems = JSON.parse(stdout.trim());
        const cleanedItems = rawItems.map(item => ({
          id: String(item.id),
          category: '1',
          title: item.title || 'Untitled',
          cover: fixCoverUrl(item.cover),
          episodeId: String(item.episodeId || ''),
          episodeName: item.episodeName || 'Episode',
          progressTime: item.progressTime || 0,
          totalTime: item.totalTime || 0,
          updatedAt: item.updatedAt || Date.now()
        }));

        return res.status(200).json({
          success: true,
          count: cleanedItems.length,
          items: cleanedItems
        });
      } catch (e) {
        return res.status(500).json({ success: false, error: 'Failed to format parsed database items.' });
      }
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
