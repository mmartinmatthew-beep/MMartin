require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const creatorRoutes = require('./routes/creators');
const postRoutes = require('./routes/posts');
const subscriptionRoutes = require('./routes/subscriptions');
const moderationRoutes = require('./routes/moderation');
const webhookRoutes = require('./routes/webhooks');
const { requireAuth } = require('./middleware/auth');

const app = express();

// Security headers
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Stripe webhooks need raw body - register before json middleware
app.use('/api/webhooks/stripe', webhookRoutes);

// Body parsing
app.use(express.json({ limit: '2mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Auth rate limit (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many requests, please try again later' },
});
app.use('/api/auth/', authLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/creators', creatorRoutes);
app.use('/api/posts', (req, res, next) => {
  // Optionally attach user from token without requiring auth
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    const jwt = require('jsonwebtoken');
    const db = require('./db');
    try {
      const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
      db.query('SELECT id, is_creator, is_admin FROM users WHERE id = $1', [payload.userId])
        .then(({ rows }) => { req.user = rows[0]; next(); })
        .catch(() => next());
    } catch { next(); }
  } else { next(); }
}, postRoutes);
app.use('/api/subscriptions', requireAuth, subscriptionRoutes);
app.use('/api/moderation', moderationRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// 404
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));

module.exports = app;
