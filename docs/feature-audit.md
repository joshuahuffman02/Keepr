# Feature Audit (Repo-Based)

Date: 2025-12-26 (Updated)
Scope: Repo scan of docs, UI routes, and API modules. Partial runtime validation.

Legend:

- [OK] Likely complete (UI + API present, no known blockers)
- [PARTIAL] Partial / unverified (exists but not validated or has known issues)
- [STUB] Stubbed / mock integration (UI/API exists, external integration not real)
- [API] Backend-only / indirect (API exists, no clear UI surface)
- [BROKEN] Broken (explicitly documented as broken)
- [PENDING] Planned / pending

Sources used:

- docs/KNOWN_LIMITATIONS.md
- platform/docs/FEATURE_PRIORITIES.md
- platform/docs/AUDIT_REPORT.md
- platform/docs/UI_UX_AUDIT.md
- audit-findings-dev.md
- UI routes under platform/apps/web/app
- API modules under platform/apps/api/src

---

## 1) Booking, Inventory, and Revenue

| Feature                 | UI Surface(s)                                                                                                           | API Module(s)                | Status    | Evidence / Notes                                                  | Needs Work                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------- | --------- | ----------------------------------------------------------------- | ---------------------------------------------------------- |
| Public booking (V2)     | `platform/apps/web/app/(public)/park/[slug]/book/page.tsx`                                                              | public-reservations, pricing | [PARTIAL] | Payments flow unverified; recent policy acceptance changes        | Verify payment + abandoned-cart + policy gating end-to-end |
| Public park pages       | `platform/apps/web/app/(public)/park/[slug]/page.tsx`, `/v2/page.tsx`                                                   | public-reservations          | [PARTIAL] | Landing/availability UI present                                   | Validate availability + quote                              |
| Staff reservations list | `platform/apps/web/app/reservations/page.tsx`, `platform/apps/web/app/campgrounds/[campgroundId]/reservations/page.tsx` | reservations                 | [PARTIAL] | Core UI exists                                                    | Validate create/update and conflicts                       |
| Reservation detail      | `platform/apps/web/app/campgrounds/[campgroundId]/reservations/[reservationId]/page.tsx`                                | reservations, signatures     | [PARTIAL] | Policy signature section added; still unverified                  | Validate signatures + policy status                        |
| Booking calendar        | `platform/apps/web/app/calendar/page.tsx`                                                                               | reservations                 | [PENDING] | Marked as pending upgrade                                         | Build full-width upgrade + drag/drop                       |
| Site map (interactive)  | `platform/apps/web/app/campgrounds/[campgroundId]/map/page.tsx`                                                         | site-map                     | [OK]      | Full editor (500+ lines), canvas, MapLibre, picker all functional | None - verified 2025-12-26                                 |
| Sites management        | `platform/apps/web/app/campgrounds/[campgroundId]/sites/page.tsx`                                                       | sites                        | [PARTIAL] | UI exists                                                         | Verify CRUD + availability                                 |
| Site classes            | `platform/apps/web/app/campgrounds/[campgroundId]/classes/page.tsx`                                                     | site-classes                 | [PARTIAL] | UI exists                                                         | Validate class rules + pricing                             |
| Holds / site holds      | (indirect from booking)                                                                                                 | holds                        | [API]     | No obvious UI; used internally                                    | Confirm hold creation/expiry UX                            |
| Waitlist                | `platform/apps/web/app/waitlist/page.tsx`                                                                               | waitlist                     | [PARTIAL] | Seeded rows not visible                                           | Fix list + notify flow                                     |
| Group bookings          | `platform/apps/web/app/groups/page.tsx`, `platform/apps/web/app/campgrounds/[campgroundId]/groups/page.tsx`             | group-bookings, groups       | [PARTIAL] | UI exists                                                         | Validate group rate logic                                  |
| Room moves              | (no clear UI)                                                                                                           | room-moves                   | [API]     | Module exists                                                     | Add UI or confirm hidden usage                             |
| Blackout dates          | `platform/apps/web/app/dashboard/settings/blackout-dates/page.tsx`                                                      | blackouts                    | [PARTIAL] | UI exists                                                         | Validate enforcement in availability                       |
| Pricing rules           | `platform/apps/web/app/dashboard/settings/pricing-rules/page.tsx`                                                       | pricing                      | [PARTIAL] | UI exists                                                         | Verify rules impact on quotes                              |
| Pricing V2              | (no clear UI)                                                                                                           | pricing-v2                   | [API]     | Module exists                                                     | Decide if deprecated or surface UI                         |
| Seasonal rates          | `platform/apps/web/app/dashboard/settings/seasonal-rates/page.tsx`                                                      | seasonal-rates               | [PARTIAL] | UI exists                                                         | Verify rate overrides                                      |
| Promotions              | `platform/apps/web/app/dashboard/settings/promotions/page.tsx`, `/marketing/promotions/page.tsx`                        | promotions                   | [PARTIAL] | UI exists                                                         | Verify promo validation + stack                            |
| Deposit policies        | `platform/apps/web/app/dashboard/settings/deposit-policies/page.tsx`                                                    | deposit-policies             | [PARTIAL] | UI exists                                                         | Confirm required deposit calc                              |
| Campground policies     | `platform/apps/web/app/dashboard/settings/policies/page.tsx`                                                            | policies, signatures         | [PARTIAL] | Recently added policy templates + booking UX                      | Validate policy enforcement + reminders                    |
| Waivers & signatures    | `platform/apps/web/app/(public)/sign/[token]/page.tsx`                                                                  | signatures, waivers          | [PARTIAL] | Compliance rules implemented                                      | Verify sign flow + reminder cadence                        |
| Check-in / kiosk        | `platform/apps/web/app/check-in-out/page.tsx`, `/check-in-out/v2/page.tsx`, `/kiosk/page.tsx`                           | self-checkin                 | [PARTIAL] | Compliance blocking implemented                                   | Validate kiosk end-to-end                                  |
| Upsells                 | `platform/apps/web/app/dashboard/settings/upsells/page.tsx`                                                             | upsells                      | [PARTIAL] | UI exists                                                         | Verify charge injection                                    |
| Workflows               | `platform/apps/web/app/campgrounds/[campgroundId]/workflows/page.tsx`                                                   | workflows                    | [PARTIAL] | UI exists                                                         | Verify triggers/actions                                    |
| Activities              | `platform/apps/web/app/activities/page.tsx`                                                                             | activities                   | [PARTIAL] | UI exists                                                         | Validate capacity & booking                                |
| Events                  | `platform/apps/web/app/events/page.tsx`                                                                                 | events                       | [PARTIAL] | UI exists                                                         | Validate scheduling                                        |
| Rentals                 | `platform/apps/web/app/operations/rentals/page.tsx`                                                                     | operations                   | [STUB]    | Equipment rentals local-only                                      | Build external integration                                 |

