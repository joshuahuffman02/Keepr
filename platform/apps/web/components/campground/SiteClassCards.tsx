"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Users,
  Plug,
  Droplets,
  Trash2,
  Dog,
  Tent,
  Caravan,
  Home,
  TreePine,
  Sparkles,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SiteClass {
  id: string;
  name: string;
  siteType?: string | null;
  description?: string | null;
  defaultRate?: number | null;
  maxOccupancy?: number | null;
  hookupsPower?: boolean | null;
  hookupsWater?: boolean | null;
  hookupsSewer?: boolean | null;
  petFriendly?: boolean | null;
  photoUrl?: string | null;
}

interface SiteClassCardsProps {
  siteClasses: SiteClass[];
  heroImage?: string | null;
  onSelectSiteClass: (siteClass: SiteClass) => void;
  className?: string;
}

// Get icon for site type
const getSiteTypeIcon = (siteType?: string | null) => {
  const type = (siteType || "").toLowerCase();
  if (type.includes("rv")) return <Caravan className="h-4 w-4" />;
  if (type.includes("cabin") || type.includes("lodge")) return <Home className="h-4 w-4" />;
  if (type.includes("tent")) return <Tent className="h-4 w-4" />;
  if (type.includes("glamp")) return <Sparkles className="h-4 w-4" />;
  return <TreePine className="h-4 w-4" />;
};

// Get gradient for site type
const getSiteTypeGradient = (siteType?: string | null) => {
  const type = (siteType || "").toLowerCase();
  if (type.includes("rv")) return "from-blue-600 to-cyan-600";
  if (type.includes("cabin") || type.includes("lodge")) return "from-amber-600 to-orange-600";
  if (type.includes("tent")) return "from-emerald-600 to-teal-600";
  if (type.includes("glamp")) return "from-purple-600 to-pink-600";
  return "from-slate-600 to-slate-700";
};

