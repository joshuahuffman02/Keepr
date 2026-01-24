# Phase 1: Pricing & Payments

## Goals

- Define the pricing model and plan tiers.
- Store pricing/plan data in the database with clear ownership and auditability.
- Integrate the selected payment provider for checkout and subscription lifecycle.
- Provide a minimal admin flow to manage plans.

## Non-goals

- Advanced promotions, coupons, or revenue optimization.
- Multi-region tax automation beyond the selected provider defaults.
- Complex invoicing workflows.

## Acceptance criteria (testable)

- Pricing model and plan definitions are documented and reviewed.
- Plan CRUD endpoints and UI exist with unit tests.
- A sandbox checkout flow completes successfully using the chosen provider.
- Lint, typecheck, unit tests, and smoke checks pass.

## Open questions

- What is the pricing model (subscription, usage-based, tiered, hybrid)?
- Which payment provider is required (Stripe, Paddle, etc.)?
- Which regions/currencies/tax rules must be supported?
- Who manages pricing (internal admin vs. self-serve)?
