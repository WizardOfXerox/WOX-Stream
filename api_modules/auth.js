const { setCorsHeaders, hashPassword, verifyPassword, generateToken, parseToken } = require('./_utils');
const { readDb, writeDb, getSql, initNeonTables, hasNeon } = require('./_db');

module.exports = async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action || req.body?.action || 'me';

  try {
    const isNeon = hasNeon();
    if (isNeon) await initNeonTables();
    const sql = isNeon ? getSql() : null;
    const db = isNeon ? null : readDb();

    // 1. REGISTER USER ACCOUNT
    if (action === 'register') {
      const { username, email, password } = req.body || {};
      if (!username || !email || !password) {
        return res.status(400).json({ success: false, error: 'Username, email, and password are required.' });
      }

      if (isNeon) {
        const existing = await sql`SELECT id FROM wox_users WHERE LOWER(email) = LOWER(${email.trim()}) OR LOWER(username) = LOWER(${username.trim()}) LIMIT 1`;
        if (existing.length > 0) {
          return res.status(400).json({ success: false, error: 'User account with this email or username already exists.' });
        }
      } else {
        const existingUser = db.users.find(u => u.email.toLowerCase() === email.toLowerCase() || u.username.toLowerCase() === username.toLowerCase());
        if (existingUser) {
          return res.status(400).json({ success: false, error: 'User account with this email or username already exists.' });
        }
      }

      const userId = 'wox_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      const { salt, hash } = hashPassword(password);
      const avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`;

      const newUser = {
        id: userId,
        username: username.trim(),
        email: email.trim().toLowerCase(),
        salt: salt,
        passwordHash: hash,
        avatar: avatar,
        createdAt: Date.now()
      };

      if (isNeon) {
        await sql`
          INSERT INTO wox_users (id, username, email, salt, password_hash, avatar, created_at)
          VALUES (${newUser.id}, ${newUser.username}, ${newUser.email}, ${newUser.salt}, ${newUser.passwordHash}, ${newUser.avatar}, ${newUser.createdAt})
        `;
      } else {
        db.users.push(newUser);
        writeDb(db);
      }

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
      let user = null;

      if (isNeon) {
        const rows = await sql`SELECT * FROM wox_users WHERE LOWER(email) = ${targetStr} OR LOWER(username) = ${targetStr} LIMIT 1`;
        if (rows.length > 0) {
          const r = rows[0];
          user = {
            id: r.id,
            username: r.username,
            email: r.email,
            salt: r.salt,
            passwordHash: r.password_hash,
            avatar: r.avatar
          };
        }
      } else {
        user = db.users.find(u => u.email.toLowerCase() === targetStr || u.username.toLowerCase() === targetStr);
      }

      if (!user || !verifyPassword(password, user.salt || '', user.passwordHash || '')) {
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
    if (action === 'me') {
      const tokenStr = req.headers.token || req.query.token || req.body?.token || '';
      const payload = parseToken(tokenStr);

      if (payload && payload.userId) {
        let user = null;
        if (isNeon) {
          const rows = await sql`SELECT id, username, email, avatar FROM wox_users WHERE id = ${payload.userId} LIMIT 1`;
          if (rows.length > 0) user = rows[0];
        } else {
          user = db.users.find(u => u.id === payload.userId);
        }

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
    }

    // 4. UPDATE USER PROFILE
    if (action === 'update_profile') {
      const tokenStr = req.headers.token || req.query.token || req.body?.token || '';
      const payload = parseToken(tokenStr);
      if (!payload || !payload.userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      const { avatar, username } = req.body || {};

      if (isNeon) {
        if (avatar) await sql`UPDATE wox_users SET avatar = ${avatar.trim()} WHERE id = ${payload.userId}`;
        if (username) await sql`UPDATE wox_users SET username = ${username.trim()} WHERE id = ${payload.userId}`;
        const rows = await sql`SELECT id, username, email, avatar FROM wox_users WHERE id = ${payload.userId} LIMIT 1`;
        const updatedUser = rows[0];

        return res.status(200).json({
          success: true,
          user: {
            id: updatedUser.id,
            username: updatedUser.username,
            nickName: updatedUser.username,
            email: updatedUser.email,
            avatar: updatedUser.avatar,
            portrait: updatedUser.avatar
          }
        });
      } else {
        const userIdx = db.users.findIndex(u => u.id === payload.userId);
        if (userIdx === -1) {
          return res.status(404).json({ success: false, error: 'User not found' });
        }
        if (avatar) db.users[userIdx].avatar = avatar.trim();
        if (username) db.users[userIdx].username = username.trim();
        writeDb(db);

        const updatedUser = db.users[userIdx];
        return res.status(200).json({
          success: true,
          user: {
            id: updatedUser.id,
            username: updatedUser.username,
            nickName: updatedUser.username,
            email: updatedUser.email,
            avatar: updatedUser.avatar,
            portrait: updatedUser.avatar
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
