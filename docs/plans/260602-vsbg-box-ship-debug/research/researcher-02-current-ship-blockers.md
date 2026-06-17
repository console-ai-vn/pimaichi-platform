# ONYX ship blockers + Cloudflare config

## Findings
- `git status --short` shows dirty working tree:
  - `M app/components/EmailIframe.tsx`
  - `M app/lib/utils.ts`
  - `?? Metro Mail.pdf`
  - `?? docs/superpowers/`
- `wrangler.jsonc` current config:
  - worker name: `onyx-email`
  - route/custom domain: `box.onyx.com.vn`
  - `compatibility_date`: `2025-11-28`
  - `compatibility_flags`: `nodejs_compat`
  - bindings: `EMAIL` send_email, `BUCKET` R2, `AI`, `MAILBOX`, `EMAIL_AGENT`, `EMAIL_MCP`
  - vars:
    - `DOMAINS=onyx.com.vn`
    - `EMAIL_ADDRESSES=["admin@onyx.com.vn"]`
    - `ACCESS_EMAIL_ADDRESSES=["ceo@bdsmetro.com"]`
    - `POLICY_AUD=155dc63d8967ec822618e99d56f62ead2154bde1eceb5f6bd1dbd9857b46e5af`
    - `TEAM_DOMAIN=steep-bush-3ccd.cloudflareaccess.com`
- CLI live config:
  - `wrangler 4.95.0`
  - logged in via OAuth as `ceo@bdsmetro.com`
  - account id: `a23f698a1f594da1a6fb657c5bea74a8`
  - token has Workers / Routes / Email Routing / Email Sending / AI scopes

## Exact blockers
- `app/components/EmailIframe.tsx`
  - sandbox changed to `allow-same-origin allow-scripts ...`
  - CSP changed to allow `img-src 'self' data: blob: cid: https:`
  - this is a security-sensitive behavior change and must be verified before ship because it relaxes iframe isolation to support Access-authenticated attachment loads.
- `app/lib/utils.ts`
  - `rewriteInlineImages()` now rewrites any attachment with `content_id`, not only `disposition === "inline"`
  - likely regression: CID-bearing non-inline attachments can get rewritten unexpectedly, changing rendering/download behavior.
- `workers/app.ts`
  - prod path hard-fails if `POLICY_AUD` or `TEAM_DOMAIN` missing
  - if live Cloudflare Access app does not match the hardcoded issuer/audience exactly, prod requests fail with `500` or `403`.

## Likely root causes
- Frontend iframe isolation was loosened to make attachment images load through Cloudflare Access cookies, but the security model changed at the same time as rendering behavior.
- CID rewrite logic conflates `content_id` with inline-only attachments.
- Cloudflare Access config is tightly coupled to `TEAM_DOMAIN` + `POLICY_AUD`; any drift between repo config and live Access app blocks production traffic.

## Verification commands
- `npm test`
- `npm run typecheck`
- `npm run build`
- `git diff -- app/components/EmailIframe.tsx app/lib/utils.ts`
- `wrangler deploy --dry-run`
- `wrangler whoami`

## Unresolved questions
- Is `box.onyx.com.vn` the only intended public hostname, or should `DOMAINS` include more domains?
- Does the live Access app still use issuer `https://steep-bush-3ccd.cloudflareaccess.com` and audience `155dc63d8967ec822618e99d56f62ead2154bde1eceb5f6bd1dbd9857b46e5af` exactly?
- Should CID rewriting stay limited to inline attachments only, or is the broader rewrite intentional?
