---
name: code-audit
description: Deep audit for API mismatches, Prisma issues, dead code, and consistency.
allowed-tools: Read, Glob, Grep, Bash, Task
---

# Code Audit (Codex)

## Use when

- Proactively hunting for bugs before production.

## Audit areas

- Frontend/backend API mismatches.
- Prisma anti-patterns (nested transactions, missing await, null checks).
- Import/module inconsistencies.
- Type safety gaps and unsafe casts.
- Dead code and unused state.
- Error handling gaps and empty catches.

## Output

- File:line, issue, snippet, and fix.

## Allowed scope

- Audit and reporting only; no refactors unless asked.

## Ask before proceeding if unclear

- The target surface area or timebox is missing.

## Stop condition

- Findings with fixes are reported.
