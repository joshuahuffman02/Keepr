"use client";

import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { DashboardShell } from "../../../../../components/ui/layout/DashboardShell";
import { Breadcrumbs } from "../../../../../components/breadcrumbs";
import { apiClient } from "../../../../../lib/api-client";
import { computeDepositDue } from "@campreserv/shared";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../../components/ui/card";
import { Badge } from "../../../../../components/ui/badge";
import { Button } from "../../../../../components/ui/button";
import { Input } from "../../../../../components/ui/input";
import { Label } from "../../../../../components/ui/label";
import { format } from "date-fns";
import { DollarSign, ArrowLeft, MessageSquare, Calculator, ActivitySquare, MapPin, CheckCircle, DoorOpen, Users, AlertTriangle, Clock, ShieldCheck } from "lucide-react";

function formatDate(d?: string | Date | null) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return isNaN(date.getTime()) ? "—" : format(date, "MMM d, yyyy");
}

function formatDateTime(d?: string | Date | null) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return isNaN(date.getTime()) ? "—" : format(date, "MMM d, yyyy h:mma");
}

export default function ReservationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [commsFilter, setCommsFilter] = useState<"all" | "messages" | "notes" | "failed">("all");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehicleState, setVehicleState] = useState("");
  const [vehicleRigType, setVehicleRigType] = useState("");
  const [vehicleRigLength, setVehicleRigLength] = useState("");
  const [signatureEmail, setSignatureEmail] = useState("");
  const [signatureType, setSignatureType] = useState("long_term_stay");
  const [deliveryChannel, setDeliveryChannel] = useState<"email" | "email_and_sms" | "sms">("email");
  const [coiUrl, setCoiUrl] = useState("");
  const [coiExpiresAt, setCoiExpiresAt] = useState("");
  const [accessProvider, setAccessProvider] = useState<"kisi" | "brivo" | "cloudkey">("kisi");
  const [accessCode, setAccessCode] = useState("");
  const reservationId = params.reservationId as string;
  const campgroundId = params.campgroundId as string;

  const reservationQuery = useQuery({
    queryKey: ["reservation", reservationId],
    queryFn: () => apiClient.getReservation(reservationId),
    enabled: !!reservationId
  });
  const reservation = reservationQuery.data;

  const checkinStatusQuery = useQuery({
    queryKey: ["checkin-status", reservationId],
    queryFn: () => apiClient.getCheckinStatus(reservationId),
    enabled: !!reservationId
  });
  const checkinStatus = checkinStatusQuery.data;

  const accessQuery = useQuery({
    queryKey: ["access-status", reservationId],
    queryFn: () => apiClient.getAccessStatus(reservationId),
    enabled: !!reservationId
  });
  const accessStatus = accessQuery.data;

  const quoteQuery = useQuery({
    queryKey: ["reservation-quote", reservationId],
    queryFn: () =>
      apiClient.getQuote(campgroundId, {
        siteId: reservation?.siteId || "",
        arrivalDate: reservation?.arrivalDate || "",
        departureDate: reservation?.departureDate || ""
      }),
    enabled: !!reservationId && !!campgroundId && !!reservation?.siteId
  });

  const commsQuery = useQuery({
    queryKey: ["reservation-comms", reservationId],
    queryFn: () =>
      apiClient.listCommunications({
        campgroundId,
        reservationId,
        guestId: reservationQuery.data?.guestId,
        limit: 30
      }),
    enabled: !!reservationId && !!campgroundId
  });

  const availabilityQuery = useQuery({
    queryKey: ["reservation-availability", reservationId],
    queryFn: () =>
      apiClient.getAvailability(campgroundId, {
        arrivalDate: reservation?.arrivalDate ?? "",
        departureDate: reservation?.departureDate ?? ""
      }),
    enabled: !!reservationId && !!campgroundId && !!reservation?.arrivalDate && !!reservation?.departureDate
  });

  const relatedQuery = useQuery({
    queryKey: ["related-reservations", campgroundId, reservation?.guestId],
    queryFn: () => apiClient.getReservations(campgroundId),
    enabled: !!campgroundId && !!reservation?.guestId
  });

  const chargesQuery = useQuery({
    queryKey: ["reservation-charges", reservationId],
    queryFn: () => apiClient.getRepeatChargesByReservation(reservationId),
    enabled: !!reservationId
  });

  const updateReservation = useMutation({
    mutationFn: (data: any) => apiClient.updateReservation(reservationId, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["reservation", reservationId] });
      queryClient.invalidateQueries({ queryKey: ["reservations", campgroundId] });
      if (variables.status === "checked_out" && reservation?.siteId) {
        apiClient.updateSiteHousekeeping(reservation.siteId, "dirty").catch(err => {
          console.error("Failed to update site housekeeping status:", err);
        });
      }
    }
  });

  const vehicleMutation = useMutation({
    mutationFn: (payload: any) => apiClient.upsertVehicle(reservationId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-status", reservationId] });
      queryClient.invalidateQueries({ queryKey: ["reservation", reservationId] });
    }
  });

  const grantAccessMutation = useMutation({
    mutationFn: (payload: any) => apiClient.grantAccess(reservationId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-status", reservationId] });
    }
  });

  const revokeAccessMutation = useMutation({
    mutationFn: (payload: any) => apiClient.revokeAccess(reservationId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-status", reservationId] });
    }
  });

  const formsQuery = useQuery({
    queryKey: ["form-submissions", reservationId],
    queryFn: () => apiClient.getFormSubmissionsByReservation(reservationId),
    enabled: !!reservationId
  });
  const pendingForms = (formsQuery.data || []).filter((f: any) => f.status === "pending").length;

  const signaturesQuery = useQuery({
    queryKey: ["signatures", reservationId],
    queryFn: async () => {
      const res = await fetch(`/api/signatures/reservations/${reservationId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Unable to fetch signature requests");
      return res.json();
    },
    enabled: !!reservationId,
    retry: false
  });

  const createSignatureMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        campgroundId,
        reservationId,
        documentType: signatureType,
        recipientEmail: signatureEmail || reservation?.guest?.email,
        deliveryChannel,
        message: "Please review and sign the long-stay documents.",
        recipientName: reservation?.guest ? `${reservation.guest.primaryFirstName} ${reservation.guest.primaryLastName}` : undefined
      };
      const res = await fetch("/api/signatures/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Failed to create signature request");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signatures", reservationId] });
    }
  });

  const resendSignatureMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/signatures/requests/${id}/resend`, {
        method: "POST",
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to resend");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signatures", reservationId] });
    }
  });

  const coiUploadMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        campgroundId,
        reservationId,
        guestId: reservation?.guestId,
        fileUrl: coiUrl || "https://placeholder.example/coi.pdf",
        expiresAt: coiExpiresAt || undefined
      };
      const res = await fetch("/api/signatures/coi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Failed to save COI");
      return res.json();
    }
  });

  useEffect(() => {
    if (reservation) {
      setVehiclePlate(reservation.vehiclePlate || accessStatus?.vehicle?.plate || "");
      setVehicleState(reservation.vehicleState || accessStatus?.vehicle?.state || "");
      setVehicleRigType(reservation.rigType || accessStatus?.vehicle?.rigType || "");
      setVehicleRigLength(
        reservation.rigLength !== undefined && reservation.rigLength !== null
          ? String(reservation.rigLength)
          : accessStatus?.vehicle?.rigLength
            ? String(accessStatus.vehicle.rigLength)
            : ""
      );
      if (reservation.guest?.email && !signatureEmail) {
        setSignatureEmail(reservation.guest.email);
      }
    }
  }, [reservation?.id, accessStatus?.vehicle?.id]);

  if (reservationQuery.isLoading) {
    return (
      <DashboardShell>
        <div className="flex h-80 items-center justify-center text-slate-600">Loading reservation…</div>
      </DashboardShell>
    );
  }

  if (!reservation) {
    return (
      <DashboardShell>
        <div className="flex h-80 flex-col items-center justify-center gap-4 text-slate-600">
          <div>Reservation not found</div>
          <Button onClick={() => router.push(`/campgrounds/${campgroundId}/reservations`)}>Back to list</Button>
        </div>
      </DashboardShell>
    );
  }

  const guestName = reservation.guest
    ? `${reservation.guest.primaryFirstName} ${reservation.guest.primaryLastName}`
    : "Guest";
  const siteLabel = reservation.site
    ? `${reservation.site.name || ""} #${reservation.site.siteNumber || ""}`.trim()
    : "Site";

  const payments = (reservation as any).payments || [];
  const quote = quoteQuery.data;
  const comms = commsQuery.data?.items || [];
  const related = (relatedQuery.data || []).filter((r: any) => r.id !== reservationId && r.guestId === reservation.guestId).slice(0, 3);
  const total = (reservation.totalAmount ?? 0) / 100;
  const paid = (reservation.paidAmount ?? 0) / 100;
  const balance = Math.max(0, total - paid);
  const depositRule = (reservation as any).depositRule ?? (reservation as any).depositConfig?.rule ?? null;
  const depositPercentage =
    (reservation as any).depositPercentage ?? (reservation as any).depositConfig?.depositPercentage ?? null;
  const depositConfig = (reservation as any).depositConfig ?? null;
  const requiredDeposit =
    quote?.totalCents && quote?.nights
      ? computeDepositDue({
        total: (quote?.totalCents ?? 0) / 100,
        nights: quote?.nights ?? 1,
        arrivalDate: reservation.arrivalDate,
        depositRule,
        depositPercentage,
        depositConfig
      })
      : 0;
  const signatureRequests = Array.isArray(signaturesQuery.data)
    ? signaturesQuery.data
    : signaturesQuery.isError
      ? [
        {
          id: "stub-signature",
          documentType: "long_term_stay",
          status: "sent",
          recipientEmail: reservation.guest?.email,
          sentAt: new Date().toISOString()
        }
      ]
      : [];
  const getRequestMetadata = (req: any) => {
    const raw = req?.metadata;
    if (!raw) return {};
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch {
        return {};
      }
    }
    return raw;
  };
  const isPolicyRequest = (req: any) => {
    const meta = getRequestMetadata(req);
    return Boolean(meta?.policyId || meta?.policyName || meta?.enforcement || req?.template?.policyConfig);
  };
  const policyRequests = signatureRequests.filter(isPolicyRequest);
  const otherSignatureRequests = signatureRequests.filter((req: any) => !isPolicyRequest(req));

  const statusBadge =
    reservation.status === "confirmed"
      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
      : reservation.status === "checked_in"
        ? "bg-blue-100 text-blue-700 border-blue-200"
        : reservation.status === "checked_out"
          ? "bg-slate-100 text-slate-700 border-slate-200"
          : reservation.status === "cancelled"
            ? "bg-rose-100 text-rose-700 border-rose-200"
            : "bg-amber-100 text-amber-700 border-amber-200";

  const activity = [
    ...payments.map((p: any, idx: number) => ({
      id: `pay-${idx}`,
      label: `${p.direction === "refund" ? "Refund" : "Payment"} $${((p.amountCents ?? 0) / 100).toFixed(2)}`,
      at: p.createdAt || p.date || reservation.updatedAt
    })),
    ...comms.map((c: any, idx: number) => ({
      id: `comm-${idx}`,
      label: c.subject || c.type || "Message",
      at: c.createdAt || reservation.updatedAt
    }))
  ]
    .filter((a) => !!a.at)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 8);

  return (
    <DashboardShell>
      <div className="space-y-4">
        <Breadcrumbs
          items={[
            { label: "Campgrounds", href: "/campgrounds?all=true" },
            { label: `Campground ${campgroundId}`, href: `/campgrounds/${campgroundId}` },
            { label: "Reservations", href: `/campgrounds/${campgroundId}/reservations` },
            { label: reservationId }
          ]}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{guestName}</h1>
              <div className="text-sm text-slate-500">
                {formatDate(reservation.arrivalDate)} → {formatDate(reservation.departureDate)} • {siteLabel}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={`capitalize border ${statusBadge}`}>{reservation.status?.replace("_", " ") || "pending"}</Badge>
            <Badge variant="secondary" className="border border-slate-200 bg-slate-50 text-slate-800">
              Paid ${paid.toFixed(2)} • Bal ${balance.toFixed(2)}
            </Badge>
            {reservation.status === "confirmed" && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => updateReservation.mutate({ status: "checked_in" })}
                disabled={updateReservation.isPending}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Check in
              </Button>
            )}
            {reservation.status === "checked_in" && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => updateReservation.mutate({ status: "checked_out" })}
                disabled={updateReservation.isPending}
              >
                <DoorOpen className="h-4 w-4 mr-1" />
                Check out
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => window.scrollTo({ top: 600, behavior: "smooth" })}>
              <MessageSquare className="h-4 w-4 mr-1" />
              Message
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Stay details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs text-slate-500">Guest</div>
                <div className="font-medium">{guestName}</div>
                <div className="text-xs text-slate-500">{reservation.guest?.email}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Site</div>
                <div className="font-medium">{siteLabel}</div>
                <div className="text-xs text-slate-500">{(reservation.site as any)?.siteClass?.name || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Dates</div>
                <div className="font-medium">
                  {formatDate(reservation.arrivalDate)} → {formatDate(reservation.departureDate)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Party</div>
                <div className="font-medium">
                  {reservation.adults ?? 0} adults • {reservation.children ?? 0} children
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Notes</div>
                <div className="font-medium whitespace-pre-line">
                  {reservation.notes || "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Occupancy</div>
                <div className="font-medium">
                  {(reservation.adults ?? 0) + (reservation.children ?? 0)} / {(reservation.site as any)?.siteClass?.maxOccupancy || "—"}
                </div>
              </div>
            </CardContent>
          </Card>

          {((reservation as any).seasonalRateId || (chargesQuery.data?.length ?? 0) > 0) && (
            <Card className="md:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="flex items-center gap-2 text-blue-700">
                  <Calculator className="h-4 w-4" />
                  Billing Schedule
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    apiClient.fetchJSON(`/repeat-charges/reservation/${reservationId}/generate`, { method: 'POST' })
                      .then(() => queryClient.invalidateQueries({ queryKey: ["reservation-charges", reservationId] }));
                  }}
                >
                  Regenerate
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {chargesQuery.isLoading ? (
                    <p className="text-slate-500 text-xs py-4 text-center">Loading schedule...</p>
                  ) : chargesQuery.data?.length === 0 ? (
                    <p className="text-slate-500 text-xs italic py-4 text-center border rounded-md">No recurring charges scheduled.</p>
                  ) : (
                    <div className="rounded-md border border-slate-200 overflow-hidden shadow-sm">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase tracking-tight font-semibold">
                          <tr>
                            <th className="px-3 py-2.5">Due Date</th>
                            <th className="px-3 py-2.5">Amount</th>
                            <th className="px-3 py-2.5">Status</th>
                            <th className="px-3 py-2.5 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                          {chargesQuery.data?.map((charge) => (
                            <tr key={charge.id} className="hover:bg-slate-50/50">
                              <td className="px-3 py-2 text-slate-900 font-medium">{formatDate(charge.dueDate)}</td>
                              <td className="px-3 py-2 text-slate-700 font-semibold">${(charge.amount / 100).toFixed(2)}</td>
                              <td className="px-3 py-2">
                                <Badge
                                  className={`text-[10px] px-2 py-0 border capitalize ${charge.status === "paid" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                      charge.status === "failed" ? "bg-rose-50 text-rose-700 border-rose-200" :
                                        "bg-amber-50 text-amber-700 border-amber-200"
                                    }`}
                                  variant="outline"
                                >
                                  {charge.status}
                                </Badge>
                              </td>
                              <td className="px-3 py-2 text-right">
                                {charge.status !== "paid" && (
                                  <Button size="xs" variant="secondary" className="h-7" onClick={() => {
                                    apiClient.fetchJSON(`/repeat-charges/${charge.id}/process`, { method: 'POST' })
                                      .then(() => {
                                        queryClient.invalidateQueries({ queryKey: ["reservation-charges", reservationId] });
                                        queryClient.invalidateQueries({ queryKey: ["reservation", reservationId] });
                                      });
                                  }}>Process</Button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-600" />
                Payments
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Deposit</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${paid >= requiredDeposit
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                    }`}
                >
                  {paid >= requiredDeposit ? "Deposit covered" : `Deposit due $${Math.max(0, requiredDeposit - paid).toFixed(2)}`}
                </span>
              </div>
              {requiredDeposit > 0 && paid < requiredDeposit && (
                <div className="flex">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => router.push(`/campgrounds/${campgroundId}/reservations/${reservation.id}`)}
                  >
                    Collect deposit
                  </Button>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span>Total</span>
                <span className="font-semibold">${(reservation.totalAmount / 100).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Paid</span>
                <span className="text-emerald-700 font-semibold">
                  ${((reservation.paidAmount ?? 0) / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Balance</span>
                <span className="text-slate-900 font-semibold">
                  ${(((reservation as any).balanceAmount ?? Math.max(0, reservation.totalAmount - (reservation.paidAmount ?? 0))) / 100).toFixed(2)}
                </span>
              </div>
              <div className="h-px bg-slate-200 my-2" />
              <div className="space-y-1 max-h-48 overflow-auto pr-1">
                {payments.length === 0 && <div className="text-slate-500 text-xs">No payments yet.</div>}
                {payments.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between text-xs border border-slate-200 rounded px-2 py-1">
                    <span className="capitalize">{p.direction}</span>
                    <span className={p.direction === "refund" ? "text-red-600" : "text-emerald-700"}>
                      ${((p.amountCents ?? 0) / 100).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => router.push(`/campgrounds/${campgroundId}/reservations`)}>
                  Manage
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => router.push(`/campgrounds/${campgroundId}/sites/${reservation.siteId}`)}
                >
                  Site
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => router.push(`/guests/${reservation.guestId}`)}
                >
                  Guest
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span>Signatures & COI</span>
                {signaturesQuery.isFetching && <span className="text-xs text-slate-500">Refreshing…</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Policy agreements</div>
                {policyRequests.length === 0 && (
                  <div className="text-xs text-slate-500">No policy signature requests yet.</div>
                )}
                {policyRequests.map((req: any) => {
                  const meta = getRequestMetadata(req);
                  const policyName = req.template?.name ?? meta?.policyName ?? req.subject ?? "Policy";
                  const enforcement = meta?.enforcement ?? req.template?.policyConfig?.enforcement ?? "post_booking";
                  const enforcementLabel =
                    enforcement === "pre_booking"
                      ? "Required before booking"
                      : enforcement === "pre_checkin"
                        ? "Required before check-in"
                        : enforcement === "post_booking"
                          ? "Sent after booking"
                          : "Information only";
                  const statusDetail = req.signedAt
                    ? `Signed ${formatDateTime(req.signedAt)}`
                    : req.sentAt
                      ? `Sent ${formatDateTime(req.sentAt)}`
                      : "Draft";
                  const canSignNow = req.token && !["signed", "declined", "voided"].includes(req.status);
                  const hasPdf = Boolean(req.artifact?.pdfUrl);
                  return (
                    <div key={req.id} className="flex flex-col gap-2 rounded border border-slate-200 p-2 md:flex-row md:items-center md:justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{policyName}</span>
                          <Badge variant="outline">{req.status}</Badge>
                        </div>
                        <div className="text-xs text-slate-500">
                          {enforcementLabel} • {statusDetail}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {canSignNow && (
                          <a
                            href={`/sign/${req.token}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Sign now
                          </a>
                        )}
                        {hasPdf ? (
                          <a
                            href={req.artifact.pdfUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Download PDF
                          </a>
                        ) : (
                          <Button size="sm" variant="outline" disabled>
                            {req.status === "signed" ? "Signed" : "Awaiting signature"}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                  <Input
                    placeholder="Recipient email"
                    value={signatureEmail || reservation.guest?.email || ""}
                    onChange={(e) => setSignatureEmail(e.target.value)}
                  />
                  <select
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                    value={signatureType}
                    onChange={(e) => setSignatureType(e.target.value)}
                  >
                    <option value="long_term_stay">Long-term stay</option>
                    <option value="park_rules">Park rules</option>
                    <option value="deposit">Deposit/fees</option>
                    <option value="waiver">Waiver</option>
                    <option value="coi">COI acknowledgement</option>
                    <option value="other">Other</option>
                  </select>
                  <select
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                    value={deliveryChannel}
                    onChange={(e) => setDeliveryChannel(e.target.value as any)}
                  >
                    <option value="email">Email</option>
                    <option value="email_and_sms">Email + SMS fallback</option>
                    <option value="sms">SMS only</option>
                  </select>
                  <Button
                    size="sm"
                    className="w-full md:w-auto"
                    onClick={() => createSignatureMutation.mutate()}
                    disabled={createSignatureMutation.status === "pending"}
                  >
                    {createSignatureMutation.status === "pending" ? "Sending…" : "Send signature request"}
                  </Button>
                </div>
                <p className="text-xs text-slate-500">
                  Email-first delivery with optional SMS fallback. Links expire based on the request’s configured expiry.
                </p>
              </div>

              <div className="space-y-2">
                {otherSignatureRequests.length === 0 && <div className="text-xs text-slate-500">No additional signature requests yet.</div>}
                {otherSignatureRequests.map((req: any) => (
                  <div key={req.id} className="flex flex-col gap-2 rounded border border-slate-200 p-2 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium capitalize">{(req.documentType || "long_term_stay").replace(/_/g, " ")}</span>
                        <Badge variant="outline">{req.status}</Badge>
                      </div>
                      <div className="text-xs text-slate-500">
                        Sent to {req.recipientEmail || "n/a"} {req.sentAt ? ` • ${formatDateTime(req.sentAt)}` : ""}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => resendSignatureMutation.mutate(req.id)}
                        disabled={resendSignatureMutation.status === "pending" || ["signed", "declined", "voided"].includes(req.status)}
                      >
                        Resend
                      </Button>
                      {req.artifact?.pdfUrl ? (
                        <a
                          href={req.artifact.pdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Download PDF
                        </a>
                      ) : (
                        <Button size="sm" variant="outline" disabled>
                          Awaiting signature
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2 border-t border-slate-200 pt-3">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                  <Input placeholder="COI file URL" value={coiUrl} onChange={(e) => setCoiUrl(e.target.value)} />
                  <Input
                    type="date"
                    placeholder="Expiry"
                    value={coiExpiresAt}
                    onChange={(e) => setCoiExpiresAt(e.target.value)}
                  />
                  <Button size="sm" variant="outline" onClick={() => coiUploadMutation.mutate()}>
                    Save COI
                  </Button>
                </div>
                <p className="text-xs text-slate-500">
                  Store certificates of insurance with expiry reminders. Reminders are sent before expiry automatically.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Self Check-in Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                Check-in Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {checkinStatusQuery.isLoading ? (
                <div className="text-slate-500 text-xs">Loading...</div>
              ) : checkinStatus ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Check-in</span>
                    <Badge
                      variant="outline"
                      className={
                        checkinStatus.checkInStatus === "completed"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : checkinStatus.checkInStatus === "failed"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                      }
                    >
                      {checkinStatus.checkInStatus?.replace("_", " ") || "not started"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Check-out</span>
                    <Badge
                      variant="outline"
                      className={
                        checkinStatus.checkOutStatus === "completed"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : checkinStatus.checkOutStatus === "failed"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-slate-50 text-slate-600 border-slate-200"
                      }
                    >
                      {checkinStatus.checkOutStatus?.replace("_", " ") || "not started"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Site ready</span>
                    {checkinStatus.siteReady ? (
                      <span className="flex items-center gap-1 text-emerald-700 text-xs">
                        <CheckCircle className="h-3 w-3" /> Ready
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-600 text-xs">
                        <Clock className="h-3 w-3" /> Pending
                      </span>
                    )}
                  </div>
                  {checkinStatus.idVerificationRequired && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">ID verified</span>
                      <span className="text-amber-600 text-xs">Required</span>
                    </div>
                  )}
                  {checkinStatus.waiverRequired && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Waiver signed</span>
                      <span className="text-amber-600 text-xs">Required</span>
                    </div>
                  )}
                  {checkinStatus.lateArrivalFlag && (
                    <div className="flex items-center gap-1 text-amber-600 text-xs mt-2">
                      <AlertTriangle className="h-3 w-3" /> Late arrival
                    </div>
                  )}
                  {checkinStatus.selfCheckInAt && (
                    <div className="text-xs text-slate-500 mt-2">
                      Checked in: {formatDateTime(checkinStatus.selfCheckInAt)}
                    </div>
                  )}
                  {checkinStatus.selfCheckOutAt && (
                    <div className="text-xs text-slate-500">
                      Checked out: {formatDateTime(checkinStatus.selfCheckOutAt)}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-slate-500 text-xs">No check-in data available.</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DoorOpen className="h-4 w-4 text-emerald-600" />
                Vehicle & Access Control
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-600">License plate</Label>
                  <Input
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                    placeholder="ABC123"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-600">State</Label>
                  <Input
                    value={vehicleState}
                    onChange={(e) => setVehicleState(e.target.value.toUpperCase())}
                    placeholder="CA"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-600">Rig type</Label>
                  <Input
                    value={vehicleRigType}
                    onChange={(e) => setVehicleRigType(e.target.value)}
                    placeholder="RV / trailer / car"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-600">Rig length (ft)</Label>
                  <Input
                    type="number"
                    value={vehicleRigLength}
                    onChange={(e) => setVehicleRigLength(e.target.value)}
                    placeholder="30"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    vehicleMutation.mutate({
                      plate: vehiclePlate || undefined,
                      state: vehicleState || undefined,
                      rigType: vehicleRigType || undefined,
                      rigLength: vehicleRigLength ? Number(vehicleRigLength) : undefined
                    })
                  }
                  disabled={vehicleMutation.isPending}
                >
                  {vehicleMutation.isPending ? "Saving…" : "Save vehicle"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAccessCode(vehiclePlate || reservation.vehiclePlate || accessCode)}
                >
                  Use plate as code
                </Button>
              </div>

              <div className="border-t border-slate-200 pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Gate / lock credential</div>
                    <div className="text-xs text-slate-500">Send, view status, resend, or revoke</div>
                  </div>
                  <select
                    value={accessProvider}
                    onChange={(e) => setAccessProvider(e.target.value as any)}
                    className="text-sm border border-slate-200 rounded px-2 py-1"
                  >
                    <option value="kisi">Kisi</option>
                    <option value="brivo">Brivo</option>
                    <option value="cloudkey">CloudKey</option>
                  </select>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-600">Credential (PIN / RFID / QR)</Label>
                    <Input
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value)}
                      placeholder="Code or token"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        grantAccessMutation.mutate({
                          provider: accessProvider,
                          credentialType: "pin",
                          credentialValue: accessCode || vehiclePlate || reservation.vehiclePlate || undefined,
                          idempotencyKey: `grant-${accessProvider}-${reservationId}-${accessCode || "default"}`
                        })
                      }
                      disabled={grantAccessMutation.isPending}
                    >
                      {grantAccessMutation.isPending ? "Sending…" : "Send / resend"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        revokeAccessMutation.mutate({
                          provider: accessProvider,
                          providerAccessId: accessStatus?.grants?.find((g: any) => g.provider === accessProvider)?.providerAccessId
                        })
                      }
                      disabled={revokeAccessMutation.isPending}
                    >
                      {revokeAccessMutation.isPending ? "Revoking…" : "Revoke"}
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  {(accessStatus?.grants ?? []).length === 0 && (
                    <div className="text-xs text-slate-500">No access grants yet.</div>
                  )}
                  {(accessStatus?.grants ?? []).map((g: any) => (
                    <div
                      key={g.id}
                      className="flex items-center justify-between rounded border border-slate-200 px-2 py-1 text-xs"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium capitalize">{g.provider}</span>
                        <span className="text-slate-500">{g.providerAccessId || "pending"}</span>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          g.status === "active"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : g.status === "blocked" || g.status === "revoked"
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                        }
                      >
                        {g.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-slate-600" />
                Communications
              </CardTitle>
              <div className="flex gap-2 items-center">
                <div className="flex gap-1">
                  {(["all", "messages", "notes", "failed"] as const).map((f) => (
                    <button
                      key={f}
                      className={`rounded-full border px-2 py-1 text-[11px] ${commsFilter === f ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-600"}`}
                      onClick={() => setCommsFilter(f)}
                    >
                      {f === "failed" ? "Failed" : f === "messages" ? "Messages" : f[0].toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs"
                  onClick={() => setCommsFilter("failed")}
                >
                  Failed only
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs"
                  onClick={() => {
                    localStorage.setItem("campreserv:openReservationId", reservation.id);
                    router.push("/messages");
                  }}
                >
                  View all
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {commsQuery.isError && <div className="text-xs text-rose-700">Failed to load messages.</div>}
              {commsQuery.isLoading && <div className="text-xs text-slate-500">Loading…</div>}
              {!commsQuery.isLoading && !commsQuery.error && (!comms?.length) && (
                <div className="text-xs text-slate-500">No messages yet.</div>
              )}
              {comms && comms.length > 0 && (
                <div className="space-y-1">
                  {comms
                    .filter((c: any) => {
                      if (commsFilter === "notes") return (c.type || "").toLowerCase() === "note";
                      if (commsFilter === "messages") return (c.type || "").toLowerCase() !== "note";
                      if (commsFilter === "failed") {
                        const s = (c.status || "").toLowerCase();
                        return s.includes("fail") || s.includes("bounce") || s.includes("error");
                      }
                      return true;
                    })
                    .slice(0, 5)
                    .map((c: any) => (
                      <div key={c.id} className="flex items-center justify-between rounded border border-slate-200 px-2 py-1">
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-slate-900 truncate">{c.subject || c.type || "Message"}</span>
                          <span className="text-[11px] text-slate-500 truncate">
                            {c.createdAt ? new Date(c.createdAt).toLocaleString() : ""}
                          </span>
                        </div>
                        <span
                          className={`text-[11px] uppercase px-2 py-0.5 rounded-full ${(c.status || "").toLowerCase().includes("fail") || (c.status || "").toLowerCase().includes("bounce")
                            ? "bg-rose-100 text-rose-700 border border-rose-200"
                            : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                            }`}
                        >
                          {(c.status || "").toString()}
                        </span>
                      </div>
                    ))}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => {
                    localStorage.setItem("campreserv:openReservationId", reservation.id);
                    router.push("/messages");
                  }}
                >
                  Message guest
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => router.push(`/campgrounds/${campgroundId}/reservations/${reservation.id}`)}
                >
                  Open in Reservations
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ActivitySquare className="h-4 w-4 text-blue-600" />
                Recent activity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {activity.length === 0 && <div className="text-xs text-slate-500">No recent activity.</div>}
              {activity.length > 0 && (
                <div className="space-y-1">
                  {activity.map((a) => (
                    <div key={a.id} className="flex items-center justify-between rounded border border-slate-200 px-2 py-1">
                      <span className="truncate">{a.label}</span>
                      <span className="text-[11px] text-slate-500">{formatDateTime(a.at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                Forms
              </CardTitle>
              {formsQuery.isLoading ? (
                <span className="text-xs text-slate-500">Loading…</span>
              ) : (
                <Badge variant={pendingForms > 0 ? "destructive" : "secondary"}>
                  {pendingForms > 0 ? `${pendingForms} pending` : "All complete"}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {formsQuery.isError && <div className="text-red-600 text-xs">Failed to load forms.</div>}
              {!formsQuery.isLoading && (formsQuery.data || []).length === 0 && (
                <div className="text-slate-500 text-xs">No forms attached.</div>
              )}
              <div className="space-y-1">
                {(formsQuery.data || []).map((f: any) => (
                  <div key={f.id} className="flex items-center justify-between rounded border border-slate-200 px-2 py-1">
                    <div>
                      <div className="font-medium text-slate-900 text-sm">{f.formTemplate?.title || "Form"}</div>
                      <div className="text-xs text-slate-500">{f.formTemplate?.type}</div>
                    </div>
                    <Badge variant={f.status === "completed" ? "default" : f.status === "pending" ? "destructive" : "secondary"}>
                      {f.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="md:col-span-3">
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-700" />
                Related reservations
              </CardTitle>
              {relatedQuery.isLoading && <span className="text-xs text-slate-500">Loading…</span>}
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {relatedQuery.isError && <div className="text-red-600 text-xs">Failed to load related reservations.</div>}
              {!relatedQuery.isLoading && related.length === 0 && <div className="text-slate-500 text-xs">No other stays for this guest.</div>}
              <div className="space-y-2">
                {related.map((r: any) => (
                  <div key={r.id} className="flex flex-wrap items-center gap-2 rounded border border-slate-200 px-3 py-2">
                    <span className="rounded-full border px-2 py-0.5 text-[11px]">
                      {formatDate(r.arrivalDate)} → {formatDate(r.departureDate)}
                    </span>
                    <span className="text-slate-800">{r.site?.name || r.site?.siteNumber || r.siteId}</span>
                    <Badge variant="outline" className={`capitalize border ${r.status === "confirmed"
                      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                      : r.status === "checked_in"
                        ? "bg-blue-100 text-blue-700 border-blue-200"
                        : r.status === "checked_out"
                          ? "bg-slate-100 text-slate-700 border-slate-200"
                          : r.status === "cancelled"
                            ? "bg-rose-100 text-rose-700 border-rose-200"
                            : "bg-amber-100 text-amber-700 border-amber-200"
                      }`}>
                      {r.status.replace("_", " ")}
                    </Badge>
                    <Button size="sm" variant="ghost" onClick={() => router.push(`/campgrounds/${campgroundId}/reservations/${r.id}`)}>
                      Open
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-slate-600" />
                <CardTitle>Pricing breakdown</CardTitle>
              </div>
              {quoteQuery.isLoading && <span className="text-xs text-slate-500">Loading…</span>}
              {quoteQuery.isError && <span className="text-xs text-red-500">Failed to load</span>}
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span>Base subtotal</span>
                <span className="font-medium">${((quote?.baseSubtotalCents ?? 0) / 100).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Rules delta</span>
                <span className="font-medium">${((quote?.rulesDeltaCents ?? 0) / 100).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Nights</span>
                <span className="font-medium">{quote?.nights ?? "—"}</span>
              </div>
              <div className="h-px bg-slate-200" />
              <div className="flex items-center justify-between">
                <span>Total (quoted)</span>
                <span className="font-semibold">
                  ${((quote?.totalCents ?? reservation.totalAmount) / 100).toFixed(2)}
                </span>
              </div>
              <div className="text-xs text-slate-500">
                Quoted using current rules; amounts on this reservation may include fees/taxes/discounts already applied.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-slate-600" />
                <CardTitle>Communications</CardTitle>
              </div>
              {commsQuery.isLoading && <span className="text-xs text-slate-500">Loading…</span>}
              {commsQuery.isError && <span className="text-xs text-red-500">Failed to load</span>}
            </CardHeader>
            <CardContent className="space-y-2 max-h-72 overflow-auto pr-1 text-sm">
              {(!comms || comms.length === 0) && (
                <div className="text-slate-500 text-xs">No communications yet.</div>
              )}
              {comms?.map((c: any) => (
                <div key={c.id} className="rounded border border-slate-200 px-3 py-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="uppercase">{c.type}</span>
                    <span>{c.direction}</span>
                  </div>
                  {c.subject && <div className="text-sm font-medium text-slate-900">{c.subject}</div>}
                  {c.preview && <div className="text-sm text-slate-700 line-clamp-2">{c.preview}</div>}
                  {!c.preview && c.body && <div className="text-sm text-slate-700 line-clamp-2">{c.body}</div>}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-slate-600" />
                <CardTitle>Other available sites</CardTitle>
              </div>
              {availabilityQuery.isLoading && <span className="text-xs text-slate-500">Checking…</span>}
              {availabilityQuery.isError && <span className="text-xs text-red-500">Failed to load</span>}
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {!availabilityQuery.data && !availabilityQuery.isLoading && !availabilityQuery.isError && (
                <div className="text-xs text-slate-500">No availability data.</div>
              )}
              {availabilityQuery.data?.filter((s) => s.id !== reservation.siteId).slice(0, 6).map((site) => (
                <div key={site.id} className="flex items-center justify-between rounded border border-slate-200 px-2 py-1.5">
                  <div className="flex flex-col">
                    <span className="font-medium">{site.name || `Site #${site.siteNumber}`}</span>
                    <span className="text-xs text-slate-500">{site.siteClass?.name ?? "Unassigned class"}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Nightly</div>
                    <div className="font-semibold">${((site.siteClass?.defaultRate ?? 0) / 100).toFixed(2)}</div>
                  </div>
                </div>
              ))}
              {availabilityQuery.data && availabilityQuery.data.filter((s) => s.id !== reservation.siteId).length === 0 && (
                <div className="text-xs text-slate-500">No alternate sites for these dates.</div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex items-center gap-2">
              <ActivitySquare className="h-4 w-4 text-slate-600" />
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span>Status</span>
                <Badge variant="outline" className="capitalize">{reservation.status?.replace("_", " ") || "pending"}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Created</span>
                <span className="font-medium">{formatDateTime((reservation as any).createdAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Updated</span>
                <span className="font-medium">{formatDateTime((reservation as any).updatedAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Checked in</span>
                <span className="font-medium">{formatDateTime((reservation as any).checkInAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Checked out</span>
                <span className="font-medium">{formatDateTime((reservation as any).checkOutAt)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
