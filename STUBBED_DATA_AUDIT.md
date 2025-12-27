# Campreserv Production Stubbed Data Audit
**Generated:** December 26, 2025

## Executive Summary

This audit identified **significant gaps** between the production UI and actual backend functionality. Many features display mock data or have incomplete integrations that could mislead users about the system's capabilities.

### Critical Statistics
| Category | Count | Severity |
|----------|-------|----------|
| Frontend pages with hardcoded mock data | 25+ | HIGH |
| Backend services with stubbed implementations | 15+ | HIGH |
| Frontend features without backend | 10+ modules | HIGH |
| Backend endpoints without frontend | 45+ endpoints | MEDIUM |
| TODO/FIXME comments | 17+ | MEDIUM |

---

## PART 1: FRONTEND STUBBED/MOCK DATA

### 1.1 Admin Analytics (ALL MOCK DATA)

Every admin analytics page uses hardcoded mock data instead of real database queries:

| Page | File | Mock Variable | Sample Data |
|------|------|---------------|-------------|
| Platform Overview | `app/admin/analytics/page.tsx:65-133` | `mockOverview`, `mockRevenueTrends`, `mockAccommodationMix`, `mockTopCampgrounds` | totalRevenue: $2,847,500, totalReservations: 12,450 |
| Executive | `app/admin/analytics/executive/page.tsx:27+` | `mockExecutiveData` | Hardcoded executive metrics |
| Guest Analytics | `app/admin/analytics/guests/page.tsx:17+` | `mockGuestData` | Fake guest statistics |
| Revenue | `app/admin/analytics/revenue/page.tsx:16+` | `mockRevenueData` | Static revenue numbers |
| Accommodations | `app/admin/analytics/accommodations/page.tsx:16+` | `mockAccommodationData` | Fixed accommodation stats |
| Geographic | `app/admin/analytics/geographic/page.tsx:17+` | `mockGeographicData` | Hardcoded location data |
| Benchmarks | `app/admin/analytics/benchmarks/page.tsx:17+,57+` | `mockBenchmarks`, `mockCampgroundComparison` | Fake benchmark data |
| Booking | `app/admin/analytics/booking/page.tsx:17+` | `mockBookingData` | Static booking stats |
| Length of Stay | `app/admin/analytics/los/page.tsx:16+` | `mockLosData` | Hardcoded LOS data |
| Amenities | `app/admin/analytics/amenities/page.tsx:16+` | `mockAmenityData` | Fake amenity usage |
| Growth | `app/admin/analytics/growth/page.tsx:93+` | `mockGrowthData` | Static platform growth |
| NPS | `app/admin/analytics/nps/page.tsx:38+` | `mockNpsData` | Hardcoded NPS scores |
| Insights | `app/admin/analytics/insights/page.tsx:52+,178+` | `mockSuggestions`, `mockAnomalies` | Fake AI insights |

### 1.2 Guest Analytics (MOCK DATA)

**File:** `app/admin/guests/page.tsx:107-211`

Contains `mockAnalytics` with:
- totalGuests: 12,847
- newGuestsThisMonth: 342
- Hardcoded geographic distribution (Texas, Florida, Arizona, California)
- Fake demographics (partyComposition, rigTypes, avgRigLength: 32)
- Static seasonal trends

**File:** `app/admin/guests/trends/page.tsx:73-130`
- `mockTrendMetrics` - 6 hardcoded metrics
- `mockRegionalTrends` - 5 fake regions
- `mockMonthlyTrends` - 12 months fake data
- `mockSnowbirdTrends` - 3 years snowbird data

**File:** `app/admin/guests/segments/page.tsx:74-150+`
- `mockSegments` - 5 hardcoded segments (Canadian Snowbirds, Family Campers, Long-Stay Remote Workers, etc.)

### 1.3 Settings Pages (MOCK DATA)

| Page | File | Mock Data |
|------|------|-----------|
| Store Discounts | `app/dashboard/settings/central/store/discounts/page.tsx:39-84` | 4 hardcoded discounts (Senior 10%, Military 15%, Happy Hour 20%, $5 Off Firewood) |
| Tax Rules | `app/dashboard/settings/central/pricing/taxes/page.tsx:46+` | `mockTaxRules` array |
| System Check | `app/dashboard/settings/central/system/check/page.tsx:34+` | `mockIssues` array |
| Site Closures | `app/dashboard/settings/central/bookings/closures/page.tsx:90-127` | 3 fake closures, hardcoded site classes/sites |
| Stay Rules | `app/dashboard/settings/central/bookings/stay-rules/page.tsx:46-80` | 3 hardcoded stay rules |
| Lock Codes | `app/dashboard/settings/central/access/lock-codes/page.tsx:105-150+` | **SECURITY ISSUE:** Hardcoded codes (1234, 5678, CampHappy2025!, 4521) |

