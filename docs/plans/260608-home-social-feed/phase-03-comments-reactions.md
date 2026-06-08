---
title: "Phase 03 — Comments + Reactions"
status: pending
priority: P0
effort: 1d
---

# Phase 03 — Comments + Like/Dislike

## API

| Method | Path | Auth | Body |
|--------|------|------|------|
| GET | `/api/v1/home/topics/:id/comments` | org member | `?page&limit` |
| POST | `/api/v1/home/topics/:id/comments` | org member | `{ body, images? }` |
| PUT | `/api/v1/home/topics/:id/reaction` | org member | `{ reaction: 'like' \| 'dislike' \| null }` |

## OrgFeedDO logic

**Reaction toggle:**
- `null` → xóa reaction, decrement count
- Switch like↔dislike → adjust cả 2 counts atomically (SQL transaction)
- 1 row per `(topic_id, user_email)`

**Comment:**
- Insert comment → increment `topics.comment_count`
- Optional images → `comment_images` + R2 `feed/comments/{commentId}/{imageId}`

## UI — `home-topic.tsx`

```
┌─────────────────────────────────┐
│ Topic title + author + time     │
│ Body (HTML) + image gallery     │
│ [👍 12] [👎 2] [💬 5]          │  ← toggle active state for current user
├─────────────────────────────────┤
│ Comment list (flat)             │
│   avatar + author + body + imgs │
├─────────────────────────────────┤
│ Sticky: comment input + 📷 + Send│
└─────────────────────────────────┘
```

## Files

| Action | Path |
|--------|------|
| Modify | `workers/durableObject/orgFeed.ts` |
| Modify | `workers/routes/home-feed.ts` |
| Create | `app/components/home/TopicDetail.tsx` |
| Create | `app/components/home/ReactionBar.tsx` |
| Create | `app/components/home/CommentList.tsx` |
| Create | `app/components/home/CommentComposer.tsx` |
| Modify | `app/routes/home-topic.tsx` |

## Success criteria

- [ ] User A like → count +1; like lại → remove
- [ ] Switch like → dislike → counts đúng
- [ ] Comment + ảnh hiển thị realtime sau mutate (react-query invalidate)
- [ ] Test transaction counts trong `home-feed.test.ts`