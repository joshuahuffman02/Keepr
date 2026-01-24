"use client";

import { useEffect, useState } from "react";
import { DashboardShell } from "../../components/ui/layout/DashboardShell";
import { Breadcrumbs } from "@/components/breadcrumbs";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";

const isNumber = (value: unknown): value is number => typeof value === "number";

const isNullableNumber = (value: unknown): value is number | null =>
  value === null || typeof value === "number";

const isPerfSnapshot = (value: unknown): value is PerfSnapshot =>
  isRecord(value) &&
  typeof value.timestamp === "string" &&
  isNumber(value.windowMs) &&
  isRecord(value.counts) &&
  isNumber(value.counts.total) &&
  isNumber(value.counts.errors) &&
  isRecord(value.latencyMs) &&
  isNullableNumber(value.latencyMs.p50) &&
  isNullableNumber(value.latencyMs.p95) &&
  isNullableNumber(value.latencyMs.p99) &&
  isNumber(value.errorRate) &&
  isRecord(value.limiter) &&
  isNumber(value.limiter.ip) &&
  isNumber(value.limiter.org);

const isRecentError = (value: unknown): value is { path: string; status: number; at: number } =>
  isRecord(value) && typeof value.path === "string" && isNumber(value.status) && isNumber(value.at);

const isQueueEntry = (value: unknown): value is { running: number; queued: number } =>
  isRecord(value) && isNumber(value.running) && isNumber(value.queued);

const isQueues = (value: unknown): value is Record<string, { running: number; queued: number }> =>
  isRecord(value) && Object.values(value).every(isQueueEntry);

const isObservabilitySnapshot = (value: unknown): value is ObservabilitySnapshot =>
  isRecord(value) &&
  isNumber(value.captured) &&
  isRecord(value.targets) &&
  isNumber(value.targets.apiP95Ms) &&
  isNumber(value.targets.apiErrorRate) &&
  isNumber(value.targets.jobP95Ms) &&
  isNumber(value.targets.jobFailureRate) &&
  isRecord(value.api) &&
  isNumber(value.api.count) &&
  isNumber(value.api.errors) &&
  isNumber(value.api.p50) &&
  isNumber(value.api.p95) &&
  isNumber(value.api.p99) &&
  isNumber(value.api.avg) &&
  Array.isArray(value.api.recentErrors) &&
  value.api.recentErrors.every(isRecentError) &&
  isRecord(value.jobs) &&
  isNumber(value.jobs.count) &&
  isNumber(value.jobs.errors) &&
  isNumber(value.jobs.p50) &&
  isNumber(value.jobs.p95) &&
  isNumber(value.jobs.p99) &&
  isNumber(value.jobs.avg) &&
  isQueues(value.jobs.queues);

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

type PerfSnapshot = {
  timestamp: string;
  windowMs: number;
  counts: { total: number; errors: number };
  latencyMs: { p50: number | null; p95: number | null; p99: number | null };
  errorRate: number;
  limiter: { ip: number; org: number };
};

type ObservabilitySnapshot = {
  captured: number;
  targets: {
    apiP95Ms: number;
    apiErrorRate: number;
    jobP95Ms: number;
    jobFailureRate: number;
  };
  api: {
    count: number;
    errors: number;
    p50: number;
    p95: number;
    p99: number;
    avg: number;
    recentErrors: { path: string; status: number; at: number }[];
  };
  jobs: {
    count: number;
    errors: number;
    p50: number;
    p95: number;
    p99: number;
    avg: number;
    queues: Record<string, { running: number; queued: number }>;
  };
};

const stack = [
  {
    area: "Frontend",
    items: [
      "Next.js 15 (App Router)",
      "TypeScript",
      "Tailwind CSS",
      "shadcn-style UI",
      "TanStack Query",
    ],
  },
  {
    area: "Backend",
    items: ["NestJS", "TypeScript", "Prisma ORM", "PostgreSQL", "Redis (placeholder)"],
  },
  { area: "Shared", items: ["pnpm workspaces", "Zod schemas/types in @keepr/shared"] },
  { area: "Dev tooling", items: ["ts-node-dev", "ES2020 target"] },
];

const apiBase = (process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api").replace(
  /\/$/,
  "",
);

