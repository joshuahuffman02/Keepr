"use client";

import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { DashboardShell } from "../../../../../components/ui/layout/DashboardShell";
import { apiClient } from "../../../../../lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../../components/ui/card";
import { Badge } from "../../../../../components/ui/badge";
import { Button } from "../../../../../components/ui/button";
import { Input } from "../../../../../components/ui/input";
import { Label } from "../../../../../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../../components/ui/tabs";
import { format } from "date-fns";
import {
  DollarSign,
  ArrowLeft,
  MessageSquare,
  Calculator,
  MapPin,
  CheckCircle,
  DoorOpen,
  Users,
  AlertTriangle,
  Clock,
  ShieldCheck,
  ClipboardList,
  Tent,
  Loader2,
  CreditCard,
  Calendar,
  User,
  FileText,
  History,
  ChevronDown,
  ChevronUp,
  Send,
  RefreshCw,
  Check,
  X,
  Sparkles,
  PartyPopper
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "../../../../../components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "../../../../../components/ui/alert-dialog";
import { Switch } from "../../../../../components/ui/switch";
import { AuditLogTimeline } from "../../../../../components/audit/AuditLogTimeline";
import { ReservationFormsCard } from "../../../../../components/reservations/ReservationFormsCard";
import { PaymentCollectionModal } from "../../../../../components/payments/PaymentCollectionModal";
import { cn } from "../../../../../lib/utils";
import { motion, AnimatePresence } from "framer-motion";

function formatDate(d?: string | Date | null) {
  if (!d) return "--";
  const date = typeof d === "string" ? new Date(d) : d;
  return isNaN(date.getTime()) ? "--" : format(date, "MMM d, yyyy");
}

function formatDateTime(d?: string | Date | null) {
  if (!d) return "--";
  const date = typeof d === "string" ? new Date(d) : d;
  return isNaN(date.getTime()) ? "--" : format(date, "MMM d, yyyy h:mma");
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

type ReservationWithExtras = {
  id: string;
  campgroundId: string;
  siteId: string;
  guestId: string;
  arrivalDate: string;
  departureDate: string;
  status: string;
  totalAmount: number;
  paidAmount: number;
  adults?: number | null;
  children?: number | null;
  notes?: string | null;
  vehiclePlate?: string | null;
  vehicleState?: string | null;
  rigType?: string | null;
  rigLength?: number | null;
  guest?: {
    id?: string;
    primaryFirstName: string;
    primaryLastName: string;
    email?: string;
    phone?: string;
  } | null;
  site?: {
    name?: string | null;
    siteNumber?: string | null;
    siteClass?: {
      name?: string;
      maxOccupancy?: number;
    } | null;
  } | null;
  payments?: Array<{
    id: string;
    amountCents: number;
    direction: string;
    method?: string;
    createdAt?: string;
    date?: string;
  }>;
  balanceAmount?: number;
  createdAt?: string;
  updatedAt?: string;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  seasonalGuestId?: string | null;
  seasonalRateId?: string | null;
};

export default function ReservationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const reservationId = params.reservationId as string;
  const campgroundId = params.campgroundId as string;

  // Payment modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  // Check-in celebration state
  const [showCheckInSuccess, setShowCheckInSuccess] = useState(false);
  const [showCheckOutSuccess, setShowCheckOutSuccess] = useState(false);

  // Vehicle form state
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehicleState, setVehicleState] = useState("");
  const [vehicleRigType, setVehicleRigType] = useState("");
  const [vehicleRigLength, setVehicleRigLength] = useState("");

  // Access control state
  const [accessProvider, setAccessProvider] = useState<"kisi" | "brivo" | "cloudkey">("kisi");
  const [accessCode, setAccessCode] = useState("");

  // Signature state
  const [signatureEmail, setSignatureEmail] = useState("");
  const [signatureType, setSignatureType] = useState("long_term_stay");
  const [deliveryChannel, setDeliveryChannel] = useState<"email" | "email_and_sms" | "sms">("email");

  // COI state
  const [coiUrl, setCoiUrl] = useState("");
  const [coiExpiresAt, setCoiExpiresAt] = useState("");

  // Convert to Seasonal state
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertIsMetered, setConvertIsMetered] = useState(false);
  const [convertPaysInFull, setConvertPaysInFull] = useState(false);

  // Collapsible sections
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Queries
  const reservationQuery = useQuery({
    queryKey: ["reservation", reservationId],
    queryFn: () => apiClient.getReservation(reservationId),
    enabled: !!reservationId
  });
  const reservation = reservationQuery.data as ReservationWithExtras | undefined;

  const checkinStatusQuery = useQuery({
    queryKey: ["checkin-status", reservationId],
    queryFn: () => apiClient.getCheckinStatus(reservationId),
    enabled: !!reservationId
  });
  const checkinStatus = checkinStatusQuery.data;

  const accessQuery = useQuery({
    queryKey: ["access-status", reservationId],
    queryFn: () => apiClient.getAccessStatus(reservationId, campgroundId),
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
        guestId: reservation?.guestId,
        limit: 30
      }),
    enabled: !!reservationId && !!campgroundId
  });

  const chargesQuery = useQuery({
    queryKey: ["reservation-charges", reservationId],
    queryFn: () => apiClient.getRepeatChargesByReservation(reservationId, campgroundId),
    enabled: !!reservationId && !!campgroundId
  });

  const relatedQuery = useQuery({
    queryKey: ["related-reservations", campgroundId, reservation?.guestId],
    queryFn: () => apiClient.getReservations(campgroundId),
    enabled: !!campgroundId && !!reservation?.guestId
  });

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

  // Mutations
  const updateReservation = useMutation({
    mutationFn: (data: Parameters<typeof apiClient.updateReservation>[1]) =>
      apiClient.updateReservation(reservationId, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["reservation", reservationId] });
      queryClient.invalidateQueries({ queryKey: ["reservations", campgroundId] });

      if (variables.status === "checked_in") {
        setShowCheckInSuccess(true);
        setTimeout(() => setShowCheckInSuccess(false), 4000);
      }
      if (variables.status === "checked_out") {
        setShowCheckOutSuccess(true);
        if (reservation?.siteId) {
          apiClient.updateSiteHousekeeping(reservation.siteId, "dirty").catch(console.error);
        }
        setTimeout(() => setShowCheckOutSuccess(false), 4000);
      }
    }
  });

  const vehicleMutation = useMutation({
    mutationFn: (payload: { plate?: string; state?: string; rigType?: string; rigLength?: number }) =>
      apiClient.upsertVehicle(reservationId, payload, campgroundId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-status", reservationId] });
      queryClient.invalidateQueries({ queryKey: ["reservation", reservationId] });
    }
  });

  const grantAccessMutation = useMutation({
    mutationFn: (payload: { provider: string; credentialType: string; credentialValue?: string; idempotencyKey: string }) =>
      apiClient.grantAccess(reservationId, payload, campgroundId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-status", reservationId] });
    }
  });

  const revokeAccessMutation = useMutation({
    mutationFn: (payload: { provider: string; providerAccessId?: string }) =>
      apiClient.revokeAccess(reservationId, payload, campgroundId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-status", reservationId] });
    }
  });

  const createSignatureMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        campgroundId,
        reservationId,
        documentType: signatureType,
        recipientEmail: signatureEmail || reservation?.guest?.email,
        deliveryChannel,
        message: "Please review and sign the documents.",
        recipientName: reservation?.guest
          ? `${reservation.guest.primaryFirstName} ${reservation.guest.primaryLastName}`
          : undefined
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

  const convertToSeasonalMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/seasonals/convert-from-reservation/${reservationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          isMetered: convertIsMetered,
          paysInFull: convertPaysInFull,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to convert to seasonal");
      }
      return res.json();
    },
    onSuccess: () => {
      setShowConvertModal(false);
      queryClient.invalidateQueries({ queryKey: ["reservation", reservationId] });
      router.push(`/campgrounds/${campgroundId}/seasonals`);
    },
  });

  // Initialize form values from reservation
  useEffect(() => {
    if (reservation) {
      setVehiclePlate(reservation.vehiclePlate || accessStatus?.vehicle?.plate || "");
      setVehicleState(reservation.vehicleState || accessStatus?.vehicle?.state || "");
      setVehicleRigType(reservation.rigType || accessStatus?.vehicle?.rigType || "");
      setVehicleRigLength(
        reservation.rigLength != null
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

  // Loading state
  if (reservationQuery.isLoading) {
    return (
      <DashboardShell>
        <div className="flex h-80 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardShell>
    );
  }

  // Not found state
  if (!reservation) {
    return (
      <DashboardShell>
        <div className="flex h-80 flex-col items-center justify-center gap-4 text-muted-foreground">
          <div>Reservation not found</div>
          <Button onClick={() => router.push(`/campgrounds/${campgroundId}/reservations`)}>
            Back to list
          </Button>
        </div>
      </DashboardShell>
    );
  }

  // Computed values
  const guestName = reservation.guest
    ? `${reservation.guest.primaryFirstName} ${reservation.guest.primaryLastName}`
    : "Guest";
  const siteLabel = reservation.site
    ? `${reservation.site.name || ""} ${reservation.site.siteNumber ? `#${reservation.site.siteNumber}` : ""}`.trim()
    : "Site";
  const siteClassName = reservation.site?.siteClass?.name || "";

  const payments = reservation.payments || [];
  const quote = quoteQuery.data;
  const comms = commsQuery.data?.items || [];
  const signatureRequests = Array.isArray(signaturesQuery.data) ? signaturesQuery.data : [];

  // Calculate in cents first to avoid floating-point precision issues
  const totalCents = Math.round(Number(reservation.totalAmount) || 0);
  const paidCents = Math.round(Number(reservation.paidAmount) || 0);
  const balanceCents = Math.max(0, totalCents - paidCents);
  const total = totalCents / 100;
  const paid = paidCents / 100;
  const balance = balanceCents / 100;
  const nights = quote?.nights ?? Math.ceil(
    (new Date(reservation.departureDate).getTime() - new Date(reservation.arrivalDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  const related = (relatedQuery.data || [])
    .filter((r: any) => r.id !== reservationId && r.guestId === reservation.guestId)
    .slice(0, 5);

  const statusConfig: Record<string, { bg: string; text: string; border: string }> = {
    confirmed: { bg: "bg-status-success/15", text: "text-status-success", border: "border-status-success/20" },
    checked_in: { bg: "bg-status-info/15", text: "text-status-info", border: "border-status-info/20" },
    checked_out: { bg: "bg-muted", text: "text-muted-foreground", border: "border-border" },
    cancelled: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
    pending: { bg: "bg-status-warning/15", text: "text-status-warning", border: "border-status-warning/20" }
  };
  const status = statusConfig[reservation.status] || statusConfig.pending;

  return (
    <DashboardShell>
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* STICKY HEADER - Always visible with key info and actions */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <div className="sticky top-0 z-40 -mx-4 -mt-4 mb-6 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: Back button + Guest info */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-foreground truncate">{guestName}</h1>
                <Badge className={cn("capitalize", status.bg, status.text, status.border)}>
                  {reservation.status?.replace("_", " ") || "pending"}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                <span>{formatDate(reservation.arrivalDate)} - {formatDate(reservation.departureDate)}</span>
                <span className="text-muted-foreground/60">|</span>
                <span>{siteLabel}</span>
                {siteClassName && (
                  <>
                    <span className="text-muted-foreground/60">|</span>
                    <span>{siteClassName}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right: Balance + Actions */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Balance indicator - prominent when balance > 0 */}
            {balance > 0 ? (
              <button
                onClick={() => setPaymentModalOpen(true)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg transition-all",
                  "bg-status-warning/10 border border-status-warning/40",
                  "hover:border-status-warning/60 hover:shadow-sm cursor-pointer group"
                )}
              >
                <DollarSign className="h-5 w-5 text-status-warning group-hover:scale-110 transition-transform" />
                <div className="text-left">
                  <div className="text-xs text-status-warning font-medium">Balance Due</div>
                  <div className="text-lg font-bold text-status-warning-text">{formatCurrency(balanceCents)}</div>
                </div>
              </button>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-status-success/10 border border-status-success/30">
                <CheckCircle className="h-5 w-5 text-status-success" />
                <div className="text-left">
                  <div className="text-xs text-status-success font-medium">Paid in Full</div>
                  <div className="text-lg font-bold text-status-success-text">{formatCurrency(total * 100)}</div>
                </div>
              </div>
            )}

            {/* Primary action buttons */}
            {reservation.status === "confirmed" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Check In
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-status-info/15 flex items-center justify-center">
                        <CheckCircle className="h-5 w-5 text-status-info" />
                      </div>
                      Ready to check in {guestName}?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="sr-only">
                      Confirm check-in for {guestName}
                    </AlertDialogDescription>
                    <div className="space-y-3">
                      <div className="rounded-lg border border-border bg-muted p-3">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          <span>{siteLabel}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                          <Calendar className="h-4 w-4" />
                          <span>{formatDate(reservation.arrivalDate)} - {formatDate(reservation.departureDate)}</span>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div className="flex items-center gap-2">
                          <Check className="h-3 w-3 text-emerald-600" />
                          <span>Access credentials will be activated</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="h-3 w-3 text-emerald-600" />
                          <span>Welcome message will be sent</span>
                        </div>
                        {balance > 0 && (
                          <div className="flex items-center gap-2 text-amber-600">
                            <AlertTriangle className="h-3 w-3" />
                            <span>Outstanding balance: {formatCurrency(balanceCents)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => updateReservation.mutate({ status: "checked_in" })}
                      className="bg-blue-600 hover:bg-blue-700"
                      disabled={updateReservation.isPending}
                    >
                      {updateReservation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Yes, Check In
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {reservation.status === "checked_in" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="lg" variant="secondary">
                    <DoorOpen className="h-4 w-4 mr-2" />
                    Check Out
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                        <DoorOpen className="h-5 w-5 text-muted-foreground" />
                      </div>
                      Check out {guestName}?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="sr-only">
                      Confirm check-out for {guestName}
                    </AlertDialogDescription>
                    <div className="space-y-3">
                      {balance > 0 && (
                        <div className="rounded-lg border-2 border-status-warning/30 bg-status-warning/15 p-3">
                          <div className="flex items-center gap-2 text-status-warning font-medium">
                            <AlertTriangle className="h-4 w-4" />
                            <span>Outstanding balance: {formatCurrency(balanceCents)}</span>
                          </div>
                          <p className="text-sm text-status-warning mt-1">
                            Consider collecting payment before check-out.
                          </p>
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div className="flex items-center gap-2">
                          <Check className="h-3 w-3 text-emerald-600" />
                          <span>Access credentials will be deactivated</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="h-3 w-3 text-emerald-600" />
                          <span>Site will be marked for housekeeping</span>
                        </div>
                      </div>
                    </div>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    {balance > 0 && (
                      <Button variant="outline" onClick={() => setPaymentModalOpen(true)}>
                        <CreditCard className="h-4 w-4 mr-2" />
                        Collect Balance First
                      </Button>
                    )}
                    <AlertDialogAction
                      onClick={() => updateReservation.mutate({ status: "checked_out" })}
                      disabled={updateReservation.isPending}
                    >
                      {updateReservation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <DoorOpen className="h-4 w-4 mr-2" />
                      )}
                      Complete Check Out
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            <Button
              variant="outline"
              onClick={() => {
                localStorage.setItem("campreserv:openReservationId", reservation.id);
                router.push("/messages");
              }}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Message
            </Button>

            {balance > 0 && (
              <Button onClick={() => setPaymentModalOpen(true)} className="bg-action-primary hover:bg-action-primary-hover text-action-primary-foreground">
                <CreditCard className="h-4 w-4 mr-2" />
                Collect Payment
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* CHECK-IN SUCCESS CELEBRATION */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showCheckInSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-6 p-6 rounded-xl bg-status-success/10 border border-status-success/30"
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-status-success/15 flex items-center justify-center">
                <PartyPopper className="h-6 w-6 text-status-success" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Welcome!</h3>
                <p className="text-status-success">{guestName} is now checked in to {siteLabel}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCheckOutSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-6 p-6 rounded-xl bg-status-info/10 border border-status-info/30"
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-status-info/15 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-status-info" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Check-out Complete</h3>
                <p className="text-status-info">Site {siteLabel} has been marked for housekeeping</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* TABBED CONTENT */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" className="gap-2">
            <User className="h-4 w-4 hidden sm:inline" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-2">
            <DollarSign className="h-4 w-4 hidden sm:inline" />
            Payments
          </TabsTrigger>
          <TabsTrigger value="communications" className="gap-2">
            <MessageSquare className="h-4 w-4 hidden sm:inline" />
            Comms
          </TabsTrigger>
          <TabsTrigger value="checkin" className="gap-2">
            <ShieldCheck className="h-4 w-4 hidden sm:inline" />
            Check-in
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4 hidden sm:inline" />
            History
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB: OVERVIEW */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Stay Details - 2/3 width */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-muted-foreground" />
                  Stay Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Guest</div>
                    <div className="font-semibold text-foreground">{guestName}</div>
                    <div className="text-sm text-muted-foreground">{reservation.guest?.email || "--"}</div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 text-blue-600"
                      onClick={() => router.push(`/guests/${reservation.guestId}`)}
                    >
                      View Profile
                    </Button>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Site</div>
                    <div className="font-semibold text-foreground">{siteLabel}</div>
                    <div className="text-sm text-muted-foreground">{siteClassName || "Standard"}</div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 text-blue-600"
                      onClick={() => router.push(`/campgrounds/${campgroundId}/sites/${reservation.siteId}`)}
                    >
                      View Site
                    </Button>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dates</div>
                    <div className="font-semibold text-foreground">
                      {formatDate(reservation.arrivalDate)} - {formatDate(reservation.departureDate)}
                    </div>
                    <div className="text-sm text-muted-foreground">{nights} night{nights !== 1 ? "s" : ""}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Party Size</div>
                    <div className="font-semibold text-foreground">
                      {(reservation.adults ?? 0) + (reservation.children ?? 0)} guest{(reservation.adults ?? 0) + (reservation.children ?? 0) !== 1 ? "s" : ""}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {reservation.adults ?? 0} adult{(reservation.adults ?? 0) !== 1 ? "s" : ""}, {reservation.children ?? 0} child{(reservation.children ?? 0) !== 1 ? "ren" : ""}
                    </div>
                  </div>
                  {(vehiclePlate || reservation.vehiclePlate) && (
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Vehicle</div>
                      <div className="font-semibold text-foreground">
                        {vehiclePlate || reservation.vehiclePlate} {vehicleState || reservation.vehicleState}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {vehicleRigType || reservation.rigType || ""}
                        {(vehicleRigLength || reservation.rigLength) ? ` - ${vehicleRigLength || reservation.rigLength}ft` : ""}
                      </div>
                    </div>
                  )}
                  {reservation.notes && (
                    <div className="sm:col-span-2 space-y-1">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes</div>
                      <div className="text-sm text-foreground whitespace-pre-line bg-muted rounded-lg p-3 border border-border">
                        {reservation.notes}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Financial Summary - 1/3 width */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-status-success" />
                    Financial
                  </span>
                  {balance > 0 && (
                    <Badge className="bg-status-warning/15 text-status-warning border border-status-warning/30">
                      {formatCurrency(balanceCents)} due
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Primary action area */}
                <div className={cn(
                  "p-4 rounded-lg border space-y-3",
                  balance > 0
                    ? "bg-status-warning/10 border-status-warning/30"
                    : "bg-status-success/10 border-status-success/30"
                )}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-muted-foreground">
                        {balance > 0 ? "Amount Due" : "Total Paid"}
                      </div>
                      <div className={cn(
                        "text-2xl font-bold",
                        balance > 0 ? "text-status-warning-text" : "text-status-success-text"
                      )}>
                        {formatCurrency(balance > 0 ? balanceCents : total * 100)}
                      </div>
                    </div>
                    {balance > 0 ? (
                      <Button
                        onClick={() => setPaymentModalOpen(true)}
                        className="bg-action-primary hover:bg-action-primary-hover text-action-primary-foreground shadow-sm"
                      >
                        <CreditCard className="h-4 w-4 mr-2" />
                        Collect
                      </Button>
                    ) : (
                      <CheckCircle className="h-8 w-8 text-status-success" />
                    )}
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground pt-2 border-t border-border/60">
                    <span>Total: {formatCurrency(total * 100)}</span>
                    <span>Paid: {formatCurrency(paid * 100)}</span>
                  </div>
                </div>

                {/* Payment count */}
                <div className="text-sm text-muted-foreground">
                  {payments.length} payment{payments.length !== 1 ? "s" : ""} recorded
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Timeline + Related Reservations */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Created</span>
                    <span className="font-medium">{formatDateTime(reservation.createdAt)}</span>
                  </div>
                  {payments.slice(0, 3).map((p, i) => (
                    <div key={p.id} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {p.direction === "refund" ? "Refund" : "Payment"}
                      </span>
                      <span className={cn(
                        "font-medium",
                        p.direction === "refund" ? "text-rose-600" : "text-emerald-600"
                      )}>
                        {formatCurrency(p.amountCents)} - {formatDateTime(p.createdAt || p.date)}
                      </span>
                    </div>
                  ))}
                  {reservation.checkInAt && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Checked in</span>
                      <span className="font-medium text-blue-600">{formatDateTime(reservation.checkInAt)}</span>
                    </div>
                  )}
                  {reservation.checkOutAt && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Checked out</span>
                      <span className="font-medium">{formatDateTime(reservation.checkOutAt)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    Related Stays
                  </span>
                  {related.length > 0 && (
                    <Badge variant="secondary">{related.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {related.length === 0 ? (
                  <p className="text-sm text-muted-foreground">First time guest - no previous stays</p>
                ) : (
                  <div className="space-y-2">
                    {related.map((r: any) => (
                      <button
                        key={r.id}
                        onClick={() => router.push(`/campgrounds/${campgroundId}/reservations/${r.id}`)}
                        className="w-full flex items-center justify-between p-2 rounded-lg border border-border hover:bg-muted transition-colors text-left"
                      >
                        <div>
                          <div className="text-sm font-medium">
                            {formatDate(r.arrivalDate)} - {formatDate(r.departureDate)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {r.site?.name || r.site?.siteNumber || r.siteId}
                          </div>
                        </div>
                        <Badge variant="outline" className="capitalize text-xs">
                          {r.status?.replace("_", " ")}
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Advanced Section (Collapsible) */}
          {((quote?.nights ?? 0) >= 28 || reservation.seasonalGuestId) && (
            <Card>
              <CardHeader>
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full flex items-center justify-between"
                >
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-amber-500" />
                    Advanced Options
                  </CardTitle>
                  {showAdvanced ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>
              </CardHeader>
              <AnimatePresence>
                {showAdvanced && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                  >
                    <CardContent className="space-y-4">
                      {(quote?.nights ?? 0) >= 28 && !reservation.seasonalGuestId && (
                        <div className="flex items-center justify-between p-4 rounded-lg border border-status-warning/20 bg-status-warning/15">
                          <div>
                            <div className="font-medium text-amber-900">Convert to Seasonal</div>
                            <div className="text-sm text-status-warning">
                              This {quote?.nights}-night stay qualifies for seasonal guest management
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            onClick={() => setShowConvertModal(true)}
                            className="border-status-warning/30 text-status-warning hover:bg-status-warning/10"
                          >
                            <Tent className="h-4 w-4 mr-2" />
                            Convert
                          </Button>
                        </div>
                      )}
                      {reservation.seasonalGuestId && (
                        <div className="flex items-center justify-between p-4 rounded-lg border border-status-success/20 bg-status-success/15">
                          <div>
                            <div className="font-medium text-emerald-900">Seasonal Guest</div>
                            <div className="text-sm text-status-success">
                              This reservation is linked to a seasonal guest record
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            onClick={() => router.push(`/campgrounds/${campgroundId}/seasonals`)}
                            className="border-status-success/30 text-status-success hover:bg-status-success/10"
                          >
                            <Tent className="h-4 w-4 mr-2" />
                            View Seasonal
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          )}
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB: PAYMENTS */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="payments" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Payment Management</h2>
            <div className="flex gap-2">
              {balance > 0 && (
                <Button onClick={() => setPaymentModalOpen(true)}>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Collect Payment
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Payment Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Payment Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-semibold">{formatCurrency(total * 100)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Paid</span>
                    <span className="font-semibold text-emerald-600">{formatCurrency(paid * 100)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{ width: `${Math.min(100, (paid / total) * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between pt-2 border-t">
                    <span className="font-medium">Balance</span>
                    <span className={cn(
                      "font-bold text-lg",
                      balance > 0 ? "text-amber-600" : "text-emerald-600"
                    )}>
                      {formatCurrency(balanceCents)}
                    </span>
                  </div>
                </div>

                {balance > 0 && (
                  <Button
                    onClick={() => setPaymentModalOpen(true)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    size="lg"
                  >
                    <CreditCard className="h-5 w-5 mr-2" />
                    Collect {formatCurrency(balanceCents)}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Pricing Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Pricing Breakdown</span>
                  {quoteQuery.isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Base ({nights} nights)</span>
                  <span>{formatCurrency(quote?.baseSubtotalCents ?? 0)}</span>
                </div>
                {(quote?.rulesDeltaCents ?? 0) !== 0 && (
                  <div className="flex justify-between">
                    <span>Adjustments</span>
                    <span>{formatCurrency(quote?.rulesDeltaCents ?? 0)}</span>
                  </div>
                )}
                <div className="h-px bg-muted my-2" />
                <div className="flex justify-between font-medium">
                  <span>Quoted Total</span>
                  <span>{formatCurrency(quote?.totalCents ?? reservation.totalAmount)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payment History */}
          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No payments recorded yet
                </p>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted border-b">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Method</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {payments.map((p) => (
                        <tr key={p.id} className="hover:bg-muted">
                          <td className="px-4 py-3">{formatDateTime(p.createdAt || p.date)}</td>
                          <td className="px-4 py-3 capitalize">{p.method || p.direction}</td>
                          <td className={cn(
                            "px-4 py-3 text-right font-medium",
                            p.direction === "refund" ? "text-rose-600" : "text-emerald-600"
                          )}>
                            {p.direction === "refund" ? "-" : "+"}{formatCurrency(p.amountCents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Billing Schedule (for seasonal/repeat charges) */}
          {(reservation.seasonalRateId || (chargesQuery.data?.length ?? 0) > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-blue-600" />
                    Billing Schedule
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      apiClient.generateRepeatCharges(reservationId, campgroundId)
                        .then(() => queryClient.invalidateQueries({ queryKey: ["reservation-charges", reservationId] }));
                    }}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Regenerate
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {chargesQuery.isLoading ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </div>
                ) : chargesQuery.data?.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No recurring charges scheduled
                  </p>
                ) : (
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted border-b">
                        <tr>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Due Date</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Amount</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                          <th className="text-right px-4 py-3 font-medium text-muted-foreground">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {chargesQuery.data?.map((charge: any) => (
                          <tr key={charge.id} className="hover:bg-muted">
                            <td className="px-4 py-3">{formatDate(charge.dueDate)}</td>
                            <td className="px-4 py-3 font-medium">{formatCurrency(charge.amount)}</td>
                            <td className="px-4 py-3">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "capitalize",
                                  charge.status === "paid" && "bg-status-success/15 text-status-success border-status-success/20",
                                  charge.status === "failed" && "bg-rose-50 text-rose-700 border-rose-200",
                                  charge.status !== "paid" && charge.status !== "failed" && "bg-status-warning/15 text-status-warning border-status-warning/20"
                                )}
                              >
                                {charge.status}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {charge.status !== "paid" && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => {
                                    apiClient.processRepeatCharge(charge.id, campgroundId)
                                      .then(() => {
                                        queryClient.invalidateQueries({ queryKey: ["reservation-charges", reservationId] });
                                        queryClient.invalidateQueries({ queryKey: ["reservation", reservationId] });
                                      });
                                  }}
                                >
                                  Process
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB: COMMUNICATIONS */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="communications" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Guest Communications</h2>
            <Button
              onClick={() => {
                localStorage.setItem("campreserv:openReservationId", reservation.id);
                router.push("/messages");
              }}
            >
              <Send className="h-4 w-4 mr-2" />
              Compose Message
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Message History</CardTitle>
            </CardHeader>
            <CardContent>
              {commsQuery.isLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </div>
              ) : comms.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No messages yet</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => {
                      localStorage.setItem("campreserv:openReservationId", reservation.id);
                      router.push("/messages");
                    }}
                  >
                    Send First Message
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {comms.map((c: any) => (
                    <div
                      key={c.id}
                      className="p-4 rounded-lg border border-border hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="capitalize text-xs">
                            {c.type}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{c.direction}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(c.createdAt)}
                        </span>
                      </div>
                      {c.subject && (
                        <div className="font-medium text-foreground mb-1">{c.subject}</div>
                      )}
                      {(c.preview || c.body) && (
                        <div className="text-sm text-muted-foreground line-clamp-2">
                          {c.preview || c.body}
                        </div>
                      )}
                      <div className="mt-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            (c.status || "").toLowerCase().includes("fail") || (c.status || "").toLowerCase().includes("bounce")
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-status-success/15 text-status-success border-status-success/20"
                          )}
                        >
                          {c.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB: CHECK-IN */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="checkin" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Check-in Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-blue-600" />
                  Check-in Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {checkinStatusQuery.isLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                ) : checkinStatus ? (
                  <>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Check-in</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            checkinStatus.checkInStatus === "completed" && "bg-status-success/15 text-status-success border-status-success/20",
                            checkinStatus.checkInStatus === "failed" && "bg-rose-50 text-rose-700 border-rose-200",
                            checkinStatus.checkInStatus !== "completed" && checkinStatus.checkInStatus !== "failed" && "bg-status-warning/15 text-status-warning border-status-warning/20"
                          )}
                        >
                          {checkinStatus.checkInStatus?.replace("_", " ") || "not started"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Check-out</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            checkinStatus.checkOutStatus === "completed" && "bg-status-success/15 text-status-success border-status-success/20",
                            checkinStatus.checkOutStatus !== "completed" && "bg-muted text-muted-foreground border-border"
                          )}
                        >
                          {checkinStatus.checkOutStatus?.replace("_", " ") || "not started"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Site ready</span>
                        {checkinStatus.siteReady ? (
                          <span className="flex items-center gap-1 text-status-success text-sm">
                            <CheckCircle className="h-4 w-4" /> Ready
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-amber-600 text-sm">
                            <Clock className="h-4 w-4" /> Pending
                          </span>
                        )}
                      </div>
                      {checkinStatus.idVerificationRequired && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">ID verified</span>
                          <span className="text-amber-600 text-sm">Required</span>
                        </div>
                      )}
                      {checkinStatus.waiverRequired && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Waiver signed</span>
                          <span className="text-amber-600 text-sm">Required</span>
                        </div>
                      )}
                    </div>
                    {checkinStatus.lateArrivalFlag && (
                      <div className="flex items-center gap-2 text-amber-600 text-sm p-3 bg-amber-50 rounded-lg">
                        <AlertTriangle className="h-4 w-4" />
                        Late arrival flag set
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No check-in data available</p>
                )}
              </CardContent>
            </Card>

            {/* Vehicle & Access */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DoorOpen className="h-5 w-5 text-emerald-600" />
                  Vehicle & Access
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">License Plate</Label>
                    <Input
                      value={vehiclePlate}
                      onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                      placeholder="ABC123"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">State</Label>
                    <Input
                      value={vehicleState}
                      onChange={(e) => setVehicleState(e.target.value.toUpperCase())}
                      placeholder="CA"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Rig Type</Label>
                    <Input
                      value={vehicleRigType}
                      onChange={(e) => setVehicleRigType(e.target.value)}
                      placeholder="RV / Trailer"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Length (ft)</Label>
                    <Input
                      type="number"
                      value={vehicleRigLength}
                      onChange={(e) => setVehicleRigLength(e.target.value)}
                      placeholder="30"
                    />
                  </div>
                </div>
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
                  {vehicleMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Save Vehicle
                </Button>

                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Access Control</div>
                      <div className="text-xs text-muted-foreground">Gate/lock credentials</div>
                    </div>
                    <select
                      value={accessProvider}
                      onChange={(e) => setAccessProvider(e.target.value as any)}
                      className="text-sm border rounded px-2 py-1"
                    >
                      <option value="kisi">Kisi</option>
                      <option value="brivo">Brivo</option>
                      <option value="cloudkey">CloudKey</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value)}
                      placeholder="PIN / Code"
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      onClick={() =>
                        grantAccessMutation.mutate({
                          provider: accessProvider,
                          credentialType: "pin",
                          credentialValue: accessCode || vehiclePlate || undefined,
                          idempotencyKey: `grant-${accessProvider}-${reservationId}-${accessCode || "default"}`
                        })
                      }
                      disabled={grantAccessMutation.isPending}
                    >
                      Grant
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        revokeAccessMutation.mutate({
                          provider: accessProvider,
                          providerAccessId: accessStatus?.grants?.find((g: any) => g.provider === accessProvider)?.providerAccessId || undefined
                        })
                      }
                      disabled={revokeAccessMutation.isPending}
                    >
                      Revoke
                    </Button>
                  </div>
                  {(accessStatus?.grants ?? []).length > 0 && (
                    <div className="space-y-1">
                      {accessStatus?.grants?.map((g: any) => (
                        <div key={g.id} className="flex items-center justify-between text-sm p-2 rounded border">
                          <span className="capitalize">{g.provider}</span>
                          <Badge
                            variant="outline"
                            className={cn(
                              g.status === "active" && "bg-status-success/15 text-status-success",
                              g.status !== "active" && "bg-muted text-muted-foreground"
                            )}
                          >
                            {g.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Signatures & COI */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  Signatures & Documents
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Existing signatures */}
                {signatureRequests.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-foreground">Signature Requests</h4>
                    {signatureRequests.map((req: any) => (
                      <div key={req.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <div className="font-medium capitalize">
                            {(req.documentType || "document").replace(/_/g, " ")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {req.recipientEmail} - {formatDateTime(req.sentAt)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{req.status}</Badge>
                          {req.status !== "signed" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => resendSignatureMutation.mutate(req.id)}
                              disabled={resendSignatureMutation.isPending}
                            >
                              Resend
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* New signature request */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-foreground">Request New Signature</h4>
                  <div className="grid gap-3 sm:grid-cols-4">
                    <Input
                      placeholder="Email"
                      value={signatureEmail}
                      onChange={(e) => setSignatureEmail(e.target.value)}
                    />
                    <select
                      className="rounded-md border px-3 py-2 text-sm"
                      value={signatureType}
                      onChange={(e) => setSignatureType(e.target.value)}
                    >
                      <option value="long_term_stay">Long-term stay</option>
                      <option value="park_rules">Park rules</option>
                      <option value="waiver">Waiver</option>
                      <option value="other">Other</option>
                    </select>
                    <select
                      className="rounded-md border px-3 py-2 text-sm"
                      value={deliveryChannel}
                      onChange={(e) => setDeliveryChannel(e.target.value as any)}
                    >
                      <option value="email">Email</option>
                      <option value="email_and_sms">Email + SMS</option>
                      <option value="sms">SMS only</option>
                    </select>
                    <Button
                      onClick={() => createSignatureMutation.mutate()}
                      disabled={createSignatureMutation.isPending}
                    >
                      {createSignatureMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Send Request"
                      )}
                    </Button>
                  </div>
                </div>

                {/* COI Upload */}
                <div className="border-t pt-4 space-y-3">
                  <h4 className="text-sm font-medium text-foreground">Certificate of Insurance</h4>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Input
                      placeholder="COI URL"
                      value={coiUrl}
                      onChange={(e) => setCoiUrl(e.target.value)}
                    />
                    <Input
                      type="date"
                      placeholder="Expiry"
                      value={coiExpiresAt}
                      onChange={(e) => setCoiExpiresAt(e.target.value)}
                    />
                    <Button
                      variant="outline"
                      onClick={() => coiUploadMutation.mutate()}
                      disabled={coiUploadMutation.isPending}
                    >
                      Save COI
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Forms */}
            <ReservationFormsCard
              campgroundId={campgroundId}
              reservationId={reservationId}
            />
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB: HISTORY */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-muted-foreground" />
                Change History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AuditLogTimeline
                campgroundId={campgroundId}
                entityType="reservation"
                entityId={reservationId}
                limit={30}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* MODALS */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}

      {/* Payment Collection Modal */}
      <PaymentCollectionModal
        isOpen={paymentModalOpen}
        onClose={() => {
          setPaymentModalOpen(false);
          // Always invalidate on close - payment may have been recorded before closing
          queryClient.invalidateQueries({ queryKey: ["reservation", reservationId] });
        }}
        campgroundId={reservation.campgroundId}
        amountDueCents={balanceCents}
        subject={{ type: "balance", reservationId: reservation.id }}
        context="staff_checkin"
        guestId={reservation.guest?.id}
        guestEmail={reservation.guest?.email}
        guestName={guestName}
        enableSplitTender={true}
        enableCharityRoundUp={true}
        onSuccess={() => {
          setPaymentModalOpen(false);
          queryClient.invalidateQueries({ queryKey: ["reservation", reservationId] });
        }}
      />

      {/* Convert to Seasonal Modal */}
      <Dialog open={showConvertModal} onOpenChange={setShowConvertModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tent className="h-5 w-5 text-amber-600" />
              Convert to Seasonal Guest
            </DialogTitle>
            <DialogDescription>
              This {nights}-night stay qualifies for seasonal guest management.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="rounded-lg border bg-muted p-3">
              <div className="font-medium">{guestName}</div>
              <div className="text-sm text-muted-foreground">
                {formatDate(reservation.arrivalDate)} - {formatDate(reservation.departureDate)} - {siteLabel}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Metered Utilities</Label>
                  <p className="text-xs text-muted-foreground">Guest pays for usage separately</p>
                </div>
                <Switch checked={convertIsMetered} onCheckedChange={setConvertIsMetered} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Pays in Full</Label>
                  <p className="text-xs text-muted-foreground">Full payment upfront vs monthly</p>
                </div>
                <Switch checked={convertPaysInFull} onCheckedChange={setConvertPaysInFull} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConvertModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => convertToSeasonalMutation.mutate()}
              disabled={convertToSeasonalMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {convertToSeasonalMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Tent className="h-4 w-4 mr-2" />
              )}
              Convert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
