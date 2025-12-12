# RV Hospitality Roadmap (Internal)
Last updated: 2025-12-21 (perf & reliability shipped)  
Audience: product, engineering, GTM. Structure: Foundations → Differentiators → Moats. Owners are placeholders until staffed.

## Scope & principles
- RV-native journeys first: rig-fit accuracy, site assignment, seasonal/long-stay rules, add-ons, and POS tied to reservations.
- Arrival to departure lifecycle: booking → hold → check-in → on-site service → checkout → rebook.
- Operational efficiency: offline-tolerant, task automation, and unified comms timelines.
- Open + measurable: APIs/webhooks, analytics, and explicit ROI (ADR, occupancy, attach rate, labor per revenue).

## Planning Update — Dec 09, 2025
- Goals: revenue reliability first, then ops experience, then distribution/sales, finishing with monetization and insights.
- Sequence:
  - Phase 1: Dynamic pricing & seasonal rate plans; deposits/auto-collect; add-ons/upsells; automated comms (templates + event hooks); audit logs/RBAC hardening. Dependencies: pricing/rate model, payments, comms hooks, auth/tenant isolation.
  - Phase 2: Housekeeping/turnover + tasking; maintenance tickets with site-out-of-order; self-service check-in/express checkout; group/linked bookings & blocks. Dependencies: task model/statuses, inventory lock states, payments/comms for arrivals, availability locking.
  - Phase 3: OTA/channel manager sync; memberships/discount plans & promo codes; public website/SEO tools. Dependencies: robust availability/pricing APIs with idempotency, tax/fee engine, audit trail, comms hooks.
  - Phase 4: Gift cards/store credit; POS for on-site store/activities; reporting/analytics (ADR, revenue, channel mix); waitlist with auto-offers. Dependencies: ledger/liability tracking, tax rules, payment infra, event schema/warehouse hooks, comms.
- Risks/controls: OTA overbooking (idempotent webhooks, rate limits, monitoring), deliverability/compliance for comms (SMS/email consent), PCI scope for POS, liability handling for gift cards, data quality for analytics.
- Quick wins: add-ons/upsells at checkout; deposits/auto-collect; comms templates for confirmations/mods/cancels; basic occupancy/ADR view; waitlist capture UI (manual convert).
- Update (Dec 10, 2025): Phase 1 (pricing/deposits/upsells/audit/RBAC) marked complete; remaining items will be handled in later-phase polish.
- Update (Dec 10, 2025): Phase 2 feature track marked complete; any follow-on items will move into next-phase or polish tracks.
- Update (Dec 10, 2025): Phase 3 (OTA/channel sync, memberships/discounts, public website/SEO) marked complete; any refinements will roll into subsequent tracks.
- Update (Dec 10, 2025): Phase 4 scaffolding in progress — stored value/POS/waitlist: Prisma models for stored value (accounts/codes/ledger/holds), POS carts/items/payments/returns and daily fact tables added; Nest modules/controllers/DTOs for stored value and POS stubbed; stored value now issues codes with optional PIN (generated or provided), PIN verification on redeem, idempotent ledger flows, and balance helpers; POS checkout marks carts `needsReview` on tender mismatch; offline replay placeholder returns `needs_review`. Next: server-side reprice + capture, charge-to-site/card wiring, returns, hold expiry and breakage sweep; run till migrations; keep card processing behind flags until Stripe/Adyen sandbox is set up; wire cash refunds/exchanges to till movements; add POS UI for till status, cash blocking, close flow, and daily till report/export; extend tests (cash enforcement, open/close lifecycle, daily CSV); alerts for “cash without till,” over/short spikes, and paid-in/out anomalies.
- Update (Dec 10, 2025): Post-completion hardening underway — checklist added (`docs/post-completion-polish.md`) covering observability/security/UX/tests; API logger now redacts email/phone/last4 by default (`platform/apps/api/src/logger/redacting.logger.ts`) with unit coverage; perf/test hooks and E2E skeletons documented.
- Update (Dec 11, 2025): Hardening shipped — alerts + synthetics + /ready split, idempotency store + rate limits and offline replay dedupe, POS till open/close + needs_review on tender mismatch, stored value taxable-load enforcement + liability snapshots, report export guard/resumable tokens, and comms consent/quiet hours/template approvals with bounce/complaint handling. See `docs/pr-summary.md` and `docs/audit-core-functions.md`.
- Next feature wave: gateway choice + fee pass-through; reports expansion (hundreds + charts, scheduler/email); POS integrations; onboarding/import/export; e-sign/waivers/COI + access/ID + incidents; metered utilities/late fees; access control automation; referrals/reason-for-stay polish.
- Open hardening items to carry forward:
  - Observability/alerts: wire queue/OTA/comms alert routing (Slack/PagerDuty/email), add dashboards (health/queues/OTA/comms/perf), enforce perf budgets in CI.
  - Security/compliance: audit auth guards for pricing/workflows/staff/portfolio; PII redaction audit; SMS/Email consent/quiet hours/unsubscribe; DR runbook + restore drill.
  - UX polish: nav consistency; accessibility pass on new pages; finish empty/loading/error states if gaps remain.
  - Tests: smoke/E2E for pricing change, workflow execution, staff scheduling conflicts, portfolio load/pagination perf, OTA happy path.
  - Quick wins: comms bounce/block alerts + webhook logging; queue stale/failure alerts to sinks.

