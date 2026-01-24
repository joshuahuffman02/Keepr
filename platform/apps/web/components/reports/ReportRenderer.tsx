import { ReportTab } from "@/lib/report-registry";
import { OverviewReport } from "./definitions/OverviewReport";
import { ArrivalsReport } from "./definitions/ArrivalsReport";
import { RevenueBySourceReport } from "./definitions/RevenueBySourceReport";
import { GuestOriginsReport } from "./definitions/GuestOriginsReport";
import { InHouseGuestsReport } from "./definitions/InHouseGuestsReport";
import { DeparturesReport } from "./definitions/DeparturesReport";
import { CancellationsReport } from "./definitions/CancellationsReport";
import { OccupancyReport } from "./definitions/OccupancyReport";
import { LedgerSummaryReport } from "./definitions/LedgerSummaryReport";
import { MaintenanceDailyReport } from "./definitions/MaintenanceDailyReport";
import { DailySummaryReport } from "./definitions/DailySummaryReport";
import { HousekeepingReport } from "./definitions/HousekeepingReport";
import { TransactionLogReport } from "./definitions/TransactionLogReport";
import { RevenueBySiteTypeReport } from "./definitions/RevenueBySiteTypeReport";
import { PaymentMethodsReport } from "./definitions/PaymentMethodsReport";
import { NewVsReturningReport } from "./definitions/NewVsReturningReport";
import { LengthOfStayReport } from "./definitions/LengthOfStayReport";
// Guest Reports
import { GuestBehaviorReport } from "./definitions/GuestBehaviorReport";
import { RepeatGuestsReport } from "./definitions/RepeatGuestsReport";
import { DemographicsReport } from "./definitions/DemographicsReport";
import { TopSpendersReport } from "./definitions/TopSpendersReport";
import { EmailCaptureReport } from "./definitions/EmailCaptureReport";
import { LoyaltyMembershipReport } from "./definitions/LoyaltyMembershipReport";
import { GuestFeedbackReport } from "./definitions/GuestFeedbackReport";
import { GuestPreferencesReport } from "./definitions/GuestPreferencesReport";
import { BannedListReport } from "./definitions/BannedListReport";
import { SpecialDatesReport } from "./definitions/SpecialDatesReport";
// Daily Reports Wave 1
import {
  EarlyCheckInsReport,
  LateCheckOutsReport,
  NoShowReport,
  DueOutsReport,
  ExpectedOccupancyReport,
} from "./definitions/DailyReportsWave1";
// All Placeholder Reports
import {
  // Daily
  ShiftNotesReport,
  MealCountReport,
  ParkingListReport,
  PetListReport,
  OutOfOrderReport,
  CompStaysReport,
  VipArrivalsReport,
  DailyRateCheckReport,
  // Revenue
  RevenueOverviewReport,
  RevenueByRatePlanReport,
  RevenueByAddonReport,
  RevenueByUserReport,
  DiscountUsageReport,
  RefundsAdjustmentsReport,
  TaxCollectionReport,
  CashDrawerReport,
  VoidedTransactionsReport,
  MonthlyRecapReport,
  RevparSiteTypeReport,
  AncillaryRevenueReport,
  // Performance
  PaceReport,
  SiteBreakdownReport,
  OccupancyDayWeekReport,
  LeadTimeReport,
  ChannelProductionReport,
  CompSetReport,
  YoyPerformanceReport,
  MarketSegmentsReport,
  SiteUtilizationReport,
  YieldManagementReport,
  PromotionPerfReport,
  UpsellConversionReport,
  // Accounting
  AgingReport,
  CityLedgerReport,
  GuestLedgerReport,
  DepositLedgerReport,
  TrialBalanceReport,
  TaxExemptReport,
  ReconciliationReport,
  BankDepositReport,
  ArDetailReport,
  WriteOffsReport,
  LiabilitiesReport,
  // Marketing
  BookingSourcesReport,
  CampaignsReport,
  ReferralsReport,
  PromoCodesReport,
  EmailRoiReport,
  WebsiteConversionReport,
  SocialAttributionReport,
  GeoTargetingReport,
  OtaCommissionsReport,
  CartAbandonmentReport,
  // Forecasting
  RevenueForecastReport,
  DemandOutlookReport,
  PickupReport,
  PeakNonpeakReport,
  Outlook30Report,
  Outlook60Report,
  Outlook90Report,
  YearEndProjReport,
  BudgetVsActualReport,
  DemandAlertsReport,
  // Audits
  AuditLogReport,
  RateChangesReport,
  RoomMovesReport,
  UserActivityReport,
  PermissionsReport,
  AccessLogReport,
  NightAuditReport,
  SystemErrorsReport,
} from "./definitions/AllPlaceholderReports";
import type { ReportFilters } from "@/lib/report-links";

