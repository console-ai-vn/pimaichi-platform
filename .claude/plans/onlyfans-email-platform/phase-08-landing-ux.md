# Phase 08: Landing + UX

## Context Links

- **plan.md**: Master plan (Wave 5)
- **Phase depends on**: Phase 02 (payment/checkout), Phase 03 (items/shop), Phase 04 (content gate)
- **Blocks**: Nothing (final phase)

## Parallelization Info

- **Wave**: W5 (solo — depends on Phase 02+03+04 completion)
- **Estimated effort**: 12h

## Overview

Build the public-facing creator economy UX: creator profile pages (public), item shop UI, pricing display, payment flows, landing page redesign, content preview grid, and onboarding wizard. This is the sell-facing layer — the only phase users actually see. Leverages Zustand for client state, TanStack Query for server state, TipTap for rich text profile bios.

## Requirements

### Functional

- [ ] Landing page redesign: hero, features, pricing, creator showcase, CTA
- [ ] Creator profile page (public): bio, cover image, content preview grid, subscribe button
- [ ] Item shop (per creator): catalog display, buy flow, inventory indicator
- [ ] Pricing page: tier comparison, FAQ, enterprise contact
- [ ] Checkout flow: tier selection → payment → mailbox activation → redirect to app
- [ ] Content preview grid: blurred thumbnails for gated content, unlocked full previews
- [ ] Onboarding wizard for new creators (after signup)
- [ ] Responsive design: mobile-first, Tailwind v4 breakpoints
- [ ] SEO: structured data (Organization, Product), meta tags, OG images
- [ ] Loading states: skeleton screens, optimistic updates

### Non-Functional

- [ ] Lighthouse score ≥ 90 (Performance, Accessibility, Best Practices, SEO)
- [ ] Core Web Vitals: LCP < 2.5s, FID < 100ms, CLS < 0.1
- [ ] SSR for public pages (SEO), CSR for authenticated pages
- [ ] Tailwind v4 with CSS layers for theme management

## Architecture

### Modified App Files

| File                     | Changes                                                      |
| ------------------------ | ------------------------------------------------------------ |
| `app/routes/landing.tsx` | Complete redesign: hero, features, pricing, creators, footer |
| `app/routes/signup.tsx`  | Enhanced UX: step wizard, validation, Turnstile              |
| `app/root.tsx`           | Enhanced layout: nav, footer, theme toggle, SEO meta         |
| `app/index.css`          | Theme variables, animation utilities                         |

### New App Files

| File                                  | Purpose                                                |
| ------------------------------------- | ------------------------------------------------------ |
| `app/routes/creator.tsx`              | Public creator profile page: `/:creatorId`             |
| `app/routes/creator.$creatorId.tsx`   | Dynamic creator profile (SSR)                          |
| `app/components/CreatorCard.tsx`      | Creator showcase card (landing + search)               |
| `app/components/CreatorHero.tsx`      | Profile hero: cover, avatar, bio, stats, subscribe CTA |
| `app/components/ContentGrid.tsx`      | Masonry/content grid with gate overlays                |
| `app/components/OnboardingWizard.tsx` | Step-by-step creator setup                             |
| `app/components/PricingTable.tsx`     | Tier comparison table                                  |
| `app/components/SkeletonLoader.tsx`   | Reusable skeleton components                           |
| `app/queries/creator.ts`              | TanStack Query: public profiles, content previews      |

### Modified Worker Files

| File             | Changes                                            |
| ---------------- | -------------------------------------------------- |
| `workers/app.ts` | Public routes: creator profiles (no auth required) |

### Page Architecture

```
/                            → Landing (SSR)
/pricing                     → Pricing page (SSR)
/signup                      → Signup wizard
/checkout                    → Checkout flow
/:creatorId                  → Creator profile (SSR)
/:creatorId/shop             → Creator item shop
/app                         → Authenticated app (existing)
/app/mailbox/:mailboxId      → Mailbox (existing, enhanced)
```

### Landing Page Sections

```
1. Hero: "Your inbox, your empire" + video background + CTA
2. Features: 3-column grid (email, content, payments)
3. How it works: 3-step visual guide
4. Pricing: tier comparison table linking to signup
5. Creator showcase: top creators carousel
6. FAQ: accordion with common questions
7. Footer: links, legal, social
```

### Creator Profile Page

```
1. Hero: cover image + avatar + name + bio (TipTap rich text)
2. Stats bar: subscribers, posts, items
3. Subscribe CTA: tier selection → checkout
4. Content grid:
   - Public posts (full preview)
   - Subscriber posts (blurred + "Subscribe to view")
   - PPV posts (blurred + "Unlock with X Keys")
5. Shop tab: item catalog with buy buttons
```

