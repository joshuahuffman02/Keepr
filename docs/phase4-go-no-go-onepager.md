# Phase 4 Go/No-Go One-Pager (Jan 3, 2026)

## Status
- In progress: Phase 4 (stored value/POS/waitlist/reporting). Core schemas/DDL in place; initial idempotency keys and rate-limit scaffolds; consent/quiet hours enforced; DMARC/DKIM/SPF verified; tax engine + liability snapshot hooks drafted; initial alerts defined; DR plan drafted.
- Outstanding: finalize idempotency store + replay dedupe; validate rate limits; wire alerts/sinks and synthetics; confirm tax/breakage rules + sweep; lock processor/tokenization; stage creds across vendors; hardware/offline envelopes; liability tie-out run; DR restore drill executed/recorded.

## Top risks and mitigations
- Observability/alerts — Owner: Casey — Wire Slack/PagerDuty/email sinks; dashboards for queues/OTA/comms/perf; perf budgets in CI; alerts for redeem/offline backlog/offer lag/report failures. Due: Dec 24.
- PCI/POS scope (card flags, till/cash) — Owners: Taylor (hardware), Alex (PCI) — Keep card processing behind flags until sandbox validated; lock POS hardware/auth/offline envelopes; enforce tender ledger/idempotency; over/short + “cash without till” alerts; till open/close + daily report/export. Due: Dec 17 (tokenization), Dec 20 (hardware/offline envelopes).
- Comms consent/deliverability — Owner: Sam — Enforce consent/quiet hours/unsubscribe; DMARC/DKIM/SPF verified; bounce/block alerts; template approvals; provider routing health. Due: Dec 17.
- Tax/breakage policy — Owner: Priya — Publish taxable-load matrix; breakage/expiry sweep with audit; liability snapshots tie-out. Due: Dec 17.
- Offline replay/idempotency — Owner: Casey — Idempotency keys + seq dedupe for POS/waitlist; backlog alert; rate limits validated; offline replay envelopes. Due: Dec 24.
- Vendor creds/approvals — Owners: Casey (creds), Alex (processor), Sam (comms), Priya (tax), Taylor (devices) — Stage creds for payments/comms/tax; processor/tokenization approval; sender domains ready; POS device/auth approvals. Due: Dec 17–20.

## Go/No-Go gates
- Idempotency enforced on new tables/APIs; rate limits validated (lookup/apply/reporting).
- Offline replay dedupe with backlog alert; waitlist throttle/expiry/accept idempotent.
- Consent/quiet hours/unsubscribe enforced; comms templates QA’d.
- Tax/breakage rules implemented with sweep; liability snapshot equals balances.
- RLS/audit on new tables; PII/PAN redaction verified.
- Alerts + synthetics firing for redeem/offline backlog/offer lag/report failures.
- Reports 503 capacity guard; staged synthetic checks for redeem/POS/offer/export.
- DR restore drill scheduled and recorded before Go/No-Go.

## Asks by date
- Dec 17: processor/tokenization decision; tax engine + taxable-load rules; comms provider + template owner; staging creds live (payments/comms/tax).
- Dec 20: POS hardware/offline limits + device/auth envelopes; POS/gift card/waitlist UX mocks.
- Dec 24: idempotency store; rate-limit validation; offline replay dedupe; observability wiring (alerts to sinks) validated in staging.
- Jan 3: Go/No-Go — all gates green (idempotency, rate limits, offline replay dedupe/backlog alert, consent/quiet hours, tax/breakage, RLS/audit, alerts + synthetics, liability tie-out, DR drill).
