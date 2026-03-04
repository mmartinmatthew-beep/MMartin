-- Creator Monetization Platform - Database Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (both creators and subscribers share this)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(100),
  bio TEXT,
  avatar_url TEXT,
  is_creator BOOLEAN DEFAULT FALSE,
  is_admin BOOLEAN DEFAULT FALSE,
  stripe_customer_id VARCHAR(255),
  stripe_account_id VARCHAR(255),   -- for creator payouts via Stripe Connect
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Creator profiles (extra info for creators)
CREATE TABLE creator_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  tagline VARCHAR(200),
  cover_image_url TEXT,
  category VARCHAR(100),            -- e.g. 'education', 'fitness', 'news', 'comedy'
  tags TEXT[],
  subscriber_count INT DEFAULT 0,
  total_posts INT DEFAULT 0,
  onboarding_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscription tiers (creators define their own tiers)
CREATE TABLE tiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price_cents INT NOT NULL,          -- monthly price in cents (e.g. 500 = $5.00)
  benefits TEXT[],
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Active subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscriber_id UUID REFERENCES users(id) ON DELETE CASCADE,
  creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
  tier_id UUID REFERENCES tiers(id),
  stripe_subscription_id VARCHAR(255) UNIQUE,
  status VARCHAR(50) DEFAULT 'active',  -- active, cancelled, past_due
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  UNIQUE(subscriber_id, creator_id)
);

-- Posts (videos, articles, images)
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(300) NOT NULL,
  body TEXT,
  media_url TEXT,                    -- S3 URL for video/image
  media_type VARCHAR(50),            -- 'video', 'image', 'article'
  thumbnail_url TEXT,
  is_public BOOLEAN DEFAULT FALSE,   -- true = free preview, false = subscribers only
  tier_id UUID REFERENCES tiers(id), -- NULL = all subscribers, set = specific tier+
  view_count INT DEFAULT 0,
  like_count INT DEFAULT 0,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES comments(id),  -- for threaded replies
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Likes
CREATE TABLE likes (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

-- Payments / payout ledger
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID REFERENCES subscriptions(id),
  stripe_payment_intent_id VARCHAR(255),
  amount_cents INT NOT NULL,
  platform_fee_cents INT NOT NULL,
  creator_payout_cents INT NOT NULL,
  currency VARCHAR(10) DEFAULT 'usd',
  status VARCHAR(50),                -- succeeded, failed, refunded
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Content policy: written moderation actions (transparent, not arbitrary)
CREATE TABLE moderation_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  target_user_id UUID REFERENCES users(id),
  target_post_id UUID REFERENCES posts(id),
  action VARCHAR(100) NOT NULL,      -- 'warn', 'remove_post', 'suspend', 'ban'
  reason VARCHAR(100) NOT NULL,      -- must be a defined policy reason
  policy_rule TEXT NOT NULL,         -- exact policy rule text cited
  notes TEXT,
  admin_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Appeals (creators can always appeal moderation)
CREATE TABLE appeals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action_id UUID REFERENCES moderation_actions(id),
  user_id UUID REFERENCES users(id),
  statement TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',  -- pending, upheld, overturned
  reviewer_id UUID REFERENCES users(id),
  reviewer_notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(100),                 -- 'new_post', 'new_subscriber', 'comment', 'payment'
  title VARCHAR(200),
  body TEXT,
  link TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_posts_creator ON posts(creator_id);
CREATE INDEX idx_subscriptions_subscriber ON subscriptions(subscriber_id);
CREATE INDEX idx_subscriptions_creator ON subscriptions(creator_id);
CREATE INDEX idx_comments_post ON comments(post_id);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
