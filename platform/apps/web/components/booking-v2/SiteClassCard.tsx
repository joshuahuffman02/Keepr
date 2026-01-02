"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import {
  Caravan,
  Tent,
  Home,
  TreePine,
  Sparkles,
  Car,
  Users,
  Plug,
  Droplets,
  Check,
  Dog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SiteClass {
  id: string;
  name: string;
  siteType?: string | null;
  description?: string | null;
  defaultRate?: number | null; // in cents
  maxOccupancy?: number | null;
  hookupsPower?: boolean | null;
  hookupsWater?: boolean | null;
  hookupsSewer?: boolean | null;
  petFriendly?: boolean | null;
  photoUrl?: string | null;
}

interface SiteClassCardProps {
  siteClass: SiteClass;
  availableCount: number;
  nights: number;
  isSelected?: boolean;
  onSelect: () => void;
  fallbackImage?: string | null;
  className?: string;
}

// Get icon for site type
const getSiteTypeIcon = (siteType?: string | null) => {
  const type = (siteType || "").toLowerCase();
  if (type.includes("rv") || type.includes("trailer")) return Caravan;
  if (type.includes("cabin") || type.includes("lodge")) return Home;
  if (type.includes("tent")) return Tent;
  if (type.includes("glamp")) return Sparkles;
  if (type.includes("car") || type.includes("van")) return Car;
  return TreePine;
};

// Get gradient for site type
const getSiteTypeGradient = (siteType?: string | null) => {
  const type = (siteType || "").toLowerCase();
  if (type.includes("rv") || type.includes("trailer"))
    return "from-blue-600 to-cyan-600";
  if (type.includes("cabin") || type.includes("lodge"))
    return "from-amber-600 to-orange-600";
  if (type.includes("tent")) return "from-emerald-600 to-teal-600";
  if (type.includes("glamp")) return "from-purple-600 to-pink-600";
  return "from-slate-600 to-slate-700";
};

// Format currency from cents
const formatCurrency = (cents: number) => {
  const dollars = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(dollars);
};

export function SiteClassCard({
  siteClass,
  availableCount,
  nights,
  isSelected,
  onSelect,
  fallbackImage,
  className,
}: SiteClassCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const Icon = getSiteTypeIcon(siteClass.siteType);
  const pricePerNight = siteClass.defaultRate || 0;
  const totalPrice = pricePerNight * nights;

  const hasFullHookups =
    siteClass.hookupsPower && siteClass.hookupsWater && siteClass.hookupsSewer;

  const features: { icon: typeof Plug; label: string }[] = [];

  if (hasFullHookups) {
    features.push({ icon: Plug, label: "Full hookups" });
  } else {
    if (siteClass.hookupsPower) features.push({ icon: Plug, label: "Electric" });
    if (siteClass.hookupsWater) features.push({ icon: Droplets, label: "Water" });
  }

  if (siteClass.maxOccupancy) {
    features.push({ icon: Users, label: `Up to ${siteClass.maxOccupancy}` });
  }

  if (siteClass.petFriendly) {
    features.push({ icon: Dog, label: "Pet friendly" });
  }

  return (
    <motion.div
      className={cn(
        "relative bg-card rounded-xl border-2 overflow-hidden transition-all cursor-pointer",
        isSelected
          ? "border-emerald-500 ring-2 ring-emerald-500/20 shadow-lg"
          : "border-border hover:border-border hover:shadow-md",
        className
      )}
      onClick={onSelect}
      whileHover={prefersReducedMotion ? {} : { y: -2 }}
      whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
    >
      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute top-3 right-3 z-10 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
          <Check className="h-4 w-4 text-white" />
        </div>
      )}

      {/* Image */}
      <div className="relative h-32 md:h-40 overflow-hidden">
        {siteClass.photoUrl || fallbackImage ? (
          <Image
            src={siteClass.photoUrl || fallbackImage!}
            alt={siteClass.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 350px"
          />
        ) : (
          <div
            className={cn(
              "w-full h-full bg-gradient-to-br flex items-center justify-center",
              getSiteTypeGradient(siteClass.siteType)
            )}
          >
            <Icon className="h-12 w-12 text-white/60" />
          </div>
        )}

        {/* Site type badge */}
        <div className="absolute top-3 left-3">
          <Badge
            className={cn(
              "text-white border-0 bg-gradient-to-r shadow-md",
              getSiteTypeGradient(siteClass.siteType)
            )}
          >
            <Icon className="h-3 w-3 mr-1" />
            {siteClass.siteType?.toUpperCase() || "SITE"}
          </Badge>
        </div>

        {/* Availability badge */}
        <div className="absolute bottom-3 left-3">
          <Badge
            variant="secondary"
            className={cn(
              "shadow-md",
              availableCount <= 2
                ? "bg-amber-100 text-amber-800"
                : "bg-card/90 text-foreground"
            )}
          >
            {availableCount} available
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Title and price */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-foreground">{siteClass.name}</h3>
            {siteClass.description && (
              <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                {siteClass.description}
              </p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-lg font-bold text-emerald-600">
              {formatCurrency(pricePerNight)}
            </div>
            <div className="text-xs text-muted-foreground">/ night</div>
          </div>
        </div>

        {/* Features */}
        {features.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {features.slice(0, 3).map((feature, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1 text-xs text-muted-foreground bg-muted rounded-full px-2 py-1"
              >
                <feature.icon className="h-3 w-3 text-muted-foreground" />
                <span>{feature.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Total price */}
        {nights > 1 && (
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-sm text-muted-foreground">
              {nights} nights total
            </span>
            <span className="font-semibold text-foreground">
              {formatCurrency(totalPrice)}
            </span>
          </div>
        )}

        {/* Select button (on mobile) */}
        <Button
          variant={isSelected ? "default" : "outline"}
          className={cn(
            "w-full md:hidden",
            isSelected && "bg-emerald-600 hover:bg-emerald-700"
          )}
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
        >
          {isSelected ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Selected
            </>
          ) : (
            "Select This Type"
          )}
        </Button>
      </div>
    </motion.div>
  );
}

/**
 * Grid container for site class cards
 */
export function SiteClassGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-4 md:grid-cols-2 lg:grid-cols-2",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Empty state when no site classes available
 */
export function SiteClassEmpty({
  message = "No accommodations available for these dates",
  onChangeDates,
}: {
  message?: string;
  onChangeDates?: () => void;
}) {
  return (
    <div className="text-center py-12 bg-muted rounded-xl border border-border border-dashed">
      <Tent className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
      <p className="text-muted-foreground font-medium">{message}</p>
      <p className="text-sm text-muted-foreground mt-1">
        Try different dates or check back later
      </p>
      {onChangeDates && (
        <Button variant="outline" className="mt-4" onClick={onChangeDates}>
          Change Dates
        </Button>
      )}
    </div>
  );
}
