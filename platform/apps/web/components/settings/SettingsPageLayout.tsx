"use client";

import { ReactNode } from "react";
import { LucideIcon, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { HelpAnchor } from "@/components/help/HelpAnchor";

interface SettingsPageLayoutProps {
  /** Page title */
  title: string;
  /** Page description shown below title */
  description: string;
  /** Icon component from lucide-react */
  icon: LucideIcon;
  /** Optional help topic ID for HelpAnchor */
  helpTopicId?: string;
  /** Whether data is loading */
  isLoading?: boolean;
  /** Whether a campground is selected */
  hasCampground?: boolean;
  /** Custom empty state message */
  emptyMessage?: string;
  /** Main content */
  children: ReactNode;
  /** Optional info banner above content */
  infoBanner?: ReactNode;
}

/**
 * Standard layout for settings pages following the gold standard pattern:
 * - max-w-4xl container
 * - Page header with icon + title + description
 * - Loading spinner state
 * - Empty state when no campground selected
 * - Consistent spacing and typography
 */
export function SettingsPageLayout({
  title,
  description,
  icon: Icon,
  helpTopicId,
  isLoading = false,
  hasCampground = true,
  emptyMessage = "Please select a campground to view settings.",
  children,
  infoBanner,
}: SettingsPageLayoutProps) {
  return (
    <div className="max-w-4xl space-y-6">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2">
          <Icon className="h-6 w-6 text-slate-500" />
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            {title}
          </h2>
          {helpTopicId && (
            <HelpAnchor topicId={helpTopicId} label={`${title} help`} />
          )}
        </div>
        <p className="text-slate-500 mt-1">{description}</p>
      </div>

      {/* Optional Info Banner */}
      {infoBanner}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      )}

      {/* No Campground Selected */}
      {!hasCampground && !isLoading && (
        <Card>
          <CardContent className="py-12 text-center">
            <Icon className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">{emptyMessage}</p>
          </CardContent>
        </Card>
      )}

      {/* Main Content - only show when loaded and has campground */}
      {!isLoading && hasCampground && children}
    </div>
  );
}

/**
 * Skeleton loader for settings cards
 */
export function SettingsCardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="space-y-2">
          <div className="h-5 w-32 bg-slate-200 rounded animate-pulse" />
          <div className="h-4 w-48 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="h-4 w-20 bg-slate-100 rounded animate-pulse" />
                <div className="h-10 bg-slate-100 rounded animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-24 bg-slate-100 rounded animate-pulse" />
                <div className="h-10 bg-slate-100 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Standard save button row for settings pages
 */
export function SettingsSaveButton({
  onClick,
  isPending,
  label = "Save Changes",
}: {
  onClick: () => void;
  isPending: boolean;
  label?: string;
}) {
  return (
    <div className="flex justify-end">
      <button
        onClick={onClick}
        disabled={isPending}
        className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
      >
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isPending ? "Saving..." : label}
      </button>
    </div>
  );
}
