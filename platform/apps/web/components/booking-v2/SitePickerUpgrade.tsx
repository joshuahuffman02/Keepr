"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { MapPin, ChevronRight, Check, X, Sparkles, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Site {
  id: string;
  name: string;
  siteNumber: string;
  description?: string | null;
  photoUrl?: string | null;
}

interface SitePickerUpgradeProps {
  /** Fee in cents for the upgrade */
  upgradeFee: number;
  /** Available sites to pick from */
  availableSites: Site[];
  /** Currently selected site (if any) */
  selectedSite?: Site | null;
  /** Callback when user selects a site */
  onSelectSite: (site: Site | null) => void;
  /** Photo URL for the site class */
  siteClassPhoto?: string | null;
  className?: string;
}

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

export function SitePickerUpgrade({
  upgradeFee,
  availableSites,
  selectedSite,
  onSelectSite,
  siteClassPhoto,
  className,
}: SitePickerUpgradeProps) {
  const prefersReducedMotion = useReducedMotion();
  const [isExpanded, setIsExpanded] = useState(false);

  const hasSelection = !!selectedSite;

  // If no upgrade fee or no sites, don't show
  if (upgradeFee <= 0 || availableSites.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200 overflow-hidden",
        className,
      )}
    >
      {/* Header / Toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center gap-4 text-left hover:bg-amber-50/50 transition-colors"
      >
        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
          <MapPin className="h-5 w-5 text-amber-600" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground">Pick Your Exact Site</h3>
            <Badge className="bg-amber-500 text-white border-0 text-xs">
              +{formatCurrency(upgradeFee)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {hasSelection
              ? `Selected: ${selectedSite.name || `Site ${selectedSite.siteNumber}`}`
              : "Choose your specific spot instead of being assigned"}
          </p>
        </div>

        <div className="flex-shrink-0">
          {hasSelection ? (
            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
              <Check className="h-4 w-4 text-white" />
            </div>
          ) : (
            <ChevronRight
              className={cn(
                "h-5 w-5 text-muted-foreground transition-transform",
                isExpanded && "rotate-90",
              )}
            />
          )}
        </div>
      </button>

      {/* Site picker panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={prefersReducedMotion ? {} : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 space-y-3">
              {/* Remove selection option */}
              {hasSelection && (
                <button
                  onClick={() => onSelectSite(null)}
                  className="w-full flex items-center gap-2 p-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                >
                  <X className="h-4 w-4" />
                  Remove selection (save {formatCurrency(upgradeFee)})
                </button>
              )}

              {/* Site grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {availableSites.map((site) => {
                  const isSelected = selectedSite?.id === site.id;

                  return (
                    <motion.button
                      key={site.id}
                      onClick={() => onSelectSite(site)}
                      className={cn(
                        "relative p-3 rounded-lg border-2 text-left transition-all",
                        isSelected
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-border bg-card hover:border-border hover:shadow-sm",
                      )}
                      whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
                      whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
                    >
                      {/* Selected indicator */}
                      {isSelected && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      )}

                      {/* Site photo thumbnail */}
                      {(site.photoUrl || siteClassPhoto) && (
                        <div className="relative w-full h-12 rounded overflow-hidden mb-2">
                          <Image
                            src={site.photoUrl || siteClassPhoto!}
                            alt={site.name}
                            fill
                            className="object-cover"
                            sizes="100px"
                          />
                        </div>
                      )}

                      <div className="space-y-0.5">
                        <div className="font-medium text-sm text-foreground">
                          Site {site.siteNumber}
                        </div>
                        {site.name && site.name !== `Site ${site.siteNumber}` && (
                          <div className="text-xs text-muted-foreground truncate">{site.name}</div>
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {/* View map option (placeholder) */}
              <Button variant="outline" className="w-full" disabled>
                <Map className="h-4 w-4 mr-2" />
                View Site Map (Coming Soon)
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Compact banner version for when upgrade is available
 */
export function SitePickerBanner({
  upgradeFee,
  onClick,
  className,
}: {
  upgradeFee: number;
  onClick: () => void;
  className?: string;
}) {
  if (upgradeFee <= 0) return null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200 hover:border-amber-300 transition-colors text-left",
        className,
      )}
    >
      <Sparkles className="h-5 w-5 text-amber-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-foreground">Want a specific site?</span>
        <span className="text-sm text-muted-foreground ml-1">
          Pick your spot for +{formatCurrency(upgradeFee)}
        </span>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
    </button>
  );
}
