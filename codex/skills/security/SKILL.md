---
name: security
description: Security best practices for auth, payments, and sensitive data.
allowed-tools: Read, Glob, Grep
---

# Security (Codex)

## Use when
- Implementing auth, authorization, payments, or handling user data.

## Core rules
- Validate all inputs; never trust user data.
- Enforce authorization on every sensitive endpoint.
- Never store card data; verify Stripe webhooks.
- Avoid logging secrets or PII.

## Checklist
- JWT validation and session safety.
- CSRF/XSS prevention and safe output encoding.
- Rate limiting on auth endpoints.
- Proper error messages without leakage.

## Allowed scope
- Security guidance only unless asked to implement.

## Ask before proceeding if unclear
- The data sensitivity or threat model is undefined.

## Stop condition
- A practical security checklist is provided.
