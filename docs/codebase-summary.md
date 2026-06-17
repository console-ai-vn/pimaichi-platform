# ONYX � Codebase Summary

| Field | Value |
|---|---|
| **Project name** | `onyx-email` (`package.json:2`) |
| **Worker name (prod)** | `onyx-email` (`wrangler.jsonc:3`) |
| **Worker name (local)** | `onyx-email-local` (`wrangler.local.jsonc:3`) |
| **Custom domains** | `box.onyx.com.vn` (app, Access-protected), `start.onyx.com.vn` (public landing) |
| **Compatibility date** | `2025-11-28` |
| **Compat flag** | `nodejs_compat` |
| **Last updated** | 2026-06-17 |

---

## 1. Tech Stack

### 1.1 Frontend (`app/`) � 46 files, ~7,200 LOC

| Layer | Library | Version | Purpose |
|---|---|---|---|
| UI framework | `react` / `react-dom` | `^19.1.0` | React 19 |
| Routing / SSR | `react-router` (framework mode) | `^7.5.3` | Config-based routes + SSR |
| Build | `vite` | `^7.3.5` | Dev + production build |
| Cloudflare adapter | `@cloudflare/vite-plugin` | `^1.39.1` | Bindings injection for dev/build |
| Styling | `tailwindcss` + `@tailwindcss/vite` | `^4.1.4` | Tailwind v4 CSS-first config |
| Design system | `@cloudflare/kumo` | `^1.13.0` | UI primitives (no shadcn/MUI) |
| Icons | `@phosphor-icons/react` | `^2.1.10` | Phosphor icon set |
| Server state | `@tanstack/react-query` | `^5.99.0` | Caching, optimistic updates, mutations |
| UI state | `zustand` | `^5.0.12` | Single global UI store |
| Rich text | `@tiptap/react` + 8 extensions (pinned 3.20.2) | `3.20.2` | Composer |
| HTML sanitization | `dompurify` + `@types/dompurify` | `^3.4.7` | Iframe content, signatures, reply blocks |
| Markdown | `react-markdown` + `remark-gfm` | `^10.1.0` / `^4.0.1` | Agent chat rendering |
| AI types | `ai` (Vercel AI SDK) | `^6.0.116` | `UIMessage` type in `AgentPanel.tsx` |

### 1.2 Backend (`workers/`) � 30 files, ~7,000 LOC

| Layer | Library | Version | Purpose |
|---|---|---|---|
| HTTP router | `hono` | `^4.12.23` | API + middleware + catch-all |
| ORM | `drizzle-orm` + `drizzle-orm/durable-sqlite` | `^0.45.2` | DO SQLite queries |
| Inbound mail parser | `postal-mime` | `^2.6.1` | RFC 822 parser |
| Validation | `zod` | `^3.25.76` | Request schemas, tool schemas |
| JWT verify + sign | `jose` | `^6.2.1` | Cloudflare Access JWT verify + Stream token sign |
| AI streaming | `ai` + `workers-ai-provider` | `^6.0.116` / `^3.1.2` | Vercel AI SDK v6 |
| Agent base | `@cloudflare/ai-chat` | `^0.1.8` | `AIChatAgent` class |
| Agent/MCP runtime | `agents` | `^0.7.6` | `agents/mcp` MCP server |
| MCP SDK | `@modelcontextprotocol/sdk` | (dep of `agents/mcp`) | MCP protocol |
| Bot detection | `isbot` | `^5.1.27` | SSR `await body.allReady` |

### 1.3 Auth

- **No** frontend auth, **no** cookies, **no** session storage, **no** JWT issuance.
- Single boundary: **Cloudflare Access** validates `cf-access-jwt-assertion` header against CF's JWKS.
- Public hostnames (`start.onyx.com.vn`) bypass Access for `/`, `/signup`, and `/api/public/*` � see `workers/app.ts:50-64`.
- Local dev: `import.meta.env.DEV` ? trust `x-dev-user-email` header.
- `DEMO_MODE=true` bypasses for non-prod demos.

