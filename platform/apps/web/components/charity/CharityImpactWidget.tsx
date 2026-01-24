"use client";

import { useEffect, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useReducedMotion } from "framer-motion";
import { DollarSign, Heart, Settings, Users } from "lucide-react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";

// Animated counter hook
function useAnimatedCounter(end: number, duration: number = 1500, start: boolean = true) {
  const [count, setCount] = useState(0);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!start || end === 0) {
      setCount(end);
      return;
    }

    if (prefersReducedMotion) {
      setCount(end);
      return;
    }

    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(easeOut * end));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration, start, prefersReducedMotion]);

  return count;
}

function formatDollars(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1000) {
    return `$${(dollars / 1000).toFixed(1)}K`;
  }
  return `$${dollars.toFixed(2)}`;
}

// Encouraging messages based on stats
function getEncouragingMessage(totalCents: number, optInRate: number): string {
  if (totalCents === 0) return "Start making a difference today!";
  if (optInRate >= 50) return "Your guests love giving back!";
  if (optInRate >= 25) return "Growing generosity every day!";
  if (totalCents >= 50000) return "Amazing impact!";
  if (totalCents >= 10000) return "You're making waves!";
  return "Every dollar counts!";
}

interface CharityImpactWidgetProps {
  campgroundId: string;
}

export function CharityImpactWidget({ campgroundId }: CharityImpactWidgetProps) {
  const [hasAnimated, setHasAnimated] = useState(false);

  // Get campground charity settings
  const { data: charitySettings, isLoading: loadingSettings } = useQuery({
    queryKey: ["campground-charity", campgroundId],
    queryFn: () => apiClient.getCampgroundCharity(campgroundId),
    enabled: !!campgroundId,
    staleTime: 5 * 60 * 1000, // 5 minutes - charity settings rarely change
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnMount: false, // Don't refetch on mount if data exists
    retry: 1, // Only retry once on failure
  });

  // Get donation stats
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ["campground-charity-stats", campgroundId],
    queryFn: () => apiClient.getCampgroundCharityStats(campgroundId),
    enabled: !!campgroundId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
  });

  // Trigger animation after stats load (don't block on settings)
  useEffect(() => {
    if (!loadingStats && stats) {
      setHasAnimated(true);
    }
  }, [loadingStats, stats]);

  const animatedTotal = useAnimatedCounter(stats?.totalAmountCents ?? 0, 1800, hasAnimated);

  const animatedDonations = useAnimatedCounter(stats?.totalDonations ?? 0, 1500, hasAnimated);

  const animatedDonors = useAnimatedCounter(stats?.donorCount ?? 0, 1300, hasAnimated);

  const statsLoading = loadingStats && !stats;

  // Only show full skeleton while initial settings load
  if (loadingSettings && !charitySettings) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border">
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-muted" />
                <div className="space-y-2">
                  <div className="h-4 w-32 bg-muted rounded" />
                  <div className="h-3 w-24 bg-muted rounded" />
                </div>
              </div>
              <div className="h-8 w-28 bg-muted rounded" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-6">
            <div className="animate-pulse">
              <div className="grid grid-cols-3 gap-4 text-center">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={`charity-skeleton-${index}`} className="space-y-2">
                    <div className="h-6 w-12 bg-muted rounded mx-auto" />
                    <div className="h-3 w-16 bg-muted rounded mx-auto" />
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-border space-y-2">
                <div className="h-3 w-full bg-muted rounded" />
                <div className="h-3 w-2/3 bg-muted rounded" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If charity is not enabled, show setup prompt
  if (!charitySettings || !charitySettings.isEnabled) {
    return (
      <Card className="border-border">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-muted p-3">
              <Heart className="h-6 w-6 text-rose-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground mb-1">Community impact</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Enable round-up donations so guests can support a charity with every stay.
              </p>
              <Link
                href="/dashboard/settings/charity"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors"
              >
                <Settings className="h-4 w-4" />
                Set Up Charity
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const charityName = charitySettings?.charity?.name ?? "Charity";
  const optInRate = stats?.optInRate ?? 0;
  const averageDonationDisplay =
    stats && stats.totalDonations > 0 ? formatDollars(stats.averageDonationCents ?? 0) : "—";
  const optInDisplay = stats ? `${optInRate.toFixed(0)}%` : "—";

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="border-border">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-muted p-2">
                <Heart className="h-5 w-5 text-rose-600" />
              </span>
              <div>
                <div className="text-sm font-semibold text-foreground">Community impact</div>
                <div className="text-xs text-muted-foreground">Donations to {charityName}</div>
              </div>
            </div>
            <Link
              href="/dashboard/settings/charity"
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Charity settings"
            >
              <Settings className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-4 flex items-end justify-between gap-4">
            {statsLoading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-3 w-20 bg-muted rounded" />
                <div className="h-8 w-28 bg-muted rounded" />
              </div>
            ) : (
              <>
                <div>
                  <div className="text-xs text-muted-foreground">Total raised</div>
                  <div className="text-3xl font-semibold text-rose-600">
                    {formatDollars(animatedTotal)}
                  </div>
                </div>
                {stats && stats.totalDonations > 0 ? (
                  <div className="text-xs font-semibold text-emerald-600">
                    {getEncouragingMessage(stats.totalAmountCents, optInRate)}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border overflow-hidden">
        <CardContent className="p-6">
          {statsLoading ? (
            <div className="animate-pulse">
              <div className="grid grid-cols-3 gap-2 text-center">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={`charity-stats-skeleton-${index}`} className="space-y-2 min-w-0">
                    <div className="h-6 w-12 bg-muted rounded mx-auto" />
                    <div className="h-3 w-16 bg-muted rounded mx-auto" />
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-border space-y-2">
                <div className="h-3 w-full bg-muted rounded" />
                <div className="h-3 w-2/3 bg-muted rounded" />
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="min-w-0">
                  <div className="flex items-center justify-center gap-1 mb-2">
                    <Heart className="h-5 w-5 text-rose-500 shrink-0" />
                  </div>
                  <p className="text-2xl font-bold text-rose-600">{animatedDonations}</p>
                  <p className="text-xs text-muted-foreground truncate">Donations</p>
                  <p className="text-sm text-rose-600 truncate">Avg {averageDonationDisplay}</p>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center justify-center gap-1 mb-2">
                    <Users className="h-5 w-5 text-sky-500 shrink-0" />
                  </div>
                  <p className="text-2xl font-bold text-sky-600">{animatedDonors}</p>
                  <p className="text-xs text-muted-foreground truncate">Donors</p>
                  <p className="text-sm text-sky-600 truncate">Unique guests</p>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center justify-center gap-1 mb-2">
                    <DollarSign className="h-5 w-5 text-emerald-500 shrink-0" />
                  </div>
                  <p className="text-2xl font-bold text-emerald-600">{optInDisplay}</p>
                  <p className="text-xs text-muted-foreground truncate">Opt-in rate</p>
                  <p className="text-sm text-emerald-600 truncate">Of reservations</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Average donation</span>
                  <span className="text-foreground font-medium">{averageDonationDisplay}</span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-muted-foreground">Default opt-in</span>
                  <span className="text-foreground font-medium">
                    {charitySettings.defaultOptIn ? "Yes" : "No"}
                  </span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
