"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { useToast } from "@/components/ui/use-toast";
import Link from "next/link";

const statusColors: Record<string, string> = {
  pending: "bg-status-warning-bg text-status-warning-text",
  in_transit: "bg-status-info-bg text-status-info-text",
  paid: "bg-status-success-bg text-status-success-text",
  failed: "bg-status-error-bg text-status-error-text",
  canceled: "bg-muted text-muted-foreground",
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

type ValidStatus = "pending" | "in_transit" | "paid" | "failed" | "canceled";
const validStatuses: ValidStatus[] = ["pending", "in_transit", "paid", "failed", "canceled"];
const validStatusSet = new Set<string>(validStatuses);
const isValidStatus = (value: string): value is ValidStatus => validStatusSet.has(value);
const statusFilters: Array<ValidStatus | "all"> = ["all", ...validStatuses];

export default function PayoutsPage() {
  const [campgroundId, setCampgroundId] = useState<string>("");
  const [status, setStatus] = useState<ValidStatus | undefined>();
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
      const payoutStatus = status && isValidStatus(status) ? status : undefined;
      return apiClient.listPayouts(campgroundId, payoutStatus);
    },
    enabled: !!campgroundId,
    staleTime: 30_000,
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
            <h1 className="text-2xl font-semibold text-foreground">Payouts</h1>
            <p className="text-sm text-muted-foreground">
              Stripe Connect payouts with balance transaction lines.
            </p>
          </div>
          <div className="flex gap-2">
            {statusFilters.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={status === (s === "all" ? undefined : s) ? "default" : "outline"}
                onClick={() => setStatus(s === "all" ? undefined : s)}
                aria-pressed={status === (s === "all" ? undefined : s)}
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
              <span className="text-sm text-muted-foreground">Net: {formatMoney(totalNet)}</span>
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
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!data && isLoading && (
                  <TableRow>
                    <TableCell colSpan={8} className="p-4">
                      <div className="space-y-3">
                        {[...Array(4)].map((_, i) => (
                          <div key={i} className="animate-pulse flex items-center gap-4 p-2">
                            <div className="h-4 bg-muted rounded w-32" />
                            <div className="h-6 w-20 bg-muted rounded" />
                            <div className="h-4 bg-muted rounded w-24" />
                            <div className="flex-1 h-4 bg-muted rounded" />
                          </div>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {data?.length === 0 && !isLoading && (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                          <svg
                            className="w-5 h-5 text-muted-foreground"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        </div>
                        <p className="text-sm font-medium text-foreground">No payouts yet</p>
                        <p className="text-xs text-muted-foreground">
                          Payouts will appear here once processed
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {data?.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell className="font-mono text-xs">
                      <Link
                        className="text-primary hover:underline"
                        href={`/finance/payouts/${payout.id}`}
                      >
                        {payout.stripePayoutId}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[payout.status] || "bg-muted text-foreground"}>
                        {payout.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {formatMoney(payout.amountCents, payout.currency.toUpperCase())}
                    </TableCell>
                    <TableCell>
                      {formatMoney(payout.feeCents ?? 0, payout.currency.toUpperCase())}
                    </TableCell>
                    <TableCell>
                      {formatMoney(
                        payout.amountCents - (payout.feeCents ?? 0),
                        payout.currency.toUpperCase(),
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {payout.arrivalDate
                        ? format(new Date(payout.arrivalDate), "yyyy-MM-dd")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground flex flex-col gap-1">
                      <span>{payout.lines?.length ?? 0}</span>
                      {reconMap[payout.id] &&
                        Math.abs(reconMap[payout.id].driftVsLedgerCents) >
                          DRIFT_THRESHOLD_CENTS && (
                          <Badge className="bg-status-warning-bg text-status-warning-text w-fit">
                            Drift: {formatMoney(reconMap[payout.id].driftVsLedgerCents)}
                          </Badge>
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
                            toast({
                              title: "Recon ready",
                              description: `Drift vs ledger: ${formatMoney(recon.driftVsLedgerCents)}`,
                            });
                          } catch (err: unknown) {
                            const message = err instanceof Error ? err.message : "Recon failed";
                            toast({
                              title: "Recon failed",
                              description: message,
                              variant: "destructive",
                            });
                          }
                        }}
                      >
                        Recon
                      </Button>
                      {reconMap[payout.id] && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Drift (lines): {formatMoney(reconMap[payout.id].driftVsLinesCents)} ·
                          Drift (ledger): {formatMoney(reconMap[payout.id].driftVsLedgerCents)}
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
