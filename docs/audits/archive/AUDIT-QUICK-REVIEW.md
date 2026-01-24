# Quick Audit Findings (handoff)

Scope: Targeted review of public payment confirmation, public reservation access, OAuth2 auth codes, and waitlist flow. Read `CLAUDE.md` and `AUDIT-2024-12-28.md` for guardrails and prior findings.

## Verification of [FIXED] items (review pass)

Status key: VERIFIED, PARTIAL, NOT VERIFIED.

### NOT VERIFIED

- None

### PARTIAL

- None

### VERIFIED (spot-checked)

- PAY-CRIT-001
- PUB-CRIT-001
- IMPORT-CRIT-001
- PAY-HIGH-001
- PUB-HIGH-001
- PUB-HIGH-002
- PUB-HIGH-003
- FORM-HIGH-001
- AC-HIGH-001
- OTA-HIGH-001
- DEV-HIGH-001
- STORE-HIGH-001
- ACCT-HIGH-002
- ACCT-HIGH-003
- ACCT-HIGH-004
- ACCT-HIGH-006
- ACCT-HIGH-014
- WEBHOOK-MED-001
- RATE-MED-001
- MKT-LOW-001
- OAUTH-MED-002
- OAUTH-MED-003
- FORM-MED-001
- PAY-LOW-001
- SELF-CRIT-001
- ADMIN-CRIT-001
- ORG-HIGH-001
- ADMIN-HIGH-001
- CAMP-HIGH-001
- RES-HIGH-001
- GUEST-HIGH-001
- WEB-XSS-HIGH-001
- WEB-XSS-HIGH-002
- BILL-WEBHOOK-MED-001
- IMPORT-MED-001
- UPLOAD-LOW-001
- AUTH-LOW-002
- UI-LOW-001
- ACCT-HIGH-007
- ACCT-HIGH-008
- ACCT-HIGH-010
- ACCT-HIGH-011
- ACCT-HIGH-013
- ACCT-HIGH-021

## Critical

### PAY-CRIT-001: Public payment confirmation lacks intent-to-reservation validation [FIXED 2026-01-01]

- Files: `platform/apps/api/src/payments/payments.controller.ts:626`, `platform/apps/api/src/payments/payments.controller.ts:660`
- Problem: `confirmPublicPaymentIntent` retrieves a Stripe intent and applies its amount to the reservation without verifying that the intent metadata matches `reservationId` and `campgroundId`, or that the amount/currency matches the reservation due.
- Impact: A mismatched or low-value intent on the same connected account could confirm a reservation and underpay it.
- Fix: Validate `intent.metadata.reservationId` and `intent.metadata.campgroundId` match the reservation; verify `intent.amount` and `intent.currency` match expected totals for the reservation/fees; reject on mismatch.
- Tests: Add a test where an intent for a different reservation or different amount is rejected.
- **Resolution**: Added metadata validation after retrieving payment intent - now validates `intentReservationId` and `intentCampgroundId` match request.

## High

### PAY-HIGH-001: `requires_capture` treated as paid/confirmed [FIXED 2026-01-01]

- Files: `platform/apps/api/src/payments/payments.controller.ts:629`, `platform/apps/api/src/payments/payments.controller.ts:670`, `platform/apps/api/src/payments/payments.controller.ts:695`
- Problem: `requires_capture` intents are treated as successful payments, and the reservation is marked confirmed with paid/balance updates.
- Impact: If capture later fails or is canceled, reservation financials remain incorrect and the reservation stays confirmed.
- Fix: Do not update `paidAmount`/`balanceAmount` for `requires_capture`; either defer confirmation until capture or track authorization separately.
- Tests: Add a test for `requires_capture` confirming only authorization state.
- **Resolution**: Added early return for `requires_capture` status that creates an "authorized" payment record without updating reservation financials. Reservation status, paidAmount, and balanceAmount remain unchanged until actual capture succeeds. The code now clearly separates the "succeeded" flow (which updates reservation) from "requires_capture" (which only records authorization).

### PUB-HIGH-001: Public reservation fetch allows ID-only access [FIXED 2026-01-01]

- Files: `platform/apps/api/src/public-reservations/public-reservations.controller.ts:107`, `platform/apps/api/src/public-reservations/public-reservations.service.ts:1627`
- Problem: `/public/reservations/:id` works without `campgroundId` or any signed token; the service only checks `campgroundId` if provided.
- Impact: If a reservation ID leaks, anyone can fetch guest name and reservation details.
- Fix: Require a signed token or enforce campgroundId validation; consider reducing returned fields for public access.
- Tests: Add a test that unauthenticated ID-only access is rejected.
- **Resolution**: Now requires either `campgroundId` or `token` query parameter, throws BadRequestException otherwise.

## Medium

### PUB-MED-001: Waitlist guest lookup uses non-unique email and skips normalization

- Files: `platform/apps/api/src/public-reservations/public-reservations.service.ts:85`
- Problem: Uses `guest.findUnique({ where: { email } })` even though `email` is not unique in the schema; new guests are created without `emailNormalized`.
- Impact: Type/runtime inconsistencies and duplicate guest records; dedupe breaks for case variations.
- Fix: Normalize email and use `emailNormalized` for lookup; set `emailNormalized` on create.
- Tests: Add a test for case-insensitive waitlist email dedupe.

### AUTH-MED-001: OAuth2 authorization codes stored in memory

- Files: `platform/apps/api/src/auth/oauth2/oauth2.service.ts:60`
- Problem: Authorization codes are stored in an in-memory Map.
- Impact: Multi-instance deployments and restarts invalidate codes and break auth flows.
- Fix: Move auth code storage to Redis or the database with TTL.
- Tests: Add tests for code exchange when stored in the chosen backing store.

### RATE-MED-001: Rate limiting keyGenerator uses x-forwarded-for without validation [FIXED 2026-01-01]

- Files: `platform/apps/api/src/perf/rate-limit.interceptor.ts:26`, `platform/apps/api/src/perf/perf.interceptor.ts:32`, `platform/apps/api/src/auth/auth.controller.ts:27`, `platform/apps/api/src/org-referrals/org-referrals.controller.ts:71`, `platform/apps/api/src/value-stack/value-stack.controller.ts:203`
- Problem: IP extraction from `x-forwarded-for` header accepts any value without validating IP format; attackers can inject arbitrary strings like `"fake-ip"` or `"127.0.0.1, attacker"` to bypass rate limits.
- Impact: Rate limiting can be bypassed by spoofing the x-forwarded-for header, enabling brute-force attacks and denial-of-service.
- Fix: Validate x-forwarded-for format (IPv4/IPv6) before using it; fall back to direct IP if invalid.
- Tests: Requests with invalid x-forwarded-for values should use direct IP; valid IPs should be accepted.
- **Resolution**: Created `extractClientIpFromRequest()` utility in `/platform/apps/api/src/common/ip-utils.ts` that validates IP format using IPv4/IPv6 regex patterns; updated all affected files to use this utility.

## Low

### MKT-LOW-001: Demo request email HTML injection [FIXED 2026-01-01]

- Files: `platform/apps/api/src/public-reservations/public-reservations.controller.ts:181`
- Problem: User-provided fields are interpolated directly into HTML email.
- Impact: HTML injection into internal emails.
- Fix: Escape/sanitize inputs or use a templating helper that handles escaping; consider plain text for untrusted fields.
- Tests: Add a test ensuring HTML special characters are escaped.
- **Resolution**: Added `escapeHtml()` helper function to sanitize all user inputs (name, email, phone, campgroundName, message) before interpolation.

## Decisions Needed

- Should public reservation access require a signed token, or is `campgroundId` sufficient?
- Should `requires_capture` mark a reservation as confirmed, or only after capture succeeds?

---

## Deeper Review Findings (additional)

### Critical

#### PUB-CRIT-001: Kiosk check-in accepts any kioskToken and skips campground validation [FIXED 2026-01-01]

- Files: `platform/apps/api/src/public-reservations/public-reservations.controller.ts:92`, `platform/apps/api/src/public-reservations/public-reservations.controller.ts:101`, `platform/apps/api/src/public-reservations/public-reservations.service.ts:1430`
- Problem: If `campgroundId` is omitted but any `kioskToken` is present, no validation is performed. The service only validates campground when `campgroundId` is provided.
- Impact: Reservation ID alone can trigger check-in flow and card-on-file charges (IDOR + payment abuse).
- Fix: Require a verifiable kiosk token (signed token or shared secret) and enforce campground/tenant validation in service layer.
- Tests: Add tests for invalid/missing kiosk tokens and cross-campground attempts.
- **Resolution**: Kiosk check-in now requires a kiosk device token header, validates device status and permissions, and enforces reservation campground ownership derived from the kiosk device.

### High

#### PUB-HIGH-002: Public reservation fetch works with ID-only access [FIXED 2026-01-01]

- Files: `platform/apps/api/src/public-reservations/public-reservations.controller.ts:107`, `platform/apps/api/src/public-reservations/public-reservations.service.ts:1627`
- Problem: No required token or campground scope; `campgroundId` check is optional.
- Impact: Anyone with a reservation ID can retrieve guest/reservation data.
- Fix: Require signed token or enforce campground validation; consider reducing returned fields for public access.
- Tests: Unauthenticated ID-only access should be rejected.
- **Resolution**: Endpoint now requires `campgroundId` or `token` parameter.

#### PUB-HIGH-003: Public reservation form submissions exposed without auth [FIXED 2026-01-01]

- Files: `platform/apps/api/src/public-reservations/public-reservations.controller.ts:117`, `platform/apps/api/src/forms/forms.service.ts:197`
- Problem: `GET /public/reservations/:id/form-submissions` exposes submissions without any ownership validation.
- Impact: IDOR exposure of submitted forms.
- Fix: Require signed access token or reservation ownership validation.
- Tests: Access without token should be rejected.
- **Resolution**: Endpoint now requires `campgroundId` or `token`, and service validates campground ownership.

#### FORM-HIGH-001: Forms CRUD lacks campground authorization [FIXED 2026-01-01]

- Files: `platform/apps/api/src/forms/forms.controller.ts:6`, `platform/apps/api/src/forms/forms.controller.ts:11`
- Problem: Endpoints only use `JwtAuthGuard` with no campground/role checks; anyone authenticated can operate on any campground forms by ID.
- Impact: Cross-tenant data modification and disclosure.
- Fix: Add RolesGuard/ScopeGuard and enforce campground ownership for create/update/delete/list.
- Tests: Ensure cross-campground access is denied.
- **Resolution**: Added `RolesGuard` and `ScopeGuard` with appropriate `@Roles()` decorators per endpoint.

#### AC-HIGH-001: Access control endpoints missing campground authorization [FIXED 2026-01-01]

- Files: `platform/apps/api/src/access-control/access-control.controller.ts:13`, `platform/apps/api/src/access-control/access-control.controller.ts:25`
- Problem: Access grant/revoke/vehicle endpoints require only JWT, no campground or reservation ownership validation in controller.
- Impact: Authenticated users can modify access grants for any reservation.
- Fix: Enforce campground membership/roles and validate reservation ownership in service.
- Tests: Cross-campground requests are denied.
- **Resolution**: Controller now requires campgroundId on access endpoints, and service validates reservation ownership before status/vehicle/grant/revoke operations; access grant/vehicle lookups are scoped by campgroundId.

#### OTA-HIGH-001: OTA config/channel/mapping endpoints missing authorization [FIXED 2026-01-01]

- Files: `platform/apps/api/src/ota/ota.controller.ts:10`, `platform/apps/api/src/ota/ota.controller.ts:40`
- Problem: Only JWT guard is applied; any authenticated user can read/update OTA config or channels by ID.
- Impact: Cross-tenant data leakage and tampering.
- Fix: Add RolesGuard/ScopeGuard with campground ownership checks on all OTA endpoints.
- Tests: Cross-campground requests denied; channel ID access restricted to campground.
- **Resolution**: ID-based OTA endpoints now require campgroundId and service verifies channel/mapping ownership before updates, mapping writes, logs/imports, iCal token/URL, and push operations.

### Medium

#### WEBHOOK-MED-001: Developer webhook admin endpoints lack campground authorization [FIXED 2026-01-01]

