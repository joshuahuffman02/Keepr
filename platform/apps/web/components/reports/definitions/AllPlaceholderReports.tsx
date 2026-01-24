import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, FileText, Clock, type LucideIcon } from "lucide-react";

interface PlaceholderReportProps {
  campgroundId: string;
  dateRange: { start: string; end: string };
}

function PlaceholderCard({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3">
        {Icon && <Icon className="h-5 w-5 text-muted-foreground" />}
        <div>
          <CardTitle className="text-foreground">{title}</CardTitle>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8 text-muted-foreground">
          <p>No data recorded yet</p>
          <p className="text-xs mt-1">Data will appear as activity is logged</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// DAILY OPERATIONS PLACEHOLDERS
// ============================================
export function ShiftNotesReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard title="Shift Notes" description="Manager log and handovers" icon={FileText} />
  );
}

export function MealCountReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard title="Meal Count" description="Breakfast/Dinner guest list" icon={Clock} />
  );
}

export function ParkingListReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard
      title="Parking & Vehicles"
      description="Registered vehicles on site"
      icon={FileText}
    />
  );
}

export function PetListReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard title="Pet List" description="Registered pets in house" icon={FileText} />
  );
}

export function OutOfOrderReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard
      title="Out of Order"
      description="Sites taken offline for maintenance"
      icon={AlertCircle}
    />
  );
}

export function CompStaysReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard
      title="Comp & Staff Stays"
      description="Non-revenue occupied sites"
      icon={FileText}
    />
  );
}

export function VipArrivalsReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard
      title="VIP Arrivals"
      description="High-value guests arriving today"
      icon={FileText}
    />
  );
}

export function DailyRateCheckReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard title="Daily Rate Check" description="Rate variance report" icon={FileText} />
  );
}

// ============================================
// REVENUE PLACEHOLDERS
// ============================================
export function RevenueOverviewReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard
      title="Revenue Overview"
      description="Gross/Net, ADR, RevPAR summary"
      icon={FileText}
    />
  );
}

export function RevenueByRatePlanReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard
      title="Revenue by Rate Plan"
      description="Standard vs Promo vs Group"
      icon={FileText}
    />
  );
}

export function RevenueByAddonReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard
      title="Add-ons & POS Revenue"
      description="Firewood, ice, rentals"
      icon={FileText}
    />
  );
}

export function RevenueByUserReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard
      title="Revenue by User"
      description="Staff booking performance"
      icon={FileText}
    />
  );
}

export function DiscountUsageReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard
      title="Discount Usage"
      description="Promo codes and overrides"
      icon={FileText}
    />
  );
}

export function RefundsAdjustmentsReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard
      title="Refunds & Adjustments"
      description="Rebates and fixes"
      icon={FileText}
    />
  );
}

export function TaxCollectionReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard title="Tax Collection" description="Lodging and sales tax" icon={FileText} />
  );
}

export function CashDrawerReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return <PlaceholderCard title="Cash Drawer" description="Shift reconciliation" icon={FileText} />;
}

export function VoidedTransactionsReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard
      title="Voided Transactions"
      description="Cancelled payments"
      icon={AlertCircle}
    />
  );
}

export function MonthlyRecapReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard title="Monthly Recap" description="MTD performance summary" icon={FileText} />
  );
}

export function RevparSiteTypeReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard title="RevPAR by Site Type" description="Yield efficiency" icon={FileText} />
  );
}

export function AncillaryRevenueReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard
      title="Ancillary Revenue"
      description="Non-room revenue analysis"
      icon={FileText}
    />
  );
}

// ============================================
// PERFORMANCE PLACEHOLDERS
// ============================================
export function PaceReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard title="Pace vs Target" description="On-the-books vs goals" icon={FileText} />
  );
}

export function SiteBreakdownReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard
      title="Site Breakdown"
      description="RevPAR, ADR by individual site"
      icon={FileText}
    />
  );
}

export function OccupancyDayWeekReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard
      title="Day of Week Analysis"
      description="Midweek vs Weekend performance"
      icon={FileText}
    />
  );
}

export function LeadTimeReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard
      title="Lead Time Analysis"
      description="Booking window patterns"
      icon={Clock}
    />
  );
}

export function ChannelProductionReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard
      title="Channel Production"
      description="OTA vs Direct efficiency"
      icon={FileText}
    />
  );
}

export function CompSetReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard title="Competitive Set" description="Market comparison" icon={FileText} />
  );
}

export function YoyPerformanceReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return <PlaceholderCard title="Year-over-Year" description="Growth trends" icon={FileText} />;
}

export function MarketSegmentsReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard title="Market Segments" description="Business vs Leisure" icon={FileText} />
  );
}

export function SiteUtilizationReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard title="Site Utilization" description="Hot vs Cold sites" icon={FileText} />
  );
}

export function YieldManagementReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard
      title="Yield Efficiency"
      description="Dynamic pricing impact"
      icon={FileText}
    />
  );
}

export function PromotionPerfReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard title="Promotions Performance" description="Campaign lift" icon={FileText} />
  );
}

export function UpsellConversionReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard
      title="Upsell Conversion"
      description="Add-on attachment rate"
      icon={FileText}
    />
  );
}

// ============================================
// ACCOUNTING PLACEHOLDERS
// ============================================
export function AgingReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard title="Aging Report" description="AR buckets and overdue" icon={FileText} />
  );
}

