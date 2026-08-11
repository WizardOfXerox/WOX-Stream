const { setCorsHeaders, fixCoverUrl, parseToken, loklokFetch, getLoklokHeaders } = require('./_utils');
const { readDb, writeDb, getSql, initNeonTables, hasNeon } = require('./_db');
const { exec } = require('child_process');
const path = require('path');
const crypto = require('crypto');

function getLocalPcHistory() {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, '..', 'read_pc_history.py');
    exec(`python "${scriptPath}"`, { cwd: path.join(__dirname, '..') }, (error, stdout) => {
      if (error || !stdout) return resolve([]);
      try {
        const parsed = JSON.parse(stdout);
        resolve(Array.isArray(parsed) ? parsed : []);
      } catch (_) {
        resolve([]);
      }
    });
  });
}

module.exports = async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const token = req.headers.token || req.body?.token || req.query.token || '';
    const action = req.query.action || req.body?.action || 'list';
    const payload = parseToken(token);

    let userId = null;
    if (payload && payload.userId) {
      userId = payload.userId;
    } else if (token && token.length > 5 && token !== 'undefined' && token !== 'null') {
      userId = 'loklok_' + crypto.createHash('md5').update(token).digest('hex').substring(0, 16);
    }

    // Unauthenticated / Guest Users bypass NeonDB completely
    if (!userId) {
      return res.status(200).json({ success: true, count: 0, history: [], mode: 'localstorage_only' });
    }

    const isNeon = hasNeon();
    if (isNeon) await initNeonTables();
    const sql = isNeon ? getSql() : null;
    const db = isNeon ? null : readDb();

    // 1. DELETE ACTION
    if (action === 'delete') {
      const { contentId } = req.body || {};
      if (contentId) {
        if (isNeon) {
          await sql`DELETE FROM wox_history WHERE user_id = ${userId} AND (id = ${String(contentId)} OR media_id = ${String(contentId)})`;
        } else {
          db.history = db.history.filter(h => !(h.userId === userId && String(h.id) === String(contentId)));
          writeDb(db);
        }
      }
      return res.status(200).json({ success: true, deletedId: contentId });
    }

    // 2. ADD / SAVE PROGRESS ACTION
    if (action === 'save' || action === 'add') {
      const item = req.body || {};
      const mediaId = String(item.id || item.contentId || '');
      if (mediaId) {
        const record = {
          userId: userId,
          id: mediaId,
          category: String(item.category || '1'),
          title: item.title || 'Untitled',
          cover: fixCoverUrl(item.cover || ''),
          episodeId: String(item.episodeId || ''),
          episodeName: item.episodeName || 'Episode',
          progressTime: Number(item.progressTime || item.position || 0),
          totalTime: Number(item.totalTime || item.duration || 0),
          updatedAt: Date.now()
        };

        if (isNeon) {
          const recId = record.id + '_' + userId;
          await sql`
            INSERT INTO wox_history (id, user_id, media_id, title, cover, episode_id, episode_name, progress, duration, timestamp)
            VALUES (${recId}, ${userId}, ${record.id}, ${record.title}, ${record.cover}, ${record.episodeId}, ${record.episodeName}, ${record.progressTime}, ${record.totalTime}, ${record.updatedAt})
            ON CONFLICT (id) DO UPDATE SET
              title = EXCLUDED.title,
              cover = CASE WHEN EXCLUDED.cover != '' THEN EXCLUDED.cover ELSE wox_history.cover END,
              episode_id = EXCLUDED.episode_id,
              episode_name = EXCLUDED.episode_name,
              progress = EXCLUDED.progress,
              duration = EXCLUDED.duration,
              timestamp = EXCLUDED.timestamp
          `;
        } else {
          const existingIdx = db.history.findIndex(h => h.userId === userId && String(h.id) === mediaId);
          if (existingIdx >= 0) db.history[existingIdx] = record;
          else db.history.push(record);
          writeDb(db);
        }
      }
      return res.status(200).json({ success: true });
    }

    // 3. FETCH WATCH HISTORY (NEON DB + LOKLOK CLOUD + LOCAL PC)
    let userCloudHistory = [];
    if (isNeon) {
      const rows = await sql`SELECT * FROM wox_history WHERE user_id = ${userId} ORDER BY timestamp DESC LIMIT 100`;
      userCloudHistory = rows.map(r => ({
        id: r.media_id,
        category: '1',
        title: r.title,
        cover: r.cover,
        episodeId: r.episode_id,
        episodeName: r.episode_name,
        progressTime: Number(r.progress || 0),
        totalTime: Number(r.duration || 0),
        updatedAt: Number(r.timestamp)
      }));
    } else {
      userCloudHistory = db.history.filter(h => h.userId === userId);
    }

    // Remote official Loklok cloud history
    let loklokCloudHistory = [];
    if (token && token.length > 5 && token !== 'undefined' && token !== 'null') {
      try {
        const remoteData = await loklokFetch('/user/watch/history?page=0&size=100', {
          headers: getLoklokHeaders(token)
        });
        if (remoteData && remoteData.data) {
          const rawItems = remoteData.data.searchResults || remoteData.data.history || [];
          loklokCloudHistory = rawItems.map(item => ({
            id: String(item.id || item.contentId || ''),
            category: String(item.category != null ? item.category : '1'),
            title: item.title || item.name || 'Untitled',
            cover: fixCoverUrl(item.cover || item.coverUrl || ''),
            episodeId: String(item.episodeId || item.epId || ''),
            episodeName: item.episodeName || (item.episodeSort != null ? `Episode ${item.episodeSort}` : 'Episode 1'),
            progressTime: Number(item.progress || item.position || 0),
            totalTime: Number(item.duration || 0),
            updatedAt: Number(item.updatedAt || item.localTimestamp || Date.now())
          }));
        }
      } catch (_) {}
    }

    const localPcItems = await getLocalPcHistory();

    // Deduplicate all sources by ID & Normalized Title
    const map = new Map();
    const titleToKey = new Map();

    const addItemToMap = (item) => {
      if (!item || !item.id) return;
      const key = String(item.id);
      const normTitle = (item.title || '').trim().toLowerCase();

      let existingKey = key;
      if (normTitle && titleToKey.has(normTitle)) {
        existingKey = titleToKey.get(normTitle);
      }

      if (!map.has(existingKey)) {
        map.set(existingKey, item);
        if (normTitle) titleToKey.set(normTitle, existingKey);
      } else {
        const prev = map.get(existingKey);
        if ((item.updatedAt || 0) >= (prev.updatedAt || 0)) {
          if (!item.cover && prev.cover) item.cover = prev.cover;
          map.set(existingKey, item);
        }
      }
    };

    loklokCloudHistory.forEach(addItemToMap);
    userCloudHistory.forEach(addItemToMap);
    localPcItems.forEach(addItemToMap);

    const combinedHistory = Array.from(map.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    return res.status(200).json({
      success: true,
      count: combinedHistory.length,
      history: combinedHistory
    });

  } catch (error) {
    return res.status(200).json({ success: true, history: [] });
  }
};
