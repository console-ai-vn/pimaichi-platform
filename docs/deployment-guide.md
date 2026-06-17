# ONYX � Deployment Guide

End-to-end walkthrough for deploying ONYX to Cloudflare. Covers local dev, R2, Email Routing, Email Service, Cloudflare Access, secrets (including SePay, Stream, Images), and the actual `wrangler deploy`.

> **Audience:** solo dev / small team. No CI yet � these steps are manual.

---

## 1. Prerequisites

| Tool | Version | Check |
|---|---|---|
| Node.js | = 20.x | `node --version` |
| npm | = 10.x | `npm --version` |
| pnpm | 11.5.0 | `pnpm --version` |
| wrangler | ^4.96.0 (devDep) | `npx wrangler --version` |
| Cloudflare account | with Email Routing enabled for `onyx.com.vn` | dashboard |

```bash
npx wrangler login   # OAuth flow, one-time per machine
```

---

## 2. First-time setup

```bash
git clone <repo>
cd "Email Web"
pnpm install
```

### 2.1 Local R2 bucket

Required for `wrangler.local.jsonc` to bind `BUCKET` correctly.

```bash
wrangler r2 bucket create onyx-email-local
```

If you skip this, `pnpm dev` will fail with `BUCKET: undefined`.

### 2.2 Local secrets (`.dev.vars`)

Copy the example and fill in:

```bash
cp .dev.vars.example .dev.vars
```

Minimum required for local dev (Access bypassed via `x-dev-user-email` header):

```ini
# .dev.vars (gitignored)
POLICY_AUD=local-placeholder
TEAM_DOMAIN=local.cloudflareaccess.com
```

> `import.meta.env.DEV` skips JWT validation entirely in local. The values above are never sent anywhere. Don't set `DEMO_MODE` for normal local dev.

### 2.3 Run

```bash
pnpm dev      # http://localhost:5173, vite + RR + wrangler bindings
```

To impersonate a mailbox in the browser dev tools:

```http
x-dev-user-email: admin@onyx.com.vn
```

---

## 3. Production deploy

### 3.1 Production R2 bucket

```bash
wrangler r2 bucket create onyx-email
```

### 3.2 Custom domains

Two custom domains in `wrangler.jsonc` `routes`:

| Hostname | Purpose | Access? |
|---|---|---|
| `box.onyx.com.vn` | The app (mailbox UI, API, MCP) | Yes (CF Access) |
| `start.onyx.com.vn` | Public landing + signup form (`/`, `/signup`) | No (`PUBLIC_HOSTNAMES`) |

DNS is managed by Cloudflare once the zone is added; just attach the custom domains from the Worker settings (or keep the `routes` block in `wrangler.jsonc`).

### 3.3 Email Routing

In the Cloudflare dashboard:

1. **Email Routing ? Routes** for `onyx.com.vn`.
2. Create a **catch-all** rule ? action: **Send to Worker** ? select `onyx-email`.

Without this, inbound mail is dropped at the edge.

### 3.4 Email Service (send_email binding)

**This is the step most likely to be missed.** Production outbound mail requires the `EMAIL` binding.

? **As of this writing, the `send_email` block is in `wrangler.local.jsonc` but NOT in `wrangler.jsonc`.** Production deploys will not be able to send external email until you add it:

```jsonc
// wrangler.jsonc � add this block
"send_email": [
	{
		"name": "EMAIL",
		"remote": true
	}
]
```

Then in the dashboard:

1. **Email ? Email Service ? Enable** for the `onyx.com.vn` zone.
2. Grant the `send_email` permission to the `onyx-email` Worker.

If you skip this, the worker binds `EMAIL` to `undefined` and every outbound send returns 502.

> **Note:** the app is **internal-only** by design (`getRecipientRouting` blocks external recipients at the API). The `EMAIL` binding is only used if you flip `ALLOW_FORWARDING` and forward to external mailboxes.

### 3.5 Cloudflare Access

1. **Workers ? `onyx-email` ? Settings ? Domains & Routes ? Add** (or use **one-click Access**).
2. Cloudflare shows a modal with `POLICY_AUD` and `TEAM_DOMAIN`. **Copy both.**
3. Set as Worker secrets:

```bash
wrangler secret put POLICY_AUD
# paste the value from the modal

wrangler secret put TEAM_DOMAIN
# paste the value from the modal
```

**The secrets are read at runtime** via `c.env.POLICY_AUD` and `c.env.TEAM_DOMAIN`. The `vars` values in `wrangler.jsonc` are kept only for local convenience (see tech debt in [`project-roadmap.md`](./project-roadmap.md) � 3.1).

### 3.6 Email addresses

In `wrangler.jsonc` `vars` (or `wrangler secret put` if you prefer):

```jsonc
"vars": {
  "DOMAINS": "onyx.com.vn",
  "EMAIL_ADDRESSES": ["admin@onyx.com.vn", "test@onyx.com.vn"],
  "ACCESS_EMAIL_ADDRESSES": ["ceo@bdsmetro.com"]
}
```

| Var | Meaning |
|---|---|
| `DOMAINS` | Comma-separated list of Email Routing domains. |
| `EMAIL_ADDRESSES` | Allowed mailbox addresses. Filtering for inbound + creation gate. |
| `ACCESS_EMAIL_ADDRESSES` | Privileged users that can open every mailbox in `EMAIL_ADDRESSES`. |
| `DEMO_MODE` | **Never set in production.** `"true"` bypasses Access and uses first `EMAIL_ADDRESSES` entry. |

### 3.7 Deploy

```bash
pnpm deploy   # react-router build && wrangler deploy
```

Output: `Published onyx-email (X.XXs)` + URL.

### 3.8 SePay (Payment Provider)

Required for the payment subscription system (Phase 02).

