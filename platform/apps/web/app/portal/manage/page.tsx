"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { apiClient } from "@/lib/api-client";
import {
  CalendarDays,
  Tent,
  Users,
  CreditCard,
  XCircle,
  Settings,
  AlertTriangle,
  Loader2,
  Info,
} from "lucide-react";
import { GUEST_TOKEN_KEY, SPRING_CONFIG, STATUS_VARIANTS } from "@/lib/portal-constants";
import { PortalLoadingState } from "@/components/portal/PortalLoadingState";
import { PortalPageHeader } from "@/components/portal/PortalPageHeader";
import {
  StatusBadge,
  getReservationStatusVariant,
  getStatusLabel,
} from "@/components/portal/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";

type GuestData = Awaited<ReturnType<typeof apiClient.getGuestMe>>;
type Reservation = GuestData["reservations"][number];

type ActionType = "modify-dates" | "change-site" | "add-guest" | "cancel" | "pay-balance" | null;

export default function PortalManagePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [guest, setGuest] = useState<GuestData | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [activeAction, setActiveAction] = useState<ActionType>(null);

  const fetchGuest = useCallback(
    async (t: string) => {
      try {
        const data = await apiClient.getGuestMe(t);
        setGuest(data);
        if (data.reservations.length > 0) {
          // Preserve selection if possible
          const currentId = selectedReservation?.id;
          const updated = data.reservations.find((r) => r.id === currentId);
          setSelectedReservation(updated || data.reservations[0]);
        }
      } catch {
        router.replace("/portal/login");
      } finally {
        setLoading(false);
      }
    },
    [router, selectedReservation?.id],
  );

  useEffect(() => {
    const storedToken = localStorage.getItem(GUEST_TOKEN_KEY);
    if (!storedToken) {
      router.replace("/portal/login");
      return;
    }
    setToken(storedToken);
    fetchGuest(storedToken);
  }, []);

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    if (token) {
      await fetchGuest(token);
    }
  }, [token, fetchGuest]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  if (loading) {
    return <PortalLoadingState variant="spinner" message="Loading your reservations..." />;
  }

  if (!guest || !selectedReservation) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <p className="text-lg mb-4 text-muted-foreground">No reservations found</p>
        <button
          onClick={() => router.push("/portal/login")}
          className="text-primary hover:text-primary/80 transition-colors"
        >
          Back to login
        </button>
      </div>
    );
  }

  const balanceDue = selectedReservation.totalAmount - (selectedReservation.paidAmount ?? 0);

  return (
    <PullToRefresh onRefresh={handleRefresh} className="min-h-screen">
      <div className="container mx-auto px-4 py-6 space-y-6 max-w-2xl">
        {/* Page Header */}
        <PortalPageHeader
          icon={<Settings className="h-6 w-6 text-white" />}
          gradient="from-blue-500 to-indigo-600"
          title="Manage Reservation"
          subtitle="Modify dates, guests, or cancel"
        />

        {/* Reservation Selection */}
        {guest.reservations.length > 1 && (
          <div className="bg-card rounded-xl p-4 border border-border">
            <label className="block text-sm text-muted-foreground mb-2">Select Reservation</label>
            <select
              value={selectedReservation.id}
              onChange={(e) =>
                setSelectedReservation(guest.reservations.find((r) => r.id === e.target.value)!)
              }
              className="w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none"
            >
              {guest.reservations.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.campground.name} - Site {r.site.siteNumber} ({formatDate(r.arrivalDate)})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Current Reservation Details */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING_CONFIG}
          className="bg-card rounded-2xl p-6 border border-border shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-foreground">
                {selectedReservation.campground.name}
              </h2>
              <p className="text-muted-foreground">Site {selectedReservation.site.siteNumber}</p>
            </div>
            <StatusBadge
              status={getStatusLabel(selectedReservation.status)}
              variant={getReservationStatusVariant(selectedReservation.status)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Check-in</p>
              <p className="font-medium text-foreground">
                {formatDate(selectedReservation.arrivalDate)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Check-out</p>
              <p className="font-medium text-foreground">
                {formatDate(selectedReservation.departureDate)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Guests</p>
              <p className="font-medium text-foreground">
                {selectedReservation.adults} adults
                {selectedReservation.children > 0 && `, ${selectedReservation.children} children`}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Balance</p>
              <p
                className={`font-medium ${balanceDue > 0 ? STATUS_VARIANTS.warning.text : STATUS_VARIANTS.success.text}`}
              >
                {balanceDue > 0 ? `$${(balanceDue / 100).toFixed(2)}` : "Paid in full"}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Self-Service Actions */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-foreground">What would you like to do?</h3>

          <ActionButton
            icon={<CalendarDays className="h-6 w-6" />}
            title="Modify Dates"
            description={
              selectedReservation.status === "checked_in"
                ? "Cannot modify after check-in. Contact front desk."
                : "Change your check-in or check-out dates"
            }
            onClick={() => setActiveAction("modify-dates")}
            disabled={selectedReservation.status === "checked_in"}
          />

          <ActionButton
            icon={<Tent className="h-6 w-6" />}
            title="Change Site"
            description={
              selectedReservation.status === "checked_in"
                ? "Cannot change site after check-in. Contact front desk."
                : "Request a different campsite"
            }
            onClick={() => setActiveAction("change-site")}
            disabled={selectedReservation.status === "checked_in"}
          />

          <ActionButton
            icon={<Users className="h-6 w-6" />}
            title="Add/Remove Guests"
            description="Update your party size"
            onClick={() => setActiveAction("add-guest")}
          />

          {balanceDue > 0 && (
            <ActionButton
              icon={<CreditCard className="h-6 w-6" />}
              title="Pay Balance"
              description={`Pay your outstanding balance of $${(balanceDue / 100).toFixed(2)}`}
              onClick={() => setActiveAction("pay-balance")}
              highlight
            />
          )}

          <ActionButton
            icon={<XCircle className="h-6 w-6" />}
            title="Cancel Reservation"
            description={
              selectedReservation.status === "checked_in"
                ? "Cannot cancel after check-in. Contact front desk."
                : "Cancel your reservation (fees may apply)"
            }
            onClick={() => setActiveAction("cancel")}
            danger
            disabled={selectedReservation.status === "checked_in"}
          />
        </div>

        {/* Action Modals */}
        {activeAction && (
          <ActionModal
            action={activeAction}
            reservation={selectedReservation}
            token={token!}
            onClose={() => setActiveAction(null)}
            onSuccess={(message) => {
              setActiveAction(null);
              fetchGuest(token!);
              if (message) {
                toast({
                  title: "Request submitted",
                  description: message,
                });
              }
            }}
          />
        )}
      </div>
    </PullToRefresh>
  );
}

function ActionButton({
  icon,
  title,
  description,
  onClick,
  disabled,
  highlight,
  danger,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  highlight?: boolean;
  danger?: boolean;
}) {
  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.01, y: -2 } : undefined}
      whileTap={!disabled ? { scale: 0.99 } : undefined}
      onClick={onClick}
      disabled={disabled}
      className={`w-full p-4 rounded-xl text-left transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${
        disabled
          ? "bg-muted/50 text-muted-foreground cursor-not-allowed opacity-60 focus:ring-muted"
          : danger
            ? `${STATUS_VARIANTS.error.bg} hover:opacity-90 ${STATUS_VARIANTS.error.border} border focus:ring-red-500`
            : highlight
              ? `${STATUS_VARIANTS.success.bg} hover:opacity-90 ${STATUS_VARIANTS.success.border} border focus:ring-emerald-500`
              : "bg-card hover:bg-muted/50 border border-border focus:ring-primary"
      }`}
    >
      <div className="flex items-center gap-4">
        <span
          className={
            danger
              ? STATUS_VARIANTS.error.text
              : highlight
                ? STATUS_VARIANTS.success.text
                : "text-primary"
          }
        >
          {icon}
        </span>
        <div className="flex-1">
          <h4 className="font-medium text-foreground">{title}</h4>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {!disabled && <span className="text-muted-foreground text-lg">→</span>}
      </div>
    </motion.button>
  );
}

