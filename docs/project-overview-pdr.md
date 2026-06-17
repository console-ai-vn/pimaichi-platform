# ONYX ? Project Overview & Product Development Requirements (PDR)

| Field | Value |
|---|---|
| **Product** | ONYX (worker: `onyx-email`, custom domains `box.onyx.com.vn` + `start.onyx.com.vn`) |
| **Owner** | ONYX (MR.D) |
| **Status** | V1 + V1.5 + V2 + Phase 02 + Phase 05 shipped ? internal use |
| **License** | Apache 2.0 (`LICENSE`) |
| **Source of truth (as-shipped)** | `wrangler.jsonc`, `workers/`, `app/` |
| **Last updated** | 2026-06-17 |

---

## 1. What It Is

**ONYX** is a self-hosted, **internal-only** email client running on Cloudflare Workers. Fork of `cloudflare/agentic-inbox`, re-skinned and scoped to a chat-style UX for `onyx.com.vn`.

It provides:

- A **chat-style** web email client (React 19 + React Router v7 SSR, Vietnamese copy).
- **Per-mailbox isolation** in Durable Objects with SQLite storage.
- **R2-backed attachments** and mailbox settings.
- An **AI Email Agent** that auto-drafts replies (explicit user confirmation to send).
- An **MCP server** at `/mcp` with **20 typed tools** for external AI clients.
- A **social / conversation layer** (status, priority, internal notes, events, contacts).
- **Payment subscriptions** via SePay VietQR ? 3 tiers (basic/pro/premium), webhook activation, renewal auto-invoicing.
- **Media pipeline** via Cloudflare Stream (video direct upload, HLS/DASH, signed tokens) + Cloudflare Images (direct upload, variant URLs) + R2 fallback.
- **Internal-only delivery** ? the app refuses to send to external recipients.

---

## 2. Why It Exists

| Need | How ONYX solves it |
|---|---|
| Internal company email on a custom domain | CF Email Routing catch-all + Email Service send on `onyx.com.vn` |
| Chat-style UX (Telegram/Slack), not Gmail | Threaded list, bubbles-style detail, side-by-side split (`MailboxSplitView`) |
| Self-hosted, low ops | Single Worker, 3 DOs, 1 R2 bucket, Cloudflare Access |
| AI without losing control | Auto-draft on inbound, explicit click to send; prompt-injection scanner (fail-closed) |
| Programmatic access for internal agents | MCP server at `/mcp` with 20 typed tools |
| Team triage of customer threads | Social graph + state (status, priority, assignee, needs_reply) + internal notes |

---

## 3. Target User

| Group | How they authenticate | What they can do |
|---|---|---|
| **Owner** (mailbox email = self) | Cloudflare Access | Admin actions on their own mailbox |
| **Privileged user** (in `ACCESS_EMAIL_ADDRESSES`, e.g. `ceo@bdsmetro.com`) | Cloudflare Access | Access to every mailbox in `EMAIL_ADDRESSES` |
| **External AI tool** (Claude Code, Cursor) | CF Access on the same policy + `mailboxId` param to `/mcp` | All 20 MCP tools scoped by `mailboxId` |
| **Public visitor** (landing page) | None ? `start.onyx.com.vn` is in `PUBLIC_HOSTNAMES` | View landing, submit signup form (writes to R2) |

> **Trust model:** Cloudflare Access is the **only** trust boundary. Any user who passes the policy can read/write every configured mailbox by design. MCP follows the same model ? anyone with a valid JWT can call tools for any mailbox.

---

## 4. V1 Scope (Shipped)

### 4.1 Core email client

