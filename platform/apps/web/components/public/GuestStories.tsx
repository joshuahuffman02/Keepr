"use client";

import { useMemo, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Star, Quote, ChevronRight, Heart } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

interface GuestStoriesProps {
  className?: string;
  variant?: "light" | "warm";
}

export function GuestStories({ className, variant = "warm" }: GuestStoriesProps) {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const prefersReducedMotion = useReducedMotionSafe();
  const campgroundsQuery = useQuery({
    queryKey: ["public-campgrounds"],
    queryFn: () => apiClient.getPublicCampgrounds(),
    staleTime: 10 * 60 * 1000,
  });

  const storiesQuery = useQuery({
    queryKey: ["public-guest-stories", campgroundsQuery.data?.length ?? 0],
    enabled: (campgroundsQuery.data?.length ?? 0) > 0,
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const campgrounds = campgroundsQuery.data ?? [];
      const candidates = campgrounds
        .filter((cg) => !cg.isExternal && (cg.reviewCount ?? 0) > 0 && cg.slug)
        .sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0))
        .slice(0, 12);

      const reviewsByCampground = await Promise.all(
        candidates.map(async (cg) => {
          try {
            const reviews = await apiClient.getPublicReviews(cg.id);
            return { campground: cg, reviews };
          } catch {
            return { campground: cg, reviews: [] };
          }
        })
      );

      const stories: Array<{
        id: string;
        quote: string;
        campgroundName: string;
        campgroundLocation: string;
        campgroundSlug: string;
        stayType: string;
      }> = [];
      const seen = new Set<string>();

      for (const { campground, reviews } of reviewsByCampground) {
        const fiveStarReviews = reviews
          .filter((review) => Math.round(review.rating) === 5)
          .sort((a, b) => {
            const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return bTime - aTime;
          });

        for (const review of fiveStarReviews) {
          if (stories.length >= 6) break;
          if (seen.has(review.id)) continue;
          const quote = (review.body || review.title || "").trim();
          if (!quote) continue;
          const stayType = (review.tags || []).find(Boolean) || "5-star stay";
          const campgroundLocation = [campground.city, campground.state].filter(Boolean).join(", ");

          stories.push({
            id: review.id,
            quote,
            campgroundName: campground.name,
            campgroundLocation,
            campgroundSlug: campground.slug,
            stayType,
          });
          seen.add(review.id);
        }

        if (stories.length >= 6) break;
      }

      return stories;
    },
  });

  const guestStories = useMemo(() => {
    const items = storiesQuery.data ?? [];
    return items.length >= 3 ? items.slice(0, 3) : [];
  }, [storiesQuery.data]);

  if (guestStories.length < 3) {
    return null;
  }

  const variantStyles = {
    light: {
      bg: "bg-white",
      cardBg: "bg-slate-50",
      border: "border-slate-100",
    },
    warm: {
      bg: "bg-gradient-to-br from-amber-50/50 via-rose-50/30 to-orange-50/40",
      cardBg: "bg-white",
      border: "border-amber-100/50",
    },
  };

  const styles = variantStyles[variant];

  const containerVariants = {
    hidden: { opacity: prefersReducedMotion ? 1 : 0 },
    visible: {
      opacity: 1,
      transition: prefersReducedMotion ? undefined : { staggerChildren: 0.15 },
    },
  };

  const itemVariants = {
    hidden: { opacity: prefersReducedMotion ? 1 : 0, y: prefersReducedMotion ? 0 : 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: prefersReducedMotion ? undefined : { duration: 0.5, ease: "easeOut" as const },
    },
  };

  const headerVariants = prefersReducedMotion
    ? { initial: { opacity: 1 }, animate: { opacity: 1 }, transition: undefined }
    : {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.6 },
      };

  return (
    <section
      ref={ref}
      className={cn("py-20 overflow-hidden", styles.bg, className)}
    >
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <motion.div
          {...headerVariants}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-rose-100 text-rose-700 rounded-full text-sm font-medium mb-4">
            <Heart className="w-4 h-4 fill-rose-500" />
            <span>Real Stories, Real Families</span>
          </div>

          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
            What Our Guests Are Saying
          </h2>

          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            These aren't just reviews - they're the beginning of family traditions,
            new friendships, and stories told around campfires for years to come.
          </p>
        </motion.div>

        {/* Stories Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {guestStories.map((story) => (
            <motion.div
              key={story.id}
              variants={itemVariants}
            >
              <Link
                href={`/park/${story.campgroundSlug}`}
                className={cn(
                  "relative block rounded-2xl p-6 border shadow-lg shadow-slate-900/5 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-keepr-evergreen focus-visible:ring-offset-2",
                  styles.cardBg,
                  styles.border
                )}
              >
                {/* Quote Icon */}
                <div className="absolute -top-3 -left-2">
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                    <Quote className="w-5 h-5 text-amber-600" />
                  </div>
                </div>

                {/* Rating */}
                <div className="flex items-center gap-1 mb-4 pt-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className="w-4 h-4 text-amber-400 fill-amber-400"
                    />
                  ))}
                  <span className="ml-2 text-xs text-slate-500 font-medium">
                    {story.stayType}
                  </span>
                </div>

                {/* Quote */}
                <blockquote className="text-slate-700 leading-relaxed mb-6">
                  "{story.quote}"
                </blockquote>

                {/* Guest Info */}
                <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                  {/* Avatar with initials */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-keepr-evergreen to-teal-500 flex items-center justify-center text-white font-semibold text-sm">
                    KG
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">
                      Keepr Guest
                    </p>
                    <p className="text-xs text-slate-500">
                      {story.campgroundLocation ? `${story.campgroundLocation} · ` : ""}{story.campgroundName}
                    </p>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="text-center mt-12"
        >
          <Link
            href="/browse"
            className="inline-flex items-center gap-2 px-6 py-3 bg-keepr-evergreen hover:bg-keepr-evergreen/90 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-xl"
          >
            Find Your Story
            <ChevronRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