### Phase 4 (Monetization & Insights) execution — Dec 10, 2025
- Scope: stored value (issue/reload/redeem/void/refund-to-credit with optional PIN, taxable-load flag, idempotent ledger, liability snapshots); POS (split tender incl. gift card/charge-to-site/cash, receipts, returns/exchanges, offline replay with seq dedupe and backlog alert); waitlist (holds, throttles, idempotent accept/decline/expire); reporting (ADR/RevPAR/revenue/channel mix/liability, saved filters, CSV export, scheduled email); observability/rate limits/redaction.
- Data/API: SQL DDL drafted (gift_card/ledger, POS orders/lines/tenders/returns + terminal sessions, waitlist entries/holds/offers, facts/dims + liability_snapshot); OpenAPI 3.1 drafts for gift cards/POS/waitlist/reports; shared idempotency + tenant scoping/RLS; comms triggers/templates enumerated (gift card events, receipts/refunds, offers/reminders/outcomes, report ready).
- Backlog source: `docs/phase4-backlog.csv` (owners/dates/points for gift cards, POS, waitlist, reporting, idempotency, security, observability). Keep status in sync with that file.
- Gating decisions (due Dec 17 unless noted): processor/tokenization (Alex); tax engine + taxable-load rules (Priya); email/SMS provider + template owner (Sam); staging creds live for payments/messaging/tax (Casey). Due Dec 20: POS hardware/offline limits (Taylor); POS/gift card/waitlist UX mocks (Jordan). Infra: idempotency store, rate limit validation, observability wiring (Casey, Dec 24).
- Go/No-Go (target Jan 3, 2026): see `docs/phase4-go-no-go.md` — idempotency enforced; RLS/audit on new tables; rate limits validated; double-redeem race blocked; offline replay dedupe with backlog alert; waitlist throttle/expiry/accept idempotent; reports capacity guard 503 under load; comms templates QA’d; liability snapshot = balances; PII/PAN redaction verified; alerts firing in staging (redeem failure, offline backlog, offer lag, report failures); synthetic checks for redeem/POS/offer/export passing; alert env/targets set and validated (`PAGERDUTY_SERVICE_KEY`, `SLACK_ALERT_WEBHOOK`, `METRICS_NAMESPACE=campreserv`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `ENABLE_READY_PROBE`, `ENABLE_COMMS_METRICS`, `ENABLE_OTA_MONITORING`).
- Open items before coding: confirm tax/expiry/breakage policy per region (load vs redeem taxable, sweep cadence); approve UX mocks for POS/gift card/waitlist; stage creds/config for payments/comms/tax and POS device/auth; sender domains ready; hardware/offline limits locked.

