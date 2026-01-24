---
name: prisma-database
description: Prisma ORM and PostgreSQL database patterns. Use when working with database queries, schema design, migrations, or data modeling.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Prisma Database for Campreserv

## Schema Location

`platform/apps/api/prisma/schema.prisma`

## Common Models

### Core Entities

- `Campground` - Main business entity
- `Site` - Individual camping sites
- `SiteClass` - Site types/categories
- `Reservation` - Bookings
- `Guest` - Customer records
- `User` - Staff/admin users

### Supporting Entities

- `LedgerEntry` - Financial transactions
- `Payment` - Payment records
- `Promotion` - Discount codes
- `Membership` - Guest memberships

## Query Patterns

### Basic CRUD

```typescript
// Create
await prisma.reservation.create({
  data: {
    siteId,
    guestId,
    arrivalDate,
    departureDate,
    status: "confirmed",
  },
});

// Read one
await prisma.reservation.findUnique({
  where: { id },
});

// Read many with filter
await prisma.reservation.findMany({
  where: {
    campgroundId,
    status: "confirmed",
    arrivalDate: { gte: startDate },
  },
  orderBy: { arrivalDate: "asc" },
});

// Update
await prisma.reservation.update({
  where: { id },
  data: { status: "checked_in" },
});

// Delete
await prisma.reservation.delete({
  where: { id },
});
```

### Relations

```typescript
// Include related data
await prisma.reservation.findUnique({
  where: { id },
  include: {
    guest: true,
    site: {
      include: { siteClass: true },
    },
    payments: true,
  },
});

// Select specific fields
await prisma.reservation.findMany({
  select: {
    id: true,
    arrivalDate: true,
    guest: {
      select: {
        firstName: true,
        lastName: true,
      },
    },
  },
});
```

### Filtering

```typescript
// Multiple conditions (AND)
where: {
  campgroundId,
  status: "confirmed",
  arrivalDate: { gte: startDate, lte: endDate },
}

// OR conditions
where: {
  OR: [
    { status: "confirmed" },
    { status: "checked_in" },
  ],
}

// Contains (case-insensitive)
where: {
  guest: {
    email: { contains: searchTerm, mode: "insensitive" },
  },
}

// In array
where: {
  status: { in: ["confirmed", "checked_in"] },
}
```

### Aggregations

```typescript
// Count
const count = await prisma.reservation.count({
  where: { campgroundId },
});

// Sum
const total = await prisma.payment.aggregate({
  where: { reservationId },
  _sum: { amountCents: true },
});

// Group by
const byStatus = await prisma.reservation.groupBy({
  by: ["status"],
  where: { campgroundId },
  _count: true,
});
```

### Transactions

```typescript
// Automatic transaction
await prisma.$transaction([
  prisma.reservation.update({ where: { id }, data: { status: "cancelled" } }),
  prisma.ledgerEntry.create({ data: { ... } }),
]);

// Interactive transaction
await prisma.$transaction(async (tx) => {
  const reservation = await tx.reservation.findUnique({ where: { id } });
  if (reservation.status !== "confirmed") {
    throw new Error("Cannot cancel");
  }
  await tx.reservation.update({ where: { id }, data: { status: "cancelled" } });
  await tx.ledgerEntry.create({ data: { ... } });
});
```

## Performance Tips

### Avoid N+1 Queries

```typescript
// BAD - N+1 queries
const reservations = await prisma.reservation.findMany();
for (const r of reservations) {
  r.guest = await prisma.guest.findUnique({ where: { id: r.guestId } });
}

// GOOD - Single query with include
const reservations = await prisma.reservation.findMany({
  include: { guest: true },
});
```

### Select Only Needed Fields

```typescript
// Only get what you need
await prisma.reservation.findMany({
  select: {
    id: true,
    arrivalDate: true,
    departureDate: true,
  },
});
```

### Pagination

```typescript
const PAGE_SIZE = 20;

await prisma.reservation.findMany({
  skip: (page - 1) * PAGE_SIZE,
  take: PAGE_SIZE,
  orderBy: { createdAt: "desc" },
});
```

## Migrations

```bash
# Create migration
npx prisma migrate dev --name add_feature

# Apply migrations (production)
npx prisma migrate deploy

# Generate client
npx prisma generate

# View database
npx prisma studio
```

## Common Gotchas

1. **DateTime is UTC** - Always store in UTC, convert in frontend
2. **Decimal for money** - Use Int for cents, not Decimal
3. **Soft deletes** - Use `deletedAt` field instead of hard delete
4. **Unique constraints** - Will throw on duplicate
5. **Foreign key constraints** - Delete children first
