"use client";

import { Flame, TrendingUp, Calendar } from "lucide-react";
import { CampgroundCard } from "./CampgroundCard";
import { ScarcityBadge } from "./ScarcityIndicator";
import { cn } from "../../lib/utils";
import { trackEvent } from "@/lib/analytics";

interface Campground {
  id: string;
  name: string;
  slug?: string;
  city?: string;
  state?: string;
  country?: string;
  heroImageUrl?: string;
  isInternal: boolean;
  rating?: number;
  reviewCount?: number;
  pricePerNight?: number;
  amenities?: string[];
  npsBadge?: {
    type: "world-class" | "top-campground" | "top-1" | "top-5" | "top-10" | "rising-star";
    label: string;
  };
  pastAwards?: number[];
  // For scarcity
  availableSites?: number;
}

interface UrgencySectionProps {
  campgrounds: Campground[];
  className?: string;
  title?: string;
  subtitle?: string;
}

export function UrgencySection({
  campgrounds,
  className,
  title = "Popular This Weekend",
  subtitle = "These campgrounds are booking fast. Don't miss out!",
}: UrgencySectionProps) {
  // Show top 6 campgrounds, prioritize those with limited availability
  const sortedCampgrounds = [...campgrounds]
    .filter((c) => c.isInternal) // Only show our campgrounds
    .sort((a, b) => {
      // Prioritize by scarcity first (if available)
      if (a.availableSites !== undefined && b.availableSites !== undefined) {
        return a.availableSites - b.availableSites;
      }
      // Then by rating
      return (b.rating || 0) - (a.rating || 0);
    })
    .slice(0, 6);

  if (sortedCampgrounds.length === 0) return null;

  return (
    <section className={cn("py-16 md:py-20 bg-gradient-to-b from-white to-slate-50", className)}>
      <div className="max-w-7xl mx-auto px-6">
        {/* Section header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8 md:mb-12">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Flame className="h-6 w-6 text-orange-500" />
              <h2 className="text-2xl md:text-3xl font-bold text-foreground">{title}</h2>
            </div>
            <p className="text-muted-foreground">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            <span>Based on recent bookings</span>
          </div>
        </div>

        {/* Urgency banner */}
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100 rounded-xl p-4 mb-8 flex items-center gap-3">
          <Calendar className="h-5 w-5 text-orange-600 flex-shrink-0" />
          <p className="text-sm text-orange-800">
            <strong>Weekend bookings fill up fast!</strong> Book now to secure your spot.
          </p>
        </div>

        {/* Campground grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedCampgrounds.map((campground) => (
            <div key={campground.id} className="relative">
              {/* Scarcity badge overlay */}
              {campground.availableSites !== undefined && campground.availableSites <= 5 && (
                <div className="absolute top-3 left-3 z-10">
                  <ScarcityBadge sitesLeft={campground.availableSites} />
                </div>
              )}

              <CampgroundCard
                id={campground.id}
                name={campground.name}
                slug={campground.slug}
                city={campground.city}
                state={campground.state}
                country={campground.country}
                imageUrl={campground.heroImageUrl}
                isInternal={campground.isInternal}
                rating={campground.rating}
                reviewCount={campground.reviewCount}
                pricePerNight={campground.pricePerNight}
                amenities={campground.amenities}
                npsBadge={campground.npsBadge}
                pastAwards={campground.pastAwards}
                onExplore={() =>
                  trackEvent("urgency_card_click", {
                    campgroundId: campground.id,
                    metadata: { section: "popular_weekend" },
                  })
                }
              />
            </div>
          ))}
        </div>

        {/* View all link */}
        <div className="mt-10 text-center">
          <a
            href="#featured"
            className="text-emerald-600 hover:text-emerald-700 font-semibold inline-flex items-center gap-1"
          >
            View all campgrounds
            <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    </section>
  );
}
