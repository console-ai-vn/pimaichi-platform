---
title: "Email Social Network Plan"
description: "Turn ONYX from an email client into a private social network where email is identity, transport, and relationship graph."
status: completed
priority: P1
effort: 10d
branch: metro-mail-v1
tags: [email, social-network, crm, durable-objects, cloudflare]
created: 2026-06-05
completed: 2026-06-08
---

# Email Social Network Plan

> **For agentic workers:** Required execution skill: use `superpowers:subagent-driven-development` or `superpowers:executing-plans`. Execute phases in order and update checkbox progress.

## Objective

Build "social network inside email" with mobile as the primary surface: every mailbox becomes a profile, every thread becomes a social conversation, every participant becomes a contact node, and internal team actions happen around the email thread without leaking externally.

## Product Thesis

Email already has identity, inbox, graph, async messaging, attachments, and universal reach. ONYX should not become another Gmail clone. It should become a private relationship network where external people keep using normal email, while the internal team sees profiles, relationship history, notes, assignments, and AI context.

## Success Criteria

- Mobile user can triage, read, note, assign, and reply one-handed without desktop-only panels.
- User opens a conversation and sees participant profile, prior history, notes, ownership, status, and next action.
- User can create internal notes on a thread; notes never enter outbound email.
- User can assign a conversation to a teammate and track reply/seen status.
- System auto-builds a contact graph from inbound/outbound email participants.
- AI/MCP tools can read the same social context but cannot send/delete without explicit approval.
- Existing send/receive/thread/search/attachment behavior remains intact.

## Strategic Scope

| Layer | Build | Why |
|---|---|---|
| Identity | Contact/profile graph derived from email addresses | Social graph starts with addresses already in mail |
| Conversation | Thread timeline with email + internal events | Email becomes a social room |
| Team state | assignee, status, seen, priority, tags | Shared inbox needs ownership |
| Notes | internal notes hidden from recipients | Core Intercom/Slack-like behavior |
| Context | profile panel + relationship history | Turns mail into CRM-ready network |
| AI safety | approval gates for social actions | Prevent silent destructive agent behavior |

## Non Goals

- Public social network.
- Consumer feed detached from email.
- Likes/reactions/followers before contact graph ships.
- Multi-tenant SaaS billing.
- Replacing Cloudflare Access in this phase.
- D1 rewrite. Keep Durable Object SQLite unless a later scale gate proves otherwise.

## Reference Repos

- `cloudflare/agentic-inbox`: base architecture, Apache-2.0.
- `cloudflare/agents`: human-in-loop tool approval, agent email routing, sub-agents.
- `ridvan/spinupmail`: inbox SDK, abuse/rate-limit, organization patterns.
- `agenticmail/agenticmail`: agent coordination via email, lazy MCP tool catalog.
- `hieunc229/mailflare`: study only; source-available, do not copy code.

## Architecture Direction

- Keep one `MailboxDO` per mailbox for core email rows.
- Add social tables to `MailboxDO` first: `contacts`, `conversation_state`, `internal_notes`, `conversation_events`.
- Use email address as external identity; use `contact_id` internally.
- Treat `thread_id` as the social conversation id for V1.
- Store only metadata/social state in SQLite; keep blobs in R2.
- Share business logic through `workers/lib/tools.ts` so UI, Agent, and MCP see the same rules.

## Mobile-First Product Rules

- Primary layout is a 3-screen mobile flow: `Inbox -> Conversation -> Context`.
- Desktop may show those screens side-by-side, but mobile owns the interaction model.
- Conversation screen must keep reply/note action reachable with a sticky bottom action bar.
- Context/profile lives in a bottom sheet or full-screen drill-in, not a permanent right rail on mobile.
- Thread list cards must show: contact, latest message, status, assignee, priority, needs-reply.
- Internal notes must be visually impossible to confuse with outbound email.
- No hover-only actions. Every action needs tap target >= 44px.
- Search and command should be reachable from top bar, not hidden in desktop sidebar.

## Phases

| Phase | Status | Progress | Output |
|---|---|---:|---|
| [Phase 01](./phase-01-social-domain-model.md) | completed | 100% | Social graph schema, migrations, tests |
| [Phase 02](./phase-02-conversation-state.md) | completed | 100% | Assignment/status/seen/reply state |
| [Phase 03](./phase-03-internal-notes-events.md) | completed | 100% | Internal notes + timeline events |
| [Phase 04](./phase-04-mobile-social-ui.md) | completed | 100% | Mobile-first social inbox, timeline, context sheet |
| [Phase 05](./phase-05-ai-mcp-social-context.md) | completed | 100% | AI/MCP social tools with private-context guardrails |
| [Phase 06](./phase-06-verification-ship.md) | completed | 100% | Tests, typecheck, build, MCP smoke, mobile visual smoke, live API internal delivery, note/state, and reply leak check passed |

## Plan Choice

Use `/plan:hard` because this touches data model, UI, agent tools, MCP, security, and product positioning.

Enhanced prompt used:

```text
Plan how to evolve ONYX into a private social network inside email with mobile as the primary UX. Preserve existing Cloudflare Workers + Durable Objects + R2 + React Router architecture. Do not implement. Design a phased plan where email identities become contact/profile nodes, email threads become social conversations, and the internal team can add notes, assignments, seen/reply status, tags, and AI-readable context without leaking internal metadata to external email recipients. The UI must work first as a mobile 3-screen flow: Inbox, Conversation, Context. Include safety gates for AI/MCP actions, responsive tests, and ship verification.
```

## Unresolved Questions

- Is first user group only `admin@onyx.com.vn` + privileged owner, or should this immediately support multiple teammates?
- Should "social graph" stay private CRM-style, or later expose a portal for external contacts?
- Which status taxonomy is default: `open / waiting / closed`, or sales-oriented `lead / nurturing / won / lost`?