| Feature | Where |
|---|---|
| Cloudflare Access JWT validation (fail-closed in prod) | `workers/app.ts:67-111` |
| Mailbox CRUD (create gated by `EMAIL_ADDRESSES`; delete disabled) | `workers/index.ts:187-237` |
| System folders (Inbox, Sent, Drafts, Archive, Trash, Spam) + custom folders | `shared/folders.ts`, `workers/index.ts:431-450` |
| Send / receive / reply / forward (`ALLOW_FORWARDING=true`) | `workers/index.ts:264-324`, `workers/routes/reply-forward.ts` |
| Threading by `In-Reply-To` / `References`, subject fallback (7-day window) | `workers/durableObject/index.ts` (SQL CTE) |
| Drafts (race-condition noted in [`system-architecture.md`](./system-architecture.md) ? 9) | `workers/index.ts:326-340` |
| Image attachments (JPEG/PNG/WebP, 10MB/image, 25MB/message) | `workers/lib/attachments.ts:11-13` |
| Auth-checked R2 download | `workers/index.ts:469-486` |
| Rich-text composer (TipTap) | `app/components/RichTextEditor.tsx` |
| Sandboxed HTML render (DOMPurify + CSP, no `allow-same-origin`) | `app/components/EmailIframe.tsx` |
| Search (Gmail-style: `from:`, `to:`, `subject:`, `is:`, `has:`, `before:`, `after:`, free text) | `app/lib/search-parser.ts`, `workers/index.ts:454-465` |
| Rate limit 20/hr, 100/day per mailbox | `workers/durableObject/index.ts` (raw SQL count) |

### 4.2 AI / agent / MCP

| Feature | Where |
|---|---|
| AI agent chat (kimi-k2.5 via Workers AI, streaming) | `workers/agent/index.ts:338-356` |
| Agent has **13 tools** | `workers/agent/index.ts:119-333` |
| Auto-draft on inbound (Llama 3.1 8B injection scan, fail-closed) | `workers/agent/index.ts:392-617`, `workers/lib/ai.ts:24-58` |
| Draft verifier (Llama 4 Scout, removes AI artifacts from drafts) | `workers/lib/ai.ts:121-188` |
| Custom per-mailbox system prompt (R2-stored) | `workers/agent/index.ts:103-117` |
| MCP server (single DO, **20 tools**) at `/mcp` | `workers/mcp/index.ts` |

### 4.3 Social / conversation (V1.5 ? shipped, was "V2-deferred")

| Feature | Where |
|---|---|
| Social graph: `contacts` + `conversation_participants` | `workers/durableObject/migrations.ts:172-195` |
| Conversation state: status / priority / assignee / needs_reply | `workers/durableObject/migrations.ts:197-212` |
| Internal notes (max 5000 chars, private to team) | `workers/durableObject/migrations.ts:215-223` |
| Conversation events (received, sent, note_created, state_updated) | `workers/durableObject/migrations.ts:225-232` |
| Frontend: `MobileSocialInboxCard`, `ConversationStateControls`, `SocialContextSheet` | `app/components/conversation-social/`, `app/components/MobileSocialInboxCard.tsx` |
| API: `GET/PATCH /api/v1/mailboxes/:id/threads/:threadId/state` | `workers/index.ts:376-417` |
| API: `GET/POST /api/v1/mailboxes/:id/threads/:threadId/notes` | `workers/index.ts:389-408` |
| Internal-only delivery (blocks external recipients) | `workers/lib/recipient-routing.ts`, `workers/lib/internal-delivery.ts` |

### 4.4 Public surface

| Feature | Where |
|---|---|
| Public landing at `start.onyx.com.vn` (Vietnamese marketing + signup) | `app/routes/landing.tsx`, `app/routes.ts:12-13` |
| Public signup form (`POST /api/public/signup-requests`) | `workers/index.ts:137-167` |
| Public assets (`/favicon.ico`, `/favicon.svg`, `/robots.txt`, `/assets/*`) | `workers/app.ts:51-64` |

### 4.5 Payment subscription (Phase 02 ? shipped)

