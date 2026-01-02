"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import Link from "next/link";

const statusColors: Record<string, string> = {
  needs_response: "bg-status-warning/15 text-status-warning",
  warning_needs_response: "bg-status-warning/15 text-status-warning",
  warning_under_review: "bg-status-info/15 text-status-info",
  under_review: "bg-status-info/15 text-status-info",
  charge_refunded: "bg-status-error/15 text-status-error",
  won: "bg-status-success/15 text-status-success",
  lost: "bg-status-error/15 text-status-error"
};

function formatMoney(cents: number | null | undefined, currency = "USD") {
  if (cents === null || cents === undefined) return "-";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export default function DisputeDetailPage() {
  const params = useParams();
  const disputeId = params?.disputeId as string;
  const [campgroundId, setCampgroundId] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("campreserv:selectedCampground");
    if (stored) setCampgroundId(stored);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["dispute-detail", campgroundId, disputeId],
    queryFn: async () => {
      const disputes = await apiClient.listDisputes(campgroundId);
      return disputes.find((d: any) => d.id === disputeId);
    },
    enabled: !!campgroundId && !!disputeId,
    staleTime: 30_000
  });

  const { data: templates } = useQuery({
    queryKey: ["dispute-templates", campgroundId],
    queryFn: () => apiClient.listDisputeTemplates(campgroundId),
    enabled: !!campgroundId,
    staleTime: 60_000
  });

  const dueSoon = useMemo(() => {
    if (!data?.evidenceDueBy) return false;
    const due = new Date(data.evidenceDueBy).getTime();
    return due - Date.now() <= 48 * 60 * 60 * 1000;
  }, [data?.evidenceDueBy]);

  return (
    <DashboardShell>
      <div className="max-w-5xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Dispute Detail</h1>
            <p className="text-sm text-muted-foreground">Evidence kit and links for dispute resolution.</p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => apiClient.exportDisputesCsv(campgroundId, data?.status)}
              disabled={!campgroundId}
            >
              Export CSV
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="font-mono text-xs">{data?.stripeDisputeId ?? disputeId}</span>
              {data?.status && (
                <Badge className={statusColors[data.status] || "bg-muted text-foreground"}>
                  {data.status.replace("_", " ")}
                </Badge>
              )}
              {dueSoon && (
                <Badge className="bg-status-warning/15 text-status-warning">Due within 48h</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-foreground">
            <div className="flex flex-wrap gap-4">
              <div>Amount: {formatMoney(data?.amountCents, data?.currency?.toUpperCase())}</div>
              <div>Reason: {data?.reason ?? "—"}</div>
              <div>Reservation: {data?.reservationId ? <Link className="text-indigo-600 hover:underline" href={`/campgrounds/${campgroundId}/reservations/${data.reservationId}`}>{data.reservationId}</Link> : "—"}</div>
            </div>
            <div className="text-xs text-muted-foreground">
              Evidence due: {data?.evidenceDueBy ? format(new Date(data.evidenceDueBy), "yyyy-MM-dd") : "—"}
            </div>
            <div className="text-xs text-muted-foreground flex gap-3">
              <span>Charge: {data?.stripeChargeId ?? "—"}</span>
              <span>Intent: {data?.stripePaymentIntentId ?? "—"}</span>
            </div>
          </CardContent>
        </Card>

        {templates && templates.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Evidence kit checklist</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {templates.map((t) => (
                <Badge key={t.id} variant="outline">{t.label}</Badge>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}

