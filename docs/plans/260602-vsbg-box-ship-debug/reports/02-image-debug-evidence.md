# Image Debug Evidence

Date: 2026-06-02

## Observed Email

- Mailbox: `admin@onyx.com.vn`
- Email id: `59252814-353e-47dd-bc1a-643984ab8efc`
- Subject: `Re: test anh`
- Sender: `mr.d@onyx.com.vn`

## Evidence

- Body contains 3 `cid:` refs:
  - `337F3743-46BA-4A71-AD1F-60047DBF142C`
  - `F097EEEF-A8FF-4E95-8B00-7BA7C1648F30`
  - duplicate quoted `F097EEEF-A8FF-4E95-8B00-7BA7C1648F30`
- Stored attachments array is empty: `attachments: []`
- `all_cids_matched: false`
- Lark `data-src` download URL returned `401 Unauthorized` from shell.

## Root Cause

Lark sent HTML with CID image references but did not include the corresponding image parts in the email payload received by Cloudflare Email Routing. Because no attachment bytes reached the Worker, ONYX cannot reconstruct the real image from R2.

## Fix Shipped

- Keep CID-to-attachment rendering when attachments exist.
- Replace unmatched CID `<img>` tags with a clear unavailable-image fallback instead of showing broken browser image icons.
- Added tests for:
  - normal CID rewrite
  - encoded CID rewrite
  - unmatched CID fallback

## Remaining Product Constraint

To display the real image, the sender/provider must include the image as a MIME attachment/related part. Private Lark `internal-api` links cannot be fetched by the Worker without Lark auth.
