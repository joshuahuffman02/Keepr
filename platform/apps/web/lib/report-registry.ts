import {
  LayoutList,
  Calendar,
  TrendingUp,
  BarChart3,
  Users,
  Megaphone,
  LineChart,
  Calculator,
  ClipboardList,
  type LucideIcon
} from "lucide-react";

export type ReportTab =
  | "overview"
  | "daily"
  | "revenue"
  | "performance"
  | "guests"
  | "marketing"
  | "forecasting"
  | "accounting"
  | "audits"
  | "booking-sources"
  | "guest-origins";

export type SubTab = {
  id: string;
  label: string;
  description?: string;
};

export type ReportDefinition = {
  id: ReportTab;
  label: string;
  icon: LucideIcon;
  description: string;
  subReports: SubTab[];
};

export const subTabs: Record<Exclude<ReportTab, "overview">, SubTab[]> = {
  daily: [
    { id: "daily-summary", label: "Daily summary", description: "Today’s pickup, arrivals, departures" },
    { id: "transaction-log", label: "Transaction log", description: "Payments, refunds, charges" },
    { id: "arrivals-list", label: "Arrivals list", description: "Expected arrivals today" },
    { id: "departures-list", label: "Departures list", description: "Expected departures today" },
    { id: "in-house-guests", label: "In-house guests", description: "Currently checked-in guests" },
    { id: "housekeeping-status", label: "Housekeeping status", description: "Cleaning status by site" },
    { id: "maintenance-daily", label: "Maintenance requests", description: "Open tickets for today" },
    { id: "shift-notes", label: "Shift notes", description: "Manager log and handovers" },
    { id: "meal-count", label: "Meal count", description: "Breakfast/Dinner guest list" },
    { id: "parking-list", label: "Parking & Vehicles", description: "Registered vehicles on site" },
    { id: "pet-list", label: "Pet list", description: "Registered pets in house" },
    { id: "early-check-ins", label: "Early check-ins", description: "Guests arriving before 3PM" },
    { id: "late-check-outs", label: "Late check-outs", description: "Guests departing after 11AM" },
    { id: "no-show", label: "No-show report", description: "Missed arrivals" },
    { id: "out-of-order", label: "Out of order", description: "Sites taken offline" },
    { id: "comp-stays", label: "Comp & Staff stays", description: "Non-revenue occupied sites" },
    { id: "due-outs", label: "Due outs (Overstays)", description: "Guests past departure time" },
    { id: "vip-arrivals", label: "VIP arrivals", description: "High-value guests arriving" },
    { id: "expected-occupancy", label: "Expected occupancy", description: "Forecast for next 24h" },
    { id: "daily-rate-check", label: "Daily rate check", description: "Variance report" }
  ],
  revenue: [
    { id: "revenue-overview", label: "Revenue overview", description: "Gross/Net, ADR, RevPAR" },
    { id: "revenue-by-source", label: "By source", description: "Online vs admin vs kiosk" },
    { id: "revenue-by-site-type", label: "By site type", description: "Performance by category" },
    { id: "revenue-by-rate-plan", label: "By rate plan", description: "Standard vs Promo vs Group" },
    { id: "revenue-by-addon", label: "Add-ons & POS", description: "Firewood, ice, rentals" },
    { id: "revenue-by-user", label: "By user", description: "Staff booking performance" },
    { id: "discount-usage", label: "Discount usage", description: "Promo codes and overrides" },
    { id: "refunds-adjustments", label: "Refunds & Adjustments", description: "Rebates and fixes" },
    { id: "tax-collection", label: "Tax collection", description: "Lodging and sales tax" },
    { id: "payment-methods", label: "Payment methods", description: "Cash vs Card vs Check" },
    { id: "cash-drawer", label: "Cash drawer", description: "Shift reconciliation" },
    { id: "voided-transactions", label: "Voided transactions", description: "Cancelled payments" },
    { id: "monthly-recap", label: "Monthly recap", description: "MTD performance" },
    { id: "revpar-site-type", label: "RevPAR by type", description: "Yield efficiency" },
    { id: "ancillary-revenue", label: "Ancillary analysis", description: "Non-room revenue" }
  ],
  performance: [
    { id: "pace", label: "Pace vs target", description: "On-the-books vs goals" },
    { id: "occupancy", label: "Occupancy & ADR", description: "Blend by date/site type" },
    { id: "site-breakdown", label: "Site breakdown", description: "RevPAR, ADR by site" },
    { id: "occupancy-day-week", label: "Day of week", description: "Midweek vs Weekend" },
    { id: "los-analysis", label: "Length of stay", description: "Average nights per stay" },
    { id: "lead-time", label: "Lead time", description: "Booking window patterns" },
    { id: "cancellations", label: "Cancellations", description: "Lost business analysis" },
    { id: "channel-production", label: "Channel production", description: "OTA vs Direct efficiency" },
    { id: "comp-set", label: "Competitive set", description: "Market comparison" },
    { id: "yoy-performance", label: "Year-over-Year", description: "Growth trends" },
    { id: "market-segments", label: "Market segments", description: "Business vs Leisure" },
    { id: "site-utilization", label: "Site utilization", description: "Hot vs Cold sites" },
    { id: "yield-management", label: "Yield efficiency", description: "Dynamic pricing impact" },
    { id: "promotion-perf", label: "Promotions", description: "Campaign lift" },
    { id: "upsell-conversion", label: "Upsell conversion", description: "Add-on attachment rate" }
  ],
  guests: [
    { id: "guest-origins", label: "Guest origins", description: "State/ZIP mix" },
    { id: "guest-behavior", label: "Behavior", description: "Lead time, LOS, cancellations" },
    { id: "repeat-guests", label: "Repeat guests", description: "Retention analysis" },
    { id: "new-vs-returning", label: "New vs Returning", description: "Loyalty tracking" },
    { id: "demographics", label: "Demographics", description: "Age, Gender, Party size" },
    { id: "top-spenders", label: "Top spenders", description: "High LTV guests" },
    { id: "loyalty-membership", label: "Memberships", description: "Club/Loyalty performance" },
    { id: "guest-feedback", label: "Feedback & NPS", description: "Satisfaction scores" },
    { id: "email-capture", label: "Email capture", description: "Database growth" },
    { id: "guest-preferences", label: "Preferences", description: "Common requests" },
    { id: "banned-list", label: "Do Not Rent", description: "Restricted guests" },
    { id: "special-dates", label: "Birthdays", description: "Celebrations this month" }
  ],
  marketing: [
    { id: "booking-sources", label: "Booking sources", description: "Channel mix and revenue" },
    { id: "campaigns", label: "Campaigns", description: "Promo usage and lift" },
    { id: "referrals", label: "Referrals", description: "Word of mouth tracking" },
    { id: "promo-codes", label: "Promo codes", description: "Code redemption stats" },
    { id: "email-roi", label: "Email ROI", description: "Campaign attribution" },
    { id: "website-conversion", label: "Website conversion", description: "Traffic to Booking" },
    { id: "social-attribution", label: "Social media", description: "Platform performance" },
    { id: "geo-targeting", label: "Geo-targeting", description: "Regional performance" },
    { id: "ota-commissions", label: "OTA Commissions", description: "Cost of distribution" },
    { id: "cart-abandonment", label: "Abandonment", description: "Booking engine drop-off" }
  ],
  forecasting: [
    { id: "revenue-forecast", label: "Revenue forecast", description: "Projected revenue vs last year" },
    { id: "demand-outlook", label: "Demand outlook", description: "Pickup by week and seasonality" },
    { id: "pickup", label: "Pickup", description: "Bookings/revenue vs prior window" },
    { id: "peak-nonpeak", label: "Peak vs non-peak", description: "Performance by season" },
    { id: "outlook-30", label: "30-day outlook", description: "Short-term forecast" },
    { id: "outlook-60", label: "60-day outlook", description: "Mid-term forecast" },
    { id: "outlook-90", label: "90-day outlook", description: "Long-term forecast" },
    { id: "year-end-proj", label: "Year-end projection", description: "Goal tracking" },
    { id: "budget-vs-actual", label: "Budget vs Actual", description: "Performance to plan" },
    { id: "demand-alerts", label: "Demand alerts", description: "Compression dates" }
  ],
  accounting: [
    { id: "ledger", label: "Ledger summary", description: "GL net and exports" },
    { id: "aging", label: "Aging", description: "AR buckets and overdue" },
    { id: "city-ledger", label: "City ledger", description: "Direct bill accounts" },
    { id: "guest-ledger", label: "Guest ledger", description: "In-house balances" },
    { id: "deposit-ledger", label: "Deposit ledger", description: "Advance deposits" },
    { id: "trial-balance", label: "Trial balance", description: "Credits=Debits check" },
    { id: "tax-exempt", label: "Tax exempt", description: "Non-taxable revenue" },
    { id: "reconciliation", label: "Reconciliation", description: "Gateway vs PMS" },
    { id: "bank-deposit", label: "Bank deposit", description: "Cash/Check batching" },
    { id: "ar-detail", label: "AR Detail", description: "Invoices and aging" },
    { id: "write-offs", label: "Write-offs", description: "Bad debt" },
    { id: "liabilities", label: "Liabilities", description: "Gift certs & Deposits" }
  ],
  audits: [
    { id: "audit-log", label: "Audit log", description: "All system activity" },
    { id: "rate-changes", label: "Rate changes", description: "Price override log" },
    { id: "room-moves", label: "Site changes", description: "Move log" },
    { id: "user-activity", label: "User activity", description: "Login and action log" },
    { id: "permissions", label: "Permissions", description: "Role changes" },
    { id: "access-log", label: "Access log", description: "Gate and door access" },
    { id: "night-audit", label: "Night audit", description: "Close day logs" },
    { id: "system-errors", label: "System alerts", description: "Error tracking" }
  ],
  "booking-sources": [],
  "guest-origins": []
};

