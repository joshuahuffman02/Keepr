# Central Settings Page Implementation Plan

## Executive Summary

This document outlines the implementation of a centralized settings page for Campreserv, inspired by K2's left-to-right hierarchical navigation pattern while leveraging Campreserv's existing strengths and 37 settings pages.

---

## K2 Analysis: What Makes It Work

### Navigation Architecture (3-Level Hierarchy)

```
Level 1: Main Categories (horizontal tabs at top)
├── Site Setup
├── Rate Setup
├── Text Setup
├── Reservation Setup
├── KampStore Setup
├── Security
└── Review

Level 2: Sub-sections (second row of tabs)
Example under "Site Setup":
├── Operation Details
├── Tax Tables
├── Site Attributes
├── Equipment
├── Pricing Groups
├── Sites
└── Optimization

Level 3: Content tabs (within page content)
Example under "Operation Details":
├── Operation Profile
├── Long Term Stay
├── Charges
└── Guest Messaging
```

### K2 UX Patterns Worth Adopting

1. **Persistent tab navigation** - Always visible, shows context
2. **Active/Inactive/All filters** - Consistent table filtering
3. **Search + Add buttons** - Standard table actions
4. **Color-coded rate groups** - Visual calendar association
5. **System Check dashboard** - Proactive issue detection
6. **Copy buttons** - Quick duplication of complex items

---

## Feature Comparison: K2 vs Campreserv

### What Campreserv Does BETTER

| Feature                             | Campreserv                    | K2               |
| ----------------------------------- | ----------------------------- | ---------------- |
| **Search-based settings discovery** | Global search on landing page | No search        |
| **Branding/theming**                | Full brand customization      | Basic            |
| **Integrations ecosystem**          | Rich integration directory    | Limited          |
| **Gamification**                    | Badges, XP, rewards           | None             |
| **ADA Accessibility**               | Certification program         | Basic attributes |
| **Value Stack/Guarantees**          | Multiple guarantee types      | None             |
| **POS Integration options**         | Lightspeed, Shopify, etc.     | KampStore only   |
| **Dynamic Pricing**                 | Rule stacking, priorities     | Less flexible    |
| **Security Certification**          | Assessment checklist          | None             |
| **Webhook support**                 | Developer tools               | None             |

### What K2 Has That We Should Add

| Feature                         | Description                            | Priority |
| ------------------------------- | -------------------------------------- | -------- |
| **Grid Optimization**           | Auto-optimize site assignments nightly | HIGH     |
| **Equipment Types**             | RV types with tow/length requirements  | MEDIUM   |
| **Rate Groups**                 | Color-coded calendar periods           | HIGH     |
| **Charge Codes**                | Reusable fee definitions               | MEDIUM   |
| **Additional Questions (UDFs)** | Custom reservation fields              | HIGH     |
| **Lock Codes**                  | Site lock reasons (maintenance, etc.)  | MEDIUM   |
| **Referral Sources**            | Track how guests found you             | LOW      |
| **Site Closures**               | Temporary closures with reasons        | MEDIUM   |
| **System Check**                | Validation/health dashboard            | HIGH     |
| **Text Fields**                 | Configurable policy text blocks        | LOW      |
| **Long Term Stay**              | Monthly/seasonal settings              | MEDIUM   |

---

## Proposed Navigation Structure

### Level 1: Main Categories

```
┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐
│   Property  │   Pricing   │  Bookings   │    Store    │   Access    │   System    │
└─────────────┴─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘
```

### Level 2: Sub-sections Per Category

#### 1. Property

- Campground Profile
- Site Types & Attributes
- Equipment Types (NEW)
- Amenities
- Photos
- Branding
- Localization
- Store Hours

#### 2. Pricing

- Rate Plans
- Rate Groups (NEW - calendar colors)
- Seasonal Rates
- Dynamic Rules
- Charge Codes (NEW)
- Tax Rules
- Deposit Policies

#### 3. Bookings

- Booking Policies
- Stay Rules (min/max)
- Blackout Dates
- Site Closures (NEW)
- Discounts & Promos
- Custom Fields (UDFs - NEW)
- Lock Codes (NEW)
- Referral Sources (NEW)
- Optimization (NEW)

#### 4. Store

- Departments
- Products
- Upsells
- Store Discounts
- POS Integrations

#### 5. Access

- Users & Roles
- Permissions
- Security Groups
- API & Webhooks
- Audit Log

#### 6. System

- System Check (NEW)
- Communications
- Email Templates
- Integrations
- Analytics
- Import/Export
- Jobs

---

## Implementation Architecture

### Route Structure