### Milestones & asks (Dec–Jan)
- Dec 17: Processor/tokenization, tax engine + taxable-load rules, comms provider/template owner, staging creds live. Owners: Alex, Priya, Sam, Casey. Ask: unblock tax/consent/PCI scope and enable staging calls.
- Dec 20: POS hardware/offline limits and POS/gift card/waitlist UX mocks approved. Owners: Taylor, Jordan. Ask: lock device/auth/offline envelopes and UX so build can start.
- Dec 24: Idempotency store + rate limit validation + offline replay dedupe + observability wiring. Owner: Casey. Ask: enforce idempotency/rate limits, add replay dedupe and alert sinks (redeem/offline backlog/offer lag/report failures).
- Jan 3 (Go/No-Go, per `docs/phase4-go-no-go.md`): Owners: leads above + Eng. Ask: all gates green — idempotency, rate limits, offline replay dedupe/backlog alert, consent/quiet hours, tax/breakage rules, RLS/audit, alerts + synthetics, liability tie-out, DR drill scheduled.

### Go/No-Go snapshot (Jan 3, 2026)
- Status: Phase 4 in-progress. Done: schemas/DDL, initial idempotency keys, rate-limit scaffolds, consent/quiet-hours enforcement, DMARC/DKIM/SPF verified, tax engine + liability snapshot hooks, initial alerts defined, DR plan drafted. Outstanding: finalize idempotency store + replay dedupe, validate rate limits, wire alerts/sinks + synthetics, confirm tax/breakage rules + sweep, lock processor/tokenization + vendor creds, hardware/offline envelopes, liability tie-out run, DR restore drill executed.
- Top risks (see `docs/phase4-go-no-go-onepager.md`): observability/alerts (Casey, Dec 24), PCI/POS scope + hardware/offline (Taylor/Alex, Dec 20; tokenization Dec 17), comms consent/deliverability (Sam, Dec 17), tax/breakage policy (Priya, Dec 17), offline replay/idempotency (Casey, Dec 24), vendor creds/approvals (Casey/Alex/Sam/Priya/Taylor, Dec 17–20).
- Gates to green: idempotency + rate limits; offline replay dedupe/backlog alert; consent/quiet hours/unsubscribe; tax/breakage rules + sweep; RLS/audit + PII/PAN redaction; alerts + synthetics for redeem/offline backlog/offer lag/report failures; reports 503 capacity guard; liability snapshot = balances; DR restore drill recorded.
- Asks by date: Dec 17 (processor/tokenization, tax engine + taxable-load rules, comms provider/template owner, staging creds); Dec 20 (POS hardware/offline limits, POS/gift card/waitlist UX mocks); Dec 24 (idempotency store, rate-limit validation, offline replay dedupe, observability wiring validated); Jan 3 (all gates green).

### Production readiness (internal)
- Gates: idempotency enforced on new tables/APIs; rate limits validated (lookup/apply/reporting); offline replay dedupe with backlog alert; waitlist throttle/expiry/accept idempotent; reports 503 capacity guard; comms consent/quiet hours/unsubscribe enforced; tax/breakage rules implemented with sweep; liability snapshot = balances; PII/PAN redaction verified; alerts + synthetics firing for redeem/offline backlog/offer lag/report failures.
- Post-completion polish: see `docs/post-completion-polish.md` for observability/security/UX/test checklist; prioritize alert sinks, perf budgets, and tagged smoke/E2E coverage (`@smoke-hardening`).
- DR: runbook at `docs/dr-readiness.md`; schedule and record a restore drill before Go/No-Go.

### Risks & controls (internal)
- Observability/alerts gaps — Owner: Casey — Control: wire Slack/PagerDuty/email sinks and perf budgets; stage alerts for redeem/offline backlog/offer lag/report failures proven.
- PCI/scope & hardware/offline limits — Owner: Taylor (hardware) + Alex (PCI) — Control: keep card processing behind flags until sandbox validated; lock device/auth/offline envelopes; enforce tender ledger/idempotency; over/short alerts.
- Comms consent/deliverability — Owner: Sam — Control: enforce consent/quiet hours/unsubscribe in hooks; bounce/block alerts; template approvals.
- Tax/breakage policy — Owner: Priya — Control: publish taxable-load matrix and breakage/expiry sweep job with audit.
- Offline replay/dedupe — Owner: Casey — Control: idempotency keys + seq dedupe for POS/waitlist; backlog alert with synthetic coverage.

## Phasing

