---
description: Run a deep code audit to find API mismatches, Prisma issues, and bugs
---

# Code Audit

Run a comprehensive audit of the codebase to find potential bugs and inconsistencies.

## What to Check

$ARGUMENTS

If no specific category is provided, run a quick scan of the most critical issues:

### 1. Frontend-Backend API Mismatches
Find places where:
- UI state exists (useState) but isn't passed to API calls
- API client functions have parameters that callers don't provide
- Form fields that are collected but not submitted

Search `apps/web/lib/api-client.ts` for function signatures, then find call sites and compare.

### 2. Prisma Anti-Patterns
Find:
- Nested `$transaction` calls (calling $transaction inside a transaction callback)
- Functions that receive `tx` parameter and then call `$transaction` on it
- Missing `await` on Prisma operations
- `findUnique` without null checks

### 3. Import Path Issues
Find broken imports, especially in:
- `apps/api/src/` controllers importing from auth/guards/permissions
- Check that import paths match actual file locations

### 4. Unused State & Dead Code
Find useState hooks where the setter or value is never used.

## Output Format

For each issue found, report:
```
**[CRITICAL/HIGH/MEDIUM/LOW]** `file/path.ts:123`
Issue: Brief description
Code: `the problematic code`
Fix: What should be done
```

## Quick Commands

Run specific audits by passing arguments:
- `/audit api` - Just API mismatch check
- `/audit prisma` - Just Prisma anti-patterns
- `/audit imports` - Just import issues
- `/audit all` - Full comprehensive audit