export const reportCatalog: ReportDefinition[] = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutList,
    description: "High-level KPIs and trends at a glance",
    subReports: [{ id: "dashboard-summary", label: "Dashboard summary", description: "Revenue, occupancy, ADR, RevPAR" }]
  },
  {
    id: "daily",
    label: "Daily Operations",
    icon: Calendar,
    description: "Day-to-day arrivals, departures, and transactions",
    subReports: subTabs.daily
  },
  {
    id: "revenue",
    label: "Revenue",
    icon: TrendingUp,
    description: "Detailed revenue analysis and breakdowns",
    subReports: subTabs.revenue
  },
  {
    id: "performance",
    label: "Performance",
    icon: BarChart3,
    description: "Site and property performance metrics",
    subReports: subTabs.performance
  },
  {
    id: "guests",
    label: "Guests",
    icon: Users,
    description: "Guest demographics and behavior patterns",
    subReports: subTabs.guests
  },
  {
    id: "marketing",
    label: "Marketing",
    icon: Megaphone,
    description: "Booking sources and campaign effectiveness",
    subReports: subTabs.marketing
  },
  {
    id: "forecasting",
    label: "Forecasting",
    icon: LineChart,
    description: "Projections and demand predictions",
    subReports: subTabs.forecasting
  },
  {
    id: "accounting",
    label: "Accounting",
    icon: Calculator,
    description: "Financial ledgers and aging reports",
    subReports: subTabs.accounting
  },
  {
    id: "audits",
    label: "Audits",
    icon: ClipboardList,
    description: "Activity logs and compliance tracking",
    subReports: [{ id: "audit-log", label: "Audit log", description: "All system activity" }]
  }
];

export function isReportTab(value: string): value is ReportTab {
  if (value === "overview") return true;
  return Object.prototype.hasOwnProperty.call(subTabs, value);
}

export function getDefaultSubTab(tab: ReportTab): string | null {
  if (tab === "overview") return null;
  const subs = subTabs[tab as keyof typeof subTabs] || [];
  return subs[0]?.id ?? null;
}

export function findSubTab(tab: ReportTab, subTabId?: string | null): SubTab | null {
  if (tab === "overview") return null;
  const subs = subTabs[tab as keyof typeof subTabs] || [];
  if (!subTabId) return subs[0] ?? null;
  return subs.find((s) => s.id === subTabId) ?? subs[0] ?? null;
}