```
/dashboard/settings                    # Landing page (keep existing)
/dashboard/settings/central            # NEW: Central settings hub
/dashboard/settings/central/property   # Property category
/dashboard/settings/central/pricing    # Pricing category
/dashboard/settings/central/bookings   # Bookings category
/dashboard/settings/central/store      # Store category
/dashboard/settings/central/access     # Access category
/dashboard/settings/central/system     # System category
```

### Component Architecture

```
CentralSettings/
├── layout.tsx                 # 3-level tab layout
├── page.tsx                   # Redirect to first category
├── components/
│   ├── SettingsTabNav.tsx     # Level 1 horizontal tabs
│   ├── SubTabNav.tsx          # Level 2 sub-tabs
│   ├── ContentTabs.tsx        # Level 3 content tabs
│   ├── SettingsTable.tsx      # Reusable data table
│   ├── ActiveFilter.tsx       # Active/Inactive/All buttons
│   └── SystemCheckCard.tsx    # Health check component
├── [category]/
│   ├── layout.tsx             # Category-specific layout
│   └── [section]/
│       └── page.tsx           # Section content
```

### State Management

```typescript
// URL-driven state for deep linking
/settings/central/pricing/rate-groups?tab=calendar&filter=active

// Context for settings navigation
interface SettingsNavContext {
  category: string;
  section: string;
  contentTab?: string;
  filter: 'active' | 'inactive' | 'all';
}
```

---

## UI Design Specifications

### Level 1 Tabs (Main Categories)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Settings                                                       [Search] │
├──────────────────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────┐│
│ │ Property │ │ Pricing  │ │ Bookings │ │  Store   │ │  Access  │ │Systm││
│ │          │ │          │ │          │ │          │ │          │ │     ││
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └─────┘│
│      ▼                                                                   │
└──────────────────────────────────────────────────────────────────────────┘
```

### Level 2 Tabs (Sub-sections)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Profile   Site Types   Equipment   Amenities   Photos   Branding   ...  │
│    ━━━                                                                   │
└──────────────────────────────────────────────────────────────────────────┘
```

### Content Area Pattern

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Site Types                                                              │
│                                                                          │
│  ┌────────────┐  ┌──────────┐                    ┌────────┬────────┬───┐│
│  │  [Search]  │  │ + Add    │                    │ Active │Inactive│All││
│  └────────────┘  └──────────┘                    └────────┴────────┴───┘│
│  ┌──────────────────────────────────────────────────────────────────────┐│
│  │ NAME          │ CAPACITY │ BASE RATE │ STATUS │ ACTIONS              ││
│  ├───────────────┼──────────┼───────────┼────────┼──────────────────────┤│
│  │ Full Hookup   │ 2-6      │ $45/night │ ●      │ [Edit] [Inactivate]  ││
│  │ Tent Site     │ 2-4      │ $25/night │ ●      │ [Edit] [Inactivate]  ││
│  │ Cabin         │ 2-8      │ $85/night │ ○      │ [Edit] [Activate]    ││
│  └──────────────────────────────────────────────────────────────────────┘│
│                                                    Page 1 of 3  [< >]    │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## New Features Implementation Details

### 1. Grid Optimization (HIGH Priority)

**Purpose**: Automatically optimize site assignments to maximize revenue and occupancy.

**Settings**:

- Enable/disable dynamic optimization
- Days before arrival to stop optimizing
- Site classes to include (RV, Tent, Cabin, etc.)
- Pricing groups to include
- Optimization goals (revenue vs occupancy)

**How it works**:

- Runs nightly
- Analyzes upcoming reservations
- Suggests/auto-moves reservations to better sites
- Respects guest preferences and accessibility needs

### 2. Rate Groups (HIGH Priority)

**Purpose**: Define named periods with colors for visual calendar display.

**Fields**:

- Name (e.g., "Peak Summer", "Holiday", "Shoulder Season")
- Color (for calendar display)
- Date ranges per year
- Auto-fill calendar feature
- Holiday integration (US/Canada)

### 3. Custom Fields / UDFs (HIGH Priority)

**Purpose**: Add custom questions to reservation flow.

**Fields**:

- Question text
- Field type (Yes/No, Text, Number, Dropdown, Multi-select)
- When to display (Reservation, Express Arrival, Registration)
- Site classes it applies to
- Required vs optional
- Linked charge code (if applicable)

### 4. System Check Dashboard (HIGH Priority)

**Purpose**: Proactive configuration validation.

**Checks**:

- Rates not configured for pricing groups
- Missing tax table assignments
- Sites without pricing groups
- Upcoming blackout conflicts
- Expiring rate plans
- Incomplete campground profile
- Payment processor not configured

**Display**:

- Actionable items count (with badge)
- Informational items
- Direct links to fix issues

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)