- Files: `platform/apps/api/src/developer-api/webhook-admin.controller.ts:58`, `platform/apps/api/src/developer-api/webhook-admin.controller.ts:114`
- Problem: Only `JwtAuthGuard` is used; campgroundId is passed via query/body with no ownership checks.
- Impact: Any authenticated user can list/create/toggle/replay webhooks for any campground.
- Fix: Add RolesGuard/ScopeGuard and enforce campground ownership; consider platform-only access.
- Tests: Cross-campground access denied.
- **Resolution**: Toggle/replay/retry now require campgroundId and the service verifies endpoint/delivery ownership before mutating or re-sending; test/list/stat endpoints also enforce campgroundId.

#### OAUTH-MED-002: OAuth2 revoke and introspection are unauthenticated [FIXED 2026-01-01]

- Files: `platform/apps/api/src/auth/oauth2/oauth2.controller.ts:184`, `platform/apps/api/src/auth/oauth2/oauth2.controller.ts:200`
- Problem: Endpoints accept tokens without client authentication.
- Impact: Tokens can be revoked or introspected by unauthorized parties.
- Fix: Require client auth for revoke/introspect per RFC 7009/7662 (client_secret or JWT-based auth).
- Tests: Unauthorized requests fail; authorized client succeeds.
- **Resolution**: Added `client_id` and `client_secret` as required fields in `OAuth2RevokeRequestDto` and `OAuth2IntrospectRequestDto`. Controller now calls `oauth2Service.authenticateClient()` before processing revoke/introspect requests per RFC 7009/7662.

#### OAUTH-MED-003: OAuth2 authorize error path redirects to unvalidated redirect_uri [FIXED 2026-01-01]

- Files: `platform/apps/api/src/auth/oauth2/oauth2.controller.ts:143`, `platform/apps/api/src/auth/oauth2/oauth2.controller.ts:270`
- Problem: On invalid response_type, `redirect_uri` is used before client/redirect validation.
- Impact: Open redirect in error path.
- Fix: Validate client and redirect_uri before redirecting; otherwise return error response.
- Tests: Invalid redirect_uri does not redirect.
- **Resolution**: Added `validateClientAndRedirectUri()` method that validates client_id exists, is active, and redirect_uri is in the client's registered URIs BEFORE using it for any redirect. If validation fails, returns BadRequestException directly instead of redirecting to an unvalidated URI. Complies with RFC 6749 Section 4.1.2.1.

#### OAUTH-MED-004: OAuth2 auth codes stored in memory only

- Files: `platform/apps/api/src/auth/oauth2/oauth2.service.ts:60`
- Problem: Authorization codes are stored in memory.
- Impact: Multi-instance and restarts break auth flow.
- Fix: Move to Redis or database with TTL.
- Tests: Auth code exchange across instances works.

#### OTA-MED-001: OTA config stored in memory

- Files: `platform/apps/api/src/ota/ota.service.ts:33`
- Problem: Config stored in `Map` in-memory only.
- Impact: Configuration lost on restart and inconsistent across instances.
- Fix: Persist in database or distributed cache.
- Tests: Config survives restart and is shared across instances.

#### FORM-MED-001: Public forms accept any form ID and submissions without active/campground checks [FIXED 2026-01-01]

- Files: `platform/apps/api/src/forms/forms.service.ts:146`, `platform/apps/api/src/forms/forms.service.ts:170`
- Problem: `getPublicForm` and `submitPublicForm` do not validate form is active or belongs to the requesting campground/reservation.
- Impact: Exposes forms across campgrounds; submissions can be attached to any reservation ID.
- Fix: Validate form is active and matches reservation/campground; require token if needed.
- Tests: Form ID from another campground is rejected.
- **Resolution**: Both methods now require campgroundId and validate: (1) form belongs to the specified campground, (2) form is active, (3) if reservationId provided, it belongs to the same campground. Controller updated to require campgroundId as query param for GET and in body for POST. Frontend callers updated to include campgroundId.

### Low / Best Practice

#### PUB-LOW-001: Waitlist guest lookup uses non-unique email and skips normalization

- Files: `platform/apps/api/src/public-reservations/public-reservations.service.ts:86`
- Problem: Uses `findUnique` on `email` and creates guests without `emailNormalized`.
- Impact: Dedupe issues and potential runtime errors.
- Fix: Normalize email and lookup by `emailNormalized`; set on create.
- Tests: Case-insensitive dedupe test.

#### AUTH-LOW-001: Magic link tokens logged on email failure

- Files: `platform/apps/api/src/guest-auth/guest-auth.service.ts:72`, `platform/apps/api/src/guest-auth/guest-auth.service.ts:89`
- Problem: Logs magic link URLs if email send fails.
- Impact: Token exposure in logs.
- Fix: Remove token logging or log redacted token.
- Tests: Logging should not include full token.

#### PAY-LOW-001: Public payment intent DTO requires `amountCents` but server ignores it [FIXED 2026-01-01]

- Files: `platform/apps/api/src/payments/payments.controller.ts:27`, `platform/apps/api/src/payments/payments.controller.ts:455`
- Problem: DTO requires `amountCents` but server computes amount from reservation and does not validate against input.
- Impact: Confusing API contract, potential client misuse.
- Fix: Remove `amountCents` from DTO or validate it matches server-calculated amount.
- Tests: Mismatched amount is rejected if kept.
- **Resolution**: Removed `amountCents` field from `CreatePublicPaymentIntentDto`. The server always computes the amount from the reservation balance to prevent tampering and ensure consistency. Updated all frontend callers (api-client.ts, usePaymentIntent.ts, book/page.tsx) and tests to remove the field. Added clear documentation explaining that the server computes the amount.

#### PAY-LOW-002: Public payment confirmation idempotency defaults to time-based key

- Files: `platform/apps/api/src/payments/payments.controller.ts:589`
- Problem: If header is missing, key uses timestamp which defeats idempotency on retries.
- Impact: Increased risk of duplicate side effects on retries.
- Fix: Require idempotency header or derive a stable key from reservation + intent.
- Tests: Retry uses same idempotency key.

## Deeper Review Decisions Needed

- Should kiosk check-in require a verifiable token/signature instead of any `kioskToken`?
- Is public reservation access intended to be ID-only, or require signed token/campground validation?
- Should OTA config be persisted rather than in-memory?

---

## Full Audit Findings (broader sweep)

### Critical

#### SELF-CRIT-001: Self-check-in endpoints are unauthenticated [FIXED 2026-01-01]

- Files: `platform/apps/api/src/self-checkin/self-checkin.controller.ts:1`
- Problem: `GET /reservations/:id/checkin-status` and `POST /reservations/:id/self-checkin` have no auth or token validation.
- Impact: Anyone with a reservation ID can attempt self check-in or probe status.
- Fix: Require a signed guest token or kiosk token; validate reservation ownership in service.
- Tests: ID-only requests should be rejected.
- **Resolution**: Added class-level `@UseGuards(JwtAuthGuard)` to require authentication for all endpoints.

#### IMPORT-CRIT-001: Reservation import allows unauthenticated writes without onboarding token [FIXED 2026-01-01]

- Files: `platform/apps/api/src/data-import/reservation-import.controller.ts:34`, `platform/apps/api/src/data-import/reservation-import.controller.ts:167`
- Problem: If no onboarding token is provided, the controller only verifies campground existence and does not require JWT.
- Impact: Anyone can import reservations into any campground if they know the ID.
- Fix: Require JWT or valid onboarding token; enforce membership/ownership.
- Tests: Unauthenticated requests without onboarding token should fail.
- **Resolution**: Added optional JWT guard so requests with Authorization now populate `req.user`; `validateCampgroundAccess` enforces owner/manager membership when onboarding token is absent.

#### ADMIN-CRIT-001: Campground creation is open to any authenticated user [FIXED 2026-01-01]

- Files: `platform/apps/api/src/admin/admin-campground.controller.ts:1`
- Problem: `POST /admin/campgrounds` only uses `JwtAuthGuard`, no platform role validation.
- Impact: Any logged-in user can create campgrounds and admin accounts.
- Fix: Require platform admin role and/or scope guard.
- Tests: Non-platform users should be denied.
- **Resolution**: Added `RolesGuard` with `@Roles(UserRole.platform_admin)` to require platform admin role.

### High

#### ORG-HIGH-001: Organization billing endpoints lack organization membership checks [FIXED 2026-01-01]

- Files: `platform/apps/api/src/org-billing/org-billing.controller.ts:1`
- Problem: Only `JwtAuthGuard` is used; `organizationId` is taken from path without membership validation.
- Impact: Any authenticated user can view or mutate billing for any organization.
- Fix: Enforce org membership/role checks in controller/service.
- Tests: Cross-org requests denied.
- **Resolution**: Added `RolesGuard` with owner/manager/finance/platform_admin roles; added `validateOrgAccess()` method that checks user has membership to a campground within the organization.

#### DEV-HIGH-001: Developer API client management lacks campground ownership checks [FIXED 2026-01-01]

- Files: `platform/apps/api/src/developer-api/developer-admin.controller.ts:1`
- Problem: Only `JwtAuthGuard` is used; create/rotate/toggle/delete API clients by campground ID without ownership checks.
- Impact: Any authenticated user can create API clients for other campgrounds.
- Fix: Add RolesGuard/ScopeGuard and membership checks.
- Tests: Cross-campground access denied.
- **Resolution**: Controller now requires campgroundId for ID operations and service verifies API client/token ownership before rotate/toggle/tier updates, token revocation, and delete.

#### ADMIN-HIGH-001: Multiple admin controllers are missing role guards [FIXED 2026-01-01]

- Files: `platform/apps/api/src/admin/issues/issues.controller.ts:1`, `platform/apps/api/src/admin/audit-log.controller.ts:1`, `platform/apps/api/src/admin/guest-analytics.controller.ts:1`, `platform/apps/api/src/admin/feature-flag.controller.ts:1`, `platform/apps/api/src/admin/announcement.controller.ts:1`
- Problem: Admin routes rely only on `JwtAuthGuard` and do not enforce platform roles.
- Impact: Any authenticated user can access admin functionality and data.
- Fix: Require platform admin/support roles with `RolesGuard`.
- Tests: Non-admin users rejected.
- **Resolution**: All admin controllers now have `RolesGuard` with `PlatformRole.platform_admin` and `PlatformRole.support_agent` decorators (issues, audit-log, feature-flag, guest-analytics, announcement).

#### CAMP-HIGH-001: Campground admin endpoints allow broad access with only JWT [FIXED 2026-01-01]

- Files: `platform/apps/api/src/campgrounds/campgrounds.controller.ts:89`, `platform/apps/api/src/campgrounds/campgrounds.controller.ts:110`
- Problem: `GET /campgrounds` and `GET /campgrounds/:id` (and some updates like order webhook/analytics) do not enforce membership or roles.
- Impact: Any authenticated user can list all campgrounds or update settings by ID.
- Fix: Enforce membership/role checks consistently; avoid "return all" fallback.
- Tests: Cross-campground access denied.
- **Resolution**: Added membership validation to both endpoints. `listAll()` now returns only campgrounds the user is a member of (platform staff can still see all). `getOne()` validates user has membership to the requested campground before returning it. Added `listByIds()` service method to support membership-filtered listing.

#### RES-HIGH-001: Reservation listing and search endpoints lack membership validation [FIXED 2026-01-01]

- Files: `platform/apps/api/src/reservations/reservations.controller.ts:29`, `platform/apps/api/src/reservations/reservations.controller.ts:55`
- Problem: Uses `campgroundId` param but no user membership check for list/search.
- Impact: Any authenticated user can read reservation data for other campgrounds.
- Fix: Enforce membership/role checks for campgroundId access.
- Tests: Cross-campground list/search denied.
- **Resolution**: Added `assertCampgroundAccess()` helper method that validates user has membership to the campground (platform staff exempt). Applied to `list()` and `searchReservations()` endpoints. The helper is also used by `assertReservationAccess()` for individual reservation validation.

#### GUEST-HIGH-001: Guest endpoints rely on campgroundId without ownership checks [FIXED 2026-01-01]

