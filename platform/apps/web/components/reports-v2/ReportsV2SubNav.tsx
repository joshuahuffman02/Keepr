"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { subTabsV2, type ReportTabV2 } from "@/lib/report-registry-v2";
import { buildReportHrefV2, type ReportFiltersV2 } from "@/lib/report-links-v2";

export function ReportsV2SubNav({
  tab,
  activeSubTab,
  dateRange,
  filters
}: {
  tab: ReportTabV2;
  activeSubTab?: string | null;
  dateRange?: { start: string; end: string };
  filters?: ReportFiltersV2;
}) {
  if (tab === "overview") return null;
  const subReports = subTabsV2[tab as keyof typeof subTabsV2] || [];
  if (!subReports.length) return null;

  const resolved = activeSubTab || subReports[0]?.id;

  return (
    <div className="flex flex-nowrap items-center gap-2 overflow-x-auto rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
      {subReports.map((sub) => {
        const isActive = resolved === sub.id;
        return (
          <Link
            key={`${tab}-${sub.id}`}
            href={buildReportHrefV2({ tab, subTab: sub.id, dateRange, filters })}
            aria-current={isActive ? "page" : undefined}
          >
            <Button
              size="sm"
              variant={isActive ? "outline" : "ghost"}
              className={cn("shrink-0 whitespace-nowrap", isActive && "border-primary/30 text-primary")}
            >
              {sub.label}
            </Button>
          </Link>
        );
      })}
    </div>
  );
}
