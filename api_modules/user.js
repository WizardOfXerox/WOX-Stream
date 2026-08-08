const { getLoklokHeaders, setCorsHeaders, loklokFetch } = require('./_utils');

module.exports = async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const token = req.headers.token || req.query.token || req.body?.token || '';

    if (!token) {
      return res.status(200).json({ success: false, error: 'No token provided' });
    }

    const headers = getLoklokHeaders(token);
    headers['token'] = token;
    headers['v-token'] = token;

    const data = await loklokFetch('/user/web/login/info', { headers });

    if (data && data.data) {
      const u = data.data;
      const avatar = u.portrait || u.avatar || u.headImg || u.icon || '';
      return res.status(200).json({
        success: true,
        user: {
          id: String(u.id || u.displayId || ''),
          nickName: u.nickName || u.name || 'WOX Account',
          avatar: avatar,
          portrait: avatar,
          displayId: String(u.displayId || u.id || ''),
          rawInfo: u
        }
      });
    }

    return res.status(200).json({ success: false, error: data ? data.msg : 'User profile unavailable' });
  } catch (error) {
    return res.status(200).json({ success: false, error: error.message });
  }
};
