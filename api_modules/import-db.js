const { setCorsHeaders, fixCoverUrl } = require('./_utils');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Parse RRCLIENT.db (Loklok Desktop/Mobile SQLite database)
 * using better-sqlite3 for proper SQL queries on the play_history table.
 *
 * play_history schema:
 *   UID, SEASON_ID (PK = media id), EPISODE_ID, TITLE, CATEGORY,
 *   EPISODE_SORT, COVER, DURATION, POSITION, REAL_PLAY_TIME,
 *   LAST_WATCH_TIME, QUALITY, RATE, TYPE, LOCAL_TIMESTAMP,
 *   FINISH, STATE, BACKEND_HISTORY_ID, BACKEND_UID, BACKEND_TAG,
 *   CORNER_INFO, SCORE
 */
function parseSQLiteProper(dbBuffer) {
  let Database;
  try {
    Database = require('better-sqlite3');
  } catch (_) {
    return null; // better-sqlite3 not available (e.g. Vercel)
  }

  // Write buffer to a temp file so better-sqlite3 can open it
  const tmpPath = path.join(os.tmpdir(), `rrclient_import_${Date.now()}.db`);
  try {
    fs.writeFileSync(tmpPath, dbBuffer);
    const db = new Database(tmpPath, { readonly: true });

    // Check which tables exist
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);

    const items = [];
    const seenIds = new Set();

    // Primary: parse play_history table
    if (tables.includes('play_history')) {
      const rows = db.prepare('SELECT * FROM play_history').all();
      for (const row of rows) {
        const id = String(row.SEASON_ID || '');
        if (!id || seenIds.has(id)) continue;
        seenIds.add(id);

        const duration = Number(row.DURATION) || 0;
        const position = Number(row.POSITION) || 0;
        let timestamp = Number(row.LOCAL_TIMESTAMP) || Date.now();
        // Normalize to ms
        if (timestamp > 0 && timestamp < 10000000000) timestamp *= 1000;

        items.push({
          id,
          category: String(row.CATEGORY != null ? row.CATEGORY : '1'),
          title: row.TITLE || `Media #${id}`,
          cover: fixCoverUrl(row.COVER || ''),
          episodeId: String(row.EPISODE_ID || ''),
          episodeName: row.EPISODE_SORT != null ? `Episode ${row.EPISODE_SORT}` : 'Episode 1',
          progressTime: position,
          totalTime: duration,
          updatedAt: timestamp,
          score: row.SCORE != null ? row.SCORE : null
        });
      }
    }

    db.close();
    return items;
  } catch (err) {
    console.error('better-sqlite3 parse error:', err.message);
    return null;
  } finally {
    try { fs.unlinkSync(tmpPath); } catch (_) {}
  }
}

module.exports = async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    let bodyData = req.body;

    if (typeof bodyData === 'string') {
      try {
        bodyData = JSON.parse(bodyData);
      } catch (_) {}
    }

    // Vercel stream chunk fallback when body is empty
    if (!bodyData || (typeof bodyData === 'object' && Object.keys(bodyData).length === 0)) {
      try {
        const chunks = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        const rawBuf = Buffer.concat(chunks);
        if (rawBuf.length > 0) {
          try {
            bodyData = JSON.parse(rawBuf.toString('utf8'));
          } catch (_) {
            bodyData = { dbBase64: rawBuf.toString('base64') };
          }
        }
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

    // 2. Extract SQLite Buffer from base64 or raw body
    let dbBuffer = null;
    if (bodyData && bodyData.dbBase64) {
      dbBuffer = Buffer.from(bodyData.dbBase64, 'base64');
    } else if (Buffer.isBuffer(req.body)) {
      dbBuffer = req.body;
    }

    if (!dbBuffer || dbBuffer.length === 0) {
      return res.status(400).json({ success: false, error: 'No database file content provided.' });
    }

    // 3. Parse with proper SQLite (better-sqlite3)
    const items = parseSQLiteProper(dbBuffer);

    if (items && items.length > 0) {
      return res.status(200).json({
        success: true,
        count: items.length,
        items
      });
    }

    // 4. If better-sqlite3 failed or returned 0 items, return error
    return res.status(400).json({
      success: false,
      error: items === null
        ? 'SQLite parser not available on this server. Please use stream.wox.world instead.'
        : 'No play_history records found in database file.'
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to process SQLite database.' });
  }
};
