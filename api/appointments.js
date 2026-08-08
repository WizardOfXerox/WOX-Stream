const { setCorsHeaders, fixCoverUrl } = require('./_utils');
const { readDb, writeDb } = require('./_db');

function parseToken(tokenStr) {
  try {
    const json = Buffer.from(tokenStr, 'base64').toString('utf-8');
    return JSON.parse(json);
  } catch (_) {
    return null;
  }
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

    if (action === 'toggle' || action === 'add' || action === 'delete' || action === 'operation') {
      const item = req.body || {};
      const id = String(item.id || item.contentId);

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

    // List user appointments / reminders
    const userItems = db.appointments.filter(a => a.userId === userId);
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
