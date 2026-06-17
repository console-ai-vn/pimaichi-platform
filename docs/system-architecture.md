# ONYX � System Architecture

| Field | Value |
|---|---|
| **Last updated** | 2026-06-17 |
| **Worker** | `onyx-email` (`workers/app.ts`) |
| **Custom domains** | `box.onyx.com.vn` (auth), `start.onyx.com.vn` (public) |
| **Trust boundary** | Cloudflare Access JWT + JWT refresh/access tokens |
| **New in Wave 3** | InventoryDO, LiveDO (WebSocket Hibernation), JWT refresh, rate limiter, security headers, Turnstile stub |

---

## 1. High-Level Diagram

```
Browser (React 19 + RR7 SSR)
  Routes: / (landing) ? /app (home) ? /mailbox/:id ? { email-list | settings | search | media | payments }
  State:  TanStack Query (server) + Zustand (UI) + useComposeForm (local)
  All API calls ? /api/v1/* (no client auth; CF Access sets JWT cookie)
             ?
             ? HTTPS
Cloudflare Access (Zero Trust) ? JWT cookie on box.onyx.com.vn
  start.onyx.com.vn is in PUBLIC_HOSTNAMES ? no Access check.
             ?
             ?
Hono Worker ? workers/app.ts
  app.use("*")  ? Access JWT middleware (fail-closed in prod)
  app.use("*")  ? Security headers + CSP middleware
  app.all("/mcp", ...) / app.all("/mcp/*", ...) ? EmailMCP DO (20 tools)
  app.route("/", apiApp)              ? /api/v1/* (auth) + /api/public/* (no auth)
  app.route("/", mediaApp)            ? /api/v1/media/* (Stream + Images + R2)
  app.route("/", paymentApp)          ? /api/v1/payments/* (SePay + Stripe)
  app.route("/", inventoryApp)        ? /api/v1/inventory/* (catalog, purchase, consume, history)
  app.route("/", liveApp)             ? /api/v1/live/* (create, start, end, join, schedule, chat WS)
  app.post("/api/v1/auth/refresh", ...)         ? JWT refresh endpoint
  app.post("/api/v1/auth/access-token", ...)    ? JWT access token endpoint
  app.all("/agents/*", ...)           ? EmailAgent DO (13 tools)
  app.all("*", requestHandler)        ? React Router SSR catch-all
  default.email(...)                  ? Cloudflare Email Routing inbound
             ?
             ?
    +-------------------------------------------------------------------------------------------+
    ?              ?              ?              ?              ?              ?               ?              ?
MailboxDO       EmailAgent DO  EmailMCP DO   PaymentDO     OrgFeedDO      InventoryDO    LiveDO        R2 Bucket
(SQLite)        AIChatAgent    20 MCP tools  (SQLite)       (SQLite)       (SQLite)       (SQLite)      "onyx-email"
Per-mailbox     13 email tools  via /mcp     Per-mailbox    Shared         Shared         Per-event
isolation       kimi-k2.5                    isolation      1 SQL migration 1 SQL migration WebSocket
11 SQL migrations onNewEmail ?   Exposed to   1 SQL migration  topics/comments  catalog       Hibernation
? folders       auto-draft     external AI   ? subscriptions  ? reactions       user_inventories live_chat
? emails        Persistent chat clients       ? invoices                       consumption_log live_events
? attachments   history.                      ? payment_logs                  alarm-based     live_viewers
? contacts      Workers AI:                   Alarm-based                    expiry (1hr)    Stream Live
? conversation_ ? kimi-k2.5                   renewal (6hr)                                  Input provisioning
  participants  ? llama-3.1-8b injection check                                              RTMPS + HLS/DASH
? conversation_ ? llama-4-scout draft verify
  state
? internal_notes
? conversation_events

Cloudflare Stream (external API)         Cloudflare Images (external API)
? Direct upload (uploadURL + uid)        ? Direct upload (uploadURL + id)
? Video status (state, HLS, DASH)        ? Variants via imagedelivery.net
? Signed HMAC JWT tokens                 ? List/delete by creatorId
? List/delete by creatorId meta

SePay (external API)
? VietQR generation
? Webhook HMAC verification + event parsing

Inbound mail:  CF Email Routing catch-all on "onyx.com.vn"
                ? default.email handler ? postal-mime parse
                ? MailboxDO.inbox (threaded by In-Reply-To / References)

Outbound mail: MailboxDO ? getRecipientRouting
                ? internal recipients: deliverInternalEmail (DO-to-DO direct write)
                ? external recipients: 403 "internal-only"
                (Email Service binding used only if ALLOW_FORWARDING + external)
```

---

## 2. Data Flow

### 2.1 Send an Email (User Action)

```
[UI] ComposePanel / ComposeEmail
     ? useComposeForm.send()  (validates To/Subject, builds base64 attachments)
     ? useSendEmail() mutation
     ? POST /api/v1/mailboxes/:id/emails  (SendEmailRequestSchema)
        [worker] validateSender(to, from, mailboxId)        ? 400 on SenderValidationError
        [worker] generateMessageId(fromDomain)
        [worker] checkSendRateLimit()                       ? 429 on 20/hr or 100/day
        [worker] getRecipientRouting(env, { to, cc, bcc })  ? 403 "internal-only" on external
        [worker] storeAttachments(BUCKET, messageId)        ? R2 put
        [worker] stub.createEmail(Folders.SENT, ...)        ? SQLite insert
        [worker] deliverInternalEmail(env, ...)              ? DO-to-DO direct write per recipient
        ? 202 { id, status: "sent" }
     [UI] invalidate queryKeys.emails.list(mailboxId, "sent")
```

### 2.2 Receive an Email (Inbound)

```
[CF] Email Routing catch-all on "onyx.com.vn" ? Worker email handler
     ? default.email(event, env, ctx)         (workers/app.ts:132-147)
     ? receiveEmail(event, env, ctx)          (workers/index.ts:508-575)
        [parse]  postal-mime.parse(event.raw)
        [pick]   recipient from EMAIL_ADDRESSES (case-insensitive)
        [thread] use In-Reply-To / References, else subject normalization
        [store]  MailboxDO.createEmail(Folders.INBOX, ...)
                 + storeAttachments(BUCKET, messageId, attachments) � JPEG/PNG/WebP only
        ? re-throw on error so CF can retry/bounce
[Agent] EmailAgent.onNewEmail(email)
        [guard] isPromptInjection(body)        ? true: skip auto-draft (fail-closed on AI error)
        [guard] isPromptInjection(threadCtx)   ? true: skip auto-draft
        [draft] generateText with kimi-k2.5
                 ? toolDraftReply called OR inline text ? MailboxDO.createEmail(Folders.DRAFT, ...)
        ? draft visible in Drafts; click "Edit & send in composer" to confirm
```

