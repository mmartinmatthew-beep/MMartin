const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const PLATFORM_FEE = parseFloat(process.env.PLATFORM_FEE_PERCENT || '8') / 100;

// POST /api/subscriptions/tiers - creator creates a tier
router.post('/tiers', requireAuth, async (req, res) => {
  if (!req.user.is_creator) return res.status(403).json({ error: 'Creator account required' });
  const { name, description, price_cents, benefits } = req.body;

  if (!name || !price_cents || price_cents < 100) {
    return res.status(400).json({ error: 'name and price_cents (min 100) required' });
  }

  const { rows } = await db.query(
    `INSERT INTO tiers (creator_id, name, description, price_cents, benefits)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [req.user.id, name, description, price_cents, benefits || []]
  );
  res.status(201).json(rows[0]);
});

// POST /api/subscriptions/checkout - subscribe to a creator
router.post('/checkout', requireAuth, async (req, res) => {
  const { tier_id } = req.body;

  const { rows: tierRows } = await db.query(
    'SELECT t.*, u.stripe_account_id FROM tiers t JOIN users u ON u.id = t.creator_id WHERE t.id = $1 AND t.is_active = TRUE',
    [tier_id]
  );
  if (!tierRows.length) return res.status(404).json({ error: 'Tier not found' });
  const tier = tierRows[0];

  if (tier.creator_id === req.user.id) {
    return res.status(400).json({ error: 'Cannot subscribe to yourself' });
  }

  // Ensure Stripe customer exists for subscriber
  let customerId = req.user.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: req.user.email });
    customerId = customer.id;
    await db.query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [customerId, req.user.id]);
  }

  // Create Stripe Checkout Session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        unit_amount: tier.price_cents,
        recurring: { interval: 'month' },
        product_data: { name: `${tier.name} - Creator Subscription` },
      },
      quantity: 1,
    }],
    success_url: `${process.env.FRONTEND_URL}/subscribed?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.FRONTEND_URL}/subscribe/${tier_id}`,
    metadata: {
      tier_id: tier.id,
      creator_id: tier.creator_id,
      subscriber_id: req.user.id,
    },
    // Route funds to creator via Stripe Connect
    payment_intent_data: tier.stripe_account_id ? {
      application_fee_amount: Math.round(tier.price_cents * PLATFORM_FEE),
      transfer_data: { destination: tier.stripe_account_id },
    } : undefined,
  });

  res.json({ url: session.url });
});

// GET /api/subscriptions/my - user's active subscriptions
router.get('/my', requireAuth, async (req, res) => {
  const { rows } = await db.query(
    `SELECT s.id, s.status, s.current_period_end,
            t.name AS tier_name, t.price_cents,
            u.username, u.display_name, u.avatar_url
     FROM subscriptions s
     JOIN tiers t ON t.id = s.tier_id
     JOIN users u ON u.id = s.creator_id
     WHERE s.subscriber_id = $1
     ORDER BY s.created_at DESC`,
    [req.user.id]
  );
  res.json(rows);
});

// GET /api/subscriptions/subscribers - creator's subscribers
router.get('/subscribers', requireAuth, async (req, res) => {
  if (!req.user.is_creator) return res.status(403).json({ error: 'Creator account required' });

  const { rows } = await db.query(
    `SELECT s.id, s.status, s.created_at, s.current_period_end,
            t.name AS tier_name, t.price_cents,
            u.username, u.display_name
     FROM subscriptions s
     JOIN tiers t ON t.id = s.tier_id
     JOIN users u ON u.id = s.subscriber_id
     WHERE s.creator_id = $1 AND s.status = 'active'
     ORDER BY s.created_at DESC`,
    [req.user.id]
  );
  res.json(rows);
});

// DELETE /api/subscriptions/:id - cancel subscription
router.delete('/:id', requireAuth, async (req, res) => {
  const { rows } = await db.query(
    'SELECT * FROM subscriptions WHERE id = $1 AND subscriber_id = $2',
    [req.params.id, req.user.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Subscription not found' });

  const sub = rows[0];
  if (sub.stripe_subscription_id) {
    await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: true });
  }

  await db.query(
    `UPDATE subscriptions SET status = 'cancelled', cancelled_at = NOW() WHERE id = $1`,
    [req.params.id]
  );
  res.json({ message: 'Subscription cancelled at end of billing period' });
});

module.exports = router;
