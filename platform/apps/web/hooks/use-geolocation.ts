"use client";

import { useState, useEffect, useCallback } from "react";

// US state abbreviation to full name mapping
const STATE_NAMES: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  DC: "District of Columbia",
};

export interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  state: string | null;
  stateName: string | null;
  city: string | null;
  error: string | null;
  isLoading: boolean;
  isSupported: boolean;
}

interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  autoDetect?: boolean;
}

const STORAGE_KEY = "campreserv:userLocation";

/**
 * Hook for detecting user's location using browser Geolocation API
 * Caches result in localStorage for return visits
 */
export function useGeolocation(options: UseGeolocationOptions = {}) {
  const {
    enableHighAccuracy = false,
    timeout = 10000,
    maximumAge = 1000 * 60 * 60 * 24, // 24 hours
    autoDetect = true,
  } = options;

  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    state: null,
    stateName: null,
    city: null,
    error: null,
    isLoading: false,
    isSupported: typeof window !== "undefined" && "geolocation" in navigator,
  });

  // Load cached location on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        // Check if cache is still valid (24 hours)
        if (parsed.timestamp && Date.now() - parsed.timestamp < maximumAge) {
          setState((prev) => ({
            ...prev,
            latitude: parsed.latitude,
            longitude: parsed.longitude,
            state: parsed.state,
            stateName: parsed.stateName,
            city: parsed.city,
          }));
          return;
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }

    // Auto-detect if no valid cache and autoDetect is enabled
    if (autoDetect && state.isSupported) {
      detectLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reverse geocode coordinates to get state/city
  const reverseGeocode = useCallback(async (lat: number, lon: number) => {
    try {
      // Use Nominatim (OpenStreetMap) for reverse geocoding - free, no API key
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`,
        {
          headers: {
            "Accept-Language": "en-US,en",
            "User-Agent": "Keepr/1.0",
          },
        },
      );

      if (!response.ok) {
        throw new Error("Geocoding failed");
      }

      const data = await response.json();
      const address = data.address || {};

      // Extract state - try multiple possible fields
      const stateCode = address["ISO3166-2-lvl4"]?.split("-")[1] || null;
      const stateName = address.state || STATE_NAMES[stateCode] || null;
      const city = address.city || address.town || address.village || address.county || null;

      return { state: stateCode, stateName, city };
    } catch (error) {
      console.warn("Reverse geocoding failed:", error);
      return { state: null, stateName: null, city: null };
    }
  }, []);

  // Main detection function
  const detectLocation = useCallback(async () => {
    if (!state.isSupported) {
      setState((prev) => ({
        ...prev,
        error: "Geolocation is not supported by your browser",
      }));
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy,
          timeout,
          maximumAge,
        });
      });

      const { latitude, longitude } = position.coords;

      // Reverse geocode to get state/city
      const { state: stateCode, stateName, city } = await reverseGeocode(latitude, longitude);

      const newState = {
        latitude,
        longitude,
        state: stateCode,
        stateName,
        city,
        error: null,
        isLoading: false,
        isSupported: true,
      };

      setState(newState);

      // Cache the result
      if (typeof window !== "undefined") {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            latitude,
            longitude,
            state: stateCode,
            stateName,
            city,
            timestamp: Date.now(),
          }),
        );
      }
    } catch (error) {
      let errorMessage = "Failed to get location";

      if (error instanceof GeolocationPositionError) {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location permission denied";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location unavailable";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out";
            break;
        }
      }

      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
    }
  }, [state.isSupported, enableHighAccuracy, timeout, maximumAge, reverseGeocode]);

  // Clear cached location
  const clearLocation = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
    setState({
      latitude: null,
      longitude: null,
      state: null,
      stateName: null,
      city: null,
      error: null,
      isLoading: false,
      isSupported: state.isSupported,
    });
  }, [state.isSupported]);

  return {
    ...state,
    detectLocation,
    clearLocation,
  };
}

/**
 * Get state name from abbreviation
 */
export function getStateName(abbreviation: string): string {
  return STATE_NAMES[abbreviation.toUpperCase()] || abbreviation;
}

/**
 * Get state abbreviation from full name
 */
export function getStateAbbreviation(name: string): string | null {
  const normalized = name.toLowerCase().trim();
  for (const [abbr, fullName] of Object.entries(STATE_NAMES)) {
    if (fullName.toLowerCase() === normalized) {
      return abbr;
    }
  }
  return null;
}