### 2.3 AI Auto-Draft ? User Sends

```
[UI] AgentPanel detects "has_draft" in list OR user opens Drafts folder
     ? user clicks "Edit & send in composer"
     ? useUIStore.startCompose({ mode: "new", draftEmail })
     ? useComposeForm loads draft body + attachments
     ? user edits, clicks Send
     ? useSendEmail() mutation as in �2.1 (thread_id preserved from draft)
```

### 2.4 Search (User Action)

```
[UI] search input in Header (URL-synced: ?q=...)
     ? user types "from:alice has:attachment is:unread"
     ? useSearchEmails({ q: "alice", hasAttachment: true, isRead: false })
        [parse] parseSearchQuery("from:alice has:attachment is:unread")
                ? { from: "alice", has_attachment: true, is_read: false, query: "alice" }
     ? GET /api/v1/mailboxes/:id/search?from=alice&has_attachment=true&is_read=false
        [worker] MailboxDO.searchEmails(...)  ? SELECT � FROM emails WHERE �
        ? { emails: [...], totalCount: N }
     [UI] search-results.tsx renders with match highlighting + pagination (PAGE_SIZE = 25)
```

### 2.5 Attachment Download

```
[UI] User clicks "Download" on EmailAttachmentList
     ? GET /api/v1/mailboxes/:mailboxId/emails/:emailId/attachments/:attachmentId
        [worker] requireMailbox middleware (loads DO stub + access check)
        [worker] MailboxDO.getAttachment(emailId, attachmentId)  ? ownership check
        [worker] BUCKET.get(attachments/<emailId>/<attachmentId>/<filename>)  ? R2 object
        ? 200 with Content-Disposition + binary body
[UI] downloadFile(blob, filename) in lib/utils.ts triggers browser save
```

### 2.6 Conversation State / Notes / Events (V1.5)

```
[UI] User opens EmailPanel ? SocialContextSheet (or MobileSocialInboxCard)
     ? PATCH /api/v1/mailboxes/:id/threads/:threadId/state
        { status: "waiting", priority: "high", assignee_email: "...", needs_reply: true }
        [worker] normalizeConversationStatePatch(...)
        [worker] MailboxDO.updateConversationState(threadId, patch)
                 ? UPSERT conversation_state + INSERT conversation_events('state_updated')
     ? POST /api/v1/mailboxes/:id/threads/:threadId/notes
        { body: "Call back at 3pm" }
        [worker] normalizeInternalNoteBody(body)  (max 5000 chars)
        [worker] MailboxDO.createInternalNote(threadId, authorEmail, body)
                 ? INSERT internal_notes + INSERT conversation_events('note_created')
     ? GET /api/v1/mailboxes/:id/threads/:threadId/events
        ? array of { type, actor_email, created_at, payload }
```

### 2.8 Payment Checkout + Webhook (Phase 02)

```
[UI] User clicks checkout ? tier selection
     ? useCheckout() mutation
     ? POST /api/v1/payments/checkout { mailboxId, tier }
        [worker] normalizeEmail(mailboxId)
        [worker] getPaymentStub(env, mailboxId) ? PaymentDO
        [worker] Check for existing active subscription ? 409 if exists
        [worker] generateVietQR(env, amount, description) ? SePay API
        [worker] stub.createSubscription(mailboxId, tier, amount)
        [worker] stub.createInvoice(subscriptionId, mailboxId, amount, "sepay", qrCode)
        ? 201 { subscription, invoice, qrCode, amount, tier }
     [UI] Show QR code; poll invoice status every 3s

[SePay] Payment received ? webhook to Worker
     ? POST /api/v1/payments/webhook/sepay
        [worker] verifyWebhook(body, x-sepay-signature, SEPAY_WEBHOOK_SECRET)
        [worker] parseWebhookEvent(body) ? { type, amount, txnId, description }
        [worker] Extract mailboxId from description ("ONYX {tier} subscription for {mailboxId}")
        [worker] stub.webhookLog("sepay:{txnId}", "sepay", type, body) ? idempotency
        [worker] Find pending subscription + invoice
        [worker] Verify amount >= invoice.amount ? 400 if underpayment
        [worker] stub.activateSubscription(subscriptionId, txnId)
                 ? UPDATE subscriptions SET status='active' + UPDATE invoices SET status='paid'
        ? 200 { status: "activated" }
```

### 2.9 Media Pipeline — Stream Upload + Playback (Phase 05)

```
[UI] User uploads video via Media page
     ? useStreamUploadUrl() mutation
     ? POST /api/v1/media/upload/stream/init { mailboxId }
        [worker] assertOrgMemberMediaAccess(env, accessEmail, mailboxId)
        [worker] createStreamDirectUpload(env, mailboxId)
                 ? CF Stream API: POST /accounts/{id}/stream/direct_upload
                 ? creatorId = mailboxId (stored as meta)
        ? 200 { uploadURL, uid }

[UI] Browser uploads video directly to uploadURL (bypasses Worker)
     ? POST {uploadURL} with video file

[UI] Poll video status until ready
     ? useVideoStatus(videoId) ? polling every 5s while processing
     ? GET /api/v1/media/stream/{videoId}/status
        [worker] getStreamVideoStatus(env, videoId)
                 ? CF Stream API: GET /accounts/{id}/stream/{videoId}
        ? 200 { state: "ready"/"processing"/"error", playback: {hls, dash}, thumbnail, duration }

[UI] Request signed token for playback
     ? useSignedStreamToken(videoId)
     ? GET /api/v1/media/signed-stream/{videoId}?expiry=3600
        [worker] generateSignedToken(env, videoId, expiry)
                 ? HMAC JWT: sub=videoId, iat=now, exp=now+expiry
        ? 200 { token }

[UI] Construct playback URL: `${hlsUrl}?token=${signedToken}`
```

### 2.10 Media Pipeline — Images Upload (Phase 05)

