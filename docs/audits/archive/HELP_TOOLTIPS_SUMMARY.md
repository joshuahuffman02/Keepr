# Help Tooltips Implementation Summary

## Overview

Added inline help tooltips to complex form fields across the application to improve user experience and reduce confusion. All tooltips use the HelpCircle icon from Lucide and are accessible.

## New Component Created

### `/platform/apps/web/components/ui/help-tooltip.tsx`

- Reusable component for displaying contextual help
- Uses Radix UI Tooltip primitive
- Features:
  - HelpCircle icon (4x4 size)
  - Configurable tooltip position (top, right, bottom, left)
  - 200ms delay before showing
  - Max width constraint for readability
  - Accessible (aria-label, keyboard navigation)
  - Hover state transition

## Files Modified

### 1. `/platform/apps/web/components/store/ProductModal.tsx`

**Fields with tooltips added:**

- **Price (cents)**: "Enter price in cents (e.g., 999 = $9.99)"
- **SKU**: "Stock Keeping Unit - unique identifier for inventory"
- **GL Code**: "General Ledger code for accounting integration" (also added the field to the UI)

### 2. `/platform/apps/web/app/dashboard/settings/tax-rules/page.tsx`

**Fields with tooltips added:**

- **Rate (%)**: "Enter as decimal (e.g., 7.5 for 7.5% or 5.00 for $5.00)"
- **Min Nights**: "Minimum stay length required for this tax rule to apply"
- **Max Nights**: "Maximum stay length for this tax rule to apply"
- **Requires Waiver**: "Guest must sign exemption documentation (e.g., for long-term stays or tax-exempt organizations)"

### 3. `/platform/apps/web/app/dashboard/settings/deposit-policies/page.tsx`

**Fields with tooltips added:**

- **Due Timing**: "When the deposit should be collected from the guest"
- **Min Cap ($)**: "Minimum deposit amount regardless of calculation (e.g., always collect at least $25)"
- **Max Cap ($)**: "Maximum deposit amount regardless of calculation (e.g., never collect more than $500)"

### 4. `/platform/apps/web/app/dashboard/settings/policies/page.tsx`

**Fields with tooltips added:**

- **Cancel Window (hours before arrival)**: "Number of hours before arrival when free cancellation is allowed (e.g., 48 hours)"
- **Fee Type**: "How the cancellation fee is calculated: none, flat dollar amount, percentage of total, or one night's rate"
- **Flat Fee (cents)**: "Fixed cancellation fee in cents (e.g., 2500 = $25.00)"
- **Fee Percent (0-100)**: "Percentage of total reservation cost to charge as cancellation fee (e.g., 25 for 25%)"

## Design Patterns Used

1. **Consistent Layout**: All tooltips follow the same pattern:

   ```tsx
   <div className="flex items-center gap-1.5">
     <Label htmlFor="fieldId">Field Name</Label>
     <HelpTooltip content="Helpful explanation..." />
   </div>
   ```

2. **Accessibility**:
   - Button type="button" to prevent form submission
   - aria-label="Help" for screen readers
   - Keyboard navigable (tab to focus, enter to show)

3. **User Experience**:
   - Small, unobtrusive icon (4x4)
   - Muted color that becomes darker on hover
   - 200ms delay to avoid accidental triggers
   - Max width to prevent overly wide tooltips

## Testing Checklist

- [ ] Tooltips appear on hover
- [ ] Tooltips appear on keyboard focus (tab navigation)
- [ ] Tooltip content is readable and helpful
- [ ] Icons align properly with labels
- [ ] No layout shifts when hovering
- [ ] Works in both light and dark themes (if applicable)
- [ ] Screen readers announce "Help" button
- [ ] Tooltips don't block form submission

## Future Enhancements

Consider adding tooltips to:

- Form validation rules
- Advanced calculation fields
- Fields with specific format requirements
- Fields that interact with external systems
