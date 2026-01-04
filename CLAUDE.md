# Campreserv - Claude Code Configuration

Campground reservation management platform. Multi-tenant SaaS for campgrounds, RV parks, and lodging.

## Quick Start (Read This First!)

**Working on specific areas? Load the right skill:**
- API/Backend (Node) → Use `nestjs-api` skill
- API/Backend (Rust) → Reference `.claude/rules/rust.md`
- Frontend/UI → Use `ui-development` skill
- Database → Use `prisma-database` skill
- Payments → Reference `.claude/rules/payments.md`

**Critical rules (never violate these):**
1. ✅ Always verify your work: Run `pnpm build` + tests after changes
2. ✅ Use Plan mode (shift+tab 2x) for multi-file changes
3. ✅ Multi-tenant: Include `campgroundId` in ALL queries
4. ✅ Money: Use integers for cents (`9999` = $99.99), validate with Zod
5. ✅ Icons: Use Lucide SVG, never emojis
6. ✅ Validate all external data with Zod (user input, APIs, webhooks)

**Development commands:**
```bash
pnpm dev                    # Run both API + Web
pnpm build                  # Build and verify everything works
pnpm test                   # Run all tests
pnpm --dir platform/apps/api prisma:generate  # After schema changes
```

**AI-First Safety Net:**
- 🛡️ **Zod** - Runtime validation (catches bad data)
- 🔍 **Sentry** - Error tracking (know when things break)
- ✅ **Vitest** - Automated testing (catch bugs before deploy)
- 🎭 **Playwright** - E2E testing (test like a user)

See `docs/AI_FIRST_DEVELOPMENT.md` for complete guide.

## Project Structure

```
platform/
  apps/
    api/          # NestJS backend (port 4000)
    web/          # Next.js frontend (port 3000)
  packages/
    shared/       # Shared Zod schemas & types
    sdk/          # Client SDK
    integrations-sdk/
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | NestJS 10, Rust (critical services), Prisma 7, PostgreSQL |
| Frontend | Next.js 14 (App Router), React 18, TailwindCSS |
| Auth | NextAuth 5 (beta), JWT (7-day expiry) |
| Payments | Stripe (connected accounts per campground) |
| State | TanStack Query (primary), SWR |
| UI | Radix UI, shadcn/ui components |
| Monorepo | pnpm workspaces |

**Rust services (planned):**
- Payment processing (security-critical)
- Availability calculator (complex logic)
- Authentication (critical)
- Math-heavy features (pricing, calculations)

## Quick Commands

```bash
# Development
pnpm dev                    # Run both API + Web concurrently
pnpm api                    # API only (port 4000)
pnpm web                    # Web only (port 3000)

# Database
pnpm --dir platform/apps/api prisma:generate   # Generate Prisma client
pnpm --dir platform/apps/api prisma:migrate    # Run migrations
pnpm --dir platform/apps/api prisma:seed       # Seed sample data
pnpm --dir platform/apps/api prisma:studio     # Open Prisma Studio
pnpm prisma:reset-seed                         # Full reset + reseed

# Build
pnpm build                  # Build all (shared -> API -> Web)
pnpm build:shared           # Build shared package only
pnpm build:api              # Build API only
pnpm build:web              # Build Web only