```
[UI] User uploads image via Media page
     ? useImageUploadUrl() mutation
     ? POST /api/v1/media/upload/images/init { mailboxId }
        [worker] assertOrgMemberMediaAccess(env, accessEmail, mailboxId)
        [worker] createImagesDirectUpload(env, mailboxId)
                 ? CF Images API: POST /accounts/{id}/images/v1/direct_upload
                 ? metadata: { creatorId: mailboxId }
        ? 200 { uploadURL, id }

[UI] Browser uploads image directly to uploadURL

[UI] Get variant URLs
     ? useImageVariants(imageId)
     ? GET /api/v1/media/images/{imageId}/variants
        [worker] getImageVariants(env, imageId)
                 ? CF Images API: GET /accounts/{id}/images/v1/{imageId}
                 ? Construct variant URLs via imagedelivery.net/{accountHash}/{imageId}/{variant}
        ? 200 { original, thumbnail, medium, full }

[UI] R2 fallback (when Stream/Images tokens not configured)
     ? useR2Upload() mutation
     ? POST /api/v1/media/upload/r2 (multipart form: file + meta JSON)
        [worker] Store to R2: media/{mailboxId}/{uuid}-{safeFilename}
        [worker] Set Content-Type headers
        ? 201 { key, url, filename }
     [UI] R2 proxy: GET /api/v1/media/r2/{key} ? serves binary with caching headers
```

### 2.11 Inventory — Catalog + Purchase (Phase 03)

```
[UI] Shop page (/shop/:creatorMailboxId)
     ? useCatalog(creatorMailboxId?)
     ? GET /api/v1/inventory/catalog/:creatorMailboxId
        [worker] getInventoryStub(env).getCatalogItems(creatorMailboxId)
                 ? InventoryDO — SELECT * FROM catalog WHERE creator_mailbox_id = ? AND active = 1
        ? 200 { items: CatalogItem[] }

[UI] User clicks "Purchase" on ItemCard
     ? usePurchaseItem() mutation
     ? POST /api/v1/inventory/purchase { userEmail, itemId }
        [worker] Verify item exists + is active
        [worker] Create subscription + invoice via PaymentDO (creator's mailbox)
        [worker] stub.grantItem(userEmail, itemId, purchaseId=invoice.id)
                 ? INSERT INTO user_inventories (status='active')
        ? 201 { inventoryEntry, subscription, invoice, item }

[UI] Consume item (key/token usage)
     ? POST /api/v1/inventory/consume { userEmail, itemId, resourceType, resourceId }
        [worker] Find active, unexpired inventory entry
        [worker] UPDATE user_inventories SET status='consumed' + INSERT consumption_log
        ? 200 { success: true } OR 404 "No active item found"

[UI] User's inventory / purchase history
     ? GET /api/v1/inventory/inventory/:userEmail?type=key&status=active
        [worker] SELECT ui.*, c.name, c.type FROM user_inventories ui LEFT JOIN catalog c
        ? 200 { items: InventoryEntry[] }

[Alarm] InventoryDO alarm (hourly)
     ? expireItems() — UPDATE user_inventories SET status='expired'
       WHERE status='active' AND expires_at IS NOT NULL AND expires_at <= now
```

### 2.12 Live Streaming — Create + Start + Join + Chat (Phase 06)

```
[UI] Creator creates event
     ? POST /api/v1/live/create { creatorMailboxId, title, description, scheduledAt, passPrice }
        [worker] getLiveStub(env, eventId).createEvent(...)
                 ? LiveDO — INSERT INTO live_events (status='scheduled')
        ? 201 { event: LiveEvent }

[UI] Creator starts event (provisions Stream Live Input)
     ? POST /api/v1/live/:eventId/start
        [worker] getLiveStub(env, eventId).startEvent(eventId)
                 ? LiveDO — provisionStreamLiveInput(title)
                   ? CF Stream API: POST /accounts/{id}/stream/live_inputs
                   ? recording: { mode: "automatic" }
                 ? UPDATE live_events SET status='live', stream_live_input_uid, rtmps_url, playback_url
        ? 200 { rtmpsUrl, playbackUrl }

[UI] Creator ends event (deletes Stream Live Input)
     ? POST /api/v1/live/:eventId/end
        [worker] stub.endEvent(eventId)
                 ? LiveDO — DELETE /accounts/{id}/stream/live_inputs/{uid}
                 ? UPDATE live_events SET status='ended' + mark all viewers left
        ? 200 { event }

[UI] Viewer joins event (pass check)
     ? POST /api/v1/live/:eventId/join { userEmail, passVerified }
        [worker] Check pass_price: if > 0, verify passVerified or active subscription
        [worker] stub.joinEvent(eventId, userEmail, passVerified)
                 ? INSERT INTO live_viewers
        ? 200 { playbackUrl, wsToken, event }

[UI] Viewer opens WebSocket for live chat
     ? new WebSocket(`wss://box.onyx.com.vn/api/v1/live/${eventId}/chat?userEmail=&displayName=&token=`)
        [LiveDO] handleWebSocketUpgrade — verify viewer exists in live_viewers
                 ? WebSocketPair + ctx.acceptWebSocket(server)
                 ? serializeAttachment({ eventId, userEmail, displayName })
        ? 101 Switching Protocols

[WebSocket message flow]
     Client ? { type: "chat", message: "Hello!" }
            ? webSocketMessage(ws, raw)
              ? validateChatMessage(msg) — HTML sanitize + bad word filter
              ? checkRateLimit(userKey) — 1 msg/sec per user
              ? storeChatMessage(eventId, userEmail, displayName, sanitized)
                ? INSERT INTO live_chat
              ? Broadcast to all ctx.getWebSockets():
                { type: "chat", messageId, userId, displayName, message, timestamp }

[WebSocket close]
     webSocketClose(ws) ? UPDATE live_viewers SET left_at = now
     Broadcast { type: "system", event: "user_left", userId, displayName }
```

### 2.13 Security — JWT Refresh + Rate Limiter + Headers (Phase 07)

```
[Client] POST /api/v1/auth/refresh { refreshToken }
         ? REFRESH_SECRET ? verifyRefreshToken() (jose HS256)
         ? Valid? ? generateAccessToken(email, ACCESS_SECRET, 12h)
                  + generateRefreshToken(email, REFRESH_SECRET, 30d)
         ? 200 { accessToken, refreshToken }

[Middleware] app.use("*") ? applySecurityHeaders(c.res) + applyCspHeaders(c.res)
         ? HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy,
           Permissions-Policy, COOP, CSP

[Middleware] createRateLimiter([...]) applied to:
         ? POST /api/public/signup-requests (5/min)
         ? POST /api/v1/payments/checkout (10/min)
         ? Keyed by {cf-connecting-ip}:{path}:{method}
