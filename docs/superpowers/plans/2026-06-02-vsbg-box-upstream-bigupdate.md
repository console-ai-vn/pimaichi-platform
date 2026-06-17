# ONYX Upstream Big-Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a stable MVP by preserving Cloudflare Agentic Inbox upstream behavior for mail/attachments/send, then layering only ONYX-specific Access, routing, branding, and admin mailbox permissions.

**Architecture:** Treat `cloudflare/agentic-inbox` as the source-of-truth core. Revert ad-hoc patches where upstream already has working behavior, add a thin ONYX overlay module for authentication/authorization, and gate risky outbound mail behind explicit Cloudflare Email Sending readiness checks.

**Tech Stack:** React Router, Hono Worker, Cloudflare Access, Email Routing, Send Email binding, Durable Objects SQLite, R2, Wrangler, Node test runner.

---

## MVP Goal

MVP is not "all email features". MVP is:

- Login via Cloudflare Access OTP using `ceo@bdsmetro.com`.
- One shared mailbox: `admin@onyx.com.vn`.
- Inbound mail to `admin@onyx.com.vn` appears in Team Feed.
- Inline/attached images from inbound mail render using upstream-compatible behavior.
- Outbound compose/reply either sends successfully through a verified provider or visibly reports "outbound not configured"; no fake sent state.
- Repo has clean commits, passing tests/typecheck/build, and no leaked key committed.

## Current Evidence

- Upstream remote: `https://github.com/cloudflare/agentic-inbox.git`.
- Current branch: `metro-mail-v1`.
- Current commits above upstream:
  - `5ea9541 feat: Ship ONYX MVP`
  - `93c7066 feat: Configure admin mailbox routing`
  - `c43d393 fix: Verify Access team domain URL`
  - `ec396af fix: Render inline images and report send failures`
- Dirty working tree at plan time:
  - `app/components/EmailIframe.tsx`
  - `app/lib/utils.ts`
  - untracked `Metro Mail.pdf`
- Upstream already contains:
  - `rewriteInlineImages()` in `app/lib/utils.ts`
  - sandboxed `EmailIframe`
  - inbound attachment storage in `workers/index.ts`
  - Send Email binding wrapper in `workers/email-sender.ts`

## File Structure

- Preserve upstream core:
  - `app/components/EmailIframe.tsx`
  - `app/lib/utils.ts`
  - `workers/index.ts`
  - `workers/routes/reply-forward.ts`
  - `workers/email-sender.ts`
  - `workers/lib/attachments.ts`
- Keep ONYX overlay:
  - `workers/app.ts`: Cloudflare Access JWT extraction/validation.
  - `workers/lib/access.ts`: member-to-mailbox authorization only.
  - `workers/lib/mailbox.ts`: mailbox guard using `ACCESS_EMAIL_ADDRESSES`.
  - `wrangler.jsonc`: `admin@onyx.com.vn`, `ceo@bdsmetro.com`, custom domain.
  - `app/routes/email-list.tsx`, `app/components/Sidebar.tsx`: social feed UI.
- Add support files:
  - `tests/access.test.ts`
  - `tests/attachments.test.ts`
  - `tests/upstream-contract.test.ts`
  - `docs/superpowers/plans/2026-06-02-onyx-email-upstream-bigupdate.md`

---

### Task 1: Freeze Current State And Remove Dirty Ambiguity

**Files:**
- Inspect: `app/components/EmailIframe.tsx`
- Inspect: `app/lib/utils.ts`
- Do not touch: `Metro Mail.pdf`

- [ ] **Step 1: Inspect dirty diff**

Run:

```powershell
git diff -- app/components/EmailIframe.tsx app/lib/utils.ts
git status --short
```

Expected:

```txt
M app/components/EmailIframe.tsx
M app/lib/utils.ts
?? "Metro Mail.pdf"
```

- [ ] **Step 2: Decide keep/revert dirty iframe changes**

Use upstream as baseline:

```powershell
git diff upstream/main -- app/components/EmailIframe.tsx app/lib/utils.ts
```

Decision rule:

