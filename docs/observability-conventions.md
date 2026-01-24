# Observability + Reliability Conventions

This doc standardizes tracing, logging, and health checks across the web app,
API, and Rust services. It complements `docs/observability-slos.md` and the
runbooks in `docs/dr-readiness.md` and `docs/post-completion-polish.md`.

## Goals

- Correlate every request across web -> API -> Rust.
- Ensure health/readiness endpoints are reliable and predictable.
- Keep logs structured so alerts and dashboards are consistent.

## Trace + request correlation

- **Inbound request ID**: API reads `x-request-id` in
  `platform/apps/api/src/common/filters/all-exceptions.filter.ts`. Web should
  forward `x-request-id` when calling the API.
- **Trace context**: Propagate `traceparent` and `tracestate` headers from web
  to API. Rust services should accept and pass through the same headers on any
  outbound calls.
- **API to Rust**: API request context forwards `x-request-id` and trace headers
  to Rust service calls when available.
- **Rust services**: Each Rust service echoes `x-request-id` and records
  `trace_id`/`span_id` on request spans when `traceparent` is present.
- **Response echo**: API responses should include the same `x-request-id` so
  clients can log the correlation key.

## Logging fields (minimum set)

- `requestId` (from `x-request-id`)
- `traceId` / `spanId` (when tracing is enabled)
- `campgroundId`, `orgId`, `userId` (when available)
- `route`, `method`, `status`, `durationMs`

The API logger attaches `requestId` and `traceId`/`spanId` when request context
is available.

## Access logs

- API access logs emit a structured `http_request` entry with method, path,
  status, duration, and scope identifiers.
- Disable in tests by default; set `ACCESS_LOGS_ENABLED=false` to turn off in
  other environments.

## Sentry + OTel conventions

- **Sentry**: Web and API require `SENTRY_DSN`. Use `SENTRY_ENVIRONMENT` to
  separate staging vs production.
- **OTel**: Use `OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_SERVICE_NAME` when
  enabling distributed tracing. Set `OTEL_ENABLED=true` to force initialization.
  Keep service names aligned:
  - `keepr-web`
  - `keepr-api`
  - `keepr-availability`
  - `keepr-auth`
  - `keepr-payments`
    Rust services initialize OTel exporters only when `OTEL_ENABLED=true` or
    `OTEL_EXPORTER_OTLP_ENDPOINT` is set.
    Web tracing uses `@vercel/otel` with the same OTLP endpoint and service name.

## Health + readiness endpoints

- **API liveness**: `/health` (no dependency checks).
- **API readiness**: `/ready` (DB/Redis/queue reachability).
- **Rust liveness/readiness**: `/health` and `/ready` (lightweight process checks).
- **Perf snapshot**: `/api/ops/perf` and `/api/observability/snapshot`.
- Use `/health` for uptime monitors, `/ready` for deploy gating.

## Reliability guardrails

- Alert on readiness failures >2 minutes.
- Track error rate and latency SLOs defined in `docs/observability-slos.md`.
- Keep queue lag and background job failures visible in `/api/observability/snapshot`.
