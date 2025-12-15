import { ReportTab } from "@/app/reports/registry";
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

interface ReportRendererProps {
    tab: ReportTab;
    subTab: string | undefined; // The 'id' of the sub-report
    campgroundId: string;
    dateRange: { start: string; end: string };
    reportFilters?: any;
}

export function ReportRenderer({ tab, subTab, campgroundId, dateRange, reportFilters }: ReportRendererProps) {
    // 1. Overview Tab
    if (tab === "overview") {
        return <OverviewReport campgroundId={campgroundId} />;
    }

    // 2. Daily Operations Tests
    if (tab === "daily") {
        if (subTab === "daily-summary") {
            return <DailySummaryReport campgroundId={campgroundId} dateRange={dateRange} />;
        }
        if (subTab === "housekeeping-status") {
            return <HousekeepingReport campgroundId={campgroundId} />;
        }
        if (subTab === "arrivals-list") {
            return <ArrivalsReport campgroundId={campgroundId} dateRange={dateRange} />;
        }
        if (subTab === "in-house-guests") {
            return <InHouseGuestsReport campgroundId={campgroundId} dateRange={dateRange} />;
        }
        if (subTab === "departures-list") {
            return <DeparturesReport campgroundId={campgroundId} dateRange={dateRange} />;
        }
        if (subTab === "maintenance-daily") {
            return <MaintenanceDailyReport campgroundId={campgroundId} dateRange={dateRange} />;
        }
    }

    // 3. Revenue Reports
    if (tab === "revenue") {
        if (subTab === "revenue-by-source") {
            return <RevenueBySourceReport campgroundId={campgroundId} dateRange={dateRange} />;
        }
    }

    // 4. Guests Reports
    if (tab === "guests") {
        if (subTab === "guest-origins") {
            return <GuestOriginsReport campgroundId={campgroundId} dateRange={dateRange} />;
        }
    }

    // 5. Performance Reports
    if (tab === "performance") {
        if (subTab === "cancellations") {
            return <CancellationsReport campgroundId={campgroundId} dateRange={dateRange} />;
        }
        if (subTab === "occupancy") {
            return <OccupancyReport campgroundId={campgroundId} dateRange={dateRange} />;
        }
    }

    // 6. Accounting Reports
    if (tab === "accounting") {
        if (subTab === "ledger") {
            return <LedgerSummaryReport campgroundId={campgroundId} dateRange={dateRange} />;
        }
    }

    // 7. Fallback / Default View
    return (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-12 text-center space-y-4">
            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                <div className="text-2xl">🚧</div>
            </div>
            <div>
                <h3 className="text-lg font-medium text-slate-900">Coming Soon</h3>
                <p className="text-slate-500 max-w-sm mx-auto mt-1">
                    This report ({tab} / {subTab}) is defined in the registry but implementation is pending.
                </p>
            </div>
        </div>
    );
}