```txt
If change only compensates for Cloudflare Access cookie behavior, move it into a tested attachment-rendering adapter.
If change weakens iframe sandbox without proving image render, revert it.
```

- [ ] **Step 3: Commit or reset only owned dirty files**

If keeping:

```powershell
git add app/components/EmailIframe.tsx app/lib/utils.ts
git -c commit.gpgsign=false commit -m "fix: Resolve Access-protected inline images"
```

If reverting:

```powershell
git restore app/components/EmailIframe.tsx app/lib/utils.ts
```

Expected:

```txt
git status --short
?? "Metro Mail.pdf"
```

---

### Task 2: Define Upstream Contract Tests

**Files:**
- Create: `tests/upstream-contract.test.ts`
- Modify only if needed: `app/lib/utils.ts`

- [ ] **Step 1: Write tests for upstream inline image contract**

Create `tests/upstream-contract.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { rewriteInlineImages } from "../app/lib/utils.ts";

test("rewriteInlineImages maps cid references to attachment API URLs", () => {
	const html = '<p>Hello</p><img src="cid:image001@abc">';
	const result = rewriteInlineImages(html, "admin@onyx.com.vn", "email-1", [
		{
			id: "att-1",
			content_id: "image001@abc",
			disposition: "inline",
		},
	]);

	assert.match(
		result,
		/src="\/api\/v1\/mailboxes\/admin@onyx.com.vn\/emails\/email-1\/attachments\/att-1"/,
	);
});

test("rewriteInlineImages handles angle bracket content ids", () => {
	const html = '<img src="cid:image002@abc">';
	const result = rewriteInlineImages(html, "admin@onyx.com.vn", "email-2", [
		{
			id: "att-2",
			content_id: "<image002@abc>",
			disposition: "inline",
		},
	]);

	assert.match(result, /attachments\/att-2/);
});

test("rewriteInlineImages does not rewrite normal attachments", () => {
	const html = '<img src="cid:file@abc">';
	const result = rewriteInlineImages(html, "admin@onyx.com.vn", "email-3", [
		{
			id: "att-3",
			content_id: "file@abc",
			disposition: "attachment",
		},
	]);

	assert.equal(result, html);
});
```

- [ ] **Step 2: Run contract test**

Run:

```powershell
npm.cmd test
```

Expected:

```txt
tests 20
pass 20
```

If it fails, preserve upstream behavior unless the real email metadata proves upstream condition is too strict.

---

### Task 3: Add Temporary Admin Debug Endpoint For One Email

**Files:**
- Modify: `workers/index.ts`
- Test: `tests/access.test.ts` if authorization helper changes

- [ ] **Step 1: Add debug route behind existing Access + mailbox guard**

Add this route near email detail routes:

```ts
app.get("/api/v1/mailboxes/:mailboxId/emails/:id/debug", async (c: AppContext) => {
	const email = await c.var.mailboxStub.getEmail(c.req.param("id")!);
	if (!email) return c.json({ error: "Email not found" }, 404);
	return c.json({
		id: email.id,
		subject: email.subject,
		body: email.body,
		attachments: email.attachments?.map((attachment: any) => ({
			id: attachment.id,
			filename: attachment.filename,
			mimetype: attachment.mimetype,
			content_id: attachment.content_id,
			disposition: attachment.disposition,
			size: attachment.size,
		})) ?? [],
	});
});
```

- [ ] **Step 2: Deploy debug route only after tests pass**

