const { setCorsHeaders, fixCoverUrl, parseToken } = require('./_utils');
const { readDb, writeDb } = require('./_db');

module.exports = async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const token = req.headers.token || req.body?.token || req.query.token || '';
    const action = req.query.action || req.body?.action || 'list';
    const payload = parseToken(token);
    const userId = payload ? payload.userId : 'guest';

    const db = readDb();

    if (action === 'toggle' || action === 'add' || action === 'delete') {
      const item = req.body || {};
      const id = String(item.id || item.contentId);

      const existingIdx = db.collections.findIndex(c => c.userId === userId && String(c.id) === id);

      if (existingIdx >= 0) {
        // Remove from collection
        db.collections.splice(existingIdx, 1);
        writeDb(db);
        return res.status(200).json({ success: true, action: 'removed', isBookmarked: false });
      } else {
        // Add to collection
        const record = {
          userId: userId,
          id: id,
          category: String(item.category || '1'),
          title: item.title || 'Untitled',
          cover: fixCoverUrl(item.cover),
          score: item.score || '8.5',
          addedAt: Date.now()
        };
        db.collections.push(record);
        writeDb(db);
        return res.status(200).json({ success: true, action: 'added', isBookmarked: true });
      }
    }

    // List user collection
    const userItems = db.collections.filter(c => c.userId === userId);
    return res.status(200).json({
      success: true,
      count: userItems.length,
      items: userItems,
      list: userItems
    });

  } catch (err) {
    return res.status(200).json({ success: true, items: [] });
  }
};
