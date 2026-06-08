---
title: "Phase 01 — OrgFeedDO + API"
status: ready
execution_order: 1
priority: P0
effort: 1.5d
---

# Phase 01 — OrgFeedDO + API

## Overview

Tạo `OrgFeedDO` (SQLite) và Hono routes `/api/v1/home/*`. Chưa làm UI.

## Schema (migration `16_add_home_feed`)

```sql
CREATE TABLE topics (
  id TEXT PRIMARY KEY,
  author_email TEXT NOT NULL,
  title TEXT NOT NULL,
  body_html TEXT NOT NULL DEFAULT '',
  body_text TEXT NOT NULL DEFAULT '',
  like_count INTEGER NOT NULL DEFAULT 0,
  dislike_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE topic_images (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  author_email TEXT NOT NULL,
  body_html TEXT NOT NULL DEFAULT '',
  body_text TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE comment_images (
  id TEXT PRIMARY KEY,
  comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE topic_reactions (
  topic_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  reaction TEXT NOT NULL CHECK(reaction IN ('like', 'dislike')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (topic_id, user_email)
);

CREATE INDEX idx_topics_created ON topics(created_at DESC);
CREATE INDEX idx_comments_topic ON comments(topic_id, created_at);
```

## Files

| Action | Path |
|--------|------|
| Create | `workers/durableObject/orgFeed.ts` |
| Create | `workers/durableObject/orgFeedMigrations.ts` |
| Create | `workers/lib/home-feed.ts` — access guards, R2 keys |
| Create | `workers/routes/home-feed.ts` |
| Modify | `workers/app.ts` — export OrgFeedDO |
| Modify | `workers/index.ts` — mount routes |
| Modify | `wrangler.jsonc` — binding `ORG_FEED`, migration tag `v4` |
| Modify | `worker-configuration.d.ts` (cf-typegen) |

## API (Phase 01 scope)

| Method | Path | Auth | Body |
|--------|------|------|------|
| GET | `/api/v1/home/topics` | org member | `?page&limit` |
| GET | `/api/v1/home/topics/:id` | org member | — |
| POST | `/api/v1/home/topics` | admin | `{ title, body, images? }` |

## Implementation steps

1. Scaffold `OrgFeedDO` với drizzle schema mirror `workers/db/feed-schema.ts`
2. Methods: `listTopics`, `getTopic`, `createTopic`, `attachTopicImages`
3. R2 key pattern: `feed/topics/{topicId}/{imageId}`
4. `assertHomeFeedAccess(c)` — org member read; `assertHomeFeedAdmin(c)` — create
5. Unit tests: access guards, topic create validation, image size/type caps (reuse 4MB cover limit)

## Success criteria (GATE — phải pass trước Phase 02)

- [ ] `pnpm test` — new `home-feed.test.ts` pass
- [ ] `pnpm typecheck` pass
- [ ] Dev smoke:
  ```powershell
  # Header x-dev-user-email khi pnpm dev
  curl -H "x-dev-user-email: ceo@bdsmetro.com" http://localhost:5173/api/v1/home/topics
  curl -X POST -H "Content-Type: application/json" -H "x-dev-user-email: ceo@bdsmetro.com" -d "{\"title\":\"Hello\",\"body\":\"<p>test</p>\"}" http://localhost:5173/api/v1/home/topics
  ```
- [ ] Báo tao "phase 01 ok" → mới cook phase 02

## Security

- Fail closed: no JWT → 403
- HTML body sanitized server-side before store
- Image: no SVG; magic-byte check giống avatar