| Feature | Where |
|---|---|
| PaymentDO (SQLite: subscriptions, invoices, payment_logs) | `workers/durableObject/payment.ts` (334 LOC) |
| Payment migrations (1 migration, 3 tables, 5 indexes) | `workers/durableObject/paymentMigrations.ts` |
| SePay VietQR generation (`generateVietQR`) | `workers/lib/sepay.ts:10-51` |
| SePay webhook HMAC verification + event parsing | `workers/lib/sepay.ts:53-93` |
| Stripe webhook stub (not implemented) | `workers/lib/stripe.ts` |
| Checkout: `POST /api/v1/payments/checkout` | `workers/routes/payment.ts:28-69` |
| Invoice polling: `GET /api/v1/payments/invoice/:id` | `workers/routes/payment.ts:72-92` |
| SePay webhook: `POST /api/v1/payments/webhook/sepay` | `workers/routes/payment.ts:95-165` |
| Stripe webhook: `POST /api/v1/payments/webhook/stripe` | `workers/routes/payment.ts:168-178` |
| Subscription: `GET /api/v1/payments/subscription/:mailboxId` | `workers/routes/payment.ts:181-189` |
| Cancel: `POST /api/v1/payments/subscription/:mailboxId/cancel` | `workers/routes/payment.ts:192-207` |
| Invoices: `GET /api/v1/payments/invoices/:mailboxId` | `workers/routes/payment.ts:210-215` |
| Alarm-based renewal (6hr, 3-day window, auto-create invoices) | `workers/durableObject/payment.ts:57-65, 142-178` |
| Frontend queries: `useCheckout`, `useInvoice`, `useSubscription`, `useCancelSubscription`, `useInvoices` | `app/queries/payments.ts` |
| Tier pricing (VND/month): basic=190k, pro=490k, premium=990k | `workers/routes/payment.ts:16-20` |
| Tests: 14 suites, 870 LOC | `tests/payment.test.ts` |

### 4.6 Media pipeline (Phase 05 ? shipped)

| Feature | Where |
|---|---|
| Cloudflare Stream direct upload (`createDirectUpload`, returns uploadURL + uid) | `workers/lib/stream.ts:36-69` |
| Video status (`getVideoStatus`: state, HLS, DASH, thumbnail, duration) | `workers/lib/stream.ts:71-110` |
| Delete video, list videos by creatorId | `workers/lib/stream.ts:112-170` |
| Signed Stream token (HMAC JWT via `jose`, `sub=videoId`, configurable expiry) | `workers/lib/stream.ts:172-187` |
| Cloudflare Images direct upload (`createDirectUpload`, returns uploadURL + id) | `workers/lib/images.ts:19-51` |
| Image variants (original/thumbnail/medium/full via `imagedelivery.net`) | `workers/lib/images.ts:53-114` |
| Delete image, list images by creatorId (100/page, client-side filter) | `workers/lib/images.ts:116-182` |
| Stream init: `POST /api/v1/media/upload/stream/init` | `workers/routes/media.ts:56-69` |
| Stream status: `GET /api/v1/media/stream/:videoId/status` | `workers/routes/media.ts:72-80` |
| Stream delete: `DELETE /api/v1/media/stream/:videoId` | `workers/routes/media.ts:83-91` |
| Stream list: `GET /api/v1/media/stream/list/:mailboxId` | `workers/routes/media.ts:94-109` |
| Images init: `POST /api/v1/media/upload/images/init` | `workers/routes/media.ts:114-127` |
| Image variants: `GET /api/v1/media/images/:imageId/variants` | `workers/routes/media.ts:130-138` |
| Image delete: `DELETE /api/v1/media/images/:imageId` | `workers/routes/media.ts:141-149` |
| Images list: `GET /api/v1/media/images/list/:mailboxId` | `workers/routes/media.ts:152-167` |
| R2 fallback upload: `POST /api/v1/media/upload/r2` | `workers/routes/media.ts:177-208` |
| R2 media proxy: `GET /api/v1/media/r2/*` | `workers/routes/media.ts:211-227` |
| Signed stream token: `GET /api/v1/media/signed-stream/:videoId` | `workers/routes/media.ts:232-245` |
| Media access control (org membership check) | `workers/routes/media.ts:29-45` |
| Frontend queries: `useStreamUploadUrl`, `useVideoStatus`, `useVideosList`, `useDeleteVideo`, `useImageUploadUrl`, `useImageVariants`, `useImagesList`, `useDeleteImage`, `useR2Upload`, `useSignedStreamToken` | `app/queries/media.ts` |
| Tests: stream + images lib, R2 upload, routes, signed tokens, UI helpers | `tests/media.test.ts` (806 LOC) |

### 4.5 V1 feature flags (in code)

