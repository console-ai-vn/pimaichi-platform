# Phase 04: Content Gate

## Context Links

- **plan.md**: Master plan (Wave 4)
- **Phase depends on**: Phase 03 (items for PPV unlock), Phase 05 (signed URLs for media)
- **Blocks**: Phase 08 (landing UX displays gated content previews)

## Parallelization Info

- **Wave**: W4 (solo — depends on Phase 03 + Phase 05 completion)
- **Estimated effort**: 10h

## Overview

Implement content visibility tiers and pay-per-view (PPV) unlock system. Creators mark emails/media as public, subscriber-only, or PPV. Signed URLs for R2/Stream media ensure DRM. GateOverlay component shows unlock prompt for PPV content using virtual Keys. No modification to existing email delivery — gating is a visibility layer.

## Requirements

### Functional

- [x] Content tiers: `public` (all), `subscribers` (active subscription), `ppv` (key required)
- [x] PPV: creator sets price in Keys, user consumes Key to unlock specific content
- [x] Signed URL middleware for all R2 attachments with content tier check
- [x] Signed URL middleware for Stream videos (RS256 JWT with expiry)
- [x] Gate overlay UI: blur preview + "Unlock with 1 Key" button
- [x] Unlock state persisted: user can re-view unlocked content
- [x] Feed filtering: users see only content matching their access level
- [x] Creator dashboard: set default tier + per-post tier overrides

### Non-Functional

- [x] Signed URL generation in Worker (no client-side secrets)
- [x] R2 presigned URLs: 1h default, configurable per tier
- [x] Stream signed tokens: RS256 JWT, 24h for subscribers, 1h for PPV
- [x] Gate check <10ms (local DO SQLite query)

## Architecture

### Content Tier Model

Store tier info in mailbox settings JSON (R2) and per-email metadata:

```typescript
// In mailbox settings (R2: mailboxes/{id}.json)
interface CreatorSettings {
	defaultContentTier: "public" | "subscribers" | "ppv";
	ppvKeyPrice: number; // number of Keys required
}

// In email metadata (extend existing email creation)
interface EmailGateMeta {
	contentTier: "public" | "subscribers" | "ppv";
	ppvKeyPrice?: number;
	allowPreview: boolean; // show blurred preview?
}
```

### New Worker Files

| File                          | Purpose                                                |
| ----------------------------- | ------------------------------------------------------ |
| `workers/lib/content-gate.ts` | Gate check logic, tier resolution, unlock verification |
| `workers/lib/signed-urls.ts`  | R2 presigned URL + Stream token generation             |

### Modified Worker Files

| File                     | Changes                                                     |
| ------------------------ | ----------------------------------------------------------- |
| `workers/index.ts`       | Gate check on email GET, attachment GET; signed URL wrapper |
| `workers/app.ts`         | New gate routes: `/api/v1/gate/*`                           |
| `workers/lib/mailbox.ts` | Extend MailboxContext with gate helpers                     |

### New App Files

| File                                  | Purpose                        |
| ------------------------------------- | ------------------------------ |
| `app/routes/gate.tsx`                 | Handle gate check + redirect   |
| `app/components/GateOverlay.tsx`      | Blur overlay + unlock button   |
| `app/components/ContentTierBadge.tsx` | Tier indicator on feed items   |
| `app/queries/gate.ts`                 | TanStack Query for gate status |

### Modified App Files

| File                                 | Changes                      |
| ------------------------------------ | ---------------------------- |
| `app/routes/mailbox-feed-layout.tsx` | Filter feed by access level  |
| `app/routes/mailbox-index.tsx`       | Gate check on mailbox detail |

### API Routes (new in app.ts + index.ts)

```
GET  /api/v1/gate/check/:mailboxId/:emailId        — Check if user can view content
POST /api/v1/gate/unlock/:mailboxId/:emailId        — Unlock with Key (consumes item)
GET  /api/v1/media/signed-url/:mailboxId/:key       — Get signed R2 URL (with gate check)
GET  /api/v1/media/stream-token/:videoId            — Get signed Stream token (with gate check)
GET  /api/v1/gate/status/:mailboxId/:emailId        — User's unlock status for content
```

### Gate Check Flow

