# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Campreserv (Keepr): Multi-tenant SaaS for campground, RV park, and lodging reservations. pnpm monorepo with NestJS API, Next.js frontend, and Rust microservices for critical paths.

## Critical Rules (Never Violate)

1. **Verify your work**: Run `pnpm build` + tests after changes
2. **Multi-tenant isolation**: Include `campgroundId` in ALL database queries
3. **Money in cents**: Use integers (`9999` = $99.99), never floats
4. **Validate everything**: Use Zod for user input, APIs, webhooks
5. **No emojis**: Use Lucide SVG icons
6. **No cron jobs**: Ask before adding `@Cron`/`@Interval` (Railway connection limits)

**Area-specific rules** auto-load from `.claude/rules/`:

- `api.md` - NestJS patterns, guards, DTOs, scheduled jobs
- `web.md` - React components, TanStack Query, hydration
- `prisma.md` - Schema, migrations, query patterns
- `payments.md` - Money handling, Stripe, ledger
- `rust.md` - Error handling, async, type safety

## Prerequisites

- Node 20+ (Prisma 7 requirement)
- pnpm 9.15.9 (`npm install -g pnpm@9.15.9`)

## Essential Commands

```bash
# Development
pnpm dev                    # Run both API (4000) + Web (3000)
pnpm api                    # API only
pnpm web                    # Web only

# Build (always run after changes)
pnpm build                  # Turbo build for shared, API, web, and packages

# Testing
pnpm test:api               # All API tests
pnpm test:api:path src/__tests__/reservations.spec.ts  # Single test file
pnpm --dir platform/apps/api test:smoke               # Smoke tests only
pnpm --dir platform/apps/web test                     # Web unit tests
pnpm --dir platform/apps/web test:e2e                 # Playwright E2E

# Database
pnpm --dir platform/apps/api prisma:generate   # After schema changes
pnpm --dir platform/apps/api prisma:migrate    # Run migrations
pnpm --dir platform/apps/api prisma:seed       # Seed sample data
pnpm --dir platform/apps/api prisma:studio     # Visual DB browser
pnpm prisma:reset-seed                         # Full reset + reseed

# Linting (pre-commit hook runs lint:web automatically)
pnpm lint:web               # Lint web app
pnpm lint:fix               # Auto-fix lint issues
```

## Project Structure

```
platform/
  apps/
    api/              # NestJS backend (port 4000)
    web/              # Next.js frontend (port 3000)
  services/
    auth-service-rs/  # Rust: Authentication (critical)
    payment-processor-rs/  # Rust: Payment processing
    availability-rs/  # Rust: Availability calculator
  packages/
    shared/           # Shared Zod schemas & types
    sdk/              # Client SDK
    integrations-sdk/
```

## Tech Stack

| Layer         | Technology                                       |
| ------------- | ------------------------------------------------ |
| Backend       | NestJS 10, Prisma 7, PostgreSQL                  |
| Rust Services | actix-web, sqlx, tokio (security-critical paths) |
| Frontend      | Next.js 14 (App Router), React 18, TailwindCSS   |
| Auth          | NextAuth 5 (beta), JWT (7-day expiry)            |
| Payments      | Stripe (connected accounts per campground)       |
| State         | TanStack Query (primary), SWR                    |
| UI            | Radix UI, shadcn/ui components                   |
| Monorepo      | pnpm workspaces                                  |

**When to use Rust vs TypeScript:**