### Foundations (0–3 months)
- **Offline/resilience** — offline POS/kiosk with sync queue, SMS fallbacks, safe retries.  
  Owners: Eng Lead, Infra. Dependencies: payments queueing, ledger idempotency.
- **RV-native inventory & assignments** — rig-fit guardrails everywhere, auto-assign with constraint solver, conflict detection for holds/blocks/maintenance.  
  Owners: PM, Eng Lead. Dependencies: site graph, blackout/hold hooks.
- **Payments & finops hardening** — payouts + reconciliation, chargeback center, saved wallets/ACH, fee handling, audit trails.  
  Owners: PM, Eng Lead, Finance. Dependencies: ledger, provider webhooks.
- **Comms & timelines** — triggered sequences (pre/post-arrival, unpaid, upsells), delivery health (DMARC/DKIM/SPF), SLA views for staff inbox.  
  Owners: PM, Comms Eng. Dependencies: comms hub, templates.
- **Staff mobility** — mobile-friendly tasking for housekeeping/maintenance with photo proof, checklists, and route ordering by site map.  
  Owners: Ops PM, Mobile Eng. Dependencies: task model, map data.

### Differentiators (3–9 months)
- **Arrival automation** — self-check-in, gate/lock/RFID integrations, vehicle/RV plate capture, late-arrival flows, “site ready” signals.  
  Owners: PM, Integrations Eng. Dependencies: access control provider, assignments.
- **Unified upsell engine** — context-aware offers (arrival firewood bundles, mid-stay activities, late checkout), store/POS charges to folio, A/B hooks.  
  Owners: PM, Commerce Eng, Data. Dependencies: pricing rules, segmentation.
- **Activities & amenities depth** — inventory-aware sessions, rentals, scheduling, and guest/staff booking with caps and overage handling.  
  Owners: PM, Activities Eng. Dependencies: availability engine.
- **Data platform & forecasting** — standardized metrics (ADR, RevPOR, attach rate), pickup/forecasting, anomaly alerts, exports/warehouse connectors.  
  Owners: Data PM, Data Eng. Dependencies: event bus, dbt/export layer.
- **Integrations wave 1 (completed)** — accounting (QuickBooks/Xero), CRM/helpdesk, access control, SFTP/API exports for operators. Delivered backend connections with credential storage, manual sync triggers, webhook HMAC validation, export job records (API/SFTP), admin UI for connections/logs/sync/exports, and a minimal TS SDK. Sandbox QBO pull path is live; production QBO/Xero and select access-control/CRM vendor keys still pending approval.  
  Owners: PM, Integrations Eng. Dependencies: API auth, webhooks. Blockers: production approvals for vendor creds.
- **Social Media Planner** — in-app content calendar with parking lot + auto slots, smart suggestions from occupancy/events/deals/seasonality/history, weekly auto-generated ideas, post builder with templates and caption/hashtag helpers, saved content bank, reporting, team comments/assign/approvals, and “opportunity alerts.”  
  Owners: PM, Marketing/AI Eng. Dependencies: comms/templates, events/deals data, media storage.

### Moats (9–18 months)
- **Developer ecosystem** — public API + webhooks, OAuth2 scoped tokens, sandbox + SDKs, extension surfaces in admin.  
  Owners: Platform PM, DevEx Eng. Dependencies: auth, rate limits, audit.
- **AI Ops Copilot** — suggested replies, task bundling/route optimization, bulk changes (pricing, blocks), semantic search.  
  Owners: PM, AI Eng. Dependencies: data quality, embeddings store.
- **IoT & utilities** — smart meters for power/water (billing + leak alerts), noise/temp for cabins, QR-at-site for “report/upsell” flows.  
  Owners: PM, Hardware Eng. Dependencies: integrations layer, billing.
- **Enterprise/international** — multi-property ops, approvals, localization, multi-currency/tax, DR/SOC2 readiness.  
  Owners: PM, Sec/Infra. Dependencies: controls, compliance runbook.

