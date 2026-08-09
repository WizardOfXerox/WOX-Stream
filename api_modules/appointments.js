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

    if (action === 'toggle' || action === 'add' || action === 'delete' || action === 'operation') {
      const item = req.body || {};
      const id = String(item.id || item.contentId);
      const recId = id + '_' + userId;

      if (isNeon) {
        const existing = await sql`SELECT id FROM wox_appointments WHERE user_id = ${userId} AND media_id = ${id} LIMIT 1`;
        if (existing.length > 0) {
          await sql`DELETE FROM wox_appointments WHERE user_id = ${userId} AND media_id = ${id}`;
          return res.status(200).json({ success: true, action: 'cancelled', isReminderSet: false });
        } else {
          const title = item.title || 'Untitled';
          const cover = fixCoverUrl(item.cover);
          await sql`
            INSERT INTO wox_appointments (id, user_id, media_id, title, cover, timestamp)
            VALUES (${recId}, ${userId}, ${id}, ${title}, ${cover}, ${Date.now()})
          `;
          return res.status(200).json({ success: true, action: 'added', isReminderSet: true });
        }
      } else {
        const existingIdx = db.appointments.findIndex(a => a.userId === userId && String(a.id) === id);

        if (existingIdx >= 0) {
          db.appointments.splice(existingIdx, 1);
          writeDb(db);
          return res.status(200).json({ success: true, action: 'cancelled', isReminderSet: false });
        } else {
          const record = {
            userId: userId,
            id: id,
            category: String(item.category || '1'),
            title: item.title || 'Untitled',
            cover: fixCoverUrl(item.cover),
            releaseDate: item.releaseDate || 'Coming Soon',
            createdAt: Date.now()
          };
          db.appointments.push(record);
          writeDb(db);
          return res.status(200).json({ success: true, action: 'added', isReminderSet: true });
        }
      }
    }

    // List user appointments / reminders
    let userItems = [];
    if (isNeon) {
      const rows = await sql`SELECT * FROM wox_appointments WHERE user_id = ${userId} ORDER BY timestamp DESC`;
      userItems = rows.map(r => ({
        id: r.media_id,
        category: '1',
        title: r.title,
        cover: r.cover,
        createdAt: Number(r.timestamp)
      }));
    } else {
      userItems = db.appointments.filter(a => a.userId === userId);
    }

    return res.status(200).json({
      success: true,
      count: userItems.length,
      appointments: userItems,
      list: userItems
    });

  } catch (err) {
    return res.status(200).json({ success: true, appointments: [] });
  }
};
