"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow, format } from "date-fns";
import {
  UserPlus,
  Pencil,
  Trash2,
  LogIn,
  LogOut,
  XCircle,
  CheckCircle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  History,
} from "lucide-react";
import { useState } from "react";
import { cn } from "../../lib/utils";
import { Skeleton } from "../ui/skeleton";

type AuditLog = {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  actorId: string | null;
  actor?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: string;
};

interface AuditLogTimelineProps {
  campgroundId: string;
  entityType: "guest" | "reservation";
  entityId: string;
  limit?: number;
}

const actionIcons: Record<string, React.ReactNode> = {
  "guest.create": <UserPlus className="h-4 w-4" />,
  "guest.update": <Pencil className="h-4 w-4" />,
  "guest.delete": <Trash2 className="h-4 w-4" />,
  "reservation.create": <UserPlus className="h-4 w-4" />,
  "reservation.update": <RefreshCw className="h-4 w-4" />,
  "reservation.delete": <Trash2 className="h-4 w-4" />,
  "reservation.cancel": <XCircle className="h-4 w-4" />,
  "reservation.checkin": <LogIn className="h-4 w-4" />,
  "reservation.checkout": <LogOut className="h-4 w-4" />,
  "reservation.confirm": <CheckCircle className="h-4 w-4" />,
  "reservation.payment": <CheckCircle className="h-4 w-4" />,
  "reservation.refund": <RefreshCw className="h-4 w-4" />,
  reservation_override: <AlertCircle className="h-4 w-4" />,
  "checkin.override": <AlertCircle className="h-4 w-4" />,
};

const actionLabels: Record<string, string> = {
  "guest.create": "Guest Created",
  "guest.update": "Guest Updated",
  "guest.delete": "Guest Deleted",
  "reservation.create": "Reservation Created",
  "reservation.update": "Reservation Updated",
  "reservation.delete": "Reservation Deleted",
  "reservation.cancel": "Reservation Cancelled",
  "reservation.checkin": "Checked In",
  "reservation.checkout": "Checked Out",
  "reservation.confirm": "Reservation Confirmed",
  "reservation.payment": "Payment Received",
  "reservation.refund": "Refund Issued",
  reservation_override: "Price Override",
  "checkin.override": "Check-in Override",
};

const actionColors: Record<string, string> = {
  "guest.create": "bg-status-success-bg text-status-success-text border-status-success-border",
  "guest.update": "bg-status-info-bg text-status-info-text border-status-info-border",
  "guest.delete": "bg-status-error-bg text-status-error-text border-status-error-border",
  "reservation.create":
    "bg-status-success-bg text-status-success-text border-status-success-border",
  "reservation.update": "bg-status-info-bg text-status-info-text border-status-info-border",
  "reservation.delete": "bg-status-error-bg text-status-error-text border-status-error-border",
  "reservation.cancel": "bg-status-error-bg text-status-error-text border-status-error-border",
  "reservation.checkin":
    "bg-status-success-bg text-status-success-text border-status-success-border",
  "reservation.checkout":
    "bg-status-warning-bg text-status-warning-text border-status-warning-border",
  "reservation.confirm":
    "bg-status-success-bg text-status-success-text border-status-success-border",
  "reservation.payment":
    "bg-status-success-bg text-status-success-text border-status-success-border",
  "reservation.refund": "bg-status-error-bg text-status-error-text border-status-error-border",
  reservation_override:
    "bg-status-warning-bg text-status-warning-text border-status-warning-border",
  "checkin.override": "bg-status-warning-bg text-status-warning-text border-status-warning-border",
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value instanceof Date || (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value))) {
    try {
      return format(new Date(value), "MMM d, yyyy");
    } catch {
      return String(value);
    }
  }
  if (typeof value === "number") {
    // Check if it's likely a cents value
    if (value > 100 && Number.isInteger(value)) {
      return `$${(value / 100).toFixed(2)}`;
    }
    return String(value);
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function DiffView({
  before,
  after,
}: {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}) {
  if (!before && !after) return null;

  const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);

  // Filter to only show keys that changed
  const changedKeys = Array.from(allKeys).filter((key) => {
    const beforeVal = before?.[key];
    const afterVal = after?.[key];
    return JSON.stringify(beforeVal) !== JSON.stringify(afterVal);
  });

  if (changedKeys.length === 0) {
    return <p className="text-xs text-muted-foreground italic">No field changes recorded</p>;
  }

  return (
    <div className="space-y-1.5">
      {changedKeys.map((key) => (
        <div key={key} className="text-xs">
          <span className="font-medium text-foreground capitalize">
            {key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())}:
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            {before?.[key] !== undefined && (
              <span className="text-red-600 line-through">{formatValue(before[key])}</span>
            )}
            {before?.[key] !== undefined && after?.[key] !== undefined && (
              <span className="text-muted-foreground">→</span>
            )}
            {after?.[key] !== undefined && (
              <span className="text-emerald-600">{formatValue(after[key])}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function AuditLogEntry({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = useState(false);

  const actorName = log.actor
    ? `${log.actor.firstName || ""} ${log.actor.lastName || ""}`.trim() || log.actor.email
    : "System";

  const icon = actionIcons[log.action] || <RefreshCw className="h-4 w-4" />;
  const label = actionLabels[log.action] || log.action;
  const colorClass = actionColors[log.action] || "bg-muted text-foreground border-border";

  const hasDiff = log.before || log.after;

  return (
    <div className="relative pl-8 pb-6 last:pb-0">
      {/* Timeline line */}
      <div className="absolute left-3 top-6 bottom-0 w-px bg-muted last:hidden" />

      {/* Icon circle */}
      <div
        className={cn(
          "absolute left-0 top-0 flex items-center justify-center w-6 h-6 rounded-full border",
          colorClass,
        )}
      >
        {icon}
      </div>

      {/* Content */}
      <div className="bg-card border border-border rounded-lg p-3 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="font-medium text-foreground">{label}</span>
            <span className="text-muted-foreground text-sm ml-2">by {actorName}</span>
          </div>
          <time
            className="text-xs text-muted-foreground whitespace-nowrap"
            title={format(new Date(log.createdAt), "PPpp")}
          >
            {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
          </time>
        </div>

        {hasDiff && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {expanded ? "Hide details" : "Show details"}
          </button>
        )}

        {expanded && hasDiff && (
          <div className="mt-3 pt-3 border-t border-border">
            <DiffView before={log.before} after={log.after} />
          </div>
        )}
      </div>
    </div>
  );
}

export function AuditLogTimeline({
  campgroundId,
  entityType,
  entityId,
  limit = 50,
}: AuditLogTimelineProps) {
  const {
    data: logs,
    isLoading,
    error,
  } = useQuery<AuditLog[]>({
    queryKey: ["audit", campgroundId, entityType, entityId],
    queryFn: async () => {
      const res = await fetch(
        `/api/campgrounds/${campgroundId}/audit/entity/${entityType}/${entityId}?limit=${limit}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        throw new Error("Failed to fetch audit logs");
      }
      return res.json();
    },
    staleTime: 30000, // 30 seconds
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-6 w-6 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p>Failed to load activity log</p>
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <History className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p>No activity recorded yet</p>
        <p className="text-sm mt-1">Changes will appear here as they happen</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {logs.map((log) => (
        <AuditLogEntry key={log.id} log={log} />
      ))}
    </div>
  );
}
