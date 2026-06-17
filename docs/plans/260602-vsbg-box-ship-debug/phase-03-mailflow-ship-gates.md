# Phase 03 Mailflow Ship Gates

## Context links

- Parent plan: [plan.md](./plan.md)
- Depends on: [phase-02-upstream-core-restore.md](./phase-02-upstream-core-restore.md)

## Overview

- Date: 2026-06-02
- Description: Define honest ship gates for inbound/outbound mail.
- Priority: P1
- Implementation status: pending
- Review status: pending

## Key Insights

- Inbound Feed works.
- Outbound reply/compose not proven.
- Cloudflare Email Sending CLI returned 404 earlier for `onyx.com.vn`.
- App must not create fake Sent success if provider cannot deliver.

## Requirements

- Inbound is required for MVP.
- Outbound can be disabled if not configured, but UI/API must say so.
- If outbound enabled, external inbox must receive test email.

## Architecture

- Add explicit outbound readiness config.
- Keep send provider behind one boundary: `workers/email-sender.ts`.

## Related code files

- `workers/email-sender.ts`
- `workers/index.ts`
- `workers/routes/reply-forward.ts`
- `app/hooks/useComposeForm.ts`
- `app/components/ComposePanel.tsx`
- `wrangler.jsonc`

## Implementation Steps

1. Verify Cloudflare Email Sending:
   ```powershell
   npx.cmd wrangler email sending settings onyx.com.vn
   npx.cmd wrangler email sending enable onyx.com.vn
   ```
2. If Cloudflare Sending unavailable, set:
   ```json
   "OUTBOUND_EMAIL_PROVIDER": "disabled"
   ```
3. Before writing Sent row, return:
   ```json
   { "error": "Outbound email is not configured" }
   ```
4. If using Resend/Lark later, implement in `workers/email-sender.ts` only.
5. Browser-test compose/reply.

## Todo list

- [ ] Decide outbound provider.
- [ ] Add readiness guard.
- [ ] Prevent fake Sent row.
- [ ] Verify one external receive if outbound enabled.

## Success Criteria

- Compose/reply either sends and external inbox receives, or clearly returns disabled state.
- No silent `waitUntil(...catch())` fake success.

## Risk Assessment

- Cloudflare Email Sending may be unavailable on current account/product.
- Resend/Lark adds secrets and DNS/SPF/DKIM scope.

## Security Considerations

- Do not paste or commit provider keys.
- Rotate Global API Key after MVP.

## Next steps

- Move to Phase 04 for final deploy acceptance.

