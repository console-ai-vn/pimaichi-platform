# ONYX Docs

> **ONYX** ? self-hosted email client on Cloudflare Workers, with an AI agent and MCP server. Operated by ONYX on `onyx.com.vn`.

## Index

| File | Purpose | Audience |
|---|---|---|
| [`project-overview-pdr.md`](./project-overview-pdr.md) | Product scope, what V1.5 ships, functional & non-functional requirements, acceptance criteria. | PM, new dev, AI agent |
| [`codebase-summary.md`](./codebase-summary.md) | Tech stack, file tree, key modules, naming conventions, build/test commands. | New dev, AI agent |
| [`code-standards.md`](./code-standards.md) | TypeScript, imports, components, state, forms, API client, security, code-style rules. | Contributor |
| [`system-architecture.md`](./system-architecture.md) | High-level diagram, data flow, DB schema, bindings, auth flow, feature flags, known TODOs. | Tech lead, AI agent |
| [`project-roadmap.md`](./project-roadmap.md) | Current state, shipped features, V2/V3 backlog, tech debt to fix. | PM, contributor |
| [`deployment-guide.md`](./deployment-guide.md) | End-to-end deploy walkthrough: R2, Email Routing, Email Service, Access, secrets, deploy. | DevOps, solo dev |
| [`design-guidelines.md`](./design-guidelines.md) | UI/UX conventions, Kumo tokens, components, Vietnamese copy patterns, mobile rules. | Designer, FE dev |
| `plans/260602-metro-mail-v1/` | V1 build plan, phases, reports (read-only). | Historical |
| `plans/260605-email-social-network/` | Social email MVP plan, phases, reports (read-only). | Historical |

## Reading order for a new dev

1. **Root [`README.md`](../README.md)** ? what the product is, how to run it locally.
2. **`codebase-summary.md`** ? what tech, what files, where things live.
3. **`system-architecture.md`** ? how it fits together, where the data goes.
4. **`code-standards.md`** ? how to write code that matches.
5. **`design-guidelines.md`** ? how to write UI that matches.
6. **`deployment-guide.md`** ? when you need to ship.
7. **`project-overview-pdr.md`** + **`project-roadmap.md`** ? what to build next.

## Conventions used across all docs

- File/line references use `path:line` (e.g. `workers/durableObject/index.ts:1100`).
- Cloudflare primitives written in **bold** on first use: **Durable Object**, **Workers AI**, **R2**, **Email Routing**, **Email Service**.
- Feature scope is **V1.5** (formerly "V2-deferred"): social graph, conversation state, internal notes, internal-only delivery are all shipped ? not backlog.
- "SHIPPED" / "V1.5" / "V2" / "V3" / "Phase 02" / "Phase 05" refer to the rows in [`project-roadmap.md`](./project-roadmap.md) ? Current state.
