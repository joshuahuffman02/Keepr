# Repository Summary

Keepr is a pnpm 9.15.9 workspace that pairs a NestJS API (`platform/apps/api`) with a Next.js App Router web experience (`platform/apps/web`), shares typed helpers in `platform/packages/*`, and relies on Rust services (`platform/services/*`) for bounded-domain workloads such as availability, payments, and auth.

## Stack & Entry Points

- **Node & Tooling**: Node 22.x + pnpm 9.15.9 drive every package, Turbo handles cached build pipelines, and `concurrently` runs the combined dev loop.
- **Ralph Loop**: `tools/ralph` provides the iteration harness CLI, configured via `ralph.config.json`, with state stored in `.ralph/state.json`.
- **API**: `platform/apps/api/src/main.ts` boots NestJS, Prisma 7 handles `platform/apps/api/prisma/schema.prisma`, and generated clients are linked via `scripts/link-prisma-client.js`.
- **Web**: The App Router under `platform/apps/web/app` is the surface for marketing and dashboard routes, with shared UI in `platform/apps/web/components`.
- **Shared SDKs**: `platform/packages/shared`, `platform/packages/sdk`, and `platform/packages/integrations-sdk` expose types and helpers consumed by both apps and automations.
- **Rust Services**: `platform/services/{availability-rs,payment-processor-rs,auth-service-rs}` provide isolated workloads; they integrate with the API via HTTP or PostgreSQL-side channels.

## Tests, Lint, and Builds

- `pnpm --dir platform/apps/api test` / `pnpm --dir platform/apps/api test:smoke` (Jest; default run-in-band, set `JEST_RUN_IN_BAND=false` and/or `JEST_MAX_WORKERS` to override).
- `pnpm --dir platform/apps/web test` (Vitest unit tests) and `pnpm --dir platform/apps/web test:e2e` (Playwright).
- SDK packages run via `pnpm --filter @keepr/sdk test` and `pnpm --filter @keepr/integrations-sdk test`.
- OpenAPI types for the SDK are generated from `platform/apps/api/openapi.json` with `pnpm --dir platform/packages/sdk openapi:types` (ensure the API spec is current via `pnpm --dir platform/apps/api openapi:generate`).
- `pnpm lint` runs Turbo lint plus `scripts/check-no-any-no-assert.js`; `pnpm lint:web` keeps the web-only lint flow.
- `pnpm format` runs Prettier across the repo, then applies ESLint fixes for the web app.
- `pnpm typecheck` runs Turbo typecheck across packages; `pnpm test` runs Turbo test for all packages with test scripts.
- `pnpm changeset` captures release notes for `platform/packages/*`; `pnpm changeset:version` applies version bumps.
- `pnpm smoke` runs `scripts/smoke.js` to verify Ralph scaffolding.
- `pnpm build` runs Turbo build pipelines across packages; the API build regenerates the Prisma client before `nest build`.

## Dev & Deployment Commands

- `pnpm api` / `pnpm web` start each service individually; `pnpm dev` runs both with `concurrently`.
- `ralph init`, `ralph run`, `ralph resume`, `ralph status`, `ralph reset` manage iterative agent runs (see `tools/ralph`).
- `pnpm prisma:reset-seed` resets migrations, generates Prisma client, and seeds optional data.
- CI helpers include `pnpm ci`, `pnpm ci:sdk`, and `pnpm ci:e2e` for linting, API smoke tests, SDK tests, builds, budgets, and Playwright runs.
- Deployments use Dockerfiles at the root and inside `platform/services/*`; Vercel builds the Next.js app via `vercel.json` from the workspace, the API runs on Railway, Rust services run on Railway, and `/api/*` requests are proxied by Next.js rewrites to the backend defined by `NEXT_PUBLIC_API_BASE`.
- `scripts/status.sh` prints the local Codex model/sandbox snapshot; `/status` can be symlinked to it for agent workflow parity.

## Environment

- `platform/apps/api/.env` needs `PLATFORM_DATABASE_URL`, optional `PLATFORM_REDIS_URL`, `JWT_SECRET`, and optional `OTEL_ENABLED`/`OTEL_EXPORTER_OTLP_ENDPOINT` for API + Rust tracing.
- `platform/apps/web/.env` sets `NEXT_PUBLIC_API_BASE`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, and optional `OTEL_ENABLED`/`OTEL_EXPORTER_OTLP_ENDPOINT` for tracing.
- Copy `.env.example` files in each app directory before running dev or build commands; secrets should live outside the repo.
- Supabase project: https://supabase.com/dashboard/project/qmtfiytfdclikdkdaqvi

## Reference Notes

- Prisma seeds live alongside migrations under `platform/apps/api/prisma`; seeds must be executed manually (`pnpm --dir platform/apps/api prisma:seed`).
- Prisma migrations run inside transactions; any `CREATE INDEX CONCURRENTLY` statements must be executed manually and documented (see migration notes in `platform/apps/api/prisma/migrations/*`).
- Swagger/OpenAPI: the unused public campgrounds search handler is intentionally hidden from Swagger to avoid collisions with the list endpoint; keep it hidden unless you move it to a distinct path (for example, `/public/campgrounds/search`) and document it separately.
- Shared UI and logic should avoid `any` and type assertions due to web ESLint; `scripts/check-no-any-no-assert.js` catches violations.
- Use this document as the first-read reference before consulting deeper guides such as `docs/DEVELOPER_WORKFLOW.md` or service-specific runbooks.

## Living documentation

- `docs/architecture.mmd` keeps a quick visual of how Nest APIs, Rust services, and Next.js pages fit together; update it whenever you move or rename major entry points.
- `docs/frontend.mmd` captures UX-level patterns (navigation regions, content bundles, shared contexts) so marketers and designers can see how new pages should connect.
- Before touching API/Web/shared code, add or refresh an entry in `docs/exec_plans.md` so multi-system tickets document scope, verification commands, and follow-ups; bump this summary at the same time.
- `docs/target-architecture.md`, `docs/runtime-tier-map.md`, and `docs/migration-plan-best-end-state.md` define the long-term platform direction and should be reviewed alongside architecture changes.
- `docs/changesets.md` documents release hygiene for shared packages, and `docs/observability-conventions.md` defines tracing/logging/health conventions.

## Next steps

- Keep `docs/architecture.mmd`, `docs/frontend.mmd`, and `docs/exec_plans.md` aligned whenever directory structure or tooling commands change.
- Capture any significant new commands or environment updates here so new sessions can skip discovery.
