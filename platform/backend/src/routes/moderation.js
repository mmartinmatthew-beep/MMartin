/**
 * Moderation routes - transparent, policy-based moderation
 *
 * Philosophy: No arbitrary bans. Every action cites a specific policy rule.
 * All actions are logged. Creators always have a right to appeal.
 */
const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Defined policy rules (only these can be cited for moderation actions)
const POLICY_RULES = {
  'illegal-content': 'Content that is illegal under applicable law (e.g. CSAM, incitement to violence)',
  'doxxing': 'Publishing private personal information (addresses, phone numbers) of individuals without consent',
  'targeted-harassment': 'Coordinated harassment campaigns targeting a specific private individual',
  'fraud': 'Deliberate financial fraud or deceptive fundraising',
  'spam': 'Automated or bulk spam posting unrelated to the creator\'s stated purpose',
};

// GET /api/moderation/policy - public: view the content policy
router.get('/policy', (req, res) => {
  res.json({
    platform_name: 'CreatorHub',
    policy_version: '1.0.0',
    last_updated: '2024-01-01',
    summary: 'We only moderate content that violates clear, specific rules listed below. We do not moderate based on political viewpoint, opinion, or subject matter.',
    rules: POLICY_RULES,
    appeals_process: 'Any moderation action can be appealed within 30 days. Appeals are reviewed by a human moderator within 5 business days.',
  });
});

// POST /api/moderation/report - report content
router.post('/report', requireAuth, async (req, res) => {
  const { post_id, user_id, policy_rule, statement } = req.body;

  if (!POLICY_RULES[policy_rule]) {
    return res.status(400).json({
      error: 'Invalid policy rule',
      valid_rules: Object.keys(POLICY_RULES),
    });
  }

  if (!post_id && !user_id) {
    return res.status(400).json({ error: 'Must specify post_id or user_id to report' });
  }

  await db.query(
    `INSERT INTO moderation_actions (target_post_id, target_user_id, action, reason, policy_rule, notes, admin_id)
     VALUES ($1, $2, 'pending_review', $3, $4, $5, NULL)`,
    [post_id || null, user_id || null, policy_rule, POLICY_RULES[policy_rule], statement || '']
  );

  res.json({ message: 'Report submitted. Reports are reviewed within 3 business days.' });
});

// --- Admin-only routes ---

// GET /api/moderation/queue - pending moderation reports
router.get('/queue', requireAuth, requireAdmin, async (req, res) => {
  const { rows } = await db.query(
    `SELECT m.*, u.username AS target_username, p.title AS post_title
     FROM moderation_actions m
     LEFT JOIN users u ON u.id = m.target_user_id
     LEFT JOIN posts p ON p.id = m.target_post_id
     WHERE m.action = 'pending_review'
     ORDER BY m.created_at ASC`
  );
  res.json(rows);
});

// POST /api/moderation/act - take a moderation action
router.post('/act', requireAuth, requireAdmin, async (req, res) => {
  const { target_user_id, target_post_id, action, policy_rule, notes } = req.body;

  if (!POLICY_RULES[policy_rule]) {
    return res.status(400).json({ error: 'Action must cite a valid policy rule' });
  }

  const validActions = ['warn', 'remove_post', 'suspend', 'ban'];
  if (!validActions.includes(action)) {
    return res.status(400).json({ error: `action must be one of: ${validActions.join(', ')}` });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO moderation_actions (target_user_id, target_post_id, action, reason, policy_rule, notes, admin_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [target_user_id, target_post_id, action, policy_rule, POLICY_RULES[policy_rule], notes, req.user.id]
    );

    if (action === 'remove_post' && target_post_id) {
      await client.query('DELETE FROM posts WHERE id = $1', [target_post_id]);
    }

    if (action === 'ban' && target_user_id) {
      // Soft ban: mark account but don't delete data (creator can appeal)
      await client.query(
        `UPDATE users SET is_creator = FALSE WHERE id = $1`,
        [target_user_id]
      );
    }

    // Always notify the affected creator of the action and appeal rights
    const affectedUser = target_user_id || (target_post_id
      ? (await client.query('SELECT creator_id FROM posts WHERE id = $1', [target_post_id])).rows[0]?.creator_id
      : null);

    if (affectedUser) {
      await client.query(
        `INSERT INTO notifications (user_id, type, title, body, link)
         VALUES ($1, 'moderation', $2, $3, $4)`,
        [
          affectedUser,
          'Content Moderation Notice',
          `Action taken: ${action}. Reason: ${POLICY_RULES[policy_rule]}. You have the right to appeal this decision.`,
          `/appeals/new/${rows[0].id}`,
        ]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Moderation action taken', action_id: rows[0].id });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Action failed' });
  } finally {
    client.release();
  }
});

// POST /api/moderation/appeals - submit an appeal
router.post('/appeals', requireAuth, async (req, res) => {
  const { action_id, statement } = req.body;
  if (!statement?.trim()) return res.status(400).json({ error: 'Statement required' });

  const { rows } = await db.query('SELECT * FROM moderation_actions WHERE id = $1', [action_id]);
  if (!rows.length) return res.status(404).json({ error: 'Moderation action not found' });
  if (rows[0].target_user_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only appeal actions against your account' });
  }

  const { rows: existing } = await db.query('SELECT id FROM appeals WHERE action_id = $1 AND user_id = $2', [action_id, req.user.id]);
  if (existing.length) return res.status(409).json({ error: 'You have already submitted an appeal for this action' });

  await db.query(
    'INSERT INTO appeals (action_id, user_id, statement) VALUES ($1, $2, $3)',
    [action_id, req.user.id, statement]
  );
  res.status(201).json({ message: 'Appeal submitted. You will receive a response within 5 business days.' });
});

// GET /api/moderation/appeals - admin: view pending appeals
router.get('/appeals', requireAuth, requireAdmin, async (req, res) => {
  const { rows } = await db.query(
    `SELECT ap.*, m.action, m.policy_rule, u.username
     FROM appeals ap
     JOIN moderation_actions m ON m.id = ap.action_id
     JOIN users u ON u.id = ap.user_id
     WHERE ap.status = 'pending'
     ORDER BY ap.created_at ASC`
  );
  res.json(rows);
});

// PATCH /api/moderation/appeals/:id - admin: resolve appeal
router.patch('/appeals/:id', requireAuth, requireAdmin, async (req, res) => {
  const { status, reviewer_notes } = req.body;
  if (!['upheld', 'overturned'].includes(status)) {
    return res.status(400).json({ error: 'status must be upheld or overturned' });
  }

  const { rows } = await db.query(
    `UPDATE appeals SET status = $1, reviewer_id = $2, reviewer_notes = $3, resolved_at = NOW()
     WHERE id = $4 RETURNING *`,
    [status, req.user.id, reviewer_notes, req.params.id]
  );

  if (!rows.length) return res.status(404).json({ error: 'Appeal not found' });

  // Notify the appealing user
  await db.query(
    `INSERT INTO notifications (user_id, type, title, body)
     VALUES ($1, 'appeal_resolved', $2, $3)`,
    [
      rows[0].user_id,
      `Your appeal was ${status}`,
      status === 'overturned'
        ? 'Good news: your appeal was successful. The moderation action has been reversed.'
        : `Your appeal was reviewed and the original decision was upheld. Reason: ${reviewer_notes || 'See platform policy.'}`,
    ]
  );

  res.json(rows[0]);
});

module.exports = router;