| Flag | Default | Where |
|---|---|---|
| `ALLOW_FORWARDING` | **`true`** | `workers/index.ts:38` |
| `ALLOW_MAILBOX_DELETION` | `false` | `workers/index.ts:39` |
| `SHOW_AGENT_SETTINGS` | `false` (UI-only) | `app/routes/settings.tsx` |
| `DEMO_MODE` | unset | `workers/app.ts:78-82`, `workers/types.ts:9` |

---

## 5. Out of Scope (V2+)

| Item | Source | Status |
|---|---|---|
| Audit log (read/send/delete/login) | `metro-mail.txt:38, 73` | **V2** ? see [`project-roadmap.md`](./project-roadmap.md) ? 2 |
| Retention policy (auto-archive) | ? | **V2** |
| Per-mailbox permission model (read/send/delete/manage/admin) | `metro-mail.txt:24-25, 59-60` | **V2** (currently single CF Access policy) |
| Domain management UI | `metro-mail.txt:26, 62-63` | **V2** |
| Magic link / email OTP | `metro-mail.txt:55-56` | **Won't build** ? CF Access covers SSO |
| Natural language search | `metro-mail.txt:34` | **Won't build** ? Gmail-style DSL ships; NL is a research project |
| IMAP / POP3 / SMTP clients | `metro-mail.txt:48` | **Explicitly non-goal** |
| Mobile native apps | `metro-mail.txt:48` | **Explicitly non-goal** ? web is responsive |
| CRM layer (customer profile, lead score, tags) | `metro-mail.txt:81-84` | **Separate product line** |
| Public-internet email (send to Gmail etc.) | ? | **Out of scope** ? see `getRecipientRouting` blocks external |

---

## 6. Product Development Requirements (PDR)

### 6.1 Functional Requirements

| ID | Requirement | Evidence |
|---|---|---|
| **P-FR-1** | User authenticates via Cloudflare Access before any page or API call. | Missing `cf-access-jwt-assertion` ? 403 (`workers/app.ts:94-97`). |
| **P-FR-2** | User can create one mailbox per address in `EMAIL_ADDRESSES`. | `POST /api/v1/mailboxes` (`workers/index.ts:187-210`). |
| **P-FR-3** | System auto-creates any missing mailboxes from `EMAIL_ADDRESSES` on first visit. | `app/routes/home.tsx`. |
| **P-FR-4** | User can compose a new email with rich-text body, To/Cc/Bcc, subject, and image attachments. | `app/components/ComposePanel.tsx`, `app/hooks/useComposeForm.ts`. |
| **P-FR-5** | User can reply (or reply-all) to an email; threading headers preserved. | `workers/routes/reply-forward.ts:24-114`. |
| **P-FR-6** | Inbound mail is parsed and stored in the recipient mailbox's `inbox` folder. | `default.email` handler (`workers/app.ts:132-147`). |
| **P-FR-7** | User can move emails between folders, star/unstar, mark read/unread. | `workers/index.ts:350-368`, `app/queries/emails.ts`. |
| **P-FR-8** | User can delete an email; its R2 attachment blobs are deleted. | `workers/index.ts:356-362`. |
| **P-FR-9** | User can search with Gmail-style operators and free text. | `app/lib/search-parser.ts`, `workers/index.ts:454-465`. |
| **P-FR-10** | User can download a non-inline attachment via authenticated endpoint. | `workers/index.ts:469-486`. |
| **P-FR-11** | User can open the AI Agent sidebar and chat to read/search/draft. | `app/components/AgentPanel.tsx`. |
| **P-FR-12** | On inbound mail, the AI Agent auto-generates a draft into the Drafts folder (explicit user click to send). | `workers/agent/index.ts:392-617`. |
| **P-FR-13** | External AI tools can connect to `/mcp` and call 20 typed tools scoped by `mailboxId`. | `workers/mcp/index.ts`; `MCPPanel.tsx` (drift: lists 14, not 20). |
| **P-FR-14** | Mailbox settings (display name, signature, auto-reply, agent system prompt) are editable. | `app/routes/settings.tsx`, `PUT /api/v1/mailboxes/:id`. |
| **P-FR-15** | Email HTML renders in a sandboxed iframe with strict CSP ? no `allow-same-origin`. | `app/components/EmailIframe.tsx`. |
| **P-FR-16** | Outbound send is rate-limited: 20/hr and 100/day per mailbox. | `workers/durableObject/index.ts` `checkSendRateLimit()`. |
| **P-FR-17** | Outbound mail with any external recipient is blocked at the API. | `getRecipientRouting` (`workers/lib/recipient-routing.ts`) ? 403. |
| **P-FR-18** | User can view / set conversation status, priority, assignee, needs_reply on a thread. | `GET/PATCH /api/v1/.../threads/:threadId/state`. |
| **P-FR-19** | User can post private internal notes on a thread (max 5000 chars). | `POST /api/v1/.../threads/:threadId/notes`. |
| **P-FR-20** | User can view the conversation event timeline (received/sent/note_created/state_updated). | `GET /api/v1/.../threads/:threadId/events`. |
| **P-FR-21** | User can create a payment subscription via SePay VietQR checkout (3 tiers). | `POST /api/v1/payments/checkout` ? generates VietQR + subscription + invoice. |
| **P-FR-22** | SePay webhook activates subscriptions on payment, with HMAC verification and idempotency. | `POST /api/v1/payments/webhook/sepay` (`workers/routes/payment.ts:95-165`). |
| **P-FR-23** | PaymentDO alarm auto-creates renewal invoices 3 days before expiry and marks past-due. | `workers/durableObject/payment.ts:57-65, 142-178`. |
| **P-FR-24** | User can cancel an active or past-due subscription. | `POST /api/v1/payments/subscription/:mailboxId/cancel`. |
| **P-FR-25** | User can poll invoice status (3s interval in frontend). | `GET /api/v1/payments/invoice/:id?mailboxId=...`. |
| **P-FR-26** | User can initiate Cloudflare Stream direct upload and poll video processing status. | `POST /api/v1/media/upload/stream/init` + `GET /api/v1/media/stream/:videoId/status`. |
| **P-FR-27** | User can request a signed Stream token (HMAC JWT) for authorized video playback. | `GET /api/v1/media/signed-stream/:videoId?expiry=3600`. |
| **P-FR-28** | User can initiate Cloudflare Images direct upload and retrieve variant URLs. | `POST /api/v1/media/upload/images/init` + `GET /api/v1/media/images/:imageId/variants`. |
| **P-FR-29** | User can upload generic media files to R2 as a fallback pipeline. | `POST /api/v1/media/upload/r2` + `GET /api/v1/media/r2/*` proxy. |
| **P-FR-30** | Media access is gated by org membership (not mailbox ownership). | `assertOrgMemberMediaAccess` (`workers/routes/media.ts:29-45`). |

