---
description: Generate AI context from Prisma schema using SchemaForge
---

# SchemaForge - AI Context Generation

Generate comprehensive AI-readable documentation from the Prisma schema.

## Arguments

$ARGUMENTS

| Argument   | Description                                          |
| ---------- | ---------------------------------------------------- |
| `context`  | Import schema and generate AI context file (default) |
| `import`   | Only import Prisma schema to .forge format           |
| `generate` | Generate code (validators, types, API, forms)        |
| `full`     | Run all: import -> context -> generate               |

## Setup (First Time Only)

SchemaForge is at `/Users/josh/Documents/GitHub/Programming Lanuauge` (note folder typo).

```bash
cd "/Users/josh/Documents/GitHub/Programming Lanuauge"
pnpm install && pnpm build
```

## Workflow

### 1. Import Prisma Schema

```bash
cd "/Users/josh/Documents/GitHub/Programming Lanuauge"
npx tsx src/cli/index.ts import \
  --from prisma \
  -i "/Users/josh/Documents/GitHub/Campreserv (broken) copy/platform/apps/api/prisma/schema.prisma" \
  -o ./campreserv.forge
```

### 2. Generate AI Context

```bash
npx tsx src/cli/index.ts context \
  --schema ./campreserv.forge \
  --output "/Users/josh/Documents/GitHub/Campreserv (broken) copy/docs/schema-context.md"
```

### 3. Generate Code (Optional)

```bash
npx tsx src/cli/index.ts generate --schema ./campreserv.forge
```

## Output

The context file includes:

- All 335 models with field definitions
- Relationship mappings between entities
- 1,675 auto-documented API endpoints
- Business rules and validation patterns
- Common query patterns

## Reserved Keyword Handling

The importer automatically renames:

- `action` -> `actionType`
- `model` -> `modelRef`

These are reserved keywords in SchemaForge syntax.

## When to Use

- **After major schema changes** - Regenerate context for AI assistants
- **Onboarding new devs** - Context file is great documentation
- **New feature planning** - AI can reference full data model
- **Code generation** - Scaffold new modules quickly

## File Locations

| File                     | Purpose                                 |
| ------------------------ | --------------------------------------- |
| `campreserv.forge`       | SchemaForge schema (in SF directory)    |
| `docs/schema-context.md` | AI-readable context (in project)        |
| `./generated/`           | Generated code output (in SF directory) |