## 2) Guest Experience and CRM

| Feature         | UI Surface(s)                                        | API Module(s)                    | Status    | Evidence / Notes           | Needs Work                          |
| --------------- | ---------------------------------------------------- | -------------------------------- | --------- | -------------------------- | ----------------------------------- |
| Guest list      | `platform/apps/web/app/guests/page.tsx`              | guests                           | [PARTIAL] | UI exists                  | Validate search + filters           |
| Guest profile   | `platform/apps/web/app/guests/[id]/page.tsx`         | guests                           | [PARTIAL] | UI exists                  | Verify history + merges             |
| Guest portal    | `platform/apps/web/app/portal/*`                     | guest-auth, reservations         | [PARTIAL] | Magic link flow unverified | Validate portal auth + reservations |
| Reviews         | `platform/apps/web/app/reviews/page.tsx`             | reviews                          | [PARTIAL] | UI exists                  | Validate submissions/moderation     |
| NPS             | `platform/apps/web/app/nps/respond/page.tsx`         | nps                              | [PARTIAL] | UI exists                  | Validate invite + response capture  |
| Loyalty         | `platform/apps/web/app/portal/rewards/page.tsx`      | loyalty                          | [PARTIAL] | UI exists                  | Verify accrual + redemption         |
| Gamification    | `platform/apps/web/app/gamification/page.tsx`        | gamification                     | [PARTIAL] | UI exists                  | Validate XP rules + rewards         |
| Referrals       | `platform/apps/web/app/dashboard/referrals/page.tsx` | referrals, org-referrals         | [PARTIAL] | Referral payouts stubbed   | Implement payouts + audit           |
| Forms           | `platform/apps/web/app/forms/page.tsx`               | forms                            | [PARTIAL] | UI exists                  | Validate form submissions           |
| Messaging       | `platform/apps/web/app/messages/page.tsx`            | messages, internal-conversations | [PARTIAL] | UI exists                  | Verify threading + delivery         |
| Guest equipment | (indirect from reservations)                         | guest-equipment                  | [API]     | Module exists              | Surface in guest profile            |

## 3) Operations, Staff, and Field Ops

