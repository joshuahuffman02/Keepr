"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Plug,
  Droplets,
  Trash2,
  Wifi,
  Car,
  Waves,
  ShowerHead,
  Store,
  Utensils,
  Flame,
  Mountain,
  Trees,
  Fish,
  Tent,
  Dog,
  Baby,
  Gamepad2,
  Dumbbell,
  Tv,
  Shirt,
  CreditCard,
  Phone,
  Shield,
  Sun,
  Snowflake,
  ChevronDown,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getAmenityIconPath } from "@/lib/amenity-icons";

interface AmenitiesSectionProps {
  amenities: string[];
  siteClasses?: {
    hookupsPower?: boolean | null;
    hookupsWater?: boolean | null;
    hookupsSewer?: boolean | null;
    petFriendly?: boolean | null;
  }[];
  className?: string;
}

interface AmenityCategory {
  name: string;
  icon: React.ReactNode;
  items: { name: string; icon: React.ReactNode }[];
}

// Map amenity names to icons
const amenityIconMap: Record<string, React.ReactNode> = {
  // Hookups
  electric: <Plug className="h-4 w-4" />,
  power: <Plug className="h-4 w-4" />,
  water: <Droplets className="h-4 w-4" />,
  sewer: <Trash2 className="h-4 w-4" />,
  "full hookups": <Plug className="h-4 w-4" />,
  // Connectivity
  wifi: <Wifi className="h-4 w-4" />,
  internet: <Wifi className="h-4 w-4" />,
  cable: <Tv className="h-4 w-4" />,
  tv: <Tv className="h-4 w-4" />,
  phone: <Phone className="h-4 w-4" />,
  // Facilities
  shower: <ShowerHead className="h-4 w-4" />,
  showers: <ShowerHead className="h-4 w-4" />,
  bathhouse: <ShowerHead className="h-4 w-4" />,
  restroom: <ShowerHead className="h-4 w-4" />,
  laundry: <Shirt className="h-4 w-4" />,
  store: <Store className="h-4 w-4" />,
  "camp store": <Store className="h-4 w-4" />,
  restaurant: <Utensils className="h-4 w-4" />,
  snack: <Utensils className="h-4 w-4" />,
  atm: <CreditCard className="h-4 w-4" />,
  // Recreation
  pool: <Waves className="h-4 w-4" />,
  swimming: <Waves className="h-4 w-4" />,
  playground: <Baby className="h-4 w-4" />,
  hiking: <Mountain className="h-4 w-4" />,
  trails: <Mountain className="h-4 w-4" />,
  fishing: <Fish className="h-4 w-4" />,
  boating: <Waves className="h-4 w-4" />,
  kayak: <Waves className="h-4 w-4" />,
  games: <Gamepad2 className="h-4 w-4" />,
  fitness: <Dumbbell className="h-4 w-4" />,
  gym: <Dumbbell className="h-4 w-4" />,
  // Outdoors
  "fire pit": <Flame className="h-4 w-4" />,
  fire: <Flame className="h-4 w-4" />,
  campfire: <Flame className="h-4 w-4" />,
  firewood: <Flame className="h-4 w-4" />,
  picnic: <Trees className="h-4 w-4" />,
  grill: <Flame className="h-4 w-4" />,
  bbq: <Flame className="h-4 w-4" />,
  // Pets & Family
  pet: <Dog className="h-4 w-4" />,
  dog: <Dog className="h-4 w-4" />,
  "pet friendly": <Dog className="h-4 w-4" />,
  // Parking
  parking: <Car className="h-4 w-4" />,
  "pull through": <Car className="h-4 w-4" />,
  "big rig": <Car className="h-4 w-4" />,
  // Security
  security: <Shield className="h-4 w-4" />,
  gate: <Shield className="h-4 w-4" />,
  // Climate
  ac: <Snowflake className="h-4 w-4" />,
  "air conditioning": <Snowflake className="h-4 w-4" />,
  heating: <Sun className="h-4 w-4" />,
  shade: <Trees className="h-4 w-4" />,
};

