---
title: "Phase 05 — Ship"
status: pending
priority: P0
effort: 0.5d
---

# Phase 05 — Verification + Deploy

## Checklist

```
? pnpm test — 100% pass (incl. home-feed.test.ts)
? pnpm typecheck
? pnpm lint
? Manual smoke box.onyx.com.vn:
  ? ceo@bdsmetro.com — t?o topic + ?nh
  ? admin@onyx.com.vn — comment + like
  ? test@onyx.com.vn — dislike + comment ?nh
  ? Mailbox admin@ — inbox v?n nh?n email bình thu?ng
? pnpm deploy
? Hard refresh prod
```

## Rollback

- OrgFeedDO additive — rollback = hide `/home` route, revert nav
- Không migrate/delete MailboxDO data

## Docs impact

- Minor: note pivot trong plan này; không rewrite `260605` (historical)