```

---

## 3. Database Schema

**No D1.** All data lives in **Durable Object SQLite storage** inside each DO instance.

- `MailboxDO`: Each mailbox is its own DO; the DO ID is derived from the mailbox email (lowercased). True per-mailbox isolation.
- `PaymentDO`: Each mailbox has its own DO (via `PAYMENT.idFromName(mailboxId)`). True per-mailbox isolation.
- `OrgFeedDO`: Shared instance (topics/comments/reactions visible to all org members).

`workers/db/schema.ts` is a Drizzle type schema (not a D1 binding). The actual DDL is inline in `workers/durableObject/migrations.ts` and `workers/durableObject/paymentMigrations.ts`, applied automatically when the DO is constructed.

### 3.1 Tables

#### `folders` (V1)

| Column | Type | Constraints |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `name` | TEXT | NOT NULL UNIQUE |
| `is_deletable` | INTEGER | NOT NULL DEFAULT 1 |

#### `emails` (V1, extended in V1.5)

| Column | Type | Constraints | Added in migration |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | #1 |
| `folder_id` | TEXT | NOT NULL, FK ? `folders(id)` ON DELETE CASCADE | #1 |
| `subject` / `sender` / `recipient` | TEXT | nullable | #1 |
| `cc` / `bcc` | TEXT | nullable | **#7** |
| `date` | TEXT | nullable (ISO 8601) | #1 |
| `read` / `starred` | INTEGER | DEFAULT 0 | #1 |
| `body` | TEXT | nullable (HTML or plain text) | #1 |
| `in_reply_to` / `email_references` / `thread_id` | TEXT | nullable | **#2** |
| `message_id` | TEXT | nullable (RFC 822 Message-ID) | **#4** |
| `raw_headers` | TEXT | nullable (JSON) | **#5** |

**Indexes** (created in migrations #2 and #8):
`idx_emails_thread_id`, `idx_emails_in_reply_to`, `idx_emails_folder_id`, `idx_emails_date`, `idx_emails_folder_date` (composite).

#### `attachments` (V1)

| Column | Type | Constraints |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `email_id` | TEXT | NOT NULL, FK ? `emails(id)` ON DELETE CASCADE |
| `filename` / `mimetype` | TEXT | NOT NULL |
| `size` | INTEGER | NOT NULL |
| `content_id` | TEXT | nullable (for `cid:` inline references) |
| `disposition` | TEXT | nullable (`"attachment"` / `"inline"`) |

#### `contacts` (V1.5 � migration #9)

| Column | Type | Constraints |
|---|---|---|
| `id` | TEXT | PRIMARY KEY (deterministic: `contact:<email>`) |
| `email` | TEXT | NOT NULL UNIQUE |
| `display_name` | TEXT | nullable |
| `first_seen_at` / `last_seen_at` | TEXT | NOT NULL DEFAULT (datetime('now')) |

#### `conversation_participants` (V1.5 � migration #9)

| Column | Type | Constraints |
|---|---|---|
| `thread_id` | TEXT | NOT NULL (composite PK) |
| `contact_id` | TEXT | NOT NULL (composite PK), FK ? `contacts(id)` |
| `first_seen_at` / `last_seen_at` | TEXT | NOT NULL DEFAULT (datetime('now')) |

Indexes: `idx_contacts_email` (UNIQUE), `idx_conversation_participants_thread`, `idx_conversation_participants_thread_contact` (UNIQUE).

#### `conversation_state` (V1.5 � migration #10)

| Column | Type | Constraints |
|---|---|---|
| `thread_id` | TEXT | PRIMARY KEY |
| `assignee_email` | TEXT | nullable |
| `status` | TEXT | NOT NULL DEFAULT `'open'` (`open` / `waiting` / `done`) |
| `priority` | TEXT | NOT NULL DEFAULT `'normal'` (`low` / `normal` / `high`) |
| `needs_reply` | INTEGER | NOT NULL DEFAULT 0 |
| `last_seen_at` | TEXT | nullable |
| `updated_at` | TEXT | NOT NULL DEFAULT (datetime('now')) |

Indexes: `idx_conversation_state_status`, `idx_conversation_state_assignee`.

#### `internal_notes` (V1.5 � migration #11)

| Column | Type | Constraints |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `thread_id` | TEXT | NOT NULL |
| `author_email` | TEXT | NOT NULL |
| `body` | TEXT | NOT NULL (max 5000 chars; enforced in `normalizeInternalNoteBody`) |
| `created_at` / `updated_at` | TEXT | NOT NULL DEFAULT (datetime('now')) |

#### `conversation_events` (V1.5 � migration #11)

| Column | Type | Constraints |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `thread_id` | TEXT | NOT NULL |
| `type` | TEXT | NOT NULL (`email_received` / `email_sent` / `note_created` / `state_updated`) |
| `actor_email` | TEXT | nullable |
| `payload` | TEXT | nullable (JSON) |
| `created_at` | TEXT | NOT NULL DEFAULT (datetime('now')) |

### 3.2 PaymentDO Schema (Phase 02 ? `workers/durableObject/paymentMigrations.ts`)

1 migration (`1_initial_setup`), 3 tables, 5 indexes.

#### `subscriptions`

| Column | Type | Constraints |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `mailbox_id` | TEXT | NOT NULL (indexed) |
| `tier` | TEXT | NOT NULL |
| `status` | TEXT | NOT NULL DEFAULT `'pending'` (`pending` ? `active` ? `past_due` ? `cancelled`) (indexed) |
| `amount` | INTEGER | NOT NULL (VND) |
| `currency` | TEXT | NOT NULL DEFAULT `'VND'` |
| `current_period_start` | TEXT | NOT NULL (ISO 8601) |
| `current_period_end` | TEXT | NOT NULL (ISO 8601) |
| `canceled_at` | TEXT | nullable |
| `created_at` | TEXT | NOT NULL |
| `updated_at` | TEXT | NOT NULL |

Indexes: `idx_subscriptions_mailbox` ON `mailbox_id`, `idx_subscriptions_status` ON `status`.

#### `invoices`

| Column | Type | Constraints |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `subscription_id` | TEXT | NOT NULL (indexed) |
| `mailbox_id` | TEXT | NOT NULL (indexed) |
| `amount` | INTEGER | NOT NULL |
| `status` | TEXT | NOT NULL DEFAULT `'pending'` (`pending` / `paid` / `void` / `overdue`) (indexed) |
| `provider` | TEXT | NOT NULL (`sepay` / `stripe`) |
| `provider_txn_id` | TEXT | nullable |
| `qr_code` | TEXT | nullable (VietQR code) |
| `due_date` | TEXT | NOT NULL (now + 1hr) |
| `paid_at` | TEXT | nullable |
| `created_at` | TEXT | NOT NULL |

Indexes: `idx_invoices_mailbox` ON `mailbox_id`, `idx_invoices_subscription` ON `subscription_id`, `idx_invoices_status` ON `status`.

#### `payment_logs`

| Column | Type | Constraints |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `idempotency_key` | TEXT | UNIQUE NOT NULL (format: `{provider}:{txnId}`) |
| `provider` | TEXT | NOT NULL |
| `event_type` | TEXT | NOT NULL |
| `raw_payload` | TEXT | NOT NULL (webhook body) |
| `processed` | INTEGER | DEFAULT 0 |
| `created_at` | TEXT | NOT NULL |

### 3.3 InventoryDO Schema (Phase 03 ? `workers/durableObject/inventoryMigrations.ts`)

1 migration (`1_initial_setup`), 3 tables, 8 indexes. **1 shared instance** (`onyx-inventory`).

#### `catalog`

| Column | Type | Constraints |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `creator_mailbox_id` | TEXT | NOT NULL (indexed) |
| `type` | TEXT | NOT NULL (`key` / `token` / `gift` / `pass`) (indexed) |
| `name` | TEXT | NOT NULL |
| `description` | TEXT | NOT NULL |
| `price` | INTEGER | NOT NULL (VND) |
| `image_url` | TEXT | nullable |
| `active` | INTEGER | NOT NULL DEFAULT 1 (indexed) |
| `created_at` | TEXT | NOT NULL |
| `updated_at` | TEXT | NOT NULL |

Indexes: `idx_catalog_creator` ON `creator_mailbox_id`, `idx_catalog_active` ON `active`, `idx_catalog_type` ON `type`.

#### `user_inventories`

| Column | Type | Constraints |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `user_email` | TEXT | NOT NULL (indexed) |
| `item_id` | TEXT | NOT NULL, FK ? `catalog(id)` |
| `status` | TEXT | NOT NULL DEFAULT `'active'` (`active` / `consumed` / `expired`) (indexed) |
| `purchase_id` | TEXT | nullable |
| `granted_at` | TEXT | NOT NULL |
| `expires_at` | TEXT | nullable |
| `consumed_at` | TEXT | nullable |

Indexes: `idx_user_inventories_user` ON `user_email`, `idx_user_inventories_user_item` ON `(user_email, item_id)`, `idx_user_inventories_status` ON `status`.

#### `consumption_log`

| Column | Type | Constraints |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `user_email` | TEXT | NOT NULL (indexed) |
| `item_id` | TEXT | NOT NULL |
| `resource_type` | TEXT | nullable |
| `resource_id` | TEXT | nullable |
| `consumed_at` | TEXT | NOT NULL (indexed) |

Indexes: `idx_consumption_log_user` ON `user_email`, `idx_consumption_log_consumed_at` ON `consumed_at`.

**Item types** (`workers/lib/items.ts`):
- `key` — permanent unlock (0-500k VND)
- `token` — one-time use (0-1M VND)
- `gift` — sendable item (0-5M VND)
- `pass` — event/gate access (0-20M VND)

**Alarm:** Runs every 1 hour; marks expired `user_inventories` rows as `status='expired'`.

### 3.4 LiveDO Schema (Phase 06 ? `workers/durableObject/liveMigrations.ts`)

1 migration (`1_initial_live_setup`), 3 tables, 4 indexes. **1 instance per event** (DO ID = event UUID).

#### `live_events`

| Column | Type | Constraints |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `creator_mailbox_id` | TEXT | NOT NULL (indexed) |
| `title` | TEXT | NOT NULL |
| `description` | TEXT | DEFAULT `''` |
| `scheduled_at` | TEXT | nullable (indexed) |
| `started_at` | TEXT | nullable |
| `ended_at` | TEXT | nullable |
| `status` | TEXT | NOT NULL DEFAULT `'scheduled'` (`scheduled` / `live` / `ended` / `cancelled`) (indexed) |
| `stream_live_input_uid` | TEXT | nullable |
| `rtmps_url` | TEXT | nullable |
| `playback_url` | TEXT | nullable (HLS) |
| `pass_price` | INTEGER | NOT NULL DEFAULT 0 (0 = free) |
| `created_at` | TEXT | NOT NULL |
| `updated_at` | TEXT | NOT NULL |

Indexes: `idx_live_events_creator` ON `creator_mailbox_id`, `idx_live_events_status` ON `status`, `idx_live_events_scheduled` ON `scheduled_at`.

#### `live_chat`

| Column | Type | Constraints |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `event_id` | TEXT | NOT NULL, FK ? `live_events(id)` ON DELETE CASCADE |
| `user_email` | TEXT | NOT NULL |
| `display_name` | TEXT | NOT NULL |
| `message` | TEXT | NOT NULL |
| `system_message` | INTEGER | NOT NULL DEFAULT 0 |
| `created_at` | TEXT | NOT NULL DEFAULT (datetime('now')) |

Index: `idx_live_chat_event` ON `(event_id, created_at)`.

#### `live_viewers`

| Column | Type | Constraints |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `event_id` | TEXT | NOT NULL (indexed) |
| `user_email` | TEXT | NOT NULL |
| `joined_at` | TEXT | NOT NULL DEFAULT (datetime('now')) |
| `left_at` | TEXT | nullable |

Indexes: `idx_live_viewers_event` ON `event_id`, `idx_live_viewers_active` UNIQUE ON `(event_id, user_email)` WHERE `left_at IS NULL`.

**WebSocket Hibernation:** The `LiveDO` uses `ctx.acceptWebSocket()` with `serializeAttachment()` to store `{ eventId, userEmail, displayName }` per connection. Chat messages are broadcast to all connected sockets via `ctx.getWebSockets()`. Viewers are tracked in `live_viewers` with join/leave system messages.

**Stream Live Input:** On `startEvent()`, the DO calls Cloudflare Stream API (`POST /accounts/{id}/stream/live_inputs`) to provision an RTMPS ingest URL + HLS playback URL. On `endEvent()`, the live input is deleted.

### 3.5 Storage Outside SQLite

| What | Where | Key pattern |
|---|---|---|
| Mailbox settings (JSON) | R2 | `mailboxes/<email>.json` |
| Attachment binaries | R2 | `attachments/<emailId>/<attachmentId>/<sanitized-filename>` |
| Signup requests | R2 | `signup-requests/<iso-ts>-<uuid>.json` |
| Media fallback (R2) | R2 | `media/<mailboxId>/<uuid>-<safeFilename>` |

### 3.6 MailboxDO Migrations ? **11 total** (was 8 in older docs)

Tracked in a `d1_migrations` table (id, name, applied_at) inside the DO SQLite. Applied automatically in the `MailboxDO` constructor via `applyMigrations()` (`workers/durableObject/migrations.ts:17-60`).

| # | Name | Purpose |
|---|---|---|
| 1 | `1_initial_setup` | Create 3 tables; seed `inbox`, `sent`, `trash`, `archive`, `spam` |
| 2 | `2_add_email_threading` | Add `in_reply_to`, `email_references`, `thread_id` + indexes |
| 3 | `3_add_draft_folder` | Seed `draft` |
| 4 | `4_add_message_id` | Add `message_id` column |
| 5 | `5_add_raw_headers` | Add `raw_headers` column |
| 6 | `6_mark_sent_emails_as_read` | One-time `UPDATE` to mark `sent` folder emails as read |
| 7 | `7_add_cc_bcc` | Add `cc`, `bcc` columns |
| 8 | `8_add_folder_date_indexes` | `idx_emails_folder_id`, `idx_emails_date`, `idx_emails_folder_date` (idempotent) |
| 9 | `9_add_social_graph` | `contacts` + `conversation_participants` (V1.5) |
| 10 | `10_add_conversation_state` | `conversation_state` (V1.5) |
| 11 | `11_add_internal_notes_events` | `internal_notes` + `conversation_events` (V1.5) |

---

## 4. Cloudflare Bindings (`wrangler.jsonc`)

| Binding | Kind | Class / Target | Notes |
|---|---|---|---|
| `BUCKET` | R2 bucket | `onyx-email` (prod) / `onyx-email-local` (dev) | Attachments + mailbox settings JSON + signup requests + media fallback |
| `EMAIL` | `send_email` | CF Email Service | Production outbound send (used only if `ALLOW_FORWARDING` external) |
| `AI` | Workers AI | binding | All AI calls |
| `MAILBOX` | DO namespace | `MailboxDO` | 1 DO per mailbox |
| `EMAIL_AGENT` | DO namespace | `EmailAgent` | 1 DO per mailbox (chat history) |
| `EMAIL_MCP` | DO namespace | `EmailMCP` | 1 shared DO (MCP server) |
| `ORG_FEED` | DO namespace | `OrgFeedDO` | 1 shared DO (home feed topics/comments) |
| `PAYMENT` | DO namespace | `PaymentDO` | 1 DO per mailbox (subscriptions, invoices, payment_logs) |
| `INVENTORY` | DO namespace | `InventoryDO` | 1 shared DO (catalog, user_inventories, consumption_log) |
| `LIVE` | DO namespace | `LiveDO` | 1 DO per event (live_events, live_chat, live_viewers, WebSocket Hibernation) |

**Env vars** (public, in `wrangler.jsonc vars`):
- `DOMAINS` / `EMAIL_ADDRESSES` / `ACCESS_EMAIL_ADDRESSES` ? see root README.
- `CF_ACCOUNT_ID` ? Cloudflare account ID (used by Stream, Images, Access OTP, and Live Input APIs).
- `ACCESS_OTP_LIST_ID` / `CF_API_EMAIL` ? used by signup approval automation.
- `POLICY_AUD` / `TEAM_DOMAIN` ? CF Access. **Should be secrets** (see TODO ? 9).
- `DEMO_MODE` ? `"true"` bypasses Access. **Never set in production.**
- `TURNSTILE_SITE_KEY` ? Cloudflare Turnstile public site key.

**Secrets** (set via `wrangler secret put`):
- `SEPAY_API_KEY` ? SePay API key for VietQR generation.
- `SEPAY_WEBHOOK_SECRET` ? SePay webhook HMAC secret.
- `CF_STREAM_TOKEN` ? Cloudflare Stream API token.
- `CF_STREAM_SIGNING_KEY` ? Base64 HMAC key for signing Stream JWT tokens.
- `CF_IMAGES_TOKEN` ? Cloudflare Images API token.
- `CF_IMAGES_ACCOUNT_HASH` ? Cloudflare Images account hash for `imagedelivery.net` URLs.
- `STRIPE_SECRET` / `STRIPE_WEBHOOK_SECRET` ? Stripe stub (not yet implemented).
- `REFRESH_SECRET` ? HS256 secret for refresh tokens (30d expiry).
- `ACCESS_SECRET` ? HS256 secret for access tokens (12h expiry).
- `TURNSTILE_SECRET_KEY` ? Cloudflare Turnstile secret key for server-side verification.

**Migrations** (`wrangler.jsonc`): 7 tags (`v1`-`v7`) for `MailboxDO`, `EmailAgent`, `EmailMCP`, `OrgFeedDO`, `PaymentDO`, `InventoryDO`, `LiveDO` SQLite DOs.
**Routes** (`wrangler.jsonc:6-15`): `box.onyx.com.vn` (Access), `start.onyx.com.vn` (public).
**Observability** (`wrangler.jsonc:16-18`): enabled. **No KV, no Queues, no Analytics Engine, no D1.**

**External API integrations (no Wrangler bindings):**
- **Cloudflare Stream** (`workers/lib/stream.ts`) ? REST API via `CF_STREAM_TOKEN` secret.
- **Cloudflare Images** (`workers/lib/images.ts`) ? REST API via `CF_IMAGES_TOKEN` secret.
- **SePay** (`workers/lib/sepay.ts`) ? REST API via `SEPAY_API_KEY` + `SEPAY_WEBHOOK_SECRET` secrets.

**Local override** (`wrangler.local.jsonc`): name `onyx-email-local`, `EMAIL.remote=false` (mailpit-style), `EMAIL_ADDRESSES: []`, separate `onyx-email-local` R2 bucket.

---

## 5. Auth Flow (Production)

```
Browser (any page on box.onyx.com.vn)
  �  GET https://box.onyx.com.vn/mailbox/admin@onyx.com.vn
  ?
