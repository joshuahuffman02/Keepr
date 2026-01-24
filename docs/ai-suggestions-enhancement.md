# AI Site Suggestions - Enhanced Reasoning Display

## Overview

Enhanced the AI site suggestions feature in the booking flow to display 1-2 clear reasons WHY each site is recommended. This builds trust with staff by making the AI recommendations transparent and actionable.

## Changes Made

### 1. Frontend Enhancement (booking-v2/page.tsx)

**Before:**

- Showed only site name, score badge, and first reason (or generic "High match")
- Single line of text, no visual hierarchy
- No fallback logic when reasons weren't provided

**After:**

- Displays up to 2 specific reasons per suggestion
- Bullet-point format for easy scanning
- Fallback logic generates context-aware reasons based on:
  - Match score level (85%+ = "Excellent match", 70%+ = "Good match", etc.)
  - Site features (vibe tags if available)
- Improved styling:
  - Slightly taller cards (py-2.5 instead of py-2)
  - Hover state for better interactivity
  - Muted color for reasons (text-status-success/80)
  - Proper spacing between bullets (space-y-0.5)

### 2. Backend Enhancement (match-score.service.ts)

**Added Comprehensive Reasoning:**

1. **History-based reasons:**
   - "Guest has stayed in this specific site before" (+30 score)
   - "Guest has stayed in this site class before" (+15 score)

2. **Preference matching:**
   - "Matches preference: Secluded location" (+15 score)
   - "Matches preference: Shaded site" (+10 score)
   - "Close to restrooms (accessibility)" (+10 score)

3. **Premium features:**
   - "Premium waterfront location" (Lake/River/Waterfront) (+8 score)
   - "Easy pull-through access for RV" (+12 score)
   - "ADA accessible site" (+5 score)
   - "Pet-friendly amenities" (+8 score)

4. **Rig compatibility:**
   - "Spacious fit for your rig" (10+ ft buffer) (+8 score)
   - "Compatible rig length" (fits exactly) (+3 score)

5. **Social proof:**
   - "Highly rated by previous guests" (80+ popularity) (+bonus from popularity score)

6. **Value indicator:**
   - "Best value in class" (10%+ below class average) (+5 score)

## Example Output

```
AI Suggestions
✨

[Site A-12]  [85%]
• Guest has stayed in this specific site before
• Premium waterfront location

[Site B-05]  [78%]
• Close to restrooms (accessibility)
• Spacious fit for your rig

[Site C-22]  [72%]
• Highly rated by previous guests
• Best value in class
```

## Benefits

1. **Trust Building:** Staff can see exactly why the AI made each recommendation
2. **Learning Tool:** Helps staff understand guest preferences over time
3. **Transparency:** No "black box" AI - every score is explained
4. **Actionable:** Staff can validate whether reasons align with guest needs
5. **Graceful Degradation:** If API doesn't provide reasons, frontend generates sensible fallbacks

## Technical Details

- Frontend displays up to 2 reasons (slice(0, 2))
- Backend can generate multiple reasons - frontend picks the top 2
- Fallback logic ensures there's always context, even with minimal data
- Score-based fallbacks provide value even when site attributes are sparse
- All text is professional and staff-focused (no emojis, per project guidelines)

## Files Modified

- `/platform/apps/web/app/booking-v2/page.tsx` (lines 1165-1216)
- `/platform/apps/api/src/reservations/match-score.service.ts` (lines 36-108)

## Testing

- ✅ TypeScript compilation passes
- ✅ ESLint validation passes
- ✅ Next.js build succeeds
- ✅ NestJS build succeeds
- ✅ Maintains existing behavior when no reasons available
