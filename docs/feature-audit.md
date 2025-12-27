# Feature Audit (Repo-Based)

Date: 2025-12-26 (Updated)
Scope: Repo scan of docs, UI routes, and API modules. Partial runtime validation.

Legend:
- ✅ Likely complete (UI + API present, no known blockers)
- ⚠️ Partial / unverified (exists but not validated or has known issues)
- 🧪 Stubbed / mock integration (UI/API exists, external integration not real)
- 🧩 Backend-only / indirect (API exists, no clear UI surface)
- ❌ Broken (explicitly documented as broken)
- ⏳ Planned / pending

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

| Feature | UI Surface(s) | API Module(s) | Status | Evidence / Notes | Needs Work |
| --- | --- | --- | --- | --- | --- |
| Public booking (V2) | `platform/apps/web/app/(public)/park/[slug]/book/page.tsx` | public-reservations, pricing | ⚠️ Partial | Payments flow unverified; recent policy acceptance changes | Verify payment + abandoned-cart + policy gating end-to-end |
| Public park pages | `platform/apps/web/app/(public)/park/[slug]/page.tsx`, `/v2/page.tsx` | public-reservations | ⚠️ Unverified | Landing/availability UI present | Validate availability + quote | 
| Staff reservations list | `platform/apps/web/app/reservations/page.tsx`, `platform/apps/web/app/campgrounds/[campgroundId]/reservations/page.tsx` | reservations | ⚠️ Unverified | Core UI exists | Validate create/update and conflicts |
| Reservation detail | `platform/apps/web/app/campgrounds/[campgroundId]/reservations/[reservationId]/page.tsx` | reservations, signatures | ⚠️ Partial | Policy signature section added; still unverified | Validate signatures + policy status |
| Booking calendar | `platform/apps/web/app/calendar/page.tsx` | reservations | ⏳ Planned | Marked as pending upgrade | Build full-width upgrade + drag/drop |
| Site map (interactive) | `platform/apps/web/app/campgrounds/[campgroundId]/map/page.tsx` | site-map | ✅ Working | Full editor (500+ lines), canvas, MapLibre, picker all functional | None - verified 2025-12-26 |
| Sites management | `platform/apps/web/app/campgrounds/[campgroundId]/sites/page.tsx` | sites | ⚠️ Unverified | UI exists | Verify CRUD + availability |
| Site classes | `platform/apps/web/app/campgrounds/[campgroundId]/classes/page.tsx` | site-classes | ⚠️ Unverified | UI exists | Validate class rules + pricing |
| Holds / site holds | (indirect from booking) | holds | 🧩 Backend-only | No obvious UI; used internally | Confirm hold creation/expiry UX |
| Waitlist | `platform/apps/web/app/waitlist/page.tsx` | waitlist | ⚠️ Partial | Seeded rows not visible | Fix list + notify flow |
| Group bookings | `platform/apps/web/app/groups/page.tsx`, `platform/apps/web/app/campgrounds/[campgroundId]/groups/page.tsx` | group-bookings, groups | ⚠️ Unverified | UI exists | Validate group rate logic |
| Room moves | (no clear UI) | room-moves | 🧩 Backend-only | Module exists | Add UI or confirm hidden usage |
| Blackout dates | `platform/apps/web/app/dashboard/settings/blackout-dates/page.tsx` | blackouts | ⚠️ Unverified | UI exists | Validate enforcement in availability |
| Pricing rules | `platform/apps/web/app/dashboard/settings/pricing-rules/page.tsx` | pricing | ⚠️ Unverified | UI exists | Verify rules impact on quotes |
| Pricing V2 | (no clear UI) | pricing-v2 | 🧩 Backend-only | Module exists | Decide if deprecated or surface UI |
| Seasonal rates | `platform/apps/web/app/dashboard/settings/seasonal-rates/page.tsx` | seasonal-rates | ⚠️ Unverified | UI exists | Verify rate overrides |
| Promotions | `platform/apps/web/app/dashboard/settings/promotions/page.tsx`, `/marketing/promotions/page.tsx` | promotions | ⚠️ Unverified | UI exists | Verify promo validation + stack |
| Deposit policies | `platform/apps/web/app/dashboard/settings/deposit-policies/page.tsx` | deposit-policies | ⚠️ Unverified | UI exists | Confirm required deposit calc |
| Campground policies | `platform/apps/web/app/dashboard/settings/policies/page.tsx` | policies, signatures | ⚠️ Partial | Recently added policy templates + booking UX | Validate policy enforcement + reminders |
| Waivers & signatures | `platform/apps/web/app/(public)/sign/[token]/page.tsx` | signatures, waivers | ⚠️ Partial | Compliance rules implemented | Verify sign flow + reminder cadence |
| Check-in / kiosk | `platform/apps/web/app/check-in-out/page.tsx`, `/check-in-out/v2/page.tsx`, `/kiosk/page.tsx` | self-checkin | ⚠️ Partial | Compliance blocking implemented | Validate kiosk end-to-end |
| Upsells | `platform/apps/web/app/dashboard/settings/upsells/page.tsx` | upsells | ⚠️ Unverified | UI exists | Verify charge injection |
| Workflows | `platform/apps/web/app/campgrounds/[campgroundId]/workflows/page.tsx` | workflows | ⚠️ Unverified | UI exists | Verify triggers/actions |
| Activities | `platform/apps/web/app/activities/page.tsx` | activities | ⚠️ Unverified | UI exists | Validate capacity & booking |
| Events | `platform/apps/web/app/events/page.tsx` | events | ⚠️ Unverified | UI exists | Validate scheduling |
| Rentals | `platform/apps/web/app/operations/rentals/page.tsx` | operations | 🧪 Stubbed | Equipment rentals local-only | Build external integration |