### 1.4 Data

| Layer | Technology | Where |
|---|---|---|
| Email + folder + social + notes rows | Durable Object SQLite (MailboxDO) | `workers/durableObject/index.ts` (1100 LOC) |
| Payment subscriptions + invoices | Durable Object SQLite (PaymentDO) | `workers/durableObject/payment.ts` (334 LOC) |
| Mailbox settings JSON | R2 (`mailboxes/<email>.json`) | `workers/index.ts:202, 224` |
| Attachment binaries | R2 (`attachments/<emailId>/<attachmentId>/<filename>`) | `workers/lib/attachments.ts` |
| AI chat history | Durable Object SQLite (per `EmailAgent` instance) | `workers/agent/index.ts` |
| Signup requests | R2 (`signup-requests/<ts>-<uuid>.json`) | `workers/index.ts:153-164` |
| Media binary (R2 fallback) | R2 (`media/<mailboxId>/<uuid>-<filename>`) | `workers/routes/media.ts:177-227` |
| Migrations | **11 MailboxDO migrations** + **1 PaymentDO migration** | Auto-run on DO construction |

**No D1, no KV, no Queues, no Analytics Engine.**

### 1.5 AI Models

| Use | Model | Where |
|---|---|---|
| Chat (auto-draft + agent chat) | `@cf/moonshotai/kimi-k2.5` | `workers/agent/index.ts:347, 529` |
| Prompt-injection scanner | `@cf/meta/llama-3.1-8b-instruct-fast` | `workers/lib/ai.ts:32` |
| Draft verifier | `@cf/meta/llama-4-scout-17b-16e-instruct` | `workers/lib/ai.ts:138` |

---

## 2. Top-Level File Tree (with LOC)

> LOC = actual line counts (read from files). Totals computed from `getFiles` + line length.