// Categorize amenities
const categorizeAmenity = (amenity: string): { category: string; icon: React.ReactNode } => {
  const lower = amenity.toLowerCase();

  // Find matching icon
  let icon: React.ReactNode = <Check className="h-4 w-4" />;
  for (const [key, value] of Object.entries(amenityIconMap)) {
    if (lower.includes(key)) {
      icon = value;
      break;
    }
  }

  // Determine category
  if (
    lower.includes("electric") ||
    lower.includes("power") ||
    lower.includes("water") ||
    lower.includes("sewer") ||
    lower.includes("hookup")
  ) {
    return { category: "Hookups", icon };
  }
  if (
    lower.includes("wifi") ||
    lower.includes("internet") ||
    lower.includes("cable") ||
    lower.includes("tv") ||
    lower.includes("phone")
  ) {
    return { category: "Connectivity", icon };
  }
  if (
    lower.includes("pool") ||
    lower.includes("swim") ||
    lower.includes("playground") ||
    lower.includes("game") ||
    lower.includes("fitness") ||
    lower.includes("gym") ||
    lower.includes("recreation")
  ) {
    return { category: "Recreation", icon };
  }
  if (
    lower.includes("hik") ||
    lower.includes("trail") ||
    lower.includes("fish") ||
    lower.includes("boat") ||
    lower.includes("kayak") ||
    lower.includes("canoe") ||
    lower.includes("nature")
  ) {
    return { category: "Outdoors", icon };
  }
  if (
    lower.includes("fire") ||
    lower.includes("grill") ||
    lower.includes("bbq") ||
    lower.includes("picnic") ||
    lower.includes("shade")
  ) {
    return { category: "Site Amenities", icon };
  }
  if (
    lower.includes("shower") ||
    lower.includes("bath") ||
    lower.includes("restroom") ||
    lower.includes("laundry") ||
    lower.includes("store") ||
    lower.includes("restaurant") ||
    lower.includes("snack") ||
    lower.includes("atm")
  ) {
    return { category: "Facilities", icon };
  }
  if (lower.includes("pet") || lower.includes("dog")) {
    return { category: "Pet Friendly", icon };
  }
  if (lower.includes("parking") || lower.includes("pull") || lower.includes("rig")) {
    return { category: "Parking", icon };
  }

  return { category: "Other", icon };
};

const categoryIcons: Record<string, React.ReactNode> = {
  Hookups: <Plug className="h-5 w-5" />,
  Connectivity: <Wifi className="h-5 w-5" />,
  Recreation: <Waves className="h-5 w-5" />,
  Outdoors: <Mountain className="h-5 w-5" />,
  "Site Amenities": <Flame className="h-5 w-5" />,
  Facilities: <Store className="h-5 w-5" />,
  "Pet Friendly": <Dog className="h-5 w-5" />,
  Parking: <Car className="h-5 w-5" />,
  Other: <Check className="h-5 w-5" />,
};

