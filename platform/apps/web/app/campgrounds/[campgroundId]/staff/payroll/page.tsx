"use client";

import { useEffect, useState, useMemo } from "react";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { StaffNavigation } from "@/components/staff/StaffNavigation";
import { useWhoami } from "@/hooks/use-whoami";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  FileSpreadsheet,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  User,
  DollarSign,
  RefreshCw,
  ChevronRight,
  Sparkles,
  History,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Provider = "generic" | "onpay" | "gusto" | "adp";

type PreviewRow = {
  userId: string;
  hours: number;
  earningCode?: string | null;
  rate?: number | null;
  roleCode?: string | null;
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  } | null;
};

type PayrollExport = {
  id: string;
  periodStart: string;
  periodEnd: string;
  provider: Provider;
  status: string;
  rowCount?: number;
  totalHours?: number;
  createdAt: string;
  requestedBy?: {
    firstName?: string;
    lastName?: string;
    email: string;
  };
};

type PayrollConfig = {
  campgroundId: string;
  provider: Provider;
  companyId?: string | null;
};

const SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 200,
  damping: 20,
};

const PROVIDERS: { id: Provider; name: string; description: string; icon: React.ReactNode }[] = [
  {
    id: "generic",
    name: "Generic CSV",
    description: "Standard format for any payroll system",
    icon: <FileSpreadsheet className="w-5 h-5" />,
  },
  {
    id: "onpay",
    name: "OnPay",
    description: "OnPay payroll import format",
    icon: <DollarSign className="w-5 h-5" />,
  },
  {
    id: "gusto",
    name: "Gusto",
    description: "Gusto payroll import format",
    icon: <DollarSign className="w-5 h-5" />,
  },
  {
    id: "adp",
    name: "ADP Run",
    description: "ADP Run payroll import format",
    icon: <DollarSign className="w-5 h-5" />,
  },
];

const DATE_PRESETS = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 2 weeks", days: 14 },
  { label: "Last 30 days", days: 30 },
];

