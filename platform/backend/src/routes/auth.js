const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register
router.post('/register',
  body('email').isEmail().normalizeEmail(),
  body('username').isAlphanumeric().isLength({ min: 3, max: 30 }),
  body('password').isLength({ min: 8 }),
  body('display_name').trim().isLength({ min: 1, max: 100 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, username, password, display_name } = req.body;

    try {
      const existing = await db.query(
        'SELECT id FROM users WHERE email = $1 OR username = $2',
        [email, username]
      );
      if (existing.rows.length) {
        return res.status(409).json({ error: 'Email or username already taken' });
      }

      const password_hash = await bcrypt.hash(password, 12);
      const { rows } = await db.query(
        `INSERT INTO users (email, username, password_hash, display_name)
         VALUES ($1, $2, $3, $4) RETURNING id, email, username, display_name`,
        [email, username, password_hash, display_name]
      );

      const token = jwt.sign({ userId: rows[0].id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      });

      res.status(201).json({ user: rows[0], token });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

// POST /api/auth/login
router.post('/login',
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    try {
      const { rows } = await db.query(
        'SELECT id, email, username, display_name, password_hash, is_creator, is_admin FROM users WHERE email = $1',
        [email]
      );
      if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

      const user = rows[0];
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      });

      const { password_hash, ...safeUser } = user;
      res.json({ user: safeUser, token });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await db.query(
    `SELECT u.id, u.email, u.username, u.display_name, u.bio, u.avatar_url,
            u.is_creator, u.created_at, cp.category, cp.tagline
     FROM users u
     LEFT JOIN creator_profiles cp ON cp.user_id = u.id
     WHERE u.id = $1`,
    [req.user.id]
  );
  res.json(rows[0]);
});

module.exports = router;