### 1.4 Placeholder Values

| Location | File | Value |
|----------|------|-------|
| Stripe Key | `components/payments/PaymentModal.tsx:14` | `pk_test_placeholder` |
| Stripe Key | `app/(public)/park/[slug]/book/page.tsx:24` | `pk_test_placeholder` |
| Manager ID | `app/campgrounds/[campgroundId]/staff/approvals/page.tsx:75` | `"manager-placeholder"` |
| Manager ID | `app/campgrounds/[campgroundId]/staff-scheduling/page.tsx:353,372` | `"manager-placeholder"` |
| User ID | `app/campgrounds/[campgroundId]/staff/payroll/page.tsx:199` | `"current-user"` |
| COI URL | `app/campgrounds/[campgroundId]/reservations/[reservationId]/page.tsx:240` | `"https://placeholder.example/coi.pdf"` |

### 1.5 Gamification System (ENTIRELY STUBBED)

**File:** `lib/gamification/stub-data.ts` (605 lines)

The entire gamification system runs on in-memory stub data:
- Staff members, badges, challenges, events all hardcoded
- XP awards don't persist to database
- Leaderboards are fake

---

## PART 2: BACKEND STUBBED IMPLEMENTATIONS

### 2.1 CRITICAL: Analytics Service (Full Mock Mode)

**File:** `apps/api/src/analytics/analytics.service.ts`

```typescript
const MOCK_MODE = process.env.ANALYTICS_MOCK_MODE === "true";
```

When enabled, uses in-memory store instead of database:
- Lines 34-40: In-memory mock store
- Lines 96-107, 167, 202, 250, 282, 392-394, 466-468, 516, 563, 610, 649, 676-678, 798-799: Returns mock data

### 2.2 CRITICAL: OTA Service (Not Connected)

**File:** `apps/api/src/ota/ota.service.ts`

```typescript
lastSyncStatus: "stubbed",
lastSyncMessage: "Saved locally. External provider calls are not wired yet."
```

- Line 18, 57-58, 76-78: Stubbed status messages
- Lines 614-652: `pushAvailability()` is a placeholder that doesn't call actual OTA APIs

### 2.3 CRITICAL: POS Provider Adapters (Stubbed Payments)

**File:** `apps/api/src/pos/pos-provider.adapters.ts`

```typescript
message: hasCredentials ? "Credentials present (stubbed validation)" : "Missing credentials"
return { status: "pending", raw: { note: "stubbed payment response" } };
```

- Line 53: Credential validation is stubbed
- Lines 67-87: Payment processing returns stub response
- Lines 85-88: Webhook handler returns `"stubbed_webhook_handler"`

### 2.4 CRITICAL: Repeat Charges (Mock Payment)

**File:** `apps/api/src/repeat-charges/repeat-charges.service.ts:130-140`

```typescript
// Mock payment processing for now
// In real implementation, we'd use the saved card on the reservation/guest
```

### 2.5 CRITICAL: Kiosk Check-in Charges (Commented Out)

**Files:**
- `apps/api/src/public-reservations/public-reservations.service.ts:1468`
- `apps/api/src/reservations/reservations.service.ts:2324`

```typescript
// In a real app, we would charge the card here using StripeService
// const charge = await this.stripeService.chargeCustomer(reservation.guestId, balanceDue);
paidAmount: newTotal, // Assume full payment successful
```

### 2.6 Other Stubbed Services

| Service | File | Issue |
|---------|------|-------|
| Currency/Tax | `currency-tax/currency-tax.service.ts` | `fxProvider: "stub"` hardcoded |
| Store | `store/store.service.ts:20-21` | In-memory refunds/exchanges |
| Report Subscription | `reports/report-subscription.service.ts:232` | Hardcoded placeholder metrics |
| RV Life Reviews | `campgrounds/campground-review-connectors.service.ts:71-75` | API not implemented |
| Operations | `operations/operations.service.ts:317-321` | Alert hook stubbed |
| Photo Mirroring | `campgrounds/campground-assets.service.ts` | S3 mirroring not implemented |
| Seasonal Pricing | `seasonals/seasonal-pricing.service.ts` | Custom conditions not evaluated |

### 2.7 TODO Comments in Backend

| File | Line | TODO |
|------|------|------|
| `pos.service.ts` | 40, 100, 197 | Pricing/tax engines, folio integration |
| `maintenance.service.ts` | 172 | Emit state change communication |
| `groups.service.ts` | 153 | Emit group change communication |
| `op-gamification.service.ts` | 611 | Implement speed tracking |
| `op-sla.service.ts` | 76 | Send notification to manager |
| `org-billing/subscription.service.ts` | 526 | Send notification for failed payment |
| `seasonals.service.ts` | 642 | Integrate email/SMS service |
| `nps-analytics.service.ts` | 705 | Add follow-up tracking fields |
| `pii-encryption.service.ts` | 109 | Support key rotation |
| `security/account-lockout.service.ts` | 14 | Migrate to Redis |