| Feature              | UI Surface(s)                                                                                                           | API Module(s)       | Status    | Evidence / Notes              | Needs Work                     |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------- | --------- | ----------------------------- | ------------------------------ |
| Maintenance tickets  | `platform/apps/web/app/maintenance/page.tsx`                                                                            | maintenance         | [PARTIAL] | UI exists                     | Validate create/close flow     |
| Tasks & operations   | `platform/apps/web/app/operations/page.tsx`, `/operations/tasks/page.tsx`                                               | tasks, operations   | [PARTIAL] | Auto-task triggers stubbed    | Implement triggers + SLAs      |
| Housekeeping         | `platform/apps/web/app/campgrounds/[campgroundId]/housekeeping/page.tsx`, `/pwa/housekeeping/page.tsx`                  | housekeeping        | [PARTIAL] | UI exists                     | Validate sync/offline          |
| Incidents            | `platform/apps/web/app/incidents/page.tsx`                                                                              | incidents           | [PARTIAL] | UI exists                     | Validate evidence upload       |
| Staff scheduling     | `platform/apps/web/app/campgrounds/[campgroundId]/staff-scheduling/page.tsx`                                            | staff               | [PARTIAL] | UI exists                     | Validate shifts + availability |
| Time clock           | `platform/apps/web/app/campgrounds/[campgroundId]/staff/timeclock/page.tsx`                                             | staff               | [PARTIAL] | UI exists                     | Validate time entries          |
| Approvals            | `platform/apps/web/app/approvals/page.tsx`, `platform/apps/web/app/campgrounds/[campgroundId]/staff/approvals/page.tsx` | approvals           | [PARTIAL] | Override approvals improved   | Validate override audit UX     |
| Overrides            | `platform/apps/web/app/campgrounds/[campgroundId]/staff/overrides/page.tsx`                                             | approvals           | [PARTIAL] | Recent rule enforcement       | Validate staff workflows       |
| Access control (IoT) | `platform/apps/web/app/dashboard/settings/access-control/page.tsx`                                                      | access-control, iot | [STUB]    | No real lock/meter APIs       | Integrate hardware kit         |
| PWA staff/guest      | `platform/apps/web/app/pwa/*`                                                                                           | push-subscriptions  | [STUB]    | Push notifications local-only | Add push server + tokens       |

## 4) Payments and Finance

| Feature           | UI Surface(s)                                                                 | API Module(s)            | Status    | Evidence / Notes                                           | Needs Work                   |
| ----------------- | ----------------------------------------------------------------------------- | ------------------------ | --------- | ---------------------------------------------------------- | ---------------------------- |
| Payments (Stripe) | (reservation flows)                                                           | payments                 | [PARTIAL] | Public payment requires idempotency                        | Verify payment + refunds     |
| Ledger            | `platform/apps/web/app/ledger/page.tsx`                                       | ledger                   | [PARTIAL] | UI exists                                                  | Validate posting rules       |
| Payouts           | `platform/apps/web/app/finance/payouts/page.tsx`                              | payments                 | [PARTIAL] | Seed script failing                                        | Fix seed + verify UI         |
| Disputes          | `platform/apps/web/app/finance/disputes/page.tsx`                             | payments                 | [PARTIAL] | Seed data missing                                          | Fix seed + verify UI         |
| Gift cards        | `platform/apps/web/app/gift-cards/page.tsx`, `/finance/gift-cards/page.tsx`   | stored-value, gift-cards | [PARTIAL] | Core issue/redeem works; adjust/void bugs fixed 2025-12-26 | Verify end-to-end flow       |
| Repeat charges    | `platform/apps/web/app/billing/repeat-charges/page.tsx`                       | repeat-charges           | [PARTIAL] | UI exists                                                  | Validate schedule execution  |
| Auto-collect      | (no clear UI)                                                                 | auto-collect             | [API]     | Module exists                                              | Add controls + audit         |
| Tax rules         | `platform/apps/web/app/dashboard/settings/tax-rules/page.tsx`                 | tax-rules, currency-tax  | [PARTIAL] | UI exists                                                  | Validate waiver + exemptions |
| Utilities billing | `platform/apps/web/app/campgrounds/[campgroundId]/utilities-billing/page.tsx` | currency-tax             | [PARTIAL] | UI exists                                                  | Validate metered billing     |

## 5) Store and POS

