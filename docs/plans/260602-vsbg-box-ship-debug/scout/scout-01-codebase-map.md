# Scout 01 - Codebase Map

Scope: ONYX ship-debug plan. No implementation.

## Required docs

- `codebase-summary.md`: missing.
- `code-standards.md`: missing.
- `system-architecture.md`: missing.
- `project-overview-pdr.md`: missing.
- Fallback scout used local `rg` and git diff.

## Relevant files

- Upstream mail render:
  - `app/lib/utils.ts`
  - `app/components/EmailIframe.tsx`
  - `app/components/email-panel/SingleMessageView.tsx`
  - `app/components/email-panel/ThreadMessage.tsx`
  - `app/components/EmailAttachmentList.tsx`
- Backend mailflow:
  - `workers/index.ts`
  - `workers/routes/reply-forward.ts`
  - `workers/email-sender.ts`
  - `workers/lib/attachments.ts`
  - `workers/durableObject/index.ts`
- ONYX auth/config overlay:
  - `workers/app.ts`
  - `workers/lib/access.ts`
  - `workers/lib/mailbox.ts`
  - `workers/types.ts`
  - `wrangler.jsonc`
- Tests:
  - `tests/access.test.ts`
  - `tests/attachments.test.ts`

## Current dirty state

- `app/components/EmailIframe.tsx`: dirty. It adds `allow-same-origin` and expands CSP `img-src`.
- `app/lib/utils.ts`: dirty. It rewrites `cid` for any `content_id`, not only `disposition=inline`.
- `Metro Mail.pdf`: untracked user file. Do not add.
- `docs/superpowers/`: previous plan untracked.

## Current config evidence

- Worker: `onyx-email`.
- Custom domain route: `box.onyx.com.vn`.
- Mailbox allowlist: `admin@onyx.com.vn`.
- Access login members: `ceo@bdsmetro.com`.
- Send Email binding exists as `EMAIL`, remote true.

## Immediate planning implication

- Do not keep dirty iframe/security changes without proving root cause.
- First implementation task should inspect real email metadata/body/attachment status.
- Need plan phase for outbound readiness because Cloudflare Email Sending CLI returned 404 earlier.

## Unresolved

- Real failing email id and raw debug metadata not captured yet.
- Whether iframe image request returns 403 or 404 not captured yet.