---

## PART 3: FRONTEND WITHOUT BACKEND

Features that exist in the UI but have no working backend:

| Feature | Frontend Location | Issue |
|---------|-------------------|-------|
| Gamification | `lib/gamification/stub-data.ts` | Entire module uses stub data |
| AI Insights | `app/admin/analytics/insights/page.tsx` | Mock suggestions, no real AI |
| Social Strategy | `app/social-planner/strategy/page.tsx` | Missing API endpoints |
| OTA Sync | `app/dashboard/settings/ota/page.tsx` | Creates channels but no real sync |
| POS Integration | `app/dashboard/settings/pos-integrations/page.tsx` | Status only, no real sync |
| Guest Portal Cart | `app/portal/my-stay/page.tsx` | Local state only |
| Kiosk Walk-in | `app/kiosk/page.tsx` | Uses localStorage, incomplete flow |
| All Admin Analytics | `app/admin/analytics/*` | All use mock data |

---

## PART 4: BACKEND WITHOUT FRONTEND

Endpoints that exist but aren't called from the UI:

### 4.1 Completely Unused Controllers (~45 endpoints)

| Controller | Endpoints | Purpose |
|------------|-----------|---------|
| **Value Stack** | 13+ endpoints | Guarantees, bonuses, lead capture, booking page config |
| **Feature Progress** | 8 endpoints | Feature completion tracking |
| **QR Code Admin** | 7 endpoints | QR generation for check-in, sites, wifi, store |
| **Menu Config** | 7 endpoints | Sidebar navigation configuration |
| **Observability** | 3 endpoints | Monitoring snapshots, alerts, flags |
| **Setup Services** | 8 endpoints | Service purchase flow |
| **Anomalies** | 1 endpoint | Anomaly detection check |
| **Perf** | 1 endpoint | Performance metrics |

### 4.2 Partially Unused

| Controller | Unused Endpoints |
|------------|------------------|
| Org Referrals | Organization-scoped referral endpoints |

---

## PART 5: SECURITY CONCERNS

### 5.1 Hardcoded Credentials in Frontend

**File:** `app/dashboard/settings/central/access/lock-codes/page.tsx:105-150+`

```typescript
mockCodes = [
  { name: "Main Gate", code: "1234", ... },
  { name: "Pool Gate", code: "5678", ... },
  { name: "Campground WiFi", code: "CampHappy2025!", ... },
  { name: "Cabin A1 Lock", code: "4521", ... },
]
```

### 5.2 Placeholder Payment Keys

Both production booking flows use placeholder Stripe keys that would fail in production:
- `components/payments/PaymentModal.tsx:14`
- `app/(public)/park/[slug]/book/page.tsx:24`

---

## RECOMMENDATIONS

### Immediate (Critical)

1. **Remove all mock data from admin analytics** - Users may be making business decisions based on fake numbers
2. **Complete payment integrations** - Kiosk check-in, repeat charges, POS all have stubbed payments
3. **Fix OTA sync** - Channels appear connected but don't actually sync
4. **Remove hardcoded credentials** - Security risk in lock codes page

### Short-term (High Priority)

5. **Replace Stripe placeholder keys** with proper environment variables
6. **Implement real gamification persistence** - XP and badges don't save
7. **Complete pricing/tax engines** - POS uses stub calculations
8. **Wire up notification services** - Email/SMS sending is stubbed

### Medium-term

9. **Integrate unused backend endpoints** or remove dead code
10. **Implement RV Life reviews API**
11. **Complete S3 photo mirroring**
12. **Add Redis for distributed account lockout**

---

## FILES TO REVIEW

### Frontend Mock Data (Priority)
- `platform/apps/web/app/admin/analytics/*.tsx` (all files)
- `platform/apps/web/app/admin/guests/*.tsx` (all files)
- `platform/apps/web/app/dashboard/settings/central/**/*.tsx`
- `platform/apps/web/lib/gamification/stub-data.ts`

### Backend Stubs (Priority)
- `platform/apps/api/src/analytics/analytics.service.ts`
- `platform/apps/api/src/ota/ota.service.ts`
- `platform/apps/api/src/pos/pos-provider.adapters.ts`
- `platform/apps/api/src/payments/stripe.service.ts`
- `platform/apps/api/src/repeat-charges/repeat-charges.service.ts`
- `platform/apps/api/src/public-reservations/public-reservations.service.ts`
- `platform/apps/api/src/reservations/reservations.service.ts`
