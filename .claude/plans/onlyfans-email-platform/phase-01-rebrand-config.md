# Phase 01: Rebrand + Config

## Context Links

- **plan.md**: Master plan
- **Phase depends on**: None (foundation)
- **Blocks**: All other phases

## Parallelization Info

- **Wave**: W1 (solo, must be first)
- **Parallel with**: Nothing — foundation layer
- **Estimated effort**: 6h

## Overview

Rename all `vsbg`/`vsbg.vn`/`VSBG Box` references to `onlyfans`/`onlyfans.vn`/`OnlyFans Email` across ~60 files. Update domain config, wrangler bindings, package metadata, CSP origins, public hostnames. This is purely cosmetic + config — zero behavioral changes.

## Requirements

### Functional

- [ ] All user-facing strings say "OnlyFans" instead of "VSBG"
- [ ] All domains changed from vsbg.vn → onlyfans.vn
- [ ] Wrangler DO class names stay same (no migration needed)
- [ ] R2 bucket renamed (new bucket, manual migration)
- [ ] Email routing domain updated
- [ ] Dev environment (.dev.vars) updated

### Non-Functional

- [ ] Build passes after rename: `pnpm build`
- [ ] Typecheck passes: `pnpm typecheck`
- [ ] Tests pass: `pnpm test`
- [ ] Zero behavioral changes — same routes, same APIs

## Architecture

### Files to modify (~60 files with "vsbg" references)

**Workers (back end) — ~15 files:**
| File | Changes |
|------|---------|
| `wrangler.jsonc` | name→onlyfans-box, routes→onlyfans.vn, R2 bucket→onlyfans-box, vars DOMAINS→onlyfans.vn |
| `wrangler.local.jsonc` | Sync with wrangler.jsonc |
| `workers/app.ts` | PUBLIC_HOSTNAMES: start.vsbg.vn→start.onlyfans.vn, CSP origins, MCP CORS origins |
| `workers/index.ts` | @vsbg.vn→@onlyfans.vn (signup validation), internal-only routing domain check |
| `workers/types.ts` | Comment updates only (no runtime impact) |
| `workers/lib/signup-*.ts` | Domain validation strings |
| `workers/lib/public-mailbox-profile.ts` | Comment/string updates |
| `workers/lib/access.ts` | Org member domain check strings |
| `workers/agent/index.ts` | Brand references in agent identity |
| `workers/mcp/index.ts` | MCP server name/description |
| `workers/db/*.ts` | Comment headers only |
| `workers/durableObject/*.ts` | Comment headers only |

**App (front end) — ~30 files:**
| File | Changes |
|------|---------|
| `app/root.tsx` | Title, meta tags, HTML lang, CSP nonce |
| `app/routes/landing.tsx` | Hero text, branding, footer |
| `app/routes/signup.tsx` | Domain hint text |
| `app/routes/home.tsx` | App title, header branding |
| `app/routes/settings.tsx` | Domain references |
| `app/routes/admin-*.tsx` | Admin page branding |
| `app/components/*.tsx` | UI strings (~15 component files) |
| `app/index.css` | Brand color reference (if any) |
| `app/queries/*.ts` | API endpoint comments |
| `app/services/api.ts` | Base URL patterns |

**Config files — ~5 files:**
| File | Changes |
|------|---------|
| `package.json` | name→onlyfans-box, cloudflare.label→OnlyFans Email |
| `pnpm-workspace.yaml` | (if project name referenced) |
| `.dev.vars.example` | Domain vars |
| `README.md` | Full rebrand of docs |
| `docs/*.md` | All documentation files |

**Tests — ~10 files:**
| File | Changes |
|------|---------|
| `tests/*.test.ts` | Test assertions with "vsbg.vn" email addresses |

### Migration steps for R2

1. Create new R2 bucket `onlyfans-box` via wrangler
2. Run `wrangler r2 object get vsbg-box <key>` → `wrangler r2 object put onlyfans-box <key>` for all objects
3. Delete old bucket after verification

## File Ownership (Phase 01 Exclusive)

| Category         | Files                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------- |
| wrangler config  | `wrangler.jsonc`, `wrangler.local.jsonc`                                                    |
| Worker entry     | `workers/app.ts`, `workers/index.ts`, `workers/types.ts`                                    |
| Worker libs      | `workers/lib/signup-*.ts`, `workers/lib/access.ts`, `workers/lib/public-mailbox-profile.ts` |
| Worker agent/MCP | `workers/agent/index.ts`, `workers/mcp/index.ts`                                            |
| Worker DB/DO     | `workers/db/*.ts`, `workers/durableObject/*.ts` (comments only)                             |
| App root/routes  | `app/root.tsx`, `app/routes/*.tsx`                                                          |
| App config       | `package.json`, `.dev.vars.example`, `README.md`, `docs/*.md`                               |
| Tests            | `tests/*.test.ts`                                                                           |

## Implementation Steps

1. **Update wrangler.jsonc** — name, routes, R2 bucket, DOMAINS var, EMAIL_ADDRESSES
2. **Create new R2 bucket** `onlyfans-box` with `wrangler r2 bucket create`
3. **Rename in workers/app.ts** — PUBLIC_HOSTNAMES, MCP CORS, comment headers
4. **Rename in workers/index.ts** — @vsbg.vn → @onlyfans.vn, domain checks
5. **Rename in all worker lib files** — string constants, domain checks
6. **Rename in all app route files** — UI strings, meta tags
7. **Rename in all app component files** — branded strings
8. **Rename package.json** — name, cloudflare.label
9. **Rename README.md + docs** — full rebrand
10. **Update tests** — email addresses, assertions
11. **Migrate R2 data** — copy bucket contents
12. **Verify**: `pnpm build && pnpm typecheck && pnpm test`

## Success Criteria

- [ ] `rg vsbg -l` returns ZERO results (case-insensitive)
- [ ] Zero results for `vsbg.vn` anywhere
- [ ] Build succeeds with new name: `wrangler deploy --dry-run`
- [ ] Tests pass with new domains
- [ ] R2 migration verified (object count matches)
- [ ] Development server starts on new config

## Conflict Prevention

- **Phase 01 owns ALL files during execution** — other phases wait
- No new files created — only find-and-replace in ~60 files
- After completion, other phases reference `onlyfans` names exclusively
- No Durable Object class renames (no SQLite migration)

## Risk Assessment

| Risk                    | Probability | Impact | Mitigation                                          |
| ----------------------- | ----------- | ------ | --------------------------------------------------- |
| Missed reference        | Medium      | Low    | `rg vsbg -l` exhaustive check                       |
| R2 migration timeout    | Low         | Medium | Use `wrangler r2 object list` + batch script        |
| Email routing break     | Low         | High   | Test with catch-all rule before cutover             |
| Build break from rename | Low         | Medium | Incremental: workers→app→config, rebuild after each |

## Security Considerations

- No security impact — purely cosmetic + config rename
- Ensure `.dev.vars` not committed with new domain secrets
- Cloudflare Access OTP list may need reconfig for new domain
