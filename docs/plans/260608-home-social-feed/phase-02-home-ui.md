---
title: "Phase 02 — Home UI"
status: pending
priority: P0
effort: 1.5d
---

# Phase 02 — Home UI

## Overview

Route `/home` — feed card list + compose topic (admin only) + image picker.

## Routes

```ts
// app/routes.ts
route("home", "routes/home-layout.tsx", [
  index("routes/home-feed.tsx"),
  route("topics/:topicId", "routes/home-topic.tsx"),
]),
```

`home-layout.tsx`: layout nhẹ — header "Home", avatar user, link "Mailboxes" → `/app`. **Không** dùng `mailbox.tsx` sidebar.

## UI Components

| Component | Mô tả |
|-----------|--------|
| `HomeFeedPage` | Infinite scroll / paginate topic cards |
| `TopicCard` | Author avatar, title, excerpt, image grid thumb, reaction counts |
| `CreateTopicSheet` | Admin: title, rich text (reuse `RichTextEditor`), multi-image upload |
| `HomeHeader` | Logo + nav Home / Mail |

## Files

| Action | Path |
|--------|------|
| Create | `app/routes/home-layout.tsx` |
| Create | `app/routes/home-feed.tsx` |
| Create | `app/routes/home-topic.tsx` (shell — detail phase 03) |
| Create | `app/components/home/TopicCard.tsx` |
| Create | `app/components/home/CreateTopicSheet.tsx` |
| Create | `app/queries/home-feed.ts` |
| Modify | `app/services/api.ts` — home feed endpoints |
| Modify | `app/queries/keys.ts` |

## UX rules

- Mobile-first card layout (giống `MobileSocialInboxCard` spacing)
- Tap card → `/home/topics/:id`
- FAB hoặc top button "New topic" — chỉ hiện khi `config.isAdmin`
- Empty state: "Chưa có topic — admin tạo topic đầu tiên"

## Success criteria

- [ ] `/home` load topics từ API
- [ ] Admin tạo topic + 1 ảnh → card xuất hiện
- [ ] Non-admin thấy feed, không thấy nút tạo