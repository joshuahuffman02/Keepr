"use client";

import React, { memo } from "react";
import { CheckCircle, Clock, LogOut, XCircle } from "lucide-react";
import { cn } from "../../../lib/utils";
import { STATUS_CONFIG } from "./types";

const STATUS_ICONS: Record<string, typeof CheckCircle> = {
  confirmed: CheckCircle,
  checked_in: Clock,
  pending: Clock,
  cancelled: XCircle,
  checked_out: LogOut,
};

interface StatusFilterChipsProps {
  activeFilter: string;
  onFilterChange: (status: string) => void;
  reservationCounts?: Record<string, number>;
  className?: string;
}

type StatusFilter = "all" | keyof typeof STATUS_CONFIG;
const STATUSES: StatusFilter[] = ["all", "confirmed", "checked_in", "pending", "cancelled"];

export const StatusFilterChips = memo(function StatusFilterChips({
  activeFilter,
  onFilterChange,
  reservationCounts = {},
  className
}: StatusFilterChipsProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {STATUSES.map((status) => {
        const isActive = activeFilter === status;
        const config = status === "all" ? null : STATUS_CONFIG[status];
        const Icon = status === "all" ? null : STATUS_ICONS[status];
        const count = status === "all"
          ? Object.values(reservationCounts).reduce((sum, n) => sum + n, 0)
          : reservationCounts[status] ?? 0;

        return (
          <button
            key={status}
            type="button"
            onClick={() => onFilterChange(status)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200",
              "border shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-ring",
              isActive
                ? config
                  ? cn("text-white border-transparent", config.bgColor)
                  : "bg-foreground text-background border-transparent"
                : config
                  ? cn("bg-card border-border hover:border-border", config.color)
                  : "bg-card text-muted-foreground border-border hover:border-border"
            )}
          >
            {Icon ? <Icon className="h-3 w-3" /> : null}
            <span className="capitalize">{status === "all" ? "All" : config?.label}</span>
            {count > 0 ? (
              <span className={cn(
                "px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                isActive ? "bg-card/20" : "bg-muted"
              )}>
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
});
