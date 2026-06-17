# Phase 02: Payment + Subscription

## Context Links

- **plan.md**: Master plan (Wave 2)
- **Phase depends on**: Phase 01 (rebrand foundation)
- **Blocks**: Phase 04 (content gate needs payment state), Phase 08 (landing needs checkout)

## ✅ COMPLETED — 2026-06-17

**Summary**: PaymentDO implemented with SQLite-backed subscriptions, invoices, and payment_logs. SePay integration (VietQR generation, webhook HMAC verification, idempotent processing). payOS primary with auto-debit support + SePay fallback. Checkout UI with TierCard → PaymentQR → polling → redirect. Stripe stub endpoint. Full subscription lifecycle (pending→active→past_due→cancelled→expired) with recurring alarm. 256/256 tests pass, build clean.

---

## Parallelization Info

- **Wave**: W2 (parallel with Phase 05)
- **No file overlap with Phase 05** — PaymentDO vs Media routes are completely separate
- **Estimated effort**: 12h

## Overview

Implement PaymentDO (new Durable Object class for subscription state), SePay integration (VietQR + NAPAS + cards), webhook handler, app-side recurring billing logic, and Stripe fallback infrastructure. No wallet, no balance, no cash-out — per-transaction purchase model.

## Requirements

### Functional

- [x] PaymentDO class with SQLite tables for subscriptions, invoices, payment_logs
- [x] SePay webhook endpoint: verify HMAC, store payment, activate subscription
- [x] Checkout flow: user selects tier ($9/$19/$49/mo) → generates VietQR code
- [x] Tier restrictions: per-tier mailbox count, storage, features
- [x] Recurring billing: PaymentDO alarm checks expiring subscriptions, sends reminders
- [x] Subscription lifecycle: pending→active→past_due→cancelled→expired
- [x] Stripe fallback endpoint (stubbed for international, future)

### Non-Functional

- [x] SePay webhook <5s response (ack immediately, process async)
- [x] PaymentDO migration v5 in wrangler.jsonc
- [x] Idempotency: webhook replay safe (idempotency_key on payment_logs)
- [x] Audit trail: all payment events logged
- [x] Zero balance/credit system — "pay per use" legally safe

## Architecture

### PaymentDO SQLite Schema

```sql
-- subscriptions table
CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  mailbox_id TEXT NOT NULL,
  tier TEXT NOT NULL, -- 'basic','pro','premium'
  status TEXT NOT NULL DEFAULT 'pending', -- pending,active,past_due,cancelled,expired
  amount INTEGER NOT NULL, -- in VND smallest unit (e.g., 190000 for ₫190k)
  currency TEXT NOT NULL DEFAULT 'VND',
  current_period_start TEXT NOT NULL,
  current_period_end TEXT NOT NULL,
  canceled_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- invoices table
CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL,
  mailbox_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending,paid,failed,refunded
  provider TEXT NOT NULL, -- 'sepay','stripe'
  provider_txn_id TEXT,
  qr_code TEXT, -- VietQR data URL
  due_date TEXT NOT NULL,
  paid_at TEXT,
  created_at TEXT NOT NULL
);

-- payment_logs (webhook audit)
CREATE TABLE payment_logs (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT UNIQUE NOT NULL,
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  raw_payload TEXT NOT NULL,
  processed BOOLEAN DEFAULT 0,
  created_at TEXT NOT NULL
);
```

### New Worker Files

| File                                         | Purpose                                                      |
| -------------------------------------------- | ------------------------------------------------------------ |
| `workers/durableObject/payment.ts`           | PaymentDO class (state, billing, webhook processing)         |
| `workers/durableObject/paymentMigrations.ts` | SQLite migration for PaymentDO                               |
| `workers/routes/payment.ts`                  | Hono routes: `/api/v1/payments/*`                            |
| `workers/lib/sepay.ts`                       | SePay client: QR generation, webhook verification, API calls |
| `workers/lib/stripe.ts`                      | Stripe stub: webhook endpoint placeholder                    |

### Modified Worker Files

| File               | Changes                                                              |
| ------------------ | -------------------------------------------------------------------- |
| `workers/app.ts`   | Import/export PaymentDO, mount payment routes                        |
| `workers/index.ts` | Add sepay domain to internal-only bypass (webhooks from SePay IPs)   |
| `workers/types.ts` | Add Env bindings: SEPAY_API_KEY, SEPAY_WEBHOOK_SECRET, STRIPE_SECRET |
| `wrangler.jsonc`   | Add PAYMENT DO binding + migration v5, add secrets vars              |

### New App Files

| File                           | Purpose                                                |
| ------------------------------ | ------------------------------------------------------ |
| `app/routes/checkout.tsx`      | Tier selection → QR code display → polling for payment |
| `app/routes/pricing.tsx`       | Public pricing page (SSR for SEO)                      |
| `app/queries/payments.ts`      | TanStack Query hooks for payment state                 |
| `app/components/PaymentQR.tsx` | VietQR display component with countdown                |
| `app/components/TierCard.tsx`  | Pricing tier display                                   |

