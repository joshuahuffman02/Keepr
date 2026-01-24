import { apiClient } from "./api-client";
import { randomId } from "./random-id";

const SESSION_KEY = "analyticsSessionId";
const ANALYTICS_MODE = process.env.NEXT_PUBLIC_ANALYTICS_MODE || "live";
const ANALYTICS_DISABLED = process.env.NEXT_PUBLIC_ANALYTICS_DISABLED === "true";

function getDeviceType() {
  if (typeof window === "undefined") return undefined;
  const ua = navigator.userAgent || "";
  if (/mobile/i.test(ua)) return "mobile";
  if (/tablet/i.test(ua)) return "tablet";
  return "desktop";
}

interface AnalyticsMockEntry {
  sessionId: string;
  eventName: string;
  page?: string;
  referrer?: string;
  referrerUrl?: string;
  deviceType?: string;
  region?: string;
  campgroundId?: string;
  organizationId?: string;
  reservationId?: string;
  siteId?: string;
  siteClassId?: string;
  promotionId?: string;
  imageId?: string;
  metadata?: Record<string, unknown>;
  occurredAt?: string;
  at: string;
}

declare global {
  interface Window {
    __analyticsMock?: AnalyticsMockEntry[];
  }
}

export function getAnalyticsSessionId() {
  if (typeof window === "undefined") return "server";
  const existing = localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const id = randomId();
  localStorage.setItem(SESSION_KEY, id);
  return id;
}

export async function trackEvent(
  eventName: string,
  payload: Partial<{
    campgroundId: string;
    organizationId: string;
    reservationId: string;
    siteId: string;
    siteClassId: string;
    promotionId: string;
    imageId: string;
    page: string;
    referrer: string;
    referrerUrl: string;
    deviceType: string;
    region: string;
    source: string;
    metadata: Record<string, unknown>;
    occurredAt: string;
  }>,
) {
  if (ANALYTICS_DISABLED) return;
  const sessionId = getAnalyticsSessionId();
  const deviceType = payload.deviceType || getDeviceType();
  const referrer =
    payload.referrer ??
    (typeof document !== "undefined" ? document.referrer || undefined : undefined);
  const page =
    payload.page ?? (typeof window !== "undefined" ? window.location.pathname : undefined);

  const body = {
    sessionId,
    eventName,
    page,
    referrer,
    referrerUrl: payload.referrerUrl,
    deviceType,
    region: payload.region,
    campgroundId: payload.campgroundId,
    organizationId: payload.organizationId,
    reservationId: payload.reservationId,
    siteId: payload.siteId,
    siteClassId: payload.siteClassId,
    promotionId: payload.promotionId,
    imageId: payload.imageId,
    metadata: payload.metadata,
    occurredAt: payload.occurredAt,
  };

  if (ANALYTICS_MODE === "mock") {
    // Mock/no-op mode for local validation without hitting the API
    if (typeof window !== "undefined") {
      const existing = window.__analyticsMock;
      const list = existing ?? [];
      list.push({ ...body, at: new Date().toISOString() });
      window.__analyticsMock = list.slice(-200);
    }
    console.debug("[analytics:mock]", eventName, body);
    return;
  }

  try {
    await apiClient.logAnalyticsEvent(body);
  } catch (err) {
    // swallow analytics errors
    console.warn("trackEvent failed", err);
  }
}

export function trackPageView(
  payload: Partial<{
    campgroundId: string;
    organizationId: string;
    page: string;
    referrer: string;
    referrerUrl: string;
    region: string;
  }>,
) {
  return trackEvent("page_view", payload);
}

export function trackAddToStay(
  payload: Partial<{
    campgroundId: string;
    reservationId: string;
    siteId: string;
    siteClassId: string;
    region: string;
    metadata: Record<string, unknown>;
  }>,
) {
  return trackEvent("add_to_stay", payload);
}

export function trackReservationStart(
  payload: Partial<{
    campgroundId: string;
    reservationId: string;
    siteId: string;
    siteClassId: string;
    region: string;
    metadata: Record<string, unknown>;
  }>,
) {
  return trackEvent("reservation_start", payload);
}

export function trackReservationCompleted(
  payload: Partial<{
    campgroundId: string;
    reservationId: string;
    siteId: string;
    siteClassId: string;
    region: string;
    metadata: Record<string, unknown>;
  }>,
) {
  return trackEvent("reservation_completed", payload);
}

export function trackReservationAbandoned(
  payload: Partial<{
    campgroundId: string;
    reservationId: string;
    siteId: string;
    siteClassId: string;
    region: string;
    metadata: Record<string, unknown>;
  }>,
) {
  return trackEvent("reservation_abandoned", payload);
}

export function trackAvailabilityCheck(
  payload: Partial<{
    campgroundId: string;
    siteClassId: string;
    region: string;
    metadata: Record<string, unknown>;
  }>,
) {
  return trackEvent("availability_check", payload);
}

export function trackImageViewed(
  payload: Partial<{
    campgroundId: string;
    imageId: string;
    siteId: string;
    siteClassId: string;
    region: string;
    metadata: Record<string, unknown>;
  }>,
) {
  return trackEvent("image_viewed", payload);
}

export function trackImageClicked(
  payload: Partial<{
    campgroundId: string;
    imageId: string;
    siteId: string;
    siteClassId: string;
    region: string;
    metadata: Record<string, unknown>;
  }>,
) {
  return trackEvent("image_clicked", payload);
}

export function trackDealViewed(
  payload: Partial<{
    campgroundId: string;
    promotionId: string;
    region: string;
    metadata: Record<string, unknown>;
  }>,
) {
  return trackEvent("deal_viewed", payload);
}

export function trackDealApplied(
  payload: Partial<{
    campgroundId: string;
    promotionId: string;
    region: string;
    metadata: Record<string, unknown>;
  }>,
) {
  return trackEvent("deal_applied", payload);
}