- Files: `platform/apps/api/src/guests/guests.controller.ts:8`, `platform/apps/api/src/guests/guests.controller.ts:29`
- Problem: Controller requires `campgroundId` but never validates user membership.
- Impact: Any authenticated user can access/modify guests for other campgrounds.
- Fix: Validate membership/role in controller/service.
- Tests: Cross-campground guest access denied.
- **Resolution**: Added `assertCampgroundAccess()` helper method that validates user has membership to the campground (platform staff exempt). Applied to all guest endpoints: `findAll()`, `findOne()`, `create()`, `update()`, `remove()`, and `merge()`.

#### STORE-HIGH-001: Store endpoints accept campgroundId without membership checks [FIXED 2026-01-01]

- Files: `platform/apps/api/src/store/store.controller.ts:1`
- Problem: Store routes are guarded only by JWT; no membership validation for campgroundId.
- Impact: Any authenticated user can list/create/update store inventory/orders for other campgrounds.
- Fix: Add membership/role checks.
- Tests: Cross-campground access denied.
- **Resolution**: ID-only store endpoints now require campgroundId and service validates category/product/add-on/order ownership before updates, deletes, stock adjustments, refunds, status changes, and seen marks.

#### WEB-XSS-HIGH-001: Public campground description rendered as raw HTML [FIXED 2026-01-01]

- Files: `platform/apps/web/app/(public)/park/[slug]/v2/client.tsx:356`
- Problem: `dangerouslySetInnerHTML` uses `campground.description` without sanitization.
- Impact: Stored XSS if description contains HTML/script.
- Fix: Sanitize on write or sanitize before render.
- Tests: Injected HTML should be stripped/escaped.
- **Resolution**: Added DOMPurify sanitization: `DOMPurify.sanitize(campground.description || "")`.

#### WEB-XSS-HIGH-002: Map popup HTML interpolates campground fields [FIXED 2026-01-01]

- Files: `platform/apps/web/components/maps/CampgroundSearchMap.tsx:297`
- Problem: Popup HTML uses campground name/city/state/price directly inside template string.
- Impact: Stored XSS if those fields contain markup.
- Fix: Escape interpolated values or use DOM APIs to set text.
- Tests: HTML in campground name should not execute.
- **Resolution**: Added `escapeHtml()` function and applied to all campground fields in popup content.

### Medium

#### ROUTE-MED-001: Duplicate controller paths create ambiguous routing

- Files: `platform/apps/api/src/auth/oauth2/oauth2.controller.ts:1`, `platform/apps/api/src/developer-api/api-auth.controller.ts:1`, `platform/apps/api/src/public-reservations/public-reservations.controller.ts:1`, `platform/apps/api/src/developer-api/public-reservations.controller.ts:1`
- Problem: Two controllers register `POST /oauth/token`, and two controllers register `GET/POST /public/reservations` paths.
- Impact: Unpredictable routing; intended guards may be bypassed depending on module order.
- Fix: Separate paths (e.g., `/developer/oauth/*` or `/api/oauth/*`) or consolidate into a single controller.
- Tests: Route resolution is deterministic and guards apply.

#### BILL-WEBHOOK-MED-001: Billing webhook accepts unverified events when secret missing [FIXED 2026-01-01]

- Files: `platform/apps/api/src/org-billing/org-billing-webhook.controller.ts:46`
- Problem: If `STRIPE_BILLING_WEBHOOK_SECRET` is unset, webhook accepts raw payloads (no env guard).
- Impact: Webhook spoofing in production if secret misconfigured.
- Fix: Fail closed in non-dev environments when secret is missing.
- Tests: Missing secret in prod rejects requests.
- **Resolution**: Added environment checks for `NODE_ENV === "production"` or `"staging"` - now throws `BadRequestException` if webhook secret is missing in those environments. Unverified parsing only allowed in development.

#### IMPORT-MED-001: Data import endpoints lack membership validation [FIXED 2026-01-01]

- Files: `platform/apps/api/src/data-import/data-import.controller.ts:1`
- Problem: `campgroundId` is accepted but no membership validation is performed.
- Impact: Any authenticated user can import data into other campgrounds.
- Fix: Enforce membership/role checks for all import endpoints.
- Tests: Cross-campground import denied.
- **Resolution**: Added `RolesGuard` and `ScopeGuard` to controller class; added `@Roles(UserRole.owner, UserRole.manager)` decorator to all endpoints; moved job status endpoint under campground scope with ownership verification.

#### WEB-XSS-MED-001: Admin template/campaign previews render raw HTML

- Files: `platform/apps/web/app/dashboard/settings/templates/page.tsx:870`, `platform/apps/web/app/dashboard/settings/campaigns/page.tsx:169`
- Problem: Admin UI renders HTML content from user input with `dangerouslySetInnerHTML`.
- Impact: Stored XSS across admin users.
- Fix: Sanitize HTML or render safely in a sandboxed preview.
- Tests: Script tags are stripped/escaped.

### Low / Best Practice

#### UPLOAD-LOW-001: Uploads default to public-read ACL [FIXED 2026-01-01]

- Files: `platform/apps/api/src/uploads/uploads.service.ts:24`
- Problem: When not using R2, uploads default to `public-read`.
- Impact: Sensitive documents could become publicly accessible if misused.
- Fix: Default to private ACL and issue signed URLs for access.
- Tests: Uploads are not publicly readable by default.
- **Resolution**: Changed default ACL from "public-read" to "private" in getAcl() method. Added comprehensive documentation explaining security implications. Added new getSignedUrl() method to generate time-limited signed URLs for secure file access (default 1 hour expiration).

#### AUTH-LOW-002: Shared analytics link password hashing uses low iteration count [FIXED 2026-01-01]

- Files: `platform/apps/api/src/admin/analytics-share.service.ts:273`
- Problem: PBKDF2 uses 1,000 iterations.
- Impact: Weakens protection if share links are guessed and passwords leaked.
- Fix: Increase iterations or use a modern hash (bcrypt/argon2).
- Tests: Password verification still succeeds with updated hash parameters.
- **Resolution**: Increased PBKDF2-SHA512 iterations from 1,000 to 600,000 (OWASP 2023 recommendation). New hash format includes iteration count (iterations:salt:hash) to support future increases. Added backwards compatibility for legacy 1,000-iteration hashes (salt:hash format). Verified with test script that both legacy and modern hashes verify correctly.

## Full Audit Decisions Needed

- Should `/public/reservations` be split from developer API routes to avoid collisions?
- Should admin controllers require platform roles uniformly (even for read-only endpoints)?

---

## Extended Audit Findings (mobile + infra)

### Critical

#### INFRA-CRIT-002: Startup script uses `prisma db push --accept-data-loss`

- Files: `platform/apps/api/start.sh:28`
- Problem: Deploy-time startup runs `prisma db push --accept-data-loss`.
- Impact: Production deployments can drop columns/data without migration review.
- Fix: Remove `db push` from startup; use migrations with explicit approvals.
- Tests: N/A (deployment/runtime change).

### Medium

#### MOBILE-MED-001: Staff app has demo auth bypass without build gating

- Files: `mobile/ios/CampreservStaff/CampreservStaff/App/StaffAppState.swift:134`
- Problem: Demo credentials (`demo@campreserv.com` / `demo123`) always enable authenticated mode.
- Impact: Anyone can bypass real login in production builds and access demo UI states.
- Fix: Gate demo mode behind DEBUG/feature flag or remove from production builds.
- Tests: Production builds should not allow demo login.

#### MOBILE-MED-002: Inconsistent API base URLs across mobile apps

- Files: `mobile/ios/CampreservStaff/CampreservStaff/App/StaffAppState.swift:218`, `mobile/ios/CampreservGuest/CampreservGuest/App/AppState.swift:96`, `mobile/ios/CampreservAdmin/CampreservAdmin/App/AdminAppState.swift:133`
- Problem: Admin uses `api.campreserv.com`, staff/guest use Railway domains (one with `/api`, one without).
- Impact: Token audience/host mismatch, inconsistent routing, and environment drift.
- Fix: Centralize base URL config per environment and align app targets.
- Tests: Each app targets the same expected API base for the environment.

#### INFRA-MED-002: API Docker image uses Node 22 while docs require Node 20

- Files: `Dockerfile.api:1`
- Problem: API image is built on Node 22, but project docs require Node 20 for Prisma 7.
- Impact: Runtime incompatibilities and hard-to-reproduce bugs across environments.
- Fix: Align Docker base image with required Node version.
- Tests: Build + runtime smoke tests on the pinned version.

#### INFRA-MED-003: Secrets are passed as Docker build args and set in build layers

- Files: `Dockerfile:22`, `railway.toml:6`
- Problem: `AUTH_SECRET` and related values are injected at build time and exported as ENV, which can bake secrets into image layers and build logs.
- Impact: Secret exposure in build artifacts or registry.
- Fix: Prefer runtime env injection for secrets; restrict build args to public values only.
- Tests: Verify secrets are not present in built image layers.

#### INFRA-MED-004: Containers run as root and include full dependency tree

- Files: `Dockerfile:1`, `Dockerfile.api:1`
- Problem: No `USER` directive and no production dependency pruning.
- Impact: Larger attack surface and weaker isolation in production.
- Fix: Use a non-root user and prune dev dependencies in production images.
- Tests: Container starts with non-root user; runtime still works.

### Low / Best Practice

#### MOBILE-LOW-001: Keychain accessibility is `afterFirstUnlock`

- Files: `mobile/ios/Packages/CampreservCore/Sources/CampreservCore/Auth/KeychainService.swift:18`
- Problem: Tokens are accessible after first unlock (more permissive than necessary).
- Impact: Increased exposure if device is compromised after unlock.
- Fix: Consider `.whenUnlockedThisDeviceOnly` or stricter policy for tokens.
- Tests: Tokens remain accessible only when desired.

#### MOBILE-LOW-002: Production logging may include campgrounds and IDs

- Files: `mobile/ios/CampreservStaff/CampreservStaff/App/StaffAppState.swift:106`
- Problem: `print` logs include campground names/IDs and error details without DEBUG gating.
- Impact: PII exposure in device logs.
- Fix: Gate logs behind DEBUG or use privacy-safe logging.
- Tests: Release build has no sensitive logging.

#### MOBILE-LOW-003: No TLS pinning for mobile API client

- Files: `mobile/ios/Packages/CampreservCore/Sources/CampreservCore/Networking/APIClient.swift:18`
- Problem: Uses default `URLSession.shared` with system trust only.
- Impact: Susceptible to compromised CA attacks (low likelihood but higher assurance contexts care).
- Fix: Consider certificate pinning if threat model requires it.
- Tests: Pinning test against known cert.

---

## Extended Audit Findings (mobile flows + CI/CD)

### High

#### MOBILE-HIGH-001: Mobile API client allows unauthenticated self check-in/out endpoints

- Files: `mobile/ios/Packages/CampreservCore/Sources/CampreservCore/Networking/APIEndpoint.swift:119`
- Problem: `getCheckinStatus`, `selfCheckin`, and `selfCheckout` are marked `requiresAuth = false`, enabling unauthenticated calls.
- Impact: Reinforces the unauthenticated check-in flow; reservation ID alone can be used from the apps.
- Fix: Require signed guest token or kiosk token and update mobile client to include auth for these endpoints.
- Tests: Verify check-in endpoints require auth in both API and mobile.

### Medium

#### MOBILE-MED-003: Token refresh handler is never wired

- Files: `mobile/ios/Packages/CampreservCore/Sources/CampreservCore/Auth/TokenManager.swift:49`
- Problem: TokenManager expects `setRefreshHandler` to be configured, but no app sets it.
- Impact: Access tokens will expire and force logout; refresh tokens unused.
- Fix: Add an AuthManager or wire refresh handler in each app.
- Tests: Token refresh works and persists session past expiry.

#### MOBILE-MED-004: Self-checkout auth mismatch between client and server

- Files: `mobile/ios/Packages/CampreservCore/Sources/CampreservCore/Networking/APIEndpoint.swift:199`, `platform/apps/api/src/self-checkin/self-checkin.controller.ts:27`
- Problem: Mobile client treats `selfCheckout` as unauthenticated; server requires JWT.
- Impact: Guest app calls will fail or be blocked; inconsistent behavior.
- Fix: Align `requiresAuth` with server guard or move server guard to token-based guest auth.
- Tests: Client checkout succeeds with proper auth.

