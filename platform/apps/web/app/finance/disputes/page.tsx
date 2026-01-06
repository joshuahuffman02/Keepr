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
import Link from "next/link";
import { useToast } from "@/components/ui/use-toast";

const statusColors: Record<string, string> = {
  needs_response: "bg-status-warning-bg text-status-warning-text",
  warning_needs_response: "bg-status-warning-bg text-status-warning-text",
  warning_under_review: "bg-status-info-bg text-status-info-text",
  under_review: "bg-status-info-bg text-status-info-text",
  charge_refunded: "bg-status-error-bg text-status-error-text",
  won: "bg-status-success-bg text-status-success-text",
  lost: "bg-status-error-bg text-status-error-text"
};

const DUE_SOON_HOURS = 48;

function formatMoney(cents: number | null | undefined, currency = "USD") {
  if (cents === null || cents === undefined) return "-";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export default function DisputesPage() {
  const [campgroundId, setCampgroundId] = useState<string>("");
  const [status, setStatus] = useState<string | undefined>();
  const [templates, setTemplates] = useState<{ id: string; label: string }[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("campreserv:selectedCampground");
    if (stored) setCampgroundId(stored);
  }, []);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["disputes", campgroundId, status],
    queryFn: () => apiClient.listDisputes(campgroundId, status),
    enabled: !!campgroundId,
    staleTime: 30_000
  });

  useEffect(() => {
    if (!campgroundId) return;
    apiClient.listDisputeTemplates(campgroundId).then(setTemplates).catch(() => {});
  }, [campgroundId]);

  const counts = useMemo(() => {
    const summary: Record<string, number> = {};
    (data || []).forEach((d) => {
      summary[d.status] = (summary[d.status] || 0) + 1;
    });
    return summary;
  }, [data]);

  const dueSoonCount = useMemo(() => {
    const now = Date.now();
    const cutoff = now + DUE_SOON_HOURS * 60 * 60 * 1000;
    return (data || []).filter(
      (d) =>
        d.evidenceDueBy &&
        new Date(d.evidenceDueBy).getTime() <= cutoff &&
        new Date(d.evidenceDueBy).getTime() >= now &&
        !["won", "lost", "charge_refunded"].includes(d.status)
    ).length;
  }, [data]);

  return (
    <DashboardShell>
      <div className="max-w-5xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Dispute Center</h1>
            <p className="text-sm text-muted-foreground">Stripe chargebacks with due dates for evidence.</p>
          </div>
          <div className="flex gap-2">
            {["all", "needs_response", "under_review", "charge_refunded", "won", "lost"].map((s) => (
              <Button
                key={s}
                size="sm"
                variant={status === (s === "all" ? undefined : s) ? "default" : "outline"}
                onClick={() => setStatus(s === "all" ? undefined : s)}
                aria-pressed={status === (s === "all" ? undefined : s)}
              >
                {s === "all" ? "All" : `${s.replace("_", " ")}${counts[s] ? ` (${counts[s]})` : ""}`}
              </Button>
            ))}
            <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isLoading}>
              Refresh
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                if (!campgroundId) return;
                try {
                  await apiClient.exportDisputesCsv(campgroundId, status);
                } catch (err: any) {
                  toast({ title: "Export failed", description: err.message, variant: "destructive" });
                }
              }}
              disabled={!campgroundId}
            >
              Export CSV
            </Button>
          </div>
        </div>

        {dueSoonCount > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-status-warning">Disputes due soon: {dueSoonCount} (within {DUE_SOON_HOURS}h)</CardTitle>
            </CardHeader>
          </Card>
        )}

        {templates.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Evidence kit templates</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {templates.map((t) => (
                <Badge key={t.id} variant="outline">{t.label}</Badge>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Disputes</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stripe Dispute</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Reservation</TableHead>
                  <TableHead>Evidence due</TableHead>
                  <TableHead>Charge</TableHead>
                  <TableHead>Intent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!data && isLoading && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">Loading...</TableCell>
                  </TableRow>
                )}
                {data?.length === 0 && !isLoading && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">No disputes.</TableCell>
                  </TableRow>
                )}
                {data?.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs">
                      <Link className="text-primary hover:underline" href={`/finance/disputes/${d.id}`}>
                        {d.stripeDisputeId}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[d.status] || "bg-muted text-foreground"}>
                        {d.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatMoney(d.amountCents, d.currency.toUpperCase())}</TableCell>
                    <TableCell className="text-xs text-foreground">{d.reason ?? "—"}</TableCell>
                    <TableCell className="text-xs text-foreground">
                      {d.reservationId ? (
                        <Link className="text-primary hover:underline" href={`/campgrounds/${campgroundId}/reservations/${d.reservationId}`}>
                          {d.reservationId}
                        </Link>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-foreground">
                      {d.evidenceDueBy ? format(new Date(d.evidenceDueBy), "yyyy-MM-dd") : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{d.stripeChargeId ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{d.stripePaymentIntentId ?? "—"}</TableCell>
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