export function SiteClassCards({
  siteClasses,
  heroImage,
  onSelectSiteClass,
  className,
}: SiteClassCardsProps) {
  const prefersReducedMotion = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const scrollAmount = 320; // Card width + gap
    scrollRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  };

  // Hide section entirely when there are no site classes
  if (siteClasses.length === 0) {
    return null;
  }

  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">Accommodations</h2>
        {siteClasses.length > 2 && (
          <div className="hidden md:flex gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => scroll("left")}
              aria-label="Scroll left"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => scroll("right")}
              aria-label="Scroll right"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Horizontal scroll container */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 md:-mx-6 md:px-6 scrollbar-hide snap-x snap-mandatory"
      >
        {siteClasses.map((siteClass, idx) => {
          const price = siteClass.defaultRate ? siteClass.defaultRate / 100 : null;
          const hasFullHookups =
            siteClass.hookupsPower &&
            siteClass.hookupsWater &&
            siteClass.hookupsSewer;

          return (
            <motion.article
              key={siteClass.id}
              className="flex-shrink-0 w-[280px] md:w-[300px] snap-start"
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <button
                onClick={() => onSelectSiteClass(siteClass)}
                className="w-full text-left group focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 rounded-xl"
              >
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                  {/* Image */}
                  <div className="relative h-40 bg-slate-100 overflow-hidden">
                    {siteClass.photoUrl ? (
                      <Image
                        src={siteClass.photoUrl}
                        alt={siteClass.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        sizes="300px"
                      />
                    ) : heroImage ? (
                      <Image
                        src={heroImage}
                        alt={siteClass.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        sizes="300px"
                      />
                    ) : (
                      <div
                        className={cn(
                          "w-full h-full bg-gradient-to-br flex items-center justify-center",
                          getSiteTypeGradient(siteClass.siteType)
                        )}
                      >
                        <div className="text-white/80">
                          {getSiteTypeIcon(siteClass.siteType)}
                        </div>
                      </div>
                    )}

                    {/* Type badge */}
                    <div className="absolute top-3 left-3">
                      <Badge
                        className={cn(
                          "text-white border-0 bg-gradient-to-r",
                          getSiteTypeGradient(siteClass.siteType)
                        )}
                      >
                        {getSiteTypeIcon(siteClass.siteType)}
                        <span className="ml-1">
                          {siteClass.siteType?.toUpperCase() || "SITE"}
                        </span>
                      </Badge>
                    </div>

                    {/* Pet friendly badge */}
                    {siteClass.petFriendly && (
                      <div className="absolute top-3 right-3">
                        <Badge className="bg-emerald-500 text-white border-0">
                          <Dog className="h-3 w-3 mr-1" />
                          Pet OK
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-4 space-y-3">
                    {/* Title and price */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-slate-900 group-hover:text-emerald-600 transition-colors">
                          {siteClass.name}
                        </h3>
                        {siteClass.description && (
                          <p className="text-sm text-slate-500 line-clamp-1 mt-0.5">
                            {siteClass.description}
                          </p>
                        )}
                      </div>
                      {price && (
                        <div className="text-right flex-shrink-0">
                          <div className="text-lg font-bold text-emerald-600">
                            ${price.toFixed(0)}
                          </div>
                          <div className="text-xs text-slate-500">/ night</div>
                        </div>
                      )}
                    </div>

                    {/* Features */}
                    <div className="flex flex-wrap gap-2">
                      {siteClass.maxOccupancy && (
                        <div className="flex items-center gap-1 text-xs text-slate-600">
                          <Users className="h-3.5 w-3.5 text-slate-400" />
                          <span>Up to {siteClass.maxOccupancy}</span>
                        </div>
                      )}
                      {hasFullHookups ? (
                        <div className="flex items-center gap-1 text-xs text-slate-600">
                          <Zap className="h-3.5 w-3.5 text-slate-400" />
                          <span>Full hookups</span>
                        </div>
                      ) : (
                        <>
                          {siteClass.hookupsPower && (
                            <div className="flex items-center gap-1 text-xs text-slate-600">
                              <Plug className="h-3.5 w-3.5 text-slate-400" />
                            </div>
                          )}
                          {siteClass.hookupsWater && (
                            <div className="flex items-center gap-1 text-xs text-slate-600">
                              <Droplets className="h-3.5 w-3.5 text-slate-400" />
                            </div>
                          )}
                          {siteClass.hookupsSewer && (
                            <div className="flex items-center gap-1 text-xs text-slate-600">
                              <Trash2 className="h-3.5 w-3.5 text-slate-400" />
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* View details link */}
                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-sm font-medium text-emerald-600 group-hover:underline">
                        View details
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}

// Grid layout variant for fewer items
export function SiteClassGrid({
  siteClasses,
  heroImage,
  onSelectSiteClass,
  className,
}: SiteClassCardsProps) {
  const prefersReducedMotion = useReducedMotion();

  if (siteClasses.length === 0) return null;

  return (
    <section className={cn("space-y-4", className)}>
      <h2 className="text-xl font-semibold text-slate-900">Accommodations</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {siteClasses.map((siteClass, idx) => {
          const price = siteClass.defaultRate ? siteClass.defaultRate / 100 : null;

          return (
            <motion.article
              key={siteClass.id}
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <button
                onClick={() => onSelectSiteClass(siteClass)}
                className="w-full text-left group focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 rounded-xl"
              >
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300">
                  {/* Image */}
                  <div className="relative h-48 bg-slate-100 overflow-hidden">
                    {siteClass.photoUrl || heroImage ? (
                      <Image
                        src={siteClass.photoUrl || heroImage!}
                        alt={siteClass.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div
                        className={cn(
                          "w-full h-full bg-gradient-to-br flex items-center justify-center",
                          getSiteTypeGradient(siteClass.siteType)
                        )}
                      >
                        <div className="text-white/50 scale-150">
                          {getSiteTypeIcon(siteClass.siteType)}
                        </div>
                      </div>
                    )}

                    <div className="absolute top-3 left-3">
                      <Badge
                        className={cn(
                          "text-white border-0 bg-gradient-to-r",
                          getSiteTypeGradient(siteClass.siteType)
                        )}
                      >
                        {siteClass.siteType?.toUpperCase() || "SITE"}
                      </Badge>
                    </div>

                    {price && (
                      <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-sm rounded-lg px-2 py-1 shadow-lg">
                        <span className="font-bold text-emerald-600">
                          ${price.toFixed(0)}
                        </span>
                        <span className="text-xs text-slate-500">/night</span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <h3 className="font-semibold text-slate-900 group-hover:text-emerald-600 transition-colors">
                      {siteClass.name}
                    </h3>
                    {siteClass.description && (
                      <p className="text-sm text-slate-500 line-clamp-2 mt-1">
                        {siteClass.description}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}
