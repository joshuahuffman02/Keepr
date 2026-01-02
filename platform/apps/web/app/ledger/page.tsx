"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardShell } from "../../components/ui/layout/DashboardShell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Button } from "../../components/ui/button";
import { TableEmpty } from "../../components/ui/table";
import { apiClient } from "../../lib/api-client";
import { HelpAnchor } from "../../components/help/HelpAnchor";
import {
  Calendar,
  Download,
  Search,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  FileText,
  DollarSign,
  Clock,
} from "lucide-react";

// Date preset helpers
function getDatePresets() {
  const today = new Date();
  const formatDate = (d: Date) => d.toISOString().split("T")[0];

  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

  const startOfQuarter = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
  const startOfYear = new Date(today.getFullYear(), 0, 1);

  return [
    { label: "Today", start: formatDate(today), end: formatDate(today) },
    { label: "This Week", start: formatDate(startOfWeek), end: formatDate(today) },
    { label: "This Month", start: formatDate(startOfMonth), end: formatDate(today) },
    { label: "Last Month", start: formatDate(startOfLastMonth), end: formatDate(endOfLastMonth) },
    { label: "This Quarter", start: formatDate(startOfQuarter), end: formatDate(today) },
    { label: "Year to Date", start: formatDate(startOfYear), end: formatDate(today) },
  ];
}

type SortField = "occurredAt" | "glCode" | "amountCents" | "direction";
type SortDir = "asc" | "desc";

