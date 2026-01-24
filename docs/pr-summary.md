## PR Summary

- Add alerts + synthetics: Slack/PagerDuty alerts for redeem/offline backlog/offer lag/report failures/comms/OTA; 5-minute synthetic checks (redeem, POS order, offer accept, report export); split `/health` (liveness) and `/ready` (DB/redis/queue/perf).
- Harden idempotency/replay: new `IdempotencyRecord` store with per-scope rate limits, request hash/checksum checks, sequence dedupe; controllers return 409 on dupes.
- POS/till: enforce till open/close for cash, tender mismatch -> needs_review, over/short alerts, daily till report/CSV scaffold, offline replay dedupe.
- Stored value: idempotent issue/reload/redeem/void/refund-to-credit with taxable-load flag; PIN/checks; liability snapshot tie-out; double-redeem guarded.
- Reporting: capped/resumable exports with 503 capacity guard and smoke test.
- Comms: per-channel consent + quiet hours enforced; unapproved templates blocked (gift cards, POS receipts/charge-to-site, waitlist, report-ready); bounce/complaint surfaced with alerts and provider failover/backoff + DLQ monitoring.

## Testing

- `pnpm prisma migrate deploy`
- `pnpm test -- --runInBand src/__tests__/healthz.spec.ts src/__tests__/idempotency.service.spec.ts src/__tests__/ota.alerts.spec.ts`
- `pnpm test -- --runInBand src/__tests__/stored-value-redeem.spec.ts src/__tests__/stored-value-liability.spec.ts src/__tests__/waitlist-accept.spec.ts`
- `pnpm test -- --runInBand src/__tests__/reports-export-smoke.spec.ts`
- `pnpm test -- --runInBand src/__tests__/communications-consent-quiet-hours.spec.ts`

## Pre-deploy env

Set: `SLACK_ALERT_WEBHOOK`, `PAGERDUTY_SERVICE_KEY`, `METRICS_NAMESPACE`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `ENABLE_READY_PROBE`, `ENABLE_COMMS_METRICS`, `ENABLE_OTA_MONITORING`, `SYNTHETICS_ENABLED`, `SYNTHETIC_API_BASE`, `SYNTHETIC_TOKEN`.

## Map + ADA/amenities site assignment

- Data model: `Site` now tracks width/height/pullThrough, ADA label, surface/slope, amenity tags; new `SiteMapLayout` for geometry/centroid/label and `CampgroundMapConfig` for bounds/legend/layers. DTOs updated to accept these fields.
- API: `GET/PUT /campgrounds/:id/map` serve/update layout+config; `POST /campgrounds/:id/assignments/check` validates rig fit, ADA, amenities, party size, and conflicts (holds/maintenance/blackouts/reservations); `POST /campgrounds/:id/assignments/preview` batches eligibility.
- UI plan: load map once, apply filters (rig size/ADA/amenities/hookups/surface), highlight ADA and conflicts, show list+map with selection drawer, overlays for holds/maintenance/blackouts, and debounced preview checks for visible sites. Color by availability; striped overlay for conflicts; badge ADA; tooltips show hookups + rig limits.
- Tests: added `src/__tests__/site-map.spec.ts` covering conflict detection, constraint failures, and preview eligibility splits.
