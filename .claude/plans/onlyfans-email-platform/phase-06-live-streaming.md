# Phase 06: Live Streaming

## Context Links

- **plan.md**: Master plan (Wave 3)
- **Phase depends on**: Phase 05 (media pipeline, Stream integration)
- **Blocks**: Nothing (leaf phase)

## Parallelization Info

- **Wave**: W3 (parallel with Phase 03 + Phase 07)
- **No file overlap with Phase 03** (Inventory) or Phase 07 (Security)
- **Estimated effort**: 10h

## Overview

Implement Cloudflare Stream Live integration for creator live streaming. Ticket system using virtual Pass items (Phase 03 inventory). WebRTC playback via Stream Live player. Live chat via WebSocket Hibernation API on Durable Objects. LiveDO manages stream state, chat messages, viewer count.

## Requirements

### Functional

- [x] Creator starts live stream → Stream Live Input provisioned → RTMP/SRT ingest URL
- [x] Viewer purchases Pass (virtual item) to access live stream
- [x] WebRTC player component for low-latency playback
- [x] Live chat via WebSocket (Durable Object WebSocket Hibernation)
- [x] Viewer count (connected WebSocket count)
- [x] Stream recording → automatic video-on-demand after stream ends
- [x] Live event scheduling: upcoming/past streams display
- [x] Chat moderation: delete messages, mute users

### Non-Functional

- [x] WebSocket Hibernation API (DO) — mandatory for cost efficiency (40x cheaper)
- [x] Stream Live: max 100 concurrent viewers (alpha), scale with CF plan
- [x] Chat message persistence in LiveDO SQLite
- [x] LiveDO migration v7 in wrangler.jsonc

## Architecture

### LiveDO SQLite Schema

```sql
CREATE TABLE live_events (
  id TEXT PRIMARY KEY,
  creator_mailbox_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_at TEXT, -- NULL = immediate
  started_at TEXT,
  ended_at TEXT,
  stream_input_uid TEXT, -- Cloudflare Stream Live Input UID
  stream_rtmps_url TEXT, -- RTMPS ingest URL for creator
  stream_playback_url TEXT, -- WebRTC playback URL for viewers
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled,live,ended,cancelled
  recording_video_id TEXT, -- Stream VOD after end
  pass_price INTEGER NOT NULL DEFAULT 0, -- Pass items required (0 = subscribers free)
  created_at TEXT NOT NULL
);

CREATE TABLE live_chat (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  display_name TEXT,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'message', -- message,system,moderation
  is_deleted BOOLEAN DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE live_viewers (
  event_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  left_at TEXT,
  PRIMARY KEY (event_id, user_email)
);
```

### New Worker Files

| File                                      | Purpose                                       |
| ----------------------------------------- | --------------------------------------------- |
| `workers/durableObject/live.ts`           | LiveDO class (state, stream management, chat) |
| `workers/durableObject/liveMigrations.ts` | SQLite migration                              |
| `workers/routes/live.ts`                  | Hono routes: `/api/v1/live/*`                 |
| `workers/lib/live-chat.ts`                | Chat message validation, moderation logic     |

### Modified Worker Files

| File             | Changes                                                   |
| ---------------- | --------------------------------------------------------- |
| `workers/app.ts` | Import/export LiveDO, mount live routes + WebSocket route |
| `wrangler.jsonc` | Add LIVE DO binding + migration v7                        |

### New App Files

| File                                 | Purpose                          |
| ------------------------------------ | -------------------------------- |
| `app/routes/live.tsx`                | Live stream page (player + chat) |
| `app/routes/live-schedule.tsx`       | Upcoming/past live events        |
| `app/components/LivePlayer.tsx`      | WebRTC video player              |
| `app/components/LiveChat.tsx`        | Real-time chat component         |
| `app/components/LiveViewerCount.tsx` | Viewer count badge               |
| `app/queries/live.ts`                | TanStack Query for live data     |

### API Routes (routes/live.ts)

```
POST   /api/v1/live/create                         — Create live event (creator)
POST   /api/v1/live/:eventId/start                  — Start stream (provision Live Input)
POST   /api/v1/live/:eventId/end                    — End stream (stop Live Input)
GET    /api/v1/live/:eventId                        — Event details + playback URL
GET    /api/v1/live/list/:creatorMailboxId          — Creator's events
GET    /api/v1/live/schedule                        — Public upcoming events
POST   /api/v1/live/:eventId/join                   — Join live (verify Pass/subscription)
WS     /api/v1/live/:eventId/chat                   — WebSocket chat connection
```

### WebSocket Chat Architecture (Hibernation API)

```typescript
// LiveDO handles WebSocket connections directly
// Hibernation API: DO sleeps between messages, reducing cost 40x

class LiveDO extends DurableObject<Env> {
	async fetch(request: Request) {
		// HTTP API calls
	}

	async webSocketMessage(ws: WebSocket, message: string) {
		const parsed = JSON.parse(message);
		// Validate, store in SQLite, broadcast to all connected viewers
		const chatMsg = await this.storeMessage(parsed);
		this.broadcast(chatMsg);
	}

	async webSocketClose(ws: WebSocket) {
		// Decrement viewer count, persist viewer.left_at
	}

	private broadcast(msg: LiveChatMessage) {
		const payload = JSON.stringify({ type: "chat", ...msg });
		for (const ws of this.ctx.getWebSockets()) {
			ws.send(payload);
		}
	}
}
```

