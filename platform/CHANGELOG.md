# Changelog

## [Unreleased] - Phase 1-4 Implementation

### Security
- Upgrade Node.js runtime to 25.3.0 to include the async_hooks stack overflow DoS mitigation.
- Enforce role-scoped access on staff chat endpoints and add rate limits for public/support AI chat.
- Add guest consent/opt-out endpoints with hashed IP capture for AI chat consent records.

### Fixed
- Finalize campground onboarding launch by setting bookability and ensuring an owner membership is present.
- Stabilize toolchain and tests by cleaning Jest config, closing test modules, and standardizing Prisma client imports.
- Clear and unref synthetic check and job queue timeout timers to reduce lingering test handles.
- Run API Jest tests in-band by default; set `JEST_RUN_IN_BAND=false` and/or `JEST_MAX_WORKERS` to override, plus undici teardown/debug hooks to prevent worker exit warnings.
- Disable Turbo test task caching/outputs to prevent missing-output warnings in test pipelines.
- Guard alert webhook URLs and ensure abort timeouts are cleared/unrefed for delivery paths.
- Route lint/test/typecheck through Turbo and add per-package typecheck scripts.
- Remove the duplicate web ESLint config so `.eslintrc.cjs` is the single source.
- Align Vercel build config with the workspace web app output path and build commands.
- Add an app-level `vercel.json` for the web app so subdirectory deployments resolve `.next` correctly.
- Build the shared SDK before the web build in Vercel so OpenAPI contract types resolve.
- Propagate `x-request-id` between web and API, exposing it in CORS responses.
- Forward `x-request-id`/trace headers from API to Rust service calls.
- Add API log context fields (request/trace IDs) via AsyncLocalStorage.
- Add structured `http_request` access logs with method/path/status/duration.
- Add request ID and trace span metadata to Rust service request handling.
- Avoid Redis shutdown errors when the client never connected (e.g., OpenAPI generation).
- Align onboarding step payloads for operational hours, booking rules, waivers, and communications.
- Restrict onboarding invite creation/resend to authorized campground or organization members.
- Sanitize onboarding AI import filenames before writing to disk.
- Enforce onboarding reservation import token scope/expiry and filter imports to active sites.
- Block conflicting reservation imports, honor system pricing toggles, and dedupe guests in execution.
- Use consistent API base resolution for onboarding reservation import requests.
- Normalize chat attachment content types and filter support/partner chat history roles for web build typing.
- Fix staff chat message list scrolling so long KPI snapshots scroll inside the widget instead of the page.
- Harden nested long-response scroll containment to reduce page scroll bleed when message content scrolls.
- Capture non-passive wheel/touch scroll events in the chat message list to prevent page scroll bleed on trackpad/touch.
- Guard staff chat autoscroll and surface a jump-to-latest control for long responses.
- Prevent SSE chat responses from duplicating content when meta and text chunks are emitted together.
- Add tool result fact blocks in chat prompts to reduce contradictory KPI summaries.
- Stabilize analytics and gamification smoke tests by avoiding networkidle waits and aligning routes/UI selectors.
- Align staff/admin dashboard navigation spacing, including admin mobile header controls, with the desktop sidebar spacing guide.
- Chat tool cards now render availability/balance/task summaries even when tool outputs include a message string.
- Fix API OpenTelemetry bootstrap to use resource helpers compatible with the current SDK and tighten chat task query typing.
- Redact PII from chat tool execution logs.
- Accept the `open` state alias for chat task queries so ops can fetch pending/assigned/in-progress/blocked tasks.
- Hide the `get_tasks` tool cards in the staff chat UI to reduce noise when tasks are empty.
- Avoid overstating "no active sites configured" when occupancy returns zero and prompt for confirmation on far-future relative dates.
- Require confirmation for far-future or cross-year date ranges in chat tools and log staging availability summaries for debugging.
- Expand the chat shell when artifacts are open and make the artifact panel full width on small screens.
- Widen the artifact panel on desktop and pad the chat message list so report cards feel less cramped.

### Added
- Onboarding import checklist with system-specific export prompts, coverage tracking, and warning override.
- Changesets config plus CI status check for shared package release notes/versioning.
- Changesets usage guide and observability conventions documentation.
- Documented Rust services on Railway in deployment tables.
- OpenAPI-derived SDK types generated from the API spec via `openapi-typescript`.
- Authenticated `/flags` endpoints to evaluate feature flags per campground.
- Added `/ready` endpoints to Rust services for readiness checks.
- Optional API OpenTelemetry bootstrap (OTLP exporter + auto-instrumentation).
- Optional Rust OpenTelemetry exporters with OTLP trace propagation.
- Optional web OpenTelemetry bootstrap via `@vercel/otel`.
- OpenAPI contract test covering core platform paths.
- Web type-level OpenAPI contract checks via `@keepr/sdk`.
- Persist onboarding import system selection/override metadata on completion and highlight next exports to grab.
- Draft-save onboarding import selections immediately and show import coverage metadata on Review/Launch.
- Sync onboarding import draft coverage into wizard state and include checklist status in go-live warnings.
- In-chat support ticket composer with severity, transcript toggle, attachments, and SLA/email fallback messaging.
- Json-render report/graph cards inside the staff chat artifact panel.
- Occupancy and revenue tools now return json-render payloads for inline report charts and tables.
- Staff chat tool calls now show input/output cards, with a Playwright regression test for scroll behavior.
- Staff chat message rendering now supports markdown for richer KPI summaries.
- Staff chat now supports GFM tables, code block copy buttons, internal notes, new message markers, and message-level animations/skeletons.
- Staff chat now collapses long responses with a max-height scroll area and expand toggle.
- Staff chat now highlights json-render report summaries with a quick open-report action.
- Staff chat now auto-opens the artifact panel when a new report arrives and shows a KPI snapshot block for arrivals and occupancy trend.
- Staff chat now surfaces scroll hints for long response blocks.
- Staff chat now renders structured arrivals and occupancy tool cards instead of raw JSON output.
- Chat shell now adapts for mobile/kiosk sizing and long responses include keyboard/touch scroll controls with updated microcopy.
- Chat API now returns standardized message parts (text/tool/file/card) and supports transcript exports for staff and guest chats.
- Chat conversations can now be deleted per conversation or per user via new API endpoints.
- Chat tool execution endpoints now support direct staff/guest tool runs with pre-validation and optional conversation logging.
- Public booking chat now skips AI interaction and consent persistence for session-only behavior.
- Mode-specific chat system prompts now cover public guests, portal guests, staff ops, and support with PII guardrails.
- Staff chat approvals now include short action summaries, and staff can manage site holds via chat tools.
- Chat now supports reservation change requests for guests and open task summaries for staff.
- Chat tool mutations now emit audit log entries for traceability.
- Chat telemetry now tracks message sends, tool executions, action approvals, and stream latency/error signals via session IDs.
- Public/staff/guest chat payloads now propagate session IDs for engagement tracking and consent flows.
- AI cost tracking now emits budget warning signals when usage approaches monthly caps.
- Chat surfaces now honor feature flags by surface/campground (`chat_widget_staff`, `chat_widget_portal`, `chat_widget_public`, `chat_widget_support`).
- Added Playwright coverage for chat streaming, attachments, public booking flows, and staff action approvals.
- Added k6 load test script for peak chat traffic (`platform/docs/phase3/k6-chat-arrivals.js`).

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
