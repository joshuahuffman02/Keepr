# Observability & SLOs

**Scope:** API, async jobs, and web. Baseline, lightweight telemetry for now (in-memory with JSON snapshot + console logs) that can be scraped by any log forwarder.

## SLOs (targets are env-tunable)

- API latency: p95 ≤ `${SLO_API_P95_MS:-800}` ms, p99 ≤ 1200 ms.
- API availability: error rate ≤ `${SLO_API_ERROR_RATE:-0.01}` (1%).
- Jobs: p95 ≤ `${SLO_JOB_P95_MS:-30000}` ms, failure rate ≤ `${SLO_JOB_FAILURE_RATE:-0.02}` (2%).
- Rate limits: default `${PERF_RATE_LIMIT_IP:-120}`/min per IP and `${PERF_RATE_LIMIT_ORG:-240}`/min per org, 429 surfaced with Retry-After.

## Signals & endpoints

- API/request SLIs: captured via `PerfInterceptor` → `/api/ops/perf` and `/api/observability/snapshot`.
- Job SLIs: queue/backpressure wrapper logs durations/outcomes and queue depth → `/api/observability/snapshot`.
- Web vitals: budgets enforced in CI via `pnpm --dir platform/apps/web budgets`; see `platform/apps/web/scripts/check-budgets.mjs`.
- Dashboards: `platform/apps/web/app/tech/page.tsx` shows live API + SLO snapshot using `NEXT_PUBLIC_API_BASE` (defaults to `http://localhost:4000/api`).

## Rollout steps

1. Set envs for limits/budgets (optional): `SLO_API_P95_MS`, `SLO_API_ERROR_RATE`, `SLO_JOB_P95_MS`, `SLO_JOB_FAILURE_RATE`, `PERF_RATE_LIMIT_IP`, `PERF_RATE_LIMIT_ORG`.
2. Deploy API; ensure `/api/observability/snapshot` and `/api/ops/perf` respond 200.
3. Trigger a few API calls and scheduled jobs; confirm snapshot shows non-zero samples and queue names (`campaign-dispatch`, `payout-recon`).
4. Run `pnpm ci` (or `pnpm --dir platform/apps/web budgets`) to assert bundle budgets after `next build`.
5. Wire log/metric forwarder to scrape structured console output or poll the snapshot endpoint until a full OTLP/Prom stack is attached.
