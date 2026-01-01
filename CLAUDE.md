# Campreserv - Claude Code Configuration

Campground reservation management platform. Multi-tenant SaaS for campgrounds, RV parks, and lodging.

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
| Backend | NestJS 10, Prisma 7, PostgreSQL |
| Frontend | Next.js 14 (App Router), React 18, TailwindCSS |
| Auth | NextAuth 5 (beta), JWT (7-day expiry) |
| Payments | Stripe (connected accounts per campground) |
| State | TanStack Query (primary), SWR |
| UI | Radix UI, shadcn/ui components |
| Monorepo | pnpm workspaces |

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

## Database & API Generation

This project uses SchemaForge for schema-driven development.

### Workflow
1. Define/modify data models in `schema.forge`
2. Run `npx schemaforge generate` to regenerate all code
3. Run `npx schemaforge migrate push` to update the database (dev)
4. Run `npx schemaforge seed` to populate test data

### Schema Location
- Schema file: `schema.forge`
- Generated code: `./generated/`

### Key Commands
```bash
npx schemaforge generate          # Regenerate all code from schema
npx schemaforge diff              # Preview changes before regenerating
npx schemaforge migrate push      # Push schema to database (dev)
npx schemaforge migrate create    # Create migration file (prod)
npx schemaforge seed              # Generate and run test data
```

### Schema Syntax
```
model Post @softDelete {
  id        String   @id @default(uuid)
  title     String   @min(1) @max(200)
  content   String?  @ui(inputType: "textarea")
  published Boolean  @default(false)
  author    User     @relation(fields: [authorId], references: [id])
  authorId  String
  createdAt DateTime @default(now)
}
```

### Available Attributes
- `@id` - Primary key
- `@default(uuid|now|value)` - Default values
- `@unique` - Unique constraint
- `@softDelete` - Model-level soft delete
- `@ui(inputType, label, placeholder)` - Form hints
- `@min(n)` / `@max(n)` - Validation

**DO NOT manually edit files in `./generated/` - they will be overwritten.**

---

## CRITICAL GUARDRAILS

**DO NOT modify these without explicit approval:**

1. **Prisma 7 Generator** - Must stay as `prisma-client-js`, uses `PrismaPg` adapter at runtime
2. **Build Tool** - API uses `tsup` (not `tsc`) - see `tsup.config.ts`
3. **Multi-tenant isolation** - Always scope queries by `campgroundId`
4. **Money in cents** - All amounts are integers (e.g., `9999` = $99.99)
5. **NO EMOJIS EVER** - Never use emojis anywhere in this project:
   - No emojis in code (comments, strings, variables)
   - No emojis in markdown files
   - No emojis in frontend UI text
   - Use SVG icons instead for visual elements (Lucide icons are preferred)
   - SVGs are professional and scalable; emojis are not

---

## API Patterns (NestJS)

### Transaction Pattern
```typescript
// CORRECT - async callback with tx parameter
await this.prisma.$transaction(async (tx) => {
  const reservation = await tx.reservation.create({ ... });
  await tx.payment.create({ data: { reservationId: reservation.id, ... } });
});

// CORRECT - array pattern for simple independent operations
await this.prisma.$transaction([
  this.prisma.guest.update({ ... }),
  this.prisma.payment.create({ ... })
]);

// WRONG - never nest transactions or call $transaction on tx
```

### Exception Hierarchy
```typescript
// Use these NestJS exceptions (most common first):
throw new BadRequestException("Invalid input");      // 400 - validation failures
throw new NotFoundException("Resource not found");   // 404 - missing records
throw new ConflictException("Already exists");       // 409 - duplicates
throw new ForbiddenException("Access denied");       // 403 - permission denied
throw new UnauthorizedException("Not authenticated"); // 401 - auth failures
```

### Service Pattern
```typescript
@Injectable()
export class FeatureService {
  private readonly logger = new Logger(FeatureService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDto) {
    // 1. Validate existence
    const existing = await this.prisma.model.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Not found");

    // 2. Check business rules
    if (!existing.isActive) throw new BadRequestException("Inactive");

    // 3. Normalize inputs
    const normalizedEmail = dto.email.trim().toLowerCase();

    // 4. Execute with defaults
    return this.prisma.model.create({
      data: { ...dto, status: "active", createdAt: new Date() }
    });
  }
}
```