### Modified App Files

| File                      | Changes                           |
| ------------------------- | --------------------------------- |
| `app/routes/signup.tsx`   | Redirect to checkout after signup |
| `app/routes/settings.tsx` | Add billing management tab        |

### API Routes (routes/payment.ts)

```
POST /api/v1/payments/checkout     — Create invoice, return VietQR
GET  /api/v1/payments/invoice/:id  — Invoice status (polling)
POST /api/v1/payments/webhook/sepay — SePay webhook receiver
POST /api/v1/payments/webhook/stripe — Stripe webhook receiver (future)
GET  /api/v1/payments/subscription/:mailboxId — Current subscription
POST /api/v1/payments/subscription/:mailboxId/cancel — Cancel subscription
GET  /api/v1/payments/invoices/:mailboxId — Invoice history
```

### Recurring Billing Flow

1. PaymentDO alarm fires every 6 hours
2. Query subscriptions WHERE `current_period_end < now()` AND `status = 'active'`
3. For each: create new invoice, transition to `past_due` if unpaid > 3 days
4. Send email reminders via EmailAgent integration
5. Cancel after 14 days past_due → `status = 'cancelled'`
6. Auto-deactivate mailbox: remove from EMAIL_ADDRESSES active list

## File Ownership (Phase 02 Exclusive)

| Category           | Files                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| New DO             | `workers/durableObject/payment.ts`, `workers/durableObject/paymentMigrations.ts`                                                     |
| New libs           | `workers/lib/sepay.ts`, `workers/lib/stripe.ts`                                                                                      |
| New routes         | `workers/routes/payment.ts`                                                                                                          |
| New app routes     | `app/routes/checkout.tsx`, `app/routes/pricing.tsx`                                                                                  |
| New app queries    | `app/queries/payments.ts`                                                                                                            |
| New app components | `app/components/PaymentQR.tsx`, `app/components/TierCard.tsx`                                                                        |
| Modified           | `workers/app.ts` (export+route mount only), `workers/types.ts`, `wrangler.jsonc`, `app/routes/signup.tsx`, `app/routes/settings.tsx` |

## Implementation Steps

1. **Create PaymentDO class** with SQLite migrations (payment.ts + paymentMigrations.ts)
2. **Register in wrangler.jsonc** — binding + migration v5
3. **Implement sepay.ts** — VietQR generation, webhook HMAC verification
4. **Create payment routes** — checkout, webhook, subscription endpoints
5. **Mount routes in app.ts** — import paymentApp, `app.route("/", paymentApp)`
6. **Add secrets** — `wrangler secret put SEPAY_API_KEY`, `SEPAY_WEBHOOK_SECRET`
7. **Build checkout UI** — TierCard → PaymentQR → polling → redirect
8. **Build pricing page** — SSR public page `/pricing`
9. **Implement recurring alarm** — PaymentDO alarm handler for billing
10. **Add Stripe stub** — placeholder routes for future
11. **Write tests** — webhook idempotency, subscription lifecycle, tier enforcement
12. **Verify**: `pnpm build && pnpm typecheck && pnpm test`

## Success Criteria

- [x] VietQR code generated and displayed in checkout
- [x] SePay webhook receives payment, activates subscription
- [x] Subscription status transitions: pending→active→past_due→cancelled
- [x] Recurring alarm creates renewal invoices
- [x] Past-due subscriptions send reminders
- [x] Idempotent webhook handling (replay safe)
- [x] Stripe stub responds 501 "coming soon"
- [x] Zero "balance" or "wallet" concepts in code

## Conflict Prevention

- Phase 05 (Media) touches `workers/routes/media.ts`, `workers/lib/stream.ts` — no overlap
- Phase 03 (Items) builds on PaymentDO but doesn't modify it
- Only minimal touches in `workers/app.ts` and `wrangler.jsonc` — coordinate with Phase 05 for merge order: Phase 02 first, Phase 05 second in app.ts

## Risk Assessment

| Risk                          | Probability | Impact | Mitigation                                            |
| ----------------------------- | ----------- | ------ | ----------------------------------------------------- |
| SePay API changes             | Low         | High   | Webhook schema validation + version pin               |
| QR code expiry (5min default) | Medium      | Medium | Auto-refresh QR on expiry, polling fallback           |
| Double-charge from replay     | Medium      | High   | idempotency_key UNIQUE constraint                     |
| Recurring alarm misses        | Low         | Medium | Overlap alarms (fire every 6h), idempotent processing |
| No native recurring API       | High        | Medium | App-side logic in PaymentDO alarm, reminder emails    |

## Security Considerations

- SePay webhook: HMAC-SHA256 verification mandatory before processing
- Payment secrets in `wrangler secret put`, never in code
- PaymentDO data encrypted at rest (DO SQLite default)
- Rate limit checkout endpoint (10/min per IP)
- No credit card numbers stored — SePay handles PCI compliance
- Webhook IP allowlist (SePay static IPs) if available
