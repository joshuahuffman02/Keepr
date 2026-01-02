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
