# Implementation Checkpoint

## Completed
- Added Access JWT email extraction and exact mailbox ownership enforcement.
- Filtered mailbox config/list/create paths by signed-in Access email.
- Disabled AI/MCP HTTP routes and removed agent sidebar entry point from V1 UI.
- Added image upload, paste, and drop support in the split-view composer.
- Added JPEG/PNG/WebP allowlist with `10MB` per-image and `25MB` total limits.
- Added attachment URL ownership verification before private R2 retrieval.
- Scoped `vite-tsconfig-paths` to this project.
- Added separate `wrangler.local.jsonc` for local email simulation without AI remote proxy.
- Hid deferred forward, mailbox-delete, and AI-settings surfaces behind V1 feature gates.
- Limited inbound stored attachments to allowed images while preserving the received email.
- Redirected a signed-in user directly into their single provisioned mailbox.
- Updated visible product title and Cloudflare resource names to `ONYX` / `onyx-email`.

## Verification
- `npm test`: `14/14` pass.
- `npm run typecheck`: pass.
- `npm run build`: pass.
- Local API smoke: `GET /api/v1/config` returns `200`.
- Cloudflare R2 bucket created: `onyx-email`.
- Cloudflare Worker deployed: `https://onyx-email.ceo-23f.workers.dev`.
- Deployed Worker version: `8ac6ebba-1888-479f-af93-103865613ba2`.
- Live browser UI renders inbox, compose image controls, Sent message, and image attachment card.
- Live private attachment download returns `200 image/png`.
- Custom domain deployed: `https://box.onyx.com.vn`.
- Social-style team feed UI deployed.
- Internal allowlist configured for `marketing@onyx.com.vn`, `sale@onyx.com.vn`, and `admin@onyx.com.vn`.
- Controlled dependency upgrades completed; `npm audit` reports `0 vulnerabilities`.

## Blockers Before Deploy
- Need allowed mailbox address on `onyx.com.vn`.
- Need Cloudflare Access self-hosted app for the Worker hostname, then `TEAM_DOMAIN` and `POLICY_AUD`.
- Need Email Routing rule for `onyx.com.vn` pointing the chosen address to Worker `onyx-email`.
- Cloudflare Vite SSR local runner fails with `bad allocation` while loading the Kumo bundle; use deployed preview for browser verification.
- Codex in-app browser blocks localhost with `net::ERR_BLOCKED_BY_CLIENT`.

## Demo Security Debt
- `DEMO_MODE=true` temporarily bypasses Cloudflare Access and exposes the single configured mailbox publicly.
- Rotate the leaked Cloudflare credential.
- Before non-demo use: create Access OTP app, set `TEAM_DOMAIN` and `POLICY_AUD`, then remove `DEMO_MODE`.
- Before inbound mail verification: create the `marketing@onyx.com.vn` Email Routing rule pointing to Worker `onyx-email`.

## Follow-up
- Run visual compose-image verification on deployed preview.
- Decide controlled upgrades for dependencies reported by `npm audit`.
