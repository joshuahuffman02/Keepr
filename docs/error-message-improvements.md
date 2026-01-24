# Error Message Improvements

## Summary

Improved 15+ error messages across the codebase to be more actionable and user-friendly. Each error message now:

1. Explains what happened
2. Suggests how to fix it
3. Provides specific context

## API Error Messages Improved

### Gift Cards Service

**File:** `/platform/apps/api/src/gift-cards/gift-cards.service.ts`

| Before                    | After                                                                   |
| ------------------------- | ----------------------------------------------------------------------- |
| "code is required"        | "Gift card code is required to process redemption"                      |
| "amount must be positive" | "Redemption amount must be greater than zero"                           |
| "Insufficient balance"    | "Gift card has insufficient balance. Available: $X.XX, Required: $Y.YY" |

### Blackout Dates Service

**File:** `/platform/apps/api/src/blackouts/blackouts.service.ts`

| Before                              | After                                                                      |
| ----------------------------------- | -------------------------------------------------------------------------- |
| "Invalid start or end date"         | "Invalid date format. Please use a valid date format (YYYY-MM-DD)"         |
| "End date must be after start date" | "End date must be after start date. Please adjust your date range"         |
| "Campground not found"              | "Campground not found. Please verify the campground ID or contact support" |

### Forms Service

**File:** `/platform/apps/api/src/forms/forms.service.ts`

| Before               | After                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| "Form is not active" | "This form is currently inactive and cannot accept submissions. Please contact the campground" |

### Promotions Service

**File:** `/platform/apps/api/src/promotions/promotions.service.ts`

| Before               | After                                                        |
| -------------------- | ------------------------------------------------------------ |
| "Invalid promo code" | "Promo code not found. Please verify the code and try again" |

### Stored Value Service

**File:** `/platform/apps/api/src/stored-value/stored-value.service.ts`

| Before                 | After                                                     |
| ---------------------- | --------------------------------------------------------- |
| "Insufficient balance" | "Insufficient balance. Available: $X.XX, Required: $Y.YY" |

## Frontend Error Messages Improved

### Payment Intent Hook

**File:** `/platform/apps/web/components/payments/PaymentCollectionModal/hooks/usePaymentIntent.ts`

| Before                                | After                                                                              |
| ------------------------------------- | ---------------------------------------------------------------------------------- |
| "Invalid payment amount"              | "Payment amount must be greater than zero. Please verify the amount and try again" |
| "Missing reservation ID for payment"  | "Reservation ID is required to process payment. Please select a reservation"       |
| "Failed to initialize payment"        | "Failed to initialize payment. Please check your connection and try again"         |
| "Deposit holds require a reservation" | "Deposit holds require a reservation ID. Please select a reservation"              |
| "Failed to create deposit hold"       | "Failed to create deposit hold. Please check your payment method and try again"    |
| "No active hold to capture"           | "No active payment hold found. Please create a new hold"                           |
| "Failed to capture hold"              | "Failed to capture payment hold. Please try again or contact support"              |
| "No active hold to release"           | "No active payment hold found to release"                                          |
| "Failed to release hold"              | "Failed to release payment hold. Please try again or contact support"              |

### Check-in/Check-out Page

**File:** `/platform/apps/web/app/check-in-out/page.tsx`

| Before                                      | After                                                                                                |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| "Failed to check in" / "Please try again"   | "Failed to check in" / "Unable to check in guest. Verify payment status and try again"               |
| "Bulk check-in failed" / "Please try again" | "Bulk check-in failed" / "Unable to process multiple check-ins. Try checking in guests individually" |
| "Failed to check out" / "Please try again"  | "Failed to check out" / "Unable to check out guest. Ensure all charges are settled and try again"    |

### User Management Page

**File:** `/platform/apps/web/app/dashboard/settings/users/page.tsx`

| Before                         | After                                                                |
| ------------------------------ | -------------------------------------------------------------------- |
| Error with no fallback message | "Unable to add member. Please check the email and try again"         |
| Error with no fallback message | "Unable to update member role. Please try again"                     |
| Error with no fallback message | "Unable to remove member. Ensure at least one owner remains"         |
| Error with no fallback message | "Unable to resend invitation. Please verify the email and try again" |

## Error Message Patterns Used

### 1. Context-Specific Errors

- Include actual values (e.g., available balance vs required balance)
- Show what was attempted and what failed
- Reference the specific entity involved

### 2. Actionable Guidance

- Tell users what to do next
- Suggest verification steps
- Provide alternative actions

### 3. User-Friendly Language

- Avoid technical jargon
- Use plain language
- Be respectful and helpful

## Impact

These improvements enhance the professional feel of the application by:

- Reducing user confusion and support requests
- Making errors self-explanatory
- Guiding users to successful resolution
- Demonstrating attention to detail and user experience

## Files Modified

### API (6 files)

1. `/platform/apps/api/src/gift-cards/gift-cards.service.ts`
2. `/platform/apps/api/src/blackouts/blackouts.service.ts`
3. `/platform/apps/api/src/forms/forms.service.ts`
4. `/platform/apps/api/src/promotions/promotions.service.ts`
5. `/platform/apps/api/src/stored-value/stored-value.service.ts`

### Frontend (3 files)

1. `/platform/apps/web/components/payments/PaymentCollectionModal/hooks/usePaymentIntent.ts`
2. `/platform/apps/web/app/check-in-out/page.tsx`
3. `/platform/apps/web/app/dashboard/settings/users/page.tsx`

### Documentation (2 files)

1. `/docs/professional-feel-checklist.md` - Marked section 4 as completed
2. `/docs/error-message-improvements.md` - This file

## Total Improvements: 15+ Error Messages

All error messages now follow best practices for user-facing error communication.