```
.
+-- app/                          React frontend  (45 files, ~6,913 LOC)
�   +-- components/               15 root + 2 in conversation-social/ + 5 in email-panel/
�   �   +-- AgentPanel.tsx            592 LOC   ? tech debt: refactor target
�   �   +-- AgentSidebar.tsx           85
�   �   +-- ComposeEmail.tsx          147
�   �   +-- ComposePanel.tsx          243
�   �   +-- EmailAttachmentList.tsx    82
�   �   +-- EmailIframe.tsx           151   ? sandboxed HTML iframe
�   �   +-- EmailPanel.tsx            440   ? tech debt: refactor target
�   �   +-- Header.tsx                140
�   �   +-- MailboxSplitView.tsx       51
�   �   +-- MCPPanel.tsx              148   ? hardcodes 14 tools (drift)
�   �   +-- MobileSocialInboxCard.tsx  210   ? V1.5 mobile thread card
�   �   +-- RichTextEditor.tsx        239   ? TipTap
�   �   +-- Sidebar.tsx               264
�   �   +-- conversation-social/
�   �   �   +-- ConversationStateControls.tsx   75
�   �   �   +-- SocialContextSheet.tsx         143
�   �   +-- email-panel/
�   �       +-- EmailPanelDialogs.tsx  158
�   �       +-- EmailPanelHeader.tsx    26
�   �       +-- EmailPanelToolbar.tsx  243
�   �       +-- SingleMessageView.tsx   63
�   �       +-- ThreadMessage.tsx      220
�   +-- hooks/                    2 files
�   �   +-- useComposeForm.ts         287   ? tech debt: refactor target
�   �   +-- useUIStore.ts              98   ? Zustand store
�   +-- lib/                      3 utility files
�   �   +-- image-attachments.ts       53
�   �   +-- search-parser.ts          125   ? Gmail-style operators
�   �   +-- utils.ts                  215
�   +-- queries/                  5 TanStack Query modules
�   �   +-- emails.ts                 279   ? incl. optimistic updates
�   �   +-- folders.ts                 61
�   �   +-- keys.ts                    27   ? centralised queryKeys
�   �   +-- mailboxes.ts               61
�   �   +-- search.ts                  60
�   +-- routes/                   9 route modules
�   �   +-- email-list.tsx            352   ? tech debt: refactor target
�   �   +-- home.tsx                  366   ? tech debt: refactor target
�   �   +-- landing.tsx               220   ? public marketing + signup
�   �   +-- mailbox-index.tsx           9
�   �   +-- mailbox.tsx                73
�   �   +-- not-found.tsx              26
�   �   +-- search-results.tsx        110
�   �   +-- settings.tsx              139
�   �   +-- signup.tsx                  2   ? re-exports landing
�   +-- services/
�   �   +-- api.ts                    165   ? typed fetch client
�   +-- types/
�   �   +-- index.ts                   99
�   +-- entry.server.tsx               47   ? React Router SSR entry
�   +-- index.css                       -   ? Tailwind v4 imports
�   +-- root.tsx                       167   ? App shell
�   +-- routes.ts                       22   ? Route config
�
+-- workers/                      Cloudflare Worker  (22 files, ~4,741 LOC)
�   +-- app.ts                        148   ? Hono entry + Access JWT + email handler
�   +-- index.ts                      577   ? API routes + receiveEmail
�   +-- email-sender.ts                72   ? sendEmail() wrapper
�   +-- types.ts                       14   ? Env, AccessVariables
�   +-- agent/
�   �   +-- index.ts                  618   ? EmailAgent DO (13 tools)
�   +-- db/
�   �   +-- schema.ts                  44   ? Drizzle type schema (no D1)
�   +-- durableObject/
�   �   +-- index.ts                 1100   ? MailboxDO (all email/folder CRUD)
�   �   +-- migrations.ts             238   ? 11 inline SQL migrations
�   +-- lib/                         12 files
�   �   +-- access.ts                  78
�   �   +-- ai.ts                     192
�   �   +-- attachments.ts            112
�   �   +-- conversation-state.ts      58
�   �   +-- email-helpers.ts          266
�   �   +-- internal-delivery.ts      116
�   �   +-- internal-notes.ts          26
�   �   +-- mailbox.ts                 60
�   �   +-- recipient-routing.ts       48
�   �   +-- schemas.ts                 95
�   �   +-- social-graph.ts            48
�   �   +-- tools.ts                  617
�   +-- mcp/
�   �   +-- index.ts                  511   ? EmailMCP DO (20 tools)
�   +-- routes/
�       +-- reply-forward.ts          200   ? reply + forward handlers
�
+-- shared/                       Shared by app + workers  (3 files, 204 LOC)
�   +-- cid-images.ts                  61
�   +-- dates.ts                      106
�   +-- folders.ts                     63
�
+-- tests/                        Node test runner  (7 files, 33 tests, ~305 LOC)
�   +-- access.test.ts                 83  ? 9 tests
�   +-- attachments.test.ts            73  ? 8 tests
�   +-- cid-images.test.ts             30  ? 1 test
�   +-- conversation-state.test.ts     41  ? 3 tests
�   +-- internal-delivery.test.ts      26  ? 2 tests
�   +-- internal-notes.test.ts         34  ? 4 tests
�   +-- social-graph.test.ts           58  ? 4 tests
�
+-- docs/                         Documentation
+-- public/                       Static assets (favicons, demo_app.png)
+-- .react-router/                Generated by `react-router typegen`
+-- wrangler.jsonc                Production config
+-- wrangler.local.jsonc          Local-dev config overrides
+-- worker-configuration.d.ts     Generated by `wrangler types`
+-- vite.config.ts                Vite + Cloudflare + Tailwind + RR plugins
+-- react-router.config.ts        ssr: true
+-- tsconfig.json                 Project references shell
+-- tsconfig.cloudflare.json      Active TS config for app + workers
+-- tsconfig.node.json            TS config for vite.config.ts
```

**Totals:** ~15,000 LOC across `app/`, `workers/`, `shared/`, `tests/`.

