"use client";

import { useEffect, useState, useMemo } from "react";
import { useWhoami } from "@/hooks/use-whoami";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { StaffNavigation } from "@/components/staff/StaffNavigation";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3,
  Download,
  Calendar,
  Clock,
  Loader2,
  Users,
  TrendingUp,
  Timer,
  Coffee,
  Sparkles,
  ChevronDown,
  FileSpreadsheet,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type TimesheetEntry = {
  id: string;
  userId: string;
  userName: string;
  date: string;
  clockIn: string;
  clockOut: string | null;
  role?: string | null;
  grossMinutes: number;
  breakMinutes: number;
  netMinutes: number;
  status: string;
};

type UserSummary = {
  userId: string;
  name: string;
  entries: number;
  grossMinutes: number;
  netMinutes: number;
  breakMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
};

type TimesheetReport = {
  periodStart: string;
  periodEnd: string;
  totalEntries: number;
  totalGrossMinutes: number;
  totalNetMinutes: number;
  totalBreakMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  byUser: Record<string, UserSummary>;
  entries: TimesheetEntry[];
};

const SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 200,
  damping: 20,
};

const DATE_PRESETS = [
  { label: "This Week", getValue: () => getWeekDates(0) },
  { label: "Last Week", getValue: () => getWeekDates(-1) },
  { label: "Last 2 Weeks", getValue: () => getWeekDates(-1, 2) },
  { label: "This Month", getValue: () => getMonthDates(0) },
  { label: "Last Month", getValue: () => getMonthDates(-1) },
];

function getWeekDates(offset: number, weeks = 1) {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - dayOfWeek + offset * 7);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7 * weeks - 1);
  return {
    start: startOfWeek.toISOString().split("T")[0],
    end: endOfWeek.toISOString().split("T")[0],
  };
}

function getMonthDates(offset: number) {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + offset + 1, 0);
  return {
    start: startOfMonth.toISOString().split("T")[0],
    end: endOfMonth.toISOString().split("T")[0],
  };
}

function formatMinutes(mins: number): string {
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  return `${hours}h ${minutes}m`;
}

function formatHours(mins: number): string {
  return (mins / 60).toFixed(2);
}