interface ReportRendererProps {
  tab: ReportTab;
  subTab: string | undefined;
  campgroundId: string;
  dateRange: { start: string; end: string };
  reportFilters?: ReportFilters;
}

export function ReportRenderer({
  tab,
  subTab,
  campgroundId,
  dateRange,
  reportFilters,
}: ReportRendererProps) {
  // 1. Overview Tab
  if (tab === "overview") {
    return <OverviewReport campgroundId={campgroundId} />;
  }

  // 2. Daily Operations
  if (tab === "daily") {
    switch (subTab) {
      case "daily-summary":
        return <DailySummaryReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "transaction-log":
        return <TransactionLogReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "housekeeping-status":
        return <HousekeepingReport campgroundId={campgroundId} />;
      case "arrivals-list":
        return <ArrivalsReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "in-house-guests":
        return <InHouseGuestsReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "departures-list":
        return <DeparturesReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "maintenance-daily":
        return <MaintenanceDailyReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "early-check-ins":
        return <EarlyCheckInsReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "late-check-outs":
        return <LateCheckOutsReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "no-show":
        return <NoShowReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "due-outs":
        return <DueOutsReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "expected-occupancy":
        return <ExpectedOccupancyReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "shift-notes":
        return <ShiftNotesReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "meal-count":
        return <MealCountReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "parking-list":
        return <ParkingListReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "pet-list":
        return <PetListReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "out-of-order":
        return <OutOfOrderReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "comp-stays":
        return <CompStaysReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "vip-arrivals":
        return <VipArrivalsReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "daily-rate-check":
        return <DailyRateCheckReport campgroundId={campgroundId} dateRange={dateRange} />;
    }
  }

  // 3. Revenue Reports
  if (tab === "revenue") {
    switch (subTab) {
      case "revenue-overview":
        return <RevenueOverviewReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "revenue-by-source":
        return <RevenueBySourceReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "revenue-by-site-type":
        return <RevenueBySiteTypeReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "revenue-by-rate-plan":
        return <RevenueByRatePlanReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "revenue-by-addon":
        return <RevenueByAddonReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "revenue-by-user":
        return <RevenueByUserReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "discount-usage":
        return <DiscountUsageReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "refunds-adjustments":
        return <RefundsAdjustmentsReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "tax-collection":
        return <TaxCollectionReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "payment-methods":
        return <PaymentMethodsReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "cash-drawer":
        return <CashDrawerReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "voided-transactions":
        return <VoidedTransactionsReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "monthly-recap":
        return <MonthlyRecapReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "revpar-site-type":
        return <RevparSiteTypeReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "ancillary-revenue":
        return <AncillaryRevenueReport campgroundId={campgroundId} dateRange={dateRange} />;
    }
  }

  // 4. Guests Reports
  if (tab === "guests") {
    switch (subTab) {
      case "guest-origins":
        return <GuestOriginsReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "guest-behavior":
        return <GuestBehaviorReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "repeat-guests":
        return <RepeatGuestsReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "new-vs-returning":
        return <NewVsReturningReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "demographics":
        return <DemographicsReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "top-spenders":
        return <TopSpendersReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "loyalty-membership":
        return <LoyaltyMembershipReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "guest-feedback":
        return <GuestFeedbackReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "email-capture":
        return <EmailCaptureReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "guest-preferences":
        return <GuestPreferencesReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "banned-list":
        return <BannedListReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "special-dates":
        return <SpecialDatesReport campgroundId={campgroundId} dateRange={dateRange} />;
    }
  }

  // 5. Performance Reports
  if (tab === "performance") {
    switch (subTab) {
      case "pace":
        return <PaceReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "occupancy":
        return <OccupancyReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "site-breakdown":
        return <SiteBreakdownReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "occupancy-day-week":
        return <OccupancyDayWeekReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "los-analysis":
        return <LengthOfStayReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "lead-time":
        return <LeadTimeReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "cancellations":
        return <CancellationsReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "channel-production":
        return <ChannelProductionReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "comp-set":
        return <CompSetReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "yoy-performance":
        return <YoyPerformanceReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "market-segments":
        return <MarketSegmentsReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "site-utilization":
        return <SiteUtilizationReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "yield-management":
        return <YieldManagementReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "promotion-perf":
        return <PromotionPerfReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "upsell-conversion":
        return <UpsellConversionReport campgroundId={campgroundId} dateRange={dateRange} />;
    }
  }

  // 6. Accounting Reports
  if (tab === "accounting") {
    switch (subTab) {
      case "ledger":
        return <LedgerSummaryReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "aging":
        return <AgingReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "city-ledger":
        return <CityLedgerReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "guest-ledger":
        return <GuestLedgerReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "deposit-ledger":
        return <DepositLedgerReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "trial-balance":
        return <TrialBalanceReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "tax-exempt":
        return <TaxExemptReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "reconciliation":
        return <ReconciliationReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "bank-deposit":
        return <BankDepositReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "ar-detail":
        return <ArDetailReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "write-offs":
        return <WriteOffsReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "liabilities":
        return <LiabilitiesReport campgroundId={campgroundId} dateRange={dateRange} />;
    }
  }

  // 7. Marketing Reports
  if (tab === "marketing") {
    switch (subTab) {
      case "booking-sources":
        return <BookingSourcesReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "campaigns":
        return <CampaignsReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "referrals":
        return <ReferralsReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "promo-codes":
        return <PromoCodesReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "email-roi":
        return <EmailRoiReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "website-conversion":
        return <WebsiteConversionReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "social-attribution":
        return <SocialAttributionReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "geo-targeting":
        return <GeoTargetingReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "ota-commissions":
        return <OtaCommissionsReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "cart-abandonment":
        return <CartAbandonmentReport campgroundId={campgroundId} dateRange={dateRange} />;
    }
  }

  // 8. Forecasting Reports
  if (tab === "forecasting") {
    switch (subTab) {
      case "revenue-forecast":
        return <RevenueForecastReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "demand-outlook":
        return <DemandOutlookReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "pickup":
        return <PickupReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "peak-nonpeak":
        return <PeakNonpeakReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "outlook-30":
        return <Outlook30Report campgroundId={campgroundId} dateRange={dateRange} />;
      case "outlook-60":
        return <Outlook60Report campgroundId={campgroundId} dateRange={dateRange} />;
      case "outlook-90":
        return <Outlook90Report campgroundId={campgroundId} dateRange={dateRange} />;
      case "year-end-proj":
        return <YearEndProjReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "budget-vs-actual":
        return <BudgetVsActualReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "demand-alerts":
        return <DemandAlertsReport campgroundId={campgroundId} dateRange={dateRange} />;
    }
  }

  // 9. Audits Reports
  if (tab === "audits") {
    switch (subTab) {
      case "audit-log":
        return <AuditLogReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "rate-changes":
        return <RateChangesReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "room-moves":
        return <RoomMovesReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "user-activity":
        return <UserActivityReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "permissions":
        return <PermissionsReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "access-log":
        return <AccessLogReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "night-audit":
        return <NightAuditReport campgroundId={campgroundId} dateRange={dateRange} />;
      case "system-errors":
        return <SystemErrorsReport campgroundId={campgroundId} dateRange={dateRange} />;
    }
  }

  // 10. Fallback
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm p-12 text-center space-y-4">
      <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto">
        <div className="text-2xl">🚧</div>
      </div>
      <div>
        <h3 className="text-lg font-medium text-foreground">Coming Soon</h3>
        <p className="text-muted-foreground max-w-sm mx-auto mt-1">
          This report ({tab} / {subTab}) is defined in the registry but implementation is pending.
        </p>
      </div>
    </div>
  );
}