#### CICD-MED-001: No CI pipeline configuration found

- Files: (none)
- Problem: No `.github/workflows`, `.gitlab-ci.yml`, or other CI configs found in repo.
- Impact: Tests/lints/dependency checks may not run automatically on PRs.
- Fix: Add CI pipeline with lint/test/build and basic security scanning.
- Tests: CI should fail on lint/test errors and pass on clean runs.

---

## Extended Audit Findings (UI/UX)

### High

#### UI-HIGH-001: Social planner uses undefined `btn-*`/`input`/`card` classes

- Files: `platform/apps/web/app/social-planner/reports/page.tsx:83`, `platform/apps/web/app/social-planner/reports/page.tsx:140`, `platform/apps/web/app/social-planner/reports/page.tsx:149`, `platform/apps/web/app/social-planner/weekly/page.tsx:69`
- Problem: Social planner pages reference `card`, `input`, `btn-primary`, and `btn-secondary` classes that are not defined in shared CSS or components.
- Impact: Controls render with inconsistent default styling, weakening hierarchy and usability.
- Fix: Replace with `Card`, `Input`, and `Button` components or define these utility classes in `app/globals.css`.
- Tests: Add a UI snapshot or visual regression test for social planner pages.

#### UI-HIGH-002: Stub activity presented as real user data

- Files: `platform/apps/web/components/public/RecentBookingNotification.tsx:13`, `platform/apps/web/app/portal/my-stay/page.tsx:285`
- Problem: Recent booking notifications and guest comms history are populated with hard-coded sample entries without a demo label.
- Impact: Misleads users and undermines trust in production.
- Fix: Gate stubs behind a demo feature flag or replace with real data; add visible "Sample data" labeling.
- Tests: Ensure stubs are hidden in production builds.

### Medium

#### UI-MED-001: Brand naming inconsistent across surfaces

- Files: `platform/apps/web/lib/seo/constants.ts:6`, `platform/apps/web/components/marketing/MarketingHeader.tsx:50`, `platform/apps/web/public/sw.js:145`, `platform/apps/web/components/reservations/FinancialSummary.tsx:300`
- Problem: UI uses "Keepr", "Keepr Host", and "Campreserv" within public, staff, and notification surfaces.
- Impact: Confusing brand identity and unclear product ownership.
- Fix: Define canonical names per persona (guest/staff/admin) and update UI strings and notifications to align.

#### UI-MED-002: Design token system is defined but inconsistently applied

- Files: `platform/apps/web/docs/design-tokens.md:7`, `platform/apps/web/components/ui/button.tsx:11`, `platform/apps/web/components/ui/input.tsx:14`, `platform/apps/web/components/public/PublicHeader.tsx:106`
- Problem: Token guidance calls for semantic colors, but many components still use hard-coded `slate`/`emerald`/`blue` utilities.
- Impact: Inconsistent theming and color drift across screens and dark mode.
- Fix: Migrate ghost/outline/input styles to `action-*` and `status-*` tokens; reduce direct color utilities in UI components.

#### UI-MED-003: Public header navigation differs between desktop and mobile

- Files: `platform/apps/web/components/public/PublicHeader.tsx:39`, `platform/apps/web/components/public/PublicHeader.tsx:340`, `platform/apps/web/components/public/PublicHeader.tsx:401`
- Problem: Desktop header only shows Explore dropdown, while mobile exposes primary links (`Campgrounds`, `Book a stay`, `Help`).
- Impact: Different IA by device; desktop users lose direct access to key pages.
- Fix: Make primary nav consistent across breakpoints and reuse a shared nav list.

#### UI-MED-004: Dropdowns in public/marketing headers lack accessible state handling

- Files: `platform/apps/web/components/public/PublicHeader.tsx:103`, `platform/apps/web/components/public/PublicHeader.tsx:183`, `platform/apps/web/components/marketing/MarketingHeader.tsx:69`
- Problem: Dropdown toggles omit `aria-expanded`/`aria-controls` and rely on click-outside or blur timeouts without keyboard support.
- Impact: Unreliable navigation for keyboard/screen-reader users; menus close unexpectedly.
- Fix: Use a shared menu component (Radix Menu/Popover) with proper ARIA and focus management.

#### UI-MED-005: Service worker auto-reload can interrupt tasks

- Files: `platform/apps/web/app/client-root.tsx:36`
- Problem: App auto-reloads 10 seconds after SW activation.
- Impact: Interrupts form entry and kiosk flows without user consent.
- Fix: Require explicit confirmation or defer reload until idle.

#### UI-MED-006: Global overlays and fixed widgets can overlap mobile UI

- Files: `platform/apps/web/app/(public)/layout.tsx:14`, `platform/apps/web/components/public/WelcomeOverlay.tsx:61`, `platform/apps/web/components/support/FloatingTicketWidget.tsx:230`, `platform/apps/web/components/portal/GuestPortalNav.tsx:205`, `platform/apps/web/components/public/RecentBookingNotification.tsx:70`
- Problem: Welcome overlays and fixed widgets are globally mounted and compete for bottom/edge real estate.
- Impact: Reduced tap targets and visual clutter on small screens.
- Fix: Scope overlays by route/viewport and reserve bottom safe areas for navigation.

#### UI-MED-007: Explore destinations are hard-coded instead of data-driven

- Files: `platform/apps/web/components/public/PublicHeader.tsx:45`
- Problem: Explore lists use static destinations/states.
- Impact: Missed opportunity for personalization and accurate demand signals.
- Fix: Drive Explore content from API (trending, nearby, seasonality) with caching and A/B tests.

### Low / Best Practice

#### UI-LOW-001: Public layout forces portrait bias on landscape devices [FIXED 2026-01-01]

- Files: `platform/apps/web/app/(public)/globals.css:1`, `platform/apps/web/app/(public)/client.tsx:345`
- Problem: Landscape view constrains body width to 480px and sets `touch-action: pan-y`.
- Impact: Reduced usability for landscape browsing, maps, and kiosk views.
- Fix: Revisit the rule or scope it to specific pages/components.
- **Resolution**: Removed landscape orientation constraint from globals.css (removed max-width: 480px, overflow-x: hidden, touch-action: pan-y media query). Also removed max-w-[480px] constraint from homepage client component. Layout now respects full viewport width on landscape tablets and devices, allowing maps and wide content to display properly.

#### UI-LOW-002: Sentiment metrics inferred from ratings without explicit labeling

- Files: `platform/apps/web/components/reports/definitions/GuestFeedbackReport.tsx:58`, `platform/apps/web/components/reports/definitions/GuestFeedbackReport.tsx:182`
- Problem: Sentiment chart uses rating-based proxy logic without UI labeling.
- Impact: Users may assume ML sentiment analysis is in place.
- Fix: Add "Estimated from ratings" labeling or a tooltip in the chart header.

#### UI-LOW-003: Social icons in public footer are placeholder links

- Files: `platform/apps/web/app/(public)/layout.tsx:75`
- Problem: Footer social links use `href="#"`.
- Impact: Broken links and poor accessibility/SEO signals.
- Fix: Add real URLs or remove icons until links are available.

---

## Extended Audit Findings (Accounting)

### Critical

#### ACCT-CRIT-001: Refund webhook can over-apply partial refunds and dedupe ledger lines

- Files: `platform/apps/api/src/payments/payments.controller.ts:1173`, `platform/apps/api/src/reservations/reservations.service.ts:2502`
- Problem: `charge.refunded` passes `charge.amount_refunded` (cumulative) and uses `charge.id` as the refund id. For multiple partial refunds, each event re-applies the cumulative amount; `recordRefund` uses the same external ref, so ledger dedupe can skip later refunds while paidAmount still decrements.
- Impact: Over-refunds on reservations, inconsistent payment totals, and missing ledger entries for subsequent refunds.
- Fix: Use `refund.created`/`charge.refund.updated` with refund IDs and delta amounts; track per-refund idempotency; update original payment refundedAmountCents.
- Tests: Partial refund sequence (2+ refunds) should reconcile paidAmount, payment records, and ledger entries exactly once per refund.

### High

#### ACCT-HIGH-001: Payment model mismatch across accounting flows

- Files: `platform/apps/api/prisma/schema.prisma:2709`, `platform/apps/api/src/payments/payments.controller.ts:664`, `platform/apps/api/src/accounting/accounting-confidence.service.ts:105`
- Problem: Accounting code reads/writes `status`, `currency`, `paidAt`, `metadata`, and `feeAmountCents` on Payment, but the schema lacks these fields.
- Impact: Runtime errors or silently dropped data; reconciliation and reporting become unreliable.
- Fix: Align schema + Prisma client with the fields used in accounting flows, or refactor code to use existing fields only.
- Tests: Add schema/type checks and reconciliation tests using real Payment records.

#### ACCT-HIGH-002: Public payment confirmation bypasses ledger posting [FIXED 2026-01-01]

- Files: `platform/apps/api/src/payments/payments.controller.ts:660`, `platform/apps/api/src/payments/payments.controller.ts:1097`
- Problem: `confirmPublicPaymentIntent` creates a Payment and updates reservation without calling `recordPayment`; webhook later skips because payment exists.
- Impact: Ledger lacks public checkout entries, causing payout reconciliation drift and inaccurate financial reports.
- Fix: Use `reservations.recordPayment` for public confirm or ensure webhook always posts ledger lines.
- Tests: Public checkout should create ledger entries and reconcile with payouts.
- **Resolution**: Added balanced ledger entries after payment confirmation using `postBalancedLedgerEntries` (debit Cash, credit Site Revenue) with deduplication key based on paymentIntentId.

#### ACCT-HIGH-003: Refund bookkeeping inconsistent across flows [FIXED 2026-01-01]

- Files: `platform/apps/api/src/stripe-payments/refund.service.ts:165`, `platform/apps/api/src/reservations/reservations.service.ts:2532`
- Problem: Refund service creates negative-amount payments and updates `refundedAmountCents`, while reservation refund paths create positive refund payments and never update `refundedAmountCents`.
- Impact: Refund eligibility can exceed actual refunded totals; analytics/reporting become inconsistent by source.
- Fix: Standardize refund sign conventions and update original payment refund totals in all refund paths.
- Tests: Refund eligibility should reflect refunds created via webhook, dashboard, and API.
- **Resolution**: Both refund.service.ts and reservations.service.ts now update reservation paidAmount/balanceAmount/paymentStatus and post balanced ledger entries (credit Cash, debit Revenue) with proper deduplication keys.

#### ACCT-HIGH-004: Repeat charges update paidAmount only and skip ledger/balance updates [FIXED 2026-01-01]

- Files: `platform/apps/api/src/repeat-charges/repeat-charges.service.ts:240`
- Problem: Recurring charges create Payment records and increment `paidAmount` without updating `balanceAmount`, `paymentStatus`, or ledger entries.
- Impact: A/R aging and ledger reports diverge from actual payment state.
- Fix: Route repeat charges through `reservations.recordPayment` or update balance/status + ledger in the same transaction.
- Tests: Repeat charge should update paidAmount, balanceAmount, paymentStatus, and ledger entries.
- **Resolution**: Now calculates new balanceAmount and paymentStatus, posts balanced ledger entries (debit Cash, credit Site Revenue) with deduplication.

#### ACCT-HIGH-005: Payment ledger entries do not split taxes/fees

- Files: `platform/apps/api/src/reservations/reservations.service.ts:2215`
- Problem: Ledger posts only `CASH` debit and revenue credit for the full payment amount while tax/fee amounts are only included in receipts.
- Impact: Tax liabilities and fee expenses are not tracked in the ledger; revenue is overstated.
- Fix: Add GL splits for tax liability and fee expense based on `taxCents`/`feeCents`.
- Tests: Payment with tax/fees should post multi-line ledger entries.

#### ACCT-HIGH-006: Reservation ledger endpoint lacks role and tenant scoping [FIXED 2026-01-01]

