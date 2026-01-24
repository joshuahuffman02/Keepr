"use client";

import React, { createContext, useContext, useEffect, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAnalytics, UseAnalyticsReturn } from "@/hooks/use-analytics";

// Feature area mapping for pages
const PAGE_FEATURE_MAP: Record<string, { title: string; area: string }> = {
  "/dashboard": { title: "Dashboard", area: "dashboard" },
  "/dashboard/reservations": { title: "Reservations", area: "reservations" },
  "/dashboard/calendar": { title: "Calendar", area: "reservations" },
  "/dashboard/guests": { title: "Guests", area: "guests" },
  "/dashboard/pos": { title: "Point of Sale", area: "pos" },
  "/dashboard/store": { title: "Store", area: "pos" },
  "/dashboard/housekeeping": { title: "Housekeeping", area: "housekeeping" },
  "/dashboard/maintenance": { title: "Maintenance", area: "maintenance" },
  "/dashboard/reports": { title: "Reports", area: "reports" },
  "/dashboard/analytics": { title: "Analytics", area: "reports" },
  "/dashboard/staff": { title: "Staff", area: "staff" },
  "/dashboard/schedule": { title: "Schedule", area: "staff" },
  "/dashboard/communications": { title: "Communications", area: "communications" },
  "/dashboard/messages": { title: "Messages", area: "communications" },
  "/dashboard/promotions": { title: "Promotions", area: "marketing" },
  "/dashboard/marketing": { title: "Marketing", area: "marketing" },
  "/dashboard/settings": { title: "Settings", area: "settings" },
  "/dashboard/payments": { title: "Payments", area: "payments" },
  "/dashboard/billing": { title: "Billing", area: "payments" },
  "/dashboard/ai": { title: "AI Assistant", area: "ai" },
};

// Get page info from path
function getPageInfo(path: string): { title: string; area: string } {
  // Check exact match first
  if (PAGE_FEATURE_MAP[path]) {
    return PAGE_FEATURE_MAP[path];
  }

  // Check prefix match
  for (const [prefix, info] of Object.entries(PAGE_FEATURE_MAP)) {
    if (path.startsWith(prefix + "/")) {
      return info;
    }
  }

  // Default
  return { title: "Dashboard", area: "other" };
}

// Analytics context
const AnalyticsContext = createContext<UseAnalyticsReturn | null>(null);

export function useAnalyticsContext() {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error("useAnalyticsContext must be used within AnalyticsProvider");
  }
  return context;
}

interface AnalyticsProviderProps {
  children: React.ReactNode;
  disabled?: boolean;
}

/**
 * Analytics provider that wraps the app and provides tracking context.
 * Automatically tracks page views on navigation.
 */
