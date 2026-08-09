const { setCorsHeaders, fixCoverUrl, parseToken } = require('./_utils');
const { readDb, writeDb, getSql, initNeonTables, hasNeon } = require('./_db');

module.exports = async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const token = req.headers.token || req.body?.token || req.query.token || '';
    const action = req.query.action || req.body?.action || 'list';
    const payload = parseToken(token);
    const userId = payload ? payload.userId : 'guest';

    const isNeon = hasNeon();
    if (isNeon) await initNeonTables();
    const sql = isNeon ? getSql() : null;
    const db = isNeon ? null : readDb();

    if (action === 'toggle' || action === 'add' || action === 'delete') {
      const item = req.body || {};
      const id = String(item.id || item.contentId);
      const recId = id + '_' + userId;

      if (isNeon) {
        const existing = await sql`SELECT id FROM wox_collections WHERE user_id = ${userId} AND media_id = ${id} LIMIT 1`;
        if (existing.length > 0) {
          await sql`DELETE FROM wox_collections WHERE user_id = ${userId} AND media_id = ${id}`;
          return res.status(200).json({ success: true, action: 'removed', isBookmarked: false });
        } else {
          const title = item.title || 'Untitled';
          const cover = fixCoverUrl(item.cover);
          const score = String(item.score || '8.5');
          const cat = parseInt(item.category || '1', 10);
          await sql`
            INSERT INTO wox_collections (id, user_id, media_id, category, title, cover, score, timestamp)
            VALUES (${recId}, ${userId}, ${id}, ${cat}, ${title}, ${cover}, ${score}, ${Date.now()})
          `;
          return res.status(200).json({ success: true, action: 'added', isBookmarked: true });
        }
      } else {
        const existingIdx = db.collections.findIndex(c => c.userId === userId && String(c.id) === id);

        if (existingIdx >= 0) {
          db.collections.splice(existingIdx, 1);
          writeDb(db);
          return res.status(200).json({ success: true, action: 'removed', isBookmarked: false });
        } else {
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
    }

    // List user collection
    let userItems = [];
    if (isNeon) {
      const rows = await sql`SELECT * FROM wox_collections WHERE user_id = ${userId} ORDER BY timestamp DESC`;
      userItems = rows.map(r => ({
        id: r.media_id,
        category: String(r.category || 1),
        title: r.title,
        cover: r.cover,
        score: r.score,
        addedAt: Number(r.timestamp)
      }));
    } else {
      userItems = db.collections.filter(c => c.userId === userId);
    }

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
