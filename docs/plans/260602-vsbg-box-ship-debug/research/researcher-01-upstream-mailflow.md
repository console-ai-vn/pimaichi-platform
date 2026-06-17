# Upstream mail rendering + attachment behavior

## Findings
- Upstream renders message HTML in a sandboxed iframe, not directly in the page DOM.
- HTML is sanitized with DOMPurify before injection; `style` tags are forbidden, `target` is preserved, and `FORCE_BODY` is enabled.
- The iframe is created via `srcdoc` with a strict CSP: no default sources, inline styles only, images allowed from `self`, `data:`, `blob:`, `cid:`, and `https:`.
- The iframe sandbox keeps `allow-same-origin` and `allow-scripts`, so same-origin attachment requests and the auto-size `postMessage` script both work.
- Inbound emails store `parsedEmail.html || parsedEmail.text || ""` as the body, so HTML wins when available.
- Inline CID images are rewritten in the frontend to `/api/v1/mailboxes/:mailboxId/emails/:emailId/attachments/:attachmentId`.
- Non-inline attachments are filtered out of the display list; inline attachments are treated separately.
- Inbound attachment ingestion only persists attachments that pass `isAllowedInboundImageAttachment`; unsupported attachments are skipped.
- Attachment download responses always use `Content-Disposition: attachment`, even for inline-capable objects.
- Forwarding is disabled in the main API entrypoint (`ALLOW_FORWARDING = false`), so `/forward` is currently a dead path in V1.

## Exact upstream behavior
- `app/components/EmailIframe.tsx`:
  - Sanitizes message HTML before render.
  - Injects the sanitized body into an iframe `srcdoc`.
  - Uses an inline height-reporting script when auto-size is enabled.
  - CSP permits inline image sources needed for CID/data/blob/image loading.
- `app/lib/utils.ts`:
  - `rewriteInlineImages()` converts `cid:` refs to attachment API URLs when attachments have `content_id`.
  - `getNonInlineAttachments()` hides attachments with `disposition === "inline"`.
  - `getAttachmentUrl()` is a thin URL builder for the attachment endpoint.
  - `downloadFile()` forces browser download behavior via `<a download>`.
  - Reply quoting strips HTML to escaped plain text before insertion into compose.
- `workers/index.ts`:
  - `receiveEmail()` parses via PostalMime, prefers HTML body, and stores attachment metadata in R2.
  - Attachment filenames are sanitized before storage.
  - Stored attachment records include `content_id` and `disposition` so the frontend can separate inline vs regular files.
  - Attachment GET validates ownership, then streams the blob with `Content-Type` + attachment download headers.
- `workers/email-sender.ts`:
  - Outbound send payload preserves `html`, `text`, `cc`, `bcc`, `replyTo`, headers, and attachments.
  - Attachment `contentId` is forwarded when present, so inline images can round-trip.
- `workers/routes/reply-forward.ts`:
  - Reply and forward both store attachments before sending.
  - Reply preserves thread headers; forward starts a fresh thread.
  - Reply/forward delivery uses the same attachment passthrough to Cloudflare Email Service.

## Gaps vs current bug
- If the bug is "HTML email renders but inline images are broken", the upstream gap is likely outside the renderer itself: either `content_id` was not stored, `rewriteInlineImages()` was not applied, or the body reached the iframe without CID replacement.
- If the bug is "attachments missing from received mail", upstream intentionally drops non-image inbound attachments via `isAllowedInboundImageAttachment`; that is a product constraint, not a rendering bug.
- If the bug is "inline images show up as downloadable files", upstream currently serves every attachment endpoint response as `attachment`, so inline display depends on `<img src>` rendering, not inline browser preview.
- If the bug is "forward cannot send attachments", upstream `/forward` is disabled entirely in V1, so the failure is expected until that flag is flipped.
- If the bug is "reply loses attachment metadata", upstream reply path does preserve attachment passthrough and stores attachment rows before send.

## Evidence
- Read command: `rg -n -C 3 "sanitize|attachment|iframe|srcdoc|dompurify|Content-Disposition|inline|download|html|text|blob|cid|image" C:\Users\Mr.D\Desktop\Email Web\app\lib\utils.ts C:\Users\Mr.D\Desktop\Email Web\app\components\EmailIframe.tsx C:\Users\Mr.D\Desktop\Email Web\workers\index.ts C:\Users\Mr.D\Desktop\Email Web\workers\email-sender.ts C:\Users\Mr.D\Desktop\Email Web\workers\routes\reply-forward.ts`
- Read command: `Get-Content` over:
  - `C:\Users\Mr.D\Desktop\Email Web\app\lib\utils.ts`
  - `C:\Users\Mr.D\Desktop\Email Web\app\components\EmailIframe.tsx`
  - `C:\Users\Mr.D\Desktop\Email Web\workers\index.ts`
  - `C:\Users\Mr.D\Desktop\Email Web\workers\email-sender.ts`
  - `C:\Users\Mr.D\Desktop\Email Web\workers\routes\reply-forward.ts`

## Unresolved questions
- What is the exact ONYX symptom: blank body, broken inline images, missing attachments, bad download behavior, or disabled forward?
- Is the failing case inbound mail, reply mail, or forward mail?
- Are the missing objects image-only, or does the bug expect PDFs/docs to be preserved too?
- Does the current bug happen only behind Cloudflare Access, or also locally without auth cookies?
