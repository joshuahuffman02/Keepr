"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Calendar, Users, Star, X, ChevronUp, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface MobileBookingBarProps {
  priceFrom?: number | null;
  reviewScore?: number | null;
  reviewCount?: number | null;
  arrivalDate: string;
  departureDate: string;
  guests: string;
  onArrivalChange: (date: string) => void;
  onDepartureChange: (date: string) => void;
  onGuestsChange: (guests: string) => void;
  onBookClick: () => void;
  charityName?: string;
  className?: string;
}

export function MobileBookingBar({
  priceFrom,
  reviewScore,
  reviewCount,
  arrivalDate,
  departureDate,
  guests,
  onArrivalChange,
  onDepartureChange,
  onGuestsChange,
  onBookClick,
  charityName,
  className,
}: MobileBookingBarProps) {
  const prefersReducedMotion = useReducedMotion();
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Show bar after scrolling past hero (approximately)
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const threshold = window.innerHeight * 0.5; // 50% of viewport height
      setIsVisible(scrollY > threshold);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Check initial position

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Prevent body scroll when expanded
  useEffect(() => {
    if (isExpanded) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isExpanded]);

  // Calculate nights
  const nights = useMemo(() => {
    if (!arrivalDate || !departureDate) return 0;
    const start = new Date(arrivalDate);
    const end = new Date(departureDate);
    return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  }, [arrivalDate, departureDate]);

  // Format date for display
  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return "Select";
    const date = new Date(dateStr + "T12:00:00");
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <>
      {/* Backdrop when expanded */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsExpanded(false)}
          />
        )}
      </AnimatePresence>

      {/* Bottom bar - mobile only */}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            className={cn(
              "fixed bottom-0 left-0 right-0 z-50 md:hidden",
              "bg-card border-t border-border shadow-2xl shadow-black/20",
              isExpanded ? "rounded-t-2xl" : "",
              className,
            )}
            initial={prefersReducedMotion ? { y: 0 } : { y: 100 }}
            animate={{ y: 0 }}
            exit={prefersReducedMotion ? { y: 0 } : { y: 100 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            {/* Expand handle */}
            {!isExpanded && (
              <button
                onClick={() => setIsExpanded(true)}
                className="absolute -top-3 left-1/2 -translate-x-1/2 w-10 h-3 flex items-center justify-center"
                aria-label="Expand booking options"
              >
                <div className="w-8 h-1 bg-muted rounded-full" />
              </button>
            )}

            {/* Collapsed view */}
            {!isExpanded && (
              <div className="flex items-center justify-between p-4 safe-area-inset-bottom">
                <div className="flex-1 min-w-0">
                  <button onClick={() => setIsExpanded(true)} className="text-left w-full">
                    {priceFrom ? (
                      <div className="flex items-baseline gap-1">
                        <span className="text-lg font-bold text-foreground">
                          ${priceFrom.toFixed(0)}
                        </span>
                        <span className="text-sm text-muted-foreground">/ night</span>
                      </div>
                    ) : (
                      <span className="text-sm font-medium text-muted-foreground">
                        Check availability
                      </span>
                    )}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                      <span>
                        {formatDisplayDate(arrivalDate)} - {formatDisplayDate(departureDate)}
                      </span>
                      {reviewScore && reviewCount && reviewCount > 0 && (
                        <>
                          <span className="text-muted-foreground">|</span>
                          <span className="flex items-center gap-1">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            {Number(reviewScore).toFixed(1)}
                          </span>
                        </>
                      )}
                    </div>
                  </button>
                </div>

                <Button
                  onClick={onBookClick}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold px-6 shadow-lg"
                >
                  Reserve
                </Button>
              </div>
            )}

            {/* Expanded view - full booking form */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={prefersReducedMotion ? {} : { height: 0 }}
                  animate={{ height: "auto" }}
                  exit={prefersReducedMotion ? {} : { height: 0 }}
                  className="overflow-hidden"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between p-4 border-b border-border">
                    <div>
                      {priceFrom ? (
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-bold text-foreground">
                            ${priceFrom.toFixed(0)}
                          </span>
                          <span className="text-sm text-muted-foreground">/ night</span>
                        </div>
                      ) : (
                        <span className="font-medium text-muted-foreground">
                          Check availability
                        </span>
                      )}
                      {nights > 0 && priceFrom && (
                        <p className="text-sm text-muted-foreground">
                          ${(priceFrom * nights).toFixed(0)} estimated for {nights} night
                          {nights === 1 ? "" : "s"}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsExpanded(false)}
                      aria-label="Close"
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>

                  {/* Form fields */}
                  <div className="p-4 space-y-4">
                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-3">
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
                            className="pl-10"
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
                            className="pl-10"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Guests */}
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Guests
                      </label>
                      <div className="relative">
                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                        <Select value={guests} onValueChange={onGuestsChange}>
                          <SelectTrigger className="pl-10">
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

                    {/* Charity badge */}
                    {charityName && (
                      <div className="flex items-center gap-2 p-3 bg-rose-50 rounded-lg border border-rose-100">
                        <Heart className="h-4 w-4 text-rose-500 flex-shrink-0" />
                        <p className="text-xs text-rose-700">
                          Part of your booking supports{" "}
                          <span className="font-medium">{charityName}</span>
                        </p>
                      </div>
                    )}

                    {/* Reserve button */}
                    <Button
                      onClick={() => {
                        setIsExpanded(false);
                        onBookClick();
                      }}
                      className="w-full h-12 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold text-base shadow-lg"
                    >
                      Reserve
                    </Button>

                    <p className="text-center text-xs text-muted-foreground">
                      You won't be charged yet
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
