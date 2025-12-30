"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useToast } from "@/components/ui/use-toast";

function formatMoney(cents: number | null | undefined, currency = "USD") {
  if (cents === null || cents === undefined) return "-";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

const DRIFT_THRESHOLD_CENTS = 100;

export default function PayoutDetailPage() {
  const params = useParams();
  const payoutId = params?.payoutId as string;
  const [campgroundId, setCampgroundId] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("campreserv:selectedCampground");
    if (stored) setCampgroundId(stored);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["payout-detail", campgroundId, payoutId],
    queryFn: () => apiClient.getPayout(campgroundId, payoutId),
    enabled: !!campgroundId && !!payoutId,
    staleTime: 30_000
  });

  const { data: recon } = useQuery({
    queryKey: ["payout-recon", campgroundId, payoutId],
    queryFn: () => apiClient.getPayoutRecon(campgroundId, payoutId),
    enabled: !!campgroundId && !!payoutId,
    staleTime: 30_000
  });

  return (
    <DashboardShell>
      <div className="max-w-5xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Payout Detail</h1>
            <p className="text-sm text-slate-600">Stripe payout lines and recon.</p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => apiClient.exportPayoutCsv(campgroundId, payoutId)}
              disabled={!campgroundId || !payoutId}
            >
              Export CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => apiClient.exportPayoutLedgerCsv(campgroundId, payoutId)}
              disabled={!campgroundId || !payoutId}
            >
              Export Ledger
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>{data?.stripePayoutId ?? payoutId}</span>
              {data?.status && (
                <Badge className="bg-status-info/15 text-status-info">{data.status.replace("_", " ")}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-700">
            <div className="flex gap-4">
              <div>Amount: {formatMoney(data?.amountCents, data?.currency?.toUpperCase())}</div>
              <div>Fee: {formatMoney(data?.feeCents ?? 0, data?.currency?.toUpperCase())}</div>
              <div>Net: {formatMoney((data?.amountCents ?? 0) - (data?.feeCents ?? 0), data?.currency?.toUpperCase())}</div>
            </div>
            <div className="text-xs text-slate-600">
              Arrival: {data?.arrivalDate ? format(new Date(data.arrivalDate), "yyyy-MM-dd") : "—"}
            </div>
            {recon && (
              <div className="text-xs text-slate-700 flex flex-col gap-1">
                <div>
                  Recon — Net: {formatMoney(recon.payoutNetCents)} | Lines: {formatMoney(recon.lineSumCents)} | Ledger: {formatMoney(recon.ledgerNetCents)} | Drift vs Ledger: {formatMoney(recon.driftVsLedgerCents)}
                </div>
                {Math.abs(recon.driftVsLedgerCents) > DRIFT_THRESHOLD_CENTS && (
                  <Badge className="bg-status-warning/15 text-status-warning w-fit">
                    Drift exceeds threshold ({formatMoney(recon.driftVsLedgerCents)})
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lines</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Reservation</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Charge</TableHead>
                  <TableHead>Payment Intent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-slate-500">Loading...</TableCell>
                  </TableRow>
                )}
                {!isLoading && data?.lines?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-slate-500">No lines.</TableCell>
                  </TableRow>
                )}
                {data?.lines?.map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs">{l.type}</TableCell>
                    <TableCell className="text-xs">{formatMoney(l.amountCents, l.currency?.toUpperCase())}</TableCell>
                    <TableCell className="text-xs font-mono">{l.reservationId ?? "—"}</TableCell>
                    <TableCell className="text-xs">{l.description ?? "—"}</TableCell>
                    <TableCell className="text-xs font-mono">{l.chargeId ?? "—"}</TableCell>
                    <TableCell className="text-xs font-mono">{l.paymentIntentId ?? "—"}</TableCell>
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

