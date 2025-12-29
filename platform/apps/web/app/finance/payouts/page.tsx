"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { useToast } from "@/components/ui/use-toast";
import Link from "next/link";

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  in_transit: "bg-blue-100 text-blue-800",
  paid: "bg-emerald-100 text-emerald-800",
  failed: "bg-rose-100 text-rose-800",
  canceled: "bg-slate-100 text-slate-700"
};

function formatMoney(cents: number | null | undefined, currency = "USD") {
  if (cents === null || cents === undefined) return "-";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

const DRIFT_THRESHOLD_CENTS = 100;

interface PayoutRecon {
  driftVsLedgerCents: number;
  driftVsLinesCents: number;
}

export default function PayoutsPage() {
  const [campgroundId, setCampgroundId] = useState<string>("");
  const [status, setStatus] = useState<string | undefined>();
  const [reconMap, setReconMap] = useState<Record<string, PayoutRecon>>({});
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("campreserv:selectedCampground");
    if (stored) setCampgroundId(stored);
  }, []);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["payouts", campgroundId, status],
    queryFn: () => {
      const validStatuses = ["pending", "in_transit", "paid", "failed", "canceled"] as const;
      type ValidStatus = typeof validStatuses[number];
      const payoutStatus = status && validStatuses.includes(status as ValidStatus)
        ? (status as ValidStatus)
        : undefined;
      return apiClient.listPayouts(campgroundId, payoutStatus);
    },
    enabled: !!campgroundId,
    staleTime: 30_000
  });

  const totalNet = useMemo(() => {
    if (!data) return 0;
    return data.reduce((acc, p) => acc + p.amountCents - (p.feeCents ?? 0), 0);
  }, [data]);

  return (
    <DashboardShell>
      <div className="max-w-5xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Payouts</h1>
            <p className="text-sm text-slate-600">Stripe Connect payouts with balance transaction lines.</p>
          </div>
          <div className="flex gap-2">
            {["all", "pending", "in_transit", "paid", "failed", "canceled"].map((s) => (
              <Button
                key={s}
                size="sm"
                variant={status === (s === "all" ? undefined : s) ? "default" : "outline"}
                onClick={() => setStatus(s === "all" ? undefined : s)}
              >
                {s === "all" ? "All" : s.replace("_", " ")}
              </Button>
            ))}
            <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isLoading}>
              Refresh
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Payouts</span>
              <span className="text-sm text-slate-600">Net: {formatMoney(totalNet)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stripe Payout</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Fees</TableHead>
                  <TableHead>Net</TableHead>
                  <TableHead>Arrival</TableHead>
                  <TableHead>Lines</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!data && isLoading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-slate-500">Loading...</TableCell>
                  </TableRow>
                )}
                {data?.length === 0 && !isLoading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-slate-500">No payouts yet.</TableCell>
                  </TableRow>
                )}
                {data?.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell className="font-mono text-xs">
                      <Link className="text-indigo-600 hover:underline" href={`/finance/payouts/${payout.id}`}>
                        {payout.stripePayoutId}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[payout.status] || "bg-slate-100 text-slate-700"}>
                        {payout.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatMoney(payout.amountCents, payout.currency.toUpperCase())}</TableCell>
                    <TableCell>{formatMoney(payout.feeCents ?? 0, payout.currency.toUpperCase())}</TableCell>
                    <TableCell>{formatMoney(payout.amountCents - (payout.feeCents ?? 0), payout.currency.toUpperCase())}</TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {payout.arrivalDate ? format(new Date(payout.arrivalDate), "yyyy-MM-dd") : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 flex flex-col gap-1">
                      <span>{payout.lines?.length ?? 0}</span>
                      {reconMap[payout.id] && Math.abs(reconMap[payout.id].driftVsLedgerCents) > DRIFT_THRESHOLD_CENTS && (
                        <Badge className="bg-amber-100 text-amber-800 w-fit">Drift: {formatMoney(reconMap[payout.id].driftVsLedgerCents)}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => apiClient.exportPayoutCsv(campgroundId, payout.id)}
                      >
                        Export CSV
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          try {
                            const recon = await apiClient.getPayoutRecon(campgroundId, payout.id);
                            setReconMap((prev) => ({ ...prev, [payout.id]: recon }));
                            toast({ title: "Recon ready", description: `Drift vs ledger: ${formatMoney(recon.driftVsLedgerCents)}` });
                          } catch (err: any) {
                            toast({ title: "Recon failed", description: err.message, variant: "destructive" });
                          }
                        }}
                      >
                        Recon
                      </Button>
                      {reconMap[payout.id] && (
                        <div className="text-xs text-slate-600 mt-1">
                          Drift (lines): {formatMoney(reconMap[payout.id].driftVsLinesCents)} · Drift (ledger): {formatMoney(reconMap[payout.id].driftVsLedgerCents)}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}

