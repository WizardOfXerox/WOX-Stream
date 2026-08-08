const { setCorsHeaders } = require('./_utils');
const { exec } = require('child_process');
const path = require('path');

function runPlaywrightQrScript(action, extraParam = '') {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, '..', 'qr_bridge.py');
    const cmd = `python "${scriptPath}" ${action} ${extraParam}`;
    exec(cmd, { cwd: path.join(__dirname, '..') }, (error, stdout, stderr) => {
      if (error) {
        return resolve({ success: false, error: stderr || error.message });
      }
      try {
        const data = JSON.parse(stdout.trim());
        return resolve({ success: true, data });
      } catch (e) {
        return resolve({ success: false, error: 'Invalid JSON from bridge script: ' + stdout });
      }
    });
  });
}

module.exports = async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const action = req.query.action || (req.body && req.body.action) || 'info';

    if (action === 'info') {
      const bridge = await runPlaywrightQrScript('info');
      if (bridge.success && bridge.data && bridge.data.oauthKey) {
        const oauthKey = bridge.data.oauthKey;
        const qrUrl = bridge.data.url || `tiktik://action/webLogin?oauthKey=${oauthKey}`;
        return res.status(200).json({
          success: true,
          oauthKey: oauthKey,
          qrUrl: qrUrl
        });
      }
      return res.status(500).json({
        success: false,
        error: bridge.error || 'Failed to generate live QR Code from Loklok server.'
      });

    } else if (action === 'check') {
      const oauthKey = req.query.oauthKey || req.query.code || (req.body && req.body.oauthKey);
      if (!oauthKey) {
        return res.status(400).json({ success: false, error: 'oauthKey parameter is required.' });
      }

      const bridge = await runPlaywrightQrScript('check', oauthKey);
      if (bridge.success && bridge.data) {
        const statusData = bridge.data;
        
        if (statusData.status === 4 && (statusData.jwtToken || statusData.token)) {
          const token = statusData.jwtToken || statusData.token;
          const u = statusData.userInfoData || statusData.user || {};
          
          const nickName = u.nickName || u.name || u.userName || u.userNickName || 'WOX User';
          const avatar = u.portrait || u.avatar || u.headImg || u.icon || u.userIcon || u.picture || u.photoUrl || u.userAvatar || '';
          const userId = u.userId || u.id || u.displayId || u.userNo || statusData.displayId || '';
          const email = u.email || u.emailAddress || u.account || '';

          return res.status(200).json({
            success: true,
            status: 4,
            token: token,
            user: {
              userId: String(userId),
              nickName: nickName,
              avatar: avatar,
              email: email,
              rawInfo: u
            }
          });
        }

        return res.status(200).json({
          success: true,
          status: statusData.status || 1
        });
      }

      return res.status(200).json({ success: true, status: 1 });

    } else if (action === 'user') {
      const token = req.query.token || req.headers.token || (req.body && req.body.token);
      if (!token) return res.status(400).json({ success: false, error: 'Token required' });
      const bridge = await runPlaywrightQrScript('user', token);
      if (bridge.success && bridge.data) {
        const rootData = bridge.data;
        if (rootData.code === 'A0230' || rootData.msg === 'CERTIFICATE_EXPIRED') {
          return res.status(200).json({ success: false, expired: true, error: 'Session expired. Please sign in again.' });
        }
        const u = rootData.data || rootData.userInfoData || rootData;
        if (u && (u.userId || u.id || u.nickName || u.name)) {
          return res.status(200).json({
            success: true,
            user: {
              userId: String(u.userId || u.id || u.displayId || ''),
              nickName: u.nickName || u.name || 'WOX User',
              avatar: u.portrait || u.avatar || u.headImg || '',
              email: u.email || ''
            }
          });
        }
      }
      return res.status(200).json({ success: false, error: 'User profile unavailable' });
    }

    return res.status(400).json({ success: false, error: 'Invalid request.' });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
