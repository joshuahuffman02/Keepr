/**
 * PaymentCollectionModal - Unified payment component types
 * Supports 15 payment methods across 7 contexts
 */

// ============================================================================
// PAYMENT METHODS
// ============================================================================

export type PaymentMethodType =
  // Card payments
  | "card"           // New card via Stripe Elements
  | "saved_card"     // Charge card on file
  | "terminal"       // Stripe Terminal (card present)
  // Digital wallets
  | "apple_pay"      // Apple Pay via PaymentRequest API
  | "google_pay"     // Google Pay via PaymentRequest API
  | "link"           // Stripe Link 1-click
  // Bank
  | "ach"            // US bank transfer
  // Manual
  | "cash"           // Cash payment
  | "check"          // Check payment
  // Account-based
  | "guest_wallet"   // Guest stored credit
  | "folio"          // Charge to site/room
  | "gift_card"      // Campground-issued gift card
  // Special
  | "deposit_hold"   // Auth hold without capture
  | "external_pos";  // Square, Clover, etc.

export type CardBrand =
  | "visa"
  | "mastercard"
  | "amex"
  | "discover"
  | "diners"
  | "jcb"
  | "unionpay";

// ============================================================================
// PAYMENT CONTEXTS
// ============================================================================

export type PaymentContext =
  | "public_booking"  // Guest booking online (web/mobile)
  | "portal"          // Guest portal purchases
  | "kiosk"           // Self-service kiosk
  | "staff_checkin"   // Staff check-in desk
  | "staff_booking"   // Staff creating booking for guest
  | "pos"             // Point of sale / store
  | "seasonal";       // Seasonal contract payments

// ============================================================================
// PAYMENT SUBJECT - What we're paying for
// ============================================================================

export type PaymentSubject =
  | { type: "reservation"; reservationId: string }
  | { type: "cart"; items: CartItem[] }
  | { type: "balance"; reservationId: string }
  | { type: "seasonal"; contractId: string }
  | { type: "custom"; description: string };

export interface CartItem {
  id: string;
  name: string;
  qty: number;
  priceCents: number;
  effectivePriceCents?: number; // Location-specific pricing
}

// ============================================================================
// CAMPGROUND PAYMENT CONFIGURATION
// ============================================================================

export interface PaymentConfig {
  // Stripe capabilities (from connected account)
  stripeCapabilities: {
    card_payments?: "active" | "inactive" | "pending";
    us_bank_account_ach_payments?: "active" | "inactive" | "pending";
    apple_pay?: "active" | "inactive" | "pending";
    google_pay?: "active" | "inactive" | "pending";
    link_payments?: "active" | "inactive" | "pending";
  };

  // Payment method toggles (campground preferences)
  enableApplePay: boolean;
  enableGooglePay: boolean;
  enableACH: boolean;
  enableCardPayments: boolean;
  enableCash: boolean;
  enableCheck: boolean;
  enableFolio: boolean;
  enableGiftCards: boolean;
  enableExternalPOS: boolean;

  // Card brand restrictions
  allowedCardBrands: CardBrand[];

  // Fee handling
  feeMode: "absorb" | "pass_through";
  feePercentBasisPoints: number; // e.g., 290 = 2.9%
  feeFlatCents: number;          // e.g., 30 = $0.30
  showFeeBreakdown: boolean;
}

// ============================================================================
// TERMINAL & SAVED CARDS
// ============================================================================

export interface TerminalReader {
  id: string;
  label: string;
  status: "online" | "offline" | "busy";
  stripeReaderId: string;
  locationId?: string;
}

export interface SavedCard {
  id: string;
  last4: string | null;
  brand: CardBrand | string | null;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
  nickname: string | null;
}

// ============================================================================
// GIFT CARDS
// ============================================================================

export interface GiftCard {
  id: string;
  code: string;
  balanceCents: number;
  originalAmountCents: number;
  expiresAt?: string | null;
  isActive: boolean;
}

// ============================================================================
// PROMO CODES & DISCOUNTS
// ============================================================================

