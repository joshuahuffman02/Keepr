"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { reportCatalog, subTabs, type ReportTab } from "@/lib/report-registry";
import { buildReportHref, type ReportFilters } from "@/lib/report-links";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

type ReportsNavBarProps = {
  activeTab?: ReportTab | null;
  activeSubTab?: string | null;
  dateRange?: { start: string; end: string };
  filters?: ReportFilters;
  extraLinks?: { label: string; href: string; active?: boolean }[];
  showSearch?: boolean;
};

type ReportSearchItem = {
  tab: ReportTab;
  subTab?: string | null;
  label: string;
  category: string;
  description?: string;
};

const hasSubTabs = (value: string): value is keyof typeof subTabs => value in subTabs;

export function ReportsNavBar({
  activeTab,
  activeSubTab,
  dateRange,
  filters,
  extraLinks = [],
  showSearch = true,
}: ReportsNavBarProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const activeSubTabs = useMemo(() => {
    if (!activeTab || activeTab === "overview") return [];
    const list = hasSubTabs(activeTab) ? subTabs[activeTab] : undefined;
    if (list?.length) return list;
    const fallback = reportCatalog.find((category) => category.id === activeTab);
    return fallback?.subReports ?? [];
  }, [activeTab]);

  const resolvedActiveSubTab = activeSubTab || activeSubTabs[0]?.id || null;

  const searchItems = useMemo<ReportSearchItem[]>(() => {
    const items: ReportSearchItem[] = [];
    reportCatalog.forEach((category) => {
      if (category.id === "overview") {
        items.push({
          tab: "overview",
          subTab: null,
          label: category.label,
          category: "Overview",
          description: category.description,
        });
        return;
      }

      const reports = hasSubTabs(category.id) ? subTabs[category.id] : category.subReports;
      reports.forEach((sub) => {
        items.push({
          tab: category.id,
          subTab: sub.id,
          label: sub.label,
          category: category.label,
          description: sub.description,
        });
      });
    });
    return items;
  }, []);

  const matches = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return searchItems
      .filter((item) => {
        return (
          item.label.toLowerCase().includes(term) ||
          item.category.toLowerCase().includes(term) ||
          item.description?.toLowerCase().includes(term)
        );
      })
      .slice(0, 8);
  }, [search, searchItems]);

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {showSearch && (
          <div className="relative w-full md:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find a report"
              aria-label="Find a report"
              className="pl-8"
            />
            {matches.length > 0 && (
              <div className="absolute left-0 right-0 mt-2 rounded-md border border-border bg-card shadow-lg z-20">
                {matches.map((item) => {
                  const href = buildReportHref({
                    tab: item.tab,
                    subTab: item.subTab,
                    dateRange,
                    filters,
                  });
                  return (
                    <Link
                      key={`${item.tab}-${item.subTab ?? "overview"}`}
                      href={href}
                      onClick={() => setSearch("")}
                      className="block px-3 py-2 text-sm hover:bg-muted transition-colors"
                    >
                      <div className="font-medium text-foreground">{item.label}</div>
                      <div className="text-xs text-muted-foreground">{item.category}</div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {reportCatalog.map((category) => {
            const isActive = activeTab === category.id;
            if (category.id === "overview") {
              const href = buildReportHref({ tab: "overview", dateRange, filters });
              return (
                <Link key={category.id} href={href}>
                  <Button
                    size="sm"
                    variant={isActive ? "outline" : "ghost"}
                    className={cn(isActive && "border-primary/30 text-primary")}
                  >
                    Overview
                  </Button>
                </Link>
              );
            }

            const reports = hasSubTabs(category.id) ? subTabs[category.id] : category.subReports;

            return (
              <DropdownMenu key={category.id}>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant={isActive ? "outline" : "ghost"}
                    className={cn("gap-1", isActive && "border-primary/30 text-primary")}
                  >
                    {category.label}
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[240px]">
                  {reports.map((sub) => {
                    const isSubActive = isActive && resolvedActiveSubTab === sub.id;
                    return (
                      <DropdownMenuItem
                        key={sub.id}
                        className={cn(
                          "flex flex-col items-start gap-0.5",
                          isSubActive && "bg-muted",
                        )}
                        onClick={() =>
                          router.push(
                            buildReportHref({
                              tab: category.id,
                              subTab: sub.id,
                              dateRange,
                              filters,
                            }),
                          )
                        }
                      >
                        <span className="text-sm font-medium text-foreground">{sub.label}</span>
                        {sub.description && (
                          <span className="text-xs text-muted-foreground">{sub.description}</span>
                        )}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })}
        </div>

        {extraLinks.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 md:ml-auto">
            {extraLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <Button
                  size="sm"
                  variant={link.active ? "outline" : "ghost"}
                  className={cn(link.active && "border-primary/30 text-primary")}
                >
                  {link.label}
                </Button>
              </Link>
            ))}
          </div>
        )}
      </div>

      {activeSubTabs.length > 0 && activeTab && activeTab !== "overview" && (
        <div className="flex flex-nowrap items-center gap-2 border-t border-border pt-3 overflow-x-auto pb-1">
          {activeSubTabs.map((sub) => {
            const isActive = resolvedActiveSubTab === sub.id;
            return (
              <Link
                key={`${activeTab}-${sub.id}`}
                href={buildReportHref({
                  tab: activeTab,
                  subTab: sub.id,
                  dateRange,
                  filters,
                })}
                aria-current={isActive ? "page" : undefined}
              >
                <Button
                  size="sm"
                  variant={isActive ? "outline" : "ghost"}
                  className={cn(
                    "shrink-0 whitespace-nowrap",
                    isActive && "border-primary/30 text-primary",
                  )}
                >
                  {sub.label}
                </Button>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
