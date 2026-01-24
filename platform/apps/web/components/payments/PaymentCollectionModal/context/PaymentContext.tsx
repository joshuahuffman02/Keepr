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
  CardBrand,
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

type StripeCapability = "active" | "inactive" | "pending";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getBoolean = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;

const getNumber = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const getStringArray = (value: unknown): string[] | undefined =>
  Array.isArray(value) && value.every((item) => typeof item === "string") ? value : undefined;

const isStripeCapability = (value: unknown): value is StripeCapability =>
  value === "active" || value === "inactive" || value === "pending";

const isCardBrand = (value: string): value is CardBrand =>
  value === "visa" ||
  value === "mastercard" ||
  value === "amex" ||
  value === "discover" ||
  value === "diners" ||
  value === "jcb" ||
  value === "unionpay";

const toFeeMode = (value: unknown): PaymentConfig["feeMode"] =>
  value === "absorb" || value === "pass_through" ? value : "absorb";

const toPlatformFeeMode = (value: unknown): PaymentConfig["platformFeeMode"] =>
  value === "absorb" || value === "pass_through" ? value : "pass_through";

const toBillingPlan = (value: unknown): PaymentConfig["billingPlan"] =>
  value === "standard" || value === "enterprise" || value === "ota_only" ? value : "ota_only";