export default function TechPage() {
  const [snapshot, setSnapshot] = useState<PerfSnapshot | null>(null);
  const [sloSnapshot, setSloSnapshot] = useState<ObservabilitySnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sloError, setSloError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sloLoading, setSloLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadSnapshot() {
      try {
        setLoading(true);
        const res = await fetch(`${apiBase}/ops/perf`);
        if (!res.ok) {
          throw new Error(`Failed to load perf snapshot (${res.status})`);
        }
        const json = await res.json();
        if (!isPerfSnapshot(json)) {
          throw new Error("Invalid perf snapshot");
        }
        if (!cancelled) {
          setSnapshot(json);
          setError(null);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(getErrorMessage(err, "Unable to load perf snapshot"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadSnapshot();

    async function loadSloSnapshot() {
      try {
        setSloLoading(true);
        const res = await fetch(`${apiBase}/observability/snapshot`, { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load SLO snapshot (${res.status})`);
        const json = await res.json();
        if (!isObservabilitySnapshot(json)) {
          throw new Error("Invalid SLO snapshot");
        }
        if (!cancelled) {
          setSloSnapshot(json);
          setSloError(null);
        }
      } catch (err: unknown) {
        if (!cancelled) setSloError(getErrorMessage(err, "Unable to load SLO snapshot"));
      } finally {
        if (!cancelled) setSloLoading(false);
      }
    }
    loadSloSnapshot();

    return () => {
      cancelled = true;
    };
  }, []);

  const renderMetric = (label: string, value: number | null | string, suffix?: string) => (
    <div className="flex flex-col">
      <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-900">
        {value === null ? "—" : value}
        {suffix ? ` ${suffix}` : ""}
      </span>
    </div>
  );

  return (
    <DashboardShell>
      <div className="space-y-4">
        <Breadcrumbs items={[{ label: "Tech Stack" }]} />
        <h2 className="text-xl font-semibold text-slate-900">Platform Tech Stack</h2>
        <div className="grid gap-3">
          <div className="card p-4 space-y-2">
            <div className="text-sm font-semibold text-slate-900">Performance snapshot</div>
            {loading ? (
              <div className="text-sm text-slate-600">Loading…</div>
            ) : error ? (
              <div className="text-sm text-rose-600">Perf snapshot unavailable: {error}</div>
            ) : snapshot ? (
              <div className="space-y-2">
                <div className="text-xs text-slate-500">
                  Updated {new Date(snapshot.timestamp).toLocaleTimeString()} • window{" "}
                  {(snapshot.windowMs / 1000).toFixed(0)}s
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {renderMetric("p50", snapshot.latencyMs.p50, "ms")}
                  {renderMetric("p95", snapshot.latencyMs.p95, "ms")}
                  {renderMetric("p99", snapshot.latencyMs.p99, "ms")}
                  {renderMetric("Error rate", `${(snapshot.errorRate * 100).toFixed(1)}%`)}
                  {renderMetric("Total reqs", snapshot.counts.total)}
                  {renderMetric("Errors", snapshot.counts.errors)}
                  {renderMetric("IP limiter hits", snapshot.limiter.ip)}
                  {renderMetric("Org limiter hits", snapshot.limiter.org)}
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-600">No perf data yet.</div>
            )}
          </div>

          <div className="card p-4 space-y-2">
            <div className="text-sm font-semibold text-slate-900">Reliability & SLOs</div>
            {sloLoading ? (
              <div className="text-sm text-slate-600">Loading…</div>
            ) : sloError ? (
              <div className="text-sm text-rose-600">SLO snapshot unavailable: {sloError}</div>
            ) : sloSnapshot ? (
              <div className="space-y-3">
                <div className="text-xs text-slate-500">
                  Samples {sloSnapshot.captured} • Targets: API p95 ≤ {sloSnapshot.targets.apiP95Ms}
                  ms, error rate ≤ {(sloSnapshot.targets.apiErrorRate * 100).toFixed(1)}%; job p95 ≤{" "}
                  {sloSnapshot.targets.jobP95Ms}ms
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {renderMetric("API p95", `${sloSnapshot.api.p95} ms`)}
                  {renderMetric(
                    "API error rate",
                    `${((sloSnapshot.api.errors / Math.max(1, sloSnapshot.api.count)) * 100).toFixed(1)}%`,
                  )}
                  {renderMetric("API p99", `${sloSnapshot.api.p99} ms`)}
                  {renderMetric("Job p95", `${sloSnapshot.jobs.p95} ms`)}
                  {renderMetric("Job failures", `${sloSnapshot.jobs.errors}`)}
                  {renderMetric("Queues tracked", Object.keys(sloSnapshot.jobs.queues).length)}
                </div>
                {sloSnapshot.api.recentErrors.length > 0 ? (
                  <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs text-amber-800 space-y-1">
                    <div className="font-semibold">Recent API errors</div>
                    {sloSnapshot.api.recentErrors.map((err) => (
                      <div key={`${err.path}-${err.at}`} className="flex justify-between">
                        <span>{err.path}</span>
                        <span className="text-amber-700">{err.status}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                    No API errors captured in the current window.
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-slate-600">No SLO data yet.</div>
            )}
          </div>

          {stack.map((row) => (
            <div key={row.area} className="card p-4">
              <div className="text-sm font-semibold text-slate-900">{row.area}</div>
              <div className="text-sm text-slate-700">{row.items.join(" • ")}</div>
            </div>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}
