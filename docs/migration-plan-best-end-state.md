# Migration Plan: Best End-State Architecture

This plan moves Keepr from the current monolith-plus-services state to the target architecture that maximizes reliability, correctness, and performance. It prioritizes correctness and operational safety over speed.

## Guiding Constraints

- Zero double-booking under contention.
- Financial ledger correctness is non-negotiable.
- Migration must be reversible at each phase.
- Observability must precede major refactors.

## Phase 0: Foundation (Tooling + CI)

**Goal:** Stable build/test gates and clear baseline metrics.

- Finish Turbo pipeline adoption and pnpm toolchain upgrade.
- Add CI `pnpm typecheck` and Rust `cargo test` jobs.
- Define rollback procedures for deployment changes.
- Confirm backups and database restore drills.

**Exit criteria**

- CI gates include lint, tests, build, typecheck, and Rust checks.
- `pnpm build` is stable across workspace.

## Phase 1: Correctness and Transaction Safety

**Goal:** eliminate double-booking and payment drift risk.

- Add idempotency keys to all reservation and payment mutations.
- Enforce transactional holds and lock timeouts for availability.
- Implement an outbox table for domain events.
- Standardize audit log entries for all staff actions.

**Exit criteria**

- Repeat booking requests are safe.
- Availability conflicts are resolved deterministically.
- Ledger reconciliation runs without manual edits.

## Phase 2: Observability and SLO Enforcement

**Goal:** full visibility into web/API/Rust/worker paths.

- Wire OTel traces through API -> Rust -> DB.
- Correlate logs and traces with a single request ID.
- Align with `docs/observability-slos.md` and enforce alerting.
- Publish runbooks for booking/payment incidents.

**Exit criteria**

- SLO dashboards show live metrics for API, jobs, and realtime.
- Incident drills can be executed with runbooks.

## Phase 3: Async Infrastructure and Workers

**Goal:** move slow/external work off the critical path.

- Add a durable queue (BullMQ/Temporal/QStash + workers).
- Move email/SMS, OTA sync, exports, and reporting to workers.
- Implement retry/backoff policies with dead-letter queues.

**Exit criteria**

- Booking path is not blocked by external providers.
- Worker job failure rates meet SLO targets.

## Phase 4: Realtime Architecture

**Goal:** stable live ops experience.

- Introduce managed pubsub/websocket provider.
- Replace socket servers in API with events/streams.
- Add UI fallbacks for delayed realtime updates.

**Exit criteria**

- Ops dashboard updates within target latency.
- Realtime outages do not break core flows.

## Phase 5: Edge and Read Performance

**Goal:** fast public and read-heavy surfaces.

- Move public discovery and availability reads to Next.js route handlers.
- Cache public pages with ISR and edge revalidation.
- Add read replicas for analytics-heavy queries.

**Exit criteria**

- Guest discovery p95 <= 600ms.
- Public pages remain fast under seasonal spikes.

## Phase 6: Data and Analytics Maturity

**Goal:** reliable reporting and forecasting.

- Build reporting pipelines that read from a warehouse/replica.
- Implement canonical metrics (occupancy, ADR, revenue).
- Add data quality checks with automated alerts.

**Exit criteria**

- Reports match ledger and booking source of truth.
- Forecasting is repeatable and explainable.

## Phase 7: Integrations and Enterprise Readiness

**Goal:** expand integrations without sacrificing stability.

- OTA bidirectional sync with reconciliation loops.
- Accounting integrations with robust mapping and audit trails.
- Partner APIs with scoped keys and usage limits.

**Exit criteria**

- Integration errors are isolated and observable.
- Partners cannot impact core booking reliability.

## Risk Register

- **Overbooking under load**: enforce transactional holds and lock strategies.
- **Payment drift**: ledger-first accounting and idempotent charge operations.
- **Provider outages**: fallback providers and queued retries.
- **Data sync drift**: scheduled reconciliation jobs.
- **Operational complexity**: incremental migrations and rollback readiness.

## Verification Commands

- `pnpm lint:web`
- `pnpm build`
- `pnpm --dir platform/apps/api test:smoke`
- `pnpm typecheck`
- `cargo test --manifest-path platform/services/availability-rs/Cargo.toml`
- `cargo test --manifest-path platform/services/payment-processor-rs/Cargo.toml`
- `cargo test --manifest-path platform/services/auth-service-rs/Cargo.toml`