export function AmenitiesSection({
  amenities,
  siteClasses = [],
  className,
}: AmenitiesSectionProps) {
  const prefersReducedMotion = useReducedMotion();
  const [showAll, setShowAll] = useState(false);

  // Build categorized amenities
  const categories = useMemo(() => {
    const cats: Record<string, { name: string; icon: React.ReactNode }[]> = {};

    // Add hookups from site classes
    const hasElectric = siteClasses.some((sc) => sc.hookupsPower);
    const hasWater = siteClasses.some((sc) => sc.hookupsWater);
    const hasSewer = siteClasses.some((sc) => sc.hookupsSewer);
    const hasPets = siteClasses.some((sc) => sc.petFriendly);

    if (hasElectric || hasWater || hasSewer) {
      cats["Hookups"] = [];
      if (hasElectric)
        cats["Hookups"].push({ name: "Electric", icon: <Plug className="h-4 w-4" /> });
      if (hasWater) cats["Hookups"].push({ name: "Water", icon: <Droplets className="h-4 w-4" /> });
      if (hasSewer) cats["Hookups"].push({ name: "Sewer", icon: <Trash2 className="h-4 w-4" /> });
    }

    if (hasPets) {
      cats["Pet Friendly"] = [{ name: "Pet Friendly", icon: <Dog className="h-4 w-4" /> }];
    }

    // Categorize string amenities
    amenities.forEach((amenity) => {
      const { category, icon } = categorizeAmenity(amenity);
      if (!cats[category]) cats[category] = [];

      // Avoid duplicates
      const exists = cats[category].some(
        (item) => item.name.toLowerCase() === amenity.toLowerCase(),
      );
      if (!exists) {
        cats[category].push({ name: amenity, icon });
      }
    });

    // Convert to array and sort by importance
    const order = [
      "Hookups",
      "Facilities",
      "Recreation",
      "Outdoors",
      "Site Amenities",
      "Connectivity",
      "Pet Friendly",
      "Parking",
      "Other",
    ];

    return order
      .filter((cat) => cats[cat] && cats[cat].length > 0)
      .map((cat) => ({
        name: cat,
        icon: categoryIcons[cat],
        items: cats[cat],
      }));
  }, [amenities, siteClasses]);

  // Count total amenities
  const totalCount = categories.reduce((acc, cat) => acc + cat.items.length, 0);

  // Show first 2 categories initially
  const visibleCategories = showAll ? categories : categories.slice(0, 2);
  const hiddenCount = showAll
    ? 0
    : categories.slice(2).reduce((acc, cat) => acc + cat.items.length, 0);

  if (totalCount === 0) return null;

  return (
    <section className={cn("space-y-4", className)}>
      <h2 className="text-xl font-semibold text-foreground">What this place offers</h2>

      <div className="grid gap-6 md:grid-cols-2">
        {visibleCategories.map((category) => (
          <motion.div
            key={category.name}
            className="space-y-3"
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-muted-foreground">{category.icon}</span>
              <h3 className="text-sm font-semibold uppercase tracking-wider">{category.name}</h3>
            </div>
            <ul className="space-y-2">
              {category.items.map((item, idx) => {
                const clayIconPath = getAmenityIconPath(item.name);
                return (
                  <li key={idx} className="flex items-center gap-3 text-foreground">
                    {clayIconPath ? (
                      <Image
                        src={clayIconPath}
                        alt=""
                        width={20}
                        height={20}
                        className="object-contain"
                      />
                    ) : (
                      <span className="text-muted-foreground">{item.icon}</span>
                    )}
                    <span>{item.name}</span>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        ))}
      </div>

      {/* Show more/less button */}
      {categories.length > 2 && (
        <Button variant="outline" className="w-full mt-4" onClick={() => setShowAll(!showAll)}>
          {showAll ? (
            <>Show less</>
          ) : (
            <>
              Show all {totalCount} amenities
              <ChevronDown className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      )}
    </section>
  );
}

// Compact inline version
export function AmenitiesInline({
  amenities,
  maxShow = 6,
  className,
}: {
  amenities: string[];
  maxShow?: number;
  className?: string;
}) {
  const items = amenities.slice(0, maxShow);
  const remaining = amenities.length - maxShow;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {items.map((amenity, idx) => {
        const { icon } = categorizeAmenity(amenity);
        const clayIconPath = getAmenityIconPath(amenity);
        return (
          <div
            key={idx}
            className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full"
          >
            {clayIconPath ? (
              <Image src={clayIconPath} alt="" width={14} height={14} className="object-contain" />
            ) : (
              <span className="text-muted-foreground">{icon}</span>
            )}
            <span>{amenity}</span>
          </div>
        );
      })}
      {remaining > 0 && (
        <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
          +{remaining} more
        </div>
      )}
    </div>
  );
}
