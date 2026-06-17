# Phase 05: Media Pipeline

## Context Links

- **plan.md**: Master plan (Wave 2)
- **Phase depends on**: Phase 01 (rebrand foundation)
- **Blocks**: Phase 04 (signed URLs for media), Phase 06 (live uses Stream)

## ✅ COMPLETED — 2026-06-17

**Summary**: Cloudflare Stream integrated (direct upload via TUS, signed RS256 JWT tokens for playback, HLS adaptive bitrate). Cloudflare Images integrated (direct upload, variant URLs for responsive delivery). R2 fallback for non-media attachments. VideoPlayer component with HLS support, Gallery with lightbox, UploadProgress via WebSocket. Media library management page for creators. Feed renders media inline replacing plain attachment links. 256/256 tests pass, build clean.

---

## Parallelization Info

- **Wave**: W2 (parallel with Phase 02)
- **No file overlap with Phase 02** — media routes/files are completely separate
- **Estimated effort**: 8h

## Overview

Integrate Cloudflare Stream (video on-demand + upload), Cloudflare Images (optimization + resizing), and R2 (raw storage) into the platform. Replace basic attachment handling with a full media pipeline: upload → transcode → optimize → deliver via signed URLs. Video player and image gallery components for the frontend. WebSocket Hibernation API for upload progress.

## Requirements

### Functional

- [x] Video upload → Cloudflare Stream (via TUS protocol / direct upload)
- [x] Image upload → Cloudflare Images (automatic optimization, resizing via variants)
- [x] R2 as fallback for non-image/video files (existing attachment system)
- [x] Upload progress via WebSocket (Stream TUS progress events)
- [x] Stream video player component (HLS/DASH with adaptive bitrate)
- [x] Image gallery + lightbox component
- [x] Video thumbnail generation (Stream auto-generates)
- [x] Media library page for creators (list/delete/manage media)

### Non-Functional

- [x] Stream upload: use direct creator uploads (no file passthrough through Worker)
- [x] Images: use Cloudflare Images variants for responsive delivery
- [x] Video delivery: Stream HLS (auto-adaptive) + signed URLs
- [x] Upload size limit: 5GB (Stream) / 20MB (Images)

## Architecture

### New Worker Files

| File                      | Purpose                                                                         |
| ------------------------- | ------------------------------------------------------------------------------- |
| `workers/lib/stream.ts`   | Stream API client: upload URL generation, video status, deletion, token signing |
| `workers/lib/images.ts`   | Images API client: direct upload URL, variant URLs, deletion                    |
| `workers/routes/media.ts` | Hono routes: `/api/v1/media/*`                                                  |

### Modified Worker Files

| File               | Changes                                                   |
| ------------------ | --------------------------------------------------------- |
| `workers/app.ts`   | Mount media routes                                        |
| `workers/types.ts` | Add CF_STREAM_ACCOUNT_ID, CF_IMAGES_ACCOUNT_HASH env vars |
| `wrangler.jsonc`   | Add Stream + Images bindings, secrets for API tokens      |

### New App Files

| File                                | Purpose                                                      |
| ----------------------------------- | ------------------------------------------------------------ |
| `app/routes/media.tsx`              | Media library management page                                |
| `app/components/VideoPlayer.tsx`    | HLS video player (using hls.js or Cloudflare's stream-react) |
| `app/components/Gallery.tsx`        | Image grid with lightbox                                     |
| `app/components/UploadProgress.tsx` | TUS upload progress bar via WebSocket                        |
| `app/queries/media.ts`              | TanStack Query hooks for media CRUD                          |

### Modified App Files

| File                                 | Changes                                                         |
| ------------------------------------ | --------------------------------------------------------------- |
| `app/routes/mailbox-feed-layout.tsx` | Rich media rendering in feed (replacing plain attachment links) |

### API Routes (routes/media.ts)

```
POST   /api/v1/media/upload/stream/init            — Get Stream direct upload URL
GET    /api/v1/media/stream/:videoId/status         — Stream video processing status
DELETE /api/v1/media/stream/:videoId                — Delete Stream video
GET    /api/v1/media/stream/list/:mailboxId         — Creator's videos
POST   /api/v1/media/upload/images/init             — Get Images direct upload URL
GET    /api/v1/media/images/:imageId/variants       — Image variants URLs
DELETE /api/v1/media/images/:imageId                — Delete image
GET    /api/v1/media/images/list/:mailboxId         — Creator's images
POST   /api/v1/media/upload/r2                     — R2 fallback upload (existing)
WS     /api/v1/media/upload/progress/:uploadId      — WebSocket upload progress
```

### Stream Integration Pattern

```typescript
// workers/lib/stream.ts
async function createDirectUpload(env: Env, creatorId: string) {
	const response = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/stream/direct_upload`,
		{
			method: "POST",
			headers: { Authorization: `Bearer ${env.CF_STREAM_TOKEN}` },
			body: JSON.stringify({ maxDurationSeconds: 3600, meta: { creatorId } }),
		},
	);
	return response.json(); // { result: { uploadURL, uid } }
}

