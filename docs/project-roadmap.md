# ONYX � Project Roadmap

| Field | Value |
|---|---|
| **Last updated** | 2026-06-17 |
| **Status** | V1 + V1.5 + V2 + **Wave 3 (Phase 03, 06, 07) shipped** (internal use, prod `box.onyx.com.vn`) |
| **Next milestone** | V3 quality (on demand) / Stripe integration / NSFW real integration |
| **Git** | `https://github.com/console-ai-vn/onlyfans-email` |

---

## 1. Current state

**V1** (core email client + AI + MCP) and **V1.5** (social/conversation layer) are both shipped and running on `box.onyx.com.vn`.

### 1.1 Shipped in V1

- Cloudflare Access JWT auth, fail-closed in prod
- Mailbox CRUD + per-mailbox DO isolation
- Send / receive / reply / forward (internal-only)
- Threading by `In-Reply-To` / `References` + subject fallback (7-day window)
- Drafts, folders (system + custom), search (Gmail-style DSL)
- Image attachments (JPEG/PNG/WebP, 10MB/25MB)
- Rich-text composer (TipTap), sandboxed HTML iframe (DOMPurify + CSP)
- AI agent (kimi-k2.5) with auto-draft on inbound (prompt-injection scan, fail-closed)
- MCP server (20 tools) at `/mcp`
- Rate limit 20/hr, 100/day per mailbox

### 1.2 Shipped in V1.5 (was "V2-deferred" in older docs)

- Social graph (`contacts` + `conversation_participants`)
- Conversation state (status, priority, assignee, needs_reply)
- Internal notes (per-thread, max 5000 chars)
- Conversation events (received, sent, note_created, state_updated)
- Internal-only delivery � external recipients blocked at the API
- Mobile-friendly `MobileSocialInboxCard`, `ConversationStateControls`, `SocialContextSheet`
- Public landing page + signup form at `start.onyx.com.vn`
- Forwarding enabled (`ALLOW_FORWARDING = true`)

> **The "V2 deferred" items in [`project-overview-pdr.md`](./project-overview-pdr.md) are now V1.5 shipped.** The PDR is being updated to reflect this. Don't trust the old "V2" labels for social/notes/state.

---

## 2. Shipped: V2 � Audit + Retention + Hardening

Theme: **observability + control** for production use. Deployed **2026-06-08** (`bd599f59`).

| ID | Item | Status |
|---|---|---|
| **V2-1** | Audit log table + admin viewer (`/mailbox/:id/audit`) | ? |
| **V2-2** | Retention (Trash 30d purge, Sent 1y archive) + admin test mode | ? |
| **V2-3** | `POLICY_AUD` + `TEAM_DOMAIN` as wrangler secrets | ? |
| **V2-4** | Per-mailbox permissions (viewer/member/manager + API) | ? (UI in admin/domains) |
| **V2-5** | Domain management UI (`/mailbox/:id/admin/domains`, R2 config) | ? |
| **V2-6** | Full mailbox deletion (R2 attachments + DO delete) | ? admin-only |
| **V2-7** | App-level CSP (enforce, not report-only) | ? |
| **V2-8** | CI pipeline (typecheck + test + lint + build) | ? `.github/workflows/ci.yml` |

**V2 pulled forward from V3:** ESLint + `pnpm lint` (was V3-1).

---

## 2.5. Shipped: Phase 02 ? Payment Subscription (SePay + PaymentDO)

Theme: **monetization** for ONYX as a platform. Deployed **2026-06-14**.

| ID | Item | Status |
|---|---|---|
| **P2-1** | PaymentDO (SQLite: subscriptions, invoices, payment_logs) | ? |
| **P2-2** | SePay VietQR checkout (`POST /api/v1/payments/checkout`) | ? |
| **P2-3** | SePay webhook handler (HMAC verification, idempotency) | ? |
| **P2-4** | Subscription lifecycle: pending ? active ? past_due ? cancelled | ? |
| **P2-5** | Alarm-based renewal check (6hr interval, 3-day expiring window) | ? |
| **P2-6** | Stripe webhook stub (not yet implemented) | ? |
| **P2-7** | Frontend: `useCheckout`, `useSubscription`, `useInvoice`, `useCancelSubscription`, `useInvoices` queries | ? |
| **P2-8** | 3 tiers: basic (190k), pro (490k), premium (990k) VND/month | ? |
| **P2-9** | Payment tests (14 suites: pricing, webhook, idempotency, state machine, migrations, etc.) | ? `tests/payment.test.ts` (870 LOC) |

