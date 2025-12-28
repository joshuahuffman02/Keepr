"use client";

import React, { createContext, useContext, useReducer, useCallback, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  PaymentContextState,
  PaymentContextActions,
  PaymentCollectionModalProps,
  PaymentMethodType,
  TenderEntry,
  AppliedDiscount,
  CharityDonation,
  PaymentResult,
  PaymentConfig,
  SavedCard,
  TerminalReader,
  calculateProcessingFee,
} from "./types";
import { apiClient } from "../../../../lib/api-client";

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: PaymentContextState = {
  isOpen: false,
  step: "method_select",

  config: null,
  configLoading: true,

  originalAmountCents: 0,
  discountCents: 0,
  donationCents: 0,
  feeCents: 0,
  totalDueCents: 0,
  paidCents: 0,
  remainingCents: 0,

  selectedMethod: null,

  tenderEntries: [],
  isSplitTender: false,

  appliedDiscounts: [],
  charityDonation: { optedIn: false, amountCents: 0, charityId: null },

  savedCards: [],
  terminalReaders: [],
  walletBalanceCents: 0,

  error: null,
  loading: false,
  processingMethod: null,
};

// ============================================================================
// ACTIONS
// ============================================================================

type PaymentAction =
  | { type: "INIT"; payload: { amountCents: number; isOpen: boolean } }
  | { type: "SET_CONFIG"; payload: PaymentConfig }
  | { type: "SET_CONFIG_LOADING"; payload: boolean }
  | { type: "SELECT_METHOD"; payload: PaymentMethodType | null }
  | { type: "SET_STEP"; payload: PaymentContextState["step"] }
  | { type: "ADD_TENDER"; payload: TenderEntry }
  | { type: "REMOVE_TENDER"; payload: string }
  | { type: "UPDATE_TENDER"; payload: { id: string; updates: Partial<TenderEntry> } }
  | { type: "CLEAR_TENDER" }
  | { type: "SET_SPLIT_TENDER"; payload: boolean }
  | { type: "ADD_DISCOUNT"; payload: AppliedDiscount }
  | { type: "REMOVE_DISCOUNT"; payload: string }
  | { type: "SET_CHARITY"; payload: CharityDonation }
  | { type: "SET_SAVED_CARDS"; payload: SavedCard[] }
  | { type: "SET_TERMINAL_READERS"; payload: TerminalReader[] }
  | { type: "SET_WALLET_BALANCE"; payload: number }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_PROCESSING_METHOD"; payload: PaymentMethodType | null }
  | { type: "RESET" };

// ============================================================================
// REDUCER
// ============================================================================

function paymentReducer(state: PaymentContextState, action: PaymentAction): PaymentContextState {
  switch (action.type) {
    case "INIT": {
      return {
        ...initialState,
        isOpen: action.payload.isOpen,
        originalAmountCents: action.payload.amountCents,
        totalDueCents: action.payload.amountCents,
        remainingCents: action.payload.amountCents,
      };
    }

    case "SET_CONFIG":
      return { ...state, config: action.payload, configLoading: false };

    case "SET_CONFIG_LOADING":
      return { ...state, configLoading: action.payload };

    case "SELECT_METHOD":
      return { ...state, selectedMethod: action.payload, step: action.payload ? "payment_entry" : "method_select" };

    case "SET_STEP":
      return { ...state, step: action.payload };

    case "ADD_TENDER": {
      const newTenders = [...state.tenderEntries, action.payload];
      const paidCents = newTenders
        .filter((t) => t.status === "completed")
        .reduce((sum, t) => sum + t.amountCents, 0);
      return {
        ...state,
        tenderEntries: newTenders,
        paidCents,
        remainingCents: state.totalDueCents - paidCents,
      };
    }

    case "REMOVE_TENDER": {
      const newTenders = state.tenderEntries.filter((t) => t.id !== action.payload);
      const paidCents = newTenders
        .filter((t) => t.status === "completed")
        .reduce((sum, t) => sum + t.amountCents, 0);
      return {
        ...state,
        tenderEntries: newTenders,
        paidCents,
        remainingCents: state.totalDueCents - paidCents,
      };
    }

    case "UPDATE_TENDER": {
      const newTenders = state.tenderEntries.map((t) =>
        t.id === action.payload.id ? { ...t, ...action.payload.updates } : t
      );
      const paidCents = newTenders
        .filter((t) => t.status === "completed")
        .reduce((sum, t) => sum + t.amountCents, 0);
      return {
        ...state,
        tenderEntries: newTenders,
        paidCents,
        remainingCents: state.totalDueCents - paidCents,
      };
    }

    case "CLEAR_TENDER":
      return {
        ...state,
        tenderEntries: [],
        paidCents: 0,
        remainingCents: state.totalDueCents,
      };

    case "SET_SPLIT_TENDER":
      return { ...state, isSplitTender: action.payload };

    case "ADD_DISCOUNT": {
      const newDiscounts = [...state.appliedDiscounts, action.payload];
      const discountCents = newDiscounts.reduce((sum, d) => sum + d.discountCents, 0);
      const totalDueCents = state.originalAmountCents - discountCents + state.donationCents + state.feeCents;
      return {
        ...state,
        appliedDiscounts: newDiscounts,
        discountCents,
        totalDueCents,
        remainingCents: totalDueCents - state.paidCents,
      };
    }

    case "REMOVE_DISCOUNT": {
      const newDiscounts = state.appliedDiscounts.filter((d) => d.promoCodeId !== action.payload);
      const discountCents = newDiscounts.reduce((sum, d) => sum + d.discountCents, 0);
      const totalDueCents = state.originalAmountCents - discountCents + state.donationCents + state.feeCents;
      return {
        ...state,
        appliedDiscounts: newDiscounts,
        discountCents,
        totalDueCents,
        remainingCents: totalDueCents - state.paidCents,
      };
    }

    case "SET_CHARITY": {
      const donationCents = action.payload.optedIn ? action.payload.amountCents : 0;
      const totalDueCents = state.originalAmountCents - state.discountCents + donationCents + state.feeCents;
      return {
        ...state,
        charityDonation: action.payload,
        donationCents,
        totalDueCents,
        remainingCents: totalDueCents - state.paidCents,
      };
    }

    case "SET_SAVED_CARDS":
      return { ...state, savedCards: action.payload };

    case "SET_TERMINAL_READERS":
      return { ...state, terminalReaders: action.payload };

    case "SET_WALLET_BALANCE":
      return { ...state, walletBalanceCents: action.payload };

    case "SET_ERROR":
      return { ...state, error: action.payload };

    case "SET_LOADING":
      return { ...state, loading: action.payload };

    case "SET_PROCESSING_METHOD":
      return { ...state, processingMethod: action.payload };

    case "RESET":
      return initialState;

    default:
      return state;
  }
}