## 2) Guest Experience and CRM

| Feature | UI Surface(s) | API Module(s) | Status | Evidence / Notes | Needs Work |
| --- | --- | --- | --- | --- | --- |
| Guest list | `platform/apps/web/app/guests/page.tsx` | guests | ⚠️ Unverified | UI exists | Validate search + filters |
| Guest profile | `platform/apps/web/app/guests/[id]/page.tsx` | guests | ⚠️ Unverified | UI exists | Verify history + merges |
| Guest portal | `platform/apps/web/app/portal/*` | guest-auth, reservations | ⚠️ Partial | Magic link flow unverified | Validate portal auth + reservations |
| Reviews | `platform/apps/web/app/reviews/page.tsx` | reviews | ⚠️ Unverified | UI exists | Validate submissions/moderation |
| NPS | `platform/apps/web/app/nps/respond/page.tsx` | nps | ⚠️ Unverified | UI exists | Validate invite + response capture |
| Loyalty | `platform/apps/web/app/portal/rewards/page.tsx` | loyalty | ⚠️ Unverified | UI exists | Verify accrual + redemption |
| Gamification | `platform/apps/web/app/gamification/page.tsx` | gamification | ⚠️ Unverified | UI exists | Validate XP rules + rewards |
| Referrals | `platform/apps/web/app/dashboard/referrals/page.tsx` | referrals, org-referrals | ⚠️ Partial | Referral payouts stubbed | Implement payouts + audit |
| Forms | `platform/apps/web/app/forms/page.tsx` | forms | ⚠️ Unverified | UI exists | Validate form submissions |
| Messaging | `platform/apps/web/app/messages/page.tsx` | messages, internal-conversations | ⚠️ Unverified | UI exists | Verify threading + delivery |
| Guest equipment | (indirect from reservations) | guest-equipment | 🧩 Backend-only | Module exists | Surface in guest profile |

## 3) Operations, Staff, and Field Ops

| Feature | UI Surface(s) | API Module(s) | Status | Evidence / Notes | Needs Work |
| --- | --- | --- | --- | --- | --- |
| Maintenance tickets | `platform/apps/web/app/maintenance/page.tsx` | maintenance | ⚠️ Unverified | UI exists | Validate create/close flow |
| Tasks & operations | `platform/apps/web/app/operations/page.tsx`, `/operations/tasks/page.tsx` | tasks, operations | ⚠️ Unverified | Auto-task triggers stubbed | Implement triggers + SLAs |
| Housekeeping | `platform/apps/web/app/campgrounds/[campgroundId]/housekeeping/page.tsx`, `/pwa/housekeeping/page.tsx` | housekeeping | ⚠️ Unverified | UI exists | Validate sync/offline |
| Incidents | `platform/apps/web/app/incidents/page.tsx` | incidents | ⚠️ Unverified | UI exists | Validate evidence upload |
| Staff scheduling | `platform/apps/web/app/campgrounds/[campgroundId]/staff-scheduling/page.tsx` | staff | ⚠️ Unverified | UI exists | Validate shifts + availability |
| Time clock | `platform/apps/web/app/campgrounds/[campgroundId]/staff/timeclock/page.tsx` | staff | ⚠️ Unverified | UI exists | Validate time entries |
| Approvals | `platform/apps/web/app/approvals/page.tsx`, `platform/apps/web/app/campgrounds/[campgroundId]/staff/approvals/page.tsx` | approvals | ⚠️ Partial | Override approvals improved | Validate override audit UX |
| Overrides | `platform/apps/web/app/campgrounds/[campgroundId]/staff/overrides/page.tsx` | approvals | ⚠️ Partial | Recent rule enforcement | Validate staff workflows |
| Access control (IoT) | `platform/apps/web/app/dashboard/settings/access-control/page.tsx` | access-control, iot | 🧪 Stubbed | No real lock/meter APIs | Integrate hardware kit |
| PWA staff/guest | `platform/apps/web/app/pwa/*` | push-subscriptions | 🧪 Stubbed | Push notifications local-only | Add push server + tokens |

