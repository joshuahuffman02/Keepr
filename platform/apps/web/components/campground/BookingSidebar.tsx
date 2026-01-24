"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import {
  Calendar,
  Users,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Shield,
  Clock,
  Star,
  Zap,
  Heart,
  Loader2,
  Tent,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";

interface SiteClass {
  id: string;
  name: string;
  siteType?: string | null;
  defaultRate?: number | null;
  maxOccupancy?: number | null;
}

interface BookingSidebarProps {
  campgroundName: string;
  campgroundSlug: string;
  siteClasses: SiteClass[];
  reviewScore?: number | null;
  reviewCount?: number | null;
  arrivalDate: string;
  departureDate: string;
  guests: string;
  onArrivalChange: (date: string) => void;
  onDepartureChange: (date: string) => void;
  onGuestsChange: (guests: string) => void;
  onBookClick: () => void;
  previewToken?: string;
  charityName?: string;
  className?: string;
}

export function BookingSidebar({
  campgroundName,
  campgroundSlug,
  siteClasses,
  reviewScore,
  reviewCount,
  arrivalDate,
  departureDate,
  guests,
  onArrivalChange,
  onDepartureChange,
  onGuestsChange,
  onBookClick,
  previewToken,
  charityName,
  className,
}: BookingSidebarProps) {
  const prefersReducedMotion = useReducedMotion();
  const [showPriceBreakdown, setShowPriceBreakdown] = useState(false);
  const [selectedSiteClassId, setSelectedSiteClassId] = useState<string | null>(null);

  // Calculate nights
  const nights = useMemo(() => {
    if (!arrivalDate || !departureDate) return 0;
    const start = new Date(arrivalDate);
    const end = new Date(departureDate);
    return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  }, [arrivalDate, departureDate]);

  // Get lowest price for "from" display when no site class selected
  const lowestPrice = useMemo(() => {
    const prices = siteClasses
      .filter((sc) => sc.defaultRate && sc.defaultRate > 0)
      .map((sc) => sc.defaultRate!);
    return prices.length > 0 ? Math.min(...prices) / 100 : null;
  }, [siteClasses]);

  // Get selected site class
  const selectedClass = useMemo(() => {
    return siteClasses.find((sc) => sc.id === selectedSiteClassId) || null;
  }, [siteClasses, selectedSiteClassId]);

  // Fetch availability to get a siteId for quoting
  const { data: availableSites } = useQuery({
    queryKey: ["public-availability", campgroundSlug, arrivalDate, departureDate, previewToken],
    queryFn: () =>
      apiClient.getPublicAvailability(campgroundSlug, { arrivalDate, departureDate }, previewToken),
    enabled: !!campgroundSlug && !!arrivalDate && !!departureDate && nights > 0,
    staleTime: 60 * 1000,
  });

  // Get a site ID from the selected class for quoting
  const quoteSiteId = useMemo(() => {
    if (!selectedSiteClassId || !availableSites) return null;
    const available = availableSites.find(
      (site) => site.siteClass?.id === selectedSiteClassId && site.status === "available",
    );
    return available?.id || null;
  }, [selectedSiteClassId, availableSites]);

  // Fetch real quote when we have dates + site
  const { data: quote, isLoading: isLoadingQuote } = useQuery({
    queryKey: [
      "public-quote",
      campgroundSlug,
      arrivalDate,
      departureDate,
      quoteSiteId,
      parseInt(guests || "1"),
    ],
    queryFn: () =>
      apiClient.getPublicQuote(campgroundSlug, {
        siteId: quoteSiteId!,
        arrivalDate,
        departureDate,
        adults: parseInt(guests || "1"),
      }),
    enabled: !!campgroundSlug && !!arrivalDate && !!departureDate && !!quoteSiteId,
    staleTime: 30 * 1000,
  });

  // Check if high demand (stubbed - would come from API)
  const isHighDemand = nights > 0 && (reviewCount || 0) > 10;

  // Calculate effective nightly rate (base + dynamic pricing baked in)
  const effectiveNightlyRate = useMemo(() => {
    if (!quote) return null;
    // Effective rate = (base + pricing rules) / nights
    // This bakes in dynamic pricing so it doesn't look like hidden fees
    const totalBeforeDiscountsAndTaxes = quote.baseSubtotalCents + (quote.rulesDeltaCents || 0);
    return Math.round(totalBeforeDiscountsAndTaxes / quote.nights);
  }, [quote]);

  // Build price breakdown from quote
  const priceBreakdown = useMemo(() => {
    if (!quote || !effectiveNightlyRate) return null;

    const items: { label: string; amount: number; isDiscount?: boolean }[] = [];

    // Site rate (includes dynamic pricing baked in)
    const siteSubtotal = quote.baseSubtotalCents + (quote.rulesDeltaCents || 0);
    items.push({
      label: `$${(effectiveNightlyRate / 100).toFixed(0)} x ${quote.nights} night${quote.nights !== 1 ? "s" : ""}`,
      amount: siteSubtotal,
    });

    // Discounts (promo codes, memberships, etc.)
    if (quote.discountCents && quote.discountCents > 0) {
      items.push({
        label: "Discount",
        amount: quote.discountCents,
        isDiscount: true,
      });
    }

    // Taxes & fees (shown separately for transparency)
    if (quote.taxesCents && quote.taxesCents > 0) {
      items.push({
        label: "Taxes & fees",
        amount: quote.taxesCents,
      });
    }

    return items;
  }, [quote, effectiveNightlyRate]);

  const totalAmount = quote?.totalWithTaxesCents || quote?.totalCents || 0;

  return (
    <motion.div
      className={cn(
        "bg-card border border-border rounded-2xl shadow-xl overflow-hidden",
        className,
      )}
      initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header with price */}
      <div className="p-6 pb-4">
        <div className="flex items-baseline justify-between mb-1">
          {selectedClass && quote && effectiveNightlyRate ? (
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-foreground">
                ${(effectiveNightlyRate / 100).toFixed(0)}
              </span>
              <span className="text-muted-foreground">/ night</span>
            </div>
          ) : selectedClass && isLoadingQuote ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
              <span className="text-muted-foreground">Calculating...</span>
            </div>
          ) : lowestPrice ? (
            <div className="flex items-baseline gap-1">
              <span className="text-sm text-muted-foreground">from</span>
              <span className="text-2xl font-bold text-foreground">${lowestPrice.toFixed(0)}</span>
              <span className="text-muted-foreground">/ night</span>
            </div>
          ) : (
            <span className="text-lg font-medium text-muted-foreground">Check availability</span>
          )}

          {reviewScore && reviewCount && reviewCount > 0 && (
            <div className="flex items-center gap-1 text-sm">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              <span className="font-semibold">{Number(reviewScore).toFixed(1)}</span>
              <span className="text-muted-foreground">({reviewCount})</span>
            </div>
          )}
        </div>

        {/* High demand badge */}
        {isHighDemand && (
          <Badge variant="secondary" className="bg-rose-50 text-rose-700 border-rose-200 mt-2">
            <Zap className="h-3 w-3 mr-1" />
            Popular choice
          </Badge>
        )}
      </div>

      {/* Booking form */}
      <div className="px-6 pb-4 space-y-4">
        {/* Date inputs */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Check-in
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={arrivalDate}
                onChange={(e) => onArrivalChange(e.target.value)}
                className="pl-10 border-border focus:border-emerald-500 focus:ring-emerald-500"
                aria-label="Check-in date"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Check-out
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={departureDate}
                onChange={(e) => onDepartureChange(e.target.value)}
                className="pl-10 border-border focus:border-emerald-500 focus:ring-emerald-500"
                aria-label="Check-out date"
              />
            </div>
          </div>
        </div>

        {/* Guests selector */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Guests
          </label>
          <div className="relative">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10 pointer-events-none" />
            <Select value={guests} onValueChange={onGuestsChange}>
              <SelectTrigger className="pl-10 border-border focus:border-emerald-500 focus:ring-emerald-500">
                <SelectValue placeholder="Select guests" />
              </SelectTrigger>
              <SelectContent>
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"].map((g) => (
                  <SelectItem key={g} value={g}>
                    {g} guest{g === "1" ? "" : "s"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Site class selector */}
        {siteClasses.length > 0 && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Accommodation
            </label>
            <div className="relative">
              <Tent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10 pointer-events-none" />
              <Select
                value={selectedSiteClassId || ""}
                onValueChange={(value) => setSelectedSiteClassId(value || null)}
              >
                <SelectTrigger className="pl-10 border-border focus:border-emerald-500 focus:ring-emerald-500">
                  <SelectValue placeholder="Select accommodation" />
                </SelectTrigger>
                <SelectContent>
                  {siteClasses.map((sc) => (
                    <SelectItem key={sc.id} value={sc.id}>
                      <span className="flex items-center justify-between gap-2 w-full">
                        <span>{sc.name}</span>
                        {sc.defaultRate && (
                          <span className="text-muted-foreground text-xs">
                            ${(sc.defaultRate / 100).toFixed(0)}/nt
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Price breakdown (expandable) - only show when we have a real quote */}
      {quote && priceBreakdown && effectiveNightlyRate && nights > 0 && (
        <div className="px-6 pb-4">
          <button
            onClick={() => setShowPriceBreakdown(!showPriceBreakdown)}
            className="flex items-center justify-between w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
            aria-expanded={showPriceBreakdown}
          >
            <span className="underline decoration-dashed underline-offset-4">
              ${(effectiveNightlyRate / 100).toFixed(0)} x {quote.nights} night
              {quote.nights === 1 ? "" : "s"}
            </span>
            {showPriceBreakdown ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {showPriceBreakdown && (
            <motion.div
              className="mt-3 pt-3 border-t border-border space-y-2 text-sm"
              initial={prefersReducedMotion ? {} : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
            >
              {priceBreakdown.map((item, idx) => (
                <div key={idx} className="flex justify-between text-muted-foreground">
                  <span className={item.isDiscount ? "text-emerald-600" : ""}>{item.label}</span>
                  <span className={item.isDiscount ? "text-emerald-600" : ""}>
                    {item.isDiscount ? "-" : ""}${(item.amount / 100).toFixed(2)}
                  </span>
                </div>
              ))}
              <div className="pt-2 border-t border-border flex justify-between font-semibold text-foreground">
                <span>Total</span>
                <span>${(totalAmount / 100).toFixed(2)}</span>
              </div>
              <p className="text-xs text-muted-foreground">Includes taxes, fees, and all charges</p>
            </motion.div>
          )}
        </div>
      )}

      {/* Prompt to select accommodation if not selected */}
      {!selectedSiteClassId && nights > 0 && (
        <div className="px-6 pb-4">
          <p className="text-sm text-muted-foreground text-center">
            Select accommodation to see price
          </p>
        </div>
      )}

      {/* Reserve button */}
      <div className="px-6 pb-4">
        <Button
          onClick={onBookClick}
          className="w-full h-12 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold text-base shadow-lg shadow-emerald-500/25 transition-all duration-200 hover:shadow-xl hover:shadow-emerald-500/30"
        >
          Reserve
        </Button>
        <p className="text-center text-xs text-muted-foreground mt-2">You won't be charged yet</p>
      </div>

      {/* Charity badge */}
      {charityName && (
        <div className="px-6 pb-4">
          <div className="flex items-center gap-2 p-3 bg-rose-50 rounded-lg border border-rose-100">
            <Heart className="h-4 w-4 text-rose-500 flex-shrink-0" />
            <p className="text-xs text-rose-700">
              Part of your booking supports <span className="font-medium">{charityName}</span>
            </p>
          </div>
        </div>
      )}

      {/* Trust signals */}
      <div className="px-6 pb-6">
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Shield className="h-3.5 w-3.5 text-emerald-600" />
            <span>Secure booking</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-emerald-600" />
            <span>Instant confirmation</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
