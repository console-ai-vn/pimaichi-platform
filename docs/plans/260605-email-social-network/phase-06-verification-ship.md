# Phase 06 Verification Ship

Parent plan: [plan.md](./plan.md)

## Goal

Ship only after proving old mailflow still works and new social behavior is private.

## Commands

```bash
npm test                    # pass, 33 tests
npm run typecheck           # pass
npm run build               # pass
npm run dev                 # pass, verified at localhost:5190 during smoke
```

## Manual Smoke

- [x] Open mobile viewport `360x780`.
- [x] Confirm inbox cards fit without horizontal scroll.
- [x] Confirm conversation sticky action bar is reachable.
- [x] Confirm context/profile opens as sheet or drill-in.
- [x] Create or open `admin@onyx.com.vn` route.
- [x] Send test email from `admin@onyx.com.vn` to `test@onyx.com.vn` and receive it in test inbox through live API internal delivery.
- [x] Confirm contact/profile appears.
- [x] Add internal note.
- [x] Reply to sender.
- [x] Verify outbound email excludes internal note.
- [x] Assign conversation and change status.
- [x] Verify AI/MCP social context tools are exposed.
- [x] Confirm draft/send separation remains: reply send uses explicit user API action; private note was not copied into sent body.
- [x] Verify `/mcp` tools list includes social context tools.

## HTTP Smoke

- [x] `GET /` returns 200.
- [x] `GET /mailbox/admin@onyx.com.vn/emails/inbox` returns 200.
- [x] `POST /mcp` initialize returns 200 and session id.
- [x] `POST /mcp` `tools/list` includes:
  - `get_contact_profile`
  - `get_conversation_context`
  - `create_internal_note`
  - `update_conversation_state`

## Mobile Visual Smoke

- [x] Chrome headless at `360x780` rendered inbox card with no horizontal overflow.
- [x] Inbox card showed participants, thread count, subject, `waiting`, `High`, assignee, and latest snippet.
- [x] Conversation screen showed state chips, internal note block, state event, and sticky `Reply / Note / Context` action bar.
- [x] Context sheet opened with people, state controls, assignee, private notes, and activity.
- [x] Reply composer opened from sticky action bar.
- [x] Reply composer included quoted external email body and did not include private internal note text.
- Evidence: `.tmp/dev-smoke/mobile-social-smoke.json`
- Screenshot: `.tmp/dev-smoke/mobile-social-context.png`

## Live API Smoke

- [x] Local dev config exposes `admin@onyx.com.vn` and `test@onyx.com.vn`.
- [x] `POST /api/v1/mailboxes/admin@onyx.com.vn/emails` sends to configured internal mailbox.
- [x] `GET /api/v1/mailboxes/test@onyx.com.vn/emails?folder=inbox` finds delivered message.
- [x] `POST /threads/:threadId/notes` creates private internal note.
- [x] `PATCH /threads/:threadId/state` updates `waiting`, `high`, assignee, and `needs_reply`.
- [x] `GET /threads/:threadId/events` includes `note_created` and `state_updated`.
- [x] `POST /emails/:id/reply` sends external-safe reply.
- [x] Sent reply body does not include private note.
- Evidence: `.tmp/dev-smoke/live-api-smoke.json`

## Fixes During Verification

- Mounted `EmailMCP.serve("/mcp", { binding: "EMAIL_MCP" })` in `workers/app.ts`.
- Replaced the previous hard-coded `/mcp` 404 handlers.
- Restored local smoke parity by configuring `wrangler.local.jsonc` with `admin@onyx.com.vn`, `test@onyx.com.vn`, and `ceo@bdsmetro.com`; local config had an empty mailbox allowlist, so internal delivery treated `test@onyx.com.vn` as external.

## Deferred Preview Checks

- Real Cloudflare Email Routing inbound to preview/production mailbox.
- Live Workers AI relationship-summary response against a real mailbox/thread.
- Optional screenshot evidence should be copied out of `.tmp/` before PR if required.

## Acceptance

- Tests, typecheck, build pass.
- Mobile viewport smoke passes before desktop polish.
- Existing core email UX still works.
- Internal social data never leaks to external recipients.
- Plan status can move from `draft` to `approved` only after MR.D confirms unresolved questions.

## Unresolved Questions

- Need production test mailbox beyond `admin@onyx.com.vn`?
- Need screenshot evidence in docs/reports before deploy?
