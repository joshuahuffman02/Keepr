# Repository Summary

Keepr is a pnpm 7.33.6 workspace that pairs a NestJS API (`platform/apps/api`) with a Next.js App Router web experience (`platform/apps/web`), shares typed helpers in `platform/packages/*`, and relies on Rust services (`platform/services/*`) for bounded-domain workloads such as availability, payments, and auth.

## Stack & Entry Points
- **Node & Tooling**: Node 22.x + pnpm 7.33.6 drives every package, with `concurrently` used for the combined dev run.
- **API**: `platform/apps/api/src/main.ts` boots NestJS, Prisma 7 handles `platform/apps/api/prisma/schema.prisma`, and generated clients are linked via `scripts/link-prisma-client.js`.
- **Web**: The App Router under `platform/apps/web/app` is the surface for marketing and dashboard routes, with shared UI in `platform/apps/web/components`.
- **Shared SDKs**: `platform/packages/shared`, `platform/packages/sdk`, and `platform/packages/integrations-sdk` expose types and helpers consumed by both apps and automations.
- **Rust Services**: `platform/services/{availability-rs,payment-processor-rs,auth-service-rs}` provide isolated workloads; they integrate with the API via HTTP or PostgreSQL-side channels.

## Tests, Lint, and Builds
- `pnpm --dir platform/apps/api test` / `pnpm --dir platform/apps/api test:smoke` (Jest).
- `pnpm --dir platform/apps/web test` (Vitest unit tests) and `pnpm --dir platform/apps/web test:e2e` (Playwright).
- SDK packages run via `pnpm --filter @keepr/sdk test` and `pnpm --filter @keepr/integrations-sdk test`.
- `pnpm lint:web` includes Next.js ESLint plus `scripts/check-no-any-no-assert.js`, and `pnpm lint:fix` applies fixes.
- `pnpm build` chains `build:shared`, `build:api`, and `build:web`; the API build also regenerates Prisma client (`pnpm --dir platform/apps/api prisma:generate`).

## Dev & Deployment Commands
- `pnpm api` / `pnpm web` start each service individually; `pnpm dev` runs both with `concurrently`.
- `pnpm prisma:reset-seed` resets migrations, generates Prisma client, and seeds optional data.
- CI helpers include `pnpm ci`, `pnpm ci:sdk`, and `pnpm ci:e2e` for linting, API smoke tests, SDK tests, builds, budgets, and Playwright runs.
- Deployments use Dockerfiles at the root and inside `platform/services/*`, and `vercel.json` maps `/api/*` to the NestJS serverless bundle while serving the web app from `platform/apps/web`.

## Environment
- `platform/apps/api/.env` needs `PLATFORM_DATABASE_URL`, optional `PLATFORM_REDIS_URL`, and `JWT_SECRET`.
- `platform/apps/web/.env` sets `NEXT_PUBLIC_API_BASE`, `NEXTAUTH_URL`, and `NEXTAUTH_SECRET`.
- Copy `.env.example` files in each app directory before running dev or build commands; secrets should live outside the repo.

## Reference Notes
- Prisma seeds live alongside migrations under `platform/apps/api/prisma`; seeds must be executed manually (`pnpm --dir platform/apps/api prisma:seed`).
- Shared UI and logic should avoid `any` and type assertions due to web ESLint; `scripts/check-no-any-no-assert.js` catches violations.
- Use this document as the first-read reference before consulting deeper guides such as `docs/DEVELOPER_WORKFLOW.md` or service-specific runbooks.

## Living documentation
- `docs/architecture.mmd` keeps a quick visual of how Nest APIs, Rust services, and Next.js pages fit together; update it whenever you move or rename major entry points.
- `docs/frontend.mmd` captures UX-level patterns (navigation regions, content bundles, shared contexts) so marketers and designers can see how new pages should connect.
- Before touching API/Web/shared code, add or refresh an entry in `docs/exec_plans.md` so multi-system tickets document scope, verification commands, and follow-ups; bump this summary at the same time.

## Next steps
- Keep `docs/architecture.mmd`, `docs/frontend.mmd`, and `docs/exec_plans.md` aligned whenever directory structure or tooling commands change.
- Capture any significant new commands or environment updates here so new sessions can skip discovery.