Cloudflare Access (Zero Trust policy)
  �  - User not authenticated?  ? 302 to Access login
  �  - User authenticated?      ? Set Cf-Access-Jwt-Assertion cookie + header
  ?
Hono Worker (workers/app.ts:67-111)
  �  app.use("*", async (c, next) => {
  �    if (isPublicRequest(c.req.raw))      ? c.set("accessEmail", ""); return next();
  �    if (import.meta.env.DEV)             ? c.set("accessEmail", header("x-dev-user-email") || "")
  �    if (c.env.DEMO_MODE === "true")      ? c.set("accessEmail", EMAIL_ADDRESSES[0])
  �    if (!POLICY_AUD || !TEAM_DOMAIN)     ? 500 (fail-closed)
  �    const token = c.req.header("cf-access-jwt-assertion")
  �    if (!token)                          ? 403 "Missing required CF Access JWT"
  �    const JWKS = createRemoteJWKSet(certsUrl)
  �    const { payload } = await jwtVerify(token, JWKS, { issuer, audience: POLICY_AUD })
  �    c.set("accessEmail", getAccessEmail(payload))
  �  })
  ?
API handlers (workers/index.ts)
  �  - filterMailboxIdsForAccess(accessEmail, EMAIL_ADDRESSES, ACCESS_EMAIL_ADDRESSES)
  �  - assertMailboxAccess(accessEmail, mailboxId, ...)
  �  - In Hono context: c.var.accessEmail
  ?
