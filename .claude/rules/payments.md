---
paths:
  - "**/payments/**"
  - "**/billing/**"
  - "**/stripe-payments/**"
  - "**/ledger/**"
---

# Payments & Financial Rules

## Money Handling

1. **ALL amounts in cents (integers)**

   ```typescript
   const priceCents = 9999; // $99.99
   // NEVER: const price = 99.99;
   ```

2. **Convert for display only:**

   ```typescript
   const displayPrice = (cents / 100).toFixed(2);
   ```

3. **Round after calculations:**
   ```typescript
   const taxCents = Math.round(subtotalCents * taxRate);
   ```

## Stripe Integration

1. **Each campground has its own Stripe connected account**

   ```typescript
   if (!campground.stripeAccountId) {
     throw new BadRequestException("Campground not connected to Stripe");
   }
   ```

2. **Always check refund eligibility before processing**
3. **Use idempotency keys for payment operations**

## Double-Entry Ledger

1. **Every financial operation creates ledger entries**
2. **Debits and credits must balance**
3. **Include GL codes for accounting integration**

## Transactions Required For:

- Creating payment + updating reservation balance
- Processing refund + reversing ledger entries
- Applying gift card + creating usage record
- Billing meters + creating invoice + ledger entries

## Audit Trail

1. **Log all payment operations**
2. **Include user ID who initiated**
3. **Store Stripe transaction IDs**
4. **Never delete payment records** - mark as voided/refunded