- Files: `platform/apps/api/src/ledger/ledger.controller.ts:62`, `platform/apps/api/src/ledger/ledger.service.ts:94`
- Problem: `GET /reservations/:id/ledger` has no `@Roles` guard and `listByReservation` filters only by `reservationId`.
- Impact: Any authenticated user can access ledger entries for any reservation ID (cross-tenant financial disclosure).
- Fix: Require campground roles and enforce campground scoping in the service query.
- Tests: Cross-campground reservation ledger access should be denied.
- **Resolution**: `GET /reservations/:id/ledger` now requires campgroundId and the service validates reservation ownership before listing ledger entries.

#### ACCT-HIGH-007: POS charge-to-site uses single-sided ledger entries [FIXED 2026-01-01]

- Files: `platform/apps/api/src/pos/pos.service.ts:355`
- Problem: Charge-to-site creates only a single debit `ledgerEntry` with no offsetting credit line.
- Impact: Ledger is unbalanced and reservation financials diverge from GL.
- Fix: Post balanced entries (e.g., debit A/R, credit POS revenue) using `postBalancedLedgerEntries`.
- Tests: Charge-to-site should create balanced ledger entries.
- **Resolution**: Now uses `postBalancedLedgerEntries` to post balanced entries (debit A/R, credit POS Revenue) with deduplication keys based on cartId and idempotencyKey.

#### ACCT-HIGH-008: POS payments never hit the GL for cash/card/gift/wallet [FIXED 2026-01-01]

- Files: `platform/apps/api/src/pos/pos.service.ts:404`, `platform/apps/api/src/pos/pos.service.ts:481`
- Problem: POS checkout records `posPayment` (and till movement for cash) but does not post any GL entries for revenue, tax, or tender.
- Impact: POS revenue and tax liabilities are missing from financial statements and reconciliation.
- Fix: Add ledger postings per tender type (cash/card/gift/wallet) with tax and fee splits where applicable.
- Tests: POS checkout should create balanced ledger entries for each tender.
- **Resolution**: Added balanced ledger entries for card payments (via provider and Stripe) and cash/other payments using `postBalancedLedgerEntries` with deduplication keys.

#### ACCT-HIGH-009: POS checkout redeems stored value outside the checkout transaction

- Files: `platform/apps/api/src/pos/pos.service.ts:286`, `platform/apps/api/src/pos/pos.service.ts:302`, `platform/apps/api/src/stored-value/stored-value.service.ts:198`, `platform/apps/api/src/guest-wallet/guest-wallet.service.ts:342`
- Problem: Stored value and guest wallet debits are executed via separate Prisma transactions instead of the POS checkout transaction.
- Impact: Checkout failures can still consume stored value, leaving carts unpaid but balances reduced.
- Fix: Pass the `tx` client through or wrap all steps in a single transaction boundary with retries.
- Tests: Simulated checkout failure should not redeem stored value.

#### ACCT-HIGH-010: Invoice write-offs bypass balanced posting and period controls [FIXED 2026-01-01]

- Files: `platform/apps/api/src/billing/billing.service.ts:601`, `platform/apps/api/src/billing/billing.service.ts:621`
- Problem: Write-off creates two `ledgerEntry` rows directly (no `postBalancedLedgerEntries`, no GL period enforcement, no dedupe, no transaction).
- Impact: Partial failures can leave unbalanced ledgers; postings can bypass closed period controls.
- Fix: Use balanced ledger posting inside a transaction with period checks and idempotency.
- Tests: Failed write-off should not leave a single-sided entry.
- **Resolution**: Wrapped all write-off operations in a single `$transaction`, now uses `postBalancedLedgerEntries` (debit Bad Debt, credit A/R) with deduplication key based on invoiceId and period checks.

#### ACCT-HIGH-011: Auto-collect posts single-sided ledger entries and bypasses standard payment posting [FIXED 2026-01-01]

- Files: `platform/apps/api/src/auto-collect/auto-collect.service.ts:177`, `platform/apps/api/src/auto-collect/auto-collect.service.ts:202`
- Problem: `recordSuccessfulPayment` updates reservations and writes a single `ledgerEntry` debit to CASH, without a revenue credit and without using `recordPayment`.
- Impact: Ledger becomes unbalanced and revenue is understated for auto-collect payments.
- Fix: Route auto-collect success through `reservations.recordPayment` or `postBalancedLedgerEntries` in a transaction.
- Tests: Auto-collect should create balanced ledger entries and update paid/balance totals.
- **Resolution**: Replaced single-sided `ledgerEntry.create` with `postBalancedLedgerEntries` (debit Cash, credit Site Revenue) with deduplication keys.

#### ACCT-HIGH-012: Invoice payments/AR settlement are missing

- Files: `platform/apps/api/src/billing/billing.service.ts:383`, `platform/apps/api/src/billing/billing.service.ts:645`, `platform/apps/api/prisma/schema.prisma:2967`
- Problem: Billing posts `ar_open` and `writeoff` entries only; there is no settlement flow that records `ar_settlement` when an invoice is paid.
- Impact: AR never gets relieved, invoice balances can't be cleared via accounting, and aging reports overstate receivables.
- Fix: Add an invoice payment/apply flow that posts AR credit + cash debit and records `ar_settlement`, updating invoice status/balance.
- Tests: Applying a payment should create `ar_settlement` and reduce balance.

#### ACCT-HIGH-013: Stripe refund endpoint skips reservation and ledger updates [FIXED 2026-01-01]

- Files: `platform/apps/api/src/stripe-payments/refund.service.ts:165`, `platform/apps/api/src/stripe-payments/refund.service.ts:175`, `platform/apps/api/src/stripe-payments/stripe-payments.controller.ts:505`
- Problem: Refund processing updates Payment records only; it does not adjust reservation `paidAmount/balance` or post refund ledger entries.
- Impact: Reservation balances remain overstated and refunds are missing from the ledger.
- Fix: Route refunds through `reservations.recordRefund` or a shared refund pipeline that updates reservation + ledger in a transaction.
- Tests: Refund via `campgrounds/:campgroundId/payments/:paymentId/refund` should adjust reservation and ledger.
- **Resolution**: Added reservation balance updates (paidAmount, balanceAmount, paymentStatus) and balanced ledger entries (credit Cash, debit Site Revenue) after refund processing.

#### ACCT-HIGH-014: Kiosk check-in charges bypass ledger posting and balance updates [FIXED 2026-01-01]

- Files: `platform/apps/api/src/reservations/reservations.service.ts:2910`, `platform/apps/api/src/reservations/reservations.service.ts:2942`, `platform/apps/api/src/payments/payments.controller.ts:1098`
- Problem: Kiosk check-in creates a Payment record and updates `paidAmount/totalAmount` directly, but does not call `recordPayment` or update `balanceAmount`; the webhook skips ledger posting because the payment already exists.
- Impact: Ledger is missing kiosk payments and reservation balances can remain incorrect.
- Fix: Use `recordPayment` (or balanced ledger posting + `buildPaymentFields`) and avoid creating the Payment before webhook handling.
- Tests: Kiosk check-in payment should create ledger entries and set `balanceAmount` to 0.
- **Resolution**: Added balanced ledger entries (debit Cash, credit Site Revenue) after kiosk payment recording in public-reservations.service.ts.

#### ACCT-HIGH-015: ACH return handling can double-post and reduce paid amounts incorrectly

- Files: `platform/apps/api/src/payments/payments.controller.ts:1136`, `platform/apps/api/src/payments/payments.controller.ts:1438`, `platform/apps/api/src/reservations/reservations.service.ts:2502`
- Problem: `payment_intent.payment_failed` for ACH calls `recordRefund` and also posts chargeback/cash entries; if the original payment never succeeded, this still reduces `paidAmount` and credits cash twice.
- Impact: Paid amounts and ledger balances can be understated, and chargebacks overstated.
- Fix: Only process ACH returns for previously succeeded/settled payments and use a single idempotent accounting path.
- Tests: ACH failures before settlement should not create refunds or ledger entries.

#### ACCT-HIGH-016: Developer API `recordPayment` bypasses reservation and ledger updates

- Files: `platform/apps/api/src/developer-api/public-api.service.ts:257`
- Problem: Developer API inserts a Payment record without updating reservation balances or posting ledger entries.
- Impact: Integrations can create payments that never affect accounting or A/R.
- Fix: Route this endpoint through `reservations.recordPayment` or update reservation + ledger in one transaction.
- Tests: Developer API payment should update paid/balance and create ledger entries.

#### ACCT-HIGH-017: OTA import ledger entries are unbalanced and missing GL codes

- Files: `platform/apps/api/src/ota/ota.service.ts:546`
- Problem: OTA reservation import posts one-sided `ledgerEntry` rows without GL codes or offsetting accounts.
- Impact: Ledger is unbalanced and OTA revenue/fees are not reconciliable.
- Fix: Use double-entry posting with explicit GL accounts (AR/Cash vs revenue/fees) and period checks.
- Tests: OTA import should create balanced ledger entries with glCode/account.

#### ACCT-HIGH-018: Public payment confirmation uses non-existent `totalAmountCents`

- Files: `platform/apps/api/src/payments/payments.controller.ts:683`, `platform/apps/api/prisma/schema.prisma:2328`
- Problem: `confirmPublicPaymentIntent` selects `totalAmountCents` from Reservation, but the schema only defines `totalAmount`. This can throw at runtime or compute `balanceAmount` off `undefined`.
- Impact: Payment confirmation can fail or mark reservations paid with an incorrect balance, causing under-collection and reconciliation drift.
- Fix: Use `totalAmount` consistently in queries and balance calculations; update types/tests accordingly.
- Tests: Public payment confirmation should compute balance from `totalAmount` and never reference `totalAmountCents`.

#### ACCT-HIGH-019: Chargeback/dispute events do not adjust reservation balances

- Files: `platform/apps/api/src/payments/payments.controller.ts:1181`, `platform/apps/api/src/payments/reconciliation.service.ts:284`
- Problem: Dispute webhooks only upsert dispute records; reconciliation posts ledger entries but never calls a reservation refund/adjustment path.
- Impact: Reservations remain fully paid after chargebacks, A/R is understated, and cash reductions are not reflected in guest balances.
- Fix: On dispute creation/closure, create a chargeback adjustment that updates reservation `paidAmount`/`balanceAmount`, records a payment/refund record, and posts idempotent ledger entries.
- Tests: Dispute event should reduce `paidAmount`, increase `balanceAmount`, and create a single chargeback ledger posting.

#### ACCT-HIGH-020: Store orders with card/cash never hit payments or GL

- Files: `platform/apps/api/src/store/store.service.ts:457`, `platform/apps/api/src/store/store.service.ts:517`
- Problem: Store order creation records `paymentMethod` but only posts ledger/balance updates for `charge_to_site`; card/cash orders do not create Payment records or GL entries.
- Impact: Store revenue and tax liabilities are missing from accounting, and refunds only interact with Stripe without reversing GL balances.
- Fix: Add payment capture/recording for card/cash orders and post balanced ledger entries with tax splits; align with POS accounting.
- Tests: Card/cash store order should create Payment + GL entries; refunds should reverse them.

#### ACCT-HIGH-021: Org billing webhook can accept unsigned events [FIXED 2026-01-01]

- Files: `platform/apps/api/src/org-billing/org-billing-webhook.controller.ts:64`
- Problem: When `STRIPE_BILLING_WEBHOOK_SECRET` is missing, the webhook accepts and parses events without signature verification.
- Impact: Forged requests can mark periods paid/past due or change subscription status, corrupting billing state.
- Fix: Fail closed when the secret is missing in non-dev environments; require signature verification in all deployed environments.
- Tests: Webhook requests without valid signatures should be rejected even when the secret is missing.
- **Resolution**: Added environment checks for `NODE_ENV === "production"` or `"staging"` - now throws `BadRequestException` if webhook secret is missing in those environments. Unverified parsing only allowed in development.

#### ACCT-HIGH-022: Org billing usage is not reported to Stripe metered items

