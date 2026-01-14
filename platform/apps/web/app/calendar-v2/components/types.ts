import type { CalendarBlackout, CalendarReservation, CalendarSite, DayMeta, QuotePreview } from "../../calendar/types";

export type DensityMode = "compact" | "standard" | "expanded";

export const DENSITY_CONFIG: Record<DensityMode, {
  rowHeight: number;
  chipHeight: number;
  padding: string;
  fontSize: string;
  showDetails: boolean;
}> = {
  compact: {
    rowHeight: 40,
    chipHeight: 28,
    padding: "py-1",
    fontSize: "text-[9px]",
    showDetails: false,
  },
  standard: {
    rowHeight: 64,
    chipHeight: 48,
    padding: "py-3",
    fontSize: "text-[11px]",
    showDetails: true,
  },
  expanded: {
    rowHeight: 88,
    chipHeight: 72,
    padding: "py-4",
    fontSize: "text-xs",
    showDetails: true,
  }
};

export interface ActiveSelection {
  siteId: string;
  startIdx: number;
  endIdx: number;
}

export interface DragState {
  siteId: string | null;
  startIdx: number | null;
  endIdx: number | null;
  isDragging: boolean;
  pointerId: number | null;
}

export const DAY_MIN_WIDTH = 104;
export const SITE_COL_WIDTH = 240;

export const STATUS_CONFIG: Record<string, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
}> = {
  confirmed: {
    label: "Confirmed",
    color: "text-status-success",
    bgColor: "bg-status-success",
    borderColor: "border-status-success",
    description: "Reservation is confirmed and ready"
  },
  checked_in: {
    label: "Checked In",
    color: "text-status-info",
    bgColor: "bg-status-info",
    borderColor: "border-status-info",
    description: "Guest is currently on-site"
  },
  pending: {
    label: "Pending",
    color: "text-status-warning",
    bgColor: "bg-status-warning",
    borderColor: "border-status-warning",
    description: "Awaiting confirmation or payment"
  },
  cancelled: {
    label: "Cancelled",
    color: "text-status-error",
    bgColor: "bg-status-error",
    borderColor: "border-status-error",
    description: "Reservation has been cancelled"
  },
  checked_out: {
    label: "Checked Out",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    borderColor: "border-muted",
    description: "Guest has departed"
  }
};

export const SITE_TYPE_STYLES: Record<string, { label: string; badge: string; border: string }> = {
  rv: { label: "RV", badge: "bg-status-success/15 text-status-success", border: "border-l-status-success" },
  tent: { label: "Tent", badge: "bg-status-warning/15 text-status-warning", border: "border-l-status-warning" },
  cabin: { label: "Cabin", badge: "bg-rose-100 text-rose-700", border: "border-l-rose-400" },
  group: { label: "Group", badge: "bg-indigo-100 text-indigo-700", border: "border-l-indigo-400" },
  glamping: { label: "Glamp", badge: "bg-cyan-100 text-cyan-700", border: "border-l-cyan-400" },
  default: { label: "Site", badge: "bg-muted text-muted-foreground", border: "border-l-border" }
};

export type { CalendarBlackout, CalendarReservation, CalendarSite, DayMeta, QuotePreview };
