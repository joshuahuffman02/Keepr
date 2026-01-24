"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import {
  Star,
  MapPin,
  Sparkles,
  ArrowRight,
  Shield,
  Wifi,
  Flame,
  Mountain,
  Trophy,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";

interface FeaturedCampgroundProps {
  variant?: "refined" | "warm" | "bold";
  className?: string;
  /** ID of campground to exclude (e.g., the one shown in hero banner) */
  excludeId?: string | null;
}

export function FeaturedCampground({
  variant = "refined",
  className,
  excludeId,
}: FeaturedCampgroundProps) {
  const prefersReducedMotion = useReducedMotionSafe();

  // Fetch real campground data
  const { data: campgrounds, isLoading } = useQuery({
    queryKey: ["public-campgrounds-featured"],
    queryFn: () => apiClient.getPublicCampgrounds({ limit: 100 }),
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: false,
  });

  const eligibleCampgrounds =
    campgrounds?.filter((c) => {
      // Exclude the campground shown in the hero banner to avoid duplication
      if (excludeId && c.id === excludeId) return false;
      const hasHero = Boolean(c.heroImageUrl);
      const hasGallery = (c.photos?.length ?? 0) > 0;
      return !c.isExternal && hasHero && hasGallery;
    }) ?? [];

  const scoreByQuality = (
    a: (typeof eligibleCampgrounds)[number],
    b: (typeof eligibleCampgrounds)[number],
  ) => {
    const npsA = typeof a.npsScore === "number" ? a.npsScore : a.isWorldClassNps ? 70 : 0;
    const npsB = typeof b.npsScore === "number" ? b.npsScore : b.isWorldClassNps ? 70 : 0;
    if (npsB !== npsA) return npsB - npsA;
    const ratingA = (a.reviewScore ?? 0) * Math.sqrt(a.reviewCount ?? 0);
    const ratingB = (b.reviewScore ?? 0) * Math.sqrt(b.reviewCount ?? 0);
    return ratingB - ratingA;
  };

  const scoreByImprovement = (
    a: (typeof eligibleCampgrounds)[number],
    b: (typeof eligibleCampgrounds)[number],
  ) => {
    const risingA = a.isRisingStar ? 1 : 0;
    const risingB = b.isRisingStar ? 1 : 0;
    if (risingB !== risingA) return risingB - risingA;
    const improvementA = typeof a.npsImprovement === "number" ? a.npsImprovement : 0;
    const improvementB = typeof b.npsImprovement === "number" ? b.npsImprovement : 0;
    if (improvementB !== improvementA) return improvementB - improvementA;
    return scoreByQuality(a, b);
  };

  const risingStarCandidates = eligibleCampgrounds.filter(
    (c) => c.isRisingStar || (typeof c.npsImprovement === "number" && c.npsImprovement > 0),
  );

  const featured =
    risingStarCandidates.length > 0
      ? [...risingStarCandidates].sort(scoreByImprovement)[0]
      : [...eligibleCampgrounds].sort(scoreByQuality)[0];

  const variantStyles = {
    refined: {
      bg: "bg-slate-50",
      cardBg: "bg-white",
      accentColor: "text-keepr-evergreen",
      accentBg: "bg-keepr-evergreen",
      badgeBg: "bg-keepr-evergreen/10 text-keepr-evergreen",
      buttonBg: "bg-keepr-evergreen hover:bg-keepr-evergreen/90",
    },
    warm: {
      bg: "bg-gradient-to-br from-amber-50 via-orange-50/50 to-rose-50/30",
      cardBg: "bg-white",
      accentColor: "text-amber-600",
      accentBg: "bg-amber-500",
      badgeBg: "bg-amber-100 text-amber-700",
      buttonBg: "bg-amber-500 hover:bg-amber-600",
    },
    bold: {
      bg: "bg-keepr-charcoal",
      cardBg: "bg-slate-900",
      accentColor: "text-keepr-clay",
      accentBg: "bg-keepr-clay",
      badgeBg: "bg-keepr-clay/20 text-keepr-clay",
      buttonBg: "bg-keepr-clay hover:bg-keepr-clay/90",
    },
  };

  const styles = variantStyles[variant];
  const isDark = variant === "bold";

  // Don't render if no featured campground found
  if (!isLoading && !featured) {
    return null;
  }

  // Loading skeleton
  if (isLoading) {
    return (
      <section className={cn("py-20 overflow-hidden", styles.bg, className)}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="h-8 w-48 bg-slate-200 rounded-full mx-auto mb-4 animate-pulse" />
            <div className="h-12 w-80 bg-slate-200 rounded-lg mx-auto animate-pulse" />
          </div>
          <div className="rounded-3xl overflow-hidden bg-white shadow-xl">
            <div className="grid lg:grid-cols-2">
              <div className="aspect-[4/3] bg-slate-200 animate-pulse" />
              <div className="p-12 space-y-4">
                <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
                <div className="h-8 w-64 bg-slate-200 rounded animate-pulse" />
                <div className="h-20 w-full bg-slate-200 rounded animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // TypeScript guard - we know featured exists here due to early return above
  if (!featured) return null;

  // Extract display data
  const location = [featured.city, featured.state].filter(Boolean).join(", ");
  const rating = featured.reviewScore ?? 0;
  const reviewCount = featured.reviewCount ?? 0;
  const hasReviews = reviewCount >= 3;
  const amenities = featured.amenities?.slice(0, 4) ?? [];
  const heroImage = featured.heroImageUrl || featured.photos?.[0] || null;
  const npsScore = typeof featured.npsScore === "number" ? featured.npsScore : null;
  const hasNpsScore = npsScore !== null;
  const hasWorldClassNps = hasNpsScore ? npsScore >= 70 : featured.isWorldClassNps;
  const hasImprovement = typeof featured.npsImprovement === "number" && featured.npsImprovement > 0;
  const isRisingStar = featured.isRisingStar || hasImprovement;
  const tagline =
    featured.tagline ||
    (amenities.length > 0 ? `Popular amenities: ${amenities.slice(0, 3).join(", ")}` : "");

  // Determine badge text based on campground status
  const badgeText = isRisingStar
    ? "Rising Star"
    : featured.isTopCampground
      ? "Top Rated Campground"
      : hasWorldClassNps
        ? "World-Class Service"
        : hasReviews && rating >= 4.5
          ? "Highly Rated"
          : "Featured Pick";

  const motionProps = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 20 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true },
      };

  const cardMotionProps = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 40 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true },
        transition: { duration: 0.6 },
      };

  return (
    <section className={cn("py-20 overflow-hidden", styles.bg, className)}>
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <motion.div {...motionProps} className="text-center mb-12">
          <div
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-4",
              styles.badgeBg,
            )}
          >
            <Sparkles className="w-4 h-4" />
            <span>{isRisingStar ? "Rising Star" : "Featured Destination"}</span>
          </div>

          <h2
            className={cn(
              "text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight",
              isDark ? "text-white" : "text-slate-900",
            )}
          >
            {variant === "warm"
              ? "This Week's Top Pick"
              : variant === "bold"
                ? "Editor's Choice"
                : "Spotlight Campground"}
          </h2>
        </motion.div>

        {/* Featured Card */}
        <motion.div
          {...cardMotionProps}
          className={cn(
            "rounded-3xl overflow-hidden shadow-2xl",
            styles.cardBg,
            isDark ? "shadow-black/30" : "shadow-slate-200/50",
          )}
        >
          <div className={cn("grid", heroImage ? "lg:grid-cols-2" : "grid-cols-1")}>
            {/* Image Section */}
            {heroImage && (
              <div className="relative aspect-[4/3] lg:aspect-auto lg:min-h-[400px]">
                <Image
                  src={heroImage}
                  alt={featured.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  priority
                />

                {/* Overlay Gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                {/* Badge */}
                <div
                  className={cn(
                    "absolute top-6 left-6 px-4 py-2 rounded-full text-sm font-bold text-white shadow-lg flex items-center gap-2",
                    styles.accentBg,
                  )}
                >
                  {featured.isTopCampground && <Trophy className="w-4 h-4" />}
                  {badgeText}
                </div>

                {/* Rating on image - only show if we have reviews */}
                {hasReviews && (
                  <div className="absolute bottom-6 left-6 flex items-center gap-2 bg-white/95 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg">
                    <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                    <span className="font-bold text-slate-900">{rating.toFixed(1)}</span>
                    <span className="text-slate-500 text-sm">({reviewCount} reviews)</span>
                  </div>
                )}
              </div>
            )}

            {/* Content Section */}
            <div className="p-8 lg:p-12 flex flex-col justify-center">
              {/* Location */}
              {location && (
                <div
                  className={cn(
                    "flex items-center gap-2 text-sm mb-3",
                    isDark ? "text-slate-400" : "text-slate-500",
                  )}
                >
                  <MapPin className="w-4 h-4" />
                  {location}
                </div>
              )}

              {/* Name & Tagline */}
              <h3
                className={cn(
                  "text-2xl md:text-3xl font-bold mb-2",
                  isDark ? "text-white" : "text-slate-900",
                )}
              >
                {featured.name}
              </h3>
              {tagline && (
                <p className={cn("text-lg mb-6", isDark ? "text-slate-400" : "text-slate-600")}>
                  {tagline}
                </p>
              )}

              {/* Features */}
              {amenities.length > 0 && (
                <div className="flex flex-wrap gap-3 mb-8">
                  {amenities.map((amenity, i) => {
                    const icons = [Mountain, Shield, Wifi, Flame];
                    const Icon = icons[i % icons.length];
                    return (
                      <div
                        key={amenity}
                        className={cn(
                          "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm",
                          isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-700",
                        )}
                      >
                        <Icon className={cn("w-4 h-4", styles.accentColor)} />
                        {amenity}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Trust Signal instead of fake quote */}
              <div
                className={cn(
                  "border-l-4 pl-4 mb-8",
                  variant === "warm"
                    ? "border-amber-400"
                    : variant === "bold"
                      ? "border-keepr-clay"
                      : "border-keepr-evergreen",
                )}
              >
                {(hasReviews || hasImprovement || hasWorldClassNps || amenities.length > 0) && (
                  <p className={cn("mb-2", isDark ? "text-slate-300" : "text-slate-600")}>
                    {hasImprovement
                      ? "Guest satisfaction is climbing fast with recent stays."
                      : hasReviews
                        ? `Rated ${rating.toFixed(1)} by ${reviewCount} guests.`
                        : hasWorldClassNps
                          ? "Recognized for standout guest care."
                          : `Popular amenities include ${amenities.slice(0, 3).join(", ")}.`}
                  </p>
                )}
                <div
                  className={cn(
                    "text-sm font-medium flex items-center gap-2",
                    isDark ? "text-slate-400" : "text-slate-500",
                  )}
                >
                  <Shield className="w-4 h-4" />
                  Verified by Keepr
                </div>
              </div>

              {/* CTA */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className={cn("text-sm", isDark ? "text-slate-400" : "text-slate-500")}>
                  {hasReviews && (
                    <span className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                      <strong className={isDark ? "text-white" : "text-slate-900"}>
                        {rating.toFixed(1)}
                      </strong>
                      <span>from {reviewCount} reviews</span>
                    </span>
                  )}
                </div>

                <Link
                  href={`/park/${featured.slug}`}
                  className={cn(
                    "group flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold transition-all shadow-lg hover:shadow-xl",
                    styles.buttonBg,
                  )}
                >
                  Explore This Campground
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
