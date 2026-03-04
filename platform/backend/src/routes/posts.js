const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { requireAuth, requireCreator } = require('../middleware/auth');

const router = express.Router();

// Helper: check if user is subscribed to a creator
async function isSubscribed(subscriberId, creatorId) {
  const { rows } = await db.query(
    `SELECT id FROM subscriptions
     WHERE subscriber_id = $1 AND creator_id = $2 AND status = 'active'`,
    [subscriberId, creatorId]
  );
  return rows.length > 0;
}

// GET /api/posts/feed - subscriber feed (all subscribed creators' posts)
router.get('/feed', requireAuth, async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  const { rows } = await db.query(
    `SELECT p.id, p.title, p.body, p.media_type, p.thumbnail_url,
            p.is_public, p.view_count, p.like_count, p.published_at,
            u.username, u.display_name, u.avatar_url
     FROM posts p
     JOIN users u ON u.id = p.creator_id
     JOIN subscriptions s ON s.creator_id = p.creator_id
       AND s.subscriber_id = $1 AND s.status = 'active'
     ORDER BY p.published_at DESC
     LIMIT $2 OFFSET $3`,
    [req.user.id, limit, offset]
  );
  res.json(rows);
});

// GET /api/posts/creator/:username - get a creator's posts
router.get('/creator/:username', async (req, res) => {
  const { rows: creator } = await db.query(
    'SELECT id FROM users WHERE username = $1',
    [req.params.username]
  );
  if (!creator.length) return res.status(404).json({ error: 'Creator not found' });

  const creatorId = creator[0].id;
  const userId = req.user?.id;
  const subscribed = userId ? await isSubscribed(userId, creatorId) : false;
  const isOwnProfile = userId === creatorId;

  const { rows } = await db.query(
    `SELECT p.id, p.title, p.media_type, p.thumbnail_url,
            p.is_public, p.view_count, p.like_count, p.published_at,
            CASE WHEN p.is_public OR $3 OR $4 THEN p.body ELSE NULL END AS body,
            CASE WHEN p.is_public OR $3 OR $4 THEN p.media_url ELSE NULL END AS media_url
     FROM posts p
     WHERE p.creator_id = $1
     ORDER BY p.published_at DESC
     LIMIT 50`,
    [creatorId, null, subscribed, isOwnProfile]
  );
  res.json(rows);
});

// GET /api/posts/:id - single post
router.get('/:id', async (req, res) => {
  const { rows } = await db.query(
    `SELECT p.*, u.username, u.display_name, u.avatar_url
     FROM posts p JOIN users u ON u.id = p.creator_id
     WHERE p.id = $1`,
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Post not found' });

  const post = rows[0];
  const userId = req.user?.id;
  const subscribed = userId ? await isSubscribed(userId, post.creator_id) : false;
  const isOwner = userId === post.creator_id;

  if (!post.is_public && !subscribed && !isOwner) {
    return res.json({
      id: post.id, title: post.title, thumbnail_url: post.thumbnail_url,
      media_type: post.media_type, is_public: false, locked: true,
      username: post.username, display_name: post.display_name,
    });
  }

  // Increment view count
  await db.query('UPDATE posts SET view_count = view_count + 1 WHERE id = $1', [post.id]);
  res.json(post);
});

// POST /api/posts - create a post
router.post('/', requireAuth, requireCreator,
  body('title').trim().isLength({ min: 1, max: 300 }),
  body('body').optional().trim(),
  body('media_url').optional().isURL(),
  body('media_type').optional().isIn(['video', 'image', 'article']),
  body('is_public').isBoolean(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { title, body: postBody, media_url, media_type, thumbnail_url, is_public, tier_id } = req.body;

    const { rows } = await db.query(
      `INSERT INTO posts (creator_id, title, body, media_url, media_type, thumbnail_url, is_public, tier_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [req.user.id, title, postBody, media_url, media_type, thumbnail_url, is_public, tier_id || null]
    );

    // Update total_posts count
    await db.query(
      'UPDATE creator_profiles SET total_posts = total_posts + 1 WHERE user_id = $1',
      [req.user.id]
    );

    res.status(201).json(rows[0]);
  }
);

// DELETE /api/posts/:id
router.delete('/:id', requireAuth, async (req, res) => {
  const { rows } = await db.query('SELECT creator_id FROM posts WHERE id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Post not found' });
  if (rows[0].creator_id !== req.user.id && !req.user.is_admin) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  await db.query('DELETE FROM posts WHERE id = $1', [req.params.id]);
  await db.query(
    'UPDATE creator_profiles SET total_posts = total_posts - 1 WHERE user_id = $1',
    [rows[0].creator_id]
  );
  res.json({ message: 'Post deleted' });
});

// POST /api/posts/:id/like
router.post('/:id/like', requireAuth, async (req, res) => {
  try {
    await db.query('INSERT INTO likes (user_id, post_id) VALUES ($1, $2)', [req.user.id, req.params.id]);
    await db.query('UPDATE posts SET like_count = like_count + 1 WHERE id = $1', [req.params.id]);
    res.json({ liked: true });
  } catch {
    // Already liked - remove like
    await db.query('DELETE FROM likes WHERE user_id = $1 AND post_id = $2', [req.user.id, req.params.id]);
    await db.query('UPDATE posts SET like_count = like_count - 1 WHERE id = $1', [req.params.id]);
    res.json({ liked: false });
  }
});

module.exports = router;