### State Management (Zustand)

```typescript
// app/stores/ui.ts (extend existing)
interface UIStore {
	// ...existing email state
	checkoutTier: Tier | null;
	checkoutStep: number;
	onboardingStep: number;
	galleryOpen: boolean;
	galleryIndex: number;
	setCheckoutTier: (tier: Tier | null) => void;
	nextCheckoutStep: () => void;
	openGallery: (index: number) => void;
	closeGallery: () => void;
}
```

## File Ownership (Phase 08 Exclusive)

| Category           | Files                                                                                                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New app routes     | `app/routes/creator.tsx`, `app/routes/creator.$creatorId.tsx`                                                                                                                                                       |
| New app components | `app/components/CreatorCard.tsx`, `app/components/CreatorHero.tsx`, `app/components/ContentGrid.tsx`, `app/components/OnboardingWizard.tsx`, `app/components/PricingTable.tsx`, `app/components/SkeletonLoader.tsx` |
| New app queries    | `app/queries/creator.ts`                                                                                                                                                                                            |
| Modified app       | `app/routes/landing.tsx`, `app/routes/signup.tsx`, `app/routes/checkout.tsx` (enhance), `app/root.tsx`, `app/index.css`                                                                                             |
| Modified worker    | `workers/app.ts` (public route additions)                                                                                                                                                                           |

## Implementation Steps

1. **Design system** — define color palette, typography, spacing in Tailwind v4 config
2. **Create reusable components** — SkeletonLoader, CreatorCard, PricingTable
3. **Redesign landing page** — all 7 sections, responsive, SSR
4. **Build creator profile page** — Hero + ContentGrid + Subscribe CTA
5. **Build item shop UI** — catalog display with ItemCard (Phase 03) + buy flow
6. **Enhance checkout flow** — step wizard, Turnstile integration (Phase 07), QR display (Phase 02)
7. **Build onboarding wizard** — step 1: profile, step 2: pricing, step 3: first post
8. **Integrate content gate** — GateOverlay (Phase 04) on ContentGrid items
9. **Add SEO** — structured data, meta tags, OG images, sitemap
10. **Polish responsive design** — test on mobile, tablet, desktop
11. **Performance audit** — Lighthouse, Core Web Vitals, fix issues
12. **Write visual tests** — screenshot comparison for critical pages
13. **Verify**: `pnpm build && pnpm typecheck && pnpm test`

## Success Criteria

- [ ] Landing page converts: clear CTA, pricing visible above fold
- [ ] Creator profile shows bio, stats, content grid
- [ ] Subscribe flow: click → checkout → payment → mailbox active
- [ ] Content grid shows correct gate state (public/subscriber/PPV)
- [ ] Item shop: click item → purchase flow → item in inventory
- [ ] Onboarding wizard: complete profile setup in <5 minutes
- [ ] Mobile responsive: all pages usable on 375px width
- [ ] Lighthouse: Performance ≥ 90, Accessibility ≥ 95
- [ ] LCP < 2.5s (SSR pages)
- [ ] Structured data validates (Google Rich Results Test)

## Conflict Prevention

- Reads from PaymentDO (Phase 02), InventoryDO (Phase 03), Content Gate (Phase 04) — no modifications
- Enhances checkout.tsx (Phase 02) and signup.tsx — coordinate: Phase 02 builds base, Phase 08 enhances
- Only adds public routes in `workers/app.ts` — after authenticated routes, before React Router catch-all

## Risk Assessment

| Risk                                | Probability | Impact | Mitigation                                           |
| ----------------------------------- | ----------- | ------ | ---------------------------------------------------- |
| SSR breaks with DO calls            | Medium      | High   | Public profile data cached in R2, not live DO query  |
| Landing page too heavy              | Medium      | Medium | Code split by section, lazy load below fold          |
| Creator profile SSR slow            | Low         | Medium | Cache profile JSON in R2, revalidate every 5 minutes |
| Content grid renders too many items | Medium      | Low    | Virtual scrolling for > 50 items                     |
| SEO not indexed properly            | Low         | High   | Pre-render public pages, submit sitemap to Google    |

## Security Considerations

- Public creator profiles: no PII exposed beyond creator's public bio
- Checkout: Turnstile integration from Phase 07
- All payment flows: HTTPS only, secure cookies
- CSP updated to allow any CDN domains (Stream, Images)
