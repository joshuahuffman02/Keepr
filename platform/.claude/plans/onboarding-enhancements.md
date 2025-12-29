# Enhanced Onboarding Implementation Plan

## Overview
Expand onboarding to capture more detailed campground configuration while maintaining our beautiful, step-by-step UI. All new sections are skippable.

---

## Database Changes Required

### 1. SiteClass Model Additions
```prisma
model SiteClass {
  // ... existing fields
  equipmentTypes      String[]  @default([])  // ["class_a", "class_b", "travel_trailer", etc.]
  slideOutsAccepted   String?   // "both_sides" | "driver_side" | "passenger_side" | "none"
  recommendedLength   Int?      // Recommended rig length in feet

  // Extra guest pricing (move from campground-level to class-level)
  occupantsIncluded   Int       @default(2)   // Guests included in base rate
  extraAdultFee       Int?      // Cents per night
  extraChildFee       Int?      // Cents per night

  // Fees
  petFeeEnabled       Boolean   @default(false)
  petFeeCents         Int?      // Per pet per night
  bookingFeeCents     Int?      // Per booking
  siteLockFeeCents    Int?      // To guarantee specific site
}
```

### 2. Campground Model Additions
```prisma
model Campground {
  // ... existing fields

  // Booking sources (for dropdown in manual reservations)
  bookingSources      String[]  @default([])  // ["google", "facebook", "friend", "return_guest", etc.]
  stayReasons         String[]  @default([])  // ["vacation", "event", "work", etc.]
}
```

### 3. Leverage Existing Models
- **SeasonalRate** - Already supports rate periods with date ranges
- **DepositPolicy** - Already supports flexible deposit rules
- **AddOnService** - Use for inventory items (firewood, guest passes, etc.)

---

## Onboarding Flow Changes

### Current Flow (11 steps)
1. Park Profile → 2. Stripe Connect → 3. Inventory Choice → 4. Data Import →
5. Site Classes → 6. Sites Builder → 7. Rates Setup → 8. Tax Rules →
9. Deposit Policy → 10. Park Rules → 11. Review & Launch

### Enhanced Flow (14 steps)
1. Park Profile (+ amenities expanded)
2. Stripe Connect
3. Inventory Choice
4. Data Import (optional)
5. **Site Classes** (enhanced with equipment types, dimensions)
6. Sites Builder
7. **Rate Periods** (NEW - define seasons/periods)
8. **Rates Setup** (enhanced - per-period pricing, weekday/weekend)
9. **Fees & Add-ons** (NEW - guest fees, pet fees, booking fee, site lock, inventory items)
10. Tax Rules
11. **Deposit Rules** (enhanced - use DepositPolicy model)
12. **Cancellation Rules** (NEW - tiered cancellation policies)
13. Park Rules
14. Review & Launch

---

## Implementation Details

### Step 5: Enhanced Site Classes

**New UI Sections (collapsible):**

#### A. Equipment & Dimensions
```
┌─────────────────────────────────────────────────────────┐
│ Equipment & Dimensions (Optional)                    ▼  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Accepted Equipment Types                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Class A  │ │ Class B  │ │ Class C  │ │ 5th Wheel│   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Travel   │ │ Toy      │ │ Pop-Up   │ │ Van/     │   │
│  │ Trailer  │ │ Hauler   │ │ Camper   │ │ Camper   │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│  ┌──────────┐ ┌──────────┐                              │
│  │ Tent     │ │ Any/All  │                              │
│  └──────────┘ └──────────┘                              │
│                                                         │
│  Maximum Rig Length        Slide-Outs Accepted          │
│  ┌─────────────────┐       ┌─────────────────────────┐  │
│  │ 40 ft        ▼  │       │ Both Sides           ▼  │  │
│  └─────────────────┘       └─────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### B. Guest Pricing
```
┌─────────────────────────────────────────────────────────┐
│ Guest Pricing (Optional)                             ▼  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Guests Included in Base Rate                           │
│  ┌─────────────────┐                                    │
│  │ 2            ▼  │  adults/children                   │
│  └─────────────────┘                                    │
│                                                         │
│  Extra Guest Fees                                       │
│  ┌─────────────────┐  ┌─────────────────┐               │
│  │ $5.00           │  │ $3.00           │  per night    │
│  │ per extra adult │  │ per extra child │               │
│  └─────────────────┘  └─────────────────┘               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### Step 7: Rate Periods (NEW)

**Purpose:** Define seasons/rate periods with date ranges