MailboxDO operations
```

### 5.1 Per-Mailbox Authorization (`workers/lib/access.ts`)

| User type | Can access |
|---|---|
| Owner (`accessEmail === mailboxId`) | Their own mailbox only |
| Privileged (`accessEmail ? ACCESS_EMAIL_ADDRESSES`) | All mailboxes in `EMAIL_ADDRESSES` |
| Other (passed CF Access but not in any of the above) | Nothing |

`filterMailboxIdsForAccess()` is used in list endpoints. `assertMailboxAccess()` is used as a per-route guard.

### 5.2 Public Auth Bypass (`workers/app.ts:50-64`)

- `start.onyx.com.vn` is in `PUBLIC_HOSTNAMES`.
- Paths `/`, `/signup`, `/api/public/signup-requests` (POST only), and static assets are unauthenticated.
- All other hostnames require Access.

### 5.3 MCP Authorization

The MCP server at `/mcp` reuses the same `c.var.accessEmail`. Caller passes a `mailboxId` parameter to scope tool calls. **Trust is shared** with the web app.

### 5.4 JWT Token Refresh Flow (Phase 07)

```
[Client] POST /api/v1/auth/refresh { refreshToken }
         ? REFRESH_SECRET ? verifyRefreshToken() using jose HS256
         ? Valid? ? generateAccessToken(email, ACCESS_SECRET, 12h)
                  + generateRefreshToken(email, REFRESH_SECRET, 30d)
         ? 200 { accessToken, refreshToken }
         ? Invalid? ? 401 "Invalid or expired refresh token"