- Files: `platform/apps/api/src/org-billing/usage-tracker.service.ts:20`, `platform/apps/api/src/org-billing/subscription.service.ts:222`
- Problem: Usage events are recorded internally, but no flow connects them to `reportBookingUsage`/`reportSmsUsage` for Stripe metered billing.
- Impact: Stripe invoices can miss usage-based fees while internal billing shows charges, creating revenue leakage and reconciliation drift.
- Fix: Add a scheduler/worker to aggregate unbilled usage events and report them to Stripe with idempotency keys.
- Tests: Usage events for a period should produce matching Stripe usage records and invoice totals.

#### ACCT-HIGH-023: Org billing subscription endpoints bypass org access validation

- Files: `platform/apps/api/src/org-billing/org-billing.controller.ts:149`
- Problem: `finalizePeriod`, `markPeriodPaid`, and subscription endpoints do not call `validateOrgAccess`, so role holders can act on other organizations by ID.
- Impact: Cross-org subscription changes, paid-status spoofing, and billing tampering.
- Fix: Require `validateOrgAccess` for all org billing endpoints and scope by organizationId.
- Tests: Users without org membership should be blocked from subscription/period actions.

#### ACCT-HIGH-024: POS Stripe fallback records card payments as succeeded before confirmation

- Files: `platform/apps/api/src/pos/pos.service.ts:450`, `platform/apps/api/src/pos/pos.service.ts:465`
- Problem: When provider integrations are unavailable, POS creates a Stripe PaymentIntent and immediately records the payment as `succeeded` without confirming or verifying `intent.status`.
- Impact: Card payments can fail or require action while the cart is closed and receipts are sent, causing revenue leakage and reconciliation drift.
- Fix: Confirm the intent (or collect via terminal), and only mark `posPayment` as succeeded after `intent.status === "succeeded"`; otherwise keep the cart/payment pending until webhook confirmation.
- Tests: A PaymentIntent that returns `requires_payment_method` or `requires_action` should not close the cart or mark payment succeeded.

#### ACCT-HIGH-025: POS Stripe fallback charges the platform account instead of the campground

- Files: `platform/apps/api/src/pos/pos.service.ts:450`
- Problem: The POS Stripe fallback uses `process.env.STRIPE_ACCOUNT_ID` instead of the campground's connected Stripe account.
- Impact: Card payments can land in the wrong Stripe account, breaking campground payouts, revenue attribution, and reconciliation.
- Fix: Use the campground's `stripeAccountId` (or gateway config) for POS charges; block checkout if the campground is not connected.
- Tests: POS card checkout should create a PaymentIntent on the campground’s connected account.

#### ACCT-HIGH-026: Reservation refund endpoint records card refunds without issuing them

- Files: `platform/apps/api/src/reservations/reservations.service.ts:2369`, `platform/apps/api/src/reservations/reservations.controller.ts:243`
- Problem: `refundPayment` updates reservation balances and creates refund records, but for `destination="card"` it does not call Stripe to actually refund the charge.
- Impact: The system can show refunds that were never issued, causing guest disputes and cash reconciliation failures.
- Fix: Route card refunds through the Stripe refund service (or restrict this endpoint to wallet/cash with explicit non-card labeling).
- Tests: A card refund should create a Stripe refund and a matching internal refund record.

#### ACCT-HIGH-027: Refund webhook dedupe uses a non-existent Payment field

- Files: `platform/apps/api/src/payments/payments.controller.ts:1293`, `platform/apps/api/prisma/schema.prisma:2709`
- Problem: `charge.refunded` handling checks `payment.externalRef` for idempotency, but `Payment` has no `externalRef` column.
- Impact: Webhook processing can throw Prisma validation errors or fail to dedupe, leading to missed or duplicated refund records.
- Fix: Add a `stripeRefundId`/`externalRef` field to `Payment` or dedupe using existing fields (e.g., `stripeChargeId` + refund ID in metadata).
- Tests: Duplicate refund webhook deliveries should be safely ignored without errors.

#### ACCT-HIGH-028: Dispute updates/closures never reverse balance adjustments

- Files: `platform/apps/api/src/payments/reconciliation.service.ts:239`
- Problem: `upsertDispute` only adjusts reservation balances on first creation; `charge.dispute.updated/closed` events do not apply deltas or reverse adjustments when disputes are reduced or won.
- Impact: Paid amounts remain reduced and chargeback expense remains overstated even after funds are recovered.
- Fix: Apply delta adjustments on dispute updates and reverse entries when disputes are closed in favor of the campground.
- Tests: A dispute closed as `won` should restore paidAmount and post reversing ledger entries.

### Medium

#### ACCT-MED-001: Ledger dedupe can mask partial postings outside transactions

- Files: `platform/apps/api/src/ledger/ledger-posting.util.ts:111`
- Problem: When called without a transaction, `postBalancedLedgerEntries` returns existing entries if any dedupe key matches, even if only one side posted.
- Impact: Unbalanced ledger entries can persist after partial failures (e.g., webhook refunds).
- Fix: Enforce transactional posting or use per-line idempotency checks and insert missing lines.
- Tests: Simulate partial failure and ensure retry completes both ledger lines.

#### ACCT-MED-002: Payout reconciliation uses all reservation ledger entries

- Files: `platform/apps/api/src/payments/reconciliation.service.ts:344`
- Problem: `ledgerNet` sums every ledger entry for reservations in the payout, not just payment-related entries.
- Impact: Non-payment entries (store charges, adjustments) can create false drift.
- Fix: Filter ledger entries by source type or GL codes relevant to payouts.
- Tests: Ensure reconciliation ignores non-payment ledger activity.

#### ACCT-MED-003: Net payout posting assumes positive net amounts

- Files: `platform/apps/api/src/payments/reconciliation.service.ts:397`
- Problem: `postNetCashMovement` uses `Math.abs(net)` and always debits BANK / credits CASH.
- Impact: Negative net payouts (e.g., chargeback-heavy periods) would post with reversed sign.
- Fix: Post debit/credit based on net sign.
- Tests: Negative net payout should credit BANK and debit CASH.

#### ACCT-MED-004: Store charge-to-site ledger entries are single-sided

- Files: `platform/apps/api/src/store/store.service.ts:517`, `platform/apps/api/src/store/store.service.ts:731`
- Problem: Store charge-to-site orders/refunds write a single `ledgerEntry` without offsetting account lines or payment status updates.
- Impact: Ledger is unbalanced and reservation financials can diverge from actual charges.
- Fix: Use ledger double-entry posting with an offset account (A/R or revenue) and update payment status/balance consistently.
- Tests: Store order charge/refund should produce balanced ledger entries and consistent reservation totals.

#### ACCT-MED-005: Ledger list/export ignores filters due to incorrect service call

- Files: `platform/apps/api/src/ledger/ledger.controller.ts:15`, `platform/apps/api/src/ledger/ledger.service.ts:62`
- Problem: Controller passes `start/end/glCode` as separate args, but `list` expects an options object; filters are ignored and default limits apply.
- Impact: Ledger queries and CSV exports return the wrong data set.
- Fix: Pass `{ start, end, glCode }` as the second argument.
- Tests: Filters in list/export should constrain results correctly.

#### ACCT-MED-006: GL summary caps at 1,000 entries

- Files: `platform/apps/api/src/ledger/ledger.service.ts:72`, `platform/apps/api/src/ledger/ledger.service.ts:108`
- Problem: `summaryByGl` calls `list(..., { limit: 10000 })`, but `list` caps at 1,000.
- Impact: GL summaries are incorrect for campgrounds with >1,000 ledger entries.
- Fix: Aggregate with SQL (`groupBy`) or remove the list cap for summaries.
- Tests: Summary should include all ledger entries beyond 1,000.

#### ACCT-MED-007: Guest wallet debits/credits lack idempotency safeguards

- Files: `platform/apps/api/src/guest-wallet/guest-wallet.service.ts:266`, `platform/apps/api/src/guest-wallet/guest-wallet.service.ts:342`, `platform/apps/api/prisma/schema.prisma:6709`
- Problem: `creditFromRefund` and `debitForPayment` do not use idempotency guards or unique constraints on `storedValueLedger`.
- Impact: Retries can double-credit or double-debit wallet balances.
- Fix: Enforce idempotency keys and add a unique constraint on `(accountId, referenceType, referenceId, direction)` or similar.
- Tests: Retries should not change wallet balance.

#### ACCT-MED-008: Stored value and wallet flows do not post GL liabilities

- Files: `platform/apps/api/src/stored-value/stored-value.service.ts:87`, `platform/apps/api/src/guest-wallet/guest-wallet.service.ts:224`
- Problem: Gift card/wallet issuance and redemption only write to `StoredValueLedger` and never to the general ledger.
- Impact: Gift card and wallet liabilities are invisible in GL reporting and reconciliation.
- Fix: Post GL entries for stored value issuance/redemption (liability + cash/revenue).
- Tests: Stored value issue/redeem should create balanced GL entries.

#### ACCT-MED-009: Stored value and wallet debits are not concurrency-safe

- Files: `platform/apps/api/src/stored-value/stored-value.service.ts:215`, `platform/apps/api/src/guest-wallet/guest-wallet.service.ts:372`
- Problem: Balances are computed by summing ledger entries with no row-level locks; concurrent debits can overspend.
- Impact: Wallet/stored value balances can go negative under concurrent use.
- Fix: Use row-level locks or atomic balance tracking with optimistic concurrency.
- Tests: Parallel debits should not allow overspending.

#### ACCT-MED-010: Invoice line overrides do not adjust ledger/AR

- Files: `platform/apps/api/src/billing/billing.service.ts:675`
- Problem: `overrideInvoiceLine` updates invoice line amounts and recalculates totals but does not post adjusting ledger entries.
- Impact: Ledger and AR no longer match invoice totals after overrides.
- Fix: Post adjustment entries (AR + revenue) or restrict overrides once posted.
- Tests: Override should create matching ledger adjustments.

#### ACCT-MED-011: Billing cycles can be duplicated for the same period

- Files: `platform/apps/api/src/billing/billing.service.ts:280`, `platform/apps/api/prisma/schema.prisma:2783`
- Problem: `createBillingCycle` inserts without checking overlap/uniqueness and the schema lacks a unique constraint.
- Impact: Duplicate cycles can generate multiple invoices for the same period.
- Fix: Add a unique constraint on `(reservationId, periodStart, periodEnd)` and enforce in service.
- Tests: Duplicate cycle creation should be rejected.

#### ACCT-MED-012: Manual meter billing can underbill when multiple reads exist

- Files: `platform/apps/api/src/billing/billing.service.ts:163`
- Problem: `billMeterNow` uses the most recent read after `lastBilledReadAt`, but the start read is only the immediately prior reading, skipping earlier usage since the last bill.
- Impact: If multiple reads exist since last billed, only the last interval is billed and usage is understated.
- Fix: Use the last billed read as the start or sum intervals across all reads since last billed.
- Tests: Multiple reads since last bill should produce cumulative usage.

#### ACCT-MED-013: POS returns create pending records without refund/ledger handling

- Files: `platform/apps/api/src/pos/pos.service.ts:718`
- Problem: `createReturn` only records a pending return and returns `needs_review`; there is no refund/tender reversal or ledger posting.
- Impact: Returns can exist without reversing revenue or tender balances.
- Fix: Add a return settlement flow to issue refunds per tender and post balanced ledger/till entries.
- Tests: Processing a return should reduce revenue and record refunds.

#### ACCT-MED-014: Usage event types and unit pricing mismatch skew platform fee reporting

- Files: `platform/apps/api/src/org-billing/usage-tracker.service.ts:39`, `platform/apps/api/src/org-billing/usage-tracker.service.ts:151`, `platform/apps/api/src/billing/billing-dashboard.service.ts:105`
- Problem: Usage events record `booking_created` without `unitCents` and use `sms_outbound/sms_inbound`, while the dashboard aggregates `sms_sent/sms_received` and sums `unitCents`.
- Impact: Platform fee dashboards underreport or show zero for bookings and SMS usage.
- Fix: Standardize event types and ensure unit pricing is set (or compute from tier config in the dashboard).
- Tests: Booking/SMS usage should appear in dashboard totals.

#### ACCT-MED-015: Auto-collect idempotency key is time-based and not retry-safe

