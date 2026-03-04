const jwt = require('jsonwebtoken');
const db = require('../db');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await db.query('SELECT id, email, username, is_creator, is_admin FROM users WHERE id = $1', [payload.userId]);
    if (!rows.length) return res.status(401).json({ error: 'User not found' });
    req.user = rows[0];
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireCreator(req, res, next) {
  if (!req.user?.is_creator) return res.status(403).json({ error: 'Creator account required' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user?.is_admin) return res.status(403).json({ error: 'Admin access required' });
  next();
}

module.exports = { requireAuth, requireCreator, requireAdmin };
