"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { ReportSection, ReportStatGrid, ReportEmptyState } from "@/components/reports-v2/ReportPanels";
import { getReportMetaV2, type ReportTabV2 } from "@/lib/report-registry-v2";
import {
  ArrivalsReport,
  DeparturesReport,
  InHouseGuestsReport,
  DailySummaryReport,
  HousekeepingReport,
  MaintenanceDailyReport,
  TransactionLogReport,
  RevenueBySourceReport,
  RevenueBySiteTypeReport,
  PaymentMethodsReport,
  OccupancyReport,
  CancellationsReport,
  LedgerSummaryReport,
  GuestOriginsReport,
  GuestBehaviorReport,
  RepeatGuestsReport,
  DemographicsReport,
  TopSpendersReport,
  EmailCaptureReport,
  LoyaltyMembershipReport,
  GuestFeedbackReport,
  GuestPreferencesReport,
  BannedListReport,
  SpecialDatesReport,
  NewVsReturningReport,
  OverviewReport,
  LengthOfStayReport
} from "@/components/reports/definitions";
import {
  EarlyCheckInsReport,
  LateCheckOutsReport,
  NoShowReport,
  DueOutsReport,
  ExpectedOccupancyReport
} from "@/components/reports/definitions/DailyReportsWave1";
import {
  ShiftNotesReport,
  MealCountReport,
  ParkingListReport,
  PetListReport,
  OutOfOrderReport,
  CompStaysReport,
  VipArrivalsReport,
  DailyRateCheckReport,
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
  AuditLogReport,
  RateChangesReport,
  RoomMovesReport,
  UserActivityReport,
  PermissionsReport,
  AccessLogReport,
  NightAuditReport,
  SystemErrorsReport
} from "@/components/reports/definitions/AllPlaceholderReports";

interface ReportRendererV2Props {
  tab: ReportTabV2;
  subTab: string | null;
  campgroundId: string;
  dateRange: { start: string; end: string };
  reportFilters: {
    status: "all" | "confirmed" | "checked_in" | "pending" | "cancelled";
    siteType: string;
    groupBy: "none" | "site" | "status" | "date" | "siteType";
  };
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);