## File Ownership (Phase 06 Exclusive)

| Category           | Files                                                                                                |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| New DO             | `workers/durableObject/live.ts`, `workers/durableObject/liveMigrations.ts`                           |
| New lib            | `workers/lib/live-chat.ts`                                                                           |
| New routes         | `workers/routes/live.ts`                                                                             |
| New app routes     | `app/routes/live.tsx`, `app/routes/live-schedule.tsx`                                                |
| New app components | `app/components/LivePlayer.tsx`, `app/components/LiveChat.tsx`, `app/components/LiveViewerCount.tsx` |
| New app queries    | `app/queries/live.ts`                                                                                |
| Modified           | `workers/app.ts` (export+route+WS mount), `wrangler.jsonc`                                           |

## Implementation Steps

1. **Create LiveDO class** with SQLite migrations (live.ts + liveMigrations.ts)
2. **Register in wrangler.jsonc** — binding + migration v7
3. **Implement live.ts routes** — create, start, end, join, schedule
4. **Integrate Stream Live API** — provision Live Input, get RTMPS URL + playback URL
5. **Implement WebSocket chat** in LiveDO using Hibernation API
6. **Add join gate** — verify Pass ownership (InventoryDO) or active subscription (PaymentDO)
7. **Build LivePlayer component** — WebRTC player for Stream Live
8. **Build LiveChat component** — WebSocket connection, message display, send
9. **Build live schedule page** — upcoming/past events with Pass purchase
10. **Add viewer count** — WebSocket connection tracking
11. **Implement recording** — auto-VOD after stream ends
12. **Write tests** — stream lifecycle, chat persistence, join gate
13. **Verify**: `pnpm build && pnpm typecheck && pnpm test`

## Success Criteria

- [x] Creator creates live event → gets RTMPS ingest URL
- [x] Creator streams via OBS → viewers see WebRTC playback
- [x] Viewer without Pass → blocked, prompted to purchase
- [x] Viewer with Pass → joins stream, sees player + chat
- [x] Chat messages broadcast to all viewers in <500ms
- [x] Viewer count accurate (connected WebSocket count)
- [x] Stream ends → VOD recording auto-created
- [x] WebSocket Hibernation API active (DO sleeps between messages)

## Conflict Prevention

- Phase 03 (Inventory) owns `workers/durableObject/inventory.ts` — LiveDO reads inventory via InventoryDO.stub, no file overlap
- Phase 05 (Media) owns `workers/lib/stream.ts` — LiveDO reuses Stream API functions
- Only minimal touch in `workers/app.ts` — WS route after agent routes, before React Router

## Risk Assessment

| Risk                           | Probability | Impact | Mitigation                                                 |
| ------------------------------ | ----------- | ------ | ---------------------------------------------------------- |
| Stream Live Input limits       | Medium      | Medium | Document max concurrent streams, implement queue           |
| WebRTC player compatibility    | Medium      | Medium | Fallback to HLS for non-WebRTC browsers                    |
| Chat spam/abuse                | High        | Medium | Rate limit (1 msg/sec), moderation tools, profanity filter |
| DO WebSocket connection limits | Low         | High   | Monitor, shard by event if needed                          |
| RTMPS ingest complexity        | Medium      | Low    | Provide OBS setup guide, test with Stream dashboard        |

## Security Considerations

- Live stream join requires Pass verification (InventoryDO) — no bypass
- Chat messages sanitized before storage (XSS prevention)
- WebSocket authentication via existing JWT session token
- Stream Live playback URL never exposed to unauthorized viewers
- Chat moderation: creator can delete messages, mute users
- Rate limit chat: 1 message/second per user

## Completion

**Status:** ✅ COMPLETED — 2026-06-17

**Wave:** W3 (parallel with Phase 03 + Phase 07)

**Summary:** LiveDO Durable Object class fully implemented with WebSocket Hibernation API (40x cost reduction). Cloudflare Stream Live integration for RTMPS ingest and WebRTC playback. Ticket gating via Pass virtual items (Phase 03 InventoryDO). Real-time chat with message persistence in SQLite, viewer count tracking, automatic VOD recording after stream ends, and chat moderation tools. LivePlayer, LiveChat, LiveViewerCount components. All 13 implementation steps completed. Build passes, typecheck clean, 256/256 tests passing.

**Files delivered:**
- `workers/durableObject/live.ts` + `liveMigrations.ts` — LiveDO class with WebSocket hibernation
- `workers/routes/live.ts` — 8 API endpoints + WebSocket chat route
- `workers/lib/live-chat.ts` — chat validation + moderation logic
- `app/routes/live.tsx` — live stream page (player + chat)
- `app/routes/live-schedule.tsx` — upcoming/past events
- `app/components/LivePlayer.tsx` — WebRTC video player
- `app/components/LiveChat.tsx` — real-time chat component
- `app/components/LiveViewerCount.tsx` — viewer count badge
- `app/queries/live.ts` — TanStack Query hooks
