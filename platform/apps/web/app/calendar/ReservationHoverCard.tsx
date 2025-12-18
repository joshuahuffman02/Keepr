"use client";

import { HoverCard, HoverCardHeader, HoverCardContent, HoverCardFooter } from "../../components/ui/hover-card";
import { formatDate, formatCurrency, calculateNights, getRelativeTime } from "@/lib/format";
import { CheckCircle, Clock, XCircle, HelpCircle, Calendar, User, Mail, Phone, CreditCard, Tent, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReservationHoverCardProps {
  reservation: {
    id: string;
    status: string;
    arrivalDate: string | Date;
    departureDate: string | Date;
    totalAmount?: number | null;
    paidAmount?: number | null;
    guest?: {
      primaryFirstName?: string | null;
      primaryLastName?: string | null;
      email?: string | null;
      phone?: string | null;
    } | null;
    site?: {
      name?: string | null;
      siteNumber?: string | null;
      siteType?: string | null;
    } | null;
  };
  children: React.ReactNode;
  onQuickCheckIn?: () => void;
  isArrivalToday?: boolean;
}

const statusConfig = {
  confirmed: {
    label: "Confirmed",
    color: "text-emerald-700 bg-emerald-50 border-emerald-200",
    icon: CheckCircle,
    iconColor: "text-emerald-600",
  },
  checked_in: {
    label: "Checked In",
    color: "text-blue-700 bg-blue-50 border-blue-200",
    icon: Clock,
    iconColor: "text-blue-600",
  },
  cancelled: {
    label: "Cancelled",
    color: "text-rose-700 bg-rose-50 border-rose-200",
    icon: XCircle,
    iconColor: "text-rose-600",
  },
  pending: {
    label: "Pending",
    color: "text-amber-700 bg-amber-50 border-amber-200",
    icon: HelpCircle,
    iconColor: "text-amber-600",
  },
};

export function ReservationHoverCard({
  reservation,
  children,
  onQuickCheckIn,
  isArrivalToday,
}: ReservationHoverCardProps) {
  const config = statusConfig[reservation.status as keyof typeof statusConfig] || statusConfig.pending;
  const StatusIcon = config.icon;

  const guestName = `${reservation.guest?.primaryFirstName || ""} ${reservation.guest?.primaryLastName || ""}`.trim() || "Guest";
  const nights = calculateNights(reservation.arrivalDate, reservation.departureDate);
  const total = reservation.totalAmount ?? 0;
  const paid = reservation.paidAmount ?? 0;
  const balance = total - paid;

  const arrivalRelative = getRelativeTime(reservation.arrivalDate);
  const showQuickCheckIn = onQuickCheckIn && reservation.status === "confirmed" && isArrivalToday;

  const hoverContent = (
    <>
      <HoverCardHeader className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-slate-400 flex-shrink-0" />
            <span className="font-semibold text-slate-900 truncate">{guestName}</span>
          </div>
          {reservation.guest?.email && (
            <div className="flex items-center gap-2 mt-1">
              <Mail className="h-3 w-3 text-slate-400 flex-shrink-0" />
              <span className="text-xs text-slate-500 truncate">{reservation.guest.email}</span>
            </div>
          )}
        </div>
        <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-medium", config.color)}>
          <StatusIcon className={cn("h-3 w-3", config.iconColor)} />
          {config.label}
        </div>
      </HoverCardHeader>

      <HoverCardContent className="space-y-3">
        {/* Dates */}
        <div className="flex items-start gap-3">
          <Calendar className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-medium text-slate-900">
              {formatDate(reservation.arrivalDate)} — {formatDate(reservation.departureDate)}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {nights} night{nights !== 1 ? "s" : ""} • Arrives {arrivalRelative}
            </div>
          </div>
        </div>

        {/* Site */}
        {reservation.site && (
          <div className="flex items-start gap-3">
            <Tent className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-medium text-slate-900">
                {reservation.site.name || `Site ${reservation.site.siteNumber}`}
              </div>
              {reservation.site.siteType && (
                <div className="text-xs text-slate-500 mt-0.5 capitalize">
                  {reservation.site.siteType.replace(/_/g, " ")}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Payment */}
        <div className="flex items-start gap-3">
          <CreditCard className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-900">
                {formatCurrency(total)}
              </span>
              {balance > 0 && (
                <span className="text-xs text-amber-600 font-medium">
                  {formatCurrency(balance)} due
                </span>
              )}
              {balance <= 0 && paid > 0 && (
                <span className="text-xs text-emerald-600 font-medium">
                  Paid in full
                </span>
              )}
            </div>
            {paid > 0 && paid < total && (
              <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (paid / total) * 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </HoverCardContent>

      {showQuickCheckIn && (
        <HoverCardFooter className="flex justify-end">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onQuickCheckIn?.();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-md transition-colors"
          >
            <LogIn className="h-3 w-3" />
            Quick Check-in
          </button>
        </HoverCardFooter>
      )}
    </>
  );

  return (
    <HoverCard content={hoverContent} side="top" openDelay={300} closeDelay={150}>
      {children}
    </HoverCard>
  );
}