| Feature             | UI Surface(s)                                              | API Module(s)        | Status    | Evidence / Notes                                          | Needs Work                    |
| ------------------- | ---------------------------------------------------------- | -------------------- | --------- | --------------------------------------------------------- | ----------------------------- |
| POS                 | `platform/apps/web/app/pos/page.tsx`                       | pos, payments, store | [OK]      | Stock endpoints fixed (2025-12-26); proper error handling | None                          |
| Store catalog       | `platform/apps/web/app/store/page.tsx`                     | store                | [OK]      | Inventory bridge fixed (2025-12-26)                       | None                          |
| Inventory movements | `platform/apps/web/app/store/inventory/movements/page.tsx` | store                | [PARTIAL] | UI exists                                                 | Validate movement logs        |
| Fulfillment         | `platform/apps/web/app/store/fulfillment/page.tsx`         | store                | [PARTIAL] | UI exists                                                 | Validate pick/pack/ship       |
| Transfers           | `platform/apps/web/app/store/transfers/page.tsx`           | store                | [PARTIAL] | UI exists                                                 | Validate transfer actions     |
| Locations           | `platform/apps/web/app/store/locations/page.tsx`           | store                | [PARTIAL] | UI exists                                                 | Validate multi-location stock |

## 6) Communications and Marketing

| Feature               | UI Surface(s)                                                             | API Module(s)         | Status    | Evidence / Notes                 | Needs Work                |
| --------------------- | ------------------------------------------------------------------------- | --------------------- | --------- | -------------------------------- | ------------------------- |
| Campaigns             | `platform/apps/web/app/dashboard/settings/campaigns/page.tsx`             | campaigns             | [PARTIAL] | UI exists                        | Verify sends + metrics    |
| Templates             | `platform/apps/web/app/dashboard/settings/templates/page.tsx`             | communications        | [PARTIAL] | Consent + approval tightened     | Validate template sending |
| Notification triggers | `platform/apps/web/app/dashboard/settings/notification-triggers/page.tsx` | notification-triggers | [STUB]    | Triggers not automated           | Implement scheduler       |
| Email/SMS             | (various send UIs)                                                        | email, sms            | [PARTIAL] | SMS exists, email polish needed  | Add SendGrid + retries    |
| Abandoned cart        | (no clear UI)                                                             | abandoned-cart        | [STUB]    | Queue exists, internal endpoints | Wire into booking         |
| Social planner        | `platform/apps/web/app/social-planner/*`                                  | social-planner        | [STUB]    | Posting is local-only            | Integrate social APIs     |
| Marketing pages       | `platform/apps/web/app/marketing/page.tsx`                                | promotions            | [OK]      | Static UI                        | Refresh copy over time    |

## 7) Analytics, Reporting, and AI

| Feature             | UI Surface(s)                                                               | API Module(s)               | Status    | Evidence / Notes                                                                            | Needs Work                |
| ------------------- | --------------------------------------------------------------------------- | --------------------------- | --------- | ------------------------------------------------------------------------------------------- | ------------------------- |
| Analytics dashboard | `platform/apps/web/app/analytics/page.tsx`                                  | analytics                   | [PARTIAL] | UI exists                                                                                   | Validate metrics w/ data  |
| Reports             | `platform/apps/web/app/reports/page.tsx`                                    | reports                     | [PARTIAL] | Export pipeline exists                                                                      | Seed data + validate CSV  |
| Exports             | `platform/apps/web/app/components/reports/*`                                | reports                     | [PARTIAL] | Export job processor done                                                                   | Validate end-to-end       |
| Audit reporting     | `platform/apps/web/app/reports/audit/page.tsx`                              | audit                       | [PARTIAL] | UI exists                                                                                   | Validate audit data       |
| Anomalies           | (no clear UI)                                                               | anomalies                   | [API]     | Module exists                                                                               | Surface anomalies UI      |
| AI assistant        | `platform/apps/web/app/ai/page.tsx`, `/campgrounds/[id]/ai/page.tsx`        | ai                          | [OK]      | OpenAI integration live; booking assist, reply assist, insights all functional with API key | Set OPENAI_API_KEY in env |
| CampGuide AI        | `platform/apps/web/app/campguide/page.tsx`                                  | ai                          | [OK]      | Uses same AI provider service                                                               | Set OPENAI_API_KEY in env |
| Dynamic pricing AI  | `platform/apps/web/app/campgrounds/[campgroundId]/dynamic-pricing/page.tsx` | dynamic-pricing, pricing-v2 | [OK]      | Real AI with occupancy/velocity data; formula fallback when AI unavailable                  | Set OPENAI_API_KEY in env |
| Semantic search     | (no clear UI)                                                               | ai                          | [OK]      | AI-powered search across guests/sites/messages; keyword fallback                            | Set OPENAI_API_KEY in env |