## 2.6. Shipped: Phase 05 ? Media Pipeline (Cloudflare Stream + Images)

Theme: **video/image upload pipeline** for content creators. Deployed **2026-06-16**.

| ID | Item | Status |
|---|---|---|
| **P5-1** | Cloudflare Stream direct upload (`workers/lib/stream.ts`) | ? |
| **P5-2** | Video status polling (processing ? ready ? error), delete, list by creatorId | ? |
| **P5-3** | Cloudflare Images direct upload (`workers/lib/images.ts`) | ? |
| **P5-4** | Image variants via `imagedelivery.net` (original, thumbnail, medium, full) | ? |
| **P5-5** | Signed Stream token generation (HMAC JWT via `jose`, `sub=videoId`, configurable expiry) | ? |
| **P5-6** | R2 fallback upload for generic files (`POST /api/v1/media/upload/r2`) | ? |
| **P5-7** | R2 media proxy (`GET /api/v1/media/r2/*`) | ? |
| **P5-8** | Media access control via org membership (`assertOrgMemberMediaAccess`) | ? |
| **P5-9** | Frontend: `useStreamUploadUrl`, `useVideoStatus`, `useVideosList`, `useImageUploadUrl`, `useImageVariants`, `useImagesList`, `useR2Upload`, `useSignedStreamToken` | ? |
| **P5-10** | Media tests (stream lib, images lib, R2 upload, routes, signed tokens, UI helpers) | ? `tests/media.test.ts` (806 LOC) |

---

## 2.7. Shipped: Phase 03 ? InventoryDO (Virtual Item Shop)

Theme: **virtual goods monetization** with 4 item types. Deployed **2026-06-17**.

| ID | Item | Status |
|---|---|---|
| **P3-1** | InventoryDO (SQLite: catalog, user_inventories, consumption_log) | ? |
| **P3-2** | 4 item types: `key` (permanent unlock), `token` (one-time use), `gift` (sendable), `pass` (event/gate access) | ? |
| **P3-3** | Catalog API: `POST /api/v1/inventory/catalog` (create, admin-only), `GET`, `PATCH`, `DELETE` | ? |
| **P3-4** | Purchase flow: `POST /api/v1/inventory/purchase` (creates PaymentDO subscription + grants item) | ? |
| **P3-5** | Consume flow: `POST /api/v1/inventory/consume` (marks item consumed + logs usage) | ? |
| **P3-6** | User inventory: `GET /api/v1/inventory/inventory/:userEmail` (filtered by type/status) | ? |
| **P3-7** | Purchase history: `GET /api/v1/inventory/history/:userEmail` | ? |
| **P3-8** | Alarm-based item expiry (1hr interval, auto-marks expired items) | ? |
| **P3-9** | Frontend: shop page (`/shop`), `useCatalog`, `usePurchaseItem`, `useInventory` queries | ? |
| **P3-10** | Item validation: type enum check, name/description length limits, price range per type (max VND 20M for pass) | ? |

## 2.8. Shipped: Phase 06 ? LiveDO (Live Streaming + WebSocket Chat)

Theme: **real-time live streaming** with chat. Deployed **2026-06-17**.

| ID | Item | Status |
|---|---|---|
| **P6-1** | LiveDO (SQLite: live_events, live_chat, live_viewers) with WebSocket Hibernation | ? |
| **P6-2** | Event lifecycle: scheduled ? live ? ended ? cancelled, with timestamps | ? |
| **P6-3** | Stream Live Input auto-provisioning (RTMPS ingest URL + HLS playback URL via CF Stream API) | ? |
| **P6-4** | Stream Live Input cleanup on event end (DELETE the CF Stream live input) | ? |
| **P6-5** | Pass-gated events (pass_price > 0 requires pass verification or active subscription) | ? |
| **P6-6** | WebSocket chat: Hibernation-ready, HTML sanitize + bad word filter (EN + VI), 1 msg/sec rate limit | ? |
| **P6-7** | Viewer tracking: join/leave system messages, live viewer count, unique active viewers | ? |
| **P6-8** | API routes: `POST /api/v1/live/create`, `:eventId/start`, `:eventId/end`, `:eventId/join`, `GET :eventId`, `GET list/:creatorMailboxId`, `GET schedule`, `GET :eventId/viewers`, `GET :eventId/chat` (WS upgrade) | ? |
| **P6-9** | Frontend: live stream page (`/live/:eventId`) with `LivePlayer`, `LiveChat`, `LiveViewerCount` components | ? |
| **P6-10** | Frontend: schedule page (`/live-schedule`) with live/upcoming/past event grids | ? |

