"use client";

import { ReactNode } from "react";
import { ReportsV2Nav } from "@/components/reports-v2/ReportsV2Nav";
import type { SavedReport } from "@/components/reports/savedReports";
import type { ReportTabV2 } from "@/lib/report-registry-v2";
import type { ReportFiltersV2 } from "@/lib/report-links-v2";

export function ReportsV2Shell({
  children,
  activeTab,
  activeSubTab,
  activeShortcut,
  dateRange,
  filters,
  pinnedReports,
}: {
  children: ReactNode;
  activeTab?: ReportTabV2 | null;
  activeSubTab?: string | null;
  activeShortcut?: "saved" | "portfolio" | "devices" | "audit" | null;
  dateRange?: { start: string; end: string };
  filters?: ReportFiltersV2;
  pinnedReports?: SavedReport[];
}) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="h-fit lg:sticky lg:top-4">
        <ReportsV2Nav
          activeTab={activeTab}
          activeSubTab={activeSubTab}
          activeShortcut={activeShortcut}
          dateRange={dateRange}
          filters={filters}
          pinnedReports={pinnedReports}
        />
      </aside>
      <main className="space-y-5">{children}</main>
    </div>
  );
}