// ============================================================================
// CONTEXT
// ============================================================================

interface PaymentContextValue {
  state: PaymentContextState;
  actions: PaymentContextActions;
  props: PaymentCollectionModalProps;
}

const PaymentContext = createContext<PaymentContextValue | null>(null);

// ============================================================================
// PROVIDER
// ============================================================================

interface PaymentProviderProps {
  children: React.ReactNode;
  modalProps: PaymentCollectionModalProps;
}

export function PaymentProvider({ children, modalProps }: PaymentProviderProps) {
  const [state, dispatch] = useReducer(paymentReducer, initialState);

  // Initialize state when modal opens
  useEffect(() => {
    if (modalProps.isOpen) {
      dispatch({
        type: "INIT",
        payload: {
          amountCents: modalProps.amountDueCents,
          isOpen: true,
        },
      });
    }
  }, [modalProps.isOpen, modalProps.amountDueCents]);

  // Fetch payment configuration
  useEffect(() => {
    if (!modalProps.isOpen || !modalProps.campgroundId) return;

    dispatch({ type: "SET_CONFIG_LOADING", payload: true });

    // Fetch campground payment config
    apiClient
      .getCampground(modalProps.campgroundId)
      .then((campground: any) => {
        const config: PaymentConfig = {
          stripeCapabilities: campground.stripeCapabilities || {},
          enableApplePay: campground.enableApplePay ?? true,
          enableGooglePay: campground.enableGooglePay ?? true,
          enableACH: campground.enableACH ?? true,
          enableCardPayments: campground.enableCardPayments ?? true,
          enableCash: campground.enableCash ?? true,
          enableCheck: campground.enableCheck ?? true,
          enableFolio: campground.enableFolio ?? true,
          enableGiftCards: campground.enableGiftCards ?? true,
          enableExternalPOS: campground.enableExternalPOS ?? false,
          allowedCardBrands: campground.allowedCardBrands || ["visa", "mastercard", "amex", "discover"],
          feeMode: campground.feeMode || "absorb",
          feePercentBasisPoints: campground.feePercentBasisPoints ?? 290,
          feeFlatCents: campground.feeFlatCents ?? 30,
          showFeeBreakdown: campground.showFeeBreakdown ?? false,
        };
        dispatch({ type: "SET_CONFIG", payload: config });
      })
      .catch((err) => {
        console.error("Failed to load payment config:", err);
        dispatch({ type: "SET_CONFIG_LOADING", payload: false });
        dispatch({ type: "SET_ERROR", payload: "Failed to load payment configuration" });
      });
  }, [modalProps.isOpen, modalProps.campgroundId]);

  // Fetch terminal readers
  useEffect(() => {
    if (!modalProps.isOpen || !modalProps.campgroundId) return;

    apiClient
      .getTerminalReaders(modalProps.campgroundId)
      .then((readers: any[]) => {
        dispatch({ type: "SET_TERMINAL_READERS", payload: readers });
      })
      .catch(() => dispatch({ type: "SET_TERMINAL_READERS", payload: [] }));
  }, [modalProps.isOpen, modalProps.campgroundId]);

  // Fetch saved cards if guest is provided
  useEffect(() => {
    if (!modalProps.isOpen || !modalProps.campgroundId || !modalProps.guestId) return;

    apiClient
      .getChargeablePaymentMethods(modalProps.campgroundId, modalProps.guestId)
      .then((cards: any[]) => {
        dispatch({ type: "SET_SAVED_CARDS", payload: cards });
      })
      .catch(() => dispatch({ type: "SET_SAVED_CARDS", payload: [] }));
  }, [modalProps.isOpen, modalProps.campgroundId, modalProps.guestId]);

  // Fetch wallet balance if guest is provided
  useEffect(() => {
    if (!modalProps.isOpen || !modalProps.campgroundId || !modalProps.guestId) return;

    apiClient
      .getGuestWallet(modalProps.campgroundId, modalProps.guestId)
      .then((data: any) => {
        dispatch({ type: "SET_WALLET_BALANCE", payload: data.balanceCents || 0 });
      })
      .catch(() => dispatch({ type: "SET_WALLET_BALANCE", payload: 0 }));
  }, [modalProps.isOpen, modalProps.campgroundId, modalProps.guestId]);

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const selectMethod = useCallback((method: PaymentMethodType | null) => {
    dispatch({ type: "SELECT_METHOD", payload: method });
  }, []);

  const addTenderEntry = useCallback((entry: Omit<TenderEntry, "id" | "status">) => {
    const newEntry: TenderEntry = {
      ...entry,
      id: uuidv4(),
      status: "pending",
    };
    dispatch({ type: "ADD_TENDER", payload: newEntry });
  }, []);

  const removeTenderEntry = useCallback((id: string) => {
    dispatch({ type: "REMOVE_TENDER", payload: id });
  }, []);

  const clearTenderEntries = useCallback(() => {
    dispatch({ type: "CLEAR_TENDER" });
  }, []);

  const applyPromoCode = useCallback(
    async (code: string): Promise<AppliedDiscount | null> => {
      try {
        dispatch({ type: "SET_LOADING", payload: true });

        const result = await apiClient.validatePromoCode(
          modalProps.campgroundId,
          code,
          state.originalAmountCents
        );

        if (!result.valid) {
          dispatch({ type: "SET_ERROR", payload: "Invalid promo code" });
          return null;
        }

        const discount: AppliedDiscount = {
          promoCodeId: result.promotionId,
          code: code.toUpperCase(),
          type: "fixed_amount", // API returns discountCents directly
          discountCents: result.discountCents,
          description: `Promo code ${code.toUpperCase()}`,
        };

        dispatch({ type: "ADD_DISCOUNT", payload: discount });
        dispatch({ type: "SET_ERROR", payload: null });
        return discount;
      } catch (err: any) {
        dispatch({ type: "SET_ERROR", payload: err.message || "Failed to apply promo code" });
        return null;
      } finally {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    },
    [modalProps.campgroundId, modalProps.subject, state.originalAmountCents]
  );

  const removeDiscount = useCallback((discountId: string) => {
    dispatch({ type: "REMOVE_DISCOUNT", payload: discountId });
  }, []);

  const setCharityDonation = useCallback((donation: Partial<CharityDonation>) => {
    dispatch({
      type: "SET_CHARITY",
      payload: { ...state.charityDonation, ...donation },
    });
  }, [state.charityDonation]);

  const calculateFees = useCallback(
    (method: PaymentMethodType, amountCents: number): number => {
      if (!state.config) return 0;
      return calculateProcessingFee(state.config, method, amountCents);
    },
    [state.config]
  );

  const processPayment = useCallback(async (): Promise<PaymentResult> => {
    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "SET_STEP", payload: "processing" });
    dispatch({ type: "SET_ERROR", payload: null });

    try {
      // This will be implemented in individual payment method components
      // For now, return a placeholder
      throw new Error("Payment processing not implemented");
    } catch (err: any) {
      dispatch({ type: "SET_ERROR", payload: err.message });
      dispatch({ type: "SET_STEP", payload: "error" });
      throw err;
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, []);

  const cancelPayment = useCallback(() => {
    dispatch({ type: "SELECT_METHOD", payload: null });
    dispatch({ type: "SET_STEP", payload: "method_select" });
    dispatch({ type: "SET_ERROR", payload: null });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  const actions: PaymentContextActions = {
    selectMethod,
    addTenderEntry,
    removeTenderEntry,
    clearTenderEntries,
    applyPromoCode,
    removeDiscount,
    setCharityDonation,
    processPayment,
    cancelPayment,
    calculateFees,
    reset,
  };

  return (
    <PaymentContext.Provider value={{ state, actions, props: modalProps }}>
      {children}
    </PaymentContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function usePaymentContext(): PaymentContextValue {
  const context = useContext(PaymentContext);
  if (!context) {
    throw new Error("usePaymentContext must be used within a PaymentProvider");
  }
  return context;
}
