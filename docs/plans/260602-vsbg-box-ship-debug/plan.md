---
title: "ONYX Ship Debug"
description: "Plan debug toan bo de dua MVP ONYX ve trang thai ship duoc dua tren upstream."
status: completed
priority: P2
effort: 5h
branch: metro-mail-v1
tags: [onyx-email, debug, upstream, mvp, cloudflare]
created: 2026-06-02
completed: 2026-06-08
---

# ONYX Ship Debug Plan

## Objective

Ship MVP on dinh, khong fix le te: upstream mail core lam chuan, ONYX chi overlay Access, mailbox `admin@onyx.com.vn`, UI feed, va outbound ro trang thai.

## MVP Definition

- Login OTP bang `ceo@bdsmetro.com`.
- App mo shared mailbox `admin@onyx.com.vn`.
- Inbound mail vao Feed.
- Inline/attached image hien thi hoac co fallback attachment card dung duoc.
- Reply/compose khong bao sent ao.
- Tests/typecheck/build/deploy pass.

## Context Links

- Research upstream: [researcher-01-upstream-mailflow.md](./research/researcher-01-upstream-mailflow.md)
- Research current: [researcher-02-current-ship-blockers.md](./research/researcher-02-current-ship-blockers.md)
- Scout: [scout-01-codebase-map.md](./scout/scout-01-codebase-map.md)
- Synthesis: [01-synthesis.md](./reports/01-synthesis.md)

## Phases

| Phase | Status | Progress | Link |
|---|---|---:|---|
| 01 Evidence Lock | completed | 100% | [phase-01-evidence-lock.md](./phase-01-evidence-lock.md) |
| 02 Upstream Core Restore | completed | 100% | [phase-02-upstream-core-restore.md](./phase-02-upstream-core-restore.md) |
| 03 Mailflow Ship Gates | completed | 100% | [phase-03-mailflow-ship-gates.md](./phase-03-mailflow-ship-gates.md) |
| 04 Deploy And Acceptance | completed | 100% | [phase-04-deploy-and-acceptance.md](./phase-04-deploy-and-acceptance.md) |
| 05 Actual Image Support Debug | completed | 100% | [phase-05-actual-image-support-debug.md](./phase-05-actual-image-support-debug.md) |

## Non Goals

- Khong them external mail/file provider khi chua quyet outbound provider.
- Khong mo them mailbox `sale/marketing`.
- Khong sua UI lon.
- Khong commit `Metro Mail.pdf` hay key.

## Validation

Prompt recommended before implementation:

- Confirm outbound provider choice: Cloudflare Email Sending vs external SMTP/API.
- Confirm debug endpoint can be temporary and removed after image diagnosis.
