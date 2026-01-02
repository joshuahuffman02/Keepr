"use client";

import { useMemo } from "react";
import {
  Tent,
  Users,
  Plug,
  Dog,
  Wifi,
  Trees,
  Car,
  Mountain,
  Waves,
  Flame,
  ShowerHead,
  Store,
  MapPin,
  Compass,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SiteClass {
  id: string;
  name: string;
  siteType?: string | null;
  maxOccupancy?: number | null;
  hookupsPower?: boolean | null;
  hookupsWater?: boolean | null;
  hookupsSewer?: boolean | null;
  petFriendly?: boolean | null;
}

interface QuickFactsProps {
  siteClasses: SiteClass[];
  amenities?: string[];
  city?: string | null;
  state?: string | null;
  totalSites?: number;
  className?: string;
}

interface QuickFact {
  icon: React.ReactNode;
  label: string;
  priority: number;
}

export function QuickFacts({
  siteClasses,
  amenities = [],
  city,
  state,
  totalSites,
  className,
}: QuickFactsProps) {
  const facts = useMemo<QuickFact[]>(() => {
    const factsList: QuickFact[] = [];
    const lowerAmenities = amenities.map((a) => a.toLowerCase());

    // Total sites
    if (totalSites && totalSites > 0) {
      factsList.push({
        icon: <Tent className="h-4 w-4" />,
        label: `${totalSites} sites`,
        priority: 1,
      });
    } else if (siteClasses.length > 0) {
      factsList.push({
        icon: <Tent className="h-4 w-4" />,
        label: `${siteClasses.length} site type${siteClasses.length === 1 ? "" : "s"}`,
        priority: 1,
      });
    }

    // Max occupancy (find highest across site classes)
    const maxOccupancy = Math.max(
      ...siteClasses.map((sc) => sc.maxOccupancy || 0).filter((o) => o > 0),
      0
    );
    if (maxOccupancy > 0) {
      factsList.push({
        icon: <Users className="h-4 w-4" />,
        label: `Up to ${maxOccupancy} guests`,
        priority: 2,
      });
    }

    // Hookups (check if any site has full hookups)
    const hasFullHookups = siteClasses.some(
      (sc) => sc.hookupsPower && sc.hookupsWater && sc.hookupsSewer
    );
    const hasPartialHookups = siteClasses.some(
      (sc) => sc.hookupsPower || sc.hookupsWater
    );

    if (hasFullHookups) {
      factsList.push({
        icon: <Plug className="h-4 w-4" />,
        label: "Full hookups",
        priority: 3,
      });
    } else if (hasPartialHookups) {
      factsList.push({
        icon: <Zap className="h-4 w-4" />,
        label: "Electric available",
        priority: 3,
      });
    }

    // Pet friendly
    const hasPetFriendly = siteClasses.some((sc) => sc.petFriendly);
    if (hasPetFriendly || lowerAmenities.some((a) => a.includes("pet") || a.includes("dog"))) {
      factsList.push({
        icon: <Dog className="h-4 w-4" />,
        label: "Pet friendly",
        priority: 4,
      });
    }

    // WiFi
    if (lowerAmenities.some((a) => a.includes("wifi") || a.includes("internet"))) {
      factsList.push({
        icon: <Wifi className="h-4 w-4" />,
        label: "WiFi available",
        priority: 5,
      });
    }

    // Pool
    if (lowerAmenities.some((a) => a.includes("pool") || a.includes("swimming"))) {
      factsList.push({
        icon: <Waves className="h-4 w-4" />,
        label: "Pool",
        priority: 6,
      });
    }

    // Showers/Bathhouse
    if (lowerAmenities.some((a) => a.includes("shower") || a.includes("bathhouse"))) {
      factsList.push({
        icon: <ShowerHead className="h-4 w-4" />,
        label: "Showers",
        priority: 7,
      });
    }

    // Store
    if (lowerAmenities.some((a) => a.includes("store") || a.includes("shop"))) {
      factsList.push({
        icon: <Store className="h-4 w-4" />,
        label: "Camp store",
        priority: 8,
      });
    }

    // Fire pits
    if (lowerAmenities.some((a) => a.includes("fire") || a.includes("campfire"))) {
      factsList.push({
        icon: <Flame className="h-4 w-4" />,
        label: "Fire pits",
        priority: 9,
      });
    }

    // Hiking
    if (lowerAmenities.some((a) => a.includes("hiking") || a.includes("trail"))) {
      factsList.push({
        icon: <Mountain className="h-4 w-4" />,
        label: "Hiking trails",
        priority: 10,
      });
    }

    // Location
    if (city && state) {
      factsList.push({
        icon: <MapPin className="h-4 w-4" />,
        label: `${city}, ${state}`,
        priority: 11,
      });
    }

    // Sort by priority and take top 6
    return factsList.sort((a, b) => a.priority - b.priority).slice(0, 6);
  }, [siteClasses, amenities, city, state, totalSites]);

  if (facts.length === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap gap-3 md:gap-4",
        className
      )}
      role="list"
      aria-label="Quick facts about this campground"
    >
      {facts.map((fact, index) => (
        <div
          key={index}
          className="flex items-center gap-2 text-sm text-muted-foreground bg-muted px-3 py-2 rounded-full"
          role="listitem"
        >
          <span className="text-muted-foreground" aria-hidden="true">
            {fact.icon}
          </span>
          <span>{fact.label}</span>
        </div>
      ))}
    </div>
  );
}

// Compact version for smaller spaces
export function QuickFactsCompact({
  siteClasses,
  amenities = [],
  className,
}: Omit<QuickFactsProps, "city" | "state" | "totalSites">) {
  const facts = useMemo(() => {
    const items: { icon: React.ReactNode; label: string }[] = [];
    const lowerAmenities = amenities.map((a) => a.toLowerCase());

    // Sites count
    if (siteClasses.length > 0) {
      items.push({
        icon: <Tent className="h-3.5 w-3.5" />,
        label: `${siteClasses.length}`,
      });
    }

    // Max occupancy
    const maxOccupancy = Math.max(
      ...siteClasses.map((sc) => sc.maxOccupancy || 0).filter((o) => o > 0),
      0
    );
    if (maxOccupancy > 0) {
      items.push({
        icon: <Users className="h-3.5 w-3.5" />,
        label: `${maxOccupancy}`,
      });
    }

    // Hookups
    if (siteClasses.some((sc) => sc.hookupsPower)) {
      items.push({
        icon: <Plug className="h-3.5 w-3.5" />,
        label: "",
      });
    }

    // Pet friendly
    if (
      siteClasses.some((sc) => sc.petFriendly) ||
      lowerAmenities.some((a) => a.includes("pet"))
    ) {
      items.push({
        icon: <Dog className="h-3.5 w-3.5" />,
        label: "",
      });
    }

    return items.slice(0, 4);
  }, [siteClasses, amenities]);

  if (facts.length === 0) return null;

  return (
    <div
      className={cn("flex items-center gap-3", className)}
      role="list"
      aria-label="Quick facts"
    >
      {facts.map((fact, index) => (
        <div
          key={index}
          className="flex items-center gap-1 text-xs text-muted-foreground"
          role="listitem"
        >
          <span aria-hidden="true">{fact.icon}</span>
          {fact.label && <span>{fact.label}</span>}
        </div>
      ))}
    </div>
  );
}
