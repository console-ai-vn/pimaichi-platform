---
title: "ONYX Email — Creator Subscription Platform"
description: "Transform VSBG Box internal email into an OnlyFans-style creator subscription platform with payments, virtual items, content gating, media streaming, and live."
status: completed
priority: P1
effort: 80h
branch: main
domain: onyx.com.vn
payment: payOS (primary, auto-debit) + SePay (fallback)
tags: [platform, payments, media, streaming, rebrand, cloudflare, payos]
created: 2026-06-17
---

## Dependency Graph

```
┌──────────────────────┐
│ 1. Rebrand + Config  │ ←──── foundation (must be first)
└──────┬───────┬───────┘
       │       │
       ▼       ▼
┌──────────┐ ┌──────────────┐
│ 2. Payment│ │5. Media Pipe │  ← Wave 2: parallel
└────┬─────┘ └──┬──────┬────┘
     │          │      │
     ▼          ▼      ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│3. Items  │ │6. Live   │ │7. Sec    │  ← Wave 3: parallel after deps
└────┬─────┘ └──────────┘ └──────────┘
     │
     ▼
┌──────────────┐
│4. Content Gate│                    ← Wave 4: after 3+5
└──────┬───────┘
       ▼
┌──────────────┐
│8. Landing UX │                     ← Wave 5: after 2+3+4
└──────────────┘
```

## Execution Waves

| Wave | Phases                           | Parallel? | Est.      | Depends On  |
| ---- | -------------------------------- | --------- | --------- | ----------- |
| W1   | 1. Rebrand+Config                | solo      | ✅ done   | nothing     |
| W2   | 2. Payment + 5. Media            | parallel  | ✅ done   | Phase 1     |
| W3   | 3. Items + 6. Live + 7. Security | parallel  | ✅ done   | Phase 1/2/5 |
| W4   | 4. Content Gate                  | solo      | 10h       | Phase 3+5   |
| W5   | 8. Landing UX                    | solo      | 12h       | Phase 2+3+4 |

Total: ~80h (sequential) / ~48h (parallel with 2 devs)

## Key Architecture Decisions

1. **PaymentDO (new DO class)** — handles subscriptions, invoices, webhook verification. Per-creator billing state in DO SQLite.
2. **InventoryDO (new DO class)** — virtual item catalog, purchase records, consumption tracking. Immutable purchase log.
3. **CreatorDO (extend MailboxDO settings)** — creator-specific fields added to existing mailbox settings JSON in R2.
4. **payOS primary** — Free, ISO 27001, Auto-debit (recurring), VietQR 50+ banks, webhook API, VA support. API Key auth in header.
5. **SePay fallback** — VietQR, webhook, VA (BIDV). For banks not supported by payOS.
6. **All Cloudflare** — no external DB. R2 for blobs, DO SQLite for transactional state, D1 only if cross-DO queries needed.
7. **No wallet/balance** — per-transaction purchase. Legally safe for VN.

## File Ownership Matrix (no overlaps)

| Phase | New DO Classes | New Worker Files                               | Modified Worker Files                | New App Files                                                        | Modified App Files                |
| ----- | -------------- | ---------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------- | --------------------------------- |
| 1     | none           | none                                           | app.ts, index.ts, ~60 files (rename) | none                                                                 | ~30 files (rename)                |
| 2     | PaymentDO      | routes/payment.ts, lib/sepay.ts, lib/stripe.ts | app.ts, index.ts, wrangler.jsonc     | routes/checkout.tsx, routes/pricing.tsx                              | routes/signup.tsx                 |
| 3     | InventoryDO    | routes/inventory.ts, lib/items.ts              | app.ts, wrangler.jsonc               | routes/shop.tsx, routes/inventory.tsx                                | none                              |
| 4     | none           | lib/content-gate.ts, lib/signed-urls.ts        | app.ts, index.ts                     | routes/gate.tsx, components/GateOverlay.tsx                          | routes/mailbox-feed-layout.tsx    |
| 5     | none           | lib/stream.ts, lib/images.ts, routes/media.ts  | app.ts, wrangler.jsonc               | routes/media.tsx, components/VideoPlayer.tsx, components/Gallery.tsx | routes/mailbox-feed-layout.tsx    |
| 6     | LiveDO         | routes/live.ts, lib/live-chat.ts               | app.ts, wrangler.jsonc               | routes/live.tsx, components/LivePlayer.tsx, components/LiveChat.tsx  | none                              |
| 7     | none           | none                                           | app.ts                               | components/Turnstile.tsx                                             | root.tsx, routes/signup.tsx       |
| 8     | none           | none                                           | app.ts                               | routes/creator.tsx, routes/shop.tsx, routes/library.tsx              | routes/landing.tsx, home-feed.tsx |

## Unresolved Questions

1. ✅ SePay/payOS webhook verified — API Key header + IP whitelist + id dedup
2. Cloudflare Stream Live Input provisioning — manual vs API-automated per creator
3. NSFW content moderation strategy — automated scanning (Workers AI) vs reporting+takedown
4. ✅ Recurring billing — payOS Auto-debit (launched Apr 2026), no email reminder needed
5. ✅ Domain: onyx.com.vn — configured in Cloudflare by user
