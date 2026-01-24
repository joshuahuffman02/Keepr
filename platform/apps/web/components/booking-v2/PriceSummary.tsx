"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Calendar, Users, ChevronDown, ChevronUp, Shield, Zap, MapPin, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PriceLineItem {
  label: string;
  amount: number; // in cents
  isDiscount?: boolean;
  isTax?: boolean;
}

interface PriceSummaryProps {
  // Site class info
  siteClassName?: string;
  siteClassPhoto?: string | null;
  siteType?: string;

  // Dates
  arrivalDate: string;
  departureDate: string;
  nights: number;

  // Guests
  adults: number;
  childCount?: number;

  // Pricing
  baseRatePerNight: number; // in cents
  lineItems?: PriceLineItem[];
  totalAmount: number; // in cents

  // Optional specific site (if upgrade selected)
  specificSite?: {
    name: string;
    number: string;
  } | null;

  // Charity
  charityName?: string;
  charityAmount?: number;

  // Actions
  ctaLabel: string;
  ctaDisabled?: boolean;
  ctaLoading?: boolean;
  onCtaClick: () => void;

  // Cancellation policy
  freeCancellationUntil?: string;

  className?: string;
}

// Format currency from cents
const formatCurrency = (cents: number) => {
  const dollars = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(dollars);
};

// Format date for display
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

export function PriceSummary({
  siteClassName,
  siteClassPhoto,
  siteType,
  arrivalDate,
  departureDate,
  nights,
  adults,
  childCount = 0,
  baseRatePerNight,
  lineItems = [],
  totalAmount,
  specificSite,
  charityName,
  charityAmount,
  ctaLabel,
  ctaDisabled,
  ctaLoading,
  onCtaClick,
  freeCancellationUntil,
  className,
}: PriceSummaryProps) {
  const prefersReducedMotion = useReducedMotion();
  const [showBreakdown, setShowBreakdown] = useState(false);

  const guestCount = adults + childCount;
  const hasLineItems = lineItems.length > 0;

  return (
    <div
      className={cn("bg-card rounded-xl border border-border shadow-lg overflow-hidden", className)}
    >
      {/* Site class preview */}
      {(siteClassName || siteClassPhoto) && (
        <div className="flex items-center gap-4 p-4 border-b border-border">
          {siteClassPhoto && (
            <div className="relative w-20 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0">
              <Image
                src={siteClassPhoto}
                alt={siteClassName || "Site"}
                fill
                className="object-cover"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">{siteClassName}</h3>
            {specificSite ? (
              <p className="text-sm text-emerald-600 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {specificSite.name || `Site ${specificSite.number}`}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Site assigned at check-in</p>
            )}
          </div>
        </div>
      )}

      {/* Booking details */}
      <div className="p-4 space-y-4">
        {/* Dates and guests */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>
              {formatDate(arrivalDate)} - {formatDate(departureDate)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>
              {guestCount} guest{guestCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <hr className="border-border" />

        {/* Price breakdown */}
        <div className="space-y-2">
          {/* Base rate */}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {formatCurrency(baseRatePerNight)} x {nights} night
              {nights !== 1 ? "s" : ""}
            </span>
            <span className="text-foreground">{formatCurrency(baseRatePerNight * nights)}</span>
          </div>

          {/* Line items (fees, taxes) */}
          {hasLineItems && (
            <>
              <button
                onClick={() => setShowBreakdown(!showBreakdown)}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {showBreakdown ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                {showBreakdown ? "Hide" : "Show"} fees & taxes
              </button>

              <AnimatePresence>
                {showBreakdown && (
                  <motion.div
                    initial={prefersReducedMotion ? {} : { height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-2 pt-2 pl-4 border-l-2 border-border">
                      {lineItems.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span
                            className={cn(
                              item.isDiscount ? "text-emerald-600" : "text-muted-foreground",
                            )}
                          >
                            {item.label}
                          </span>
                          <span
                            className={cn(
                              item.isDiscount ? "text-emerald-600" : "text-muted-foreground",
                            )}
                          >
                            {item.isDiscount ? "-" : ""}
                            {formatCurrency(Math.abs(item.amount))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}

          {/* Charity donation */}
          {charityName && charityAmount && charityAmount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-rose-600">Round up for {charityName}</span>
              <span className="text-rose-600">{formatCurrency(charityAmount)}</span>
            </div>
          )}

          <hr className="border-border" />

          {/* Total */}
          <div className="flex justify-between font-semibold text-lg">
            <span className="text-foreground">Total</span>
            <span className="text-foreground">{formatCurrency(totalAmount)}</span>
          </div>
        </div>

        {/* CTA Button */}
        <Button
          onClick={onCtaClick}
          disabled={ctaDisabled}
          className="w-full h-12 text-base font-semibold bg-emerald-600 hover:bg-emerald-700"
        >
          {ctaLoading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processing...
            </span>
          ) : (
            ctaLabel
          )}
        </Button>

        {/* Trust signals */}
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Shield className="h-3.5 w-3.5 text-emerald-500" />
            Secure checkout
          </span>
          <span className="flex items-center gap-1">
            <Zap className="h-3.5 w-3.5 text-emerald-500" />
            Instant confirmation
          </span>
        </div>

        {/* Free cancellation notice */}
        {freeCancellationUntil && (
          <div className="flex items-start gap-2 p-3 bg-emerald-50 rounded-lg text-sm">
            <Check className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-medium text-emerald-800">Free cancellation</span>
              <p className="text-emerald-700">
                Cancel before {freeCancellationUntil} for a full refund
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Compact price display for when no site is selected yet
 */
export function PriceSummaryPlaceholder({
  message = "Select an accommodation to see pricing",
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div className={cn("bg-card rounded-xl border border-border shadow-lg p-6", className)}>
      <div className="text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto">
          <Calendar className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
