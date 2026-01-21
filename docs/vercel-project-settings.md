# Vercel Project Settings (Keepr Web)

Use these settings for the web app project in Vercel.

## Project Settings
- Root Directory: `platform/apps/web`
- Framework Preset: Next.js
- Install Command: `pnpm install --frozen-lockfile`
- Build Command: `pnpm --filter @keepr/shared build && pnpm --filter @keepr/sdk build && pnpm --filter @keepr/web build`
- Output Directory: `.next`

## Environment Variables
- See `platform/apps/web/.env.example` for required + optional web env vars.

## Notes
- The repo root `vercel.json` targets `platform/apps/web/.next` for root-based builds; the app-level `platform/apps/web/vercel.json` uses `.next`.
- If Vercel UI settings override `vercel.json`, align them with the values above.

## Turbo Remote Cache
- Enable Turborepo Remote Cache in the Vercel project settings (Build & Development).
- For local/CI cache usage, set `TURBO_TEAM` and `TURBO_TOKEN` (generate via `npx turbo login`).