## Data Intelligence & Decision Engine
- Core philosophy: empower operators without noise; privacy-first (aggregated/anonymous); explain “what the data says” with confidence + projected impact; make actions one-click where permissions allow; track conversion health across every meaningful interaction.
- Data tracking layer: structured events across booking/browsing (page views, site card/detail, image hover/click/viewed, site class viewed, availability check, add-to-stay, reservation start/abandon/complete, deal viewed/applied, email signup, review viewed) with timestamp, anonymous session ID, device, referrer, coarse geolocation.
- Image conversion tracking: first-seen images, time viewed, CTR, conversion correlation, A/B ordering, heat ranks; insights like “Image #3 drives +45% conversions vs current first image” and “Outdoor images keep guests 2.8s longer.”
- Site class/detail conversion: view → detail → add-to-stay → convert/abandon, seasonal and weekday/weekend trends, filter origin, price sensitivity; insights to reorder high performers and surface pet-friendly demand.
- Pricing intelligence: suggested optimal nightly rate, revenue vs occupancy tradeoffs, sensitivity curves, 6-week forecasts, holiday guidance with examples (“+$3 weekend on Site 14 OK”, “- $8 weekday cabins off-season”).
- Deal performance analytics: views/clicks/use rates, incremental lift, attribution by channel; insights to rewrite underperforming headlines and highlight seasonal winners.
- Recommendation engine (actionable insights): image order, pricing, availability, and content recs with explanation, confidence, projected impact, and Apply/Update buttons gated by permissions; non-admins see “requires approval”.
- Reports dashboard: funnel (views → detail → add-to-stay → bookings), drop-offs/abandonment, image performance, pricing analysis (rev/occ/stoplight), site & site class performance, deal impact, channel attribution, forecasting/predictions.
- Apply buttons & permissions: Admin/Manager can apply pricing updates, reorder images, launch A/B tests, modify listings/rates/deals; Analyst can view/export/propose; Viewer is read-only.
- Privacy rules: no identifiable guest tracking; aggregated analytics; regionalized IP; clear retention; “export all analytics” without personal info.
- A/B testing system: variables (image order, price, deal headline, description, layout, default filters), metrics (CTR, conversion, ARPB, engagement), autosuggestions (“Variant B outperforming by 28% — apply?”) with permission gates.
- Annual data report (auto-generated): revenue/occupancy summary, best sites/cabins, top images, deals, holiday activity, pricing trends, origin channels, next-year recommendations; export as PDF/CSV/share link.
- Future ML layer: predictive pricing per date, booking window timing, return-guest likelihood, oversell weekends, early-warning drops in site interest.
- Codex implementation notes: event-based analytics tables; image-level conversion tracking; conversion pipelines; permissions-based apply actions; reports UI; recommendation engine hooks; dashboard query caching; future-ready ML entry points.

## Gamification (staff-only, opt-in per campground)
- Philosophy: reward consistent, quality work; mature UI (no cartoon/cheesy visuals). Guests never see it.
- Opt-in: camp-level toggle; manager controls for XP ranges, overrides, and manual “Merit XP”.
- XP system: actions grant XP (daily tasks, maintenance completions, smooth check-ins, zero-error reservations, checklists, positive reviews, on-time assignments, helping teammates). Light penalties for overdue tasks, correction-required mistakes, skipped checklist items.
- Levels: proficiency tiers (New Recruit → Operator → Specialist → Expert → Master Caretaker → Ranger → Trailblazer → Guardian → Pinnacle Operator). Perks: profile badge, early feature access, propose-improvements queue, subtle themes.
- Weekly challenges: auto-generated from operational needs (e.g., on-time honey wagon rounds, zero overdue tasks, 100% check-in docs, guest rating leader, maintenance volume). Rewards: bonus XP, badges, leaderboard boosts.
- Leaderboards: category-based (tasks done, guest rating, check-in speed, cleanliness, consistency). Reset weekly/monthly to keep fresh.
- Badges/achievements: only from real work (Rain or Shine, Fix It First, Guest Hero, Check-In Champion, Event Support Pro, Clean Sweep). Clean icons, simple accents.
- Streaks (optional): healthy habits (daily tasks 5 days, zero overdue 2 weeks, check-in duties 10 shifts). Soft resets, no punishment.
- Team competitions (optional): friendly sprints (maintenance week, event support, groundskeeping). Rewards: XP/badges.
- Performance dashboard: per-staff XP bar, level, badges, weekly challenge state, leaderboard placement, task analytics, guest review mentions, response times. Managers get team summaries only.
- Smart notifications: encouraging, actionable (“40 XP to Level 4—complete 3 tasks”, “Weekly challenge ends in 6 hours”, “You earned a badge for guest service excellence”).
- Anti-cheese design: no cartoon graphics or playful sounds; subtle gradients, clean typography, CRM/fitness-inspired.

