"use client";

import { useRef, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { CampgroundCard } from "./CampgroundCard";
import { useGeolocation, getStateName } from "../../hooks/use-geolocation";
import type { AdaCertificationLevel } from "../../lib/ada-accessibility";

// Region-based icons for state detection
// Map state abbreviations to URL slugs
const stateToSlug: Record<string, string> = {
  AL: "alabama", AK: "alaska", AZ: "arizona", AR: "arkansas", CA: "california",
  CO: "colorado", CT: "connecticut", DE: "delaware", FL: "florida", GA: "georgia",
  HI: "hawaii", ID: "idaho", IL: "illinois", IN: "indiana", IA: "iowa",
  KS: "kansas", KY: "kentucky", LA: "louisiana", ME: "maine", MD: "maryland",
  MA: "massachusetts", MI: "michigan", MN: "minnesota", MS: "mississippi", MO: "missouri",
  MT: "montana", NE: "nebraska", NV: "nevada", NH: "new-hampshire", NJ: "new-jersey",
  NM: "new-mexico", NY: "new-york", NC: "north-carolina", ND: "north-dakota", OH: "ohio",
  OK: "oklahoma", OR: "oregon", PA: "pennsylvania", RI: "rhode-island", SC: "south-carolina",
  SD: "south-dakota", TN: "tennessee", TX: "texas", UT: "utah", VT: "vermont",
  VA: "virginia", WA: "washington", WV: "west-virginia", WI: "wisconsin", WY: "wyoming",
  DC: "washington-dc"
};

// Region-based icons for state detection
const regionIcons: Record<string, string> = {
  // Mountain states
  CO: "/images/icons/regions/mountain.png",
  MT: "/images/icons/regions/mountain.png",
  WY: "/images/icons/regions/mountain.png",
  UT: "/images/icons/regions/mountain.png",
  ID: "/images/icons/regions/mountain.png",
  NV: "/images/icons/regions/mountain.png",
  // Coastal states
  CA: "/images/icons/regions/beach.png",
  FL: "/images/icons/regions/beach.png",
  HI: "/images/icons/regions/beach.png",
  SC: "/images/icons/regions/beach.png",
  NC: "/images/icons/regions/beach.png",
  GA: "/images/icons/regions/beach.png",
  TX: "/images/icons/regions/beach.png",
  AL: "/images/icons/regions/beach.png",
  MS: "/images/icons/regions/beach.png",
  LA: "/images/icons/regions/beach.png",
  // Pacific Northwest / Forest
  OR: "/images/icons/regions/forest.png",
  WA: "/images/icons/regions/forest.png",
  AK: "/images/icons/regions/forest.png",
  ME: "/images/icons/regions/forest.png",
  VT: "/images/icons/regions/forest.png",
  NH: "/images/icons/regions/forest.png",
  // Desert Southwest
  AZ: "/images/icons/regions/desert.png",
  NM: "/images/icons/regions/desert.png",
  // Lake states
  MI: "/images/icons/regions/lake.png",
  MN: "/images/icons/regions/lake.png",
  WI: "/images/icons/regions/lake.png",
  NY: "/images/icons/regions/lake.png",
  PA: "/images/icons/regions/lake.png",
  OH: "/images/icons/regions/lake.png",
};

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } }
} as const;

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 }
  }
};

const cardVariant = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.4 } }
};

type NpsBadgeType = "world-class" | "top-campground" | "top-1" | "top-5" | "top-10" | "rising-star";

interface CampgroundData {
  id: string;
  name: string;
  slug?: string;
  city?: string;
  state?: string;
  country?: string;
  heroImageUrl?: string;
  isInternal?: boolean;
  isExternal?: boolean;
  rating?: number;
  reviewCount?: number;
  pricePerNight?: number;
  amenities?: string[];
  npsBadge?: { type: NpsBadgeType; label: string };
  pastAwards?: number[];
  adaCertificationLevel?: AdaCertificationLevel;
  createdAt?: string;
}

