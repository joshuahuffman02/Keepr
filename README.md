# Campreserv (platform monorepo)

pnpm workspace with NestJS API (`platform/apps/api`) and Next.js web (`platform/apps/web`).

## Prereqs

- Node 20+ required (Prisma 7)
- pnpm (install locally if not already: `npm install -g pnpm`)

## Setup

1. Install deps

```bash
pnpm install
```

2. Environment

- API: copy `platform/apps/api/.env.example` to `platform/apps/api/.env` and set `PLATFORM_DATABASE_URL` (Postgres), `PLATFORM_REDIS_URL` (optional), `JWT_SECRET`.
- Web: copy `platform/apps/web/.env.example` to `platform/apps/web/.env` and set `NEXT_PUBLIC_API_BASE`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`.

3. Database (API)

```bash
pnpm --dir platform/apps/api prisma:generate
pnpm --dir platform/apps/api prisma:migrate
pnpm --dir platform/apps/api prisma:seed   # optional sample data
```

If your dev DB gets out of sync, reset + reseed:

```bash
pnpm prisma:reset-seed
```

4. Run dev servers

- API: `pnpm --dir platform/apps/api dev` (port 4000)
- Web: `pnpm --dir platform/apps/web dev` (port 3000)
- Both: `pnpm dev` (root, uses concurrently)

## Build & test

- Lint web: `pnpm --dir platform/apps/web lint`
- API smoke tests: `pnpm --dir platform/apps/api test:smoke`
- Build all: `pnpm build`

## Commands reference

- Dev (API + web): `pnpm dev`
- Build: `pnpm build`
- Test (API): `pnpm --dir platform/apps/api test`
- Lint: `pnpm lint:web`
- Format/fix: `pnpm format`
- E2E (web): `pnpm --dir platform/apps/web test:e2e`

## Notes

- Prisma schema and seeds live in `platform/apps/api/prisma/`.
- Prisma 7 uses Postgres driver adapters at runtime; follow existing `PrismaService` patterns for any new DB scripts.
- Seeds are manual in Prisma 7 (they do not auto-run after migrations).
- Shared types live in `platform/packages/shared`.
- SDK lives in `platform/packages/sdk`.

## Vercel Deployment

**Required Vercel Project Settings:**

- **Root Directory**: Leave blank (or `.`) - must be repo root, not a subdirectory
- **Node.js Version**: `20.x` (Prisma 7 requires Node 20+)
- **Framework Preset**: Other (auto-detected as `null` in vercel.json)

The root `vercel.json` handles:

- `/api/*` routes → NestJS serverless function (`platform/apps/api/dist/serverless.js`)
- All other routes → Next.js web app (`platform/apps/web`)