# Testing
pnpm test:api               # Run API tests
pnpm --dir platform/apps/api test:smoke    # Smoke tests only
pnpm lint:web               # Lint web app
```

---

## CRITICAL GUARDRAILS

**DO NOT modify these without explicit approval:**

1. **Prisma 7 Generator** - Must stay as `prisma-client-js`, uses `PrismaPg` adapter at runtime
2. **Build Tool** - API uses `tsup` (not `tsc`) - see `tsup.config.ts`
3. **Multi-tenant isolation** - Always scope queries by `campgroundId`
4. **Money in cents** - All amounts are integers (e.g., `9999` = $99.99)
5. **No emojis** - Use Lucide SVG icons instead (professional and scalable)
6. **Dockerfiles** - DO NOT modify or rename these files:
   - `Dockerfile` = API service (NestJS)
   - `Dockerfile.web` = Web service (Next.js)
7. **railway.toml** - DO NOT add `dockerfilePath` - each Railway service configures this in dashboard

---

## Code Patterns

Detailed coding patterns are in `.claude/rules/`:
- **API (NestJS)**: `.claude/rules/api.md` - Services, controllers, DTOs, auth guards
- **API (Rust)**: `.claude/rules/rust.md` - Safety-critical code, error handling, async
- **Frontend (Next.js)**: `.claude/rules/web.md` - Components, queries, forms, accessibility
- **Prisma**: `.claude/rules/prisma.md` - Schema changes, migrations, query patterns
- **Payments**: `.claude/rules/payments.md` - Money handling, Stripe, ledger entries

These rules are automatically loaded when working in the relevant directories.

**When to use Rust vs TypeScript:**
- 🦀 **Rust** → Payment processing, auth, availability calculator, anything with money/security
- 📘 **TypeScript** → CRUD operations, admin dashboards, business logic, integrations

---

## Key File Locations

| Purpose | Path |
|---------|------|
| Prisma Schema | `platform/apps/api/prisma/schema.prisma` |
| API Modules | `platform/apps/api/src/[feature]/` |
| API Entry | `platform/apps/api/src/main.ts` |
| Web API Client | `platform/apps/web/lib/api-client.ts` |
| Web App Routes | `platform/apps/web/app/` |
| UI Components | `platform/apps/web/components/ui/` |
| Shared Schemas | `platform/packages/shared/src/index.ts` |
| Auth Config | `platform/apps/web/auth.ts` |

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
| Role | Scope | Access |
|------|-------|--------|
| `platform_admin` | Platform | All campgrounds |
| `owner` | Campground | Full access |
| `manager` | Campground | Operations |
| `front_desk` | Campground | Reservations, guests |
| `maintenance` | Campground | Tickets only |
| `finance` | Campground | Reports, payments |
| `readonly` | Campground | View only |

---

## Important Documentation

**AI-First Development:**
- `docs/AI_FIRST_DEVELOPMENT.md` - Complete guide to Zod, Sentry, Testing
- `docs/RUST_MIGRATION_PLAN.md` - Plan for migrating to Rust
- `docs/RAILWAY_BACKUP_SETUP.md` - Database backup setup ($5/month)
- `docs/OPENAI_INTEGRATION.md` - OpenAI + pgvector semantic search

**Read these when:**
- Building new features → AI_FIRST_DEVELOPMENT.md
- After first customers → RUST_MIGRATION_PLAN.md
- Before deploying → RAILWAY_BACKUP_SETUP.md
- Adding AI features → OPENAI_INTEGRATION.md

## Known Issues & Technical Debt

### Pending External Integrations
- **OTA providers** (Airbnb, Booking.com) - awaiting API credentials
- **Currency/FX rates** - needs OpenExchangeRates or XE.com integration
- **RV Life reviews** - API not yet documented
- **SMS failover** - single Twilio provider only

### In-Memory State (Not Distributed)
- Account lockout uses `Map<>` (TODO: migrate to Redis)
- Scope cache uses in-memory Map with 5000 entry limit
- Idempotency counters use memory with expiry cleanup

### Frontend TODOs
- Gift card API integration stubbed in PaymentCollectionModal
- Wallet debit API not implemented
- Reminder email shows `alert("TODO")`

---

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

## Workflow & Verification (CRITICAL)

### Step-by-Step Process for ALL Tasks

1. **Understand First**
   - Read relevant files completely before making changes
   - Check Prisma schema for data model context
   - Look at similar features to understand patterns
   - Ask clarifying questions if requirements are unclear

2. **Plan the Work**
   - For multi-step tasks, create a todo list with TodoWrite
   - Mark tasks as in_progress BEFORE starting work
   - Only ONE task should be in_progress at a time

3. **Make Changes**
   - Follow existing code patterns
   - Apply rules from .claude/rules/ directory
   - Keep changes minimal and focused

4. **VERIFY YOUR WORK** (This is the most important step!)
   - Run `pnpm build` to check for compile errors
   - For API changes: manually test the endpoint works
   - For DB changes: run `pnpm --dir platform/apps/api prisma:generate`
   - For frontend: check that the UI renders without errors
   - Check that you completed ALL parts of the task

5. **Mark Complete**
   - Only mark todo items as completed when FULLY done
   - If you encounter errors or blockers, keep it in_progress
   - Report any issues you couldn't resolve

### Verification Commands by Feature Area

| Change Type | Verification Command |
|-------------|---------------------|
| API changes | `pnpm build:api` |
| Frontend changes | `pnpm build:web` |
| Schema changes | `pnpm --dir platform/apps/api prisma:generate` |
| Shared types | `pnpm build:shared` |
| Everything | `pnpm build` |

### Never Skip These Steps

- Don't skip verification - always check your work compiles
- Don't skip reading files before editing them
- Don't skip marking todos as complete when done
- Don't skip asking questions when unclear
- Don't assume code works without verifying

### When to Use Plan Mode

**Use Plan mode (shift+tab twice in Claude Code) for:**
- Multi-file changes (3+ files)
- New feature implementation
- Architectural changes
- Database schema modifications
- Anything you're uncertain about

**Plan mode workflow:**
1. Enter Plan mode at the start
2. Explore the codebase and design an approach
3. Iterate on the plan with the user until it's solid
4. Exit Plan mode and implement (can use auto-accept edits)
5. Verify the implementation works

**A good plan is critical** - investing time upfront prevents wasted work.

### Advanced Workflows

**Parallel Execution:**
- Run multiple Claude sessions in parallel for faster iteration
- Use numbered terminal tabs (1-5) to track sessions
- Hand off between local CLI and claude.ai/code using `&` or `--teleport`
- Start sessions from mobile and check in later

**Hooks for Auto-Verification:**
Configure `.claude/hooks.json` to automatically verify work:
```json
{
  "postToolUse": {
    "Edit": "pnpm build",
    "Write": "pnpm build"
  }
}
```

**Verification Subagent:**
For long-running tasks, use a background agent to verify:
- Create `.claude/agents/verify-app.md` with testing steps
- Invoke with: `Task(subagent_type="verify-app")`
- Or use a Stop hook to run verification automatically

## Code Generation Rules

1. **Always null-check** after `findUnique` / `findFirst`
2. **Normalize strings** with `.trim().toLowerCase()` for emails
3. **Use specific exceptions** (BadRequest, NotFound, etc.)
4. **Include campgroundId** in all tenant-scoped queries
5. **Invalidate queries** on mutation success
6. **Check `typeof window`` before localStorage access

