---
title: "Phase 04 — Nav Separation"
status: pending
priority: P1
effort: 0.5d
---

# Phase 04 — Tách Feed kh?i Mailbox cá nhân

## Thay d?i navigation

| Tru?c | Sau |
|-------|-----|
| Login ? `/app` mailbox picker | Login ? `/home` (feed) |
| `/app` = home | `/app` = **Mailboxes** (gi? route, d?i label) |
| Sidebar "Feed" = inbox | Sidebar **Inbox** (folder inbox) |
| Sidebar "New topic" | **Xóa** kh?i mailbox sidebar |
| Sidebar "Boards" section | Gi? (legacy) ho?c collapse — optional |

## Files

| Action | Path |
|--------|------|
| Modify | `app/routes/landing.tsx` ho?c post-login redirect ? `/home` |
| Modify | `app/components/Sidebar.tsx` — remove New topic, rename Feed?Inbox |
| Modify | `app/routes/email-list.tsx` — title "Inbox" not "Relationship Feed" |
| Modify | `app/routes/home.tsx` — title "Mailboxes" |
| Modify | `app/components/Header.tsx` — add Home link |

## Default redirect logic

```
/app (mailboxes):
  - if 1 mailbox ? still show picker OR go mailbox (gi? behavior cu cho email)
/home:
  - always org feed — default landing after Access login
```

## Success criteria

- [ ] User vào `box.onyx.com.vn` sau login ? th?y `/home` feed
- [ ] Mailbox sidebar không còn "New topic"
- [ ] Personal inbox label = "Inbox"