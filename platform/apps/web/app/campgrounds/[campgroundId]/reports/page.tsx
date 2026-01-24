"use client";

import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { ReportChart } from "@/components/reports/ReportChart";
import { Input } from "@/components/ui/input";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Breadcrumbs } from "@/components/breadcrumbs";

type CatalogEntry = {
  id: string;
  name: string;
  category: string;
  dimensions: Array<{ id: string; label: string }>;
  metrics: Array<{ id: string; label: string }>;
  chartTypes: string[];
};

type ReportRun = {
  meta: { id: string; name: string; category: string; defaultChart?: string };
  rows: Array<Record<string, unknown>>;
  series: Array<{ label: string; chart: string; points: Array<{ x: string; y: number }> }>;
};

type ChartType = "line" | "bar" | "pie";

const categories = ["All", "Bookings", "Inventory", "Payments", "Operations", "Marketing"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isLabeledEntry = (value: unknown): value is { id: string; label: string } =>
  isRecord(value) && typeof value.id === "string" && typeof value.label === "string";

const isCatalogEntry = (value: unknown): value is CatalogEntry =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.name === "string" &&
  typeof value.category === "string" &&
  Array.isArray(value.dimensions) &&
  value.dimensions.every(isLabeledEntry) &&
  Array.isArray(value.metrics) &&
  value.metrics.every(isLabeledEntry) &&
  Array.isArray(value.chartTypes) &&
  value.chartTypes.every((item) => typeof item === "string");

const isReportPoint = (value: unknown): value is { x: string; y: number } =>
  isRecord(value) && typeof value.x === "string" && typeof value.y === "number";

const isReportSeries = (value: unknown): value is ReportRun["series"][number] =>
  isRecord(value) &&
  typeof value.label === "string" &&
  typeof value.chart === "string" &&
  Array.isArray(value.points) &&
  value.points.every(isReportPoint);

const isReportRun = (value: unknown): value is ReportRun =>
  isRecord(value) &&
  isRecord(value.meta) &&
  typeof value.meta.id === "string" &&
  typeof value.meta.name === "string" &&
  typeof value.meta.category === "string" &&
  Array.isArray(value.rows) &&
  value.rows.every(isRecord) &&
  Array.isArray(value.series) &&
  value.series.every(isReportSeries);

const isChartType = (value: unknown): value is ChartType =>
  value === "line" || value === "bar" || value === "pie";

export default function ReportsPage({ params }: { params: { campgroundId: string } }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [selected, setSelected] = useState<CatalogEntry | null>(null);
  const [run, setRun] = useState<ReportRun | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCatalog = async () => {
    setLoadingCatalog(true);
    setError(null);
    try {
      const res = await apiClient.listReportCatalog(params.campgroundId, {
        category: category === "All" ? undefined : category,
        search,
      });

      if (Array.isArray(res.catalog)) {
        const entries = res.catalog.filter(isCatalogEntry);
        setCatalog(entries);
        if (!selected && entries.length > 0) {
          setSelected(entries[0]);
        }
      }
    } catch (err) {
      console.error(err);
      setError("Unable to load reports catalog");
    } finally {
      setLoadingCatalog(false);
    }
  };

  const runSelected = async (entry: CatalogEntry | null = selected) => {
    if (!entry) return;
    setRunning(true);
    setError(null);
    try {
      const data = await apiClient.runReport(params.campgroundId, {
        reportId: entry.id,
        sample: true,
      });

      if (isReportRun(data)) {
        setRun(data);
      } else {
        setRun(null);
      }
      setSelected(entry);
    } catch (err) {
      console.error(err);
      setError("Unable to run report");
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    void loadCatalog();
  }, [category, search]);

  useEffect(() => {
    if (selected) void runSelected(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const filtered = useMemo(() => {
    if (!search) return catalog;
    const term = search.toLowerCase();
    return catalog.filter(
      (c) => c.name.toLowerCase().includes(term) || c.id.toLowerCase().includes(term),
    );
  }, [catalog, search]);

  return (
    <DashboardShell>
      <div className="p-6 space-y-4">
        <Breadcrumbs
          items={[{ label: "Campgrounds", href: "/campgrounds?all=true" }, { label: "Reports" }]}
        />
        <div>
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="text-muted-foreground text-sm">
            Browse the metadata catalog and run chart-ready reports.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              className={`rounded border px-3 py-1 text-sm ${category === cat ? "border-primary/30 text-primary bg-primary/10" : "border-border text-foreground"}`}
              onClick={() => setCategory(cat)}
              aria-pressed={category === cat}
            >
              {cat}
            </button>
          ))}
          <Input
            className="ml-auto w-64"
            placeholder="Search reports"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search reports"
          />
        </div>

        {error && (
          <div className="rounded border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-sm text-status-warning">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {loadingCatalog
            ? Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={`s-${idx}`}
                  className="h-24 animate-pulse rounded border border-border bg-muted"
                />
              ))
            : filtered.map((entry) => (
                <button
                  key={entry.id}
                  className={`rounded border p-3 text-left hover:border-primary/30 ${selected?.id === entry.id ? "border-primary/30 bg-primary/10" : "border-border"}`}
                  onClick={() => setSelected(entry)}
                >
                  <div className="text-sm font-semibold">{entry.name}</div>
                  <div className="text-xs text-muted-foreground">{entry.category}</div>
                  <div className="mt-2 flex gap-2 text-xs text-muted-foreground">
                    <span>{entry.dimensions.length} dims</span>
                    <span>{entry.metrics.length} metrics</span>
                  </div>
                </button>
              ))}
        </div>

        {selected && (
          <div className="rounded border border-border p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div>
                <div className="text-lg font-semibold">{selected.name}</div>
                <div className="text-sm text-muted-foreground">{selected.id}</div>
              </div>
              <button
                className="ml-auto rounded bg-primary px-3 py-2 text-white text-sm disabled:opacity-50"
                onClick={() => runSelected(selected)}
                disabled={running}
              >
                {running ? "Running..." : "Run report"}
              </button>
            </div>

            {run?.series?.length ? (
              <ReportChart
                series={run.series}
                chart={isChartType(run.series[0]?.chart) ? run.series[0].chart : "line"}
              />
            ) : (
              <div className="rounded border border-dashed border-border p-6 text-sm text-muted-foreground">
                {running ? "Generating chart..." : "Run the report to see a chart."}
              </div>
            )}

            <div className="overflow-x-auto rounded border border-border">
              <table className="min-w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    {run?.rows?.[0] &&
                      Object.keys(run.rows[0]).map((key) => (
                        <th
                          key={key}
                          className="px-3 py-2 text-left font-medium text-muted-foreground"
                        >
                          {key}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {run?.rows?.map((row, idx) => (
                    <tr key={idx} className="border-t border-border">
                      {Object.keys(row).map((key) => {
                        const value = row[key];
                        const displayValue =
                          value !== null && value !== undefined ? String(value) : "";
                        return (
                          <td key={key} className="px-3 py-2 text-foreground">
                            {displayValue}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {!run?.rows?.length && (
                    <tr>
                      <td className="px-3 py-2 text-muted-foreground">No data yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