export interface PromoCode {
  id: string;
  code: string;
  discountType: "percentage" | "fixed_amount";
  discountValue: number; // percentage (0-100) or cents
  minimumAmountCents?: number;
  expiresAt?: string | null;
  usageLimit?: number;
  usageCount: number;
}

export interface AppliedDiscount {
  promoCodeId?: string;
  code?: string;
  type: "percentage" | "fixed_amount" | "gift_card" | "wallet";
  discountCents: number;
  description: string;
}

// ============================================================================
// CHARITY DONATION
// ============================================================================

export interface CharityDonation {
  optedIn: boolean;
  amountCents: number;
  charityId: string | null;
  charityName?: string;
}

// ============================================================================
// SPLIT TENDER - Multiple payment methods
// ============================================================================

export interface TenderEntry {
  id: string; // Unique ID for this tender line
  method: PaymentMethodType;
  amountCents: number;
  status: "pending" | "processing" | "completed" | "failed";
  reference?: string; // Payment ID, check number, etc.
  metadata?: Record<string, any>;
}

// ============================================================================
// PAYMENT RESULT
// ============================================================================

export interface PaymentResult {
  success: boolean;
  totalPaidCents: number;
  payments: Array<{
    method: PaymentMethodType;
    amountCents: number;
    paymentId?: string;
    reference?: string;
  }>;
  appliedDiscounts: AppliedDiscount[];
  charityDonation?: CharityDonation;
  receiptId?: string;
  metadata?: Record<string, any>;
}

export interface PaymentError {
  code: string;
  message: string;
  method?: PaymentMethodType;
  recoverable: boolean;
}

// ============================================================================
// DEPOSIT / AUTH HOLD
// ============================================================================

export interface AuthHold {
  id: string;
  paymentIntentId: string;
  amountCents: number;
  capturedCents: number;
  status: "pending" | "captured" | "released" | "expired";
  expiresAt: string;
  reason?: string;
}

// ============================================================================
// MODAL PROPS
// ============================================================================

export interface PaymentCollectionModalProps {
  // Required
  isOpen: boolean;
  onClose: () => void;
  campgroundId: string;
  amountDueCents: number;

  // What we're paying for
  subject: PaymentSubject;

  // Context determines available methods
  context: PaymentContext;

  // Guest info (enables saved cards, wallet, folio)
  guestId?: string;
  guestEmail?: string;
  guestName?: string;

  // Features
  enableSplitTender?: boolean;      // Default: true for staff contexts
  enablePromoCode?: boolean;        // Default: true
  enableCharityRoundUp?: boolean;   // Default: true
  enablePartialPayment?: boolean;   // Default: false
  enableSaveCard?: boolean;         // Default: true
  enableDepositHold?: boolean;      // Default: false

  // Terminal
  terminalLocationId?: string;

  // Pre-filled data
  defaultPaymentMethod?: PaymentMethodType;
  preAppliedPromoCode?: string;

  // Callbacks
  onSuccess: (result: PaymentResult) => void;
  onError?: (error: PaymentError) => void;
  onPartialPayment?: (paidCents: number, remainingCents: number) => void;
}

// ============================================================================
// CONTEXT STATE
// ============================================================================

export interface PaymentContextState {
  // Modal state
  isOpen: boolean;
  step: "method_select" | "payment_entry" | "processing" | "success" | "error";

  // Configuration
  config: PaymentConfig | null;
  configLoading: boolean;

  // Amount tracking
  originalAmountCents: number;
  discountCents: number;
  donationCents: number;
  feeCents: number;
  totalDueCents: number;
  paidCents: number;
  remainingCents: number;

  // Selected payment method
  selectedMethod: PaymentMethodType | null;

  // Split tender
  tenderEntries: TenderEntry[];
  isSplitTender: boolean;

  // Discounts & donations
  appliedDiscounts: AppliedDiscount[];
  charityDonation: CharityDonation;

  // Payment resources
  savedCards: SavedCard[];
  terminalReaders: TerminalReader[];
  walletBalanceCents: number;

  // UI state
  error: string | null;
  loading: boolean;
  processingMethod: PaymentMethodType | null;
}

