const { setCorsHeaders } = require('./_utils');
const { readDb, writeDb } = require('./_db');
const crypto = require('crypto');

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function generateToken(user) {
  const payload = {
    userId: user.id,
    email: user.email,
    username: user.username,
    createdAt: Date.now()
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

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

  const action = req.query.action || req.body?.action || 'me';

  try {
    const db = readDb();

    // 1. REGISTER USER ACCOUNT
    if (action === 'register') {
      const { username, email, password } = req.body || {};
      if (!username || !email || !password) {
        return res.status(400).json({ success: false, error: 'Username, email, and password are required.' });
      }

      const existingUser = db.users.find(u => u.email.toLowerCase() === email.toLowerCase() || u.username.toLowerCase() === username.toLowerCase());
      if (existingUser) {
        return res.status(400).json({ success: false, error: 'User account with this email or username already exists.' });
      }

      const userId = 'wox_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      const newUser = {
        id: userId,
        username: username.trim(),
        email: email.trim().toLowerCase(),
        passwordHash: hashPassword(password),
        avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`,
        createdAt: Date.now()
      };

      db.users.push(newUser);
      writeDb(db);

      const token = generateToken(newUser);

      return res.status(200).json({
        success: true,
        token: token,
        user: {
          id: newUser.id,
          username: newUser.username,
          nickName: newUser.username,
          email: newUser.email,
          avatar: newUser.avatar,
          portrait: newUser.avatar
        }
      });
    }

    // 2. LOGIN USER ACCOUNT
    if (action === 'login') {
      const { emailOrUsername, password } = req.body || {};
      if (!emailOrUsername || !password) {
        return res.status(400).json({ success: false, error: 'Email/Username and password are required.' });
      }

      const targetStr = emailOrUsername.trim().toLowerCase();
      const user = db.users.find(u => u.email.toLowerCase() === targetStr || u.username.toLowerCase() === targetStr);

      if (!user || user.passwordHash !== hashPassword(password)) {
        return res.status(401).json({ success: false, error: 'Invalid email/username or password.' });
      }

      const token = generateToken(user);

      return res.status(200).json({
        success: true,
        token: token,
        user: {
          id: user.id,
          username: user.username,
          nickName: user.username,
          email: user.email,
          avatar: user.avatar,
          portrait: user.avatar
        }
      });
    }

    // 3. GET CURRENT USER PROFILE (me)
    const tokenStr = req.headers.token || req.query.token || req.body?.token || '';
    const payload = parseToken(tokenStr);

    if (payload && payload.userId) {
      const user = db.users.find(u => u.id === payload.userId);
      if (user) {
        return res.status(200).json({
          success: true,
          user: {
            id: user.id,
            username: user.username,
            nickName: user.username,
            email: user.email,
            avatar: user.avatar,
            portrait: user.avatar
          }
        });
      }
    }

    return res.status(200).json({
      success: false,
      error: 'Unauthenticated or guest session'
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
