---
description: Database operations - migrations, seeding, and Prisma commands
---

# Database Operations

Manage Prisma database operations.

## Available Operations

$ARGUMENTS

### Common Commands

| Command | Description |
|---------|-------------|
| `generate` | Regenerate Prisma client after schema changes |
| `migrate` | Create and run a new migration |
| `push` | Push schema changes without migration (dev only) |
| `seed` | Run seed script |
| `reset` | Reset database and reseed |
| `studio` | Open Prisma Studio GUI |
| `status` | Check migration status |

## Workflows

### After Schema Change
```bash
pnpm --dir platform/apps/api prisma:generate
pnpm build:shared
```

### Create Migration
```bash
cd platform/apps/api
npx prisma migrate dev --name describe_change
```

### Full Reset (Dev Only)
```bash
pnpm prisma:reset-seed
```

### Check Production Migration Status
```bash
DATABASE_URL="..." npx prisma migrate status
```

### Deploy Pending Migrations
```bash
DATABASE_URL="..." npx prisma migrate deploy
```

## Schema Location

`platform/apps/api/prisma/schema.prisma`

## Seed Data

Seeds are in `platform/apps/api/prisma/seed.ts`

Run with:
```bash
pnpm --dir platform/apps/api prisma:seed
```

## Troubleshooting

### "Prisma client not found"
```bash
pnpm --dir platform/apps/api prisma:generate
```

### Migration drift
```bash
npx prisma migrate resolve --applied "migration_name"
```

### View raw SQL
```bash
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
```