[Client] POST /api/v1/auth/access-token { refreshToken }
         ? REFRESH_SECRET ? verifyRefreshToken()
         ? Valid? ? generateAccessToken(email, ACCESS_SECRET, 12h)
         ? 200 { accessToken }
```

**Token format:** HS256 JWT with `{ sub: email, type: "refresh"|"access", role: "member"|... }`.
**Secrets:** `REFRESH_SECRET` (30d tokens) and `ACCESS_SECRET` (12h tokens) set via `wrangler secret put`.
**Rotation:** Each refresh returns a new refresh token, enabling sliding window renewal.

---

## 6. Feature Flags

| Flag | Default | Where | Effect |
|---|---|---|---|
| `ALLOW_FORWARDING` | **`true`** | `workers/index.ts:38` | `POST /api/v1/.../emails/:id/forward` returns 404 when `false`. Currently ON. |
| `ALLOW_MAILBOX_DELETION` | `false` | `workers/index.ts:39` | `DELETE /api/v1/mailboxes/:id` returns 405 when `false`. |
| `SHOW_AGENT_SETTINGS` | `false` (UI-gated) | `app/routes/settings.tsx` | The "Agent system prompt" editor is hidden when `false`. |
| `DEMO_MODE` | unset | `workers/app.ts:78-82` | Bypasses CF Access JWT check. **Never set in production.** |

---

## 7. Threading Strategy

| Step | Source | Code |
|---|---|---|
| 1. Primary threading by `In-Reply-To` / `References` | RFC 822 | `findThreadByHeaders` (in DO) |
| 2. Fallback: subject normalization (strip `Re:`, `Fwd:`, `FW:`, `AW:`, `WG:`, `R�f:`, `SV:`) + 7-day window + 50 most-recent threads | Heuristic | `findThreadBySubject` |
| 3. Aggregation: complex CTE merges by `thread_id` and subject groups; computes `thread_count`, `thread_unread_count`, `participants`, `needs_reply`, `has_draft`, conversation state | SQL | `getThreadedEmails` (`workers/durableObject/index.ts`) |

Thread ID is stored on every email (`thread_id` column). When no header heuristic applies, the message ID is used as the thread ID.

---

## 8. Rate Limiting

### 8.1 Outbound Email Send
- **Outbound send:** 20 emails/hr and 100 emails/day per mailbox.
- Implementation: raw SQL count queries in `MailboxDO.checkSendRateLimit()`.
- Returns `429` with an error message when exceeded.

### 8.2 General-Purpose Rate Limiter (Phase 07)
- **`workers/lib/rate-limiter.ts`** — in-memory sliding-window rate limiter.
- Resets on Worker restart (acceptable per architecture plan).
- Auto-cleanup every 60s; shrinks when map > 10,000 entries.
- Factory function `createRateLimiter()` supports path-pattern matching with `:param` placeholders.
- Configured endpoints:
  | Endpoint | Method | Limit | Window |
  |---|---|---|---|
  | `/api/public/signup-requests` | POST | 5 | 60s |
  | `/api/v1/payments/checkout` | POST | 10 | 60s |
- Keyed by `{cf-connecting-ip}:{path}:{method}`. Returns `429` with `Retry-After` header.
- Expansion: add new configs to the array passed to `createRateLimiter()`.

### 8.3 Live Chat Rate Limiting
- `workers/lib/live-chat.ts` — 1 message/sec per user, in-memory map, auto-cleanup at 1000 entries.

### 8.4 Security Headers (Phase 07)
- **`workers/lib/security-headers.ts`** — `applySecurityHeaders()` set on all non-public responses:
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `Cross-Origin-Opener-Policy: same-origin`
- **`applyCspHeaders()`** — Content-Security-Policy compatible with:
  - Cloudflare Stream (`videodelivery.net`, `cloudflarestream.com`)
  - Cloudflare Images (`imagedelivery.net`)
  - Cloudflare Turnstile (`challenge.cloudflare.com`)
  - CF Web Analytics (`static.cloudflareinsights.com`)
  - `frame-ancestors 'none'` (anti-clickjacking)
- Applied as middleware in `workers/app.ts:150-155` after Access JWT validation.

### 8.5 Turnstile Integration (Phase 07 stub)
- `TURNSTILE_SITE_KEY` in `wrangler.jsonc` vars (public).
- `TURNSTILE_SECRET_KEY` set via `wrangler secret put` (server-side verification).
- Frontend widget component pending; server-side verify endpoint is a placeholder.

### 8.6 NSFW Image Scan Stub (Phase 07)
- `workers/lib/nsfw-stub.ts` — `scanImageForNsfw()` always returns `{ safe: true }`.
- `POST /api/v1/security/scan-image { imageUrl }` endpoint wired but returns stub result.
- TODO: Integrate with Cloudflare Images moderation API when available.

---

## 9. Known TODOs / Limitations

| Location | Issue | Suggested fix |
|---|---|---|
| `workers/index.ts:235` | `await c.env.BUCKET.delete(key); // TODO: also delete DO data and R2 attachment blobs` | Mailbox deletion disabled (`ALLOW_MAILBOX_DELETION = false`); would leak data if enabled. Fix: enumerate R2 `attachments/<emailId>/...` keys + `storage.sql.exec("DELETE FROM emails WHERE folder_id IN ...")` + `c.env.MAILBOX.delete(id)` |
| `workers/index.ts:330` | `if (draft_id) await stub.deleteEmail(draft_id); // not atomic` | Draft save race. Fix: single SQL `INSERT OR REPLACE` after a `WHERE id = draft_id` check, or `storage.transactionSync`. |
| `workers/index.ts:38-39` | `ALLOW_FORWARDING` + `ALLOW_MAILBOX_DELETION` hardcoded | Promote to env vars. |
| `wrangler.jsonc:33-34` | `POLICY_AUD` + `TEAM_DOMAIN` in `vars` (not `secret`) | Move to `wrangler secret put`. |
| `wrangler.jsonc` (missing) | No `send_email` block | Add it for production outbound send (see [`deployment-guide.md`](./deployment-guide.md) � 3.4). |
| `workers/durableObject/index.ts` `getThreadEmails` | `upsertSocialGraphForEmail` runs on every read (N+1) | Batch upsert, debounce, or move to a write-time hook. |
| `app/components/EmailIframe.tsx` | No automated CSP test for inbound HTML | Add unit test that runs DOMPurify + asserts `<script>`, `onerror=`, `javascript:` URLs are stripped. |
| `app/components/MCPPanel.tsx:48-63` | Hardcodes 14 tools, server exposes 20 | Move to a `useMCPTools()` query that hits `/mcp` `tools/list`. |
| `app/components/*` (3 places) | `window.confirm` bypasses design system | Replace with Kumo `Dialog` + `<Banner variant="warning">`. |
| `app/entry.server.tsx` | 2-space indent (legacy from upstream fork) | Reformat to tabs. |
| (gap) | No ESLint / Prettier config | See [`code-standards.md`](./code-standards.md) � 9. |
| (gap) | No app-level CSP `<meta>` in `app/root.tsx` | Add a strict CSP in the worker response for non-iframe HTML. |
| (gap) | No CI | Manual typecheck/test/lint only. |
| (gap) | Mailbox settings edits stored in R2 only � no DO cache, no broadcast to other open tabs | Acceptable for V1; consider DO fanout for V2. |
| (gap) | `DEMO_MODE` not gated by env assertion in prod | Add a startup check that throws if `DEMO_MODE === "true"` and `import.meta.env.MODE === "production"`. |

