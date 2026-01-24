"use client";

import { useState, useRef, useCallback, useEffect, ReactNode } from "react";
import { Loader2, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  /** Minimum pull distance to trigger refresh (default: 80) */
  threshold?: number;
  /** Maximum pull distance (default: 120) */
  maxPull?: number;
  /** Whether refresh is currently disabled */
  disabled?: boolean;
  /** Custom class for the container */
  className?: string;
}

type PullState = "idle" | "pulling" | "ready" | "refreshing";

/**
 * Pull-to-refresh component for mobile/PWA experiences.
 * Wrap your scrollable content with this component to enable pull-to-refresh gesture.
 *
 * @example
 * <PullToRefresh onRefresh={async () => { await refetch(); }}>
 *   <div className="min-h-screen">Content here</div>
 * </PullToRefresh>
 */
export function PullToRefresh({
  onRefresh,
  children,
  threshold = 80,
  maxPull = 120,
  disabled = false,
  className,
}: PullToRefreshProps) {
  const [pullState, setPullState] = useState<PullState>("idle");
  const [pullDistance, setPullDistance] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (disabled || pullState === "refreshing") return;

      const container = containerRef.current;
      if (!container) return;

      // Only allow pull-to-refresh when scrolled to top
      if (container.scrollTop > 0) return;

      startY.current = e.touches[0].clientY;
      currentY.current = startY.current;
    },
    [disabled, pullState],
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (disabled || pullState === "refreshing") return;
      if (startY.current === 0) return;

      const container = containerRef.current;
      if (!container) return;

      // Only allow pull-to-refresh when scrolled to top
      if (container.scrollTop > 0) {
        startY.current = 0;
        setPullDistance(0);
        setPullState("idle");
        return;
      }

      currentY.current = e.touches[0].clientY;
      const diff = currentY.current - startY.current;

      if (diff > 0) {
        // Prevent default scroll when pulling down
        e.preventDefault();

        // Apply resistance to pull (diminishing returns)
        const resistance = 0.5;
        const adjustedPull = Math.min(diff * resistance, maxPull);

        setPullDistance(adjustedPull);
        setPullState(adjustedPull >= threshold ? "ready" : "pulling");
      }
    },
    [disabled, pullState, threshold, maxPull],
  );

  const handleTouchEnd = useCallback(async () => {
    if (disabled || pullState === "refreshing") return;

    if (pullState === "ready") {
      setPullState("refreshing");
      setPullDistance(threshold);

      try {
        await onRefresh();
      } finally {
        setPullState("idle");
        setPullDistance(0);
      }
    } else {
      setPullState("idle");
      setPullDistance(0);
    }

    startY.current = 0;
    currentY.current = 0;
  }, [disabled, pullState, onRefresh, threshold]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const progress = Math.min(pullDistance / threshold, 1);

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-auto", className)}
      style={{ touchAction: pullState === "idle" ? "auto" : "none" }}
    >
      {/* Pull indicator */}
      <div
        className={cn(
          "absolute left-0 right-0 flex items-center justify-center transition-opacity duration-200 pointer-events-none z-10",
          pullDistance > 0 ? "opacity-100" : "opacity-0",
        )}
        style={{
          top: 0,
          height: pullDistance,
          transform: `translateY(${pullDistance > 0 ? 0 : -40}px)`,
        }}
      >
        <div
          className={cn(
            "flex flex-col items-center justify-center gap-1 transition-all duration-200",
            pullState === "ready" && "text-emerald-600",
            pullState === "refreshing" && "text-emerald-600",
          )}
        >
          {pullState === "refreshing" ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <ArrowDown
              className={cn(
                "h-6 w-6 transition-transform duration-200",
                pullState === "ready" && "rotate-180",
              )}
              style={{
                transform: `rotate(${progress * 180}deg)`,
              }}
            />
          )}
          <span className="text-xs font-medium">
            {pullState === "refreshing"
              ? "Refreshing..."
              : pullState === "ready"
                ? "Release to refresh"
                : "Pull to refresh"}
          </span>
        </div>
      </div>

      {/* Content with transform */}
      <div
        className="transition-transform duration-200 ease-out"
        style={{
          transform: `translateY(${pullDistance}px)`,
          transitionDuration: pullState === "idle" ? "200ms" : "0ms",
        }}
      >
        {children}
      </div>
    </div>
  );
}
