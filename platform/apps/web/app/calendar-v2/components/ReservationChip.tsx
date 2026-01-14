"use client";

import React, { memo } from "react";
import { Lock } from "lucide-react";
import { cn } from "../../../lib/utils";
import type { CalendarReservation } from "./types";
import { DENSITY_CONFIG, type DensityMode } from "./types";

interface ReservationChipProps {
  reservation: CalendarReservation;
  onClick: () => void;
  densityConfig: typeof DENSITY_CONFIG[DensityMode];
}

export const ReservationChip = memo(function ReservationChip({
  reservation,
  onClick,
  densityConfig
}: ReservationChipProps) {
  const statusStyles: Record<string, string> = {
    confirmed: "bg-status-success/90 border-status-success/40",
    checked_in: "bg-status-info/90 border-status-info/40",
    pending: "bg-status-warning/90 border-status-warning/40",
    cancelled: "bg-status-error/90 border-status-error/40"
  };

  const guestName = `${reservation.guest?.primaryFirstName ?? ""} ${reservation.guest?.primaryLastName ?? ""}`.trim() || "Guest";
  const status = reservation.status ?? "pending";
  const statusClass = statusStyles[status] ?? statusStyles.pending;

  const isCompact = densityConfig.rowHeight === 40;
  const isExpanded = densityConfig.rowHeight === 88;

  return (
    <div
      className={cn(
        "absolute rounded-lg text-white flex items-center overflow-hidden border shadow-sm cursor-pointer transition-transform",
        "hover:scale-[1.01] active:scale-[0.98]",
        statusClass,
        isCompact ? "top-1 bottom-1 left-1 right-1 px-2" : "top-1.5 bottom-1.5 left-1.5 right-1.5 px-2.5",
        densityConfig.fontSize
      )}
      title={`${guestName} - ${reservation.status}`}
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 min-w-0 w-full">
        <div className={cn("flex min-w-0", isExpanded ? "flex-col gap-0.5" : isCompact ? "flex-row items-center" : "flex-col")}>
          <span className="font-bold truncate tracking-tight">{guestName}</span>
          {densityConfig.showDetails && (
            <span className={cn("opacity-80 truncate uppercase tracking-wider", isCompact ? "hidden" : "block", isExpanded ? "text-[10px]" : "text-[9px]")}>
              {status.replace("_", " ")}
            </span>
          )}
          {isExpanded && reservation.guest?.phone && (
            <span className="text-[9px] opacity-70 truncate">{reservation.guest.phone}</span>
          )}
        </div>
        {reservation.siteLocked && (
          <span className="ml-auto inline-flex items-center text-white/90">
            <Lock className={isCompact ? "h-2.5 w-2.5" : "h-3 w-3"} aria-label="Site locked" />
          </span>
        )}
      </div>
    </div>
  );
});
