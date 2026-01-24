---
paths:
  - "platform/apps/api/**"
---

# API-Specific Rules

When working in the NestJS API:

## Service Methods

1. **Always validate before mutating**

   ```typescript
   const record = await this.prisma.model.findUnique({ where: { id } });
   if (!record) throw new NotFoundException(`Model ${id} not found`);
   ```

2. **Use transactions for multi-step operations**

   ```typescript
   await this.prisma.$transaction(async (tx) => {
     // All operations use tx, not this.prisma
   });
   ```

3. **Log with NestJS Logger, not console**
   ```typescript
   private readonly logger = new Logger(MyService.name);
   this.logger.log('Message');
   this.logger.warn('Warning');
   this.logger.error('Error', error.stack);
   ```

## Controllers

1. **Always add guards** - No unprotected endpoints

   ```typescript
   @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
   ```

2. **Scope by campgroundId** - Multi-tenant isolation
   ```typescript
   @Get()
   async list(@Param('campgroundId') campgroundId: string) {
     return this.service.findAll(campgroundId);
   }
   ```

## DTOs

1. **Use class-validator decorators**
2. **Normalize emails**: `.trim().toLowerCase()`
3. **Money in cents**: `@IsInt() @Min(0) priceCents: number`

## Prisma Queries

1. **Always include campgroundId in where clauses**
2. **Check null after findUnique/findFirst**
3. **Use select/include sparingly** - avoid fetching entire relations
4. **Handle Prisma errors**: P2002 (conflict), P2025 (not found)

## File Naming

- `feature.module.ts`
- `feature.controller.ts`
- `feature.service.ts`
- `dto/create-feature.dto.ts`
- `dto/update-feature.dto.ts`

## Scheduled Jobs (CRITICAL)

**ASK BEFORE ADDING ANY @Cron or @Interval decorators.**

Railway PostgreSQL has limited connections (~20-25 max). We already have 50+ scheduled jobs. Adding more can crash the API.

1. **Don't add cron jobs without explicit user approval**
   - Ask: "This feature needs a scheduled job. Is that okay?"
   - Consider if an on-demand endpoint would work instead

2. **Never schedule at :00 minutes** - stagger timing

   ```typescript
   // BAD - collides with other jobs
   @Cron("0 * * * *")

   // GOOD - offset by random minutes
   @Cron("17 * * * *")
   ```

3. **Prefer longer intervals**
   - Every 5 min → Consider every 15 min
   - Every 1 min → Almost never needed, ask first

4. **Check existing jobs first**
   ```bash
   grep -rn "@Cron" src/ | wc -l
   ```

## Database Connections (CRITICAL)

Railway has strict connection limits. The app uses a shared Prisma pool.

1. **Pool size is limited** - default 5-10 connections total
2. **Never create new PrismaClient instances** - always inject PrismaService
3. **Keep queries fast** - long queries hold connections
4. **Use transactions sparingly** - they hold connections until complete

Environment variables for Railway:

```
DATABASE_POOL_SIZE=5      # Keep low for Railway
DATABASE_POOL_TIMEOUT=10  # Fail fast if no connections
```
