"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronUp, ChevronDown, X, Shield, Calendar, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MobileBookingFooterProps {
  // Price info
  totalAmount: number; // in cents
  nights: number;
  pricePerNight?: number; // in cents

  // Optional breakdown
  breakdown?: {
    label: string;
    amount: number;
    isDiscount?: boolean;
  }[];

  // Site class selected
  siteClassName?: string;

  // Dates
  arrivalDate?: string;
  departureDate?: string;

  // CTA
  ctaLabel: string;
  ctaDisabled?: boolean;
  ctaLoading?: boolean;
  onCtaClick: () => void;

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

// Format date for display
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

export function MobileBookingFooter({
  totalAmount,
  nights,
  pricePerNight,
  breakdown,
  siteClassName,
  arrivalDate,
  departureDate,
  ctaLabel,
  ctaDisabled,
  ctaLoading,
  onCtaClick,
  className,
}: MobileBookingFooterProps) {
  const prefersReducedMotion = useReducedMotion();
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      {/* Backdrop when expanded */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setIsExpanded(false)}
          />
        )}
      </AnimatePresence>

      {/* Footer bar */}
      <motion.div
        className={cn(
          "bg-white border-t border-slate-200 shadow-lg z-50",
          className
        )}
        initial={prefersReducedMotion ? {} : { y: 100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
      >
        {/* Expanded panel */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={prefersReducedMotion ? {} : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-b border-slate-100"
            >
              <div className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">
                    Booking Summary
                  </h3>
                  <button
                    onClick={() => setIsExpanded(false)}
                    className="p-1 rounded-full hover:bg-slate-100"
                  >
                    <X className="h-5 w-5 text-slate-500" />
                  </button>
                </div>

                {/* Site class */}
                {siteClassName && (
                  <div className="text-sm text-slate-600">
                    <span className="font-medium text-slate-900">
                      {siteClassName}
                    </span>
                  </div>
                )}

                {/* Dates */}
                {arrivalDate && departureDate && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <span>
                      {formatDate(arrivalDate)} - {formatDate(departureDate)} ({nights} night{nights !== 1 ? "s" : ""})
                    </span>
                  </div>
                )}

                {/* Price breakdown */}
                {breakdown && breakdown.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    {breakdown.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between text-sm"
                      >
                        <span
                          className={cn(
                            item.isDiscount
                              ? "text-emerald-600"
                              : "text-slate-600"
                          )}
                        >
                          {item.label}
                        </span>
                        <span
                          className={cn(
                            item.isDiscount
                              ? "text-emerald-600"
                              : "text-slate-900"
                          )}
                        >
                          {item.isDiscount ? "-" : ""}
                          {formatCurrency(Math.abs(item.amount))}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Trust signal */}
                <div className="flex items-center gap-1.5 text-xs text-slate-500 pt-2">
                  <Shield className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Secure checkout with instant confirmation</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main bar */}
        <div className="safe-area-inset-bottom">
          <div className="flex items-center gap-4 p-4">
            {/* Price info (tappable to expand) */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex-1 text-left"
            >
              <div className="flex items-center gap-2">
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold text-slate-900">
                      {formatCurrency(totalAmount)}
                    </span>
                    <span className="text-sm text-slate-500">total</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <span>
                      {nights} night{nights !== 1 ? "s" : ""}
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronUp className="h-3 w-3" />
                    )}
                  </div>
                </div>
              </div>
            </button>

            {/* CTA Button */}
            <Button
              onClick={onCtaClick}
              disabled={ctaDisabled}
              className="h-12 px-6 text-base font-semibold bg-emerald-600 hover:bg-emerald-700"
            >
              {ctaLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </span>
              ) : (
                ctaLabel
              )}
            </Button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

/**
 * Placeholder footer when no selection made yet
 */
export function MobileBookingFooterPlaceholder({
  message = "Select an accommodation",
  onCtaClick,
  ctaDisabled = true,
}: {
  message?: string;
  onCtaClick?: () => void;
  ctaDisabled?: boolean;
}) {
  return (
    <div className="bg-white border-t border-slate-200 shadow-lg safe-area-inset-bottom">
      <div className="flex items-center gap-4 p-4">
        <div className="flex-1">
          <p className="text-sm text-slate-500">{message}</p>
        </div>
        <Button
          onClick={onCtaClick}
          disabled={ctaDisabled}
          className="h-12 px-6 text-base font-semibold"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