export function AnalyticsProvider({ children, disabled = false }: AnalyticsProviderProps) {
  const analytics = useAnalytics();
  const pathname = usePathname();
  const previousPathnameRef = useRef<string | null>(null);
  const isAdminRef = useRef<boolean>(false);

  // Check if this is an admin page
  useEffect(() => {
    isAdminRef.current =
      pathname?.startsWith("/dashboard") || pathname?.startsWith("/campgrounds") || false;
  }, [pathname]);

  // Track page views on navigation
  useEffect(() => {
    if (disabled || !pathname) return;

    // Skip if same path
    if (pathname === previousPathnameRef.current) return;
    previousPathnameRef.current = pathname;

    // Only auto-track admin pages
    if (!isAdminRef.current) return;

    // Get page info
    const pageInfo = getPageInfo(pathname);

    // Track page view with short delay to ensure DOM is ready
    const timer = setTimeout(() => {
      analytics.trackPageView({
        page: pathname,
        pageTitle: pageInfo.title,
        featureArea: pageInfo.area,
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [pathname, analytics, disabled]);

  // Track errors globally
  useEffect(() => {
    if (disabled || typeof window === "undefined") return;

    const handleError = (event: ErrorEvent) => {
      analytics.trackError(event.error || event.message, "unhandled_error");
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      analytics.trackError(event.reason?.message || String(event.reason), "unhandled_rejection");
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, [analytics, disabled]);

  if (disabled) {
    return <>{children}</>;
  }

  return <AnalyticsContext.Provider value={analytics}>{children}</AnalyticsContext.Provider>;
}

/**
 * HOC to track feature usage for a component
 */
export function withFeatureTracking<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  featureName: string,
  subFeature?: string,
) {
  const WithFeatureTracking = (props: P) => {
    const analytics = useAnalyticsContext();
    const startTimeRef = useRef<number>(Date.now());
    const hasTrackedRef = useRef<boolean>(false);

    useEffect(() => {
      startTimeRef.current = Date.now();
      hasTrackedRef.current = false;

      return () => {
        if (!hasTrackedRef.current) {
          const durationSecs = Math.floor((Date.now() - startTimeRef.current) / 1000);
          analytics.trackFeature({
            feature: featureName,
            subFeature,
            durationSecs,
            outcome: "success",
          });
          hasTrackedRef.current = true;
        }
      };
    }, [analytics]);

    return <WrappedComponent {...props} />;
  };

  WithFeatureTracking.displayName = `WithFeatureTracking(${WrappedComponent.displayName || WrappedComponent.name || "Component"})`;
  return WithFeatureTracking;
}

/**
 * Hook to track a specific action
 */
export function useTrackAction() {
  const analytics = useAnalyticsContext();

  return useCallback(
    (actionType: string, actionTarget?: string, metadata?: Record<string, unknown>) => {
      analytics.trackAction({ actionType, actionTarget, metadata });
    },
    [analytics],
  );
}

/**
 * Hook to track search queries
 */
export function useTrackSearch() {
  const analytics = useAnalyticsContext();

  return useCallback(
    (query: string, resultsCount?: number) => {
      analytics.trackSearch(query, resultsCount);
    },
    [analytics],
  );
}

/**
 * Hook to track feature usage with duration
 */
export function useFeatureTracking(featureName: string, subFeature?: string) {
  const analytics = useAnalyticsContext();
  const startTimeRef = useRef<number>(Date.now());

  const trackSuccess = useCallback(
    (metadata?: Record<string, unknown>) => {
      const durationSecs = Math.floor((Date.now() - startTimeRef.current) / 1000);
      analytics.trackFeature({
        feature: featureName,
        subFeature,
        durationSecs,
        outcome: "success",
        metadata,
      });
      startTimeRef.current = Date.now();
    },
    [analytics, featureName, subFeature],
  );

  const trackFailure = useCallback(
    (error?: string, metadata?: Record<string, unknown>) => {
      const durationSecs = Math.floor((Date.now() - startTimeRef.current) / 1000);
      analytics.trackFeature({
        feature: featureName,
        subFeature,
        durationSecs,
        outcome: "failure",
        metadata: { ...metadata, error },
      });
      startTimeRef.current = Date.now();
    },
    [analytics, featureName, subFeature],
  );

  const reset = useCallback(() => {
    startTimeRef.current = Date.now();
  }, []);

  return { trackSuccess, trackFailure, reset };
}

/**
 * Hook for funnel tracking
 */
export function useFunnelTracking(funnelName: string) {
  const analytics = useAnalyticsContext();

  const start = useCallback(
    (stepName?: string) => {
      analytics.startFunnel(funnelName, stepName);
    },
    [analytics, funnelName],
  );

  const advance = useCallback(
    (stepName?: string, metadata?: Record<string, unknown>) => {
      analytics.advanceFunnel(funnelName, stepName, metadata);
    },
    [analytics, funnelName],
  );

  const complete = useCallback(
    (metadata?: Record<string, unknown>) => {
      analytics.completeFunnel(funnelName, metadata);
    },
    [analytics, funnelName],
  );

  const abandon = useCallback(
    (reason?: string) => {
      analytics.abandonFunnel(funnelName, reason);
    },
    [analytics, funnelName],
  );

  return { start, advance, complete, abandon };
}