## 3. Key Modules and Their Roles

### 3.1 Frontend entry & shell

| File | Role |
|---|---|
| `app/root.tsx` | Wraps tree in `QueryClientProvider` ? `LinkProvider` ? `TooltipProvider` ? `Toasty`. SSR-safe QueryClient singleton. |
| `app/entry.server.tsx` | RR7 SSR via `renderToReadableStream`; uses `isbot` to decide whether to await `body.allReady`. |
| `app/routes.ts` | Config-based route table (RR7). |
| `app/hooks/useUIStore.ts` | Zustand store: `selectedEmailId`, `isComposing`, `composeOptions`, sidebar/agent toggles. |

### 3.2 Routes (RR7)

| Route | File | What it does |
|---|---|---|
| `/` | `app/routes/landing.tsx` | **Public** Vietnamese marketing + signup form (no auth). |
| `/signup` | `app/routes/signup.tsx` | Re-exports `landing`. |
| `/app` | `app/routes/home.tsx` | Mailbox list + create/delete dialogs + auto-create from `EMAIL_ADDRESSES`. |
| `/mailbox/:mailboxId` | `app/routes/mailbox.tsx` | Mailbox shell (Sidebar + Header + Outlet + ComposeEmail modal). |
| `/mailbox/:mailboxId` (index) | `mailbox-index.tsx` | `<Navigate replace>` ? `emails/inbox`. |
| `/mailbox/:mailboxId/emails/:folder` | `email-list.tsx` | Threaded list, 25-per-page, 30s auto-refetch. |
| `/mailbox/:mailboxId/settings` | `settings.tsx` | Display name + (gated) agent system prompt. |
| `/mailbox/:mailboxId/search?q=�` | `search-results.tsx` | Gmail-style search results with pagination. |
| `*` | `not-found.tsx` | 404. |

### 3.3 Hooks

| File | Exports |
|---|---|
| `app/hooks/useUIStore.ts` | `useUIStore` (Zustand) � UI state. |
| `app/hooks/useComposeForm.ts` | `useComposeForm` � composer state machine (to/cc/bcc/subject/body/attachments, send/reply/forward, draft save). |

### 3.4 Queries (TanStack Query)

| File | Hooks |
|---|---|
| `app/queries/keys.ts` | `queryKeys` factory. |
| `app/queries/mailboxes.ts` | `useMailboxes`, `useMailbox`, `useCreateMailbox`, `useUpdateMailbox`, `useDeleteMailbox`. |
| `app/queries/emails.ts` | `useEmails`, `useEmail`, `useThreadReplies`, `useSendEmail`, `useUpdateEmail` (optimistic + rollback), `useMarkThreadRead`, `useDeleteEmail`, `useMoveEmail`, `useSaveDraft`, `useReplyToEmail`, `useForwardEmail`. |
| `app/queries/folders.ts` | `useFolders`, `useCreateFolder`, `useUpdateFolder`, `useDeleteFolder`. |
| `app/queries/search.ts` | `useSearchEmails` (`SEARCH_PAGE_SIZE = 25`). |

### 3.5 Services & types

| File | Role |
|---|---|
| `app/services/api.ts` | `ApiError`, `request<T>()`, HTTP helpers, all paths under `/api/v1/`. |
| `app/types/index.ts` | `Mailbox`, `Email`, `Attachment`, `Folder`, `MailboxSettings`, `ConversationState`, `ConversationEvent`, `InternalNote`. |

### 3.6 Workers (backend)

