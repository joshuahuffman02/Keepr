/**
 * PaymentCollectionModal - Unified payment component
 *
 * Supports 15 payment methods across 7 contexts:
 *
 * Payment Methods:
 * - Card (Stripe Elements)
 * - Saved Card (card on file)
 * - Terminal (Stripe reader)
 * - Apple Pay
 * - Google Pay
 * - Link (Stripe 1-click)
 * - ACH (bank transfer)
 * - Cash
 * - Check
 * - Guest Wallet (stored credit)
 * - Folio (charge to site)
 * - Gift Card
 * - Deposit/Hold
 * - External POS
 * - Promo Codes
 *
 * Payment Contexts:
 * - public_booking: Guest booking online
 * - portal: Guest portal
 * - kiosk: Self-service
 * - staff_checkin: Staff check-in desk
 * - staff_booking: Staff creating booking
 * - pos: Point of sale
 * - seasonal: Seasonal payments
 *
 * @example
 * ```tsx
 * <PaymentCollectionModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   campgroundId="camp_123"
 *   amountDueCents={12750}
 *   subject={{ type: "reservation", reservationId: "res_456" }}
 *   context="staff_checkin"
 *   guestId="guest_789"
 *   onSuccess={(result) => console.log("Paid!", result)}
 * />
 * ```
 */

export { PaymentCollectionModal } from "./PaymentCollectionModal";
export { PaymentProvider, usePaymentContext } from "./context/PaymentContext";
export { usePaymentMethods } from "./hooks/usePaymentMethods";
export { MethodSelector } from "./components/MethodSelector";
export { PaymentSummary, PaymentSummaryInline } from "./components/PaymentSummary";
export { SplitTenderManager, SplitTenderSummary } from "./components/SplitTenderManager";
export { SuccessView, SuccessIndicator } from "./components/SuccessView";
export { PromoCodeInput } from "./components/PromoCodeInput";
export { CharityRoundUp, CharityRoundUpInline } from "./components/CharityRoundUp";
export { FeeBreakdown, FeeBreakdownInline, FeeEstimate } from "./components/FeeBreakdown";

// Re-export types
export type {
  PaymentCollectionModalProps,
  PaymentMethodType,
  PaymentContext,
  PaymentSubject,
  PaymentResult,
  PaymentError,
  PaymentConfig,
  TenderEntry,
  AppliedDiscount,
  CharityDonation,
  SavedCard,
  TerminalReader,
  GiftCard,
  AuthHold,
  CardBrand,
} from "./context/types";

export {
  PAYMENT_METHOD_INFO,
  getAvailablePaymentMethods,
  calculateProcessingFee,
} from "./context/types";