const toTerminalStatus = (value: unknown): TerminalReader["status"] =>
  value === "online" || value === "offline" || value === "busy" ? value : "offline";

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
      return {
        ...state,
        selectedMethod: action.payload,
        step: action.payload ? "payment_entry" : "method_select",
      };

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
        t.id === action.payload.id ? { ...t, ...action.payload.updates } : t,
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
      const totalDueCents =
        state.originalAmountCents - discountCents + state.donationCents + state.feeCents;
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
      const totalDueCents =
        state.originalAmountCents - discountCents + state.donationCents + state.feeCents;
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
      const totalDueCents =
        state.originalAmountCents - state.discountCents + donationCents + state.feeCents;
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
      .then((campground) => {
        const billingPlan = toBillingPlan(campground.billingPlan);
        const defaultPlatformFee =
          billingPlan === "enterprise" ? 100 : billingPlan === "standard" ? 200 : 300;
        const stripeCapabilitiesRaw = isRecord(campground.stripeCapabilities)
          ? campground.stripeCapabilities
          : undefined;
        const allowedBrands = getStringArray(campground.allowedCardBrands)
          ?.filter(isCardBrand)
          .filter((brand, idx, arr) => arr.indexOf(brand) === idx);

        const config: PaymentConfig = {
          stripeCapabilities: {
            card_payments: isStripeCapability(stripeCapabilitiesRaw?.card_payments)
              ? stripeCapabilitiesRaw.card_payments
              : undefined,
            us_bank_account_ach_payments: isStripeCapability(
              stripeCapabilitiesRaw?.us_bank_account_ach_payments,
            )
              ? stripeCapabilitiesRaw.us_bank_account_ach_payments
              : undefined,
            apple_pay: isStripeCapability(stripeCapabilitiesRaw?.apple_pay)
              ? stripeCapabilitiesRaw.apple_pay
              : undefined,
            google_pay: isStripeCapability(stripeCapabilitiesRaw?.google_pay)
              ? stripeCapabilitiesRaw.google_pay
              : undefined,
            link_payments: isStripeCapability(stripeCapabilitiesRaw?.link_payments)
              ? stripeCapabilitiesRaw.link_payments
              : undefined,
          },
          enableApplePay: getBoolean(campground.enableApplePay, true),
          enableGooglePay: getBoolean(campground.enableGooglePay, true),
          enableACH: getBoolean(campground.enableACH, true),
          enableCardPayments: getBoolean(campground.enableCardPayments, true),
          enableCash: getBoolean(campground.enableCash, true),
          enableCheck: getBoolean(campground.enableCheck, true),
          enableFolio: getBoolean(campground.enableFolio, true),
          enableGiftCards: getBoolean(campground.enableGiftCards, true),
          enableExternalPOS: getBoolean(campground.enableExternalPOS, false),
          allowedCardBrands: allowedBrands?.length
            ? allowedBrands
            : ["visa", "mastercard", "amex", "discover"],
          feeMode: toFeeMode(campground.feeMode),
          feePercentBasisPoints: getNumber(campground.feePercentBasisPoints, 290),
          feeFlatCents: getNumber(campground.feeFlatCents, 30),
          showFeeBreakdown: getBoolean(campground.showFeeBreakdown, false),
          billingPlan,
          perBookingFeeCents: getNumber(campground.perBookingFeeCents, defaultPlatformFee),
          platformFeeMode: toPlatformFeeMode(campground.platformFeeMode),
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
      .then((readers) => {
        const mappedReaders: TerminalReader[] = readers.map((reader) => ({
          id: reader.id,
          label: reader.label,
          status: toTerminalStatus(reader.status),
          stripeReaderId: reader.stripeReaderId,
          locationId: reader.locationId ?? undefined,
        }));
        dispatch({ type: "SET_TERMINAL_READERS", payload: mappedReaders });
      })
      .catch(() => dispatch({ type: "SET_TERMINAL_READERS", payload: [] }));
  }, [modalProps.isOpen, modalProps.campgroundId]);

  // Fetch saved cards if guest is provided
  useEffect(() => {
    if (!modalProps.isOpen || !modalProps.campgroundId || !modalProps.guestId) return;

    apiClient
      .getChargeablePaymentMethods(modalProps.campgroundId, modalProps.guestId)
      .then((cards) => {
        const mappedCards: SavedCard[] = cards.map((card) => ({
          id: card.id,
          last4: card.last4,
          brand: card.brand,
          expMonth: null,
          expYear: null,
          isDefault: card.isDefault,
          nickname: card.nickname,
        }));
        dispatch({ type: "SET_SAVED_CARDS", payload: mappedCards });
      })
      .catch(() => dispatch({ type: "SET_SAVED_CARDS", payload: [] }));
  }, [modalProps.isOpen, modalProps.campgroundId, modalProps.guestId]);

  // Fetch wallet balance if guest is provided
  useEffect(() => {
    if (!modalProps.isOpen || !modalProps.campgroundId || !modalProps.guestId) return;

    apiClient
      .getGuestWallet(modalProps.campgroundId, modalProps.guestId)
      .then((data) => {
        dispatch({ type: "SET_WALLET_BALANCE", payload: data.balanceCents || 0 });
      })
      .catch(() => dispatch({ type: "SET_WALLET_BALANCE", payload: 0 }));
  }, [modalProps.isOpen, modalProps.campgroundId, modalProps.guestId]);

  // Recalculate charity round-up when payment method changes
  // This ensures the round-up amount is correct whether paying by card (includes CC fee) or cash (no CC fee)
  useEffect(() => {
    if (!state.charityDonation.optedIn || !state.config) return;

    const CARD_METHODS = ["card", "saved_card", "apple_pay", "google_pay", "terminal"];
    const baseTotal = state.originalAmountCents - state.discountCents;

    // Calculate CC fee if card method is selected
    let totalForRounding = baseTotal;
    if (
      state.selectedMethod &&
      CARD_METHODS.includes(state.selectedMethod) &&
      state.config.feeMode === "pass_through"
    ) {
      const ccFeeCents = calculateProcessingFee(state.config, state.selectedMethod, baseTotal);
      totalForRounding += ccFeeCents;
    }

    // Calculate new round-up amount
    const dollars = totalForRounding / 100;
    const roundedUp = Math.ceil(dollars);
    const roundUpCents = Math.round((roundedUp - dollars) * 100);
    const newRoundUpAmount = roundUpCents === 0 ? 100 : roundUpCents;

    // Only update if the amount changed
    if (newRoundUpAmount !== state.charityDonation.amountCents) {
      dispatch({
        type: "SET_CHARITY",
        payload: {
          ...state.charityDonation,
          amountCents: newRoundUpAmount,
        },
      });
    }
  }, [
    state.selectedMethod,
    state.config,
    state.originalAmountCents,
    state.discountCents,
    state.charityDonation.optedIn,
  ]);

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const selectMethod = useCallback((method: PaymentMethodType | null) => {
    dispatch({ type: "SELECT_METHOD", payload: method });
  }, []);

  const addTenderEntry = useCallback(
    (entry: Omit<TenderEntry, "id" | "status"> & { status?: TenderEntry["status"] }) => {
      const newEntry: TenderEntry = {
        ...entry,
        id: uuidv4(),
        status: entry.status ?? "completed", // Default to completed for manual payments
      };
      dispatch({ type: "ADD_TENDER", payload: newEntry });
    },
    [],
  );

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
          state.originalAmountCents,
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
      } catch (err) {
        dispatch({
          type: "SET_ERROR",
          payload: err instanceof Error ? err.message : "Failed to apply promo code",
        });
        return null;
      } finally {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    },
    [modalProps.campgroundId, modalProps.subject, state.originalAmountCents],
  );

  const removeDiscount = useCallback((discountId: string) => {
    dispatch({ type: "REMOVE_DISCOUNT", payload: discountId });
  }, []);

  const setCharityDonation = useCallback(
    (donation: Partial<CharityDonation>) => {
      dispatch({
        type: "SET_CHARITY",
        payload: { ...state.charityDonation, ...donation },
      });
    },
    [state.charityDonation],
  );

  const calculateFees = useCallback(
    (method: PaymentMethodType, amountCents: number): number => {
      if (!state.config) return 0;
      return calculateProcessingFee(state.config, method, amountCents);
    },
    [state.config],
  );

  const processPayment = useCallback(async (): Promise<PaymentResult> => {
    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "SET_STEP", payload: "processing" });
    dispatch({ type: "SET_ERROR", payload: null });

    try {
      // This will be implemented in individual payment method components
      // For now, return a placeholder
      throw new Error("Payment processing not implemented");
    } catch (err) {
      dispatch({
        type: "SET_ERROR",
        payload: err instanceof Error ? err.message : "Payment failed",
      });
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

  const setStep = useCallback((step: PaymentContextState["step"]) => {
    dispatch({ type: "SET_STEP", payload: step });
  }, []);

  const completePayment = useCallback(() => {
    // Transition to success view - the actual onSuccess callback is called from SuccessView
    dispatch({ type: "SET_STEP", payload: "success" });
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
    setStep,
    completePayment,
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