- [ ] Create central settings layout component
- [ ] Implement 3-level tab navigation
- [ ] Set up route structure
- [ ] Create reusable SettingsTable component
- [ ] Add Active/Inactive/All filter component

### Phase 2: Migration (Week 2-3)

- [ ] Wrap existing settings pages in new layout
- [ ] Create category index pages
- [ ] Update breadcrumb navigation
- [ ] Ensure all existing functionality works

### Phase 3: New Features (Week 3-5)

- [ ] Implement Rate Groups with calendar colors
- [ ] Add Custom Fields (UDFs) system
- [ ] Build System Check dashboard
- [ ] Create Equipment Types management

### Phase 4: Polish (Week 5-6)

- [ ] Add keyboard navigation
- [ ] Implement search within settings
- [ ] Add quick actions (copy, bulk operations)
- [ ] Performance optimization
- [ ] Mobile responsive adjustments

---

## Database Schema Additions

### New Tables Needed

```prisma
// Rate Groups for calendar coloring
model RateGroup {
  id           String   @id @default(cuid())
  campgroundId String
  name         String
  color        String   // hex color
  isActive     Boolean  @default(true)

  campground   Campground @relation(fields: [campgroundId], references: [id])
  dateRanges   RateGroupDateRange[]
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model RateGroupDateRange {
  id          String   @id @default(cuid())
  rateGroupId String
  startDate   DateTime
  endDate     DateTime
  year        Int

  rateGroup   RateGroup @relation(fields: [rateGroupId], references: [id])
}

// Custom Fields (UDFs)
model CustomField {
  id           String   @id @default(cuid())
  campgroundId String
  name         String
  description  String?
  fieldType    CustomFieldType
  options      Json?    // for dropdowns
  isRequired   Boolean  @default(false)
  displayAt    DisplayContext[]
  siteClasses  String[] // which site types
  chargeCodeId String?
  isActive     Boolean  @default(true)
  sortOrder    Int      @default(0)

  campground   Campground @relation(fields: [campgroundId], references: [id])
  values       CustomFieldValue[]
}

enum CustomFieldType {
  YES_NO
  TEXT
  NUMBER
  DROPDOWN
  MULTI_SELECT
  DATE
}

enum DisplayContext {
  RESERVATION
  EXPRESS_ARRIVAL
  REGISTRATION
}

// Equipment Types
model EquipmentType {
  id              String   @id @default(cuid())
  campgroundId    String
  name            String
  requiresLength  Boolean  @default(false)
  requiresTow     Boolean  @default(false)
  bufferLength    Int      @default(0)
  isActive        Boolean  @default(true)

  campground      Campground @relation(fields: [campgroundId], references: [id])
}

// Site Closures
model SiteClosure {
  id           String   @id @default(cuid())
  campgroundId String
  siteId       String
  startDate    DateTime
  endDate      DateTime
  reason       String
  notes        String?
  isActive     Boolean  @default(true)

  campground   Campground @relation(fields: [campgroundId], references: [id])
  site         Site @relation(fields: [siteId], references: [id])
}

// Lock Codes
model LockCode {
  id           String   @id @default(cuid())
  campgroundId String
  name         String
  description  String?
  requiresComment Boolean @default(false)
  chargeCodeId String?
  isActive     Boolean  @default(true)

  campground   Campground @relation(fields: [campgroundId], references: [id])
}
```

---

## Migration Strategy

### Approach: Parallel Paths

1. **Keep existing settings pages functional** - No breaking changes
2. **Add new /settings/central route** - New experience lives here
3. **Gradually encourage adoption** - Link to central from landing page
4. **Eventually make central the default** - After user feedback

### Navigation Updates

```typescript
// Add to main sidebar
{
  label: 'Settings',
  icon: Settings,
  children: [
    { label: 'All Settings', href: '/dashboard/settings' },
    { label: 'Central Hub', href: '/dashboard/settings/central', badge: 'New' },
  ]
}
```

---

## Success Metrics

1. **Time to find setting** - Should decrease by 50%
2. **Settings page bounces** - Should decrease
3. **System Check issues resolved** - Track fix rate
4. **User feedback** - NPS on settings experience

---

## Questions for Decision

1. **Should we auto-migrate users to central settings, or keep both?**
2. **Which new features are highest priority for your parks?**
3. **Do you want the optimization feature to auto-move reservations or just suggest?**
4. **Should we implement referral tracking?**
5. **What custom fields do your parks typically need?**

---

## Next Steps

1. Review and approve this plan
2. Prioritize which new features to include in MVP
3. Begin Phase 1 implementation
4. Schedule design review for UI components
5. Plan user testing strategy
