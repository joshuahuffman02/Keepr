"use client";

import { useMemo } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { Heart, ExternalLink, TrendingUp, Users, Gift } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CharityInfo {
  id: string;
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  website?: string | null;
  category?: string | null;
}

interface CharityStats {
  totalDonations: number;
  totalAmountCents: number;
  donorCount: number;
}

interface CharityBadgeProps {
  charity: CharityInfo;
  stats?: CharityStats;
  customMessage?: string | null;
  variant?: "compact" | "full" | "inline";
  className?: string;
}

// Format currency from cents
const formatCurrency = (cents: number) => {
  const dollars = cents / 100;
  if (dollars >= 1000) {
    return `$${(dollars / 1000).toFixed(1)}k`;
  }
  return `$${dollars.toFixed(0)}`;
};

// Compact inline badge for booking sidebar
export function CharityBadge({
  charity,
  stats,
  customMessage,
  variant = "compact",
  className,
}: CharityBadgeProps) {
  const prefersReducedMotion = useReducedMotion();

  if (variant === "inline") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 text-xs text-rose-600",
          className
        )}
      >
        <Heart className="h-3.5 w-3.5 fill-rose-500 text-rose-500" />
        <span>
          Supporting{" "}
          <span className="font-medium">{charity.name}</span>
        </span>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <motion.div
        className={cn(
          "flex items-center gap-3 p-3 bg-gradient-to-r from-rose-50 to-pink-50 rounded-xl border border-rose-100",
          className
        )}
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex-shrink-0">
          {charity.logoUrl ? (
            <div className="relative w-10 h-10 rounded-full overflow-hidden bg-card border border-rose-100">
              <Image
                src={charity.logoUrl}
                alt={charity.name}
                fill
                className="object-contain p-1"
              />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
              <Heart className="h-5 w-5 text-rose-500" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-rose-600 font-medium truncate">
            {customMessage || `Part of your stay supports ${charity.name}`}
          </p>
          {stats && stats.totalAmountCents > 0 && (
            <p className="text-xs text-rose-500/80 mt-0.5">
              {formatCurrency(stats.totalAmountCents)} raised
            </p>
          )}
        </div>
      </motion.div>
    );
  }

  // Full variant - prominent display
  return (
    <motion.section
      className={cn(
        "relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-50 via-pink-50 to-rose-100",
        "border border-rose-200",
        className
      )}
      initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-48 h-48 opacity-10">
        <Heart className="w-full h-full text-rose-500" />
      </div>

      <div className="relative p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          {/* Charity logo */}
          <div className="flex-shrink-0">
            {charity.logoUrl ? (
              <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-2xl overflow-hidden bg-card shadow-lg border border-white">
                <Image
                  src={charity.logoUrl}
                  alt={charity.name}
                  fill
                  className="object-contain p-2"
                />
              </div>
            ) : (
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-rose-200 flex items-center justify-center shadow-lg">
                <Heart className="h-10 w-10 text-rose-500" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 space-y-3">
            <div>
              <Badge className="bg-rose-500 text-white border-0 mb-2">
                <Gift className="h-3 w-3 mr-1" />
                We Give Back
              </Badge>
              <h3 className="text-xl font-bold text-foreground">
                Supporting {charity.name}
              </h3>
              {charity.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {charity.description}
                </p>
              )}
              {customMessage && (
                <p className="text-sm text-rose-600 mt-2 italic">
                  "{customMessage}"
                </p>
              )}
            </div>

            {/* Stats */}
            {stats && (
              <div className="flex flex-wrap gap-4 pt-2">
                {stats.totalAmountCents > 0 && (
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-rose-500" />
                    <div>
                      <div className="text-lg font-bold text-foreground">
                        {formatCurrency(stats.totalAmountCents)}
                      </div>
                      <div className="text-xs text-muted-foreground">Total raised</div>
                    </div>
                  </div>
                )}
                {stats.totalDonations > 0 && (
                  <div className="flex items-center gap-2">
                    <Heart className="h-4 w-4 text-rose-500" />
                    <div>
                      <div className="text-lg font-bold text-foreground">
                        {stats.totalDonations}
                      </div>
                      <div className="text-xs text-muted-foreground">Donations</div>
                    </div>
                  </div>
                )}
                {stats.donorCount > 0 && (
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-rose-500" />
                    <div>
                      <div className="text-lg font-bold text-foreground">
                        {stats.donorCount}
                      </div>
                      <div className="text-xs text-muted-foreground">Supporters</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CTA */}
            {charity.website && (
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-rose-200 text-rose-600 hover:bg-rose-50"
                  onClick={() => window.open(charity.website!, "_blank")}
                >
                  Learn more about {charity.name}
                  <ExternalLink className="h-3.5 w-3.5 ml-2" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.section>
  );
}

// Floating badge for hero overlay
export function CharityFloatingBadge({
  charityName,
  totalRaised,
  className,
}: {
  charityName: string;
  totalRaised?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={cn(
        "flex items-center gap-2 bg-card/95 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg",
        className
      )}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.5 }}
    >
      <Heart className="h-4 w-4 fill-rose-500 text-rose-500 animate-pulse" />
      <span className="text-sm font-medium text-foreground">
        {totalRaised && totalRaised > 0 ? (
          <>
            {formatCurrency(totalRaised)} raised for{" "}
            <span className="text-rose-600">{charityName}</span>
          </>
        ) : (
          <>
            Supporting{" "}
            <span className="text-rose-600">{charityName}</span>
          </>
        )}
      </span>
    </motion.div>
  );
}
