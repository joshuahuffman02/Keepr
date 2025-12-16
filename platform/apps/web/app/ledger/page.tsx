"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardShell } from "../../components/ui/layout/DashboardShell";
import { Breadcrumbs } from "../../components/breadcrumbs";
import { Button } from "../../components/ui/button";
import { TableEmpty } from "../../components/ui/table";
import { apiClient } from "../../lib/api-client";
import { HelpAnchor } from "../../components/help/HelpAnchor";

export default function LedgerPage() {
  const [campgroundId, setCampgroundId] = useState<string>("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [glCode, setGlCode] = useState("");

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

  return (
    <DashboardShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Breadcrumbs items={[{ label: "Ledger" }]} />
          <HelpAnchor topicId="ledger-close-day" label="Ledger help" />
        </div>
        {!campgroundId && (
          <div className="card p-5">
            <div className="text-lg font-semibold text-slate-900">Select a campground</div>
            <p className="text-sm text-slate-600 mt-1">Use the left sidebar switcher to choose a campground.</p>
          </div>
        )}
        {campgroundId && (
          <>
            <div className="card p-4 flex flex-wrap gap-2 items-end">
              <div className="space-y-1">
                <div className="text-xs text-slate-500">Start</div>
                <input
                  type="date"
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-slate-500">End</div>
                <input
                  type="date"
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-slate-500">GL Code</div>
                <input
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Optional"
                  value={glCode}
                  onChange={(e) => setGlCode(e.target.value)}
                />
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const qs = new URLSearchParams();
                  if (start) qs.set("start", start);
                  if (end) qs.set("end", end);
                  if (glCode) qs.set("glCode", glCode);
                  const url = `/campgrounds/${campgroundId}/ledger/export${qs.toString() ? `?${qs.toString()}` : ""}`;
                  window.open((process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api") + url, "_blank");
                }}
              >
                Export CSV
              </Button>
            </div>

            <div className="card p-4 space-y-3">
              <div className="text-sm text-slate-700">
                Entries: {ledgerQuery.data?.length ?? 0} • Net {total >= 0 ? "credit" : "debit"} ${(Math.abs(total) / 100).toFixed(2)}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {summaryQuery.data?.map((row) => (
                  <div key={row.glCode} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-xs text-slate-500">GL {row.glCode}</div>
                    <div className="text-sm font-semibold text-slate-900">
                      {row.netCents >= 0 ? "Credit" : "Debit"} ${(Math.abs(row.netCents) / 100).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
              {agingQuery.data && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { label: "0-30", key: "current" },
                    { label: "31-60", key: "31_60" },
                    { label: "61-90", key: "61_90" },
                    { label: "90+", key: "90_plus" }
                  ].map((b) => (
                    <div key={b.key} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                      <div className="text-xs text-amber-700">Aging {b.label} days</div>
                      <div className="text-sm font-semibold text-amber-900">
                        ${(agingQuery.data?.[b.key as keyof typeof agingQuery.data] / 100).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Balance Sanity Checks */}
              {(() => {
                const entries = ledgerQuery.data || [];
                const totalCredits = entries.filter(e => e.direction === 'credit').reduce((sum, e) => sum + e.amountCents, 0);
                const totalDebits = entries.filter(e => e.direction === 'debit').reduce((sum, e) => sum + e.amountCents, 0);
                const netBalance = totalCredits - totalDebits;
                const missingGlCount = entries.filter(e => !e.glCode).length;
                const hasUnbalanced = Math.abs(netBalance) > 0 && entries.length > 0;
                const needsReview = missingGlCount > 0 || hasUnbalanced;

                return (
                  <div className={`rounded-lg border p-4 space-y-3 ${needsReview
                      ? 'border-amber-200 bg-amber-50'
                      : 'border-emerald-200 bg-emerald-50'
                    }`}>
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-slate-900">Balance Verification</h3>
                      <span className={`text-xs px-2 py-1 rounded-full ${needsReview
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700'
                        }`}>
                        {needsReview ? 'Needs review' : 'Balanced'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-slate-500">Total Credits</div>
                        <div className="font-semibold text-emerald-700">${(totalCredits / 100).toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Total Debits</div>
                        <div className="font-semibold text-rose-700">${(totalDebits / 100).toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Net Balance</div>
                        <div className={`font-semibold ${netBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {netBalance >= 0 ? '+' : ''}{(netBalance / 100).toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">Missing GL Codes</div>
                        <div className={`font-semibold ${missingGlCount > 0 ? 'text-amber-700' : 'text-slate-700'}`}>
                          {missingGlCount} {missingGlCount === 1 ? 'entry' : 'entries'}
                        </div>
                      </div>
                    </div>
                    {needsReview && (
                      <div className="text-xs text-amber-700 space-y-1">
                        {hasUnbalanced && <div>⚠️ Ledger has an unbalanced net of ${(Math.abs(netBalance) / 100).toFixed(2)}</div>}
                        {missingGlCount > 0 && <div>⚠️ {missingGlCount} entries are missing GL codes</div>}
                      </div>
                    )}
                  </div>
                );
              })()}
              {Object.keys(grouped).length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {Object.entries(grouped).map(([gl, amt]) => (
                    <div key={gl} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="text-xs text-slate-500">GL {gl}</div>
                      <div className="text-sm font-semibold text-slate-900">
                        {amt >= 0 ? "Credit" : "Debit"} ${(Math.abs(amt) / 100).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {ledgerQuery.isLoading && <div className="text-sm text-slate-600">Loading…</div>}
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-600">
                      <th className="px-2 py-2">Date</th>
                      <th className="px-2 py-2">GL</th>
                      <th className="px-2 py-2">Account</th>
                      <th className="px-2 py-2">Reservation</th>
                      <th className="px-2 py-2">Direction</th>
                      <th className="px-2 py-2">Amount</th>
                      <th className="px-2 py-2">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(ledgerQuery.data || []).map((row) => (
                      <tr key={row.id} className="border-b border-slate-100">
                        <td className="px-2 py-2 text-slate-700">{new Date(row.occurredAt).toLocaleDateString()}</td>
                        <td className="px-2 py-2 text-slate-700">{row.glCode || "—"}</td>
                        <td className="px-2 py-2 text-slate-700">{row.account || "—"}</td>
                        <td className="px-2 py-2 text-slate-700">{row.reservationId || "—"}</td>
                        <td className="px-2 py-2 text-slate-700">{row.direction}</td>
                        <td className="px-2 py-2 font-semibold text-slate-900">
                          ${(row.amountCents / 100).toFixed(2)}
                        </td>
                        <td className="px-2 py-2 text-slate-700">{row.description || "—"}</td>
                      </tr>
                    ))}
                    {!ledgerQuery.isLoading && (ledgerQuery.data || []).length === 0 && <TableEmpty colSpan={7}>No ledger entries for this range.</TableEmpty>}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
