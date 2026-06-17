# ONYX — Idea Backlog

> Found during stack audit 2026-06-17. Not planned. Not built. Evaluate later.

---

## Core Strengths

```
📧 EMAIL AS API    →  Inbound email → AI auto-process
🧠 AI AT THE EDGE  →  Workers AI, 3 models, zero latency
💰 PAYMENT NATIVE  →  VietQR + subscription + PPV built-in
📱 PWA MOBILE      →  OnlyFans-style UI, bottom tabs, gestures
🔄 DO ISOLATION    →  7 Durable Objects, SQLite per-user
```

---

## 7 New Products on Core

### 1. AI Business Inbox
Thay thế Front/Intercom — AI auto-respond + auto-tag + auto-bill.
```
Email → AI classify (bug/feature/sale) → AI draft → Creator 1-click approve → Auto-bill
```
**USP:** AI đọc TOÀN BỘ email history của creator để draft reply. Built-in billing.

### 2. Email-to-Content Factory
Creator gửi 1 email → auto thành post có ảnh, SEO, tier.
```
Email → publish@creator.onyx.com.vn → AI parse → auto-publish hoặc draft
```
**USP:** Viết 1 lần, publish everywhere. Email → feed + newsletter + social.

### 3. Pay-per-Email Newsletter
Thay thế Substack/Ghost. Micro-payment per email, not subscription.
```
Premium email → preview 3 dòng + 🔒 → tap VietQR 50k → full content
```
**USP:** Creator mới (0 subscriber) vẫn kiếm tiền từ email đầu tiên.

### 4. AI Agent Marketplace
Mỗi creator có AI agent trained trên data riêng, bán cho fans.
```
Upload knowledge base → RAG agent (DO SQLite + Vectorize) → Fans chat với "AI creator"
$5/100 messages hoặc $20/mo subscription
```
**USP:** Character.ai × OnlyFans. Fans trả tiền nói chuyện với AI clone của creator.

### 5. Live Auction via Email
Email-based auction. No app needed.
```
Email announcement → Fans reply inbox để bid → AI parse bid → Live leaderboard (WS) → Auto-bill winner
```
**USP:** Không cần app. Mở email → reply → bid. Live WebSocket leaderboard.

### 6. Creator DAO / Revenue Split
Multi-creator content channel. Revenue auto-split.
```
N creators → joint channel → contribution tracked via DO → revenue auto-split
Optional: on-chain receipt for transparency
```
**USP:** Chưa có platform nào làm multi-creator split đơn giản.

### 7. White-Label B2B SaaS
Bán nguyên stack cho agencies.
```
Agency BĐS Metro → deploy clone (custom domain) → 50 agents → per-agent DO isolation
B2B: $99/mo per 10 agents
```
**USP:** Workers for Platforms auto multi-tenant. 1 codebase → N platforms.

---

## Social Network Extension

Build mini social network trên core hiện có. Mất ~12h.

### Đã có sẵn (80%)
```
✅ GridFeed OnlyFans style    ✅ StoryBar + StoryViewer
✅ Creator profiles           ✅ DM Chat real-time
✅ WebSocket (live)           ✅ Payment built-in
✅ AI edge (3 models)         ✅ Content tiers (public/sub/ppv)
✅ PWA mobile app             ✅ 7 DOs (SQLite per user)
✅ Email routing inbound      ✅ Bottom tab bar UI
```

### Cần build (20%)
```
❌ Social graph (follow, not just subscribe)
❌ Comments UI + reaction buttons
❌ Push notifications + badge
❌ Trending/activity feed
❌ Hashtags + explore topics
❌ Repost/share
❌ User discovery (people you may know)
```

### Vision
Social network KHÔNG thuật toán độc hại. Không doom-scroll. Creator kiếm tiền trực tiếp.
```
🔥 TRENDING FEED (activity-based)
📧 Email-to-post   💬 DM   🎯 Follow   🔄 Repost
❤️ React           💬 Comment   🔔 Notification   🏷️ Hashtag
💰 Tip             🔑 PPV unlock
```

---

## Competitor Comparison

| Feature | Substack | OnlyFans | Ghost | ONYX |
|---------|----------|----------|-------|------|
| Email inbound publish | ❌ | ❌ | ❌ | ✅ |
| PPV per content | ❌ | ✅ | ❌ | ✅ |
| AI auto-draft reply | ❌ | ❌ | ❌ | ✅ |
| Agent marketplace | ❌ | ❌ | ❌ | ✅ |
| Multi-creator split | ❌ | ❌ | ❌ | ✅ |
| VietQR payment | ❌ | ❌ | ❌ | ✅ |
| White-label B2B | ❌ | ❌ | ❌ | ✅ |
| Own data (not platform-locked) | ❌ | ❌ | ❌ | ✅ |

---

## Cloudflare Services — Not Yet Used

| Priority | Service | Feature | Effort |
|----------|---------|---------|--------|
| P0 | CF Access | JWT auth production, secrets | 30min |
| P0 | R2 Events | Auto NSFW scan on upload | 2h |
| P1 | CF Queues | Async AI draft + webhook retry | 4h |
| P1 | DO Alarms ext | Scheduled posts + expiry notifications | 2h |
| P2 | Vectorize | Semantic search + feed recommendations | 8h |
| P2 | Workflows | Subscription lifecycle engine | 6h |
| P3 | WAF Rules | Edge rate limiting | 1h |
| P3 | KV | Feature flags + distributed counters | 1h |
| P4 | Browser Rendering | Email preview thumbnails, PDF invoices | 4h |
| P4 | Analytics Engine | MRR dashboard, conversion funnel | 4h |

---

## Gaps Found

1. **NSFW stub = `return { safe: true }`** — real production safety gap
2. **SePay webhook no retry** — lost payments silently
3. **Rate limiter in-memory** — resets on Worker restart
4. **CF Access secrets missing** — running DEMO_MODE
5. **AI auto-draft not wired** — `receiveEmail()` doesn't call `EmailAgent`
6. **No post-upload image processing** — R2 Events would close this

---

## TL;DR

ONYX = Substack + OnlyFans + Intercom + Character.ai → all in email. All via Cloudflare edge.
