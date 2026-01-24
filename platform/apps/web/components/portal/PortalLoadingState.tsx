"use client";

import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface PortalLoadingStateProps {
  variant?: "spinner" | "skeleton" | "page";
  message?: string;
}

export function PortalLoadingState({ variant = "spinner", message }: PortalLoadingStateProps) {
  if (variant === "spinner") {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </div>
    );
  }

  if (variant === "skeleton") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  // Full page skeleton - matches my-stay layout
  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Page header skeleton */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>

      {/* Hero skeleton */}
      <Skeleton className="h-48 md:h-64 w-full rounded-xl" />

      {/* Tabs skeleton */}
      <Skeleton className="h-10 w-full max-w-2xl" />

      {/* Content grid skeleton */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-14 rounded-full" />
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-36" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Inline loading for sections within a page
export function SectionLoadingState({ message }: { message?: string }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground py-4">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="text-sm">{message || "Loading..."}</span>
    </div>
  );
}

// Empty state with CTA
interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-12 space-y-4">
      <div className="flex justify-center text-muted-foreground/50">{icon}</div>
      <div className="space-y-2">
        <p className="text-lg font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">{description}</p>
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