```
┌─────────────────────────────────────────────────────────┐
│ Rate Periods                                            │
│                                                         │
│ Define your pricing seasons. You'll set rates for      │
│ each period in the next step.                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ [Sun] Peak Season                              ✕   │   │
│  │     May 25 - Sep 2, 2025                        │   │
│  │     + Add another date range                    │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ [Leaf] Shoulder Season                          ✕   │   │
│  │     Apr 15 - May 24, 2025                       │   │
│  │     Sep 3 - Oct 15, 2025                        │   │
│  │     + Add another date range                    │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ [Snow] Off Season                               ✕   │   │
│  │     Oct 16 - Apr 14 (all other dates)          │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ [Star] Holiday Weekends                         ✕   │   │
│  │     Jul 3 - Jul 6, 2025                         │   │
│  │     Aug 29 - Sep 1, 2025                        │   │
│  │     + Add another date range                    │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  [+ Add Rate Period]                                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### Step 8: Enhanced Rates Setup

**Changes:** Show rate input per site class × rate period × day type

```
┌─────────────────────────────────────────────────────────┐
│ Set Your Rates                                          │
│                                                         │
│ Back-in RV - Full Hookup                                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [Sun] Peak Season                                         │
│  ┌──────────────────┐  ┌──────────────────┐             │
│  │ $65              │  │ $75              │             │
│  │ Sun-Thu          │  │ Fri-Sat          │             │
│  └──────────────────┘  └──────────────────┘             │
│  Min nights: [1] Sun-Thu  [2] Fri-Sat                   │
│                                                         │
│  [Leaf] Shoulder Season                                     │
│  ┌──────────────────┐  ┌──────────────────┐             │
│  │ $55              │  │ $65              │             │
│  │ Sun-Thu          │  │ Fri-Sat          │             │
│  └──────────────────┘  └──────────────────┘             │
│  Min nights: [1] Sun-Thu  [1] Fri-Sat                   │
│                                                         │
│  [Snow] Off Season                                          │
│  ┌──────────────────┐  ┌──────────────────┐             │
│  │ $45              │  │ $50              │             │
│  │ Sun-Thu          │  │ Fri-Sat          │             │
│  └──────────────────┘  └──────────────────┘             │
│                                                         │
│  [Star] Holiday Weekends                                    │
│  ┌──────────────────┐                                   │
│  │ $85              │  (all days)                       │
│  └──────────────────┘                                   │
│  Min nights: [3]                                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### Step 9: Fees & Add-ons (NEW)

```
┌─────────────────────────────────────────────────────────┐
│ Fees & Add-ons                                          │
│                                                         │
│ Configure fees and additional services. All optional.   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  BOOKING FEES                                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │ [x] Booking Fee         $3.50 per booking         │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │ [x] Site Lock Fee       $30.00 per booking        │   │
│  │   (Charge to guarantee a specific site)         │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  PET FEES                                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │ [ ] Pet Fee             $____ per pet per night   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  INVENTORY ITEMS                                        │
│  Items guests can purchase during booking or stay       │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ [Wood] Firewood            $7.00   one-time      ✕   │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │ [Ticket] Day Guest Pass      $5.00   per person    ✕   │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │ [Fire] Fire Pit Experience $25.00  one-time      ✕   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  [+ Add Item]                                           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### Step 11: Enhanced Deposit Rules

**Use DepositPolicy model for more flexibility**

```
┌─────────────────────────────────────────────────────────┐
│ Deposit Policy                                          │
│                                                         │
│ When should deposits be collected?                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  TIMING                                                 │
│  ○ At time of booking                                   │
│  ○ ___ days before arrival                              │
│                                                         │
│  AMOUNT                                                 │
│  ○ First night's stay                                   │
│  ○ 50% of total                                         │
│  ○ Full payment                                         │
│  ○ Custom percentage: ____%                             │
│  ○ Fixed amount: $____                                  │
│                                                         │
│  LIMITS (Optional)                                      │
│  Minimum deposit: $____                                 │
│  Maximum deposit: $____                                 │
│                                                         │
│  APPLIES TO                                             │
│  ○ All site types                                       │
│  ○ Specific site types: [select...]                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### Step 12: Cancellation Rules (NEW)