Run:

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run deploy
```

Expected:

```txt
pass 20
typecheck exit 0
build exit 0
Current Version ID: <new-id>
```

- [ ] **Step 3: Use browser to inspect failed image email**

Open:

```txt
https://box.onyx.com.vn/api/v1/mailboxes/admin@onyx.com.vn/emails/<email-id>/debug
```

Expected data needed:

```json
{
  "body": "...cid:...",
  "attachments": [
    {
      "id": "...",
      "content_id": "...",
      "disposition": "inline"
    }
  ]
}
```

If body `cid:` and attachment `content_id` do not match, fix mapping. If they match but image request is 403, fix Access/cookie rendering.

---

### Task 4: Restore Upstream Attachment Rendering First

**Files:**
- Modify: `app/lib/utils.ts`
- Modify: `app/components/EmailIframe.tsx`

- [ ] **Step 1: Revert `EmailIframe` to upstream unless debug proves Access cookie issue**

Baseline:

```powershell
git show upstream/main:app/components/EmailIframe.tsx
```

Expected iframe sandbox:

```tsx
sandbox="allow-scripts allow-popups allow-top-navigation-by-user-activation"
```

Expected CSP:

```html
img-src data: cid: https:
```

- [ ] **Step 2: Keep `rewriteInlineImages` upstream-compatible**

Preferred implementation:

```ts
export function rewriteInlineImages(
	body: string,
	mailboxId: string,
	emailId: string,
	attachments?: { id: string; content_id?: string | null; disposition?: string | null }[],
): string {
	if (!body || !attachments?.length) return body;
	let result = body;
	for (const att of attachments) {
		if (att.disposition === "inline" && att.content_id) {
			const url = `/api/v1/mailboxes/${mailboxId}/emails/${emailId}/attachments/${att.id}`;
			const cid = att.content_id.startsWith("<")
				? att.content_id.slice(1, -1)
				: att.content_id;
			result = result.replace(
				new RegExp(`cid:${cid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "gi"),
				url,
			);
		}
	}
	return result;
}
```

- [ ] **Step 3: Only if Access blocks iframe images, add adapter with tests**

Add a new function instead of changing upstream helper:

```ts
export function shouldUseSameOriginEmailIframe() {
	return Boolean(
		typeof window !== "undefined" &&
		window.location.hostname === "box.onyx.com.vn",
	);
}
```

Then gate `allow-same-origin` only for ONYX Access deployment.

---

### Task 5: Separate Inbound MVP From Outbound Provider

**Files:**
- Modify: `workers/index.ts`
- Modify: `workers/routes/reply-forward.ts`
- Modify: `workers/email-sender.ts`
- Modify: `app/hooks/useComposeForm.ts`

- [ ] **Step 1: Keep upstream async send behavior only if Email Sending works**

Current evidence:

```txt
wrangler email sending settings onyx.com.vn -> 404 Not Found
wrangler email sending enable onyx.com.vn -> 404 Not Found
```

MVP rule:

```txt
Do not call outbound "done" until one provider is verified.
```

- [ ] **Step 2: Add outbound readiness flag**

In `wrangler.jsonc` vars:

```json
"OUTBOUND_EMAIL_PROVIDER": "disabled"
```

In `workers/types.ts`:

```ts
OUTBOUND_EMAIL_PROVIDER?: string;
```

In send routes, before writing Sent:

```ts
if (c.env.OUTBOUND_EMAIL_PROVIDER !== "cloudflare") {
	return c.json({ error: "Outbound email is not configured" }, 503);
}
```

This prevents fake Sent rows.

- [ ] **Step 3: Pick one outbound provider**

Decision:

```txt
Option A: Cloudflare Email Sending if product endpoint becomes available.
Option B: Lark SMTP/API if ONYX wants normal mailbox sending.
Option C: Resend for fastest transactional outbound from admin@onyx.com.vn.
```

MVP recommendation:

```txt
Use Resend or Lark SMTP for outbound. Keep Cloudflare Email Routing for inbound.
```

---

### Task 6: Preserve ONYX Access Overlay

**Files:**
- Keep: `workers/app.ts`
- Keep: `workers/lib/access.ts`
- Keep: `workers/lib/mailbox.ts`
- Keep: `tests/access.test.ts`
- Keep: `wrangler.jsonc`

- [ ] **Step 1: Keep Access perimeter**

Required env:

```json
"EMAIL_ADDRESSES": ["admin@onyx.com.vn"],
"ACCESS_EMAIL_ADDRESSES": ["ceo@bdsmetro.com"],
"POLICY_AUD": "155dc63d8967ec822618e99d56f62ead2154bde1eceb5f6bd1dbd9857b46e5af",
"TEAM_DOMAIN": "steep-bush-3ccd.cloudflareaccess.com"
```

- [ ] **Step 2: Keep team domain URL fix**

Required code:

```ts
const teamUrl = new URL(
	teamDomain.startsWith("http://") || teamDomain.startsWith("https://")
		? teamDomain
		: `https://${teamDomain}`,
);
```

- [ ] **Step 3: Keep tests**

Run:

```powershell
npm.cmd test
```

Expected:

```txt
assertMailboxAccess allows configured members into shared mailboxes
filterMailboxIdsForAccess exposes shared mailboxes to configured members
```

---

### Task 7: Verify Cloudflare Configuration

**Files:**
- No code changes.

- [ ] **Step 1: Verify Email Routing**

Run:

```powershell
npx.cmd wrangler email routing settings onyx.com.vn
npx.cmd wrangler email routing rules list onyx.com.vn
```

Expected:

```txt
Enabled: true
Status: ready
Matchers: to:admin@onyx.com.vn
Actions: worker:onyx-email
Catch-all rule: disabled, action: drop
```

- [ ] **Step 2: Verify Access app**

Use Cloudflare API with Global API Key or dashboard:

```txt
App: onyx-email
Domain: box.onyx.com.vn
Policy include: ceo@bdsmetro.com
Identity provider: One-time PIN
Managed OAuth: off
```

- [ ] **Step 3: Verify R2 mailbox exists**

Run:

```powershell
npx.cmd wrangler r2 object get onyx-email/mailboxes/admin@onyx.com.vn.json --file - --remote
```

Expected:

```json
{"fromName":"Admin","forwarding":{"enabled":false,"email":""}}
```

---

### Task 8: Browser Acceptance Test

**Files:**
- No planned code changes.

- [ ] **Step 1: Login**

Open:

```txt
https://box.onyx.com.vn
```

Expected:

```txt
Cloudflare Access OTP -> ceo@bdsmetro.com -> app loads mailbox admin@onyx.com.vn
```

- [ ] **Step 2: Inbound text**

Send external email:

```txt
To: admin@onyx.com.vn
Subject: MVP inbound text
Body: Xin ch?o
```

Expected:

```txt
Feed receives new item.
Body renders.
```

- [ ] **Step 3: Inbound inline image**

Send external email:

```txt
To: admin@onyx.com.vn
Subject: MVP inbound image
Body: one inline image
```

Expected:

```txt
Image renders inline OR attachment card renders usable image.
No broken image icon remains.
```

- [ ] **Step 4: Outbound**

If provider disabled:

```txt
Compose/reply shows "Outbound email is not configured".
No fake Sent row.
```

If provider enabled:

```txt
External inbox receives reply from admin@onyx.com.vn.
Sent row exists.
```

---

## Success Criteria

- `npm.cmd test` passes.
- `npm.cmd run typecheck` passes.
- `npm.cmd run build` passes.
- `npm.cmd run deploy` succeeds.
- Login works via `ceo@bdsmetro.com`.
- `admin@onyx.com.vn` inbound feed works.
- Inline image behavior is validated against actual email debug JSON.
- Outbound state is honest: either sent and received, or visibly disabled.
- No `Metro Mail.pdf` or API key committed.

## Risks

- Cloudflare Email Sending API currently returns 404 for `onyx.com.vn`; outbound may need non-Cloudflare provider.
- Adding `allow-same-origin` to iframe weakens upstream isolation; use only if debug proves Access cookie blocking and document tradeoff.
- Global API Key was pasted in chat; rotate after MVP verification.
- Upstream may change; fetch before execution.

## Unresolved Questions

- Which outbound provider should MVP use if Cloudflare Email Sending remains unavailable: Lark SMTP/API or Resend?
- Should inline images render inside body, or is an attachment card acceptable for V1?
- Should debug endpoint be temporary only, removed after image diagnosis?

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-02-onyx-email-upstream-bigupdate.md`.

Two execution options:

1. **Subagent-Driven (recommended)** - dispatch a fresh worker per task, review between tasks, safer for upstream merge.
2. **Inline Execution** - execute tasks in this session with checkpoints.

Recommended MVP execution: Task 1 -> Task 2 -> Task 3 -> Task 4 -> Task 5. Stop after inbound image and honest outbound state are verified.
