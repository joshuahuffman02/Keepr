---
name: prisma-database
description: Prisma ORM and PostgreSQL patterns for queries and schema work.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Prisma Database (Codex)

## Use when

- Writing Prisma queries, schema changes, or migrations.

## Core rules

- Schema: `platform/apps/api/prisma/schema.prisma`.
- Prefer include/select to avoid N+1.
- Use transactions for multi-step writes.
- Select only needed fields.

## Checklist

- Null checks after findUnique.
- No raw SQL with user input.
- Pagination on large lists.

## Allowed scope

- Data access guidance only unless asked to implement.

## Ask before proceeding if unclear

- The data model or performance constraints are unknown.

## Stop condition

- Correct Prisma patterns are outlined.