## Sequencing (near → mid → long)
- Near (0–3 mo): offline/resilience; assignments/rig-fit hardening; payments/finops; comms timelines + deliverability; staff mobility v1.  
- Mid (3–9 mo): arrival automation; unified upsell engine; activities/rentals depth; data/forecasting; integrations wave 1.  
- Long (9–18 mo): developer ecosystem; AI Ops Copilot; IoT/utilities; enterprise/international.

## Payments & finops status (2025-12-06)
- Stripe Connect live for per-booking fees/plans with application fees and pass-through toggle in staff/public checkout.
- Gaps: no payout reconciliation/export job, no ledger lines for platform/Stripe fees or double-entry tie-out, no saved wallets/ACH/setup intents, and no chargeback/dispute UI/queues/evidence kits/alerts.
- Actions: add payout + fee journal and recon job + admin payout report, enable ACH/wallet methods with mandates and retries, build dispute center with webhook ingestion, evidence templates, alerts, and audit trail on payment actions.
- Behind the scenes: create Stripe test accounts/fixtures for payouts and disputes; add evidence kit templates and alert channels; wire payout/job telemetry to catch drift before GA.

## Communications automation status (2025-12-08)
- Webhooks: Postmark/Twilio webhooks persist provider message IDs and statuses; outbound email retries with backoff and fails over to SMTP; SMS retries with backoff. Sender domain allowlist enforced.
- Deliverability: DMARC/DKIM/SPF verification per sender domain with status surfaces; bounce/complaint classification feeds timelines/inbox; provider health badges on comms timelines.
- Templates/approvals: Per-campground template library with preview/smoke-send, versioning, approvals, and audit log; exposed in admin.
- Automation playbooks: Arrivals, unpaid balances, upsells, and abandoned cart sequences live with quiet hours, per-campground routing, throttles, and cron + manual runners; jobs monitor page added.
- Routing/SLAs: Inbox and guest/reservation timelines show ownership and SLA timers/badges; unread handling intact.
- Tests/verification: Manual DMARC/DKIM/SPF checks against sender domains, webhook receipt of provider message IDs and bounce/complaint normalization, playbook firing for arrival/unpaid/upsell/abandoned-cart triggers, and SLA badge behavior validated in inbox/reservation/guest views.

## Performance & reliability status (2025-12-21)
- SLOs: API p95 target `${SLO_API_P95_MS:-800}`ms, error rate ≤ `${SLO_API_ERROR_RATE:-0.01}`; jobs p95 target `${SLO_JOB_P95_MS:-30000}`ms, failure rate ≤ `${SLO_JOB_FAILURE_RATE:-0.02}`. Snapshot endpoint `/api/observability/snapshot` and UI at `/tech` surface live data.
- Perf budgets: CI step `pnpm --dir platform/apps/web budgets` enforces bundle size (total JS ≤ 0.8MB, per-route ≤ 250KB by default).
- Rate limits & queuing: Per-IP/org 429s via `PERF_RATE_LIMIT_*`; queue/backpressure for campaign dispatch and payout reconciliation with queue depth and timeouts recorded.
- DR readiness: Runbook at `docs/dr-readiness.md` with RPO/RTO, standby flip steps, and quarterly game-day drills.
- New hardening: API logger PII-masking shipped (email/phone/last4) with Jest coverage; post-completion checklist tracks alerts/UX/test polish; k6 perf smoke and `@smoke-hardening` E2E tagging guidance added.

