import { getDefaultSubTabV2, isReportTabV2, type ReportTabV2 } from "@/lib/report-registry-v2";

export type ReportFiltersV2 = {
  status?: string;
  siteType?: string;
  groupBy?: string;
};

const TAB_ALIASES: Record<string, { tab: ReportTabV2; subTab?: string | null }> = {
  "booking-sources": { tab: "marketing", subTab: "booking-sources" },
  "guest-origins": { tab: "guests", subTab: "guest-origins" }
};

type BuildReportHrefInput = {
  tab: string;
  subTab?: string | null;
  dateRange?: { start?: string; end?: string } | null;
  filters?: ReportFiltersV2 | null;
};

export function buildReportQueryV2({
  dateRange,
  filters
}: {
  dateRange?: { start?: string; end?: string } | null;
  filters?: ReportFiltersV2 | null;
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

export function buildReportHrefV2({ tab, subTab, dateRange, filters }: BuildReportHrefInput) {
  const normalized = normalizeReportSelectionV2(tab, subTab);
  if (!normalized) {
    return "/reports-v2";
  }

  const { tab: resolvedTab, subTab: resolvedSub } = normalized;
  const basePath = resolvedTab === "overview"
    ? "/reports-v2/overview"
    : `/reports-v2/${resolvedTab}/${resolvedSub}`;

  return `${basePath}${buildReportQueryV2({ dateRange, filters })}`;
}

export function normalizeReportSelectionV2(tab: string, subTab?: string | null) {
  const alias = TAB_ALIASES[tab];
  if (alias) {
    return {
      tab: alias.tab,
      subTab: alias.subTab ?? subTab ?? getDefaultSubTabV2(alias.tab)
    };
  }

  if (!isReportTabV2(tab)) return null;

  if (tab === "overview") {
    return { tab: "overview", subTab: null };
  }

  const defaultSub = getDefaultSubTabV2(tab);
  const resolvedSub = subTab || defaultSub;

  return {
    tab,
    subTab: resolvedSub
  };
}
