import { Injectable, Logger } from "@nestjs/common";
import { RealtimeGateway } from "./realtime.gateway";

/**
 * Event types for real-time updates
 */
export enum RealtimeEvent {
  // Reservation events
  RESERVATION_CREATED = "reservation.created",
  RESERVATION_UPDATED = "reservation.updated",
  RESERVATION_CANCELLED = "reservation.cancelled",
  RESERVATION_CHECKED_IN = "reservation.checked_in",
  RESERVATION_CHECKED_OUT = "reservation.checked_out",

  // Site/availability events
  SITE_AVAILABILITY_CHANGED = "site.availability",
  SITE_BLOCKED = "site.blocked",
  SITE_UNBLOCKED = "site.unblocked",

  // Payment events
  PAYMENT_RECEIVED = "payment.received",
  PAYMENT_REFUNDED = "payment.refunded",

  // Dashboard metrics
  DASHBOARD_METRICS = "dashboard.metrics",

  // Notifications
  NOTIFICATION_NEW = "notification.new",

  // Guest events
  GUEST_CREATED = "guest.created",
  GUEST_UPDATED = "guest.updated",

  // Calendar sync
  CALENDAR_SYNC = "calendar.sync",

  // Yield management events
  YIELD_METRICS_UPDATED = "yield.metrics_updated",
  YIELD_RECOMMENDATION_GENERATED = "yield.recommendation_generated",
  YIELD_FORECAST_UPDATED = "yield.forecast_updated",
}

export interface ReservationEventData {
  reservationId: string;
  guestId?: string;
  guestName?: string;
  siteId?: string;
  siteName?: string;
  arrivalDate?: string;
  departureDate?: string;
  status?: string;
  totalCents?: number;
  balanceCents?: number;
}

export interface SiteAvailabilityEventData {
  siteId: string;
  siteName: string;
  date: string;
  available: boolean;
  reason?: string;
}

export interface PaymentEventData {
  paymentId: string;
  reservationId?: string;
  amountCents: number;
  method: string;
  guestName?: string;
}

export interface DashboardMetricsData {
  occupancyPercent: number;
  arrivalsToday: number;
  departuresToday: number;
  revenueToday: number;
  pendingCheckIns: number;
}

export interface NotificationData {
  id: string;
  type: string;
  title: string;
  message: string;
  priority?: "low" | "medium" | "high";
  actionUrl?: string;
}

export interface YieldMetricsUpdatedData {
  todayOccupancy: number;
  todayRevenue: number;
  todayADR: number;
  todayRevPAN: number;
  periodOccupancy: number;
  periodRevenue: number;
  next7DaysOccupancy: number;
  next30DaysOccupancy: number;
  gapNights: number;
  pendingRecommendations: number;
  potentialRevenue: number;
  triggeredBy?: "reservation" | "payment" | "scheduled" | "manual";
}

export interface YieldRecommendationData {
  recommendationId: string;
  siteClassId?: string;
  siteClassName?: string;
  dateStart: string;
  dateEnd: string;
  currentPrice: number;
  suggestedPrice: number;
  adjustmentPercent: number;
  estimatedRevenueDelta: number;
  confidence: number;
  reason: string;
}

export interface YieldForecastUpdatedData {
  forecasts: Array<{
    date: string;
    occupiedSites: number;
    totalSites: number;
    occupancyPct: number;
    projectedRevenue: number;
  }>;
  avgOccupancy7Days: number;
  avgOccupancy30Days: number;
  totalProjectedRevenue: number;
}

/**
 * Service for broadcasting real-time events to connected clients
 *
 * Usage in other services:
 * ```
 * constructor(private readonly realtime: RealtimeService) {}
 *
 * // After creating a reservation:
 * this.realtime.emitReservationCreated(campgroundId, reservationData);
 * ```
 */