export function CityLedgerReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return <PlaceholderCard title="City Ledger" description="Direct bill accounts" icon={FileText} />;
}

export function GuestLedgerReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return <PlaceholderCard title="Guest Ledger" description="In-house balances" icon={FileText} />;
}

export function DepositLedgerReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return <PlaceholderCard title="Deposit Ledger" description="Advance deposits" icon={FileText} />;
}

export function TrialBalanceReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard title="Trial Balance" description="Credits = Debits check" icon={FileText} />
  );
}

export function TaxExemptReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return <PlaceholderCard title="Tax Exempt" description="Non-taxable revenue" icon={FileText} />;
}

export function ReconciliationReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return <PlaceholderCard title="Reconciliation" description="Gateway vs PMS" icon={FileText} />;
}

export function BankDepositReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return <PlaceholderCard title="Bank Deposit" description="Cash/Check batching" icon={FileText} />;
}

export function ArDetailReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return <PlaceholderCard title="AR Detail" description="Invoices and aging" icon={FileText} />;
}

export function WriteOffsReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return <PlaceholderCard title="Write-offs" description="Bad debt" icon={AlertCircle} />;
}

export function LiabilitiesReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard
      title="Liabilities"
      description="Gift certificates & Deposits"
      icon={FileText}
    />
  );
}

// ============================================
// MARKETING PLACEHOLDERS
// ============================================
export function BookingSourcesReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard
      title="Booking Sources"
      description="Channel mix and revenue"
      icon={FileText}
    />
  );
}

export function CampaignsReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return <PlaceholderCard title="Campaigns" description="Promo usage and lift" icon={FileText} />;
}

export function ReferralsReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return <PlaceholderCard title="Referrals" description="Word of mouth tracking" icon={FileText} />;
}

export function PromoCodesReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard title="Promo Codes" description="Code redemption stats" icon={FileText} />
  );
}

export function EmailRoiReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return <PlaceholderCard title="Email ROI" description="Campaign attribution" icon={FileText} />;
}

export function WebsiteConversionReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard title="Website Conversion" description="Traffic to Booking" icon={FileText} />
  );
}

export function SocialAttributionReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard title="Social Media" description="Platform performance" icon={FileText} />
  );
}

export function GeoTargetingReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard title="Geo-targeting" description="Regional performance" icon={FileText} />
  );
}

export function OtaCommissionsReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard title="OTA Commissions" description="Cost of distribution" icon={FileText} />
  );
}

export function CartAbandonmentReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard
      title="Cart Abandonment"
      description="Booking engine drop-off"
      icon={FileText}
    />
  );
}

// ============================================
// FORECASTING PLACEHOLDERS
// ============================================
export function RevenueForecastReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard
      title="Revenue Forecast"
      description="Projected revenue vs last year"
      icon={FileText}
    />
  );
}

export function DemandOutlookReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard
      title="Demand Outlook"
      description="Pickup by week and seasonality"
      icon={FileText}
    />
  );
}

export function PickupReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard
      title="Pickup"
      description="Bookings/revenue vs prior window"
      icon={FileText}
    />
  );
}

export function PeakNonpeakReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard title="Peak vs Non-Peak" description="Performance by season" icon={FileText} />
  );
}

export function Outlook30Report({ campgroundId, dateRange }: PlaceholderReportProps) {
  return <PlaceholderCard title="30-Day Outlook" description="Short-term forecast" icon={Clock} />;
}

export function Outlook60Report({ campgroundId, dateRange }: PlaceholderReportProps) {
  return <PlaceholderCard title="60-Day Outlook" description="Mid-term forecast" icon={Clock} />;
}

export function Outlook90Report({ campgroundId, dateRange }: PlaceholderReportProps) {
  return <PlaceholderCard title="90-Day Outlook" description="Long-term forecast" icon={Clock} />;
}

export function YearEndProjReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard title="Year-End Projection" description="Goal tracking" icon={FileText} />
  );
}

export function BudgetVsActualReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard title="Budget vs Actual" description="Performance to plan" icon={FileText} />
  );
}

export function DemandAlertsReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard title="Demand Alerts" description="Compression dates" icon={AlertCircle} />
  );
}

// ============================================
// AUDITS PLACEHOLDERS
// ============================================
export function AuditLogReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return <PlaceholderCard title="Audit Log" description="All system activity" icon={FileText} />;
}

export function RateChangesReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return <PlaceholderCard title="Rate Changes" description="Price override log" icon={FileText} />;
}

export function RoomMovesReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return <PlaceholderCard title="Site Changes" description="Move log" icon={FileText} />;
}

export function UserActivityReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return (
    <PlaceholderCard title="User Activity" description="Login and action log" icon={FileText} />
  );
}

export function PermissionsReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return <PlaceholderCard title="Permissions" description="Role changes" icon={FileText} />;
}

export function AccessLogReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return <PlaceholderCard title="Access Log" description="Gate and door access" icon={FileText} />;
}

export function NightAuditReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return <PlaceholderCard title="Night Audit" description="Close day logs" icon={Clock} />;
}

export function SystemErrorsReport({ campgroundId, dateRange }: PlaceholderReportProps) {
  return <PlaceholderCard title="System Alerts" description="Error tracking" icon={AlertCircle} />;
}
