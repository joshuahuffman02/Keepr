"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { API_BASE } from "@/lib/api-config";

// Derive WebSocket base URL from API base (remove /api suffix)
const WS_BASE = API_BASE.replace(/\/api$/, "");

// Event types from the API
export enum RealtimeEvent {
  RESERVATION_CREATED = "reservation.created",
  RESERVATION_UPDATED = "reservation.updated",
  RESERVATION_CANCELLED = "reservation.cancelled",
  RESERVATION_CHECKED_IN = "reservation.checked_in",
  RESERVATION_CHECKED_OUT = "reservation.checked_out",
  SITE_AVAILABILITY_CHANGED = "site.availability",
  SITE_BLOCKED = "site.blocked",
  SITE_UNBLOCKED = "site.unblocked",
  PAYMENT_RECEIVED = "payment.received",
  PAYMENT_REFUNDED = "payment.refunded",
  DASHBOARD_METRICS = "dashboard.metrics",
  NOTIFICATION_NEW = "notification.new",
  GUEST_CREATED = "guest.created",
  GUEST_UPDATED = "guest.updated",
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
  timestamp: string;
}

export interface SiteAvailabilityEventData {
  siteId: string;
  siteName: string;
  date: string;
  available: boolean;
  reason?: string;
  timestamp: string;
}

export interface PaymentEventData {
  paymentId: string;
  reservationId?: string;
  amountCents: number;
  method: string;
  guestName?: string;
  timestamp: string;
}

export interface DashboardMetricsData {
  occupancyPercent: number;
  arrivalsToday: number;
  departuresToday: number;
  revenueToday: number;
  pendingCheckIns: number;
  timestamp: string;
}

export interface NotificationData {
  id: string;
  type: string;
  title: string;
  message: string;
  priority?: "low" | "medium" | "high";
  actionUrl?: string;
  timestamp: string;
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
  timestamp: string;
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
  timestamp: string;
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
  timestamp: string;
}

export type RealtimeEventData =
  | ReservationEventData
  | SiteAvailabilityEventData
  | PaymentEventData
  | DashboardMetricsData
  | NotificationData
  | YieldMetricsUpdatedData
  | YieldRecommendationData
  | YieldForecastUpdatedData;

type EventCallback<T = RealtimeEventData> = (data: T) => void;

interface UseRealtimeOptions {
  /** Auto-connect on mount (default: true) */
  autoConnect?: boolean;
  /** Reconnect on disconnect (default: true) */
  reconnect?: boolean;
  /** Reconnection attempts (default: 5) */
  reconnectionAttempts?: number;
}

interface UseRealtimeReturn {
  /** Whether the socket is connected */
  isConnected: boolean;
  /** Whether currently attempting to reconnect */
  isReconnecting: boolean;
  /** Connection error if any */
  error: string | null;
  /** List of campground IDs the user is subscribed to */
  campgroundIds: string[];
  /** Manually connect to the WebSocket server */
  connect: () => void;
  /** Manually disconnect from the WebSocket server */
  disconnect: () => void;
  /** Subscribe to a specific event type */
  on: <T extends RealtimeEventData>(event: RealtimeEvent, callback: EventCallback<T>) => () => void;
  /** Subscribe to multiple events at once */
  onMany: <T extends RealtimeEventData>(
    events: RealtimeEvent[],
    callback: EventCallback<T>,
  ) => () => void;
  /** Emit a message to the server (rarely needed) */
  emit: (event: string, data: unknown) => void;
}

/**
 * React hook for real-time WebSocket updates
 *
 * Usage:
 * ```tsx
 * const { isConnected, on } = useRealtime();
 *
 * useEffect(() => {
 *   const unsubscribe = on(RealtimeEvent.RESERVATION_CREATED, (data) => {
 *     console.log("New reservation:", data);
 *     // Invalidate queries, show toast, etc.
 *   });
 *   return unsubscribe;
 * }, [on]);
 * ```
 */