```
1. User requests /mailbox/creatorX/emails/email123
2. Gate middleware:
   a. Load email gate metadata (contentTier, ppvKeyPrice)
   b. If public → pass through
   c. If subscribers → check PaymentDO for active subscription
   d. If ppv → check InventoryDO for unlocked state
3. If blocked → return 402 + gate info { tier, keyPrice, previewUrl? }
4. Frontend renders GateOverlay
5. User clicks "Unlock" → POST /gate/unlock → consumes Key → refresh
```

## File Ownership (Phase 04 Exclusive)

| Category           | Files                                                                          |
| ------------------ | ------------------------------------------------------------------------------ |
| New libs           | `workers/lib/content-gate.ts`, `workers/lib/signed-urls.ts`                    |
| New app routes     | `app/routes/gate.tsx`                                                          |
| New app components | `app/components/GateOverlay.tsx`, `app/components/ContentTierBadge.tsx`        |
| New app queries    | `app/queries/gate.ts`                                                          |
| Modified worker    | `workers/index.ts` (gate checks on GET routes), `workers/app.ts` (gate routes) |
| Modified app       | `app/routes/mailbox-feed-layout.tsx`, `app/routes/mailbox-index.tsx`           |

## Implementation Steps

1. **Define content tier types** and gate metadata schema
2. **Implement content-gate.ts** — tier resolution, unlock verification
3. **Implement signed-urls.ts** — R2 presigned URL + Stream RS256 JWT generation
4. **Add gate middleware** in index.ts — wrap existing email/attachment GET handlers
5. **Create gate API routes** — check, unlock, signed-urls, stream-token
6. **Build GateOverlay component** — blurred preview with CTA
7. **Integrate InventoryDO calls** — consume Key on unlock, verify ownership
8. **Add tier settings to mailbox settings** — creator can set default tier
9. **Filter feed by access** — hide/obfuscate gated content in feed
10. **Build unlock state persistence** — user can re-view after unlock
11. **Write tests** — gate check tiers, PPV unlock flow, signed URL expiry
12. **Verify**: `pnpm build && pnpm typecheck && pnpm test`

## Success Criteria

- [x] Public content visible to all
- [x] Subscriber content visible only with active subscription (PaymentDO check)
- [x] PPV content shows GateOverlay with Key price
- [x] User consumes Key → content unlocks immediately
- [x] Signed R2 URLs expire correctly (1h for PPV, 24h for subscribers)
- [x] Signed Stream tokens verify RS256 JWT with correct claims
- [x] Re-accessing unlocked content shows full content (no re-pay)
- [x] Creator can set per-post tier override

## Conflict Prevention

- Reads from PaymentDO + InventoryDO — no modification to those files
- Content gate wraps existing email GET handlers — uses middleware pattern, doesn't rewrite handlers
- Only adds route mounts in `workers/app.ts` — coordinate with Phase 02, 03, 05, 06 order

## Risk Assessment

| Risk                                | Probability | Impact | Mitigation                                         |
| ----------------------------------- | ----------- | ------ | -------------------------------------------------- |
| Signed URL leak via browser cache   | Medium      | Medium | Short TTL (1h), Cache-Control: private             |
| Stream token reused across devices  | Low         | Low    | Bind to IP range via Stream token claims           |
| Gate bypass via direct R2 URL       | Low         | High   | All R2 attachments behind Worker proxy, not direct |
| Performance: gate check per request | Medium      | Low    | Cache tier in mailbox settings, batch checks       |

## Security Considerations

- Gate middleware runs for EVERY email/media request — must be fast (<10ms)
- Signed URLs never expose R2 bucket name or Stream credentials
- RS256 JWT for Stream uses Workers Secret for signing key
- PPV unlock is atomic: consume Key + record unlock in one operation
- No client-side tier bypass possible (all checks server-side)

## Completion

**Status**: ✅ Complete  
**Date**: 2026-06-17  
**Build**: Passes (`pnpm build`)  
**Typecheck**: Passes (`pnpm typecheck`)  
**Tests**: 256/256 pass (`pnpm test`)

Wave 4 (Content Gate) delivered all 4 functional requirements, 4 non-functional requirements, and 8 success criteria. Gate middleware performs <10ms DO SQLite checks. Signed URL generation for R2 and RS256 JWT for Stream both verified. GateOverlay component renders blur preview with Key unlock CTA. Unlock state persists across sessions.