export default function TimesheetReportsPage({ params }: { params: { campgroundId: string } }) {
  const { data: whoami } = useWhoami();
  const [report, setReport] = useState<TimesheetReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [periodStart, setPeriodStart] = useState(() => getWeekDates(-1).start);
  const [periodEnd, setPeriodEnd] = useState(() => getWeekDates(-1).end);
  const [showPresets, setShowPresets] = useState(false);
  const [viewMode, setViewMode] = useState<"summary" | "detailed">("summary");
  const [exporting, setExporting] = useState(false);

  const loadReport = async () => {
    if (!periodStart || !periodEnd) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/staff/reports/timesheet?campgroundId=${params.campgroundId}&periodStart=${periodStart}&periodEnd=${periodEnd}`
      );
      if (!res.ok) throw new Error("Failed to load report");
      setReport(await res.json());
    } catch {
      setError("Could not load report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [params.campgroundId, periodStart, periodEnd]);

  const userSummaries = useMemo(() => {
    if (!report) return [];
    return Object.values(report.byUser).sort((a, b) => b.netMinutes - a.netMinutes);
  }, [report]);

  const applyPreset = (preset: (typeof DATE_PRESETS)[0]) => {
    const { start, end } = preset.getValue();
    setPeriodStart(start);
    setPeriodEnd(end);
    setShowPresets(false);
  };

  const exportToCsv = () => {
    if (!report) return;

    setExporting(true);

    const headers = [
      "Employee",
      "Date",
      "Clock In",
      "Clock Out",
      "Role",
      "Gross Hours",
      "Break Hours",
      "Net Hours",
      "Status",
    ];

    const rows = report.entries.map((e) => [
      e.userName,
      new Date(e.date).toLocaleDateString(),
      new Date(e.clockIn).toLocaleTimeString(),
      e.clockOut ? new Date(e.clockOut).toLocaleTimeString() : "",
      e.role || "",
      formatHours(e.grossMinutes),
      formatHours(e.breakMinutes),
      formatHours(e.netMinutes),
      e.status,
    ]);

    // Add summary section
    rows.push([]);
    rows.push(["SUMMARY"]);
    rows.push(["Employee", "Entries", "Gross Hours", "Break Hours", "Net Hours", "Regular", "Overtime"]);
    userSummaries.forEach((u) => {
      rows.push([
        u.name,
        u.entries.toString(),
        formatHours(u.grossMinutes),
        formatHours(u.breakMinutes),
        formatHours(u.netMinutes),
        formatHours(u.regularMinutes),
        formatHours(u.overtimeMinutes),
      ]);
    });

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `timesheet_report_${periodStart}_to_${periodEnd}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    setExporting(false);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <DashboardShell>
      <StaffNavigation campgroundId={params.campgroundId} />

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-status-info/15 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-status-info" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Timesheet Reports</h1>
                <p className="text-muted-foreground">Review hours worked and overtime</p>
              </div>
            </div>

            <button
              onClick={exportToCsv}
              disabled={!report || exporting}
              className={cn(
                "px-4 py-2 bg-foreground text-white rounded-lg font-medium flex items-center gap-2",
                "hover:bg-foreground/90 transition-colors",
                (!report || exporting) && "opacity-50 cursor-not-allowed"
              )}
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Export CSV
            </button>
          </div>
        </motion.div>

        {/* Date Range Selector */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-card rounded-xl border border-border shadow-sm"
        >
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative">
              <button
                onClick={() => setShowPresets(!showPresets)}
                className="px-4 py-2 bg-muted rounded-lg text-sm font-medium text-foreground hover:bg-muted flex items-center gap-2"
                aria-expanded={showPresets}
                aria-controls="timesheet-presets"
              >
                <Calendar className="w-4 h-4" />
                Quick Select
                <ChevronDown className="w-4 h-4" />
              </button>

              <AnimatePresence>
                {showPresets && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute z-10 mt-2 w-48 bg-card rounded-lg shadow-lg border border-border py-1"
                    id="timesheet-presets"
                  >
                    {DATE_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        onClick={() => applyPreset(preset)}
                        className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-muted"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="w-[150px]"
                aria-label="Start date"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-[150px]"
                aria-label="End date"
              />
            </div>

            <div className="flex gap-1 bg-muted rounded-lg p-1">
              <button
                onClick={() => setViewMode("summary")}
                className={cn(
                  "px-3 py-1.5 rounded text-sm font-medium transition-colors",
                  viewMode === "summary"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-pressed={viewMode === "summary"}
              >
                Summary
              </button>
              <button
                onClick={() => setViewMode("detailed")}
                className={cn(
                  "px-3 py-1.5 rounded text-sm font-medium transition-colors",
                  viewMode === "detailed"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-pressed={viewMode === "detailed"}
              >
                Detailed
              </button>
            </div>
          </div>
        </motion.div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2"
            role="alert"
          >
            <AlertCircle className="w-5 h-5" />
            {error}
          </motion.div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
          </div>
        ) : !report ? (
          <div className="text-center py-20 text-muted-foreground">
            Select a date range to view the report
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
            >
              <div className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Users className="w-4 h-4" />
                  <span className="text-sm">Team Members</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {Object.keys(report.byUser).length}
                </p>
              </div>

              <div className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">Total Hours</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {formatHours(report.totalNetMinutes)}
                </p>
              </div>

              <div className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 text-emerald-600 mb-1">
                  <Timer className="w-4 h-4" />
                  <span className="text-sm">Regular</span>
                </div>
                <p className="text-2xl font-bold text-emerald-600">
                  {formatHours(report.regularMinutes)}
                </p>
              </div>

              <div className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 text-amber-600 mb-1">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-sm">Overtime</span>
                </div>
                <p className="text-2xl font-bold text-amber-600">
                  {formatHours(report.overtimeMinutes)}
                </p>
              </div>
            </motion.div>

            {/* Content based on view mode */}
            {viewMode === "summary" ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-card rounded-xl border border-border overflow-hidden"
              >
                <div className="p-4 border-b border-border bg-muted/60">
                  <h3 className="font-semibold text-foreground">Hours by Employee</h3>
                </div>
                <div className="divide-y divide-border">
                  {userSummaries.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      No time entries for this period
                    </div>
                  ) : (
                    userSummaries.map((user, idx) => (
                      <motion.div
                        key={user.userId}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="p-4 hover:bg-muted/60"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-status-info/15 flex items-center justify-center text-status-info font-semibold">
                              {user.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{user.name}</p>
                              <p className="text-sm text-muted-foreground">{user.entries} entries</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-foreground">
                              {formatMinutes(user.netMinutes)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {user.breakMinutes > 0 && (
                                <span className="text-muted-foreground mr-2">
                                  <Coffee className="w-3 h-3 inline" /> {formatMinutes(user.breakMinutes)}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Hours bar */}
                        <div className="ml-13 flex gap-1 h-3">
                          <div
                            className="bg-emerald-400 rounded"
                            style={{
                              width: `${Math.min(100, (user.regularMinutes / (40 * 60)) * 100)}%`,
                            }}
                            title={`Regular: ${formatMinutes(user.regularMinutes)}`}
                          />
                          {user.overtimeMinutes > 0 && (
                            <div
                              className="bg-amber-400 rounded"
                              style={{
                                width: `${Math.min(50, (user.overtimeMinutes / (20 * 60)) * 100)}%`,
                              }}
                              title={`Overtime: ${formatMinutes(user.overtimeMinutes)}`}
                            />
                          )}
                        </div>
                        <div className="ml-13 flex justify-between text-xs text-muted-foreground mt-1">
                          <span>REG: {formatHours(user.regularMinutes)}h</span>
                          {user.overtimeMinutes > 0 && (
                            <span className="text-amber-600">
                              OT: {formatHours(user.overtimeMinutes)}h
                            </span>
                          )}
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-card rounded-xl border border-border overflow-hidden"
              >
                <div className="p-4 border-b border-border bg-muted/60 flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">All Time Entries</h3>
                  <span className="text-sm text-muted-foreground">
                    {report.totalEntries} entries
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/60 text-left text-sm text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-medium">Employee</th>
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium">In</th>
                        <th className="px-4 py-3 font-medium">Out</th>
                        <th className="px-4 py-3 font-medium">Role</th>
                        <th className="px-4 py-3 font-medium text-right">Gross</th>
                        <th className="px-4 py-3 font-medium text-right">Breaks</th>
                        <th className="px-4 py-3 font-medium text-right">Net</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {report.entries.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                            No time entries for this period
                          </td>
                        </tr>
                      ) : (
                        report.entries.map((entry, idx) => (
                          <motion.tr
                            key={entry.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: idx * 0.02 }}
                            className="hover:bg-muted/60"
                          >
                            <td className="px-4 py-3 font-medium text-foreground">
                              {entry.userName}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{formatDate(entry.date)}</td>
                            <td className="px-4 py-3 text-muted-foreground">{formatTime(entry.clockIn)}</td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {entry.clockOut ? formatTime(entry.clockOut) : "-"}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{entry.role || "-"}</td>
                            <td className="px-4 py-3 text-right text-muted-foreground">
                              {formatMinutes(entry.grossMinutes)}
                            </td>
                            <td className="px-4 py-3 text-right text-muted-foreground">
                              {entry.breakMinutes > 0 ? formatMinutes(entry.breakMinutes) : "-"}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-foreground">
                              {formatMinutes(entry.netMinutes)}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={cn(
                                  "px-2 py-1 rounded text-xs font-medium",
                                  entry.status === "approved"
                                    ? "bg-status-success/15 text-status-success"
                                    : entry.status === "submitted"
                                    ? "bg-status-info/15 text-status-info"
                                    : entry.status === "open"
                                    ? "bg-status-warning/15 text-status-warning"
                                    : "bg-muted text-muted-foreground"
                                )}
                              >
                                {entry.status}
                              </span>
                            </td>
                          </motion.tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  );
}