| File | Role |
|---|---|
| `workers/app.ts` | Hono app with global `app.use("*")` Access-JWT middleware + `default.email` handler. Mounts `apiApp` and RR7 SSR catch-all. |
| `workers/index.ts` | Hono API routes (config, mailboxes, emails, threads, folders, search, attachments) + `receiveEmail` + CORS. |
| `workers/email-sender.ts` | `sendEmail(env.EMAIL, params)` wrapper. |
| `workers/durableObject/index.ts` | `MailboxDO` (1100 LOC): folders, emails, attachments, threading CTE, social graph, conversation state, internal notes, events, rate limiting. |
| `workers/durableObject/migrations.ts` | **11 inline SQL migrations**, applied via `applyMigrations()` in DO constructor. |
| `workers/db/schema.ts` | Drizzle type schema (no D1 binding). |
| `workers/agent/index.ts` | `EmailAgent` DO (`AIChatAgent`): **13 tools**, `onNewEmail` auto-draft, streaming chat. |
| `workers/mcp/index.ts` | `EmailMCP` DO: **20 MCP tools**, mounted via DO routing at `/mcp`. |
| `workers/routes/reply-forward.ts` | `handleReplyEmail`, `handleForwardEmail`. |
| `workers/lib/access.ts` | `assertMailboxAccess`, `filterMailboxIdsForAccess`, `normalizeEmail`, `AccessAuthorizationError`. |
| `workers/lib/ai.ts` | `isPromptInjection` (fails closed), `verifyDraft`. |
| `workers/lib/attachments.ts` | R2 attach storage + inbound validation (JPEG/PNG/WebP, 10MB/25MB). |
| `workers/lib/conversation-state.ts` | `CONVERSATION_STATUSES`, `CONVERSATION_PRIORITIES`, `normalizeConversationStatePatch`. |
| `workers/lib/email-helpers.ts` | `validateSender`, `generateMessageId`, `buildThreadingHeaders`, `getFullEmail/Thread`. |
| `workers/lib/internal-delivery.ts` | DO-to-DO direct write (no SMTP). |
| `workers/lib/internal-notes.ts` | `CONVERSATION_EVENT_TYPES`, `normalizeInternalNoteBody`, `normalizeConversationEventType`. |
| `workers/lib/mailbox.ts` | `requireMailbox` Hono middleware. |
| `workers/lib/recipient-routing.ts` | `getRecipientRouting` (internal vs external), `getInternalOnlyDeliveryError`. |
| `workers/lib/schemas.ts` | Zod request schemas. |
| `workers/lib/social-graph.ts` | `extractSocialParticipants`, `normalizeSocialEmailAddress`, `socialContactIdForEmail`. |
| `workers/lib/tools.ts` | Shared tool business logic (draft/send/list/etc.) used by both agent and MCP. |

### 3.7 Shared (`shared/`)

| File | Role |
|---|---|
| `shared/folders.ts` | `Folders` const, `SYSTEM_FOLDER_IDS`, `FOLDER_DISPLAY_NAMES` � single source of truth for folder IDs. |
| `shared/dates.ts` | `formatListDate`, `formatDetailDate`, `formatShortDate`, `formatQuotedDate`. |
| `shared/cid-images.ts` | `rewriteCidImages` � replace `cid:` inline refs with API URLs. |

---

## 4. Naming Conventions