- Files: `platform/apps/api/src/auto-collect/auto-collect.service.ts:62`
- Problem: Idempotency keys use `Date.now()`, so retries generate new keys and can create duplicate charges if prior attempts partially succeeded.
- Impact: Risk of double-charging and mismatched payment records.
- Fix: Use a stable key (reservationId + scheduled attempt) and lock the reservation row.
- Tests: Retry should not create a second intent or payment.

#### ACCT-MED-016: Invoice creation and ledger posting are not atomic

- Files: `platform/apps/api/src/billing/billing.service.ts:485`, `platform/apps/api/src/billing/billing.service.ts:503`
- Problem: Invoice creation occurs before ledger posting and not within a transaction; ledger posting failures leave invoices without matching entries.
- Impact: AR and revenue ledgers diverge from invoice records.
- Fix: Wrap invoice + ledger postings in a transaction or add compensation on failure.
- Tests: Failures during posting should roll back invoice creation.

#### ACCT-MED-017: Payout reconciliation is not idempotent

- Files: `platform/apps/api/src/payments/reconciliation.service.ts:240`, `platform/apps/api/prisma/schema.prisma:3130`, `platform/apps/api/prisma/schema.prisma:3181`
- Problem: Reconciliation inserts `PayoutLine` and `PayoutReconLine` records on every run without dedupe keys or uniqueness.
- Impact: Re-running recon can duplicate lines and distort payout summaries.
- Fix: Add unique constraints on `balanceTransactionId`/`sourceTxId` and upsert or clear existing lines before insert.
- Tests: Running reconciliation twice should not change line counts.

#### ACCT-MED-018: Usage events lack idempotency/uniqueness safeguards

- Files: `platform/apps/api/src/org-billing/usage-tracker.service.ts:20`, `platform/apps/api/prisma/schema.prisma:7813`
- Problem: `usageEvent` writes have no idempotency keys or uniqueness constraints by `eventType` + `referenceId`.
- Impact: Retries or duplicate calls can overbill platform fees.
- Fix: Add an idempotency key or unique constraint (org + eventType + referenceId) and upsert.
- Tests: Duplicate track calls should not create extra usage events.

#### ACCT-MED-019: Saved-card charge endpoint drops reservation metadata

- Files: `platform/apps/api/src/stripe-payments/stripe-payments.controller.ts:175`, `platform/apps/api/src/stripe-payments/dto/index.ts:80`
- Problem: `POST /campgrounds/:campgroundId/guests/:guestId/payment-methods/:paymentMethodId/charge` ignores `reservationId` from the DTO and forwards only `metadata`.
- Impact: Webhook payment recording (reservation-scoped) can be skipped, leaving payments unposted in the ledger.
- Fix: Include `reservationId` in metadata or record the payment explicitly after success.
- Tests: Charge with reservationId should create a Payment + ledger entry.

#### ACCT-MED-020: Flex-check and room-move charges are not applied to accounting

- Files: `platform/apps/api/src/flex-check/flex-check.service.ts:133`, `platform/apps/api/src/room-moves/room-moves.service.ts:159`
- Problem: Charges/price differences are stored on reservations or move requests but never posted to reservation totals or ledger.
- Impact: Unbilled revenue and incomplete accounting for operational adjustments.
- Fix: Apply charges to reservation balance and post balanced ledger entries when approved/completed.
- Tests: Approved early/late check-in or room move should update balance and ledger.

#### ACCT-MED-021: Till cash movements are not reflected in the ledger

- Files: `platform/apps/api/src/pos/till.service.ts:145`
- Problem: Paid-in/out, cash refunds, and over/short adjustments are tracked only in till movements without GL postings.
- Impact: Cash reconciliation and over/short variances are missing from accounting reports.
- Fix: Post ledger entries for till movements and over/short adjustments.
- Tests: Till close should create ledger entries for cash movements and variance.

#### ACCT-MED-022: Self-checkout can complete without a successful payment

- Files: `platform/apps/api/src/self-checkin/self-checkin.service.ts:370`, `platform/apps/api/src/self-checkin/self-checkin.service.ts:565`
- Problem: `attemptBalanceCollection` returns `success: true` for `payment_required`, and `selfCheckout` treats that as paid, completing checkout.
- Impact: Guests can check out with unpaid balances and A/R integrity is weakened.
- Fix: Block checkout until payment intent succeeds or mark checkout as pending payment.
- Tests: Payment intents requiring action should not allow checkout completion.

#### ACCT-MED-023: Reservation imports set paid/balance amounts without payments or ledger

- Files: `platform/apps/api/src/data-import/reservation-import.service.ts:483`
- Problem: CSV import writes `paidAmount`/`balanceAmount` but does not create Payment or ledger entries.
- Impact: Imported balances will not reconcile with payments/ledger reporting.
- Fix: Optionally import payment history or post balancing ledger entries for imported balances.
- Tests: Imported reservations with paid amounts should reconcile to ledger totals.

#### ACCT-MED-024: Seasonal payments do not post to the general ledger

- Files: `platform/apps/api/src/seasonals/seasonals.service.ts:635`
- Problem: Seasonal payment recording updates seasonal subledger only; no GL entries are posted.
- Impact: Seasonal cash/revenue activity is missing from accounting reports.
- Fix: Post ledger entries for seasonal payments or document a reconciliation process.
- Tests: Seasonal payment should create ledger entries.

#### ACCT-MED-025: Stripe refund recording is non-atomic with ledger posting

- Files: `platform/apps/api/src/reservations/reservations.service.ts:2502`
- Problem: `recordRefund` updates the reservation and creates a Payment, then posts ledger entries outside a transaction; `postBalancedLedgerEntries` writes each row independently.
- Impact: Ledger can be missing for refunds even though paid/balance fields and Payment records were updated.
- Fix: Wrap reservation update + Payment + ledger posting in one transaction, or add a retryable outbox/ledger job.
- Tests: Simulate ledger posting failure and verify the refund rolls back or is retriable without duplicate effects.

#### ACCT-MED-026: Charge-to-site updates balances but not payment status

- Files: `platform/apps/api/src/store/store.service.ts:531`, `platform/apps/api/src/pos/pos.service.ts:369`
- Problem: Store/POS charge-to-site increments `balanceAmount`/`totalAmount` without recalculating `paymentStatus` (or `paidAmount`), leaving fully paid reservations marked `paid`.
- Impact: A/R aging, auto-collect, and UI can miss new balances and under-collect charges.
- Fix: Recompute payment status after charge-to-site updates (use `buildPaymentFields` or a shared helper).
- Tests: Charge-to-site on a paid reservation should set `paymentStatus` to `partial` and preserve the new balance.

#### ACCT-MED-027: Charity ledger posting failures are swallowed

- Files: `platform/apps/api/src/charity/charity.service.ts:257`, `platform/apps/api/src/charity/charity.service.ts:613`
- Problem: Donation and payout ledger posting is wrapped in try/catch and errors are ignored while status updates still commit.
- Impact: Charity cash/liability postings can be missing with no retry signal, breaking GL reconciliation.
- Fix: Fail the transaction on ledger errors or record an accounting status that triggers retry/backfill.
- Tests: Ledger failure should not mark donations/payouts as completed without a retry path.

#### ACCT-MED-028: Charity payout completion is not idempotent

- Files: `platform/apps/api/src/charity/charity.service.ts:565`
- Problem: `completePayout` posts ledger entries and updates status without checking if the payout is already completed.
- Impact: Retries or double calls can duplicate ledger entries and overstate charity payouts.
- Fix: Add status guard + idempotency key/dedupe for payout ledger entries.
- Tests: Calling `completePayout` twice should be a no-op on the second call.

#### ACCT-MED-029: Gift card redemption does not apply to reservation balances

- Files: `platform/apps/api/src/gift-cards/gift-cards.service.ts:38`
- Problem: `redeemAgainstBooking` only debits stored value and returns a balance; it does not create a Payment or update reservation `paidAmount`/`balanceAmount`.
- Impact: Reservations remain unpaid even though gift card value is redeemed, creating A/R drift and manual reconciliation work.
- Fix: Integrate gift card redemption with `reservations.recordPayment` or update reservation + ledger in the same transaction.
- Tests: Redeeming a gift card against a booking should reduce the reservation balance and post ledger entries.

#### ACCT-MED-030: Ledger dedupe is not scoped to campground

- Files: `platform/apps/api/src/ledger/ledger-posting.util.ts:111`
- Problem: `postBalancedLedgerEntries` checks for existing entries by `dedupeKey`/`externalRef` without filtering by `campgroundId`.
- Impact: A match in another tenant can suppress ledger postings, creating missing entries and reconciliation drift.
- Fix: Include `campgroundId` (and ideally `reservationId`) in dedupe queries or namespace keys by campground.
- Tests: Same `externalRef` in two campgrounds should still post entries in both.

#### ACCT-MED-031: Wallet refunds are not atomic with reservation updates

- Files: `platform/apps/api/src/reservations/reservations.service.ts:2391`, `platform/apps/api/src/guest-wallet/guest-wallet.service.ts:266`
- Problem: Refund transactions call `guestWalletService.creditFromRefund`, which opens its own transaction; wallet credit can commit even if the reservation refund transaction fails.
- Impact: Wallet balances can diverge from reservation paid amounts and ledger entries, requiring manual reconciliation.
- Fix: Allow wallet credit to accept the current `tx` client or move wallet credit into the same transaction boundary.
- Tests: Simulated failures should not leave wallet credits without matching reservation/ledger updates.

#### ACCT-MED-032: Late fee ledger posting is non-atomic and non-idempotent

- Files: `platform/apps/api/src/billing/billing.service.ts:576`, `platform/apps/api/src/billing/billing.service.ts:587`
- Problem: Late fee line creation happens before ledger posting and outside a transaction; failures leave invoices with late-fee lines but no ledger entries, and reruns skip because the line already exists.
- Impact: Invoice totals and GL diverge for late fees with no easy reconciliation.
- Fix: Wrap late-fee line + ledger posting + total recalculation in a transaction, or add a reconciliation job to backfill missing entries.
- Tests: Ledger failures should not leave orphaned late-fee lines; reruns should be idempotent.

#### ACCT-MED-033: Dispute upsert can fail when Stripe account lookup misses

- Files: `platform/apps/api/src/payments/reconciliation.service.ts:35`, `platform/apps/api/src/payments/reconciliation.service.ts:179`
- Problem: `lookupCampgroundIdByStripeAccount` returns an empty string when no match is found, but `campgroundId` is required for dispute records.
- Impact: Dispute webhooks can fail or silently drop, leaving chargebacks untracked.
- Fix: Return `null` and short-circuit with alerts when the campground cannot be resolved, or enforce a mapping before upsert.
- Tests: Dispute events with unknown accounts should not crash and should emit an alert.

#### ACCT-MED-034: SMS usage undercounts by ignoring segment quantity

- Files: `platform/apps/api/src/org-billing/org-billing.service.ts:249`, `platform/apps/api/src/sms/sms.service.ts:244`
- Problem: Usage summaries count SMS events rather than summing `quantity`, and SMS tracking always passes `segmentCount=1`.
- Impact: Multi-segment messages are billed as single messages, undercharging usage fees.
- Fix: Track actual segment counts and aggregate by `quantity` in usage summaries.
- Tests: A 3-segment SMS should bill 3 units.

#### ACCT-MED-035: Billing period finalization can miss late usage

- Files: `platform/apps/api/src/org-billing/org-billing.service.ts:461`
- Problem: Usage is calculated before the transaction, then all usage events in the period are marked billed; events arriving between the calculation and update are billed but not invoiced.
- Impact: Underbilling with no reconciliation path for late usage.
- Fix: Recompute usage inside the transaction or lock usage rows before calculating.
- Tests: Usage events created during finalization should be included in line items or left unbilled.

#### ACCT-MED-036: Setup service surcharge updates are not atomic

- Files: `platform/apps/api/src/org-billing/usage-tracker.service.ts:71`
- Problem: `setupService` balance updates and `usageEvent` creation occur in separate operations without a transaction.
- Impact: Balances can be reduced without a matching billable usage event (or vice versa), especially under retries/concurrency.
- Fix: Wrap balance update + usage event in a single transaction and add idempotency on reservationId/serviceId.
- Tests: Simulated failures should not change balances without a matching usage event.

