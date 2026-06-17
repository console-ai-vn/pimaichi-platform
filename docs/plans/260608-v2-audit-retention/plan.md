---
title: "V2 — Audit + Retention + Hardening"
description: "Observability, compliance, security hardening, and CI for production-grade ONYX."
status: approved
priority: P1
effort: 12d
branch: metro-mail-v1
tags: [onyx-email, audit, retention, security, ci, cloudflare]
created: 2026-06-08
---

# V2 — Audit + Retention + Hardening

> **Context:** V1 + V1.5 shipped. Core email + AI agent + MCP + social layer all running on `box.onyx.com.vn`. V2 hardens the foundation for production team use.

## Objective

Turn ONYX from a working MVP into a production-grade internal tool: audit trail, data retention, proper secrets management, per-mailbox permissions, CI pipeline, and security hardening.

## Success Criteria

- Every read/send/delete/login action produces an immutable audit log entry.
- Trash auto-archives after 30 days; Sent auto-archives after 1 year.
- POLICY_AUD and TEAM_DOMAIN are wrangler secrets, not in `wrangler.jsonc` `vars`.
- CI runs on every push: typecheck ? test ? lint ? build.
- Full mailbox deletion cleans up DO data + R2 attachments without leaks.
- App-level CSP header is set on all non-iframe responses.
- Per-mailbox permission model defined (read/send/delete/manage/admin roles).

## Scope

| ID | Item | Why | Effort | Phase |
|---|---|---|---|---|
| V2-1 | Audit log table + admin viewer | Compliance, debugging, who-did-what | M | 1 |
| V2-2 | Retention policy (Trash 30d, Sent 1y) | Storage cost, data hygiene | M | 2 |
| V2-3 | Secrets: POLICY_AUD + TEAM_DOMAIN | Currently exposed in `vars` | S | 3 |
| V2-4 | Per-mailbox permission model | Replace single CF Access policy with roles | L | 3 |
| V2-5 | Domain management UI | Admin UI for EMAIL_ADDRESSES / DOMAINS | M | 4 |
| V2-6 | Full mailbox deletion (R2 + DO) | `ALLOW_MAILBOX_DELETION=false` TODO | S | 5 |
| V2-7 | App-level CSP `<meta>` | Security hardening | S | 5 |
| V2-8 | CI pipeline (typecheck + test + lint) | Automated quality gate | M | 6 |

## Non-Goals

- D1 / KV migration. Keep DO SQLite + R2.
- Multi-region replication.
- Public-internet email (still internal-only by design).
- CRM layer — separate product line.
- Replace Cloudflare Access with custom auth.

## Phases

| # | Phase | Effort | Status |
|---|---|---|---|
| 1 | [Audit Log Foundation](./phase-01-audit-log.md) | M | pending |
| 2 | [Retention Policy](./phase-02-retention-policy.md) | M | pending |
| 3 | [Secrets + Permission Model](./phase-03-secrets-permissions.md) | L | pending |
| 4 | [Domain Management UI](./phase-04-domain-management.md) | M | pending |
| 5 | [Mailbox Deletion + CSP](./phase-05-deletion-csp.md) | S | pending |
| 6 | [CI Pipeline](./phase-06-ci-pipeline.md) | M | pending |

## Verification (per phase)

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm deploy   # only after phase gates pass
```

## Reference

- [project-roadmap.md](../../project-roadmap.md) § 2 — V2 items
- [system-architecture.md](../../system-architecture.md) § 9 — known TODOs
- [code-standards.md](../../code-standards.md) § 9 — linting gap
- [deployment-guide.md](../../deployment-guide.md) § 3.5 — secrets setup
