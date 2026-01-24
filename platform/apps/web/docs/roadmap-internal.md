# Internal Roadmap

## Phase 1 — Stabilize & Hardening (in progress)

- POS/store: offline queue + sync log, charge-to-site, refunds/credits, gift-card seed fixtures, low-stock alerts.
- Guest/portal: comms timeline, “assign on arrival” booking, delivery/curbside, offline-friendly My Stay, order status.
- Trust/compliance: permissions guardrails, approval flows, audit/PII redaction, backups/restore-sim, data retention.
- OTA iCal: per-listing feeds/imports with sync status and error badges.
- Finance: payouts/disputes views, deposits v2, ledger/tax sanity checks, seed finance fixtures.

## Phase 2 — Depth & Integrations

- Two-way OTA (availability/rates/reservations) with logs, retry, and per-channel status.
- Support/Ops: SLA/overdue, ticketing, staff chat, ops tasks with photos/routes, checklists, and auto-tasking.
- Reporting/exports: pickup/pace, saved reports, CSV/S3 export, warehouse connector stub, scheduled exports.
- Integrations wave 1: accounting (payout/GL export), helpdesk/CRM, access control stubs, webhook retry/logs.
- PWA/offline: queued orders/payments/messages, push notifications, visible sync state, conflict resolution.

## Phase 3 — Platform & Scale

- Public API/webhooks + OAuth2 sandbox; SDKs and client generators.
- AI assist: replies, task bundling, routing, smart search, anomaly alerts across bookings/payments/comms.
- IoT hooks: metering/lock/alert stubs, QR-at-site flows, device registry.
- Enterprise/international: multi-property controls, approvals depth, localization + FX/tax packs, data residency.
