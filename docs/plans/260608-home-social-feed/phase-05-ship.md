---
title: "Phase 05 — Ship"
status: pending
priority: P0
effort: 0.5d
---

# Phase 05 — Verification + Deploy

## Checklist

```
□ pnpm test — 100% pass (incl. home-feed.test.ts)
□ pnpm typecheck
□ pnpm lint
□ Manual smoke box.vsbg.vn:
  □ ceo@bdsmetro.com — tạo topic + ảnh
  □ admin@vsbg.vn — comment + like
  □ test@vsbg.vn — dislike + comment ảnh
  □ Mailbox admin@ — inbox vẫn nhận email bình thường
□ pnpm deploy
□ Hard refresh prod
```

## Rollback

- OrgFeedDO additive — rollback = hide `/home` route, revert nav
- Không migrate/delete MailboxDO data

## Docs impact

- Minor: note pivot trong plan này; không rewrite `260605` (historical)