## 4) Payments and Finance

| Feature | UI Surface(s) | API Module(s) | Status | Evidence / Notes | Needs Work |
| --- | --- | --- | --- | --- | --- |
| Payments (Stripe) | (reservation flows) | payments | ⚠️ Partial | Public payment requires idempotency | Verify payment + refunds |
| Ledger | `platform/apps/web/app/ledger/page.tsx` | ledger | ⚠️ Unverified | UI exists | Validate posting rules |
| Payouts | `platform/apps/web/app/finance/payouts/page.tsx` | payments | ⚠️ Partial | Seed script failing | Fix seed + verify UI |
| Disputes | `platform/apps/web/app/finance/disputes/page.tsx` | payments | ⚠️ Partial | Seed data missing | Fix seed + verify UI |
| Gift cards | `platform/apps/web/app/gift-cards/page.tsx`, `/finance/gift-cards/page.tsx` | stored-value, gift-cards | ⚠️ Partial | Core issue/redeem works; adjust/void bugs fixed 2025-12-26 | Verify end-to-end flow |
| Repeat charges | `platform/apps/web/app/billing/repeat-charges/page.tsx` | repeat-charges | ⚠️ Unverified | UI exists | Validate schedule execution |
| Auto-collect | (no clear UI) | auto-collect | 🧩 Backend-only | Module exists | Add controls + audit |
| Tax rules | `platform/apps/web/app/dashboard/settings/tax-rules/page.tsx` | tax-rules, currency-tax | ⚠️ Unverified | UI exists | Validate waiver + exemptions |
| Utilities billing | `platform/apps/web/app/campgrounds/[campgroundId]/utilities-billing/page.tsx` | currency-tax | ⚠️ Unverified | UI exists | Validate metered billing |

## 5) Store and POS

| Feature | UI Surface(s) | API Module(s) | Status | Evidence / Notes | Needs Work |
| --- | --- | --- | --- | --- | --- |
| POS | `platform/apps/web/app/pos/page.tsx` | pos, payments, store | ✅ Working | Stock endpoints fixed (2025-12-26); proper error handling | None |
| Store catalog | `platform/apps/web/app/store/page.tsx` | store | ✅ Working | Inventory bridge fixed (2025-12-26) | None |
| Inventory movements | `platform/apps/web/app/store/inventory/movements/page.tsx` | store | ⚠️ Unverified | UI exists | Validate movement logs |
| Fulfillment | `platform/apps/web/app/store/fulfillment/page.tsx` | store | ⚠️ Unverified | UI exists | Validate pick/pack/ship |
| Transfers | `platform/apps/web/app/store/transfers/page.tsx` | store | ⚠️ Unverified | UI exists | Validate transfer actions |
| Locations | `platform/apps/web/app/store/locations/page.tsx` | store | ⚠️ Unverified | UI exists | Validate multi-location stock |

## 6) Communications and Marketing

| Feature | UI Surface(s) | API Module(s) | Status | Evidence / Notes | Needs Work |
| --- | --- | --- | --- | --- | --- |
| Campaigns | `platform/apps/web/app/dashboard/settings/campaigns/page.tsx` | campaigns | ⚠️ Unverified | UI exists | Verify sends + metrics |
| Templates | `platform/apps/web/app/dashboard/settings/templates/page.tsx` | communications | ⚠️ Partial | Consent + approval tightened | Validate template sending |
| Notification triggers | `platform/apps/web/app/dashboard/settings/notification-triggers/page.tsx` | notification-triggers | 🧪 Stubbed | Triggers not automated | Implement scheduler |
| Email/SMS | (various send UIs) | email, sms | ⚠️ Partial | SMS exists, email polish needed | Add SendGrid + retries |
| Abandoned cart | (no clear UI) | abandoned-cart | 🧪 Stubbed | Queue exists, internal endpoints | Wire into booking |
| Social planner | `platform/apps/web/app/social-planner/*` | social-planner | 🧪 Stubbed | Posting is local-only | Integrate social APIs |
| Marketing pages | `platform/apps/web/app/marketing/page.tsx` | promotions | ✅ Likely | Static UI | Refresh copy over time |

## 7) Analytics, Reporting, and AI

