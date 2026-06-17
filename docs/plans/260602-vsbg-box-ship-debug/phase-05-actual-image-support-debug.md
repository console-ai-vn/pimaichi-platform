# Phase 05 Actual Image Support Debug

## Context links

- Parent plan: [plan.md](./plan.md)
- Evidence: [02-image-debug-evidence.md](./reports/02-image-debug-evidence.md)
- CID helper: `shared/cid-images.ts`
- Inbound parser: `workers/index.ts`
- Attachment storage: `workers/lib/attachments.ts`

## Overview

- Date: 2026-06-02
- Description: Debug why real images are still not visible and define the actual ship path.
- Priority: P0
- Implementation status: pending
- Review status: pending

## Key Insights

- Current failing sample has `cid:` refs but `attachments: []`.
- Any external/private `data-src` URL is out of V1 scope unless the image bytes arrive as MIME attachment data.
- No renderer can display an image that was not delivered as MIME bytes.
- Need prove whether normal Gmail/Apple MIME images work.

## Requirements

- Do not guess based on one sample.
- Preserve Access protection.
- Do not expose raw email debug route in production.
- Do not touch unrelated dirty files: `README.md`, scout/docs, `Metro Mail.pdf`.

## Architecture

Two paths:

- MIME image path: email contains image parts -> store in R2 -> rewrite CID -> render actual image.
- Private external URL path: email contains only `cid` plus a private remote URL -> out of V1 scope unless we intentionally add a provider connector later.

## Related code files

- `workers/index.ts`
- `workers/lib/attachments.ts`
- `workers/durableObject/index.ts`
- `app/lib/utils.ts`
- `shared/cid-images.ts`
- `tests/cid-images.test.ts`
- `tests/attachments.test.ts`

## Implementation Steps

1. Add safe inbound diagnostics that logs attachment count, mimetype, contentId, disposition, and skipped reason. No raw body.
2. Deploy diagnostics only long enough to test.
3. Send 3 control emails to `admin@onyx.com.vn`:
   - Gmail inline image pasted into body.
   - Gmail image as file attachment.
   - Apple/iCloud image attachment if available.
4. Inspect logs/API:
   - `parsedEmail.attachments.length`
   - `contentId`
   - `disposition`
   - stored R2 key exists
   - final email `attachments[]`
5. Decision:
   - If MIME images store but render fails: fix frontend/attachment route.
   - If MIME images do not store: fix `PostalMime` ingest/filter.
   - If only private external URL samples fail: mark as out of V1 scope, not renderer bug.
6. Remove diagnostics after evidence.

## Todo list

- [ ] Add safe inbound diagnostics.
- [ ] Run tests/typecheck/build.
- [ ] Deploy diagnostics.
- [ ] Test Gmail inline image.
- [ ] Test Gmail attachment image.
- [ ] Decide root cause branch.
- [ ] Implement one fix only.
- [ ] Remove diagnostics.
- [ ] Deploy final.

## Success Criteria

- Normal email images with actual MIME bytes render in ONYX.
- Private external images show a clear missing-payload state.
- No raw debug endpoint remains live.
- Tests/typecheck/build pass.

## Risk Assessment

- Provider API paths may require OAuth/session scope and are not V1 fixes.
- Logging must avoid raw email body and PII beyond metadata.
- Broadening allowed inbound image types can create security risk; keep JPEG/PNG/WebP unless product requires more.

## Security Considerations

- Keep image bytes private in R2.
- Keep attachment access bound to mailbox/email id.
- Do not proxy private external URLs without auth and rate limits.
- Remove all temporary diagnostics after test.

## Next steps

Start with diagnostics and control emails. Do not change renderer again until MIME path evidence is collected.