- Rust: Payment processing, auth, availability, money calculations (if it compiles, it's correct)
- TypeScript: CRUD, admin dashboards, business logic, integrations

## Guardrails (Do Not Modify Without Approval)

1. **Prisma 7 Generator** - Must stay as `prisma-client-js`, uses `PrismaPg` adapter at runtime
2. **Build Tool** - API uses `tsup` (not `tsc`) - see `tsup.config.ts`
3. **Multi-tenant isolation** - Always scope queries by `campgroundId`

## Deployment

| Environment | Frontend                         | API                                   | Rust Services | Database           |
| ----------- | -------------------------------- | ------------------------------------- | ------------- | ------------------ |
| Production  | Vercel (`keeprstay.com`)         | Railway (`api.keeprstay.com`)         | Railway       | Supabase           |
| Staging     | Vercel (`staging.keeprstay.com`) | Railway (`api-staging.keeprstay.com`) | Railway       | Supabase (staging) |

**Branch strategy:** `feature/*` → PR to `staging` → merge → test → PR to `main` → production

**CI/CD:** GitHub Actions runs lint, test-api, test-sdk, build, e2e on PRs. See `docs/DEVELOPER_WORKFLOW.md`.

## Key File Locations

| Purpose        | Path                                     |
| -------------- | ---------------------------------------- |
| Prisma Schema  | `platform/apps/api/prisma/schema.prisma` |
| API Modules    | `platform/apps/api/src/[feature]/`       |
| API Entry      | `platform/apps/api/src/main.ts`          |
| Web API Client | `platform/apps/web/lib/api-client.ts`    |
| Web App Routes | `platform/apps/web/app/`                 |
| UI Components  | `platform/apps/web/components/ui/`       |
| Shared Schemas | `platform/packages/shared/src/index.ts`  |
| Auth Config    | `platform/apps/web/auth.ts`              |

---

## Domain Entities

```
Organization (multi-tenant root)
  └── Campground (individual property)
       ├── SiteClass (category: RV, Tent, Cabin)
       │    └── Site (bookable unit)
       ├── Guest (customer record)
       ├── Reservation (booking)
       │    └── Payment / LedgerEntry (financials)
       └── Product / StoreOrder (POS)
```

### Reservation Status Flow

```
pending → confirmed → checked_in → checked_out
    ↓
cancelled
```

### User Roles

| Role             | Scope      | Access               |
| ---------------- | ---------- | -------------------- |
| `platform_admin` | Platform   | All campgrounds      |
| `owner`          | Campground | Full access          |
| `manager`        | Campground | Operations           |
| `front_desk`     | Campground | Reservations, guests |
| `maintenance`    | Campground | Tickets only         |
| `finance`        | Campground | Reports, payments    |
| `readonly`       | Campground | View only            |

---

## Documentation

| When doing...         | Read...                        |
| --------------------- | ------------------------------ |
| Building new features | `docs/AI_FIRST_DEVELOPMENT.md` |
| Deploying / CI/CD     | `docs/DEVELOPER_WORKFLOW.md`   |
| Adding AI features    | `docs/OPENAI_INTEGRATION.md`   |
| Rust migration        | `docs/RUST_MIGRATION_PLAN.md`  |

## Known Issues

**In-memory state (not distributed):** Account lockout, scope cache, idempotency counters use `Map<>` - needs Redis for multi-instance.

**Stubbed features:** Gift card API, wallet debit, reminder email contain TODOs.

## Common Issues & Fixes

### "Cannot find module '@prisma/client'"

```bash
pnpm --dir platform/apps/api prisma:generate
```

### Type errors after schema change

```bash
pnpm build:shared && pnpm --dir platform/apps/api prisma:generate
```

### Port already in use

```bash
lsof -i :4000 && kill -9 <PID>
```

### Migration drift

```bash
DATABASE_URL="..." npx prisma migrate resolve --applied "migration_name"
```

---

## Verification by Feature Area

| Change Type      | Verification Command                           |
| ---------------- | ---------------------------------------------- |
| API changes      | `pnpm build:api`                               |
| Frontend changes | `pnpm build:web`                               |
| Schema changes   | `pnpm --dir platform/apps/api prisma:generate` |
| Shared types     | `pnpm build:shared`                            |
| Rust services    | `cargo check && cargo clippy && cargo test`    |
| Everything       | `pnpm build`                                   |

## Code Patterns

**Always do:**

- Null-check after `findUnique`/`findFirst`
- Normalize emails: `.trim().toLowerCase()`
- Include `campgroundId` in tenant-scoped queries
- Invalidate TanStack queries on mutation success
- Check `typeof window !== 'undefined'` before localStorage
- Use NestJS Logger (`this.logger.log()`), not console.log
- Add guards: `@UseGuards(JwtAuthGuard, RolesGuard)`
- Use specific exceptions: `BadRequestException`, `NotFoundException`
- Wrap risky ops in try/catch + `Sentry.captureException()`

**Ask before:**

- Adding new npm packages
- Adding `@Cron` or `@Interval` decorators

## Environment Variables

**API** (`platform/apps/api/.env`):

```
DATABASE_URL=postgresql://...
JWT_SECRET=...
STRIPE_SECRET_KEY=sk_...
REDIS_URL=redis://... (optional)
```

**Web** (`platform/apps/web/.env`):

```
NEXT_PUBLIC_API_BASE=http://localhost:4000/api
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=...
```

## Browser Automation

Use `agent-browser` for headless web automation and testing. Skill: `.claude/skills/agent-browser/`.

```bash
# Core workflow
agent-browser open <url>        # Navigate to page
agent-browser snapshot -i       # Get interactive elements with refs (@e1, @e2)
agent-browser click @e1         # Click by ref
agent-browser fill @e2 "text"   # Fill input by ref
agent-browser screenshot        # Capture page
agent-browser close             # Close browser
```

Binary location: `/Users/josh/.npm-global/bin/agent-browser`