---

## 10. Operational Notes

- **Cold start:** ~100-300ms for first-time access to a mailbox DO; < 50ms after.
- **Storage cost:** Mailbox SQLite + R2 are billed per GB-month. Consider archival in V2.
- **No backup policy.** DO SQLite and R2 are durable within CF; no off-platform backup.
- **No multi-region replication.** DOs are region-pinned; R2 is global.
- **Internal-only delivery:** External recipients blocked at the API (`getRecipientRouting`).
- **PaymentDO alarm:** Runs every 6 hours; handles expiring subscriptions (3-day window) and marks past-due. Always re-schedules on error.
- **Stream signed tokens:** 1-hour default expiry, configurable. HMAC JWT with `sub=videoId`.
- **Images variant construction:** Uses `imagedelivery.net/{accountHash}/{imageId}/{variant}` when `CF_IMAGES_ACCOUNT_HASH` is configured; falls back to API-provided variant URLs.
- **R2 media fallback:** Available when Stream/Images tokens are not configured; returns 501 for 'not configured' errors on those endpoints.
- **InventoryDO alarm:** Runs every 1 hour; auto-expires items past their `expires_at`. Always re-schedules on error.
- **LiveDO WebSocket Hibernation:** Connections auto-hibernate when idle; state is restored from `serializeAttachment()` on wake. No persistent connection charge.
- **LiveDO Stream provisioning:** Live Input is created on `startEvent()` and deleted on `endEvent()`. Orphaned inputs may remain if the DO is destroyed mid-stream.
- **Rate limiter is in-memory:** Resets on Worker restart. Acceptable for current scale. Consider moving to DO or KV if rate-limit state persistence is needed.
- **JWT secrets:** `REFRESH_SECRET` and `ACCESS_SECRET` are HS256 symmetric keys. Rotate manually via `wrangler secret put`; all existing tokens become invalid on rotation.
- **NSFW classification:** Currently a stub (`scanImageForNsfw` always returns `{ safe: true }`). Real CF Images moderation integration is pending.

---

## 11. Quick Links

[`codebase-summary.md`](./codebase-summary.md) � [`code-standards.md`](./code-standards.md) � [`project-overview-pdr.md`](./project-overview-pdr.md) � [`project-roadmap.md`](./project-roadmap.md) � [`deployment-guide.md`](./deployment-guide.md) � [`design-guidelines.md`](./design-guidelines.md) � `wrangler.jsonc` � `wrangler.local.jsonc`
