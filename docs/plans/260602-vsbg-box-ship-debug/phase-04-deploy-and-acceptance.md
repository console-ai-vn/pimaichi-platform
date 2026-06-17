# Phase 04 Deploy And Acceptance

## Context links

- Parent plan: [plan.md](./plan.md)
- Depends on: Phase 01, Phase 02, Phase 03.

## Overview

- Date: 2026-06-02
- Description: Final deploy, browser acceptance, and commit hygiene.
- Priority: P1
- Implementation status: pending
- Review status: pending

## Key Insights

- MVP ship depends on real browser checks, not only unit tests.
- Access and Email Routing are live Cloudflare surfaces.

## Requirements

- No dirty app code except intentional commits.
- No secret/key/PDF committed.
- Live `box.onyx.com.vn` passes manual flow.

## Architecture

- Use CI-like local gates plus live browser flow.
- Commit in small focused commits.

## Related code files

- `package.json`
- `wrangler.jsonc`
- `.gitignore`
- `tests/*`
- affected app/workers files from earlier phases.

## Implementation Steps

1. Run local gates:
   ```powershell
   npm.cmd test
   npm.cmd run typecheck
   npm.cmd run build
   npm.cmd audit --audit-level=moderate
   git diff --check
   ```
2. Deploy:
   ```powershell
   npm.cmd run deploy
   ```
3. Verify Cloudflare:
   ```powershell
   npx.cmd wrangler email routing rules list onyx.com.vn
   Invoke-WebRequest https://box.onyx.com.vn/.well-known/cloudflare-access-protected-resource/
   ```
4. Browser acceptance:
   - login with `ceo@bdsmetro.com`
   - inbound text mail to `admin@onyx.com.vn`
   - inbound image mail to `admin@onyx.com.vn`
   - outbound disabled or delivered
5. Commit:
   ```powershell
   git add <intentional files>
   git -c commit.gpgsign=false commit -m "fix: Stabilize ONYX mail MVP"
   ```

## Todo list

- [ ] Run all local gates.
- [ ] Deploy.
- [ ] Browser acceptance.
- [ ] Commit intentional files.
- [ ] Leave `Metro Mail.pdf` untracked.

## Success Criteria

- MVP flow passes.
- User can explain product state in one sentence.
- Remaining risks documented in report.

## Risk Assessment

- Browser cache may show old bundle; hard refresh needed.
- Access session may mask policy mistakes; incognito test needed.

## Security Considerations

- Confirm `.gitignore` covers temp files and keys.
- Rotate previously pasted Global API Key after acceptance.

## Next steps

- After MVP ship, create P1 plan for multi-mailbox/member roles and outbound provider.