export default function LedgerPage() {
  const [campgroundId, setCampgroundId] = useState<string>("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [glCode, setGlCode] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("occurredAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const cg = localStorage.getItem("campreserv:selectedCampground");
    if (cg) setCampgroundId(cg);
  }, []);

  const ledgerQuery = useQuery({
    queryKey: ["ledger", campgroundId, start, end, glCode],
    queryFn: () => apiClient.getLedger(campgroundId, { start, end, glCode }),
    enabled: !!campgroundId
  });
  const summaryQuery = useQuery({
    queryKey: ["ledger-summary", campgroundId, start, end],
    queryFn: () => apiClient.getLedgerSummary(campgroundId, { start, end }),
    enabled: !!campgroundId
  });
  const agingQuery = useQuery({
    queryKey: ["aging", campgroundId],
    queryFn: () => apiClient.getAging(campgroundId),
    enabled: !!campgroundId
  });

  const datePresets = getDatePresets();

  const total = (ledgerQuery.data || []).reduce((sum, row) => {
    const sign = row.direction === "credit" ? 1 : -1;
    return sum + sign * row.amountCents;
  }, 0);

  const grouped = (ledgerQuery.data || []).reduce<Record<string, number>>((acc, row) => {
    const key = row.glCode || "Unassigned";
    const sign = row.direction === "credit" ? 1 : -1;
    acc[key] = (acc[key] || 0) + sign * row.amountCents;
    return acc;
  }, {});

  // Filter and sort entries
  const filteredEntries = (ledgerQuery.data || [])
    .filter((row) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        row.description?.toLowerCase().includes(query) ||
        row.glCode?.toLowerCase().includes(query) ||
        row.account?.toLowerCase().includes(query) ||
        row.reservationId?.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortField) {
        case "occurredAt":
          aVal = new Date(a.occurredAt).getTime();
          bVal = new Date(b.occurredAt).getTime();
          break;
        case "amountCents":
          aVal = a.amountCents;
          bVal = b.amountCents;
          break;
        case "glCode":
          aVal = a.glCode || "";
          bVal = b.glCode || "";
          break;
        case "direction":
          aVal = a.direction;
          bVal = b.direction;
          break;
        default:
          return 0;
      }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const applyPreset = (preset: { start: string; end: string }) => {
    setStart(preset.start);
    setEnd(preset.end);
  };

  return (
    <DashboardShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Breadcrumbs items={[{ label: "Ledger" }]} />
          <HelpAnchor topicId="ledger-close-day" label="Ledger help" />
        </div>
        {!campgroundId && (
          <div className="card p-5">
            <div className="text-lg font-semibold text-foreground">Select a campground</div>
            <p className="text-sm text-muted-foreground mt-1">Use the left sidebar switcher to choose a campground.</p>
          </div>
        )}
        {campgroundId && (
          <>
            {/* Date Range & Filters */}
            <div className="card p-4 space-y-4">
              {/* Quick Date Presets */}
              <div className="flex flex-wrap gap-2">
                {datePresets.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => applyPreset(preset)}
                    className={`px-3 py-1.5 text-sm rounded-full transition-all duration-150 ${
                      start === preset.start && end === preset.end
                        ? "bg-status-success/15 text-status-success border-2 border-status-success font-medium"
                        : "bg-muted text-muted-foreground border border-border hover:bg-muted"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Custom Date Range & Filters */}
              <div className="flex flex-wrap gap-3 items-end">
                <div className="space-y-1">
                  <label htmlFor="ledger-start" className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Start Date
                  </label>
                  <input
                    id="ledger-start"
                    type="date"
                    className="rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="ledger-end" className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    End Date
                  </label>
                  <input
                    id="ledger-end"
                    type="date"
                    className="rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="ledger-gl" className="text-xs font-medium text-muted-foreground">
                    GL Code
                  </label>
                  <input
                    id="ledger-gl"
                    className="rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    placeholder="Filter by GL code"
                    value={glCode}
                    onChange={(e) => setGlCode(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="ledger-search" className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Search className="h-3 w-3" />
                    Search
                  </label>
                  <input
                    id="ledger-search"
                    className="rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    placeholder="Description, account..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex items-center gap-2"
                  onClick={() => {
                    const qs = new URLSearchParams();
                    if (start) qs.set("start", start);
                    if (end) qs.set("end", end);
                    if (glCode) qs.set("glCode", glCode);
                    const url = `/campgrounds/${campgroundId}/ledger/export${qs.toString() ? `?${qs.toString()}` : ""}`;
                    window.open((process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api") + url, "_blank");
                  }}
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            </div>

            {/* Live region for screen readers */}
            <div role="status" aria-live="polite" className="sr-only">
              {ledgerQuery.isLoading
                ? "Loading ledger entries..."
                : `${filteredEntries.length} ledger entries found. Net balance: ${total >= 0 ? "credit" : "debit"} $${(Math.abs(total) / 100).toFixed(2)}`}
            </div>

            {/* Summary Cards */}
            <div className="card p-5 space-y-4">
              {/* Key Metrics Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-card border border-border">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                    <FileText className="h-3.5 w-3.5" />
                    Total Entries
                  </div>
                  <div className="text-2xl font-bold text-foreground">
                    {ledgerQuery.isLoading ? "—" : filteredEntries.length}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-status-success/10 border border-status-success/20">
                  <div className="flex items-center gap-2 text-status-success text-xs font-medium mb-1">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Total Credits
                  </div>
                  <div className="text-2xl font-bold text-status-success">
                    ${ledgerQuery.isLoading ? "—" : ((ledgerQuery.data || []).filter(e => e.direction === 'credit').reduce((sum, e) => sum + e.amountCents, 0) / 100).toFixed(2)}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-status-error/10 border border-status-error/20">
                  <div className="flex items-center gap-2 text-status-error text-xs font-medium mb-1">
                    <TrendingDown className="h-3.5 w-3.5" />
                    Total Debits
                  </div>
                  <div className="text-2xl font-bold text-status-error">
                    ${ledgerQuery.isLoading ? "—" : ((ledgerQuery.data || []).filter(e => e.direction === 'debit').reduce((sum, e) => sum + e.amountCents, 0) / 100).toFixed(2)}
                  </div>
                </div>
                <div className={`p-4 rounded-xl border ${total >= 0 ? "bg-status-success/10 border-status-success/20" : "bg-status-error/10 border-status-error/20"}`}>
                  <div className={`flex items-center gap-2 text-xs font-medium mb-1 ${total >= 0 ? "text-status-success" : "text-status-error"}`}>
                    <DollarSign className="h-3.5 w-3.5" />
                    Net Balance
                  </div>
                  <div className={`text-2xl font-bold ${total >= 0 ? "text-status-success" : "text-status-error"}`}>
                    {total >= 0 ? "+" : "-"}${ledgerQuery.isLoading ? "—" : (Math.abs(total) / 100).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* GL Code Summary */}
              {summaryQuery.data && summaryQuery.data.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-2">By GL Code</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {summaryQuery.data?.map((row) => (
                      <div key={row.glCode} className="rounded-lg border border-border bg-muted px-3 py-2 hover:bg-muted transition-colors cursor-pointer" onClick={() => setGlCode(row.glCode)}>
                        <div className="text-xs text-muted-foreground">GL {row.glCode}</div>
                        <div className={`text-sm font-semibold ${row.netCents >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                          {row.netCents >= 0 ? "+" : "-"}${(Math.abs(row.netCents) / 100).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Aging Receivables */}
              {agingQuery.data && (
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-600" />
                    Aging Receivables
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { label: "Current (0-30)", key: "current", severity: "low" },
                      { label: "31-60 days", key: "31_60", severity: "medium" },
                      { label: "61-90 days", key: "61_90", severity: "high" },
                      { label: "90+ days", key: "90_plus", severity: "critical" }
                    ].map((b) => {
                      const amount = agingQuery.data?.[b.key as keyof typeof agingQuery.data] || 0;
                      const hasBalance = amount > 0;
                      return (
                        <div
                          key={b.key}
                          className={`rounded-lg border px-3 py-2 transition-colors ${
                            !hasBalance
                              ? "border-border bg-muted"
                              : b.severity === "critical"
                              ? "border-red-200 bg-red-50"
                              : b.severity === "high"
                              ? "border-orange-200 bg-orange-50"
                              : b.severity === "medium"
                              ? "border-amber-200 bg-amber-50"
                              : "border-emerald-200 bg-emerald-50"
                          }`}
                        >
                          <div className={`text-xs ${hasBalance ? (b.severity === "critical" ? "text-red-700" : b.severity === "high" ? "text-orange-700" : b.severity === "medium" ? "text-amber-700" : "text-emerald-700") : "text-muted-foreground"}`}>
                            {b.label}
                          </div>
                          <div className={`text-sm font-semibold ${hasBalance ? (b.severity === "critical" ? "text-red-900" : b.severity === "high" ? "text-orange-900" : b.severity === "medium" ? "text-amber-900" : "text-emerald-900") : "text-muted-foreground"}`}>
                            ${(amount / 100).toFixed(2)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Balance Verification */}
              {(() => {
                const entries = ledgerQuery.data || [];
                const totalCredits = entries.filter(e => e.direction === 'credit').reduce((sum, e) => sum + e.amountCents, 0);
                const totalDebits = entries.filter(e => e.direction === 'debit').reduce((sum, e) => sum + e.amountCents, 0);
                const netBalance = totalCredits - totalDebits;
                const missingGlCount = entries.filter(e => !e.glCode).length;
                const hasUnbalanced = Math.abs(netBalance) > 0 && entries.length > 0;
                const needsReview = missingGlCount > 0 || hasUnbalanced;
                const isBalanced = !needsReview && entries.length > 0;

                return (
                  <div className={`rounded-xl border p-4 transition-all duration-300 ${needsReview
                      ? 'border-status-warning/20 bg-status-warning/10'
                      : 'border-status-success/20 bg-status-success/10'
                    }`}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-foreground flex items-center gap-2">
                        {isBalanced ? (
                          <CheckCircle className="h-5 w-5 text-emerald-600" />
                        ) : needsReview ? (
                          <AlertTriangle className="h-5 w-5 text-amber-600" />
                        ) : null}
                        Balance Verification
                      </h3>
                      <span className={`text-xs px-3 py-1.5 rounded-full font-medium flex items-center gap-1.5 ${needsReview
                          ? 'bg-status-warning/15 text-status-warning border border-status-warning'
                          : 'bg-status-success/15 text-status-success border border-status-success'
                        }`}>
                        {isBalanced && <CheckCircle className="h-3.5 w-3.5" />}
                        {needsReview ? 'Needs Review' : entries.length > 0 ? 'Books Balanced!' : 'No Entries'}
                      </span>
                    </div>

                    {isBalanced && (
                      <div className="mb-3 p-3 bg-status-success/10 rounded-lg border border-status-success/20">
                        <p className="text-sm text-emerald-800 font-medium">
                          Great news! Your books are balanced for this period.
                        </p>
                        <p className="text-xs text-emerald-600 mt-1">
                          All entries have GL codes assigned and debits equal credits.
                        </p>
                      </div>
                    )}

                    {needsReview && (
                      <div className="mb-3 p-3 bg-status-warning/10 rounded-lg border border-status-warning/20 space-y-1">
                        {hasUnbalanced && (
                          <div className="flex items-center gap-2 text-sm text-amber-800">
                            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                            <span>Unbalanced by <strong>${(Math.abs(netBalance) / 100).toFixed(2)}</strong></span>
                          </div>
                        )}
                        {missingGlCount > 0 && (
                          <div className="flex items-center gap-2 text-sm text-amber-800">
                            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                            <span><strong>{missingGlCount}</strong> {missingGlCount === 1 ? 'entry is' : 'entries are'} missing GL codes</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground text-xs">Total Credits</div>
                        <div className="font-bold text-emerald-700 text-lg">${(totalCredits / 100).toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs">Total Debits</div>
                        <div className="font-bold text-rose-700 text-lg">${(totalDebits / 100).toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs">Net Balance</div>
                        <div className={`font-bold text-lg ${netBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {netBalance >= 0 ? '+' : ''}${(netBalance / 100).toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs">Missing GL Codes</div>
                        <div className={`font-bold text-lg ${missingGlCount > 0 ? 'text-amber-700' : 'text-muted-foreground'}`}>
                          {missingGlCount}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
              {/* Loading State */}
              {ledgerQuery.isLoading && (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-12 bg-muted rounded animate-pulse" />
                  ))}
                </div>
              )}

              {/* Ledger Table */}
              {!ledgerQuery.isLoading && (
                <div className="overflow-auto rounded-lg border border-border">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted">
                      <tr className="text-left text-muted-foreground">
                        <th scope="col" className="px-3 py-3">
                          <button
                            onClick={() => handleSort("occurredAt")}
                            className="flex items-center gap-1 font-medium hover:text-foreground transition-colors"
                          >
                            Date
                            <ArrowUpDown className={`h-3.5 w-3.5 ${sortField === "occurredAt" ? "text-emerald-600" : "text-muted-foreground"}`} />
                          </button>
                        </th>
                        <th scope="col" className="px-3 py-3">
                          <button
                            onClick={() => handleSort("glCode")}
                            className="flex items-center gap-1 font-medium hover:text-foreground transition-colors"
                          >
                            GL Code
                            <ArrowUpDown className={`h-3.5 w-3.5 ${sortField === "glCode" ? "text-emerald-600" : "text-muted-foreground"}`} />
                          </button>
                        </th>
                        <th scope="col" className="px-3 py-3 font-medium">Account</th>
                        <th scope="col" className="px-3 py-3 font-medium">Reservation</th>
                        <th scope="col" className="px-3 py-3">
                          <button
                            onClick={() => handleSort("direction")}
                            className="flex items-center gap-1 font-medium hover:text-foreground transition-colors"
                          >
                            Type
                            <ArrowUpDown className={`h-3.5 w-3.5 ${sortField === "direction" ? "text-emerald-600" : "text-muted-foreground"}`} />
                          </button>
                        </th>
                        <th scope="col" className="px-3 py-3">
                          <button
                            onClick={() => handleSort("amountCents")}
                            className="flex items-center gap-1 font-medium hover:text-foreground transition-colors"
                          >
                            Amount
                            <ArrowUpDown className={`h-3.5 w-3.5 ${sortField === "amountCents" ? "text-emerald-600" : "text-muted-foreground"}`} />
                          </button>
                        </th>
                        <th scope="col" className="px-3 py-3 font-medium">Description</th>
                      </tr>
                    </thead>
                    <tbody className="bg-card divide-y divide-border">
                      {filteredEntries.map((row) => (
                        <tr key={row.id} className="hover:bg-muted transition-colors">
                          <td className="px-3 py-3 text-foreground whitespace-nowrap">
                            {new Date(row.occurredAt).toLocaleDateString()}
                          </td>
                          <td className="px-3 py-3">
                            {row.glCode ? (
                              <span className="px-2 py-0.5 bg-muted text-foreground rounded text-xs font-mono">
                                {row.glCode}
                              </span>
                            ) : (
                              <span className="text-amber-600 text-xs">Missing</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-foreground">{row.account || "—"}</td>
                          <td className="px-3 py-3 text-foreground font-mono text-xs">
                            {row.reservationId ? row.reservationId.slice(0, 8) : "—"}
                          </td>
                          <td className="px-3 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              row.direction === "credit"
                                ? "bg-status-success/15 text-status-success"
                                : "bg-status-error/15 text-status-error"
                            }`}>
                              {row.direction === "credit" ? (
                                <TrendingUp className="h-3 w-3" />
                              ) : (
                                <TrendingDown className="h-3 w-3" />
                              )}
                              {row.direction}
                            </span>
                          </td>
                          <td className="px-3 py-3 font-semibold text-foreground tabular-nums">
                            ${(row.amountCents / 100).toFixed(2)}
                          </td>
                          <td className="px-3 py-3 text-muted-foreground max-w-[200px] truncate">
                            {row.description || "—"}
                          </td>
                        </tr>
                      ))}
                      {filteredEntries.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-3 py-12 text-center">
                            <div className="flex flex-col items-center gap-3">
                              <div className="p-4 bg-muted rounded-full">
                                <FileText className="h-8 w-8 text-muted-foreground" />
                              </div>
                              <div>
                                <p className="text-muted-foreground font-medium">No ledger entries found</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {searchQuery
                                    ? "Try adjusting your search or filters"
                                    : start || end
                                    ? "No entries in this date range. Try a different period."
                                    : "Select a date range to view ledger entries."}
                                </p>
                              </div>
                              {!start && !end && (
                                <button
                                  onClick={() => applyPreset(datePresets[2])} // This Month
                                  className="mt-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
                                >
                                  View This Month
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Entry Count */}
              {!ledgerQuery.isLoading && filteredEntries.length > 0 && (
                <div className="text-xs text-muted-foreground text-right">
                  Showing {filteredEntries.length} of {ledgerQuery.data?.length || 0} entries
                  {searchQuery && ` matching "${searchQuery}"`}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