@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);

  constructor(private readonly gateway: RealtimeGateway) {}

  // ============================================
  // Reservation Events
  // ============================================

  emitReservationCreated(campgroundId: string, data: ReservationEventData) {
    this.logger.debug(`Emitting reservation.created for ${campgroundId}`);
    this.gateway.emitToCampground(
      campgroundId,
      RealtimeEvent.RESERVATION_CREATED,
      data
    );
  }

  emitReservationUpdated(campgroundId: string, data: ReservationEventData) {
    this.logger.debug(`Emitting reservation.updated for ${campgroundId}`);
    this.gateway.emitToCampground(
      campgroundId,
      RealtimeEvent.RESERVATION_UPDATED,
      data
    );
  }

  emitReservationCancelled(campgroundId: string, data: { reservationId: string; guestName?: string }) {
    this.logger.debug(`Emitting reservation.cancelled for ${campgroundId}`);
    this.gateway.emitToCampground(
      campgroundId,
      RealtimeEvent.RESERVATION_CANCELLED,
      data
    );
  }

  emitReservationCheckedIn(campgroundId: string, data: ReservationEventData) {
    this.logger.debug(`Emitting reservation.checked_in for ${campgroundId}`);
    this.gateway.emitToCampground(
      campgroundId,
      RealtimeEvent.RESERVATION_CHECKED_IN,
      data
    );
  }

  emitReservationCheckedOut(campgroundId: string, data: ReservationEventData) {
    this.logger.debug(`Emitting reservation.checked_out for ${campgroundId}`);
    this.gateway.emitToCampground(
      campgroundId,
      RealtimeEvent.RESERVATION_CHECKED_OUT,
      data
    );
  }

  // ============================================
  // Site/Availability Events
  // ============================================

  emitSiteAvailabilityChanged(campgroundId: string, data: SiteAvailabilityEventData) {
    this.logger.debug(`Emitting site.availability for ${campgroundId}`);
    this.gateway.emitToCampground(
      campgroundId,
      RealtimeEvent.SITE_AVAILABILITY_CHANGED,
      data
    );
  }

  // ============================================
  // Payment Events
  // ============================================

  emitPaymentReceived(campgroundId: string, data: PaymentEventData) {
    this.logger.debug(`Emitting payment.received for ${campgroundId}`);
    this.gateway.emitToCampground(
      campgroundId,
      RealtimeEvent.PAYMENT_RECEIVED,
      data
    );
  }

  emitPaymentRefunded(campgroundId: string, data: PaymentEventData) {
    this.logger.debug(`Emitting payment.refunded for ${campgroundId}`);
    this.gateway.emitToCampground(
      campgroundId,
      RealtimeEvent.PAYMENT_REFUNDED,
      data
    );
  }

  // ============================================
  // Dashboard Events
  // ============================================

  emitDashboardMetrics(campgroundId: string, data: DashboardMetricsData) {
    // Use dashboard-specific room to reduce noise
    this.gateway.emitToDashboard(
      campgroundId,
      RealtimeEvent.DASHBOARD_METRICS,
      data
    );
  }

  // ============================================
  // Notification Events
  // ============================================

  emitNotificationToUser(userId: string, data: NotificationData) {
    this.logger.debug(`Emitting notification to user ${userId}`);
    this.gateway.emitToUser(userId, RealtimeEvent.NOTIFICATION_NEW, data);
  }

  emitNotificationToCampground(campgroundId: string, data: NotificationData) {
    this.logger.debug(`Emitting notification to campground ${campgroundId}`);
    this.gateway.emitToCampground(
      campgroundId,
      RealtimeEvent.NOTIFICATION_NEW,
      data
    );
  }

  // ============================================
  // Calendar Sync
  // ============================================

  emitCalendarSync(campgroundId: string, data: { siteIds?: string[]; startDate?: string; endDate?: string }) {
    this.logger.debug(`Emitting calendar.sync for ${campgroundId}`);
    this.gateway.emitToCampground(campgroundId, RealtimeEvent.CALENDAR_SYNC, data);
  }

  // ============================================
  // Yield Management Events
  // ============================================

  emitYieldMetricsUpdated(campgroundId: string, data: YieldMetricsUpdatedData) {
    this.logger.debug(`Emitting yield.metrics_updated for ${campgroundId}`);
    this.gateway.emitToDashboard(
      campgroundId,
      RealtimeEvent.YIELD_METRICS_UPDATED,
      data
    );
  }

  emitYieldRecommendationGenerated(campgroundId: string, data: YieldRecommendationData) {
    this.logger.debug(`Emitting yield.recommendation_generated for ${campgroundId}`);
    this.gateway.emitToDashboard(
      campgroundId,
      RealtimeEvent.YIELD_RECOMMENDATION_GENERATED,
      data
    );
  }

  emitYieldForecastUpdated(campgroundId: string, data: YieldForecastUpdatedData) {
    this.logger.debug(`Emitting yield.forecast_updated for ${campgroundId}`);
    this.gateway.emitToDashboard(
      campgroundId,
      RealtimeEvent.YIELD_FORECAST_UPDATED,
      data
    );
  }

  // ============================================
  // Stats
  // ============================================

  getStats() {
    return this.gateway.getStats();
  }
}