### 6.2 Non-Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| **P-NFR-1** | Security ? Auth | CF Access JWT is the single trust boundary. No custom session/cookie/JWT issuance. |
| **P-NFR-2** | Security ? XSS | All email HTML passes DOMPurify; iframe is `srcdoc` with no `allow-same-origin`. |
| **P-NFR-3** | Security ? Prompt injection | Inbound bodies + thread context scanned before AI exposure; scanner **fails closed**. |
| **P-NFR-4** | Security ? Fail-closed | Missing `POLICY_AUD` / `TEAM_DOMAIN` in prod ? 500. |
| **P-NFR-5** | Reliability ? Inbound | Inbound errors **re-thrown** so CF Email Routing can retry/bounce (`workers/app.ts:141-146`). |
| **P-NFR-6** | Performance | Frontend list view auto-refetches every 30s; TanStack Query `staleTime: 30s` (`app/root.tsx:32`). |
| **P-NFR-7** | Performance | API client 30s timeout via `AbortSignal.any` (`app/services/api.ts:7, 25-31`). |
| **P-NFR-8** | SSR safety | Fresh QueryClient per SSR request (`app/root.tsx:55-64`). |
| **P-NFR-9** | Portability | No D1, no KV, no Queues. Only Workers + DOs + R2 + Email. |
| **P-NFR-10** | Observability | `observability.enabled = true` in `wrangler.jsonc`; `console.error` / `console.warn` for logs. |
| **P-NFR-11** | Build | `pnpm typecheck` = `cf-typegen && react-router typegen && tsc -b`. |
| **P-NFR-12** | Test | `pnpm test` (`node --test tests/*.test.ts`) ? **7 files, ~35 tests**. |
| **P-NFR-13** | Local dev | `wrangler.local.jsonc` overrides name, R2 bucket, `EMAIL.remote=false`. |
| **P-NFR-14** | Brand | All app strings are Vietnamese; landing is bilingual. Custom domain `box.onyx.com.vn`. |
| **P-NFR-15** | Trust | MCP server reachable **only** through CF-Access-protected `box.onyx.com.vn/mcp`; trust is shared with web app. |
| **P-NFR-16** | Payment ? Security | SePay webhook HMAC-verified; idempotency keys prevent duplicate processing. |
| **P-NFR-17** | Payment ? Reliability | PaymentDO alarm auto-reschedules on error (fail-open); subscriptions expire gracefully to `past_due`. |
| **P-NFR-18** | Media ? Security | Signed Stream tokens (HMAC JWT, per-video, expiring); media access gated by org membership. |
| **P-NFR-19** | Media ? Graceful degradation | R2 fallback upload when Stream/Images tokens are not configured; `501` for 'not configured' errors. |
| **P-NFR-20** | Media ? Performance | Video status poll interval: 5s while processing, stops at ready/error; images list capped at 100/page. |