## 8) Integrations, Platform, and Admin

| Feature                | UI Surface(s)                                                                                                                  | API Module(s)              | Status    | Evidence / Notes                                                    | Needs Work                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------- | --------- | ------------------------------------------------------------------- | --------------------------- |
| OTA settings           | `platform/apps/web/app/dashboard/settings/ota/page.tsx`                                                                        | ota                        | [PARTIAL] | Inbound works (iCal import, webhook receive); outbound push stubbed | Standard iCal pattern works |
| Webhooks               | `platform/apps/web/app/dashboard/settings/webhooks/page.tsx`                                                                   | integrations               | [PARTIAL] | UI exists                                                           | Validate delivery + retries |
| Developer API          | `platform/apps/web/app/dashboard/settings/developers/page.tsx`                                                                 | developer-api              | [PARTIAL] | UI exists                                                           | Validate API keys + docs    |
| Integrations hub       | `platform/apps/web/app/dashboard/settings/integrations/page.tsx`                                                               | integrations               | [PARTIAL] | UI exists                                                           | Validate connections        |
| Uploads                | `platform/apps/web/app/dashboard/settings/photos/page.tsx`                                                                     | uploads                    | [PARTIAL] | UI exists                                                           | Verify storage provider     |
| Billing portal         | `platform/apps/web/app/dashboard/settings/billing/page.tsx`                                                                    | org-billing, usage-tracker | [OK]      | Marked done in priorities                                           | Validate live usage data    |
| Admin analytics        | `platform/apps/web/app/admin/analytics/*`                                                                                      | platform-analytics         | [PARTIAL] | UI exists                                                           | Verify data feeds           |
| System health          | `platform/apps/web/app/admin/system/health/page.tsx`                                                                           | observability, perf        | [PARTIAL] | UI exists                                                           | Wire metrics + alerts       |
| Audit logs             | `platform/apps/web/app/admin/system/audit/page.tsx`                                                                            | audit                      | [PARTIAL] | UI exists                                                           | Verify event ingestion      |
| Security & permissions | `platform/apps/web/app/security/page.tsx`, `/dashboard/settings/security/page.tsx`, `/dashboard/settings/permissions/page.tsx` | permissions                | [PARTIAL] | UI exists                                                           | Validate RBAC scopes        |
| Privacy / PII          | `platform/apps/web/app/dashboard/settings/privacy/page.tsx`                                                                    | privacy                    | [STUB]    | Redaction is stubbed                                                | Implement redaction flows   |
| Backup / DR            | (no clear UI)                                                                                                                  | backup                     | [STUB]    | Simulated restore only                                              | Wire real backups           |
| Organizations          | (admin/back office)                                                                                                            | organizations              | [API]     | Module exists                                                       | Confirm admin UI coverage   |
| Early access           | (admin/back office)                                                                                                            | early-access               | [API]     | Module exists                                                       | Confirm onboarding usage    |

---

# Worklist (Top Gaps to Fix)

1. ~~Site map rebuild~~ [OK] VERIFIED WORKING (2025-12-26)
2. ~~POS inventory/stock endpoints~~ [OK] FIXED (2025-12-26) - proper 404 responses, frontend uses correct API
3. Public booking payment + abandoned cart end-to-end validation
4. Guest portal magic link + reservation visibility
5. Reports export: seed data + verify CSV/XLSX + email delivery
6. ~~Gift cards bugs~~ [OK] FIXED (2025-12-26) - verify end-to-end
7. Waitlist list rendering and notification flow
8. Email integration polish (SendGrid) + messaging playbooks validation

---

# Enhancement Ideas (If Features Are “Good”)

- Booking: add policy/waiver readiness banner on reservation cards and calendar to reduce front-desk surprises.
- Calendar: build drag-and-drop with multi-site selection + conflict overlays.
- Map: full-screen immersive map with hover-to-hold and live availability.
- POS: implement fuzzy search, favorite items, and offline replays surfaced in UI.
- Comms: delivery analytics per reservation; retry/backoff dashboards for SMS/email.
- Analytics: AI-generated executive summaries; anomaly explanations with actions.
- Ops: offline-first mobile maintenance/housekeeping app with rapid sync.

---

# Notes

This audit is repo-based. For a production readiness pass, we should run a verification sweep:

- 10–20 high-impact flows tested end-to-end with seeded data
- API health checks + error logs
- UI “zero data” states validated for each main module
