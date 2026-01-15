# Execution Planning Template

Use this guide when a request spans hours or touches multiple systems (API, web, shared packages, or Rust services). Capture enough detail so reviewers can understand scope, risks, and how correctness will be proved before editing code or docs.

## Structure
1. **Objective** – One sentence on the outcome (e.g., “Add campaign landing route and hook it up to Prisma-based reservations”).
2. **Background** – Dependencies, related tickets, architecture notes, or previous work.
3. **Scope** – APIs, services, and directories that will be touched; call out what will stay untouched.
4. **Steps** – Ordered checklist (analysis → implementation → tests) with owners if the work will be split.
5. **Risks & Mitigations** – Identify unstable dependencies (Prisma migrations, shared SDK safety, Rust rebuild time) and how you will guard against regression.
6. **Verification** – List exact commands to run before claiming success (e.g., `pnpm --dir platform/apps/api test:smoke`, `pnpm --dir platform/apps/web test`, `pnpm lint:web`, `pnpm --dir platform/apps/web test:e2e`, `pnpm ci:sdk`). Cloud runs should repeat these commands in CI if possible.
7. **Documentation / Follow-up** – Note which docs to update (this folder, service runbooks, alerts) and whether new env vars, migrations, or release notes are required.

## Example
- Objective: “Expose reservation stats via API and show widget on marketing homepage.”
- Background: link to `docs/roadmap-public.md` and note Prisma schema used by `platform/apps/api/prisma/reservations`.
- Scope: update `platform/apps/api/src/reservations`, add new Next.js route under `platform/apps/web/app/reservations`, extend shared type in `platform/packages/shared`.
- Steps:
  1. Draft API contract and Prisma query.
  2. Implement resolver and add tests.
  3. Wire up web route/component and run Vitest/Playwright.
  4. Update docs and changelog.
- Risks: Prisma migration drift → run `pnpm --dir platform/apps/api prisma:migrate dev`.
- Verification: run the lint/test commands above plus `pnpm build` if the change touches shared packages; confirm `pnpm --dir platform/apps/web budgets`.

Keep this template near the top of any large task PR so reviewers immediately understand how the work was validated.

## Recent living-doc updates
- **2026-01-12**: `docs/repo_summary.md` now highlights `docs/architecture.mmd`, `docs/frontend.mmd`, and this `docs/exec_plans.md` file as the go-to living references for architecture, UX, and cross-system execution plans; refresh all three whenever a major entry point, environment, or verification command changes.
