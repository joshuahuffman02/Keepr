"use client";

import { useEffect, useState } from "react";
import { ChatWidget } from "@/components/chat";
import { apiClient } from "@/lib/api-client";
import { GUEST_TOKEN_KEY } from "@/lib/portal-constants";

interface GuestReservation {
  id: string;
  campgroundId: string;
  arrivalDate: string;
  departureDate: string;
  status: string;
}

interface GuestData {
  id: string;
  reservations: GuestReservation[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isGuestReservation = (value: unknown): value is GuestReservation => {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.campgroundId === "string" &&
    typeof value.arrivalDate === "string" &&
    typeof value.departureDate === "string" &&
    typeof value.status === "string"
  );
};

const isGuestData = (value: unknown): value is GuestData => {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string" || !Array.isArray(value.reservations)) return false;
  return value.reservations.every(isGuestReservation);
};

/**
 * Portal-specific chat widget wrapper that handles:
 * - Getting guest auth token from localStorage
 * - Fetching guest data to get guestId
 * - Determining the active campgroundId from current reservation
 */
export function PortalChatWidget() {
  const [isReady, setIsReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [guestId, setGuestId] = useState<string | undefined>();
  const [campgroundId, setCampgroundId] = useState<string | undefined>();

  useEffect(() => {
    // Only run in browser
    if (typeof window === "undefined") return;

    const storedToken = localStorage.getItem(GUEST_TOKEN_KEY);
    if (!storedToken) {
      // No token - don't show chat widget
      return;
    }

    setToken(storedToken);

    // Fetch guest data to get campgroundId
    const fetchGuestData = async () => {
      try {
        const data = await apiClient.getGuestMe(storedToken);
        if (!isGuestData(data)) {
          return;
        }
        setGuestId(data.id);

        // Find the most relevant reservation (current or upcoming)
        const now = new Date();
        const reservations = data.reservations || [];

        // Sort by arrival date
        const sortedReservations = [...reservations].sort(
          (a, b) => new Date(a.arrivalDate).getTime() - new Date(b.arrivalDate).getTime(),
        );

        // Find current stay (checked in or date overlap)
        const currentStay = sortedReservations.find((r) => {
          const arrival = new Date(r.arrivalDate);
          const departure = new Date(r.departureDate);
          return r.status === "checked_in" || (arrival <= now && departure >= now);
        });

        // Or find next upcoming reservation
        const upcomingStay = sortedReservations.find((r) => {
          const arrival = new Date(r.arrivalDate);
          return arrival > now && r.status !== "cancelled";
        });

        // Use current stay, or upcoming, or most recent
        const relevantReservation = currentStay || upcomingStay || sortedReservations[0];

        if (relevantReservation) {
          setCampgroundId(relevantReservation.campgroundId);
        }

        setIsReady(true);
      } catch (err) {
        console.error("Failed to fetch guest data for chat:", err);
        // Still show widget even if we can't get full context
        setIsReady(true);
      }
    };

    fetchGuestData();
  }, []);

  // Don't render until we have the minimum required data
  if (!isReady || !campgroundId) {
    return null;
  }

  return (
    <ChatWidget
      campgroundId={campgroundId}
      isGuest={true}
      guestId={guestId}
      authToken={token}
      position="bottom-right"
      useStreaming={true}
      streamingTransport="sse"
    />
  );
}
