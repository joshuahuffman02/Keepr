# Phase 3 Ops Runbook

## Endpoints

- Webhooks: `/webhooks/channel/{channel}/availability|rates|reservations` (HMAC, Idempotency-Key, X-Version, X-Timestamp).
- Pull/reconcile: `/channels/{channel}/availability|rates|reservations`.
- Control: `/channels/{channel}/pause`, `/channels/{channel}/resume`, `/channels/{channel}/reconcile`.
- Observability: `/channels/{channel}/logs`.

## Operations

- Pause/resume: pause per park when failures spike or during maintenance; resume after health check.
- Reconcile: trigger when drift suspected; use `from/to` or `sinceCursor`; jobs run nightly + hourly deltas.
- DLQ/retry: outbound failures after max attempts go to DLQ; re-enqueue via retry endpoint after fixing root cause.
- Overbook investigation: 409s indicate inventory exhausted. Inspect `channel_sync_events` (status conflict/overbook) and availability rows for `(parkId, unitTypeId, date)`.
- Key rotation: update `hmacSecret`; accept dual keys during rotation window if needed; log signature failures.
- Rate limit tuning: adjust per park/channel `rateLimitOut` and `rateLimitIn`; watch backlog age and 429s.
- Clock skew: HMAC rejects skew > 5m; if alerts fire, verify NTP/time or temporarily widen window with audit note.

## Alerts (initial thresholds)

- Webhook success < 98% over 15m.
- No successful availability sync > 15m (per park/channel).
- Version conflict or stale rate > 1% over 30m.
- Overbook blocks > 5 per 10m per park.
- Retry queue age > 5m or length above configured N.
- Publish validation failures > 0 (blockers).

## Feature flags / rollout

- `channel_sync_webhooks`: start shadow (log-only), then writes per park/channel.
- `channel_reconcile_jobs`: enable after webhooks stable; start low cadence.
- `discount_engine_v2`: dual-run vs legacy, compare totals, then cut over.
- `public_publish`: gate publish/CDN pipeline; start with 1–2 parks.

## Cadence and retention

- `channel_sync_events`: retain 30–90 days; archive or stream to cold storage.
- `idempotency_keys`: TTL ~72h; prune/partition drop.
- CDN purge logs: 14–30 days to trace publish issues.

## Quick checks

- Health: send a small availability webhook; expect 202, no retries; idempotent retry returns cached response.
- Stale protection: send lower version; expect 409.
- Reconcile: trigger and verify backlog drains; no new stale entries.
- Publish path: draft excluded from sitemap; publish adds to sitemap and purges CDN keys.
