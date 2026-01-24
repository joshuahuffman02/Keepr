"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon, Inbox } from "lucide-react";
import { Button } from "./button";

interface EmptyStateProps {
  /** Icon to display (defaults to Inbox) */
  icon?: LucideIcon;
  /** Main title text */
  title: string;
  /** Optional description text */
  description?: string;
  /** Optional action button */
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  /** Optional link action (alternative to button) */
  href?: {
    label: string;
    url: string;
    icon?: LucideIcon;
  };
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Additional class names */
  className?: string;
}

const sizeConfig = {
  sm: {
    wrapper: "py-6",
    iconWrapper: "h-10 w-10",
    icon: "h-5 w-5",
    title: "text-sm font-medium",
    description: "text-xs",
  },
  md: {
    wrapper: "py-8",
    iconWrapper: "h-12 w-12",
    icon: "h-6 w-6",
    title: "text-base font-medium",
    description: "text-sm",
  },
  lg: {
    wrapper: "py-12",
    iconWrapper: "h-16 w-16",
    icon: "h-8 w-8",
    title: "text-lg font-semibold",
    description: "text-base",
  },
};

/**
 * Empty state component for displaying when there's no data.
 * Use this for consistent empty states across the application.
 *
 * @example
 * <EmptyState
 *   icon={Users}
 *   title="No guests yet"
 *   description="Guests will appear here when you create reservations."
 *   action={{ label: "Add Guest", onClick: () => {} }}
 * />
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  href,
  size = "md",
  className,
}: EmptyStateProps) {
  const config = sizeConfig[size];
  const ActionIcon = action?.icon;
  const LinkIcon = href?.icon;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        config.wrapper,
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-muted mb-3",
          config.iconWrapper,
        )}
      >
        <Icon className={cn("text-muted-foreground", config.icon)} />
      </div>
      <h3 className={cn("text-foreground", config.title)}>{title}</h3>
      {description && (
        <p className={cn("text-muted-foreground mt-1 max-w-sm", config.description)}>
          {description}
        </p>
      )}
      {action && (
        <Button onClick={action.onClick} size={size === "sm" ? "sm" : "default"} className="mt-4">
          {ActionIcon && <ActionIcon className="h-4 w-4 mr-2" />}
          {action.label}
        </Button>
      )}
      {href && (
        <Button asChild variant="outline" size={size === "sm" ? "sm" : "default"} className="mt-4">
          <a href={href.url}>
            {LinkIcon && <LinkIcon className="h-4 w-4 mr-2" />}
            {href.label}
          </a>
        </Button>
      )}
    </div>
  );
}

/**
 * Simple inline empty state for use within cards/sections.
 * More compact than the full EmptyState component.
 *
 * @example
 * <InlineEmpty>No transactions found.</InlineEmpty>
 */
export function InlineEmpty({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("text-center py-4 text-sm text-muted-foreground", className)}>
      {children}
    </div>
  );
}

/**
 * Empty state for cards - includes border and padding.
 *
 * @example
 * <CardEmpty
 *   icon={FileText}
 *   title="No documents"
 *   description="Upload documents to get started."
 * />
 */
export function CardEmpty({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: Omit<EmptyStateProps, "size" | "href"> & { className?: string }) {
  const ActionIcon = action?.icon;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-8 px-4 border border-dashed border-muted-foreground/25 rounded-lg",
        className,
      )}
    >
      <div className="flex items-center justify-center h-12 w-12 rounded-full bg-muted mb-3">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-xs">{description}</p>}
      {action && (
        <Button onClick={action.onClick} size="sm" className="mt-4">
          {ActionIcon && <ActionIcon className="h-4 w-4 mr-2" />}
          {action.label}
        </Button>
      )}
    </div>
  );
}
