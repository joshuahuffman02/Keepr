"use client";

import { useSyncStatus } from "@/contexts/SyncStatusContext";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface SyncStatusProps {
  variant?: "compact" | "full" | "badge";
  showDetails?: boolean;
  className?: string;
  onClick?: () => void;
}

export function SyncStatus({
  variant = "compact",
  showDetails = true,
  className,
  onClick,
}: SyncStatusProps) {
  const { status } = useSyncStatus();

  const stateConfig = {
    synced: {
      icon: (
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      label: "Synced",
      color: "text-status-success-text bg-status-success-bg border-status-success-border",
      dotColor: "bg-status-success",
    },
    syncing: {
      icon: (
        <svg
          className="h-4 w-4 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      label: "Syncing",
      color: "text-status-info-text bg-status-info-bg border-status-info-border",
      dotColor: "bg-status-info animate-pulse",
    },
    pending: {
      icon: (
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      label: `Pending (${status.totalPending})`,
      color: "text-status-warning-text bg-status-warning-bg border-status-warning-border",
      dotColor: "bg-status-warning",
    },
    offline: {
      icon: (
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M9 22V12h6v10" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="2" x2="22" y1="2" y2="22" strokeLinecap="round" />
        </svg>
      ),
      label: "Offline",
      color: "text-status-error-text bg-status-error-bg border-status-error-border",
      dotColor: "bg-status-error",
    },
    error: {
      icon: (
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 8v4M12 16h.01" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      label: `Error (${status.totalConflicts} conflicts)`,
      color: "text-status-error-text bg-status-error-bg border-status-error-border",
      dotColor: "bg-status-error",
    },
  };

  const config = stateConfig[status.state];

  if (variant === "badge") {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
          config.color,
          onClick && "cursor-pointer hover:opacity-80",
          className,
        )}
      >
        {config.icon}
        <span>{config.label}</span>
      </button>
    );
  }

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
          config.color,
          onClick && "cursor-pointer hover:opacity-80",
          className,
        )}
      >
        <span className={cn("h-2 w-2 rounded-full", config.dotColor)} />
        <span className="font-medium">{config.label}</span>
        {showDetails && status.lastSyncTime && status.state === "synced" && (
          <span className="text-xs opacity-70">
            {formatDistanceToNow(status.lastSyncTime, { addSuffix: true })}
          </span>
        )}
      </button>
    );
  }

  // Full variant
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3 transition-colors",
        config.color,
        onClick && "cursor-pointer hover:opacity-80",
        className,
      )}
    >
      <div className="flex-shrink-0 mt-0.5">{config.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{config.label}</span>
          {status.state === "pending" && status.totalPending > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-bold text-white">
              {status.totalPending}
            </span>
          )}
          {status.state === "error" && status.totalConflicts > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
              {status.totalConflicts}
            </span>
          )}
        </div>
        {showDetails && (
          <div className="mt-1 space-y-1 text-xs opacity-80">
            {status.lastSyncTime && (
              <div>Last sync: {formatDistanceToNow(status.lastSyncTime, { addSuffix: true })}</div>
            )}
            {status.state === "offline" && <div>Changes will sync when connection is restored</div>}
            {status.state === "error" && status.errors.length > 0 && (
              <div className="truncate">{status.errors[0]}</div>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
