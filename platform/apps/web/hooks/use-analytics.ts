"use client";

import { useCallback, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";

// Constants
const SESSION_KEY = "analyticsSessionId";
const SESSION_DATA_KEY = "analyticsSessionData";
const EVENT_QUEUE_KEY = "analyticsEventQueue";
const BATCH_SIZE = 10;
const BATCH_INTERVAL_MS = 5000;
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

// Types
interface SessionData {
  sessionId: string;
  startedAt: string;
  lastActivityAt: string;
  pageViews: number;
  actions: number;
  errors: number;
  pages: string[];
  entryPage?: string;
}

interface TrackingEvent {
  eventName: string;
  sessionId: string;
  page?: string;
  pageTitle?: string;
  featureArea?: string;
  actionType?: string;
  actionTarget?: string;
  searchQuery?: string;
  timeOnPageSecs?: number;
  scrollDepth?: number;
  errorMessage?: string;
  errorCode?: string;
  metadata?: Record<string, any>;
  occurredAt: string;
  campgroundId?: string;
  organizationId?: string;
  userId?: string;
}

interface FunnelState {
  funnelName: string;
  step: number;
  startedAt: string;
}

// Helpers
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getDeviceType(): string {
  if (typeof window === "undefined") return "unknown";
  const ua = navigator.userAgent || "";
  if (/mobile/i.test(ua)) return "mobile";
  if (/tablet/i.test(ua)) return "tablet";
  return "desktop";
}

function getBrowser(): string {
  if (typeof window === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Safari")) return "Safari";
  if (ua.includes("Edge")) return "Edge";
  return "Other";
}

function getOS(): string {
  if (typeof window === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("Mac")) return "macOS";
  if (ua.includes("Linux")) return "Linux";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("iOS") || ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
  return "Other";
}

function getScreenSize(): string {
  if (typeof window === "undefined") return "unknown";
  return `${window.screen.width}x${window.screen.height}`;
}

function getFeatureAreaFromPath(path: string): string {
  if (path.includes("/reservations") || path.includes("/calendar")) return "reservations";
  if (path.includes("/pos") || path.includes("/store")) return "pos";
  if (path.includes("/housekeeping") || path.includes("/cleaning")) return "housekeeping";
  if (path.includes("/maintenance") || path.includes("/tickets")) return "maintenance";
  if (path.includes("/reports") || path.includes("/analytics")) return "reports";
  if (path.includes("/guests")) return "guests";
  if (path.includes("/payments") || path.includes("/billing")) return "payments";
  if (path.includes("/settings")) return "settings";
  if (path.includes("/staff") || path.includes("/schedule")) return "staff";
  if (path.includes("/communications") || path.includes("/messages")) return "communications";
  if (path.includes("/promotions") || path.includes("/marketing")) return "marketing";
  if (path.includes("/ai")) return "ai";
  if (path.includes("/dashboard")) return "dashboard";
  return "other";
}

/**
 * Enhanced analytics hook for comprehensive tracking
 */
export function useAnalytics() {
  const { user, campgroundId, organizationId } = useAuth();
  const pageStartTimeRef = useRef<number>(Date.now());
  const scrollDepthRef = useRef<number>(0);
  const funnelsRef = useRef<Map<string, FunnelState>>(new Map());
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get or create session
  const getSession = useCallback((): SessionData => {
    if (typeof window === "undefined") {
      return {
        sessionId: "server",
        startedAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
        pageViews: 0,
        actions: 0,
        errors: 0,
        pages: [],
      };
    }

    const stored = localStorage.getItem(SESSION_DATA_KEY);
    if (stored) {
      const session = JSON.parse(stored) as SessionData;
      // Check if session is still valid (within 30 minutes of last activity)
      const lastActivity = new Date(session.lastActivityAt).getTime();
      if (Date.now() - lastActivity < 30 * 60 * 1000) {
        return session;
      }
    }

    // Create new session
    const session: SessionData = {
      sessionId: generateId(),
      startedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      pageViews: 0,
      actions: 0,
      errors: 0,
      pages: [],
      entryPage: window.location.pathname,
    };

    localStorage.setItem(SESSION_DATA_KEY, JSON.stringify(session));
    localStorage.setItem(SESSION_KEY, session.sessionId);

    // Start session on server
    fetch(`${API_BASE}/analytics/enhanced/session/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        actorType: user ? "staff" : "anonymous",
        userId: user?.id,
        campgroundId,
        organizationId,
        entryPage: session.entryPage,
        deviceType: getDeviceType(),
        browser: getBrowser(),
        os: getOS(),
        screenSize: getScreenSize(),
        userAgent: navigator.userAgent,
        locale: navigator.language,
        referrer: document.referrer || undefined,
      }),
    }).catch((err) => console.warn("Failed to start session", err));

    return session;
  }, [user, campgroundId, organizationId]);

  // Update session data
  const updateSession = useCallback((updates: Partial<SessionData>) => {
    if (typeof window === "undefined") return;

    const session = getSession();
    const updated = {
      ...session,
      ...updates,
      lastActivityAt: new Date().toISOString(),
    };
    localStorage.setItem(SESSION_DATA_KEY, JSON.stringify(updated));
  }, [getSession]);

  // Get event queue
  const getEventQueue = useCallback((): TrackingEvent[] => {
    if (typeof window === "undefined") return [];
    const stored = localStorage.getItem(EVENT_QUEUE_KEY);
    return stored ? JSON.parse(stored) : [];
  }, []);

  // Save event queue
  const saveEventQueue = useCallback((events: TrackingEvent[]) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(EVENT_QUEUE_KEY, JSON.stringify(events.slice(-100))); // Keep last 100
  }, []);

  // Flush event queue to server
  const flushEvents = useCallback(async () => {
    const events = getEventQueue();
    if (events.length === 0) return;

    // Clear queue immediately to prevent duplicates
    saveEventQueue([]);

    try {
      // Send events in parallel
      await Promise.all(
        events.map((event) =>
          fetch(`${API_BASE}/analytics/enhanced/event`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(campgroundId ? { "x-campground-id": campgroundId } : {}),
              ...(organizationId ? { "x-organization-id": organizationId } : {}),
            },
            body: JSON.stringify(event),
          }).catch((err) => console.warn("Failed to send event", err))
        )
      );
    } catch (err) {
      // Re-queue failed events
      saveEventQueue(events);
      console.warn("Failed to flush events", err);
    }
  }, [getEventQueue, saveEventQueue, campgroundId, organizationId]);

  // Queue an event
  const queueEvent = useCallback((event: TrackingEvent) => {
    const events = getEventQueue();
    events.push(event);
    saveEventQueue(events);

    // Flush if batch size reached
    if (events.length >= BATCH_SIZE) {
      flushEvents();
    } else {
      // Schedule flush after interval
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
      batchTimeoutRef.current = setTimeout(flushEvents, BATCH_INTERVAL_MS);
    }
  }, [getEventQueue, saveEventQueue, flushEvents]);

  // Track page view
  const trackPageView = useCallback((options?: {
    page?: string;
    pageTitle?: string;
    featureArea?: string;
  }) => {
    if (typeof window === "undefined") return;

    const session = getSession();
    const page = options?.page || window.location.pathname;
    const featureArea = options?.featureArea || getFeatureAreaFromPath(page);

    // Update session
    updateSession({
      pageViews: session.pageViews + 1,
      pages: [...session.pages.filter((p) => p !== page), page],
    });

    // Reset page tracking
    pageStartTimeRef.current = Date.now();
    scrollDepthRef.current = 0;

    // Queue event
    queueEvent({
      eventName: "admin_page_view",
      sessionId: session.sessionId,
      page,
      pageTitle: options?.pageTitle || document.title,
      featureArea,
      occurredAt: new Date().toISOString(),
      campgroundId: campgroundId ?? undefined,
      organizationId: organizationId ?? undefined,
      userId: user?.id,
    });
  }, [getSession, updateSession, queueEvent, campgroundId, organizationId, user]);

  // Track action
  const trackAction = useCallback((options: {
    actionType: string;
    actionTarget?: string;
    metadata?: Record<string, any>;
  }) => {
    if (typeof window === "undefined") return;

    const session = getSession();
    updateSession({ actions: session.actions + 1 });

    queueEvent({
      eventName: "admin_action",
      sessionId: session.sessionId,
      page: window.location.pathname,
      featureArea: getFeatureAreaFromPath(window.location.pathname),
      actionType: options.actionType,
      actionTarget: options.actionTarget,
      metadata: options.metadata,
      occurredAt: new Date().toISOString(),
      campgroundId: campgroundId ?? undefined,
      organizationId: organizationId ?? undefined,
      userId: user?.id,
    });
  }, [getSession, updateSession, queueEvent, campgroundId, organizationId, user]);

  // Track search
  const trackSearch = useCallback((query: string, results?: number) => {
    if (typeof window === "undefined") return;

    const session = getSession();
    queueEvent({
      eventName: "admin_search",
      sessionId: session.sessionId,
      page: window.location.pathname,
      featureArea: getFeatureAreaFromPath(window.location.pathname),
      searchQuery: query,
      metadata: { resultsCount: results },
      occurredAt: new Date().toISOString(),
      campgroundId: campgroundId ?? undefined,
      organizationId: organizationId ?? undefined,
      userId: user?.id,
    });
  }, [getSession, queueEvent, campgroundId, organizationId, user]);

  // Track error
  const trackError = useCallback((error: Error | string, code?: string) => {
    if (typeof window === "undefined") return;

    const session = getSession();
    updateSession({ errors: session.errors + 1 });

    const errorMessage = typeof error === "string" ? error : error.message;

    queueEvent({
      eventName: "admin_error",
      sessionId: session.sessionId,
      page: window.location.pathname,
      featureArea: getFeatureAreaFromPath(window.location.pathname),
      errorMessage,
      errorCode: code,
      occurredAt: new Date().toISOString(),
      campgroundId: campgroundId ?? undefined,
      organizationId: organizationId ?? undefined,
      userId: user?.id,
    });
  }, [getSession, updateSession, queueEvent, campgroundId, organizationId, user]);

  // Track feature usage
  const trackFeature = useCallback((options: {
    feature: string;
    subFeature?: string;
    durationSecs?: number;
    outcome?: "success" | "failure" | "partial";
    metadata?: Record<string, any>;
  }) => {
    if (typeof window === "undefined") return;

    const session = getSession();

    fetch(`${API_BASE}/analytics/enhanced/feature`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(campgroundId ? { "x-campground-id": campgroundId } : {}),
      },
      body: JSON.stringify({
        sessionId: session.sessionId,
        feature: options.feature,
        subFeature: options.subFeature,
        campgroundId,
        userId: user?.id,
        durationSecs: options.durationSecs,
        outcome: options.outcome,
        metadata: options.metadata,
      }),
    }).catch((err) => console.warn("Failed to track feature", err));
  }, [getSession, campgroundId, user]);

  // Start funnel
  const startFunnel = useCallback((funnelName: string, stepName?: string) => {
    if (typeof window === "undefined") return;

    const session = getSession();
    const funnel: FunnelState = {
      funnelName,
      step: 1,
      startedAt: new Date().toISOString(),
    };
    funnelsRef.current.set(funnelName, funnel);

    fetch(`${API_BASE}/analytics/enhanced/funnel/step`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(campgroundId ? { "x-campground-id": campgroundId } : {}),
      },
      body: JSON.stringify({
        sessionId: session.sessionId,
        funnelName,
        step: 1,
        stepName,
        campgroundId,
        organizationId,
      }),
    }).catch((err) => console.warn("Failed to start funnel", err));
  }, [getSession, campgroundId, organizationId]);

  // Advance funnel
  const advanceFunnel = useCallback((funnelName: string, stepName?: string, metadata?: Record<string, any>) => {
    if (typeof window === "undefined") return;

    const session = getSession();
    const funnel = funnelsRef.current.get(funnelName);
    if (!funnel) {
      // Start new funnel if not exists
      startFunnel(funnelName, stepName);
      return;
    }

    funnel.step++;
    funnelsRef.current.set(funnelName, funnel);

    fetch(`${API_BASE}/analytics/enhanced/funnel/step`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(campgroundId ? { "x-campground-id": campgroundId } : {}),
      },
      body: JSON.stringify({
        sessionId: session.sessionId,
        funnelName,
        step: funnel.step,
        stepName,
        campgroundId,
        organizationId,
        metadata,
      }),
    }).catch((err) => console.warn("Failed to advance funnel", err));
  }, [getSession, startFunnel, campgroundId, organizationId]);

  // Complete funnel
  const completeFunnel = useCallback((funnelName: string, metadata?: Record<string, any>) => {
    if (typeof window === "undefined") return;

    const session = getSession();
    funnelsRef.current.delete(funnelName);

    fetch(`${API_BASE}/analytics/enhanced/funnel/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(campgroundId ? { "x-campground-id": campgroundId } : {}),
      },
      body: JSON.stringify({
        sessionId: session.sessionId,
        funnelName,
        campgroundId,
        outcome: "completed",
        metadata,
      }),
    }).catch((err) => console.warn("Failed to complete funnel", err));
  }, [getSession, campgroundId]);

  // Abandon funnel
  const abandonFunnel = useCallback((funnelName: string, reason?: string) => {
    if (typeof window === "undefined") return;

    const session = getSession();
    const funnel = funnelsRef.current.get(funnelName);
    funnelsRef.current.delete(funnelName);

    fetch(`${API_BASE}/analytics/enhanced/funnel/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(campgroundId ? { "x-campground-id": campgroundId } : {}),
      },
      body: JSON.stringify({
        sessionId: session.sessionId,
        funnelName,
        campgroundId,
        outcome: "abandoned",
        abandonedStep: funnel?.step,
        abandonReason: reason,
      }),
    }).catch((err) => console.warn("Failed to abandon funnel", err));
  }, [getSession, campgroundId]);

  // Track timing
  const trackTiming = useCallback((category: string, variable: string, timeMs: number) => {
    if (typeof window === "undefined") return;

    const session = getSession();
    queueEvent({
      eventName: "admin_action",
      sessionId: session.sessionId,
      page: window.location.pathname,
      featureArea: category,
      actionType: "timing",
      actionTarget: variable,
      metadata: { timeMs },
      occurredAt: new Date().toISOString(),
      campgroundId: campgroundId ?? undefined,
      organizationId: organizationId ?? undefined,
      userId: user?.id,
    });
  }, [getSession, queueEvent, campgroundId, organizationId, user]);

  // Track page leave (time on page + scroll depth)
  const trackPageLeave = useCallback(() => {
    if (typeof window === "undefined") return;

    const session = getSession();
    const timeOnPageSecs = Math.floor((Date.now() - pageStartTimeRef.current) / 1000);

    queueEvent({
      eventName: "admin_page_view",
      sessionId: session.sessionId,
      page: window.location.pathname,
      featureArea: getFeatureAreaFromPath(window.location.pathname),
      timeOnPageSecs,
      scrollDepth: scrollDepthRef.current,
      metadata: { isPageLeave: true },
      occurredAt: new Date().toISOString(),
      campgroundId: campgroundId ?? undefined,
      organizationId: organizationId ?? undefined,
      userId: user?.id,
    });

    // Flush immediately on page leave
    flushEvents();
  }, [getSession, queueEvent, flushEvents, campgroundId, organizationId, user]);

  // Set up scroll tracking
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent = docHeight > 0 ? Math.round((scrollTop / docHeight) * 100) : 0;
      scrollDepthRef.current = Math.max(scrollDepthRef.current, scrollPercent);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Set up page visibility tracking
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        trackPageLeave();
      }
    };

    const handleBeforeUnload = () => {
      trackPageLeave();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [trackPageLeave]);

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
      flushEvents();
    };
  }, [flushEvents]);

  return {
    // Session
    getSessionId: () => getSession().sessionId,

    // Page tracking
    trackPageView,
    trackPageLeave,

    // Action tracking
    trackAction,
    trackSearch,
    trackError,

    // Feature tracking
    trackFeature,

    // Funnel tracking
    startFunnel,
    advanceFunnel,
    completeFunnel,
    abandonFunnel,

    // Timing
    trackTiming,

    // Flush
    flush: flushEvents,
  };
}

export type UseAnalyticsReturn = ReturnType<typeof useAnalytics>;
