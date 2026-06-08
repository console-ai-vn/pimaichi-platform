---
title: "Phase 04 — Nav Separation"
status: pending
priority: P1
effort: 0.5d
---

# Phase 04 — Tách Feed khỏi Mailbox cá nhân

## Thay đổi navigation

| Trước | Sau |
|-------|-----|
| Login → `/app` mailbox picker | Login → `/home` (feed) |
| `/app` = home | `/app` = **Mailboxes** (giữ route, đổi label) |
| Sidebar "Feed" = inbox | Sidebar **Inbox** (folder inbox) |
| Sidebar "New topic" | **Xóa** khỏi mailbox sidebar |
| Sidebar "Boards" section | Giữ (legacy) hoặc collapse — optional |

## Files

| Action | Path |
|--------|------|
| Modify | `app/routes/landing.tsx` hoặc post-login redirect → `/home` |
| Modify | `app/components/Sidebar.tsx` — remove New topic, rename Feed→Inbox |
| Modify | `app/routes/email-list.tsx` — title "Inbox" not "Relationship Feed" |
| Modify | `app/routes/home.tsx` — title "Mailboxes" |
| Modify | `app/components/Header.tsx` — add Home link |

## Default redirect logic

```
/app (mailboxes):
  - if 1 mailbox → still show picker OR go mailbox (giữ behavior cũ cho email)
/home:
  - always org feed — default landing after Access login
```

## Success criteria

- [ ] User vào `box.vsbg.vn` sau login → thấy `/home` feed
- [ ] Mailbox sidebar không còn "New topic"
- [ ] Personal inbox label = "Inbox"