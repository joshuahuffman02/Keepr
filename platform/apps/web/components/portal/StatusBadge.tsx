"use client";

import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  AlertCircle,
  Clock,
  AlertTriangle,
  Info,
  type LucideIcon,
} from "lucide-react";
import { STATUS_VARIANTS, StatusVariant } from "@/lib/portal-constants";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
  showIcon?: boolean;
  className?: string;
  size?: "sm" | "md";
}

const VARIANT_ICONS: Record<StatusVariant, LucideIcon> = {
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertCircle,
  info: Info,
  neutral: Clock,
};

export function StatusBadge({
  status,
  variant = "neutral",
  showIcon = false,
  className,
  size = "md",
}: StatusBadgeProps) {
  const config = STATUS_VARIANTS[variant];
  const Icon = VARIANT_ICONS[variant];

  return (
    <Badge
      variant="outline"
      className={cn(
        config.bg,
        config.text,
        config.border,
        size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-2.5 py-0.5",
        className,
      )}
    >
      {showIcon && <Icon className={cn("mr-1", size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")} />}
      {status}
    </Badge>
  );
}

// Helper to map reservation status to variant
export function getReservationStatusVariant(status: string): StatusVariant {
  switch (status) {
    case "checked_in":
      return "success";
    case "confirmed":
      return "info";
    case "pending":
      return "warning";
    case "cancelled":
    case "no_show":
      return "error";
    default:
      return "neutral";
  }
}

// Helper to map order status to variant
export function getOrderStatusVariant(status: string): StatusVariant {
  switch (status) {
    case "delivered":
    case "completed":
      return "success";
    case "preparing":
    case "ready":
      return "warning";
    case "pending":
      return "info";
    case "cancelled":
    case "failed":
      return "error";
    default:
      return "neutral";
  }
}

// Helper to get human-readable status label
export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    checked_in: "Checked In",
    confirmed: "Confirmed",
    pending: "Pending",
    cancelled: "Cancelled",
    no_show: "No Show",
    delivered: "Delivered",
    preparing: "Preparing",
    ready: "Ready for Pickup",
    completed: "Completed",
    failed: "Failed",
  };
  return labels[status] || status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
