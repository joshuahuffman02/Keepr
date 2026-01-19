# Vercel Standards Checklist (Keepr)

This checklist tracks alignment with Vercel-grade monorepo standards for speed, reliability, and DX. Update status and notes after each phase.

## Scope
- Repo: Keepr monorepo
- Apps: `platform/apps/web`, `platform/apps/api`
- Shared packages: `platform/packages/*`
- Services: `platform/services/*`

## Status Legend
- Done
- In progress
- Planned
- Deferred

## Checklist
| Area | Current | Target | Owner | Timing | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| pnpm version | 9.15.9 toolchain | 9.15.9 + Corepack pinned | Platform | Phase 0 | Done | CI/Docker/docs updated |
| Turbo pipelines | Turbo build pipeline | Turbo build/test/lint pipelines | Platform | Phase 0 | Done | Build/lint/test/typecheck wired to Turbo |
| Build dependencies | Workspace-driven builds | Dependency-graph builds only | Platform | Phase 0 | Done | API/Web builds no longer run shared manually |
| Lockfile format | pnpm v9 lockfile | pnpm v9 lockfile | Platform | Phase 0 | Done | Regenerated with pnpm 9.15.9 |
| CI typecheck | CI runs `pnpm typecheck` | CI runs `pnpm typecheck` | Platform | Phase 1 | Done | `typecheck` job wired in `.github/workflows/ci.yml` |
| Rust verification | CI runs Rust tests | `cargo test` per service | Platform | Phase 1 | Done | `rust-tests` job covers all Rust services |
| Release hygiene | No changesets | Changesets for shared packages | Platform | Phase 1 | Done | `.changeset/` config + CI changeset check added |
| Lint/format stack | ESLint only, duplicate config | Single lint config (Biome or ESLint+Prettier) | Web | Phase 1 | Done | Kept `.eslintrc.cjs`, removed duplicate `.eslintrc.json` |
| API contract | OpenAPI spec + SDK types | Typed client + contract tests | API | Phase 2 | Done | OpenAPI-derived SDK types + contract test + web type-level contract checks |
| Feature flags | Admin CRUD only | Standard flag system | Platform | Phase 2 | Done | Authenticated flag evaluation endpoints (`/flags`) |
| Observability | Sentry in web + API, partial | OTel traces across web/API/Rust | Platform | Phase 2 | Done | Conventions doc + request ID propagation + log context fields + access logs + Rust request spans + API/Rust/Web OTel bootstrap |
| Health checks | Health + readiness endpoints | Health + readiness + SLO docs | Platform | Phase 2 | Done | API + Rust readiness endpoints documented in observability conventions |
| Deployment docs | Mixed references | Single source of truth | Platform | Phase 2 | Done | Vercel config + repo summary + architecture docs aligned |

## Next Actions
- Trigger CI to validate typecheck + Rust jobs.
- Decide on a unified lint/format stack.
