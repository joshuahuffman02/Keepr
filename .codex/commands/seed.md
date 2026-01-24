---
description: Seed or reset the database with Prisma
---

# Seed Database

Run Prisma seed and reset helpers.

## Usage

$ARGUMENTS

### Seed only

```bash
pnpm --dir platform/apps/api prisma:seed
```

### Full reset + seed (dev)

```bash
pnpm prisma:reset-seed
```

### Sandbox seed

```bash
pnpm --dir platform/apps/api sandbox:seed
```

## Notes

- Ensure `DATABASE_URL` is set.
- After schema changes, regenerate the client:
  `pnpm --dir platform/apps/api prisma:generate`
