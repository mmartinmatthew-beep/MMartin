# CreatorHub — Creator Monetization Platform

A Patreon/OnlyFans alternative with **transparent, rule-based content moderation**.
No arbitrary bans. Every moderation action cites a specific, written policy rule.
Creators always have the right to appeal.

---

## Features

- **Creator profiles** with subscription tiers (you set the price)
- **Stripe Connect** — money goes directly to creators, platform takes 8%
- **Video / image / article posts** with subscriber-only gating
- **Transparent content policy** — only 5 specific rules, publicly viewable
- **Appeals system** — every moderation action can be appealed, reviewed by a human within 5 business days
- **No shadow bans** — creators can always see their own metrics

---

## Quick Start

### Prerequisites
- Docker + Docker Compose
- Stripe account (for payments)

### 1. Clone and configure
```bash
cp backend/.env.example backend/.env
# Edit backend/.env — add your Stripe keys
```

### 2. Run
```bash
docker-compose up
```

- Frontend: http://localhost:3000
- API: http://localhost:4000
- Database: postgres://dev:devpassword@localhost:5432/creator_platform

### 3. Stripe webhooks (local dev)
```bash
stripe listen --forward-to localhost:4000/api/webhooks/stripe
```

---

## Architecture

```
platform/
├── backend/               # Node.js + Express API
│   └── src/
│       ├── routes/
│       │   ├── auth.js          # Register / login / JWT
│       │   ├── creators.js      # Creator profiles, browse
│       │   ├── posts.js         # CRUD posts, feed, likes
│       │   ├── subscriptions.js # Tiers, Stripe Checkout, cancel
│       │   ├── moderation.js    # Policy, reports, appeals
│       │   └── webhooks.js      # Stripe webhook handler
│       └── db/
│           └── schema.sql       # Full PostgreSQL schema
└── frontend/              # React SPA
    └── src/
        ├── pages/
        │   ├── Home.jsx          # Creator discovery
        │   ├── CreatorProfile.jsx
        │   ├── Dashboard.jsx     # Creator + subscriber dashboard
        │   ├── Auth.jsx          # Login / register
        │   └── ContentPolicy.jsx # Public policy page
        └── services/api.js       # Axios API client
```

---

## Content Policy

The platform only moderates content under these 5 rules:

| Rule | Description |
|------|-------------|
| `illegal-content` | Content illegal under applicable law (e.g. CSAM, incitement to violence) |
| `doxxing` | Publishing private personal info without consent |
| `targeted-harassment` | Coordinated harassment of a private individual |
| `fraud` | Deliberate financial fraud or deceptive fundraising |
| `spam` | Automated spam unrelated to the creator's stated purpose |

**Viewpoint, political opinion, and subject matter are NOT moderation criteria.**

---

## Deployment

For production:
- Host backend on **Railway**, **Render**, or a VPS
- Host frontend on **Vercel** or **Netlify**
- Use **Neon** or **Supabase** for managed PostgreSQL
- Use **Cloudflare R2** for cheap S3-compatible media storage
- Set all env vars from `.env.example`
- Run `stripe listen` or configure Stripe Dashboard webhook pointing to `/api/webhooks/stripe`
