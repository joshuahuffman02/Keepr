"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";
import type { apiClient } from "@/lib/api-client";

type AvailableSite = Awaited<ReturnType<typeof apiClient.getPublicAvailability>>[number];

export function useAnalyticsEmitters({
  campgroundId,
  slug,
  arrivalDate,
  departureDate,
  equipment,
  availableSites,
  selectedSiteId,
  step,
  reservationStartLogged,
  lastAvailabilityKey,
}: {
  campgroundId?: string;
  slug: string;
  arrivalDate: string;
  departureDate: string;
  equipment: { type: string; length: string };
  availableSites?: AvailableSite[];
  selectedSiteId?: string | null;
  step: number;
  reservationStartLogged: React.MutableRefObject<boolean>;
  lastAvailabilityKey: React.MutableRefObject<string | null>;
}) {
  useEffect(() => {
    if (campgroundId) {
      trackEvent("page_view", { page: `/park/${slug}/book`, campgroundId });
    }
  }, [campgroundId, slug]);

  useEffect(() => {
    if (!availableSites || !campgroundId) return;
    const key = `${arrivalDate}-${departureDate}-${equipment.type}-${equipment.length}`;
    if (key === lastAvailabilityKey.current) return;
    lastAvailabilityKey.current = key;
    trackEvent("availability_check", {
      campgroundId,
      page: `/park/${slug}/book`,
      metadata: {
        arrivalDate,
        departureDate,
        rigType: equipment.type,
        rigLength: equipment.length,
      },
    });
  }, [
    availableSites,
    campgroundId,
    arrivalDate,
    departureDate,
    equipment.type,
    equipment.length,
    slug,
    lastAvailabilityKey,
  ]);

  useEffect(() => {
    if (!campgroundId || !selectedSiteId) return;
    const site = availableSites?.find((s) => s.id === selectedSiteId);
    trackEvent("add_to_stay", {
      campgroundId,
      siteId: selectedSiteId,
      siteClassId: site?.siteClass?.id,
      page: `/park/${slug}/book`,
    });
  }, [selectedSiteId, availableSites, campgroundId, slug]);

  useEffect(() => {
    if (!campgroundId || step < 4 || reservationStartLogged.current) return;
    reservationStartLogged.current = true;
    trackEvent("reservation_start", {
      campgroundId,
      siteId: selectedSiteId || undefined,
      page: `/park/${slug}/book`,
    });
  }, [campgroundId, step, selectedSiteId, slug, reservationStartLogged]);
}
