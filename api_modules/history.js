const { setCorsHeaders, fixCoverUrl, loklokFetch, parseToken } = require('./_utils');
const { readDb, writeDb } = require('./_db');
const { exec } = require('child_process');
const path = require('path');

function getLocalPcHistory() {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, '..', 'read_pc_history.py');
    exec(`python "${scriptPath}"`, { cwd: path.join(__dirname, '..') }, (error, stdout, stderr) => {
      if (error || !stdout) return resolve([]);
      try {
        const items = JSON.parse(stdout.trim());
        return resolve(Array.isArray(items) ? items : []);
      } catch (e) {
        return resolve([]);
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
    const userId = payload ? payload.userId : 'guest';

    const db = readDb();

    // 1. DELETE ACTION
    if (action === 'delete') {
      const { contentId } = req.body || {};
      if (contentId) {
        db.history = db.history.filter(h => !(h.userId === userId && String(h.id) === String(contentId)));
        writeDb(db);
      }
      return res.status(200).json({ success: true, deletedId: contentId });
    }

    // 2. ADD / SAVE PROGRESS ACTION
    if (action === 'save' || action === 'add') {
      const item = req.body || {};
      if (item && item.id) {
        const existingIdx = db.history.findIndex(h => h.userId === userId && String(h.id) === String(item.id));
        const record = {
          userId: userId,
          id: String(item.id),
          category: String(item.category || '1'),
          title: item.title || 'Untitled',
          cover: fixCoverUrl(item.cover),
          episodeId: String(item.episodeId || ''),
          episodeName: item.episodeName || 'Episode',
          progressTime: item.progressTime || 0,
          totalTime: item.totalTime || 0,
          updatedAt: Date.now()
        };

        if (existingIdx >= 0) {
          db.history[existingIdx] = record;
        } else {
          db.history.push(record);
        }
        writeDb(db);
      }
      return res.status(200).json({ success: true });
    }

    // 3. FETCH WATCH HISTORY
    const userCloudHistory = db.history.filter(h => h.userId === userId);
    const localPcItems = await getLocalPcHistory();

    const map = new Map();
    userCloudHistory.forEach(item => map.set(String(item.id), item));
    localPcItems.forEach(item => {
      const key = String(item.id);
      if (!map.has(key) || (item.updatedAt || 0) > (map.get(key).updatedAt || 0)) {
        map.set(key, item);
      }
    });

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
