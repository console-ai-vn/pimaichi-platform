# Phase 02 Upstream Core Restore

## Context links

- Parent plan: [plan.md](./plan.md)
- Depends on: [phase-01-evidence-lock.md](./phase-01-evidence-lock.md)

## Overview

- Date: 2026-06-02
- Description: Ðua mail rendering/attachments v? upstream-compatible core, ch? patch ph?n có evidence.
- Priority: P0
- Implementation status: pending
- Review status: pending

## Key Insights

- Upstream dã có `rewriteInlineImages`, attachment storage, iframe renderer.
- Dirty changes hi?n t?i có th? dã relax security và d?i semantics cid.
- Restore tru?c, patch sau.

## Requirements

- Preserve ONYX Access overlay.
- Preserve admin mailbox config.
- Avoid broad rewrites of cid behavior unless evidence requires.

## Architecture

- Upstream core files should remain close to upstream.
- ONYX-specific logic stays in Access/mailbox overlay.

## Related code files

- `app/lib/utils.ts`
- `app/components/EmailIframe.tsx`
- `workers/index.ts`
- `workers/routes/reply-forward.ts`
- `workers/lib/attachments.ts`

## Implementation Steps

1. Restore upstream-compatible `EmailIframe.tsx` unless Phase 01 proves Access cookie block.
2. Restore `rewriteInlineImages()` to upstream inline-only behavior unless Phase 01 proves `disposition` is wrong from parser.
3. If parser stores image `disposition=attachment` while body has matching `cid`, fix ingestion metadata in `workers/index.ts`, not frontend overbroad rewrite.
4. If iframe image request is 403 due Access cookies, choose one:
   - backend signed attachment URL, or
   - parent fetch blob URL adapter, or
   - narrowly documented `allow-same-origin`.
5. Add regression test in `tests/upstream-contract.test.ts`.

## Todo list

- [ ] Restore/reconcile `EmailIframe.tsx`.
- [ ] Restore/reconcile `rewriteInlineImages()`.
- [ ] Add CID regression test.
- [ ] Add attachment endpoint ownership regression if needed.

## Success Criteria

- Failing email image renders.
- Attachment card still works.
- `npm test`, `typecheck`, `build` pass.

## Risk Assessment

- Reverting dirty files may reintroduce image bug if Access cookies are root cause.
- Keeping dirty files may weaken iframe isolation.

## Security Considerations

- Prefer signed/blob adapter over relaxing iframe sandbox.
- Keep DOMPurify and CSP.

## Next steps

- Move to Phase 03 after inbound image is solved.