```
┌─────────────────────────────────────────────────────────┐
│ Cancellation Policy                                     │
│                                                         │
│ Define your cancellation rules. Guests will see these   │
│ during booking.                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  RV SITES                                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │ More than 30 days before arrival:               │   │
│  │ $20 cancellation fee                            │   │
│  ├─────────────────────────────────────────────────┤   │
│  │ 7-30 days before arrival:                       │   │
│  │ First night forfeited                           │   │
│  ├─────────────────────────────────────────────────┤   │
│  │ Less than 7 days before arrival:                │   │
│  │ No refund                                       │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  CABINS                                                 │
│  ┌─────────────────────────────────────────────────┐   │
│  │ More than 14 days before arrival:               │   │
│  │ $40 cancellation fee                            │   │
│  ├─────────────────────────────────────────────────┤   │
│  │ Less than 14 days before arrival:               │   │
│  │ No refund                                       │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  [+ Add Rule for Different Site Types]                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### Booking Sources & Stay Reasons

**Location:** Add to Park Profile step as collapsible section

```
┌─────────────────────────────────────────────────────────┐
│ Booking Sources (Optional)                           ▼  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Where do guests typically find you?                     │
│ (Used for tracking and reporting)                       │
│                                                         │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│ │ [x] Google │ │ [x] Friend │ │ [x] Return │ │ [ ] Yelp   │    │
│ └──────────┘ └──────────┘ │   Guest  │ └──────────┘    │
│                           └──────────┘                  │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│ │ [x] FB     │ │ [x] Insta  │ │ [ ] Hipcamp│ │ [ ] Airbnb │    │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
│                                                         │
│ Custom sources (one per line):                          │
│ ┌─────────────────────────────────────────────────┐    │
│ │ Visit Winona                                     │    │
│ │ Biking Ad                                        │    │
│ │ Shakespeare Festival                             │    │
│ └─────────────────────────────────────────────────┘    │
│                                                         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Stay Reasons (Optional)                              ▼  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Why do guests typically visit?                          │
│                                                         │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│ │ [x] Vacation│ │ [x] Event  │ │ [x] Work   │ │ [x] Family │    │
│ └──────────┘ └──────────┘ └──────────┘ │  Visit   │    │
│                                         └──────────┘    │
│ Custom reasons (one per line):                          │
│ ┌─────────────────────────────────────────────────┐    │
│ │ Winona County Fair                               │    │
│ │ Steamboat Days                                   │    │
│ │ Beethoven Music Festival                         │    │
│ └─────────────────────────────────────────────────┘    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Order

### Phase 1: Database & API
1. Add new fields to SiteClass model (equipmentTypes, occupantsIncluded, fees)
2. Add bookingSources/stayReasons to Campground model
3. Run migration
4. Update onboarding API to handle new fields

### Phase 2: Enhanced Site Classes
5. Create EquipmentTypePicker component
6. Create GuestPricingPanel component
7. Integrate into SiteClasses step

### Phase 3: Rate Periods
8. Create RatePeriods step component
9. Create RatePeriodCard component
10. Store in SeasonalRate model

### Phase 4: Enhanced Rates
11. Modify Rates step to show period × day-of-week matrix
12. Save to SeasonalRate with dow adjustments

### Phase 5: Fees & Add-ons
13. Create FeesAndAddons step component
14. Create AddOnItemCard component
15. Store in AddOnService model

### Phase 6: Deposit & Cancellation
16. Create enhanced DepositRules component (using DepositPolicy)
17. Create CancellationRules step component
18. Create CancellationRuleBuilder component

### Phase 7: Booking Sources
19. Add collapsible sections to ParkProfile
20. Create SourcesPicker component

---

## Files to Create

### New Components
- `components/onboarding/EquipmentTypePicker.tsx`
- `components/onboarding/GuestPricingPanel.tsx`
- `components/onboarding/RatePeriodCard.tsx`
- `components/onboarding/AddOnItemCard.tsx`
- `components/onboarding/CancellationRuleBuilder.tsx`
- `components/onboarding/SourcesPicker.tsx`

### New Steps
- `steps/RatePeriods.tsx`
- `steps/FeesAndAddons.tsx`
- `steps/CancellationRules.tsx`

### Modified Steps
- `steps/SiteClasses.tsx` - Add equipment types, guest pricing
- `steps/Rates.tsx` - Support rate periods, weekday/weekend
- `steps/DepositPolicy.tsx` - Use full DepositPolicy model
- `steps/ParkProfile.tsx` - Add booking sources, stay reasons

---

## Equipment Type Options
```typescript
const EQUIPMENT_TYPES = [
  { id: "class_a", label: "Class A", icon: Truck },
  { id: "class_b", label: "Class B", icon: Van },
  { id: "class_c", label: "Class C", icon: Caravan },
  { id: "fifth_wheel", label: "5th Wheel", icon: Trailer },
  { id: "travel_trailer", label: "Travel Trailer", icon: Caravan },
  { id: "toy_hauler", label: "Toy Hauler", icon: Container },
  { id: "pop_up", label: "Pop-Up Camper", icon: Tent },
  { id: "van_camper", label: "Van/Truck Camper", icon: Van },
  { id: "motorhome", label: "Motorhome", icon: Bus },
  { id: "tent", label: "Tent", icon: Tent },
  { id: "any", label: "Any/All", icon: Check },
];
```

## Slide-Out Options
```typescript
const SLIDEOUT_OPTIONS = [
  { id: "both_sides", label: "Both Sides" },
  { id: "driver_side", label: "Driver Side Only" },
  { id: "passenger_side", label: "Passenger Side Only" },
  { id: "none", label: "No Slide-Outs" },
];
```