async function generateSignedToken(
	env: Env,
	videoId: string,
	expirySeconds: number,
) {
	// RS256 JWT with playback restrictions
	// See: https://developers.cloudflare.com/stream/viewing-videos/securing-your-stream/
}
```

### Video Player Architecture

```
User → App (React) → Stream HLS manifest → CDN edge → playback
  1. App requests signed token from Worker
  2. Worker verifies gate check (Phase 04)
  3. Worker returns RS256 JWT with claims: { sub: videoId, exp: +1h }
  4. App passes token to Stream player
  5. Stream CDN validates JWT, serves HLS segments
```

## File Ownership (Phase 05 Exclusive)

| Category           | Files                                                                                                                               |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| New libs           | `workers/lib/stream.ts`, `workers/lib/images.ts`                                                                                    |
| New routes         | `workers/routes/media.ts`                                                                                                           |
| New app routes     | `app/routes/media.tsx`                                                                                                              |
| New app components | `app/components/VideoPlayer.tsx`, `app/components/Gallery.tsx`, `app/components/UploadProgress.tsx`                                 |
| New app queries    | `app/queries/media.ts`                                                                                                              |
| Modified           | `workers/app.ts` (route mount), `workers/types.ts` (env bindings), `wrangler.jsonc` (secrets), `app/routes/mailbox-feed-layout.tsx` |

## Implementation Steps

1. **Set up Cloudflare Stream** — enable on account, get API token
2. **Set up Cloudflare Images** — enable, configure variants
3. **Add secrets** — `wrangler secret put CF_STREAM_TOKEN`, `CF_IMAGES_TOKEN`
4. **Implement stream.ts** — direct upload URL, status polling, signed token, delete
5. **Implement images.ts** — direct upload URL, variant URL generation, delete
6. **Create media routes** — upload init, status, list, delete endpoints
7. **Build VideoPlayer component** — HLS player with signed token integration
8. **Build Gallery component** — grid + lightbox using Images variants
9. **Build UploadProgress component** — TUS progress bar
10. **Create media library page** — creator management UI
11. **Integrate in feed** — replace attachment links with inline VideoPlayer/Gallery
12. **Write tests** — upload URL generation, signed token format, status polling
13. **Verify**: `pnpm build && pnpm typecheck && pnpm test`

## Success Criteria

- [x] Video upload via Stream direct upload works (progress visible)
- [x] Stream video plays in custom VideoPlayer component
- [x] Image upload → Cloudflare Images optimization works
- [x] Gallery displays Images variants (thumbnail, medium, full)
- [x] Media library lists all creator videos/images
- [x] Delete removes from Stream/Images
- [x] Upload progress WebSocket shows real-time bytes
- [x] Feed renders media inline (not attachment links)

## Conflict Prevention

- Phase 02 (Payment) touches different files completely
- `workers/app.ts` mount order: payment routes before media routes
- `wrangler.jsonc` secrets: separate env vars, no overlap
- Phase 04 (Content Gate) builds signed URL generation on top of stream.ts functions

## Risk Assessment

| Risk                       | Probability | Impact | Mitigation                                                    |
| -------------------------- | ----------- | ------ | ------------------------------------------------------------- |
| Stream TUS upload CORS     | Medium      | Medium | Configure CORS in Stream settings, test with actual domain    |
| Stream processing delay    | High        | Low    | Show "processing" state in UI, poll status every 5s           |
| Images variant not created | Low         | Medium | Fallback to original URL, ensure variants auto-create         |
| R2 vs Stream confusion     | Low         | Low    | Clear file type routing: video→Stream, image→Images, other→R2 |
| Stream costs at scale      | Medium      | High   | Track minutes delivered, implement creator storage quotas     |

## Security Considerations

- Stream direct upload URL is one-time-use, short TTL (30min)
- Signed Stream tokens use RS256 JWT with Workers Secret
- No Stream API token exposed to client — all API calls proxied through Worker
- Upload file type validation server-side before returning direct upload URL
- R2 presigned URLs (existing) remain for non-media attachments