1. Register at [SePay](https://sepay.vn) and get your API key.
2. Set the secrets:

```bash
wrangler secret put SEPAY_API_KEY
# paste your SePay API key

wrangler secret put SEPAY_WEBHOOK_SECRET
# paste a strong random secret (used for HMAC webhook verification)
```

3. In SePay dashboard, configure the webhook URL:
   `https://box.onyx.com.vn/api/v1/payments/webhook/sepay`
   with the same webhook secret.

### 3.9 Cloudflare Stream (Video Pipeline)

Required for the media pipeline — video uploads (Phase 05).

1. In Cloudflare dashboard ? **Stream**, enable the service.
2. Generate an API token with **Stream ? Edit** permission.
3. Create a signing key for signed tokens:

```bash
# Generate a random base64 key (32 bytes minimum)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

4. Set the secrets:

```bash
wrangler secret put CF_STREAM_TOKEN
# paste your Stream API token

wrangler secret put CF_STREAM_SIGNING_KEY
# paste the base64 signing key from step 3
```

### 3.10 Cloudflare Images (Image Pipeline)

Required for the media pipeline — image uploads with variant URLs (Phase 05).

1. In Cloudflare dashboard ? **Images**, enable the service.
2. Generate an API token with **Images ? Edit** permission.
3. Find your account hash under **Images ? Developer Resources**.
4. Set the secrets:

```bash
wrangler secret put CF_IMAGES_TOKEN
# paste your Images API token

wrangler secret put CF_IMAGES_ACCOUNT_HASH
# paste your account hash (e.g., "abc123...")
```

> If Stream or Images tokens are not configured, the media endpoints return `501 Not Implemented`. R2 fallback upload (`/api/v1/media/upload/r2`) still works.

### 3.11 JWT Token Secrets (Phase 07)

Required for JWT refresh/access token rotation (`/api/v1/auth/refresh`, `/api/v1/auth/access-token`).

```bash
# Generate two random 32-byte base64 secrets
openssl rand -base64 32
openssl rand -base64 32

wrangler secret put REFRESH_SECRET
# paste the first generated secret (used for 30d refresh tokens)

wrangler secret put ACCESS_SECRET
# paste the second generated secret (used for 12h access tokens)
```

> These are HS256 symmetric keys. Rotating either invalidates all existing tokens. Use different values for each.

### 3.12 Cloudflare Turnstile (Phase 07)

1. In Cloudflare dashboard ? **Turnstile**, create a new widget.
2. Copy the **Site Key** (public) and **Secret Key** (private).
3. Set `TURNSTILE_SITE_KEY` in `wrangler.jsonc` `vars`:
   ```jsonc
   "TURNSTILE_SITE_KEY": "1x00000000000000000000AA"
   ```
4. Set the secret:
   ```bash
   wrangler secret put TURNSTILE_SECRET_KEY
   # paste your Turnstile secret key
   ```

> The frontend Turnstile widget component is a stub; server-side verification endpoint is ready.

### 3.13 Smoke test

1. Visit `https://box.onyx.com.vn` ? Cloudflare Access login ? land on `/app`.
2. The mailbox `admin@onyx.com.vn` should auto-create (it's in `EMAIL_ADDRESSES`).
3. Send a test email from `admin@onyx.com.vn` to a Gmail address ? check it lands (or hits the "internal-only" 403 if Gmail is not in `EMAIL_ADDRESSES`).
4. Send an email **to** `admin@onyx.com.vn` from Gmail ? it should appear in Inbox within a few seconds.
5. Visit `https://start.onyx.com.vn` ? landing page, no Access prompt.
6. Test payment checkout: trigger a subscription and verify SePay webhook delivery.
7. Test media upload: verify Stream/Images direct upload URLs work; verify signed tokens.
8. Test inventory: `GET /api/v1/inventory/catalog` should return empty `{ items: [] }` on fresh deploy.
9. Test live: `GET /api/v1/live/schedule` should return `{ events: [] }` on fresh deploy.
10. Test JWT auth: `POST /api/v1/auth/refresh` with a valid refresh token should return `{ accessToken, refreshToken }`.
11. Verify security headers: `curl -I https://box.onyx.com.vn/api/v1/mailboxes` should include `strict-transport-security`, `x-frame-options`, `x-content-type-options`, `content-security-policy`.

---

## 4. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Invalid or expired Access token` | `POLICY_AUD` or `TEAM_DOMAIN` wrong | Disable Access, re-enable, copy new values, re-run `wrangler secret put` |
| `Cloudflare Access must be configured in production` | Secrets missing | See � 3.5 |
| `BUCKET: undefined` in dev | R2 bucket not created | `wrangler r2 bucket create onyx-email-local` |
| `EMAIL is not a function` / send returns 502 | `send_email` binding missing from `wrangler.jsonc` | See � 3.4 |
| Mailbox not auto-created on first visit | Mailbox email not in `EMAIL_ADDRESSES` | Add to `vars` and redeploy |
| Inbound email silently dropped | No Email Routing rule | Add catch-all rule pointing to Worker (� 3.3) |
| `window.confirm` in dev tools | Outdated code | Refactor ... see linked roadmap V3-10 |
| `Refresh secret not configured` | `REFRESH_SECRET` missing | See section 3.11 |
| `Invalid or expired refresh token` | Secret rotated or token expired | Re-authenticate to get new tokens |
| Stream Live Input not created | `CF_STREAM_TOKEN` or `CF_ACCOUNT_ID` missing | See section 3.9 and verify vars |
| Rate limit 429 on signup/checkout | Too many requests from same IP | Wait for window reset; adjust limiter config |
| No CSP/Security headers on API | Middleware not applied | Verify `app.use("*")` in `workers/app.ts:150-155` |

---

## 5. Local vs production summary

| Setting | Local (`wrangler.local.jsonc`) | Production (`wrangler.jsonc`) |
|---|---|---|
| Worker name | `onyx-email-local` | `onyx-email` |
| R2 bucket | `onyx-email-local` | `onyx-email` |
| `EMAIL` binding | `remote: false` (mailpit-style) | `remote: true` (Email Service) |
| Auth | `import.meta.env.DEV` ? trust `x-dev-user-email` header | CF Access JWT (fail-closed) |
| Custom domains | none | `box.onyx.com.vn`, `start.onyx.com.vn` |
| DO migrations | `v1`-`v7` (new_sqlite_classes) | `v1`-`v7` (same) |

---

## 6. Rollback

```bash
wrangler rollback onyx-email           # interactive
wrangler rollback onyx-email --version-id <id>   # non-interactive
```

DO SQLite migrations are forward-only. Adding a column is safe. Removing a column requires a multi-deploy dance. **Never** edit a past migration's SQL.