## Preferred Patterns (Do These)

- **Validation**: Always use Zod for money, user input, and external data
- **Logging**: Use NestJS Logger (`this.logger.log()`) instead of console.log
- **Money**: Use integers for cents (`9999` = $99.99) + Zod validation
- **Auth**: Add guards to all endpoints (`@UseGuards(JwtAuthGuard, RolesGuard)`)
- **Testing**: Write tests for critical features (payments, auth, reservations)
- **Transactions**: Use single transaction with callback pattern, not nested
- **Dependencies**: Ask before adding new packages
- **Icons**: Use Lucide SVG icons, never emojis
- **Verification**: Always run build + tests after changes
- **Error Tracking**: Wrap risky operations in try/catch + Sentry.captureException()

---

## Environment Variables

### API (.env)
```
DATABASE_URL=postgresql://...
JWT_SECRET=...
STRIPE_SECRET_KEY=sk_...
REDIS_URL=redis://... (optional)
```

### Web (.env)
```
NEXT_PUBLIC_API_BASE=http://localhost:4000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=...
```

---

## Deployment

- **Platform**: Railway (auto-deploy on push to main)
- **Database**: Railway PostgreSQL
- **Build**: `tsup` for API, `next build` for Web
- **Health check**: `GET /health` returns `{ status: "ok" }`
