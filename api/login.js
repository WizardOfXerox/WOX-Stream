const { getLoklokHeaders, setCorsHeaders, loklokFetch } = require('./_utils');

module.exports = async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const headers = getLoklokHeaders();
    headers['Content-Type'] = 'application/json';

    const payload = {
      email: email.trim(),
      password: password.trim()
    };

    const data = await loklokFetch('/user/login/email', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });

    if (data.code !== '000000' || !data.data) {
      return res.status(401).json({
        success: false,
        error: data.msg || data.message || 'Authentication failed. Please check your email and password.',
        raw: data
      });
    }

    const userData = data.data;
    return res.status(200).json({
      success: true,
      token: userData.token,
      user: {
        userId: userData.userId || userData.id,
        nickName: userData.nickName || userData.name || email.split('@')[0],
        avatar: userData.avatar || userData.headImg || ''
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
