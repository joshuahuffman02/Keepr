"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Hook to persist booking form data in sessionStorage
 * Allows back navigation without losing form data
 */

const STORAGE_KEY = "campreserv:booking-form-data";
const STORAGE_EXPIRY_KEY = "campreserv:booking-form-expiry";
const EXPIRY_DURATION_MS = 30 * 60 * 1000; // 30 minutes

export interface BookingFormData {
  // Stay details
  arrivalDate: string;
  departureDate: string;
  adults: number;
  children: number;
  pets: number;
  rigType: string;
  rigLength: string;

  // Guest info
  guestId: string;
  guestSearch: string;
  guestAddress1: string;
  guestCity: string;
  guestState: string;
  guestPostalCode: string;

  // New guest form
  newGuest?: {
    primaryFirstName: string;
    primaryLastName: string;
    email: string;
    phone: string;
    address1: string;
    city: string;
    state: string;
    postalCode: string;
  };

  // Site selection
  siteId: string;
  siteClassId: string;
  siteTypeFilter: string;
  siteClassFilter: string;
  lockSite: boolean;
  assignSpecificSite?: boolean;
  siteAssignmentNote?: string;

  // Notes and preferences
  notes: string;
  referralSource: string;
  stayReason: string;

  // Payment
  collectPayment: boolean;
  paymentAmount: string;
  paymentMethod: string;
  cardEntryMode: string;
  cashReceived: string;
  paymentNotes: string;

  // Pricing type for v2
  pricingType?: "transient" | "seasonal";
  seasonalRateId?: string;

  // Campground context
  campgroundId?: string;
}

interface UseBookingFormPersistenceOptions {
  /** Key suffix for multi-form scenarios */
  storageKey?: string;
  /** Duration before data expires (ms), default 30 minutes */
  expiryDuration?: number;
  /** Callback when restored data is loaded */
  onRestore?: (data: Partial<BookingFormData>) => void;
}

interface UseBookingFormPersistenceReturn {
  /** Persisted form data (null if none) */
  restoredData: Partial<BookingFormData> | null;
  /** Whether there is restorable data */
  hasRestoredData: boolean;
  /** Save current form data */
  saveFormData: (data: Partial<BookingFormData>) => void;
  /** Clear all saved data */
  clearFormData: () => void;
  /** Check if data is expired */
  isExpired: boolean;
}

export function useBookingFormPersistence(
  options: UseBookingFormPersistenceOptions = {},
): UseBookingFormPersistenceReturn {
  const { storageKey = STORAGE_KEY, expiryDuration = EXPIRY_DURATION_MS, onRestore } = options;

  const [restoredData, setRestoredData] = useState<Partial<BookingFormData> | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const onRestoreRef = useRef(onRestore);
  onRestoreRef.current = onRestore;

  // Check for persisted data on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const storedData = sessionStorage.getItem(storageKey);
      const storedExpiry = sessionStorage.getItem(`${storageKey}:expiry`);

      if (!storedData) {
        setRestoredData(null);
        return;
      }

      // Check expiry
      if (storedExpiry) {
        const expiryTime = parseInt(storedExpiry, 10);
        if (Date.now() > expiryTime) {
          // Data has expired, clear it
          sessionStorage.removeItem(storageKey);
          sessionStorage.removeItem(`${storageKey}:expiry`);
          setIsExpired(true);
          setRestoredData(null);
          return;
        }
      }

      const parsed: Partial<BookingFormData> = JSON.parse(storedData);
      setRestoredData(parsed);
      setIsExpired(false);

      // Call restore callback
      if (onRestoreRef.current) {
        onRestoreRef.current(parsed);
      }
    } catch (error) {
      console.warn("[BookingFormPersistence] Failed to restore data:", error);
      setRestoredData(null);
    }
  }, [storageKey]);

  const saveFormData = useCallback(
    (data: Partial<BookingFormData>) => {
      if (typeof window === "undefined") return;

      try {
        const expiryTime = Date.now() + expiryDuration;
        sessionStorage.setItem(storageKey, JSON.stringify(data));
        sessionStorage.setItem(`${storageKey}:expiry`, String(expiryTime));
      } catch (error) {
        console.warn("[BookingFormPersistence] Failed to save data:", error);
      }
    },
    [storageKey, expiryDuration],
  );

  const clearFormData = useCallback(() => {
    if (typeof window === "undefined") return;

    try {
      sessionStorage.removeItem(storageKey);
      sessionStorage.removeItem(`${storageKey}:expiry`);
      setRestoredData(null);
      setIsExpired(false);
    } catch (error) {
      console.warn("[BookingFormPersistence] Failed to clear data:", error);
    }
  }, [storageKey]);

  return {
    restoredData,
    hasRestoredData: restoredData !== null,
    saveFormData,
    clearFormData,
    isExpired,
  };
}

/**
 * Utility to create a debounced save function for auto-saving
 */
export function createDebouncedSave(saveFn: (data: Partial<BookingFormData>) => void, delay = 500) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (data: Partial<BookingFormData>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      saveFn(data);
      timeoutId = null;
    }, delay);
  };
}
