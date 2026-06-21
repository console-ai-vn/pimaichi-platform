<div align="center">
  <h1>Pimaichi Platform</h1>
  <p><em>Single talent creator platform — pimaichi1003, ton.place-style UX</em></p>
</div>

# Pimaichi Platform

Forked from [ONYX](https://github.com/console-ai-vn/onlyfans-email), stripped for single-creator use.

**Creator:** pimaichi1003 — Vietnamese lifestyle influencer transitioning to paid content platform.

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, React Router v7 (SSR), Tailwind CSS v4, Zustand |
| Backend | Hono API on Cloudflare Workers |
| Storage | Durable Objects (SQLite), R2 (images) |
| Auth | Telegram OAuth |
| Payments | Stripe + SePay (VietQR) |
| Media | Cloudflare Stream + Images |

## Features

- Creator feed with content gate (free/subscriber/PPV)
- Subscription tiers (basic/pro/premium)
- PPV content unlock
- Tips / donations
- DM with paid messaging
- Live streaming
- Digital shop (virtual items)
- Mobile-first PWA

## Getting Started

```bash
pnpm install
pnpm dev
```

## Deployment

```bash
pnpm deploy
```
