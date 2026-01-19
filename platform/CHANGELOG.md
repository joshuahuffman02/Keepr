# Changelog

## [Unreleased] - Phase 1-4 Implementation

### Security
- Upgrade Node.js runtime to 25.3.0 to include the async_hooks stack overflow DoS mitigation.

### Fixed
- Finalize campground onboarding launch by setting bookability and ensuring an owner membership is present.
- Align onboarding step payloads for operational hours, booking rules, waivers, and communications.
- Restrict onboarding invite creation/resend to authorized campground or organization members.
- Sanitize onboarding AI import filenames before writing to disk.
- Enforce onboarding reservation import token scope/expiry and filter imports to active sites.
- Block conflicting reservation imports, honor system pricing toggles, and dedupe guests in execution.
- Use consistent API base resolution for onboarding reservation import requests.
- Normalize chat attachment content types and filter support/partner chat history roles for web build typing.

### Added
- Onboarding import checklist with system-specific export prompts, coverage tracking, and warning override.
- Persist onboarding import system selection/override metadata on completion and highlight next exports to grab.
- Draft-save onboarding import selections immediately and show import coverage metadata on Review/Launch.
- Sync onboarding import draft coverage into wizard state and include checklist status in go-live warnings.
- In-chat support ticket composer with severity, transcript toggle, attachments, and SLA/email fallback messaging.

#### Phase 1: Pricing & Payments
- **Dynamic Pricing Engine** (`/pricing-v2`)
  - Rule types: season, weekend, holiday, event, demand-based
  - Stacking modes: additive, max, override
  - Priority ordering and rate caps (min/max)
  - Per-site-class and campground-wide rules
  
- **Deposit Policies** (`/deposit-policies`)
  - Strategies: first_night, percentage, fixed, full
  - Min/max amount caps
  - Due timing: at_booking, days_before_arrival, fixed_date
  - Auto-collect scheduling with retry/backoff
  
- **Upsells & Add-ons** (`/upsells`)
  - Pricing types: flat, per_night, per_guest, per_site
  - Inventory tracking option
  - Tax code support
  - Bundle support (UpsellBundle, UpsellBundleItem)
  
- **Idempotent Payments**
  - `Idempotency-Key` header support on payment endpoints
  - `IdempotencyKey` model for tracking request deduplication
  
- **Auto-Collect Cron** (`/auto-collect`)
  - Hourly cron job for balance collection
  - Retry with linear/exponential/fixed backoff
  - Cutoff hours before arrival
  - Notification on failure

- **Audit Logging**
  - All pricing/policy/upsell mutations logged to `AuditLog`
  - Before/after state capture
  - Actor tracking

#### Phase 2: Operations
- **Tasks & Housekeeping** (`/tasks`)
  - Task types: turnover, inspection, maintenance, custom
  - SLA tracking with at_risk/breached status
  - Site-ready notification on turnover completion
  - Kanban board UI at `/operations`

- **Group Bookings** (`/groups`)
  - Shared payment across linked reservations
  - Shared communications (primary contact only)
  - Group management UI at `/groups`

- **Self Check-in/out** (`/self-checkin`)
  - Prerequisite validation (payment, ID, waiver, site ready)
  - Damage reporting on checkout
  - Automatic task creation for damage inspection

#### Phase 3: Analytics
- **Dashboard Metrics API**
  - Revenue, ADR, RevPAR with period comparison
  - Occupancy percentage and night counts
  - Today's arrivals/departures
  - Outstanding balance totals

- **Revenue Trend** (12-month)
- **Occupancy Forecast** (30-day)
- **Task Metrics** (pending, in-progress, breached, at-risk)
- **Analytics Dashboard** at `/analytics`
- **Audit Log Entity Filtering**

#### Phase 4: Automation
- **Enhanced Waitlist**
  - Priority scoring algorithm (loyalty, wait time, date match, preferences)
  - Auto-offer capability for instant reservation
  - Fields: priority, autoOffer, maxPrice, flexibleDates, flexibleDays
  - Conversion tracking (convertedReservationId, convertedAt)
  - Stats endpoint

- **Notification Triggers** (`/notification-triggers`)
  - 12 event types: reservation_created, payment_received, checkin_reminder, etc.
  - Channels: email, sms, both
  - Delay scheduling (delayMinutes)
  - Conditional rules (conditions JSON)
  - Template variable interpolation
  - Cron job for scheduled notifications (every minute)

