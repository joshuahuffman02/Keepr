---
description: Run fast local checks (lint + smoke tests)
---

# Quick Check

Run a fast sanity check before pushing.

## Usage

$ARGUMENTS

### Fast suite
```bash
pnpm lint:web
pnpm --dir platform/apps/api test:smoke
pnpm --dir platform/apps/web test
```

## Full CI
```bash
pnpm ci
```