export default function PayrollExportPage({ params }: { params: { campgroundId: string } }) {
  const { data: whoami } = useWhoami();
  const [provider, setProvider] = useState<Provider>("generic");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [preview, setPreview] = useState<{ rows: PreviewRow[]; totalHours: number; csv?: string } | null>(null);
  const [exports, setExports] = useState<PayrollExport[]>([]);
  const [config, setConfig] = useState<PayrollConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [loadingExports, setLoadingExports] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"export" | "history">("export");

  const currentUserId = whoami?.user?.id;

  // Set default date range
  useEffect(() => {
    const end = new Date();
    const start = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    setPeriodEnd(end.toISOString().split("T")[0]);
    setPeriodStart(start.toISOString().split("T")[0]);
  }, []);

  // Load config and exports
  useEffect(() => {
    const loadData = async () => {
      try {
        const [configRes, exportsRes] = await Promise.all([
          fetch(`/api/staff/payroll/config?campgroundId=${params.campgroundId}`),
          fetch(`/api/staff/payroll/exports?campgroundId=${params.campgroundId}&limit=10`),
        ]);

        if (configRes.ok) {
          const configData = await configRes.json();
          setConfig(configData);
          if (configData.provider) {
            setProvider(configData.provider);
          }
        }

        if (exportsRes.ok) {
          setExports(await exportsRes.json());
        }
      } catch (err) {
        console.error("Failed to load payroll data", err);
      } finally {
        setLoadingExports(false);
      }
    };
    loadData();
  }, [params.campgroundId]);

  const applyPreset = (days: number) => {
    const end = new Date();
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    setPeriodEnd(end.toISOString().split("T")[0]);
    setPeriodStart(start.toISOString().split("T")[0]);
  };

  const loadPreview = async () => {
    if (!periodStart || !periodEnd) {
      setError("Please select a date range");
      return;
    }
    setLoading(true);
    setError(null);
    setPreview(null);

    try {
      const res = await fetch(
        `/api/staff/payroll/preview?campgroundId=${params.campgroundId}&periodStart=${periodStart}&periodEnd=${periodEnd}&provider=${provider}`
      );
      if (!res.ok) throw new Error("Failed to load preview");
      const data = await res.json();
      setPreview(data);
    } catch (err) {
      setError("Could not load payroll preview. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const generateExport = async () => {
    if (!periodStart || !periodEnd) {
      setError("Please select a date range");
      return;
    }
    if (!currentUserId) {
      setError("You must be logged in to generate payroll exports");
      return;
    }
    setExporting(true);
    setError(null);

    try {
      const res = await fetch("/api/staff/payroll/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campgroundId: params.campgroundId,
          periodStart,
          periodEnd,
          requestedById: currentUserId,
          provider,
          format: "csv",
        }),
      });

      if (!res.ok) throw new Error("Failed to generate export");
      const data = await res.json();

      // Trigger download
      if (data.csv) {
        const blob = new Blob([data.csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `payroll-${provider}-${periodStart}-to-${periodEnd}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      setSuccessMessage("Export generated successfully!");
      setTimeout(() => setSuccessMessage(null), 4000);

      // Refresh exports list
      const exportsRes = await fetch(
        `/api/staff/payroll/exports?campgroundId=${params.campgroundId}&limit=10`
      );
      if (exportsRes.ok) {
        setExports(await exportsRes.json());
      }
    } catch (err) {
      setError("Could not generate export. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const downloadExport = async (exportId: string) => {
    try {
      const res = await fetch(`/api/staff/payroll/exports/${exportId}`);
      if (!res.ok) throw new Error("Failed to load export");
      const data = await res.json();

      if (data.csv) {
        const blob = new Blob([data.csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `payroll-${data.provider}-${data.periodStart?.split("T")[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      setError("Could not download export.");
    }
  };

  const totalHours = useMemo(() => {
    if (!preview?.rows) return 0;
    return preview.rows.reduce((sum, row) => sum + row.hours, 0);
  }, [preview]);

  return (
    <DashboardShell>
      <motion.div
        className="space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={SPRING_CONFIG}
      >
        <StaffNavigation campgroundId={params.campgroundId} />

        {/* Success Toast */}
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 bg-emerald-600 text-white rounded-lg shadow-lg"
              role="status"
              aria-live="polite"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">{successMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tab Switcher */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_CONFIG, delay: 0.1 }}
          className="flex gap-2"
        >
          <button
            onClick={() => setActiveTab("export")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all",
              activeTab === "export"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            )}
          >
            <Download className="w-4 h-4" />
            New Export
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all",
              activeTab === "history"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            )}
          >
            <History className="w-4 h-4" />
            Export History
          </button>
        </motion.div>

        {/* Error State */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto text-red-800 underline text-xs font-medium">
              Dismiss
            </button>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {activeTab === "export" ? (
            <motion.div
              key="export"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              {/* Provider Selection */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...SPRING_CONFIG, delay: 0.15 }}
                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
              >
                <div className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center">
                      <Settings className="w-5 h-5 text-slate-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">Payroll Provider</h2>
                      <p className="text-sm text-slate-600">Select your payroll system for the correct export format</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {PROVIDERS.map((p) => (
                    <motion.button
                      key={p.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setProvider(p.id)}
                      className={cn(
                        "text-left p-4 rounded-lg border-2 transition-all",
                        provider === p.id
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      )}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div
                          className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center",
                            provider === p.id ? "bg-status-success/15 text-status-success" : "bg-muted text-muted-foreground"
                          )}
                        >
                          {p.icon}
                        </div>
                        {provider === p.id && <CheckCircle2 className="w-4 h-4 text-emerald-600 ml-auto" />}
                      </div>
                      <div className="font-semibold text-slate-900">{p.name}</div>
                      <div className="text-xs text-slate-500 mt-1">{p.description}</div>
                    </motion.button>
                  ))}
                </div>
              </motion.div>

              {/* Date Range */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...SPRING_CONFIG, delay: 0.2 }}
                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
              >
                <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border-b border-teal-100 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-teal-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">Pay Period</h2>
                      <p className="text-sm text-slate-600">Select the date range for the export</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {DATE_PRESETS.map((preset) => (
                      <button
                        key={preset.days}
                        onClick={() => applyPreset(preset.days)}
                        className="px-3 py-1.5 text-sm font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Start Date</label>
                      <input
                        type="date"
                        value={periodStart}
                        onChange={(e) => setPeriodStart(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">End Date</label>
                      <input
                        type="date"
                        value={periodEnd}
                        onChange={(e) => setPeriodEnd(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={loadPreview}
                    disabled={loading || !periodStart || !periodEnd}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-slate-800 text-white font-medium disabled:opacity-50 hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    Preview Hours
                  </motion.button>
                </div>
              </motion.div>

              {/* Preview Table */}
              {preview && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={SPRING_CONFIG}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
                >
                  <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100 px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                          <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <h2 className="text-lg font-semibold text-slate-900">Preview</h2>
                          <p className="text-sm text-slate-600">
                            {preview.rows.length} employee{preview.rows.length !== 1 ? "s" : ""} &middot;{" "}
                            {totalHours.toFixed(1)} total hours
                          </p>
                        </div>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={generateExport}
                        disabled={exporting || preview.rows.length === 0}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 text-white font-medium disabled:opacity-50 hover:bg-emerald-700 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                      >
                        {exporting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                        Download CSV
                      </motion.button>
                    </div>
                  </div>

                  {preview.rows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                        <Clock className="w-8 h-8 text-slate-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900">No time entries</h3>
                      <p className="text-sm text-slate-600 mt-1 max-w-md">
                        No approved or submitted time entries found for this period.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                              Employee
                            </th>
                            <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                              Role
                            </th>
                            <th className="text-right px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                              Hours
                            </th>
                            <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                              Earning Code
                            </th>
                            <th className="text-right px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                              Rate
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {preview.rows.map((row, idx) => (
                            <motion.tr
                              key={`${row.userId}-${row.earningCode}-${idx}`}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.03 }}
                              className="hover:bg-slate-50 transition-colors"
                            >
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                                    <User className="w-4 h-4 text-slate-500" />
                                  </div>
                                  <div>
                                    <div className="font-medium text-slate-900">
                                      {row.user?.firstName || row.user?.lastName
                                        ? `${row.user?.firstName || ""} ${row.user?.lastName || ""}`.trim()
                                        : row.user?.email || row.userId.slice(0, 8)}
                                    </div>
                                    {row.user?.email && (
                                      <div className="text-xs text-slate-500">{row.user.email}</div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-sm text-slate-700">{row.roleCode || "—"}</span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <span className="font-semibold text-slate-900">{row.hours.toFixed(2)}</span>
                              </td>
                              <td className="px-6 py-4">
                                <span
                                  className={cn(
                                    "inline-flex px-2 py-1 rounded-md text-xs font-medium",
                                    row.earningCode === "OT" || row.earningCode === "overtime"
                                      ? "bg-status-warning/15 text-status-warning"
                                      : "bg-slate-100 text-slate-700"
                                  )}
                                >
                                  {row.earningCode || "REG"}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <span className="text-sm text-slate-600">
                                  {row.rate != null ? `$${row.rate.toFixed(2)}` : "—"}
                                </span>
                              </td>
                            </motion.tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-50 border-t border-slate-200">
                            <td colSpan={2} className="px-6 py-3 text-sm font-semibold text-slate-700">
                              Total
                            </td>
                            <td className="px-6 py-3 text-right font-bold text-slate-900">
                              {totalHours.toFixed(2)} hrs
                            </td>
                            <td colSpan={2}></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Quick Tips */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...SPRING_CONFIG, delay: 0.25 }}
                className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 p-5"
              >
                <div className="flex items-center gap-2 text-emerald-700 text-sm font-medium mb-2">
                  <Sparkles className="w-4 h-4" />
                  Payroll Export Tips
                </div>
                <ul className="text-xs text-emerald-800 space-y-1">
                  <li>&bull; Only approved and submitted timesheets are included in exports</li>
                  <li>&bull; Make sure all hours are approved before running payroll</li>
                  <li>&bull; Each provider uses different column formats - select the right one for your payroll system</li>
                </ul>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
            >
              <div className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center">
                    <History className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Export History</h2>
                    <p className="text-sm text-slate-600">Previous payroll exports</p>
                  </div>
                </div>
              </div>

              {loadingExports ? (
                <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Loading exports...</span>
                </div>
              ) : exports.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <FileSpreadsheet className="w-8 h-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">No exports yet</h3>
                  <p className="text-sm text-slate-600 mt-1 max-w-md">
                    When you generate payroll exports, they'll appear here for easy re-download.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {exports.map((exp, idx) => (
                    <motion.div
                      key={exp.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center",
                            exp.status === "generated" ? "bg-status-success/15" : "bg-status-warning/15"
                          )}
                        >
                          {exp.status === "generated" ? (
                            <CheckCircle2 className="w-5 h-5 text-status-success" />
                          ) : (
                            <Clock className="w-5 h-5 text-status-warning" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">
                            {new Date(exp.periodStart).toLocaleDateString()} -{" "}
                            {new Date(exp.periodEnd).toLocaleDateString()}
                          </div>
                          <div className="text-sm text-slate-500 flex items-center gap-2">
                            <span className="capitalize">{exp.provider}</span>
                            <span>&middot;</span>
                            <span>{exp.rowCount || 0} employees</span>
                            <span>&middot;</span>
                            <span>{exp.totalHours?.toFixed(1) || 0} hrs</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-xs text-slate-400 text-right">
                          {new Date(exp.createdAt).toLocaleDateString()}
                          <br />
                          {exp.requestedBy?.firstName || exp.requestedBy?.email?.split("@")[0] || "Staff"}
                        </div>
                        {exp.status === "generated" && (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => downloadExport(exp.id)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors text-sm font-medium"
                          >
                            <Download className="w-3.5 h-3.5" />
                            CSV
                          </motion.button>
                        )}
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </DashboardShell>
  );
}
