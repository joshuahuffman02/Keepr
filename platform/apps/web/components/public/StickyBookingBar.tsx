"use client";

import { useState, useEffect } from "react";
import { Calendar } from "lucide-react";
import { cn } from "../../lib/utils";

interface StickyBookingBarProps {
  campgroundName: string;
  priceFrom?: number;
  onBookClick: () => void;
  className?: string;
}

export function StickyBookingBar({
  campgroundName,
  priceFrom,
  onBookClick,
  className,
}: StickyBookingBarProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show after scrolling past 400px (past the hero)
      setIsVisible(window.scrollY > 400);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 md:hidden",
        "bg-card border-t border-border shadow-lg",
        "transform transition-transform duration-300 ease-out",
        isVisible ? "translate-y-0" : "translate-y-full",
        className
      )}
    >
      <div className="px-4 py-3 flex items-center justify-between gap-4">
        {/* Price info */}
        <div className="flex-1 min-w-0">
          {priceFrom ? (
            <>
              <div className="text-lg font-bold text-foreground">
                From ${priceFrom}
                <span className="text-sm font-normal text-muted-foreground">/night</span>
              </div>
              <p className="text-xs text-muted-foreground truncate">{campgroundName}</p>
            </>
          ) : (
            <div className="text-sm font-medium text-foreground truncate">
              {campgroundName}
            </div>
          )}
        </div>

        {/* Book button */}
        <button
          onClick={onBookClick}
          className="flex-shrink-0 inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:from-emerald-400 hover:to-teal-400 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
        >
          <Calendar className="h-4 w-4" />
          Check Availability
        </button>
      </div>

      {/* Safe area for iPhone notch */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </div>
  );
}