function ActionModal({
  action,
  reservation,
  token,
  onClose,
  onSuccess,
}: {
  action: ActionType;
  reservation: Reservation;
  token: string;
  onClose: () => void;
  onSuccess: (message?: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [newArrival, setNewArrival] = useState(reservation.arrivalDate.split("T")[0]);
  const [newDeparture, setNewDeparture] = useState(reservation.departureDate.split("T")[0]);
  const [adults, setAdults] = useState(reservation.adults);
  const [children, setChildren] = useState(reservation.children);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [confirmText, setConfirmText] = useState("");

  const handleSubmit = async () => {
    // Validate cancellation confirmation
    if (action === "cancel" && confirmText !== "CANCEL") {
      setError('Please type "CANCEL" to confirm');
      return;
    }

    // Validate date modifications
    if (action === "modify-dates") {
      const arrival = new Date(newArrival);
      const departure = new Date(newDeparture);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (arrival < today) {
        setError("Check-in date cannot be in the past");
        return;
      }
      if (departure <= arrival) {
        setError("Check-out must be after check-in");
        return;
      }
    }

    setLoading(true);
    setError("");
    try {
      switch (action) {
        case "modify-dates":
          await apiClient.requestPortalDateChange(token, reservation.id, {
            newArrival,
            newDeparture,
          });
          onSuccess("We're checking availability. You'll hear from us within 24 hours.");
          break;
        case "change-site":
          await apiClient.requestPortalSiteChange(token, reservation.id, { reason });
          onSuccess("We'll review your preferences and get back to you soon.");
          break;
        case "add-guest":
          await apiClient.updatePortalGuestCount(token, reservation.id, { adults, children });
          onSuccess("Your guest count has been updated.");
          break;
        case "cancel":
          await apiClient.requestPortalCancellation(token, reservation.id, { reason });
          onSuccess("Your cancellation has been processed. Check your email for confirmation.");
          break;
        case "pay-balance":
          window.open(`/portal/pay/${reservation.id}`, "_blank");
          onClose();
          return;
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (action) {
      case "modify-dates":
        return "Modify Dates";
      case "change-site":
        return "Request Site Change";
      case "add-guest":
        return "Update Guest Count";
      case "cancel":
        return "Cancel Reservation";
      case "pay-balance":
        return "Pay Balance";
      default:
        return "";
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={SPRING_CONFIG}
        className="bg-card rounded-2xl w-full max-w-md p-6 border border-border shadow-xl max-h-[90vh] overflow-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground">{getTitle()}</h2>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {action === "modify-dates" && (
            <>
              <div
                className={`${STATUS_VARIANTS.info.bg} ${STATUS_VARIANTS.info.border} border rounded-lg p-3`}
              >
                <p className={`text-sm ${STATUS_VARIANTS.info.text} flex items-center gap-2`}>
                  <Info className="h-4 w-4 shrink-0" />
                  <span>
                    No commitment yet—we'll confirm availability before any changes are made.
                  </span>
                </p>
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">
                  New Check-in Date
                </label>
                <input
                  type="date"
                  value={newArrival}
                  onChange={(e) => setNewArrival(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">
                  New Check-out Date
                </label>
                <input
                  type="date"
                  value={newDeparture}
                  onChange={(e) => setNewDeparture(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Date changes are subject to availability and may result in price adjustments.
              </p>
            </>
          )}

          {action === "change-site" && (
            <>
              <p className="text-sm text-muted-foreground">
                Submitting a request does not guarantee availability. We'll contact you to confirm
                options.
              </p>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">
                  Reason / Preferences
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none resize-none"
                  placeholder="e.g., Need hookups, prefer shaded site..."
                />
              </div>
            </>
          )}

          {action === "add-guest" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Adults</label>
                  <input
                    type="number"
                    min={1}
                    value={adults}
                    onChange={(e) => setAdults(parseInt(e.target.value) || 1)}
                    className="w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Children</label>
                  <input
                    type="number"
                    min={0}
                    value={children}
                    onChange={(e) => setChildren(parseInt(e.target.value) || 0)}
                    className="w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none"
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Additional guests may incur extra fees depending on campground policies.
              </p>
            </>
          )}

          {action === "cancel" && (
            <>
              <div
                className={`${STATUS_VARIANTS.error.bg} ${STATUS_VARIANTS.error.border} border rounded-lg p-4`}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle
                    className={`h-5 w-5 ${STATUS_VARIANTS.error.text} shrink-0 mt-0.5`}
                  />
                  <div className="space-y-1">
                    <p className={`font-medium ${STATUS_VARIANTS.error.text}`}>
                      This action cannot be undone
                    </p>
                    <p className={`text-sm ${STATUS_VARIANTS.error.text} opacity-90`}>
                      Your reservation will be permanently cancelled. Cancellation fees may apply
                      based on timing and campground policy.
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">
                  Reason (optional)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  className="w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none resize-none"
                  placeholder="Tell us why you're canceling..."
                />
              </div>
              <div>
                <label className="block text-sm text-foreground font-medium mb-1">
                  Type "CANCEL" to confirm
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                  className={`w-full bg-background border rounded-lg px-4 py-3 text-foreground focus:ring-2 focus:ring-offset-2 focus:outline-none ${
                    confirmText === "CANCEL"
                      ? `${STATUS_VARIANTS.error.border} focus:ring-red-500`
                      : "border-border focus:ring-primary"
                  }`}
                  placeholder="CANCEL"
                />
              </div>
            </>
          )}

          {error && (
            <div
              className={`${STATUS_VARIANTS.error.bg} ${STATUS_VARIANTS.error.border} border rounded-lg p-3 text-sm ${STATUS_VARIANTS.error.text}`}
            >
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-border rounded-lg hover:bg-muted text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || (action === "cancel" && confirmText !== "CANCEL")}
              className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                action === "cancel"
                  ? "bg-red-600 hover:bg-red-700 text-white focus:ring-red-500"
                  : "bg-primary hover:bg-primary/90 text-primary-foreground focus:ring-primary"
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </span>
              ) : action === "cancel" ? (
                "Confirm Cancellation"
              ) : (
                "Submit"
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