## Notes / parking lot
- Image mirroring + external review connectors: Google Places live; RV Life left stubbed. S3 mirroring scaffolded; defer enabling (bucket/creds) until closer to go-live to avoid ongoing storage/egress costs. Trigger endpoints are in place (`/campgrounds/:id/refresh-reviews`, `/campgrounds/:id/mirror-photos`).
- Native app placeholder (PWA wrapper): ship a store-listed shell around current guest/staff PWA slices, reuse push preferences/registration stubs, and make offline parity explicit (same SW caches/queues and banners). No new backend scope beyond the existing push/offline stack.
- Mobile/offline audit (2025-12-06):
  - Gaps: no registered service worker or precache/runtime caching; guest PWA queues messages in localStorage only (no backoff/background sync); staff PWA falls back to blank when offline; POS and kiosk are online-only; push notifications not started; no surfaced sync logs/telemetry.
  - Sync/backoff plan: service worker with versioned precache for PWA shell + runtime caching (stale-while-revalidate, SW cache bust via version header); indexedDB-backed queue with operation type/resource/idempotency key/timestamps; replay with exponential backoff + jitter and background sync registration; conflict detection using ETags/updatedAt and “keep server/overwrite/merge” prompts where needed.
  - Scope for first hardening: arrivals/tasks, guest messages/orders/pay requests, OTA iCal import trigger, and inventory/order/payment operations. Add per-queue telemetry (last sync, successes/failures, next retry) and admin-visible sync logs.
  - Offline-safe screens still needed: POS checkout, kiosk flows (lookup, walk-in, payment capture), task updates, and portal store/activities so guests can browse cached content and queue intents.
  - Behind the scenes: add synthetic offline test harness, SW version pinning + busting, sync success/fail metrics, and alarms on queue depth/age; capture conflict samples to refine merge strategies.

## Dependencies & risks
- Data quality: enforce event schemas and idempotency for comms/payments.  
- Access control vendors: lead times and certification may slow arrival automation.  
- Offline sync: clear conflict resolution rules for inventory, payments, and tasks.  
- Compliance: SOC2 controls and PII handling gate multi-property/enterprise deals.
- Deliverability: DMARC/DKIM/SPF checks, bounce classification, and provider failover/backoff shipped; continue monitoring reputation and keep health alerts active before higher-volume sends.

## Public roadmap alignment
The public view should surface themes (Now/Next/Later) without sensitive dependencies. See `docs/roadmap-public.md` once generated.

## Audit checkpoint — 2025-12-06
- Communications Quality & Automation: deliverability health (DMARC/DKIM/SPF) and provider failover not yet verified; template library/approvals and event-based sequences still need implementation; inbox SLA/routing logic should be confirmed before send volume increases.
- Payments & Fintech Evolution: payout reconciliation jobs, ACH/wallet flows, and chargeback center surfaces are not observed yet; ensure ledger tie-out and evidence kit generation before broad rollout.
- Mobile & Offline: service worker/offline queues need durability and conflict resolution review; offline POS/kiosk and push notification preferences remain to be built; add telemetry for sync success/fail to catch edge cases.
- Recommendation: agents can continue with the above priorities; raise blockers if provider creds, Stripe Connect test accounts, or PWA offline testing harnesses are missing.

## Pre-ship QA & UI polish (2025-12-22) — in progress
- Scope: dev, staging, prod; Chromium first; call out Safari/Firefox/mobile gaps. No new features unless required to ship.
- Coverage matrix drafted: public booking + payments (cards/ACH/wallet gating), portal/PWA offline (My Stay, upsells, orders, messaging, activities), POS/kiosk (offline queue, refund/exchange, gift card redeem), admin ops/finance/support/marketing/settings, comms templates/playbooks/timelines, lead capture/referrals/promos, OTA stub, audit/exports, backup/DR, integrations/API/SDK smokes.
- UI/UX: professional nav regrouping (Core Ops, Calendar, Property/Inventory, Finance, Marketing/Social, Support, Settings/Admin), consistent spacing/typography/buttons/tables/cards, clean empty/loading/error states, mobile quick actions.
- Security/privacy: scope guard checks; per-camp/region gating for sensitive flows; PII redaction/consent; audit logs/exports; domain verification; backup/DR quick-audit; consent/PII export.
- Actions: run E2E audits per env; polish nav/visuals; log/fix only ship-blockers; re-smoke dev→staging→prod after fixes; document known limits (unsupported browsers).
