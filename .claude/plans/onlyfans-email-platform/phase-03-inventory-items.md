# Phase 03: Inventory + Virtual Items

## Context Links

- **plan.md**: Master plan (Wave 3)
- **Phase depends on**: Phase 01 (rebrand), loosely on Phase 02 (purchase needs payment)
- **Blocks**: Phase 04 (content gate needs items for PPV keys, DM tokens)

## Parallelization Info

- **Wave**: W3 (parallel with Phase 06 + Phase 07)
- **No file overlap with Phase 06** (Live) or Phase 07 (Security)
- **Estimated effort**: 8h

## Overview

Implement InventoryDO (new Durable Object class) for virtual item catalog management. Four item types: Key (PPV unlock), Token (DM access), Gift (reactions/engagement), Pass (live stream ticket). Purchase flow verifies payment via PaymentDO, then credits item to user. Consumption tracking ensures items are used, not transferable.

## Requirements

### Functional

- [x] InventoryDO class with catalog + user_inventories + consumption_log tables
- [x] Item catalog: admin-creatable, per-creator or global scope
- [x] 4 item types: `key`, `token`, `gift`, `pass`
- [x] Purchase flow: user pays → webhook → PaymentDO → InventoryDO.grant()
- [x] Consumption: user uses Key on content → InventoryDO.consume() → marks used
- [x] Item listing: GET /api/v1/inventory/items?creator=xxx
- [x] Purchase history: GET /api/v1/inventory/purchases/:userEmail
- [x] Inventory count: GET /api/v1/inventory/count/:userEmail?type=key

### Non-Functional

- [x] Immutable consumption log (append-only)
- [x] InventoryDO migration v6 in wrangler.jsonc
- [x] Atomic grant: purchase + inventory update in one logical operation
- [x] Admin-only catalog management

## Architecture

### InventoryDO SQLite Schema

```sql
CREATE TABLE catalog (
  id TEXT PRIMARY KEY,
  creator_mailbox_id TEXT, -- NULL = global/ platform item
  type TEXT NOT NULL, -- 'key','token','gift','pass'
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL, -- VND smallest unit
  image_url TEXT,
  is_active BOOLEAN DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE user_inventories (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  item_id TEXT NOT NULL REFERENCES catalog(id),
  purchase_id TEXT NOT NULL, -- links to payment/invoice
  status TEXT NOT NULL DEFAULT 'unused', -- unused,used,expired
  consumed_at TEXT,
  consumed_on TEXT, -- resource identifier (email_id, stream_id, etc.)
  granted_at TEXT NOT NULL,
  expires_at TEXT -- NULL = never expires
);

CREATE TABLE consumption_log (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  item_id TEXT NOT NULL,
  inventory_id TEXT NOT NULL REFERENCES user_inventories(id),
  resource_type TEXT NOT NULL, -- 'email','video','live','dm'
  resource_id TEXT NOT NULL,
  consumed_at TEXT NOT NULL
);
```

### New Worker Files

| File                                           | Purpose                            |
| ---------------------------------------------- | ---------------------------------- |
| `workers/durableObject/inventory.ts`           | InventoryDO class                  |
| `workers/durableObject/inventoryMigrations.ts` | SQLite migration                   |
| `workers/routes/inventory.ts`                  | Hono routes: `/api/v1/inventory/*` |
| `workers/lib/items.ts`                         | Item type definitions + validation |

### Modified Worker Files

| File             | Changes                                           |
| ---------------- | ------------------------------------------------- |
| `workers/app.ts` | Import/export InventoryDO, mount inventory routes |
| `wrangler.jsonc` | Add INVENTORY DO binding + migration v6           |

### New App Files

| File                                | Purpose                            |
| ----------------------------------- | ---------------------------------- |
| `app/routes/shop.tsx`               | Creator item shop page             |
| `app/components/ItemCard.tsx`       | Item display card with buy button  |
| `app/components/InventoryBadge.tsx` | User's item count badge            |
| `app/queries/inventory.ts`          | TanStack Query hooks for inventory |

### API Routes (routes/inventory.ts)

```
GET    /api/v1/inventory/catalog                    — List global items
GET    /api/v1/inventory/catalog/:creatorMailboxId  — List creator items
POST   /api/v1/inventory/catalog                    — Create item (admin only)
PATCH  /api/v1/inventory/catalog/:itemId            — Update item
DELETE /api/v1/inventory/catalog/:itemId            — Deactivate item
POST   /api/v1/inventory/purchase                   — Purchase item (creates payment intent)
GET    /api/v1/inventory/inventory/:userEmail       — User's active items
POST   /api/v1/inventory/consume                    — Use/consume an item
GET    /api/v1/inventory/history/:userEmail         — Purchase + consumption history
```

### Purchase Flow (InventoryDO ↔ PaymentDO)