- **SMS Feature Flag**
  - `SMS_ENABLED` env var (defaults to true)
  - Twilio credential check
  - No-op mode with telemetry when not configured
  - Stats: attempted, sent, failed, skipped

### Phase 5: Finalization & UX polish
- **Waitlist Management UI** at `/waitlist` with stats, priority scoring, auto-offer, flexible dates, max price, and edit/remove actions.
- **Template Builder** at `/settings/templates` for email/SMS with preview, variables palette, categories, and delete/save flows.
- **Guest Portal Self-Service** at `/portal/manage` (date change, site change request, guest count update, cancel/pay balance link).
- **Calendar Settings** at `/calendar/settings` (color schemes, display toggles, auto-refresh intervals, shortcuts, export stubs).
- **AI UI Builder** at `/ai/ui-builder` for generating dashboard, report, and workflow layouts with json-render.
- **AI UI Builder UX upgrades** with prompt presets, loading/empty states, and saved layout drafts per campground.
- **SMS Safeguards**: Feature flag + Twilio credential check; logs telemetry and falls back to no-op when disabled/misconfigured.
- **Scheduled Notifications Cron**: `processScheduledNotifications` runs every minute via `@nestjs/schedule` (dev-ready).

### Remaining gaps / notes
- SMS delivery still requires valid Twilio credentials in env; otherwise runs in no-op with telemetry.
- API cron jobs rely on the schedule worker being active in the API process.
- Generated migration `20251210_phase4_notifications_final` is present (no schema delta from current DB).

### Schema Changes
- `PricingRuleV2`, `DemandBand`
- `DepositPolicy`, `AutoCollectSchedule`
- `UpsellItem`, `UpsellBundle`, `UpsellBundleItem`, `ReservationUpsell`
- `IdempotencyKey`
- `Task` (housekeeping/turnover)
- `Group` (linked reservations)
- `NotificationTrigger`, `ScheduledNotification`
- `WaitlistEntry` enhanced with priority/autoOffer fields

### Frontend Pages
| Path | Description |
|------|-------------|
| `/settings/pricing-rules` | Dynamic pricing rules management |
| `/settings/deposit-policies` | Deposit policy configuration |
| `/settings/upsells` | Upsell items catalog |
| `/settings/notification-triggers` | Automated notification setup |
| `/operations` | Housekeeping/task kanban board |
| `/groups` | Group booking management |
| `/analytics` | Real-time metrics dashboard |
| `/ai/ui-builder` | AI UI builder for dashboards, reports, and workflows |

### API Endpoints
- `GET/POST/PATCH/DELETE /campgrounds/:id/pricing-rules-v2`
- `GET/POST/PATCH/DELETE /campgrounds/:id/deposit-policies`
- `GET/POST/PATCH/DELETE /campgrounds/:id/upsells`
- `GET/POST/PATCH/DELETE /campgrounds/:id/notification-triggers`
- `GET/POST/PATCH/DELETE /tasks`
- `GET/POST/PATCH/DELETE /groups`
- `GET /campgrounds/:id/reports/dashboard-metrics`
- `GET /campgrounds/:id/reports/revenue-trend`
- `GET /campgrounds/:id/reports/occupancy-forecast`
- `GET /campgrounds/:id/reports/task-metrics`
- `GET /campgrounds/:id/waitlist/stats`
- `POST /reservations/:id/self-checkin`
- `POST /reservations/:id/self-checkout`
- `POST /ai/campgrounds/:campgroundId/ui-builder`

### Known Gaps / TODO
- **SMS Provider**: Requires Twilio credentials (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`). Falls back to no-op with logging if not configured.
- **Email Provider**: Requires SMTP or Postmark configuration. Falls back to console logging if not configured.
- **Waitlist UI**: Backend complete, frontend management page pending.
- **Template Builder**: Notification triggers reference templates but no visual builder yet.

### Environment Variables
```bash
# SMS (optional - no-op if not set)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
SMS_ENABLED=true  # Set to "false" to disable

# Email
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
POSTMARK_SERVER_TOKEN=  # Alternative to SMTP

# Waitlist
WAITLIST_NOTIFY_COOLDOWN_HOURS=6
```

### Migration
```bash
cd platform/apps/api
pnpm prisma db push --accept-data-loss  # For dev sync
# OR
pnpm prisma migrate dev --name phase4_notifications_waitlist  # For migration record
```