| Kind | Convention | Example |
|---|---|---|
| **Path alias (FE)** | `~/*` ? `./app/*` (`tsconfig.cloudflare.json`) | `~/services/api`, `~/hooks/useUIStore` |
| **Component file** | PascalCase `.tsx` | `EmailPanel.tsx`, `ComposeEmail.tsx` |
| **Sub-component folder** | lowercase, hyphen-allowed | `email-panel/EmailPanelToolbar.tsx` |
| **Hook file** | `use<Name>.ts` | `useUIStore.ts`, `useComposeForm.ts` |
| **Zustand store** | `use<Name>Store` exported from `useUIStore.ts` | `useUIStore` |
| **Query hook** | `use<Resource>` or `use<Action><Resource>` | `useMailboxes`, `useCreateMailbox`, `useSendEmail` |
| **Query key** | Factory in `app/queries/keys.ts` | `queryKeys.emails.list(mailboxId, folder)` |
| **Route file** | `kebab-case.tsx` or domain noun | `email-list.tsx`, `search-results.tsx`, `landing.tsx` |
| **API endpoint** | `/api/v1/...` (auth) or `/api/public/...` (no auth) | `/api/v1/mailboxes/:mailboxId/emails`, `/api/public/signup-requests` |
| **Worker file** | camelCase `.ts` (no class suffix on file) | `email-sender.ts`, `access.ts` |
| **Durable Object class** | PascalCase + `DO` suffix | `MailboxDO`, `EmailAgent`, `EmailMCP` |
| **DO binding name** | SCREAMING_SNAKE | `MAILBOX`, `EMAIL_AGENT`, `EMAIL_MCP` |
| **Env var (public)** | SCREAMING_SNAKE in `wrangler.jsonc` `vars` | `DOMAINS`, `EMAIL_ADDRESSES` |
| **Env secret** | SCREAMING_SNAKE in `.dev.vars` / dashboard | `POLICY_AUD`, `TEAM_DOMAIN` |
| **Migrations** | `<n>_<purpose>` | `1_initial_setup`, `11_add_internal_notes_events` |
| **SQL table** | snake_case | `folders`, `emails`, `attachments`, `conversation_state` |
| **SQL column** | snake_case | `folder_id`, `in_reply_to`, `thread_id` |
| **TypeScript type** | PascalCase | `Email`, `MailboxSettings`, `ConversationState` |
| **Zod schema** | PascalCase + `Schema` | `SendEmailRequestSchema`, `DraftBody` |

---

## 5. Test Setup

- **Runner:** Node's built-in test runner (`pnpm test` ? `node --test`), per `package.json:26`.
- **Files:** `tests/*.test.ts` � **9 files, ~60 tests**:

| File | Tests | Covers |
|---|---|---|
| `tests/access.test.ts` | 9 | `assertMailboxAccess`, `filterMailboxIdsForAccess`, `getAccessEmail` |
| `tests/attachments.test.ts` | 8 | inbound image validation (types, sizes, 25MB cap) |
| `tests/cid-images.test.ts` | 1 | `rewriteCidImages` |
| `tests/conversation-state.test.ts` | 3 | `normalizeConversationStatePatch` + migration 10 SQL |
| `tests/internal-delivery.test.ts` | 2 | `getRecipientRouting` (internal vs external split) |
| `tests/internal-notes.test.ts` | 4 | `normalizeInternalNoteBody`, `normalizeConversationEventType` + migration 11 SQL |
| `tests/social-graph.test.ts` | 4+ | `extractSocialParticipants`, `normalizeSocialEmailAddress`, `socialContactIdForEmail` + migration 9 SQL |

- **Imports:** `node:assert/strict` + `node:test` (no Jest, no Vitest).
- **No browser/E2E tests.** All tests are pure unit tests of `workers/lib/*`, `workers/durableObject/migrations.ts`, `workers/durableObject/paymentMigrations.ts`, and `shared/*`.

**Run:**

```bash
pnpm test
```

---

## 6. Build & Deploy Commands

| Command | What it does |
|---|---|
| `pnpm install` | Install deps (uses `pnpm-lock.yaml`) |
| `pnpm dev` | Vite + RR dev server (port 5173) with `wrangler.local.jsonc` bindings |
| `pnpm typecheck` | `cf-typegen && react-router typegen && tsc -b` |
| `pnpm test` | `node --test tests/*.test.ts` |
| `pnpm build` | `react-router build` � produces `build/client` and `build/server` |
| `pnpm preview` | `pnpm build && vite preview` |
| `pnpm deploy` | `pnpm build && wrangler deploy` (uses `wrangler.jsonc`, deploys to `onyx-email`) |
| `wrangler r2 bucket create onyx-email` | Create the production R2 bucket |
| `wrangler r2 bucket create onyx-email-local` | Create the local R2 bucket |

> **Vite plugin note:** `vite.config.ts` uses `cloudflare()` with `viteEnvironment: { name: "ssr" }` to load `wrangler.local.jsonc` in dev and `wrangler.jsonc` in build.

> **Full deploy walkthrough:** [`deployment-guide.md`](./deployment-guide.md).
