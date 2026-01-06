import { getDefaultSubTab, isReportTab, type ReportTab } from "@/lib/report-registry";

export type ReportFilters = {
  status?: string;
  siteType?: string;
  groupBy?: string;
};

const TAB_ALIASES: Record<string, { tab: ReportTab; subTab?: string | null }> = {
  "booking-sources": { tab: "marketing", subTab: "booking-sources" },
  "guest-origins": { tab: "guests", subTab: "guest-origins" }
};

type BuildReportHrefInput = {
  tab: string;
  subTab?: string | null;
  dateRange?: { start?: string; end?: string } | null;
  filters?: ReportFilters | null;
};

export function buildReportQuery({
  dateRange,
  filters
}: {
  dateRange?: { start?: string; end?: string } | null;
  filters?: ReportFilters | null;
}) {
  const params = new URLSearchParams();

  if (dateRange?.start) params.set("start", dateRange.start);
  if (dateRange?.end) params.set("end", dateRange.end);

  if (filters?.status && filters.status !== "all") params.set("status", filters.status);
  if (filters?.siteType && filters.siteType !== "all") params.set("siteType", filters.siteType);
  if (filters?.groupBy && filters.groupBy !== "none") params.set("groupBy", filters.groupBy);

  const query = params.toString();
  return query ? `?${query}` : "";
}

export function buildReportHref({ tab, subTab, dateRange, filters }: BuildReportHrefInput) {
  const normalized = normalizeReportSelection(tab, subTab);
  if (!normalized) {
    return "/reports";
  }

  const { tab: resolvedTab, subTab: resolvedSub } = normalized;
  const basePath = resolvedTab === "overview"
    ? "/reports/overview"
    : `/reports/${resolvedTab}/${resolvedSub}`;

  return `${basePath}${buildReportQuery({ dateRange, filters })}`;
}

export function normalizeReportSelection(tab: string, subTab?: string | null) {
  const alias = TAB_ALIASES[tab];
  if (alias) {
    return {
      tab: alias.tab,
      subTab: alias.subTab ?? subTab ?? getDefaultSubTab(alias.tab)
    };
  }

  if (!isReportTab(tab)) return null;

  if (tab === "overview") {
    return { tab: "overview", subTab: null };
  }

  const defaultSub = getDefaultSubTab(tab);
  const resolvedSub = subTab || defaultSub;

  return {
    tab,
    subTab: resolvedSub
  };
}
