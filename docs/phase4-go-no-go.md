# Phase 4 Go/No-Go (Monetization & Insights)

Target burn-in complete: **Jan 3, 2026**. All items must be true before GA.

## Gating decisions (due Dec 17 unless noted)

- Tokenization/processor vs internal (PCI scope) — Owner: Alex — Status: ☐
- Tax engine + taxable-load rules; matrix published — Owner: Priya — Status: ☐
- Email/SMS provider chosen; templates owner confirmed — Owner: Sam — Status: ☐
- Staging creds live (payments, messaging, tax) — Owner: Casey — Status: ☐
- POS hardware/offline limits set (reader/printer, storage) — Owner: Taylor — Due Dec 20 — Status: ☐
- UX mocks (POS, gift card apply, waitlist CTA) approved — Owner: Jordan — Due Dec 20 — Status: ☐

## External Integrations Required (TODO Audit Items)

The following integrations have stub implementations and require external API credentials or infrastructure before go-live:

| Item | Service                     | What's Needed                                                                                                           | Status |
| ---- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------ |
| #7   | OTA Provider APIs           | API credentials from Booking.com, Airbnb, VRBO, etc. Partner signup required.                                           | ☐      |
| #9   | Currency FX Provider        | API key from OpenExchangeRates, ExchangeRate-API, or ECB. Free tiers available.                                         | ☐      |
| #10  | Redis (Distributed Locking) | Redis instance for account lockout service. Options: Railway Redis addon, Upstash, or self-hosted. Env var: `REDIS_URL` | ☐      |
| #12  | RV Life Reviews API         | Partner API access from RV Life for review aggregation. Contact RV Life for credentials.                                | ☐      |

**Quick wins:**

- Currency FX: Sign up at openexchangerates.org (free tier) → add `FX_PROVIDER_API_KEY`
- Redis: Add Redis service in Railway dashboard → copy `REDIS_URL` to env vars

**Requires partner relationships:**

- OTA APIs: Each channel (Booking.com, Airbnb) requires separate partner application
- RV Life: Contact their partnerships team for API access

---

## Functional checks

- Gift cards: 20 parallel redeems → 1 success, rest 409; idempotent retry returns same body; expiry → 410; taxable-load flag works; balance lookup/apply throttled; liability snapshot equals sum of balances; logs redact code/contact/PAN.
- POS: tender sum validated; split tender reconciles; charge-to-site posts folio with audit; gift card tender decrements balance once; offline replay rejects duplicate `offline_seq` and alerts on backlog; returns/exchanges adjust inventory and refund to original/credit; receipts print/email; charge-to-site notice sent.
- Waitlist: throttle enforced; accept idempotent (second = 409); accept after expiry = 410 and hold released; accept without hold = 422; reminder before expiry; matcher lag <30s in staging.
- Reporting: UI vs CSV totals match for ADR/RevPAR/revenue/channel mix/liability; scheduled reports deliver on time; overload returns 503 capacity guard; metric definitions match doc.

## Controls / security / observability

- Idempotency enforced on POST endpoints; RLS/tenant scoping on new tables; audit present on financial/offer changes.
- Rate limits validated (lookup/apply; reporting capacity); alerts firing in staging: redeem failure spike, offline backlog, offer lag, report failures.
- Synthetic checks running: redeem, POS order, offer accept, report export.
- PII/PAN redaction verified in logs/traces.
- Alert env/targets set: `PAGERDUTY_SERVICE_KEY`, `SLACK_ALERT_WEBHOOK`, `METRICS_NAMESPACE=campreserv`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `ENABLE_READY_PROBE`, `ENABLE_COMMS_METRICS`, `ENABLE_OTA_MONITORING`.
- Alert validation steps: delay a queue job (lag alert), pause an OTA provider (backlog alert), trigger comms bounce/complaint (delivery alert), run a load to trip API/Web perf budget alarms.
- Synthetic checklist (staging):
  - Redeem: create + redeem gift card; expect 1 success, 409 on repeat; alert on failure spike.
  - POS order: split tender (gift card + card/site); verify ledger once; alert on tender mismatch.
  - Offer accept: send waitlist offer; accept once (200); second accept = 409; expired accept = 410; alert on lag.
  - Report export: request CSV; verify totals vs UI; capacity guard returns 503 under load; alert on failures.
- Validation results (fill during staging):
  - Queue lag alert fired: ☐
  - OTA backlog alert fired: ☐
  - Comms bounce/complaint alert fired: ☐
  - API perf alarm tripped (p95 >400ms) and cleared: ☐
  - Web perf alarm tripped (LCP p75 >2.5s) and cleared: ☐
  - Redeem synthetic: ☐
  - POS order synthetic: ☐
  - Offer accept synthetic: ☐
  - Report export synthetic: ☐

## Comms

- Templates rendered/approved: gift card issue/redeem/low-balance/void/expire/refund-to-credit; POS receipts/refunds/charge-to-site notice; waitlist offer/reminder/outcome; report ready/scheduled.
- Sandbox sends validated (email/SMS); retries idempotent; DLQ monitored.

## Sign-off

- Product/PM: ****\_\_**** Date: \_\_\_
- Engineering Lead: ****\_\_**** Date: \_\_\_
- Security/PCI: ****\_\_**** Date: \_\_\_
- Finance/Tax: ****\_\_**** Date: \_\_\_
- Ops/Hardware: ****\_\_**** Date: \_\_\_
- Support/Comms: ****\_\_**** Date: \_\_\_