export interface PaymentContextActions {
  // Method selection
  selectMethod: (method: PaymentMethodType | null) => void;

  // Split tender
  addTenderEntry: (entry: Omit<TenderEntry, "id" | "status">) => void;
  removeTenderEntry: (id: string) => void;
  clearTenderEntries: () => void;

  // Discounts
  applyPromoCode: (code: string) => Promise<AppliedDiscount | null>;
  removeDiscount: (discountId: string) => void;

  // Charity
  setCharityDonation: (donation: Partial<CharityDonation>) => void;

  // Payment execution
  processPayment: () => Promise<PaymentResult>;
  cancelPayment: () => void;

  // Fee calculation
  calculateFees: (method: PaymentMethodType, amountCents: number) => number;

  // Reset
  reset: () => void;
}

// ============================================================================
// PAYMENT METHOD METADATA
// ============================================================================

export interface PaymentMethodInfo {
  type: PaymentMethodType;
  label: string;
  icon: string; // Icon name or component key
  description?: string;
  requiresGuest: boolean;
  requiresOnline: boolean;
  supportsPartial: boolean;
  supportsSplitTender: boolean;
  contexts: PaymentContext[];
}

export const PAYMENT_METHOD_INFO: Record<PaymentMethodType, PaymentMethodInfo> = {
  card: {
    type: "card",
    label: "Card",
    icon: "credit-card",
    description: "Pay with credit or debit card",
    requiresGuest: false,
    requiresOnline: true,
    supportsPartial: true,
    supportsSplitTender: true,
    contexts: ["public_booking", "portal", "kiosk", "staff_checkin", "staff_booking", "pos", "seasonal"],
  },
  saved_card: {
    type: "saved_card",
    label: "Card on File",
    icon: "wallet",
    description: "Use a saved payment method",
    requiresGuest: true,
    requiresOnline: true,
    supportsPartial: true,
    supportsSplitTender: true,
    contexts: ["public_booking", "portal", "staff_checkin", "staff_booking", "pos", "seasonal"],
  },
  terminal: {
    type: "terminal",
    label: "Card Reader",
    icon: "smartphone-nfc",
    description: "Tap or insert card on terminal",
    requiresGuest: false,
    requiresOnline: true,
    supportsPartial: true,
    supportsSplitTender: true,
    contexts: ["kiosk", "staff_checkin", "staff_booking", "pos"],
  },
  apple_pay: {
    type: "apple_pay",
    label: "Apple Pay",
    icon: "apple",
    description: "Pay with Apple Pay",
    requiresGuest: false,
    requiresOnline: true,
    supportsPartial: false,
    supportsSplitTender: false,
    contexts: ["public_booking", "portal", "kiosk"],
  },
  google_pay: {
    type: "google_pay",
    label: "Google Pay",
    icon: "smartphone",
    description: "Pay with Google Pay",
    requiresGuest: false,
    requiresOnline: true,
    supportsPartial: false,
    supportsSplitTender: false,
    contexts: ["public_booking", "portal", "kiosk"],
  },
  link: {
    type: "link",
    label: "Link",
    icon: "zap",
    description: "Stripe 1-click checkout",
    requiresGuest: false,
    requiresOnline: true,
    supportsPartial: false,
    supportsSplitTender: false,
    contexts: ["public_booking", "portal"],
  },
  ach: {
    type: "ach",
    label: "Bank Transfer",
    icon: "landmark",
    description: "Pay with US bank account",
    requiresGuest: false,
    requiresOnline: true,
    supportsPartial: false,
    supportsSplitTender: false,
    contexts: ["public_booking", "portal", "staff_checkin", "staff_booking", "seasonal"],
  },
  cash: {
    type: "cash",
    label: "Cash",
    icon: "banknote",
    description: "Pay with cash",
    requiresGuest: false,
    requiresOnline: false,
    supportsPartial: true,
    supportsSplitTender: true,
    contexts: ["kiosk", "staff_checkin", "staff_booking", "pos"],
  },
  check: {
    type: "check",
    label: "Check",
    icon: "file-text",
    description: "Pay with check",
    requiresGuest: false,
    requiresOnline: false,
    supportsPartial: true,
    supportsSplitTender: true,
    contexts: ["staff_checkin", "staff_booking", "pos", "seasonal"],
  },
  guest_wallet: {
    type: "guest_wallet",
    label: "Wallet Credit",
    icon: "wallet-2",
    description: "Use account balance",
    requiresGuest: true,
    requiresOnline: true,
    supportsPartial: true,
    supportsSplitTender: true,
    contexts: ["portal", "staff_checkin", "staff_booking", "pos"],
  },
  folio: {
    type: "folio",
    label: "Charge to Site",
    icon: "home",
    description: "Add to site folio",
    requiresGuest: false,
    requiresOnline: true,
    supportsPartial: true,
    supportsSplitTender: true,
    contexts: ["portal", "staff_checkin", "staff_booking", "pos"],
  },
  gift_card: {
    type: "gift_card",
    label: "Gift Card",
    icon: "gift",
    description: "Redeem a gift card",
    requiresGuest: false,
    requiresOnline: true,
    supportsPartial: true,
    supportsSplitTender: true,
    contexts: ["public_booking", "portal", "kiosk", "staff_checkin", "staff_booking", "pos"],
  },
  deposit_hold: {
    type: "deposit_hold",
    label: "Deposit Hold",
    icon: "lock",
    description: "Authorization hold only",
    requiresGuest: false,
    requiresOnline: true,
    supportsPartial: false,
    supportsSplitTender: false,
    contexts: ["staff_checkin", "staff_booking"],
  },
  external_pos: {
    type: "external_pos",
    label: "External Terminal",
    icon: "square",
    description: "Square, Clover, etc.",
    requiresGuest: false,
    requiresOnline: false,
    supportsPartial: true,
    supportsSplitTender: true,
    contexts: ["staff_checkin", "staff_booking", "pos"],
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get available payment methods for a given context and configuration
 */
export function getAvailablePaymentMethods(
  context: PaymentContext,
  config: PaymentConfig,
  options: {
    hasGuest: boolean;
    isOnline: boolean;
    hasSavedCards: boolean;
    hasWalletBalance: boolean;
    hasTerminalReaders: boolean;
  }
): PaymentMethodType[] {
  const available: PaymentMethodType[] = [];

  for (const [type, info] of Object.entries(PAYMENT_METHOD_INFO)) {
    const method = type as PaymentMethodType;

    // Check if method is available in this context
    if (!info.contexts.includes(context)) continue;

    // Check guest requirement
    if (info.requiresGuest && !options.hasGuest) continue;

    // Check online requirement
    if (info.requiresOnline && !options.isOnline) continue;

    // Check config toggles
    if (method === "card" && !config.enableCardPayments) continue;
    if (method === "apple_pay" && (!config.enableApplePay || config.stripeCapabilities.apple_pay !== "active")) continue;
    if (method === "google_pay" && (!config.enableGooglePay || config.stripeCapabilities.google_pay !== "active")) continue;
    if (method === "ach" && (!config.enableACH || config.stripeCapabilities.us_bank_account_ach_payments !== "active")) continue;
    if (method === "cash" && !config.enableCash) continue;
    if (method === "check" && !config.enableCheck) continue;
    if (method === "folio" && !config.enableFolio) continue;
    if (method === "gift_card" && !config.enableGiftCards) continue;
    if (method === "external_pos" && !config.enableExternalPOS) continue;

    // Check specific requirements
    if (method === "saved_card" && !options.hasSavedCards) continue;
    if (method === "guest_wallet" && !options.hasWalletBalance) continue;
    if (method === "terminal" && !options.hasTerminalReaders) continue;

    available.push(method);
  }

  return available;
}

/**
 * Calculate processing fee for a payment method
 */
export function calculateProcessingFee(
  config: PaymentConfig,
  method: PaymentMethodType,
  amountCents: number
): number {
  if (config.feeMode === "absorb") return 0;

  // Different fee structures per method could be added here
  const percentFee = Math.round((amountCents * config.feePercentBasisPoints) / 10000);
  const totalFee = percentFee + config.feeFlatCents;

  return totalFee;
}