export function ReportRendererV2({
  tab,
  subTab,
  campgroundId,
  dateRange,
  reportFilters
}: ReportRendererV2Props) {
  const { data: reservations } = useQuery({
    queryKey: ["reservations", campgroundId],
    queryFn: () => apiClient.getReservations(campgroundId),
    enabled: !!campgroundId
  });

  const { data: sites } = useQuery({
    queryKey: ["sites", campgroundId],
    queryFn: () => apiClient.getSites(campgroundId),
    enabled: !!campgroundId
  });

  const { data: ledgerEntries } = useQuery({
    queryKey: ["ledger", campgroundId],
    queryFn: () => apiClient.getLedgerEntries(campgroundId),
    enabled: !!campgroundId
  });

  const { data: tickets } = useQuery({
    queryKey: ["maintenance", campgroundId],
    queryFn: () => apiClient.getMaintenanceTickets(undefined, campgroundId),
    enabled: !!campgroundId
  });

  const stats = useMemo(() => {
    if (!reservations || !sites) return [] as { label: string; value: string; helper?: string }[];

    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    end.setHours(23, 59, 59, 999);

    const inRange = reservations.filter((r: any) => {
      const created = new Date(r.createdAt || r.arrivalDate);
      return created >= start && created <= end;
    });

    const arrivals = reservations.filter((r: any) => {
      const arrival = new Date(r.arrivalDate);
      return arrival >= start && arrival <= end && r.status !== "cancelled";
    });

    const departures = reservations.filter((r: any) => {
      const departure = new Date(r.departureDate);
      return departure >= start && departure <= end && r.status !== "cancelled";
    });

    const inHouse = reservations.filter((r: any) => {
      if (r.status === "cancelled") return false;
      const arrival = new Date(r.arrivalDate);
      const departure = new Date(r.departureDate);
      return arrival <= end && departure >= start;
    });

    const revenue = (ledgerEntries || []).reduce((sum: number, entry: any) => {
      const occurredAt = new Date(entry.occurredAt || entry.createdAt || Date.now());
      if (occurredAt < start || occurredAt > end) return sum;
      const amount = (entry.amount || 0) / 100;
      return entry.direction === "debit" ? sum - amount : sum + amount;
    }, 0);

    const outstanding = reservations.reduce((sum: number, r: any) => {
      const balance = (r.totalAmount || 0) - (r.paidAmount || 0);
      return sum + (balance > 0 ? balance : 0);
    }, 0);

    const occupancy = sites.length > 0 ? Math.round((inHouse.length / sites.length) * 100) : 0;

    if (tab === "daily") {
      return [
        { label: "Arrivals", value: `${arrivals.length}` },
        { label: "Departures", value: `${departures.length}` },
        { label: "In house", value: `${inHouse.length}`, helper: `${occupancy}% occupied` },
        { label: "Open tickets", value: `${tickets?.length ?? 0}` }
      ];
    }

    if (tab === "revenue") {
      return [
        { label: "Total revenue", value: formatCurrency(revenue) },
        { label: "Bookings", value: `${inRange.length}` },
        { label: "Avg booking", value: inRange.length ? formatCurrency(inRange.reduce((sum: number, r: any) => sum + (r.totalAmount || 0), 0) / 100 / inRange.length) : "--" },
        { label: "Outstanding", value: formatCurrency(outstanding / 100) }
      ];
    }

    if (tab === "performance") {
      return [
        { label: "Occupancy", value: `${occupancy}%` },
        { label: "Active stays", value: `${inHouse.length}` },
        { label: "Cancellations", value: `${reservations.filter((r: any) => r.status === "cancelled").length}` },
        { label: "Length of stay", value: inHouse.length ? `${Math.round(inHouse.reduce((sum: number, r: any) => sum + Math.max(1, (new Date(r.departureDate).getTime() - new Date(r.arrivalDate).getTime()) / 86400000), 0) / inHouse.length)} nights` : "--" }
      ];
    }

    if (tab === "guests") {
      const uniqueGuests = new Set(reservations.map((r: any) => r.guestId || r.guest?.id).filter(Boolean));
      const repeatGuests = reservations.filter((r: any) => r.guestId).reduce((acc: Record<string, number>, r: any) => {
        acc[r.guestId] = (acc[r.guestId] || 0) + 1;
        return acc;
      }, {});
      const repeatCount = Object.values(repeatGuests).filter((count) => count > 1).length;
      return [
        { label: "Guests", value: `${uniqueGuests.size}` },
        { label: "Repeat guests", value: `${repeatCount}` },
        { label: "Avg party size", value: inRange.length ? `${(inRange.reduce((sum: number, r: any) => sum + (r.partySize || r.numberOfGuests || 0), 0) / inRange.length).toFixed(1)}` : "--" },
        { label: "Email capture", value: "Track in report" }
      ];
    }

    if (tab === "marketing") {
      const direct = inRange.filter((r: any) => (r.source || "direct") === "direct").length;
      return [
        { label: "Bookings", value: `${inRange.length}` },
        { label: "Direct share", value: inRange.length ? `${Math.round((direct / inRange.length) * 100)}%` : "--" },
        { label: "Top channel", value: "See breakdown" },
        { label: "Conversion", value: "Track in report" }
      ];
    }

    if (tab === "forecasting") {
      return [
        { label: "Booking window", value: "Rolling" },
        { label: "Pickup", value: "Live" },
        { label: "Demand signal", value: "Tracking" },
        { label: "Alerts", value: "Enabled" }
      ];
    }

    if (tab === "accounting") {
      return [
        { label: "Outstanding", value: formatCurrency(outstanding / 100) },
        { label: "Ledger entries", value: `${ledgerEntries?.length ?? 0}` },
        { label: "Revenue", value: formatCurrency(revenue) },
        { label: "Write-offs", value: "Review" }
      ];
    }

    if (tab === "audits") {
      return [
        { label: "Activity", value: "Monitoring" },
        { label: "Exceptions", value: "None flagged" },
        { label: "Permissions", value: "Tracked" },
        { label: "Compliance", value: "In progress" }
      ];
    }

    return [];
  }, [tab, reservations, sites, ledgerEntries, tickets, dateRange]);

  const { reportLabel, description } = getReportMetaV2(tab, subTab);

  const renderPlaceholder = () => (
    <ReportEmptyState
      title={`${reportLabel} is being upgraded`}
      description="This report is part of Reports v2. Data will stream here as soon as the new pipeline finishes." 
      helper="Keep exploring other reports or adjust the date range for available metrics."
    />
  );

  const renderReport = () => {
    if (tab === "overview") {
      return <OverviewReport campgroundId={campgroundId} dateRange={dateRange} />;
    }

    if (tab === "daily") {
      switch (subTab) {
        case "daily-summary": return <DailySummaryReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "transaction-log": return <TransactionLogReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "arrivals-list": return <ArrivalsReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "departures-list": return <DeparturesReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "in-house-guests": return <InHouseGuestsReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "housekeeping-status": return <HousekeepingReport campgroundId={campgroundId} />;
        case "maintenance-daily": return <MaintenanceDailyReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "shift-notes": return <ShiftNotesReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "meal-count": return <MealCountReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "parking-list": return <ParkingListReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "pet-list": return <PetListReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "early-check-ins": return <EarlyCheckInsReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "late-check-outs": return <LateCheckOutsReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "no-show": return <NoShowReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "out-of-order": return <OutOfOrderReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "comp-stays": return <CompStaysReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "due-outs": return <DueOutsReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "vip-arrivals": return <VipArrivalsReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "expected-occupancy": return <ExpectedOccupancyReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "daily-rate-check": return <DailyRateCheckReport campgroundId={campgroundId} dateRange={dateRange} />;
        default:
          return renderPlaceholder();
      }
    }

    if (tab === "revenue") {
      switch (subTab) {
        case "revenue-overview": return <RevenueOverviewReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "revenue-by-source": return <RevenueBySourceReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "revenue-by-site-type": return <RevenueBySiteTypeReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "revenue-by-rate-plan": return <RevenueByRatePlanReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "revenue-by-addon": return <RevenueByAddonReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "revenue-by-user": return <RevenueByUserReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "discount-usage": return <DiscountUsageReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "refunds-adjustments": return <RefundsAdjustmentsReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "tax-collection": return <TaxCollectionReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "payment-methods": return <PaymentMethodsReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "cash-drawer": return <CashDrawerReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "voided-transactions": return <VoidedTransactionsReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "monthly-recap": return <MonthlyRecapReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "revpar-site-type": return <RevparSiteTypeReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "ancillary-revenue": return <AncillaryRevenueReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "cancellation-impact": return renderPlaceholder();
        default:
          return renderPlaceholder();
      }
    }

    if (tab === "performance") {
      switch (subTab) {
        case "pace": return <PaceReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "occupancy": return <OccupancyReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "site-breakdown": return <SiteBreakdownReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "occupancy-day-week": return <OccupancyDayWeekReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "los-analysis": return <LengthOfStayReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "lead-time": return <LeadTimeReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "cancellations": return <CancellationsReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "channel-production": return <ChannelProductionReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "comp-set": return <CompSetReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "yoy-performance": return <YoyPerformanceReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "market-segments": return <MarketSegmentsReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "site-utilization": return <SiteUtilizationReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "yield-management": return <YieldManagementReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "promotion-perf": return <PromotionPerfReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "upsell-conversion": return <UpsellConversionReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "occupancy-heatmap": return renderPlaceholder();
        default:
          return renderPlaceholder();
      }
    }

    if (tab === "guests") {
      switch (subTab) {
        case "guest-origins": return <GuestOriginsReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "guest-behavior": return <GuestBehaviorReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "repeat-guests": return <RepeatGuestsReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "new-vs-returning": return <NewVsReturningReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "demographics": return <DemographicsReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "top-spenders": return <TopSpendersReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "loyalty-membership": return <LoyaltyMembershipReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "guest-feedback": return <GuestFeedbackReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "email-capture": return <EmailCaptureReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "guest-preferences": return <GuestPreferencesReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "banned-list": return <BannedListReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "special-dates": return <SpecialDatesReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "lifetime-value": return renderPlaceholder();
        default:
          return renderPlaceholder();
      }
    }

    if (tab === "marketing") {
      switch (subTab) {
        case "booking-sources": return <BookingSourcesReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "campaigns": return <CampaignsReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "referrals": return <ReferralsReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "promo-codes": return <PromoCodesReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "email-roi": return <EmailRoiReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "website-conversion": return <WebsiteConversionReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "social-attribution": return <SocialAttributionReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "geo-targeting": return <GeoTargetingReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "ota-commissions": return <OtaCommissionsReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "cart-abandonment": return <CartAbandonmentReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "direct-vs-ota": return renderPlaceholder();
        default:
          return renderPlaceholder();
      }
    }

    if (tab === "forecasting") {
      switch (subTab) {
        case "revenue-forecast": return <RevenueForecastReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "demand-outlook": return <DemandOutlookReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "pickup": return <PickupReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "peak-nonpeak": return <PeakNonpeakReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "outlook-30": return <Outlook30Report campgroundId={campgroundId} dateRange={dateRange} />;
        case "outlook-60": return <Outlook60Report campgroundId={campgroundId} dateRange={dateRange} />;
        case "outlook-90": return <Outlook90Report campgroundId={campgroundId} dateRange={dateRange} />;
        case "year-end-proj": return <YearEndProjReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "budget-vs-actual": return <BudgetVsActualReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "demand-alerts": return <DemandAlertsReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "weather-impact": return renderPlaceholder();
        default:
          return renderPlaceholder();
      }
    }

    if (tab === "accounting") {
      switch (subTab) {
        case "ledger": return <LedgerSummaryReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "aging": return <AgingReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "city-ledger": return <CityLedgerReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "guest-ledger": return <GuestLedgerReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "deposit-ledger": return <DepositLedgerReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "trial-balance": return <TrialBalanceReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "tax-exempt": return <TaxExemptReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "reconciliation": return <ReconciliationReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "bank-deposit": return <BankDepositReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "ar-detail": return <ArDetailReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "write-offs": return <WriteOffsReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "liabilities": return <LiabilitiesReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "cash-flow": return renderPlaceholder();
        default:
          return renderPlaceholder();
      }
    }

    if (tab === "audits") {
      switch (subTab) {
        case "audit-log": return <AuditLogReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "rate-changes": return <RateChangesReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "room-moves": return <RoomMovesReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "user-activity": return <UserActivityReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "permissions": return <PermissionsReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "access-log": return <AccessLogReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "night-audit": return <NightAuditReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "system-errors": return <SystemErrorsReport campgroundId={campgroundId} dateRange={dateRange} />;
        case "discount-overrides": return renderPlaceholder();
        default:
          return renderPlaceholder();
      }
    }

    return renderPlaceholder();
  };

  return (
    <div className="space-y-6">
      {stats.length > 0 && <ReportStatGrid stats={stats} />}
      <ReportSection title={reportLabel} description={description}>
        {renderReport()}
      </ReportSection>
    </div>
  );
}
