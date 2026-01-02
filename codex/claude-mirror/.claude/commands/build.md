---
description: Build the project with dependency order
---

# Build Project

Build the monorepo in the correct dependency order.

## Build Order

The build must follow this order:
1. **Shared** (types/schemas used by both)
2. **API** (depends on shared)
3. **Web** (depends on shared)

## Commands

$ARGUMENTS

### Full Build
```bash
pnpm build
```

This runs:
```bash
pnpm build:shared && pnpm build:api && pnpm build:web
```

### Individual Builds

**Shared only:**
```bash
pnpm build:shared
```

**API only (includes Prisma generate):**
```bash
pnpm build:api
```

**Web only:**
```bash
pnpm build:web
```

## Pre-Build Checklist

1. Ensure dependencies are installed: `pnpm install`
2. Generate Prisma client if schema changed
3. Check for TypeScript errors

## Build Verification

After successful build, verify:

```bash
# Check API build output exists
ls platform/apps/api/dist/main.js

# Check Web build output exists
ls platform/apps/web/.next/
```

## Common Build Errors

### Module not found: @campreserv/shared
```bash
pnpm build:shared
```

### Prisma client missing
```bash
pnpm --dir platform/apps/api prisma:generate
```

### Type errors in shared types
Check `platform/packages/shared/src/index.ts` for Zod schema issues.

## CI Build

For CI environments:
```bash
pnpm ci
```

This runs lint, tests, and build.