export function useRealtime(options: UseRealtimeOptions = {}): UseRealtimeReturn {
  const { autoConnect = true, reconnect = true, reconnectionAttempts = 5 } = options;

  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [campgroundIds, setCampgroundIds] = useState<string[]>([]);

  // Get auth token from localStorage
  const getAuthToken = useCallback(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("campreserv:authToken");
  }, []);

  // Connect to WebSocket server
  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const token = getAuthToken();
    if (!token) {
      setError("No authentication token available");
      return;
    }

    const socket = io(`${WS_BASE}/realtime`, {
      auth: { token },
      reconnection: reconnect,
      reconnectionAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      setIsReconnecting(false);
      setError(null);
    });

    socket.on("connected", (data: { userId: string; campgroundIds: string[] }) => {
      setCampgroundIds(data.campgroundIds);
    });

    socket.on("disconnect", (reason) => {
      setIsConnected(false);
      if (reason === "io server disconnect") {
        // Server disconnected us, might be auth issue
        setError("Disconnected by server");
      }
    });

    socket.on("connect_error", (err) => {
      setError(err.message);
      setIsConnected(false);
    });

    socket.io.on("reconnect_attempt", () => {
      setIsReconnecting(true);
    });

    socket.io.on("reconnect", () => {
      setIsReconnecting(false);
      setError(null);
    });

    socket.io.on("reconnect_failed", () => {
      setIsReconnecting(false);
      setError("Failed to reconnect after multiple attempts");
    });

    socket.on("error", (data: { message: string }) => {
      setError(data.message);
    });
  }, [getAuthToken, reconnect, reconnectionAttempts]);

  // Disconnect from WebSocket server
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setCampgroundIds([]);
    }
  }, []);

  // Subscribe to an event
  const on = useCallback(
    <T extends RealtimeEventData>(
      event: RealtimeEvent,
      callback: EventCallback<T>,
    ): (() => void) => {
      const socket = socketRef.current;
      if (!socket) {
        console.warn(
          "[useRealtime] Socket not connected, event listener will be added when connected",
        );
      }

      const handler = (data: T) => callback(data);
      socket?.on(event, handler);

      // Return unsubscribe function
      return () => {
        socket?.off(event, handler);
      };
    },
    [],
  );

  // Subscribe to multiple events
  const onMany = useCallback(
    <T extends RealtimeEventData>(
      events: RealtimeEvent[],
      callback: EventCallback<T>,
    ): (() => void) => {
      const unsubscribers = events.map((event) => on<T>(event, callback));
      return () => {
        unsubscribers.forEach((unsub) => unsub());
      };
    },
    [on],
  );

  // Emit a message
  const emit = useCallback((event: string, data: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect && typeof window !== "undefined") {
      const token = getAuthToken();
      if (token) {
        connect();
      }
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect, getAuthToken]);

  // Reconnect when auth token changes
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "campreserv:authToken") {
        if (e.newValue) {
          // Token was set, reconnect
          disconnect();
          connect();
        } else {
          // Token was removed, disconnect
          disconnect();
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [connect, disconnect]);

  return {
    isConnected,
    isReconnecting,
    error,
    campgroundIds,
    connect,
    disconnect,
    on,
    onMany,
    emit,
  };
}

/**
 * Hook specifically for reservation events with automatic query invalidation
 *
 * Usage:
 * ```tsx
 * useReservationUpdates({
 *   onCreated: (data) => toast({ title: `New reservation from ${data.guestName}` }),
 *   onCancelled: (data) => toast({ title: "Reservation cancelled", variant: "destructive" }),
 * });
 * ```
 */
export function useReservationUpdates(handlers: {
  onCreated?: EventCallback<ReservationEventData>;
  onUpdated?: EventCallback<ReservationEventData>;
  onCancelled?: EventCallback<ReservationEventData>;
  onCheckedIn?: EventCallback<ReservationEventData>;
  onCheckedOut?: EventCallback<ReservationEventData>;
}) {
  const { on } = useRealtime();

  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    if (handlers.onCreated) {
      unsubscribers.push(on(RealtimeEvent.RESERVATION_CREATED, handlers.onCreated));
    }
    if (handlers.onUpdated) {
      unsubscribers.push(on(RealtimeEvent.RESERVATION_UPDATED, handlers.onUpdated));
    }
    if (handlers.onCancelled) {
      unsubscribers.push(on(RealtimeEvent.RESERVATION_CANCELLED, handlers.onCancelled));
    }
    if (handlers.onCheckedIn) {
      unsubscribers.push(on(RealtimeEvent.RESERVATION_CHECKED_IN, handlers.onCheckedIn));
    }
    if (handlers.onCheckedOut) {
      unsubscribers.push(on(RealtimeEvent.RESERVATION_CHECKED_OUT, handlers.onCheckedOut));
    }

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [on, handlers]);
}

/**
 * Hook for dashboard metrics updates
 */
export function useDashboardMetrics(callback: EventCallback<DashboardMetricsData>) {
  const { on } = useRealtime();

  useEffect(() => {
    return on(RealtimeEvent.DASHBOARD_METRICS, callback);
  }, [on, callback]);
}

/**
 * Hook for user notifications
 */
export function useNotifications(callback: EventCallback<NotificationData>) {
  const { on } = useRealtime();

  useEffect(() => {
    return on(RealtimeEvent.NOTIFICATION_NEW, callback);
  }, [on, callback]);
}

/**
 * Hook for yield dashboard real-time updates
 *
 * Usage:
 * ```tsx
 * useYieldUpdates({
 *   onMetricsUpdated: (data) => {
 *     // Update local state or invalidate queries
 *     queryClient.invalidateQueries({ queryKey: ["yield-dashboard"] });
 *   },
 *   onRecommendationGenerated: (data) => {
 *     toast({ title: "New pricing recommendation", description: data.reason });
 *   },
 *   onForecastUpdated: (data) => {
 *     // Handle forecast changes
 *   },
 * });
 * ```
 */
export function useYieldUpdates(handlers: {
  onMetricsUpdated?: EventCallback<YieldMetricsUpdatedData>;
  onRecommendationGenerated?: EventCallback<YieldRecommendationData>;
  onForecastUpdated?: EventCallback<YieldForecastUpdatedData>;
}) {
  const { on } = useRealtime();

  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    if (handlers.onMetricsUpdated) {
      unsubscribers.push(on(RealtimeEvent.YIELD_METRICS_UPDATED, handlers.onMetricsUpdated));
    }
    if (handlers.onRecommendationGenerated) {
      unsubscribers.push(
        on(RealtimeEvent.YIELD_RECOMMENDATION_GENERATED, handlers.onRecommendationGenerated),
      );
    }
    if (handlers.onForecastUpdated) {
      unsubscribers.push(on(RealtimeEvent.YIELD_FORECAST_UPDATED, handlers.onForecastUpdated));
    }

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [on, handlers]);
}