### 6.3 Acceptance Criteria (V1.5 + V2 + Phase 02 + Phase 05 Ship Gates)

V1.5+ is considered shipped when **all** of the following are true:

1. `pnpm typecheck` passes.
2. `pnpm test` passes (~60 tests across 9 files: access, attachments, cid-images, conversation-state, internal-delivery, internal-notes, social-graph, payment, media).
3. `pnpm dev` boots on `http://localhost:5173`.
4. Sending to another mailbox in `EMAIL_ADDRESSES` delivers internally; sending to Gmail returns 403.
5. Inbound mail lands in Inbox; agent auto-drafts a reply (or skips with prompt-injection block).
6. AI Agent chat opens, can list emails, and produces a streaming reply.
7. `/mcp` returns 20 tools to a `tools/list` call from Claude Code / Cursor.
8. Internal notes can be created and listed on a thread.
9. Conversation state can be updated (status / priority / assignee) and reflected in the inbox card.
10. Payment checkout creates a subscription + VietQR invoice; SePay webhook activates it.
11. PaymentDO alarm auto-creates renewal invoices and marks past-due subscriptions.
12. Cloudflare Stream direct upload returns a valid upload URL; video status polls correctly.
13. Signed Stream token is a valid 3-part JWT; different video IDs produce different tokens.
14. Cloudflare Images direct upload returns a valid upload URL; variant URLs include `imagedelivery.net`.
15. R2 media fallback upload works; R2 proxy serves files with correct Content-Type.

---

## 7. Architecture At a Glance

See [`system-architecture.md`](./system-architecture.md) for the full diagram and details.

```
Browser (React 19 + RR7 SSR) ? CF Access (JWT) ? Hono Worker
  +- /api/v1/*          ? MailboxDO (SQLite + R2)
  +- /api/v1/payments/* ? PaymentDO (SQLite: subscriptions, invoices, payment_logs)
  +- /api/v1/media/*    ? CF Stream + CF Images + R2 fallback
  +- /mcp               ? EmailMCP DO (20 tools)
  +- /agents/*          ? EmailAgent DO (kimi-k2.5, 13 tools)
  +- default.email      ? postal-mime ? MailboxDO.inbox
```

## 8. Documentation Map

| File | Purpose |
|---|---|
| [`docs/README.md`](./README.md) | Index |
| `docs/project-overview-pdr.md` | This file ? V1/V1.5 scope, PDR, acceptance |
| [`docs/codebase-summary.md`](./codebase-summary.md) | Tech stack, file tree, modules, naming, test/build |
| [`docs/code-standards.md`](./code-standards.md) | TS, imports, components, state, API client, security |
| [`docs/system-architecture.md`](./system-architecture.md) | Diagram, data flow, schema, bindings, auth, flags, TODOs |
| [`docs/project-roadmap.md`](./project-roadmap.md) | V1.5 ? V2 ? V3 backlog + tech debt |
| [`docs/deployment-guide.md`](./deployment-guide.md) ? [`docs/design-guidelines.md`](./design-guidelines.md) | Deploy walkthrough ? UI conventions |
