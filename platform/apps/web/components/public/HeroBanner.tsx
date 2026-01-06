"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Shield, CheckCircle2, Star } from "lucide-react";
import { SearchBar } from "./SearchBar";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";

type FeaturedBadgeTone = "world-class" | "top-rated" | "featured";

interface HeroBannerProps {
  onSearch: (query: string, filters: {
    location: string;
    dates: { checkIn: string; checkOut: string };
    guests: number;
  } | null) => void;
  featuredCampground?: {
    id: string;
    name: string;
    slug?: string | null;
    city?: string | null;
    state?: string | null;
    imageUrl: string;
    rating?: number | null;
    reviewCount?: number | null;
    badgeLabel: string;
    badgeTone: FeaturedBadgeTone;
  } | null;
  isLoadingFeatured?: boolean;
}

/**
 * HeroBanner - Refined Design
 *
 * Design principles:
 * - Full-bleed campground photo with gradient overlay
 * - Clean, spacious layout with elevated typography
 * - Trust signals prominently displayed
 * - Floating featured campground preview on XL screens
 * - Smooth transition to white content below
 */
export function HeroBanner({ onSearch, featuredCampground, isLoadingFeatured = false }: HeroBannerProps) {
  const prefersReducedMotion = useReducedMotionSafe();
  const hasFeatured = !!featuredCampground;
  const showSkeleton = isLoadingFeatured && !hasFeatured;
  const featuredLocation = featuredCampground
    ? [featuredCampground.city, featuredCampground.state].filter(Boolean).join(", ")
    : "";
  const hasFeaturedReviews =
    typeof featuredCampground?.rating === "number" &&
    (featuredCampground?.reviewCount ?? 0) > 0;
  const badgeToneStyles: Record<FeaturedBadgeTone, string> = {
    "world-class": "bg-keepr-evergreen text-white",
    "top-rated": "bg-amber-500 text-white",
    "featured": "bg-slate-800 text-white",
  };

  // Animation variants - disabled if user prefers reduced motion
  const fadeUp = prefersReducedMotion
    ? { initial: {}, animate: {} }
    : {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
      };

  const fadeUpDelayed = (delay: number) =>
    prefersReducedMotion
      ? { initial: {}, animate: {}, transition: {} }
      : {
          initial: { opacity: 0, y: 30 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, delay },
        };

  const fadeInRight = prefersReducedMotion
    ? { initial: {}, animate: {}, transition: {} }
    : {
        initial: { opacity: 0, x: 50 },
        animate: { opacity: 1, x: 0 },
        transition: { duration: 0.7, delay: 0.6 },
      };

  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0">
        <Image
          src="https://images.unsplash.com/photo-1504280390367-361c6d9f38f4"
          alt="Peaceful campground at sunset"
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />
        {/* Refined overlay - softer gradient for warmth */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/80 via-slate-900/60 to-slate-900/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-slate-900/30" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-24 w-full">
        <div className="max-w-3xl">
          {/* Trust Badge */}
          <motion.div
            {...fadeUp}
            transition={{ duration: 0.5 }}
            className="mb-6"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20">
              <Shield className="w-4 h-4 text-keepr-evergreen" />
              <span className="text-sm text-white/90 font-medium">
                Verified campgrounds, transparent pricing
              </span>
              <div className="flex items-center gap-0.5 ml-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    className="w-3.5 h-3.5 text-amber-400 fill-amber-400"
                  />
                ))}
              </div>
            </div>
          </motion.div>

          {/* Main Headline - Elevated typography */}
          <motion.h1
            {...fadeUpDelayed(0.1)}
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-white tracking-tight leading-[0.95] mb-6"
          >
            Find your{" "}
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-keepr-evergreen to-teal-400">
              perfect escape
            </span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            {...fadeUpDelayed(0.2)}
            className="text-xl md:text-2xl text-white/80 mb-10 max-w-xl leading-relaxed"
          >
            Discover verified campgrounds with transparent pricing. Book
            directly, no surprises.
          </motion.p>

          {/* Search Box - Uses existing SearchBar component */}
          <motion.div {...fadeUpDelayed(0.3)}>
            <SearchBar onSearch={onSearch} />
          </motion.div>

          {/* Trust Signals Row */}
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0 }}
            animate={prefersReducedMotion ? {} : { opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-10 flex flex-wrap items-center gap-6"
          >
            {[
              { icon: CheckCircle2, text: "Verified reviews" },
              { icon: Shield, text: "Secure booking" },
              { icon: Star, text: "Best price guarantee" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-white/70">
                <item.icon className="w-4 h-4 text-keepr-evergreen" />
                <span className="text-sm font-medium">{item.text}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Floating Card - Featured Campground Preview (XL screens only) */}
      {(hasFeatured || showSkeleton) && (
        <motion.div
          {...fadeInRight}
          className="hidden xl:block absolute right-16 top-1/2 -translate-y-1/2 z-20"
        >
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 border border-white/20 shadow-2xl w-[288px]">
            {showSkeleton ? (
              <div className="space-y-3">
                <div className="h-40 rounded-xl bg-white/10 animate-pulse" />
                <div className="h-5 w-40 bg-white/10 rounded animate-pulse" />
                <div className="h-4 w-28 bg-white/10 rounded animate-pulse" />
                <div className="h-4 w-32 bg-white/10 rounded animate-pulse" />
              </div>
            ) : featuredCampground ? (
              <Link
                href={`/park/${featuredCampground.slug || featuredCampground.id}`}
                className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-keepr-evergreen focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900/40 hover:-translate-y-0.5 transition-transform"
                aria-label={`View ${featuredCampground.name}`}
              >
                <div className="relative w-64 h-40 rounded-xl overflow-hidden mb-3">
                  <Image
                    src={featuredCampground.imageUrl}
                    alt={featuredCampground.name}
                    fill
                    className="object-cover"
                    sizes="256px"
                  />
                  <div
                    className={`absolute top-2 left-2 px-2 py-1 text-xs font-bold rounded-full ${badgeToneStyles[featuredCampground.badgeTone]}`}
                  >
                    {featuredCampground.badgeLabel}
                  </div>
                </div>
                <h3 className="text-white font-semibold mb-1">
                  {featuredCampground.name}
                </h3>
                {featuredLocation && (
                  <p className="text-white/60 text-sm mb-2">{featuredLocation}</p>
                )}
                <div className="flex items-center justify-between">
                  {hasFeaturedReviews ? (
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                      <span className="text-white font-medium">
                        {featuredCampground.rating?.toFixed(1)}
                      </span>
                      <span className="text-white/50 text-sm">({featuredCampground.reviewCount})</span>
                    </div>
                  ) : (
                    <span className="text-white/60 text-xs">Verified guest favorite</span>
                  )}
                  <span className="text-keepr-evergreen text-sm font-medium hover:underline">
                    View →
                  </span>
                </div>
              </Link>
            ) : null}
          </div>
        </motion.div>
      )}

      {/* Bottom gradient for smooth transition to white content */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent" />
    </section>
  );
}