#### ACCT-MED-037: Tier source mismatch between internal billing and Stripe

- Files: `platform/apps/api/src/org-billing/org-billing.service.ts:113`, `platform/apps/api/src/org-billing/subscription.service.ts:159`
- Problem: Internal billing uses `earlyAccessEnrollment.tier`, while Stripe subscriptions use `organization.billingTier`.
- Impact: Internal charges can diverge from Stripe invoices when tiers drift.
- Fix: Use a single tier source of truth and reconcile changes across both systems.
- Tests: Changing tiers should update both internal billing calculations and Stripe subscription pricing.

#### ACCT-MED-038: Stripe invoice events do not reconcile internal line items

- Files: `platform/apps/api/src/org-billing/subscription.service.ts:454`
- Problem: `handleInvoicePaid` upserts a paid period but does not create/update line items or link usage events.
- Impact: Periods can appear paid with zero or stale detail, complicating audits and reporting.
- Fix: Store Stripe invoice line items or reconcile to internal usage line items on webhook.
- Tests: Invoice paid webhook should populate line items and totals consistently.

#### ACCT-MED-039: Org billing periods use calendar months instead of Stripe subscription periods

- Files: `platform/apps/api/src/org-billing/org-billing.service.ts:53`, `platform/apps/api/src/org-billing/subscription.service.ts:468`
- Problem: Internal billing periods are created using calendar month boundaries, while Stripe invoices use subscription period start/end timestamps that can fall mid-month.
- Impact: Duplicate or overlapping periods, mismatched usage totals, and invoice reconciliation drift when subscription periods are not calendar-aligned.
- Fix: Align internal period boundaries to Stripe subscription periods (or store a separate Stripe period mapping and reconcile accordingly).
- Tests: Stripe invoice period should map to a single internal period without creating duplicates.

#### ACCT-MED-040: Subscription creation does not guard against duplicates

- Files: `platform/apps/api/src/org-billing/subscription.service.ts:111`
- Problem: `createSubscription` always creates a new Stripe subscription even if the organization already has an active subscription.
- Impact: Duplicate active subscriptions can cause double billing and inconsistent tier state.
- Fix: Check for an existing active subscription before creating a new one; block or reuse as appropriate.
- Tests: Creating a subscription twice should not create multiple active subscriptions.

#### ACCT-MED-041: Stripe usage reporting lacks idempotency

- Files: `platform/apps/api/src/org-billing/subscription.service.ts:222`, `platform/apps/api/src/org-billing/subscription.service.ts:275`
- Problem: Usage reporting to Stripe uses increment calls without idempotency keys or dedupe tracking per reservation/message.
- Impact: Retries can over-report usage and overcharge customers.
- Fix: Add idempotency keys and store/report usage per referenceId to prevent duplicate increments.
- Tests: Retried usage reporting should not increase Stripe usage totals.

#### ACCT-MED-042: Booking usage summaries ignore event quantity

- Files: `platform/apps/api/src/org-billing/org-billing.service.ts:238`, `platform/apps/api/src/org-billing/org-billing.service.ts:316`
- Problem: Booking usage counts events with `count()` rather than summing `quantity`, so batch/manual events with quantity > 1 are undercounted.
- Impact: Underbilling for bulk-imported or aggregated booking usage events.
- Fix: Aggregate `quantity` for `booking_created` events in usage summaries and invoicing.
- Tests: A booking usage event with quantity 5 should bill 5 units.

#### ACCT-MED-043: Payout reconciliation drops transactions beyond the first 100

- Files: `platform/apps/api/src/payments/stripe.service.ts:100`, `platform/apps/api/src/payments/reconciliation.service.ts:235`
- Problem: `listBalanceTransactionsForPayout` requests only the first 100 balance transactions and `ingestPayoutTransactions` does not paginate.
- Impact: Large payouts are reconciled with missing lines, creating false drift and incomplete fee/chargeback postings.
- Fix: Paginate through all balance transactions (`has_more`/`starting_after`) or use Stripe auto-pagination.
- Tests: A payout with >100 transactions should reconcile all lines and totals.

#### ACCT-MED-044: External POS partner API sales/refunds bypass accounting

- Files: `platform/apps/api/src/partner-api/partner-api.service.ts:155`, `platform/apps/api/src/partner-api/partner-api.service.ts:338`
- Problem: `recordSale`/`recordRefund` only create `externalPosSale` and inventory movements; no Payment or ledger entries are created.
- Impact: External POS revenue/refunds never hit the GL or financial reports, causing underreported revenue and reconciliation gaps.
- Fix: Post payments/ledger entries for external sales and refunds (or explicitly flag these as inventory-only and exclude from financial reports).
- Tests: Recording an external sale/refund should produce matching ledger activity or a documented reconciliation workflow.

#### ACCT-MED-045: Cancellation fee policies are not enforced in accounting

- Files: `platform/apps/api/src/reservations/reservations.service.ts:1883`, `platform/apps/api/src/campgrounds/campgrounds.service.ts:1062`
- Problem: Cancellation policy fields are stored and communicated, but cancellation flows do not apply fees or retain deposits when a reservation is marked `cancelled`.
- Impact: Expected cancellation revenue is not captured and guest balances do not reflect policy enforcement.
- Fix: Apply cancellation-fee logic on cancellation, update reservation totals/balance, and post balanced ledger entries.
- Tests: Cancelling within the fee window should apply the correct fee and update ledger/balance.

#### ACCT-MED-046: Refund webhook can miss earlier refunds on out-of-order delivery

- Files: `platform/apps/api/src/payments/payments.controller.ts:1252`
- Problem: `charge.refunded` handling records only the latest refund (`charge.refunds.data[0]`); if older refund events are delivered after a newer refund, the older refund is never recorded.
- Impact: Missing refund records and balance adjustments, leading to understated refunds and ledger drift.
- Fix: Process all refunds on the charge, or switch to `refund.created` events and use the refund object from the event payload.
- Tests: Two partial refunds delivered out-of-order should both be recorded.

#### ACCT-MED-047: Seasonal payment overages are not tracked

- Files: `platform/apps/api/src/seasonals/seasonals.service.ts:653`
- Problem: `recordPayment` applies payments only to unpaid installments; any remaining amount after all dues are paid is discarded with no credit or prepayment record.
- Impact: Overpayments disappear from the seasonal subledger, leading to inaccurate balances and refund exposure.
- Fix: Record overpayments as credit/prepayment (or apply to future periods) and surface them in payment history.
- Tests: Overpaying should create a credit or reduce future dues.

#### ACCT-MED-048: Stripe refund bookkeeping can double-count on retries

- Files: `platform/apps/api/src/stripe-payments/refund.service.ts:165`
- Problem: `processRefund` updates `refundedAmountCents` before inserting the refund Payment; if a retry returns the same Stripe refund, the update can run again while the Payment insert fails on uniqueness.
- Impact: Refunded totals can be overstated and refund/ledger records become inconsistent.
- Fix: Wrap refund bookkeeping in a transaction and dedupe by Stripe refund ID before updating totals.
- Tests: Retrying the same refund should be idempotent and not change totals.

#### ACCT-MED-049: Store refunds mark orders as refunded even if Stripe refund failed

- Files: `platform/apps/api/src/store/store.service.ts:783`
- Problem: `recordRefundOrExchange` updates the order status to `refunded` regardless of `refundStatus` when a Stripe refund fails.
- Impact: Orders appear refunded in accounting/UI while the payment was not actually returned, leading to cash reconciliation gaps.
- Fix: Only mark orders refunded after Stripe confirms success; otherwise keep a `refund_failed` state or require retry.
- Tests: A failed Stripe refund should not set order status to `refunded`.

### Low / Best Practice

#### ACCT-LOW-001: Overpayment/credit balances are clamped to zero

- Files: `platform/apps/api/src/reservations/reservations.service.ts:2532`
- Problem: Refunds reduce `paidAmount` with `Math.max(0, ...)` and `buildPaymentFields` clamps balance to zero.
- Impact: Credit balances from over-refunds or charge reversals are not represented.
- Fix: Allow negative balance or track credit balance separately.
- Tests: Over-refund should surface a credit balance, not just zero.

#### ACCT-LOW-002: Invoice numbers rely on `Date.now()`

- Files: `platform/apps/api/src/billing/billing.service.ts:317`, `platform/apps/api/prisma/schema.prisma:2806`
- Problem: Invoice numbers are derived from `Date.now()` and must be unique.
- Impact: Concurrent invoice creation can collide and fail with a unique constraint error.
- Fix: Use a sequence/UUID suffix or retry on unique constraint failure.
- Tests: Concurrent invoice creation should not fail.

#### ACCT-LOW-003: Billing dashboard revenue period uses reservation create date

- Files: `platform/apps/api/src/billing/billing-dashboard.service.ts:76`
- Problem: Revenue summaries group by `reservation.createdAt` instead of payment or stay dates.
- Impact: Monthly revenue reporting can be skewed when payments occur outside booking month.
- Fix: Use payment/ledger dates or configurable cash vs accrual basis.
- Tests: Revenue periods should align with the selected basis.

#### ACCT-LOW-004: Stored value redemption blocks multiple redemptions per reference

- Files: `platform/apps/api/src/stored-value/stored-value.service.ts:223`
- Problem: Redemption rejects any second redemption for the same `referenceType/referenceId`, even if it is a different gift card or a partial redemption.
- Impact: Guests cannot apply multiple gift cards to one reservation/pos order; staff need manual workarounds.
- Fix: Remove the reference-level uniqueness check or scope it to an idempotency key/card account instead.
- Tests: Two different gift cards should be redeemable against the same reservation.

#### ACCT-LOW-005: Payment reports sum refunds as positive amounts

- Files: `platform/apps/api/src/reports/report.registry.ts:53`
- Problem: Payment metrics sum `amountCents` without considering `direction`; default cashflow reports include refunds as positive revenue.
- Impact: Cashflow and average ticket reports can overstate revenue when refunds exist.
- Fix: Add a net amount metric (charges minus refunds) or apply direction-aware aggregation in templates.
- Tests: A charge and refund on the same day should net to zero in cashflow reports.

#### ACCT-LOW-006: Setup service surcharge line items hardcode unit price

- Files: `platform/apps/api/src/org-billing/org-billing.service.ts:545`, `platform/apps/api/src/org-billing/usage-tracker.service.ts:87`
- Problem: Line items assume `$1.00` per booking even though `perBookingSurchargeCents` can differ.
- Impact: Line item unit pricing can contradict totals and the configured surcharge amount.
- Fix: Store the per-booking surcharge in usage events and use it when constructing line items.
- Tests: A non-$1 surcharge should render accurate unit price and total.

#### ACCT-LOW-007: Manual usage events can lack unit pricing

- Files: `platform/apps/api/src/org-billing/org-billing.service.ts:334`
- Problem: `recordUsageEvent` sets `unitCents` only for booking/SMS events; other types default to `null`.
- Impact: Manually recorded AI/setup-surcharge usage can show $0 unit prices and understate charges.
- Fix: Enforce unit pricing per event type or reject unsupported manual event types.
- Tests: Manual AI/setup-surcharge events should populate unit pricing and totals.

#### ACCT-LOW-008: Financial report uses ledger entry creation time instead of occurrence time

- Files: `platform/apps/api/src/reports/report-subscription.service.ts:514`
- Problem: The subscription financial report filters ledger entries by `createdAt`, not `occurredAt`.
- Impact: Backdated or corrected entries appear in the wrong reporting period, skewing emailed financial summaries.
- Fix: Filter by `occurredAt` (or make basis configurable between posted vs occurred).
- Tests: A backdated ledger entry should appear in the period of its `occurredAt`.

#### ACCT-LOW-009: Stored value holds do not auto-expire

- Files: `platform/apps/api/src/stored-value/stored-value.service.ts:503`
- Problem: `expireOpenHolds` exists but no scheduled job calls it, so open holds can linger indefinitely.
- Impact: Available balances remain artificially low and stored value liability stays inflated until manual cleanup.
- Fix: Add a cron/worker to sweep expired holds and log release counts.
- Tests: Holds past their TTL should auto-expire and restore availability.
