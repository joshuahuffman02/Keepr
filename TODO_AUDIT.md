# TODO/FIXME Audit

**Generated:** 2025-12-27
**Status:** In Progress

This document tracks all TODO, FIXME, and incomplete code comments in the codebase.

---

## Critical (Data Loss / Blocking Issues)

| # | File | Line | Issue | Status |
|---|------|------|-------|--------|
| 1 | `apps/api/src/store/store.service.ts` | 19 | CRITICAL: Implement database persistence for order adjustments (data lost on restart) | **FIXED** |

---

## Important (Missing Core Functionality)

| # | File | Line | Issue | Status |
|---|------|------|-------|--------|
| 2 | `apps/api/src/store/store.service.ts` | 96-107 | Add missing timestamp fields to StoreOrder schema (seenAt, pickedUpAt, etc.) | **FIXED** |
| 3 | `apps/api/src/store/store.service.ts` | 291-320 | seenAt field queries will fail - needs schema update | **FIXED** |
| 4 | `apps/api/src/store/store.service.ts` | 666-787 | Implement proper refund workflow (inventory restore, payment processor, email) | **FIXED** |
| 5 | `apps/api/src/pos/pos.service.ts` | 40 | Implement pricing/tax versions and create items | **FIXED** |
| 6 | `apps/api/src/pos/pos.service.ts` | 197 | Integrate POS with reservations AR/folio | Pending |
| 7 | `apps/api/src/ota/ota.service.ts` | 694, 837, 848 | OTA provider API integration (actual API calls, pricing, provider methods) | Pending |
| 8 | `apps/api/src/seasonals/seasonals.service.ts` | 716 | Integrate with actual email/SMS sending service | **FIXED** (email done, SMS pending provider) |

---

## Moderate (Improvements / Integrations)

| # | File | Line | Issue | Status |
|---|------|------|-------|--------|
| 9 | `apps/api/src/currency-tax/currency-tax.service.ts` | 44, 84 | Integrate real FX provider (OpenExchangeRates, XE.com, ECB) | Pending |
| 10 | `apps/api/src/security/account-lockout.service.ts` | 14 | Migrate to Redis for distributed locking | Pending |
| 11 | `apps/api/src/security/pii-encryption.service.ts` | 109 | Support key rotation by version lookup | **FIXED** |
| 12 | `apps/api/src/campgrounds/campground-review-connectors.service.ts` | 74, 110, 134 | Complete RV Life API integration | Pending |
| 13 | `apps/api/src/maintenance/maintenance.service.ts` | 172 | Emit maintenance state/out_of_order change communication | **FIXED** |
| 14 | `apps/api/src/groups/groups.service.ts` | 153 | Emit group change communication if sharedComm | **FIXED** |
| 15 | `apps/api/src/operations/operations.service.ts` | 309, 438 | Implement additional notification channels and EmailService.sendEmail | **FIXED** |
| 16 | `apps/api/src/op-tasks/services/op-sla.service.ts` | 76 | Send notification to manager on SLA breach | **FIXED** |
| 17 | `apps/api/src/op-tasks/services/op-gamification.service.ts` | 611 | Implement speed tracking for gamification | **FIXED** |
| 18 | `apps/api/src/org-billing/subscription.service.ts` | 526 | Send notification to org owner about failed payment | **FIXED** |
| 19 | `apps/api/src/admin/platform-analytics/services/nps-analytics.service.ts` | 705 | Add follow-up tracking fields to NpsResponse model | **FIXED** |

---

## Minor (Low Priority / Frontend)

| # | File | Line | Issue | Status |
|---|------|------|-------|--------|
| 20 | `apps/web/app/store/inventory/page.tsx` | 20 | Get campgroundId from context or URL | **FIXED** |
| 21 | `apps/web/components/settings/SettingsContext.tsx` | 70 | Replace with actual API call | **FIXED** |
| 22 | `apps/web/components/marketing/DemoCTA.tsx` | 21 | Implement form submission logic | **FIXED** |
| 23 | `apps/web/app/dashboard/settings/central/bookings/closures/page.tsx` | 201, 211 | Implement save/toggle mutations | **FIXED** |

---

## Summary

- **Critical:** 0 remaining (1 fixed)
- **Important:** 3 remaining (5 fixed)
- **Moderate:** 3 remaining (8 fixed)
- **Minor:** 0 remaining (4 fixed)
- **Total:** 6 remaining (18 fixed)

---

## Progress Log

| Date | Item # | Action |
|------|--------|--------|
| 2025-12-27 | - | Initial audit created |
| 2025-12-27 | 1 | FIXED: Added StoreOrderAdjustment model to Prisma schema, updated store.service.ts to use database instead of in-memory Map |
| 2025-12-27 | 2 | FIXED: Added seenAt, readyAt, deliveredAt timestamp fields to StoreOrder model |
| 2025-12-27 | 3 | FIXED: Updated listUnseenOrders and markOrderSeen to use seenAt field |
| 2025-12-27 | 4 | PARTIAL: Database persistence done, payment processor integration still needed |
| 2025-12-27 | 20 | FIXED: Updated store inventory page to use CampgroundContext instead of direct localStorage |
| 2025-12-27 | 21 | FIXED: Updated SettingsContext to use real /api/system-check endpoint instead of mock data |
| 2025-12-27 | 23 | FIXED: Implemented save/toggle mutations for closures page using blackouts API |
| 2025-12-27 | 13 | FIXED: Added EmailModule to maintenance.module.ts, implemented notifyOutOfOrderChange() in maintenance.service.ts |
| 2025-12-27 | 14 | FIXED: Added EmailModule to groups.module.ts, implemented notifyGroupChange() in groups.service.ts for sharedComm groups |
| 2025-12-27 | 16 | FIXED: Added EmailModule to op-tasks.module.ts, implemented notifyManagerSlaBreach() in op-sla.service.ts |
| 2025-12-27 | 18 | FIXED: Added EmailModule to org-billing.module.ts, implemented notifyOrgOwnerPaymentFailed() in subscription.service.ts |
| 2025-12-27 | 22 | FIXED: Added DemoRequest model, /public/demo-request endpoint, updated DemoCTA with API call, loading state, and error handling |
| 2025-12-27 | 8 | FIXED: Added EmailModule to seasonals.module.ts, integrated EmailService for bulk email sending in sendBulkMessage() |
| 2025-12-27 | 15 | FIXED: Added EmailModule to operations.module.ts, implemented sendEmailAlert() in operations.service.ts |
| 2025-12-27 | 17 | FIXED: Added fastCompletions fields to Prisma schema, implemented speed badge tracking in op-gamification.service.ts |
| 2025-12-27 | 19 | FIXED: Added follow-up and resolution tracking fields to NpsResponse model, updated nps-analytics.service.ts to use new fields |
| 2025-12-27 | 11 | FIXED: Added key store Map for multiple key versions, loadHistoricalKeys() for PII_ENCRYPTION_KEY_V1-V10, reEncrypt() method for key rotation |
| 2025-12-27 | 5 | FIXED: Implemented proper pricing/tax in createCart and updateCart - fetches product prices, location overrides, calculates tax with TaxRule |
| 2025-12-27 | 4 | FIXED: Implemented full refund workflow - Stripe refunds, inventory restock, ledger entries, guest email notifications |
