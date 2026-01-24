---
name: nextjs
description: Next.js 14 App Router patterns and best practices.
allowed-tools: Read, Write, Edit, Glob, Grep
---

# Next.js (Codex)

## Use when

- Working with routing, server/client components, or data fetching.

## Core rules

- Prefer Server Components; add "use client" only when needed.
- Fetch data where it is used; choose caching strategy intentionally.
- Use route groups, layouts, loading/error/not-found conventions.

## Checklist

- Server vs client boundaries respected.
- Data fetching uses cache/no-store/revalidate appropriately.
- API routes follow Next conventions.

## Allowed scope

- Next.js guidance only unless asked to implement.

## Ask before proceeding if unclear

- The target route or rendering strategy is unclear.

## Stop condition

- A concise Next.js approach is provided.
