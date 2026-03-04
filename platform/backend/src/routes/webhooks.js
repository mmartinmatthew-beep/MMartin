/**
 * Stripe Webhook Handler
 * Handles subscription lifecycle events from Stripe
 */
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../db');

const router = express.Router();

// Raw body needed for Stripe signature verification
router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ error: `Webhook signature verification failed` });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode !== 'subscription') break;

        const { tier_id, creator_id, subscriber_id } = session.metadata;
        const stripeSub = await stripe.subscriptions.retrieve(session.subscription);

        await db.query(
          `INSERT INTO subscriptions
            (subscriber_id, creator_id, tier_id, stripe_subscription_id,
             status, current_period_start, current_period_end)
           VALUES ($1, $2, $3, $4, 'active', to_timestamp($5), to_timestamp($6))
           ON CONFLICT (subscriber_id, creator_id) DO UPDATE
           SET tier_id = $3, stripe_subscription_id = $4, status = 'active',
               current_period_start = to_timestamp($5), current_period_end = to_timestamp($6)`,
          [
            subscriber_id, creator_id, tier_id, session.subscription,
            stripeSub.current_period_start, stripeSub.current_period_end,
          ]
        );

        await db.query(
          'UPDATE creator_profiles SET subscriber_count = subscriber_count + 1 WHERE user_id = $1',
          [creator_id]
        );

        // Notify creator
        const { rows: tierRows } = await db.query('SELECT name, price_cents FROM tiers WHERE id = $1', [tier_id]);
        const { rows: subUser } = await db.query('SELECT display_name FROM users WHERE id = $1', [subscriber_id]);
        await db.query(
          `INSERT INTO notifications (user_id, type, title, body)
           VALUES ($1, 'new_subscriber', $2, $3)`,
          [creator_id, 'New subscriber!', `${subUser[0]?.display_name} subscribed to your ${tierRows[0]?.name} tier`]
        );
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const sub = await stripe.subscriptions.retrieve(invoice.subscription);

        await db.query(
          `UPDATE subscriptions
           SET current_period_start = to_timestamp($1), current_period_end = to_timestamp($2), status = 'active'
           WHERE stripe_subscription_id = $3`,
          [sub.current_period_start, sub.current_period_end, invoice.subscription]
        );

        // Record payment
        await db.query(
          `INSERT INTO payments (subscription_id, stripe_payment_intent_id, amount_cents, platform_fee_cents, creator_payout_cents, status)
           SELECT id, $2, $3, $4, $5, 'succeeded'
           FROM subscriptions WHERE stripe_subscription_id = $1`,
          [
            invoice.subscription,
            invoice.payment_intent,
            invoice.amount_paid,
            Math.round(invoice.amount_paid * parseFloat(process.env.PLATFORM_FEE_PERCENT || '8') / 100),
            Math.round(invoice.amount_paid * (1 - parseFloat(process.env.PLATFORM_FEE_PERCENT || '8') / 100)),
          ]
        );
        break;
      }

      case 'customer.subscription.deleted': {
        await db.query(
          `UPDATE subscriptions SET status = 'cancelled', cancelled_at = NOW()
           WHERE stripe_subscription_id = $1`,
          [event.data.object.id]
        );
        break;
      }

      case 'invoice.payment_failed': {
        await db.query(
          `UPDATE subscriptions SET status = 'past_due' WHERE stripe_subscription_id = $1`,
          [event.data.object.subscription]
        );
        break;
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook processing error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;