| Feature | UI Surface(s) | API Module(s) | Status | Evidence / Notes | Needs Work |
| --- | --- | --- | --- | --- | --- |
| Analytics dashboard | `platform/apps/web/app/analytics/page.tsx` | analytics | ⚠️ Unverified | UI exists | Validate metrics w/ data |
| Reports | `platform/apps/web/app/reports/page.tsx` | reports | ⚠️ Partial | Export pipeline exists | Seed data + validate CSV |
| Exports | `platform/apps/web/app/components/reports/*` | reports | ⚠️ Partial | Export job processor done | Validate end-to-end |
| Audit reporting | `platform/apps/web/app/reports/audit/page.tsx` | audit | ⚠️ Unverified | UI exists | Validate audit data |
| Anomalies | (no clear UI) | anomalies | 🧩 Backend-only | Module exists | Surface anomalies UI |
| AI assistant | `platform/apps/web/app/ai/page.tsx`, `/campgrounds/[id]/ai/page.tsx` | ai | ✅ Working | OpenAI integration live; booking assist, reply assist, insights all functional with API key | Set OPENAI_API_KEY in env |
| CampGuide AI | `platform/apps/web/app/campguide/page.tsx` | ai | ✅ Working | Uses same AI provider service | Set OPENAI_API_KEY in env |
| Dynamic pricing AI | `platform/apps/web/app/campgrounds/[campgroundId]/dynamic-pricing/page.tsx` | dynamic-pricing, pricing-v2 | ✅ Working | Real AI with occupancy/velocity data; formula fallback when AI unavailable | Set OPENAI_API_KEY in env |
| Semantic search | (no clear UI) | ai | ✅ Working | AI-powered search across guests/sites/messages; keyword fallback | Set OPENAI_API_KEY in env |

## 8) Integrations, Platform, and Admin

| Feature | UI Surface(s) | API Module(s) | Status | Evidence / Notes | Needs Work |
| --- | --- | --- | --- | --- | --- |
| OTA settings | `platform/apps/web/app/dashboard/settings/ota/page.tsx` | ota | ⚠️ Partial | Inbound works (iCal import, webhook receive); outbound push stubbed | Standard iCal pattern works |
| Webhooks | `platform/apps/web/app/dashboard/settings/webhooks/page.tsx` | integrations | ⚠️ Unverified | UI exists | Validate delivery + retries |
| Developer API | `platform/apps/web/app/dashboard/settings/developers/page.tsx` | developer-api | ⚠️ Unverified | UI exists | Validate API keys + docs |
| Integrations hub | `platform/apps/web/app/dashboard/settings/integrations/page.tsx` | integrations | ⚠️ Unverified | UI exists | Validate connections |
| Uploads | `platform/apps/web/app/dashboard/settings/photos/page.tsx` | uploads | ⚠️ Unverified | UI exists | Verify storage provider |
| Billing portal | `platform/apps/web/app/dashboard/settings/billing/page.tsx` | org-billing, usage-tracker | ✅ Likely | Marked done in priorities | Validate live usage data |
| Admin analytics | `platform/apps/web/app/admin/analytics/*` | platform-analytics | ⚠️ Unverified | UI exists | Verify data feeds |
| System health | `platform/apps/web/app/admin/system/health/page.tsx` | observability, perf | ⚠️ Unverified | UI exists | Wire metrics + alerts |
| Audit logs | `platform/apps/web/app/admin/system/audit/page.tsx` | audit | ⚠️ Unverified | UI exists | Verify event ingestion |
| Security & permissions | `platform/apps/web/app/security/page.tsx`, `/dashboard/settings/security/page.tsx`, `/dashboard/settings/permissions/page.tsx` | permissions | ⚠️ Unverified | UI exists | Validate RBAC scopes |
| Privacy / PII | `platform/apps/web/app/dashboard/settings/privacy/page.tsx` | privacy | 🧪 Stubbed | Redaction is stubbed | Implement redaction flows |
| Backup / DR | (no clear UI) | backup | 🧪 Stubbed | Simulated restore only | Wire real backups |
| Organizations | (admin/back office) | organizations | 🧩 Backend-only | Module exists | Confirm admin UI coverage |
| Early access | (admin/back office) | early-access | 🧩 Backend-only | Module exists | Confirm onboarding usage |

---

# Worklist (Top Gaps to Fix)

1) ~~Site map rebuild~~ ✅ VERIFIED WORKING (2025-12-26)
2) ~~POS inventory/stock endpoints~~ ✅ FIXED (2025-12-26) - proper 404 responses, frontend uses correct API
3) Public booking payment + abandoned cart end-to-end validation
4) Guest portal magic link + reservation visibility
5) Reports export: seed data + verify CSV/XLSX + email delivery
6) ~~Gift cards bugs~~ ✅ FIXED (2025-12-26) - verify end-to-end
7) Waitlist list rendering and notification flow
8) Email integration polish (SendGrid) + messaging playbooks validation

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

