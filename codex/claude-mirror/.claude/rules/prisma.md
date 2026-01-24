---
paths:
  - "platform/apps/api/prisma/**"
  - "**/prisma.service.ts"
---

# Prisma-Specific Rules

## Schema Changes

1. **After modifying schema.prisma, always run:**

   ```bash
   pnpm --dir platform/apps/api prisma:generate
   ```

2. **For new migrations:**
   ```bash
   cd platform/apps/api
   npx prisma migrate dev --name describe_the_change
   ```

## DO NOT MODIFY

1. **Generator block** - Must stay as `prisma-client-js`
2. **Adapter configuration** - Uses `PrismaPg` at runtime

## Model Conventions

1. **Always include these fields:**

   ```prisma
   id          String   @id @default(cuid())
   createdAt   DateTime @default(now())
   updatedAt   DateTime @updatedAt
   ```

2. **Multi-tenant models need:**

   ```prisma
   campgroundId String
   campground   Campground @relation(fields: [campgroundId], references: [id])
   ```

3. **Money fields are integers (cents):**
   ```prisma
   priceCents    Int
   totalAmount   Int
   balanceAmount Int
   ```

## Query Patterns

1. **Always scope by campgroundId:**

   ```typescript
   where: {
     (id, campgroundId);
   }
   ```

2. **Null check after findUnique:**

   ```typescript
   const record = await this.prisma.model.findUnique({ where: { id } });
   if (!record) throw new NotFoundException();
   ```

3. **Use transactions for related operations:**
   ```typescript
   await this.prisma.$transaction(async (tx) => {
     // Use tx for all operations
   });
   ```

## Common Error Codes

| Code  | Meaning                     | HTTP Status     |
| ----- | --------------------------- | --------------- |
| P2002 | Unique constraint violation | 409 Conflict    |
| P2025 | Record not found            | 404 Not Found   |
| P2003 | Foreign key constraint      | 400 Bad Request |
