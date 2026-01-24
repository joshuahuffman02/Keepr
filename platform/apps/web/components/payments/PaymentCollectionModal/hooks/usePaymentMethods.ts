"use client";

import { useMemo } from "react";
import {
  PaymentMethodType,
  PaymentContext,
  PaymentConfig,
  PAYMENT_METHOD_INFO,
  PaymentMethodInfo,
  getAvailablePaymentMethods,
} from "../context/types";
import { usePaymentContext } from "../context/PaymentContext";

export interface UsePaymentMethodsOptions {
  context: PaymentContext;
  hasGuest: boolean;
  isOnline?: boolean;
}

export interface UsePaymentMethodsResult {
  availableMethods: PaymentMethodType[];
  methodInfo: Record<PaymentMethodType, PaymentMethodInfo>;
  isMethodAvailable: (method: PaymentMethodType) => boolean;
  getMethodInfo: (method: PaymentMethodType) => PaymentMethodInfo;
  loading: boolean;
}

export function usePaymentMethods(): UsePaymentMethodsResult {
  const { state, props } = usePaymentContext();
  const { config, configLoading, savedCards, terminalReaders, walletBalanceCents } = state;

  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  const availableMethods = useMemo(() => {
    if (!config) return [];

    // Folio is disabled when paying for a reservation balance (circular logic)
    const isReservationPayment =
      props.subject?.type === "reservation" || props.subject?.type === "balance";

    return getAvailablePaymentMethods(props.context, config, {
      hasGuest: !!props.guestId,
      isOnline,
      hasSavedCards: savedCards.length > 0,
      hasWalletBalance: walletBalanceCents > 0,
      hasTerminalReaders: terminalReaders.some((r) => r.status === "online"),
      isReservationPayment,
    });
  }, [
    config,
    props.context,
    props.guestId,
    props.subject,
    isOnline,
    savedCards.length,
    walletBalanceCents,
    terminalReaders,
  ]);

  const isMethodAvailable = useMemo(() => {
    return (method: PaymentMethodType) => availableMethods.includes(method);
  }, [availableMethods]);

  const getMethodInfo = useMemo(() => {
    return (method: PaymentMethodType) => PAYMENT_METHOD_INFO[method];
  }, []);

  return {
    availableMethods,
    methodInfo: PAYMENT_METHOD_INFO,
    isMethodAvailable,
    getMethodInfo,
    loading: configLoading,
  };
}

/**
 * Get the priority order for payment methods based on context
 */
export function getMethodPriority(context: PaymentContext): PaymentMethodType[] {
  switch (context) {
    case "public_booking":
      return ["card", "apple_pay", "google_pay", "saved_card", "ach", "gift_card"];
    case "portal":
      return ["saved_card", "card", "apple_pay", "google_pay", "guest_wallet", "folio"];
    case "kiosk":
      return ["terminal", "card", "apple_pay", "google_pay", "cash"];
    case "staff_checkin":
      return ["terminal", "card", "saved_card", "cash", "guest_wallet", "folio", "check"];
    case "staff_booking":
      return ["terminal", "card", "saved_card", "cash", "check", "folio"];
    case "pos":
      return ["terminal", "card", "saved_card", "cash", "guest_wallet", "check", "folio"];
    case "seasonal":
      return ["ach", "card", "saved_card", "check", "cash"];
    default:
      return ["card", "cash"];
  }
}

/**
 * Sort payment methods by priority for the given context
 */
export function sortMethodsByPriority(
  methods: PaymentMethodType[],
  context: PaymentContext,
): PaymentMethodType[] {
  const priority = getMethodPriority(context);

  return [...methods].sort((a, b) => {
    const aIndex = priority.indexOf(a);
    const bIndex = priority.indexOf(b);

    // Methods in priority list come first, in order
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;

    // Methods not in priority list are sorted alphabetically
    return a.localeCompare(b);
  });
}