## 2.9. Shipped: Phase 07 ? Security Hardening

Theme: **production security posture**. Deployed **2026-06-17**.

| ID | Item | Status |
|---|---|---|
| **P7-1** | JWT refresh/access token rotation (`workers/lib/token-refresh.ts`): HS256, 30d refresh, 12h access | ? |
| **P7-2** | `POST /api/v1/auth/refresh` and `POST /api/v1/auth/access-token` endpoints | ? |
| **P7-3** | New secrets: `REFRESH_SECRET`, `ACCESS_SECRET` (both `openssl rand -base64 32`) | ? |
| **P7-4** | Cloudflare Turnstile integration stub: `TURNSTILE_SITE_KEY` (vars), `TURNSTILE_SECRET_KEY` (secret) | ? |
| **P7-5** | Sliding-window rate limiter (`workers/lib/rate-limiter.ts`): in-memory, path-pattern matching, auto-cleanup | ? |
| **P7-6** | Rate-limited endpoints: signup (5/min), checkout (10/min) via `cf-connecting-ip` | ? |
| **P7-7** | Security headers middleware (`workers/lib/security-headers.ts`): HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COOP | ? |
| **P7-8** | CSP headers (`applyCspHeaders`): compatible with CF Stream, Images, Turnstile, Web Analytics; `frame-ancestors 'none'` | ? |
| **P7-9** | NSFW image scan stub (`workers/lib/nsfw-stub.ts`): `POST /api/v1/security/scan-image`, always returns `{ safe: true }` | ? |
| **P7-10** | Security tests: `tests/security-hardening.test.ts` (sanitize, agent route parsing, tool auth forwarding) | ? |

---

## 3. Backlog: V3 � Quality + Scale

Theme: **remove tech debt, harden the foundations.**

| ID | Item | Why | Effort |
|---|---|---|---|
| **V3-1** | ~~ESLint + Prettier + `pnpm lint` / `format`~~ | **Done in V2** � Prettier/format script still optional | � |
| **V3-2** | Refactor `AgentPanel.tsx` (592 LOC) into smaller hooks | See tech debt � 3.5 | M |
| **V3-3** | Refactor `EmailPanel.tsx` (440 LOC), `home.tsx` (366), `email-list.tsx` (352) | Same | M |
| **V3-4** | Fix N+1 write on read in `getThreadEmails` (`workers/durableObject/index.ts`) � `upsertSocialGraphForEmail` runs on every read | Perf at scale | S |
| **V3-5** | Atomic draft save (delete + create in one transaction) | `workers/index.ts:330` TODO | S |
| **V3-6** | MCPPanel hardcoded 14 tools, server exposes 20 � sync | Drift | S |
| **V3-7** | `DEMO_MODE` env-assertion guard in prod | Fail-closed in prod | S |
| **V3-8** | Move `ALLOW_FORWARDING` to env var | Deletion now admin-gated (no flag) | S |
| **V3-9** | Replace 2-space indent in `app/entry.server.tsx` with tabs | Inconsistent | S |
| **V3-10** | Replace `window.confirm` (3 places) with Kumo `Dialog` | Bypasses design system | S |

---

## 4. Considered, rejected

| Idea | Why not |
|---|---|
| **IMAP / POP3 / SMTP clients** | Out of scope; we ARE the server. |
| **Mobile native apps** | Web is responsive; team is small. |
| **Multi-region replication** | DOs are pinned to a region by design; R2 is already global. |
| **Natural language search** | Gmail-style DSL ships in V1; NL is a research project. |
| **CRM layer** (`metro-mail.txt:81-84`) | Separate product line. |
| **Public-internet inbox** | Email is **internal-only** by design � see outbound guard in landing. |

---

## 5. Success metrics (North Star)

- **$10k MRR within 12 months** from one of: real estate content, CFP � AI advisory, DAIN framework.
- ONYX is the **internal tool that keeps the team unblocked** � not the product. Treat outages as P1.
- Time-to-first-email-from-cold-DO: < 300ms (current: ~100-300ms, see [`system-architecture.md`](./system-architecture.md) � Operational Notes).

---

## 6. See also

- [`project-overview-pdr.md`](./project-overview-pdr.md) � V1 scope, PDR, acceptance criteria.
- [`system-architecture.md`](./system-architecture.md) � 9 � full known TODOs.
- [`code-standards.md`](./code-standards.md) � 9 � linting gap.
- Root [`README.md`](../README.md) � "Known Limitations".
