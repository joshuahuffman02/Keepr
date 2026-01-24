export type ReportCategory =
  | "Bookings"
  | "Inventory"
  | "Inventory Expiration"
  | "Payments"
  | "Operations"
  | "Marketing"
  | "POS";

export type ReportChartType = "line" | "bar" | "pie" | "table";

export type TimeGrain = "day" | "week" | "month" | "quarter";

export type ReportTimeRange =
  | {
      preset:
        | "last_7_days"
        | "last_30_days"
        | "last_60_days"
        | "last_90_days"
        | "last_180_days"
        | "last_12_months"
        | "all_time";
    }
  | { from: string; to?: string };

export type ReportDimensionSpec = {
  id: string;
  label: string;
  field: string;
  kind: "string" | "number" | "date" | "enum";
  timeGrain?: TimeGrain;
  fallback?: string;
};

export type ReportMetricSpec = {
  id: string;
  label: string;
  field: string;
  aggregation: "count" | "sum" | "avg";
  type?: "currency" | "percent" | "number" | "duration";
  format?: "currency" | "percent";
};

export type ReportFilterSpec = {
  id: string;
  label: string;
  field: string;
  operators: Array<"eq" | "in" | "gte" | "lte" | "between">;
  type: "string" | "number" | "date" | "enum";
  options?: string[];
};

export type ReportSource =
  | "reservation"
  | "payment"
  | "ledger"
  | "payout"
  | "support"
  | "task"
  | "marketing"
  | "pos"
  | "till"
  | "inventory_batch"
  | "slow_moving"
  | "markdown";

export type ReportSpec = {
  id: string;
  name: string;
  category: ReportCategory;
  description?: string;
  source: ReportSource;
  dimensions: string[];
  defaultDimensions?: string[];
  metrics: string[];
  defaultTimeRange?: ReportTimeRange;
  timeField?: string;
  filters?: ReportFilterSpec[];
  chartTypes: ReportChartType[];
  defaultChart?: ReportChartType;
  sampling?: { limit: number; rate?: number };
  cacheTtlSec?: number;
  heavy?: boolean;
  tags?: string[];
};

export type ReportQueryInput = {
  reportId: string;
  dimensions?: string[];
  filters?: Record<string, unknown>;
  timeRange?: ReportTimeRange;
  limit?: number;
  offset?: number;
  sample?: boolean;
};

export type ReportSeries = {
  label: string;
  chart: ReportChartType;
  points: Array<{ x: string; y: number }>;
};

export type ReportRunResult = {
  meta: {
    id: string;
    name: string;
    category: ReportCategory;
    dimensions: string[];
    metrics: string[];
    defaultChart?: ReportChartType;
    cacheHint?: number;
    sampling?: { limit: number; rate?: number; applied?: boolean };
  };
  rows: Array<Record<string, unknown>>;
  series: ReportSeries[];
  paging: { returned: number; nextToken?: string | null };
};