### Controller Pattern
```typescript
@Controller('campgrounds/:campgroundId/resources')
@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
export class ResourceController {
  constructor(private readonly service: ResourceService) {}

  @Get()
  @Roles(UserRole.manager, UserRole.owner)
  async list(@Param('campgroundId') campgroundId: string) {
    return this.service.findAll(campgroundId);
  }

  @Post()
  async create(@Body() dto: CreateDto, @CurrentUser() user: UserPayload) {
    return this.service.create(dto, user.id);
  }
}
```

### Auth Decorators
```typescript
@UseGuards(JwtAuthGuard)           // Require authentication
@UseGuards(JwtAuthGuard, RolesGuard) // + role check
@Roles(UserRole.owner, UserRole.manager) // Required roles
@CurrentUser()                      // Get user from request
@SkipScopeValidation()             // Skip tenant isolation (admin only)
```

### DTO Validation
```typescript
export class CreateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsEmail()
  email: string;

  @IsInt()
  @Min(0)
  priceCents: number;

  @IsOptional()
  @IsString()
  description?: string;
}
```

---

## Frontend Patterns (Next.js)

### Component Structure
```typescript
"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

interface Props {
  campground: Campground;
}

export function FeatureForm({ campground }: Props) {
  const [form, setForm] = useState({
    name: campground.name || "",
    // Initialize all fields from props
  });
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => apiClient.updateFeature(campground.id, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["features", campground.id] });
      toast({ title: "Saved", variant: "success" });
    }
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
      <FormField
        label="Name"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
      />
      <Button disabled={mutation.isPending}>Save</Button>
    </form>
  );
}
```

### Query Pattern
```typescript
const { data, isLoading } = useQuery({
  queryKey: ["resources", campgroundId],
  queryFn: () => apiClient.getResources(campgroundId),
  enabled: typeof window !== "undefined" && !!authToken,
  staleTime: 5 * 60 * 1000, // 5 minutes
  retry: 1
});
```

### API Client Usage
```typescript
// All calls use scopedHeaders() which auto-injects:
// - Authorization Bearer token
// - x-campground-id, x-organization-id
// - x-locale, x-currency

const data = await apiClient.getReservations(campgroundId);
const result = await apiClient.createPayment(campgroundId, payload);
```

### Hydration Safety
```typescript
// Always check for browser before localStorage
const isBrowser = typeof window !== "undefined";
const token = isBrowser ? localStorage.getItem("campreserv:authToken") : null;

// Use enabled flag to prevent SSR requests
useQuery({
  queryKey: ["data"],
  queryFn: fetchData,
  enabled: isBrowser && !!token
});
```

### Form Accessibility
```typescript
const fieldId = React.useId();

<label htmlFor={fieldId}>Name</label>
<input
  id={fieldId}
  aria-invalid={hasError ? "true" : "false"}
  aria-describedby={hasError ? `${fieldId}-error` : undefined}
/>
{hasError && <p id={`${fieldId}-error`} role="alert">{error}</p>}
```

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

## Agent Instructions

### Proactive Skill/Agent Usage

**Automatically use these when appropriate:**

| Trigger | Action |
|---------|--------|
| After writing significant code | Run `code-reviewer` agent |
| Working on API endpoints | Load `nestjs-api` skill |
| Working on frontend components | Load `ui-development` skill |
| Modifying Prisma schema | Load `prisma-database` skill |
| Security-related changes | Run `security-reviewer` agent |
| Before suggesting deploy | Run `/deploy` command checks |
| Database changes needed | Suggest `/db` command |

**Domain skills to load based on context:**
- Reservation/booking work → `campground-domain` skill
- UI/UX decisions → `ux-design` skill
- Accessibility concerns → `accessibility` skill
- Payment/billing code → Reference `payments.md` rules

### Before Making Changes
1. Read relevant files first - understand existing patterns
2. Check Prisma schema for data model context
3. Look at similar features for patterns to follow
4. Run `pnpm build` to verify changes compile

### Code Generation Rules
1. **Always null-check** after `findUnique` / `findFirst`
2. **Normalize strings** with `.trim().toLowerCase()` for emails
3. **Use specific exceptions** (BadRequest, NotFound, etc.)
4. **Include campgroundId** in all tenant-scoped queries
5. **Invalidate queries** on mutation success
6. **Check `typeof window`** before localStorage access

### What NOT to Do
- Don't modify Prisma generator settings
- Don't use `console.log` in services (use Logger)
- Don't create new dependencies without approval
- Don't nest transactions
- Don't use floating-point for money
- Don't skip auth guards on new endpoints
- **Don't use emojis** - Use Lucide SVG icons for visual elements instead

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