```
1. User clicks "Buy Key ($5)"
2. POST /inventory/purchase { itemId, userEmail }
3. InventoryDO creates purchase intent, calls PaymentDO.createInvoice()
4. PaymentDO returns VietQR + invoiceId
5. User pays → SePay webhook → PaymentDO → calls InventoryDO.grantItem()
6. InventoryDO creates user_inventories row, returns item
7. Frontend refreshes inventory count
```

## File Ownership (Phase 03 Exclusive)

| Category           | Files                                                                                |
| ------------------ | ------------------------------------------------------------------------------------ |
| New DO             | `workers/durableObject/inventory.ts`, `workers/durableObject/inventoryMigrations.ts` |
| New lib            | `workers/lib/items.ts`                                                               |
| New routes         | `workers/routes/inventory.ts`                                                        |
| New app routes     | `app/routes/shop.tsx`                                                                |
| New app components | `app/components/ItemCard.tsx`, `app/components/InventoryBadge.tsx`                   |
| New app queries    | `app/queries/inventory.ts`                                                           |
| Modified           | `workers/app.ts` (export+route mount only), `wrangler.jsonc`                         |

## Implementation Steps

1. **Define item types** in `workers/lib/items.ts` (Key, Token, Gift, Pass enums + validation)
2. **Create InventoryDO** with SQLite migrations
3. **Register in wrangler.jsonc** — binding + migration v6
4. **Implement catalog CRUD** — admin endpoints for creating items
5. **Implement purchase flow** — inventory.purchase() → PaymentDO.createInvoice()
6. **Implement grant callback** — PaymentDO calls InventoryDO.grantItem() after payment
7. **Implement consume endpoint** — verify ownership, mark used, log consumption
8. **Build shop UI** — creator item listing + buy flow
9. **Build inventory badge** — user's item counts in app header
10. **Write tests** — purchase→grant→consume lifecycle, idempotent grant
11. **Verify**: `pnpm build && pnpm typecheck && pnpm test`

## Success Criteria

- [x] Admin can create/update/deactivate catalog items
- [x] User purchases Key → payment webhook → item appears in inventory
- [x] User consumes Key on gated content → marked as used
- [x] Cannot consume already-used items
- [x] Purchase history shows all transactions
- [x] Inventory count updates in real-time
- [x] No item transfer between users (immutable ownership)

## Conflict Prevention

- InventoryDO.purchase() calls PaymentDO — dependency direction is Inventory→Payment
- No modification to PaymentDO files (Phase 02 owns those)
- Only minimal touch in `workers/app.ts` — coordinate with Phase 02, 05, 06 for mount order: inventory routes after payment routes, before media routes

## Risk Assessment

| Risk                                    | Probability | Impact | Mitigation                                                                            |
| --------------------------------------- | ----------- | ------ | ------------------------------------------------------------------------------------- |
| Race condition: purchase + grant        | Low         | High   | PaymentDO.grantItem() idempotency via invoiceId                                       |
| Item expiration not enforced            | Medium      | Medium | consume() checks expires_at; cron cleans expired                                      |
| Catalog item deleted while users own it | Low         | Low    | Soft-delete (is_active=false), existing items remain                                  |
| Double consumption                      | Low         | High   | status='unused' check before UPDATE, UNIQUE constraint on (inventory_id, resource_id) |

## Security Considerations

- Admin-only catalog mutation (assertAdminAccess)
- Purchase requires authenticated user (JWT + mailbox role)
- Consumption validates user_email matches inventory owner
- No item gifting/transfer — prevents fraud vectors
- Price in VND only — no currency conversion edge cases yet

## Completion

**Status:** ✅ COMPLETED — 2026-06-17

**Wave:** W3 (parallel with Phase 06 + Phase 07)

**Summary:** InventoryDO Durable Object class fully implemented with catalog, user_inventories, and consumption_log tables. Four item types (key, token, gift, pass) with full admin CRUD, purchase flow integrated with PaymentDO, atomic grant with idempotency guard, immutable consumption log, and real-time inventory counts. Shop UI (`app/routes/shop.tsx`) with ItemCard and InventoryBadge components. TanStack Query hooks (`app/queries/inventory.ts`) for reactive inventory data. All 10 implementation steps completed. Build passes, typecheck clean, 256/256 tests passing.

**Files delivered:**
- `workers/durableObject/inventory.ts` + `inventoryMigrations.ts` — InventoryDO class
- `workers/routes/inventory.ts` — 9 API endpoints (catalog CRUD, purchase, consume, history)
- `workers/lib/items.ts` — item type definitions + validation
- `app/routes/shop.tsx` — creator item shop page
- `app/components/ItemCard.tsx` — item display + buy button
- `app/components/InventoryBadge.tsx` — user item count badge
- `app/queries/inventory.ts` — TanStack Query hooks
