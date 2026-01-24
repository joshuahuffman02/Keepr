# PaymentCollectionModal Migration Guide

This guide explains how to migrate from legacy payment modals to the unified `PaymentCollectionModal`.

## Overview

The `PaymentCollectionModal` consolidates 6+ payment implementations into a single, context-aware component supporting:

- **15 payment methods**: Card, Saved Card, Terminal, Apple Pay, Google Pay, Link, ACH, Cash, Check, Guest Wallet, Folio, Gift Card, Deposit Hold, External POS
- **7 payment contexts**: public_booking, portal, kiosk, staff_checkin, staff_booking, pos, seasonal

## Quick Migration

### Before (Legacy)

```tsx
// Old PaymentModal
<PaymentModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  reservationId={reservation.id}
  amountCents={5000}
  onSuccess={() => refetch()}
/>
```

### After (Unified)

```tsx
import { PaymentCollectionModal } from "@/components/payments/PaymentCollectionModal";

<PaymentCollectionModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  campgroundId={campground.id}
  amountDueCents={5000}
  subject={{ type: "reservation", reservationId: reservation.id }}
  context="staff_checkin"
  guestId={guest?.id}
  guestEmail={guest?.email}
  onSuccess={(result) => {
    console.log("Payment complete:", result);
    refetch();
  }}
/>;
```

## Migration by Component

### 1. PaymentModal → PaymentCollectionModal

**Old props:**

```typescript
interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  reservationId: string;
  amountCents: number;
  onSuccess: () => void;
  entryMode?: "manual" | "reader";
  requirePostalCode?: boolean;
  defaultPostalCode?: string;
}
```

**New props mapping:**

```typescript
<PaymentCollectionModal
  isOpen={isOpen}
  onClose={onClose}
  campgroundId={campgroundId}           // NEW: Required
  amountDueCents={amountCents}          // Renamed
  subject={{ type: "reservation", reservationId }}
  context="staff_booking"               // or "staff_checkin"
  guestId={guestId}                     // Optional: enables saved cards
  onSuccess={(result) => onSuccess()}   // Enhanced callback
/>
```

### 2. CheckoutModal (POS) → POSCheckoutFlow

The POS CheckoutModal combines order configuration with payment. We've created a wrapper component that handles this:

```tsx
import { POSCheckoutFlow } from "@/components/pos/POSCheckoutFlow";

<POSCheckoutFlow
  isOpen={isCheckoutOpen}
  onClose={() => setIsCheckoutOpen(false)}
  cart={cart}
  campgroundId={campgroundId}
  locationId={selectedLocationId}
  onSuccess={handleCheckoutSuccess}
  onQueued={() => {
    setIsCheckoutOpen(false);
    setCart([]);
  }}
  isOnline={isOnline}
  queueOrder={queueOrder}
  guestId={guestId}
  guestName={guestName}
  guestEmail={guestEmail}
/>;
```

**POSCheckoutFlow handles:**

- Step 1: Order configuration (fulfillment type, delivery instructions, location)
- Step 2: Payment collection via PaymentCollectionModal
- Offline queuing for non-card payments
- Charity round-up integration

### 3. GuestCheckoutModal (Portal) → PortalCheckoutFlow

```tsx
import { PortalCheckoutFlow } from "@/components/portal/PortalCheckoutFlow";

<PortalCheckoutFlow
  isOpen={isCheckoutOpen}
  onClose={() => setIsCheckoutOpen(false)}
  cart={cart}
  campgroundId={campgroundId}
  guest={guest}
  onSuccess={handleCheckoutSuccess}
  isOnline={isOnline}
  queueOrder={(payload) => queueOrder(payload, campgroundId)}
  onQueued={() => {
    setIsCheckoutOpen(false);
    setCart([]);
    toast({ title: "Order saved offline" });
  }}
/>;
```

**PortalCheckoutFlow handles:**

- Step 1: Order configuration (fulfillment type, delivery location, instructions)
- Step 2: Payment collection via PaymentCollectionModal
- Offline queuing for charge-to-site orders
- Charity round-up integration

### 4. Public Booking Page

```tsx
<PaymentCollectionModal
  isOpen={showPayment}
  onClose={() => setShowPayment(false)}
  campgroundId={campgroundId}
  amountDueCents={bookingTotal}
  subject={{ type: "reservation", reservationId: pendingReservationId }}
  context="public_booking"
  guestEmail={bookingEmail}
  enablePromoCode={true}
  enableCharityRoundUp={true}
  preAppliedPromoCode={promoCode}
  onSuccess={(result) => {
    confirmBooking(result);
  }}
/>
```

### 5. Check-in Page

```tsx
<PaymentCollectionModal
  isOpen={collectingPayment}
  onClose={() => setCollectingPayment(false)}
  campgroundId={campgroundId}
  amountDueCents={balanceDue}
  subject={{ type: "balance", reservationId }}
  context="staff_checkin"
  guestId={guest.id}
  guestEmail={guest.email}
  terminalLocationId={locationId}
  enableSplitTender={true}
  enableDepositHold={requiresDeposit}
  onSuccess={(result) => {
    completeCheckIn(result);
  }}
/>
```

## Context-Specific Method Availability

| Context        | Card | Saved | Terminal | Wallet | Cash | Check | Folio | ACH | Digital |
| -------------- | ---- | ----- | -------- | ------ | ---- | ----- | ----- | --- | ------- |
| public_booking | Yes  | Yes   | -        | -      | -    | -     | -     | Yes | Yes     |
| portal         | Yes  | Yes   | -        | Yes    | -    | -     | Yes   | -   | Yes     |
| kiosk          | Yes  | -     | Yes      | -      | Yes  | -     | -     | -   | Yes     |
| staff_checkin  | Yes  | Yes   | Yes      | Yes    | Yes  | Yes   | Yes   | Yes | -       |
| staff_booking  | Yes  | Yes   | Yes      | Yes    | Yes  | Yes   | Yes   | Yes | -       |
| pos            | Yes  | Yes   | Yes      | Yes    | Yes  | Yes   | Yes   | -   | -       |
| seasonal       | Yes  | Yes   | -        | -      | -    | Yes   | -     | Yes | -       |

## PaymentResult Structure

```typescript
interface PaymentResult {
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
}
```

## Admin Configuration

Payment methods are configured per-campground at:
`/dashboard/settings/payments` → "Payment Methods" tab

Campground owners can:

- Enable/disable each payment method
- Restrict accepted card brands
- Choose fee mode (absorb vs. pass-through)
- Show/hide fee breakdown to guests