interface LocationSectionsProps {
  campgrounds: CampgroundData[];
  className?: string;
}

interface SectionProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  iconImage?: string;
  campgrounds: CampgroundData[];
  viewAllHref?: string;
  viewAllLabel?: string;
  prefersReducedMotion: boolean | null;
}

function HorizontalScrollSection({
  title,
  subtitle,
  icon,
  iconImage,
  campgrounds,
  viewAllHref,
  viewAllLabel = "See all",
  prefersReducedMotion
}: SectionProps) {
  const sectionRef = useRef(null);
  const inView = useInView(sectionRef, { once: true, margin: "-50px" });

  if (campgrounds.length === 0) return null;

  return (
    <section ref={sectionRef} className="py-8">
      <motion.div
        className="flex items-center justify-between mb-6"
        variants={prefersReducedMotion ? undefined : fadeInUp}
        initial="hidden"
        animate={inView ? "visible" : "hidden"}
      >
        <div className="flex items-center gap-3">
          {iconImage ? (
            <div className="relative w-12 h-12">
              <Image src={iconImage} alt="" fill className="object-contain" sizes="48px" />
            </div>
          ) : (
            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
              {icon}
            </div>
          )}
          <div>
            <h3 className="text-xl font-bold text-foreground">{title}</h3>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
          >
            {viewAllLabel}
            <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </motion.div>

      {/* Horizontal scroll container */}
      <motion.div
        className="relative -mx-6 px-6"
        variants={prefersReducedMotion ? undefined : staggerContainer}
        initial="hidden"
        animate={inView ? "visible" : "hidden"}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
          {campgrounds.slice(0, 8).map((campground) => (
            <motion.div
              key={campground.id}
              className="flex-shrink-0 w-[280px] sm:w-[300px] snap-start"
              variants={prefersReducedMotion ? undefined : cardVariant}
            >
              <CampgroundCard
                id={campground.id}
                name={campground.name}
                slug={campground.slug}
                city={campground.city}
                state={campground.state}
                country={campground.country}
                imageUrl={campground.heroImageUrl}
                isInternal={campground.isInternal}
                isExternal={campground.isExternal}
                rating={campground.rating}
                reviewCount={campground.reviewCount}
                pricePerNight={campground.pricePerNight}
                amenities={campground.amenities}
                npsBadge={campground.npsBadge}
                pastAwards={campground.pastAwards}
                adaCertificationLevel={campground.adaCertificationLevel}
                compact
              />
            </motion.div>
          ))}
        </div>

        {/* Gradient fade edges */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-4 w-6 bg-gradient-to-r from-white to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 bottom-4 w-6 bg-gradient-to-l from-white to-transparent" />
      </motion.div>
    </section>
  );
}

export function LocationSections({ campgrounds, className = "" }: LocationSectionsProps) {
  const { state: userState, stateName, isLoading: geoLoading } = useGeolocation({ autoDetect: true });
  const prefersReducedMotion = useReducedMotion();

  // Filter campgrounds by user's state
  const nearbySection = useMemo(() => {
    if (!userState) return { title: "Popular Nearby", subtitle: "Enable location for personalized results", campgrounds: [] };

    const nearby = campgrounds
      .filter((cg) => cg.state === userState)
      .sort((a, b) => {
        // Sort by rating * reviewCount for popularity
        const scoreA = (a.rating ?? 0) * Math.log(Math.max(a.reviewCount ?? 1, 1));
        const scoreB = (b.rating ?? 0) * Math.log(Math.max(b.reviewCount ?? 1, 1));
        return scoreB - scoreA;
      });

    const displayState = stateName || getStateName(userState);
    return {
      title: `Popular in ${displayState}`,
      subtitle: `${nearby.length} campgrounds near you`,
      campgrounds: nearby
    };
  }, [campgrounds, userState, stateName]);

  // Highly rated campgrounds (4.5+ stars with at least 10 reviews)
  // Exclude external/RIDB campgrounds
  const highlyRated = useMemo(() => {
    return campgrounds
      .filter((cg) => (cg.rating ?? 0) >= 4.5 && (cg.reviewCount ?? 0) >= 10 && !cg.isExternal)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, 12);
  }, [campgrounds]);

  // New listings (would normally use createdAt, but for now just shuffle)
  // Exclude external/RIDB campgrounds from Rising Stars
  const newListings = useMemo(() => {
    // For demo, show campgrounds with fewer reviews as "new"
    return campgrounds
      .filter((cg) => (cg.reviewCount ?? 0) < 20 && cg.heroImageUrl && !cg.isExternal)
      .sort(() => Math.random() - 0.5)
      .slice(0, 8);
  }, [campgrounds]);

  // Featured picks - campgrounds with NPS badges
  // Exclude external/RIDB campgrounds
  const featuredPicks = useMemo(() => {
    return campgrounds
      .filter((cg) => cg.npsBadge && !cg.isExternal)
      .sort((a, b) => {
        // Priority: top-campground > top-1 > top-5 > top-10 > world-class > rising-star
        const priority: Record<string, number> = {
          "top-campground": 6,
          "top-1": 5,
          "top-5": 4,
          "top-10": 3,
          "world-class": 2,
          "rising-star": 1
        };
        return (priority[b.npsBadge?.type ?? ""] ?? 0) - (priority[a.npsBadge?.type ?? ""] ?? 0);
      })
      .slice(0, 8);
  }, [campgrounds]);

  // Don't show sections if we have no campgrounds
  if (campgrounds.length === 0) return null;

  // Show fewer sections on mobile for performance
  const hasSections = nearbySection.campgrounds.length > 0 || highlyRated.length > 0 || newListings.length > 0;
  if (!hasSections) return null;

  return (
    <div className={`max-w-7xl mx-auto px-6 ${className}`}>
      {/* Location-based section */}
      {!geoLoading && nearbySection.campgrounds.length > 0 && (
        <HorizontalScrollSection
          title={nearbySection.title}
          subtitle={nearbySection.subtitle}
          iconImage={userState ? (regionIcons[userState] || "/images/icons/regions/forest.png") : "/images/icons/regions/forest.png"}
          campgrounds={nearbySection.campgrounds}
          viewAllHref={userState && stateToSlug[userState] ? `/camping/${stateToSlug[userState]}` : "/camping"}
          viewAllLabel={userState ? `See all in ${stateName || getStateName(userState)}` : "Browse all"}
          prefersReducedMotion={prefersReducedMotion}
        />
      )}

      {/* Featured Picks */}
      {featuredPicks.length > 0 && (
        <HorizontalScrollSection
          title="Featured Picks"
          subtitle="Award-winning campgrounds"
          iconImage="/images/icons/verified-reviews.png"
          campgrounds={featuredPicks}
          prefersReducedMotion={prefersReducedMotion}
        />
      )}

      {/* Highly Rated */}
      {highlyRated.length > 0 && (
        <HorizontalScrollSection
          title="Highly Rated"
          subtitle="4.5+ stars from guests"
          iconImage="/images/icons/giving-heart.png"
          campgrounds={highlyRated}
          viewAllHref="/camping"
          viewAllLabel="Explore all campgrounds"
          prefersReducedMotion={prefersReducedMotion}
        />
      )}

      {/* Rising Stars / New */}
      {newListings.length > 0 && (
        <HorizontalScrollSection
          title="Rising Stars"
          subtitle="Newer campgrounds worth discovering"
          iconImage="/images/icons/hot-trending.png"
          campgrounds={newListings}
          prefersReducedMotion={prefersReducedMotion}
        />
      )}
    </div>
  );
}
