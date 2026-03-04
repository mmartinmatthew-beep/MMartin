const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { requireAuth, requireCreator } = require('../middleware/auth');

const router = express.Router();

// GET /api/creators - browse all creators
router.get('/', async (req, res) => {
  const { category, search, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  let query = `
    SELECT u.id, u.username, u.display_name, u.avatar_url,
           cp.tagline, cp.category, cp.tags, cp.subscriber_count, cp.cover_image_url
    FROM users u
    JOIN creator_profiles cp ON cp.user_id = u.id
    WHERE u.is_creator = TRUE AND cp.onboarding_complete = TRUE
  `;
  const params = [];

  if (category) {
    params.push(category);
    query += ` AND cp.category = $${params.length}`;
  }
  if (search) {
    params.push(`%${search}%`);
    query += ` AND (u.display_name ILIKE $${params.length} OR u.username ILIKE $${params.length} OR cp.tagline ILIKE $${params.length})`;
  }

  query += ` ORDER BY cp.subscriber_count DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const { rows } = await db.query(query, params);
  res.json(rows);
});

// GET /api/creators/:username - creator public profile
router.get('/:username', async (req, res) => {
  const { rows } = await db.query(
    `SELECT u.id, u.username, u.display_name, u.bio, u.avatar_url,
            cp.tagline, cp.cover_image_url, cp.category, cp.tags, cp.subscriber_count
     FROM users u
     JOIN creator_profiles cp ON cp.user_id = u.id
     WHERE u.username = $1 AND u.is_creator = TRUE`,
    [req.params.username]
  );
  if (!rows.length) return res.status(404).json({ error: 'Creator not found' });
  res.json(rows[0]);
});

// POST /api/creators/become - convert account to creator
router.post('/become', requireAuth, async (req, res) => {
  if (req.user.is_creator) return res.status(400).json({ error: 'Already a creator' });

  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE users SET is_creator = TRUE WHERE id = $1', [req.user.id]);
    await client.query('INSERT INTO creator_profiles (user_id) VALUES ($1)', [req.user.id]);
    await client.query('COMMIT');
    res.json({ message: 'Creator account activated' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to activate creator account' });
  } finally {
    client.release();
  }
});

// PATCH /api/creators/profile - update creator profile
router.patch('/profile', requireAuth, requireCreator,
  body('tagline').optional().isLength({ max: 200 }),
  body('category').optional().isIn(['education', 'news', 'fitness', 'gaming', 'music', 'comedy', 'technology', 'art', 'politics', 'science', 'other']),
  body('tags').optional().isArray({ max: 10 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { tagline, category, tags, bio, display_name } = req.body;

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      if (display_name || bio) {
        await client.query(
          'UPDATE users SET display_name = COALESCE($1, display_name), bio = COALESCE($2, bio) WHERE id = $3',
          [display_name, bio, req.user.id]
        );
      }

      await client.query(
        `UPDATE creator_profiles
         SET tagline = COALESCE($1, tagline),
             category = COALESCE($2, category),
             tags = COALESCE($3, tags),
             onboarding_complete = TRUE
         WHERE user_id = $4`,
        [tagline, category, tags, req.user.id]
      );

      await client.query('COMMIT');
      res.json({ message: 'Profile updated' });
    } catch (err) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: 'Update failed' });
    } finally {
      client.release();
    }
  }
);

// GET /api/creators/:username/tiers
router.get('/:username/tiers', async (req, res) => {
  const { rows: creator } = await db.query(
    'SELECT id FROM users WHERE username = $1 AND is_creator = TRUE',
    [req.params.username]
  );
  if (!creator.length) return res.status(404).json({ error: 'Creator not found' });

  const { rows } = await db.query(
    'SELECT * FROM tiers WHERE creator_id = $1 AND is_active = TRUE ORDER BY price_cents ASC',
    [creator[0].id]
  );
  res.json(rows);
});

module.exports = router;
