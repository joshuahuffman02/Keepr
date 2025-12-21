# Feature Expansion Analysis: Hotel-Level Operations for Hybrid Properties

**Date:** December 2024
**Status:** Analysis Complete - Ready for Review

---

## Executive Summary

This document analyzes the existing Campreserv codebase and proposes a comprehensive plan for expanding the campground management system to support **hotel-level operations** for hybrid properties. The goal is enabling properties that combine RV sites, cabins, lodge rooms, and glamping units under a single management platform.

**Key Findings:**
- Current data model has a solid foundation with `SiteType` enum and `SiteClass` abstraction
- Existing housekeeping infrastructure (Phase 2) provides a starting point but needs significant expansion
- Booking flow makes RV-centric assumptions that need generalization
- Multi-tenancy is well-implemented and will support multi-property hotel chains

---

## 1. Current State Assessment

### 1.1 Data Model for Sites/Accommodations

**Current Entity Structure:**

```
Organization (tenant)
└── Campground (property)
    └── SiteClass (accommodation category)
        └── Site (individual unit)
            └── Reservation (booking)
```

**SiteType Enum (Current):**
```prisma
enum SiteType {
  rv        # RV sites with hookups
  tent      # Primitive tent sites
  cabin     # Cabins/cottages
  group     # Group camping areas
  glamping  # Glamping units
}
```

**Site Model Key Fields:**
| Field | Type | Purpose |
|-------|------|---------|
| `siteType` | Enum | Accommodation category |
| `maxOccupancy` | Int | Guest capacity |
| `rigMaxLength/Width/Height` | Int? | RV dimension constraints |
| `pullThrough` | Boolean | RV-specific feature |
| `hookupsPower/Water/Sewer` | Boolean | Utility connections |
| `powerAmps` | Int? | Electrical capacity |
| `housekeepingStatus` | String | clean/dirty/inspecting |
| `status` | String? | available/out_of_service |
| `accessible` | Boolean | ADA compliance |

**Assessment:** The current model is RV-centric. Fields like `rigMaxLength`, `pullThrough`, and hookup booleans are irrelevant for hotel rooms. The model lacks hotel-specific concepts like:
- Floor/building location
- Bed configurations
- Room views
- Connecting room relationships
- Interior features (kitchenette, bathroom type)

### 1.2 Booking Flow Assumptions

**Current Booking Path:**
1. Search availability with optional `rigType` and `rigLength`
2. `isRigCompatible()` filters sites based on:
   - If rigType is tent/cabin → returns ALL sites (no filtering)
   - If rigType is RV → requires `siteType === "rv"` and length check
3. Quote pricing from SiteClass default rate + pricing rules
4. Create reservation with occupancy validation

**Critical Assumptions:**
1. **Binary rig compatibility:** Either you're an RV (constrained) or you're not (unconstrained)
2. **No bed-based availability:** No concept of "need 2 queen beds" filtering
3. **No room feature requirements:** Can't search for "rooms with balcony"
4. **Single-unit bookings assumed:** Multi-room bookings require separate reservations

**File Reference:** `platform/apps/api/src/reservations/reservations.service.ts:820-838`

### 1.3 Existing Cleaning/Maintenance Workflows

**Phase 2 Task System (Current):**
```prisma
model Task {
  type        TaskType    // turnover, inspection, other
  state       TaskState   // pending, in_progress, blocked, done, failed, expired
  priority    String
  slaStatus   SlaStatus   // on_track, at_risk, breached
  slaDueAt    DateTime?
  checklist   Json?
  assignedToUserId  String?
  assignedToTeamId  String?
}
```

**What Exists:**
- Kanban-style housekeeping dashboard (`/housekeeping/page.tsx`)
- Task state management with SLA tracking
- Automatic site-ready marking when turnover complete
- Maintenance ticket system with out-of-order tracking
- Staff shift management foundation
- Housekeeping report generation

**What's Missing for Hotel Operations:**
- Detailed room status state machine (occupied-dirty vs vacant-dirty)
- Inspection pass/fail workflows
- Cleaning type differentiation (turnover vs deep clean vs touch-up)
- Workload balancing and zone assignment
- Supply/linen tracking
- Photo upload for issue documentation
- Mobile-optimized staff interface

**File References:**
- `platform/apps/api/src/tasks/tasks.service.ts`
- `platform/apps/web/app/campgrounds/[campgroundId]/housekeeping/page.tsx`

### 1.4 Multi-Tenant Architecture

**Implementation Pattern:**
- `Organization` → owns multiple `Campground` entities
- `CampgroundMembership` links users to properties with roles
- `ScopeGuard` validates user access to requested campgroundId
- All entities include `campgroundId` foreign key for isolation

**User Roles:**
```
owner | manager | front_desk | maintenance | finance | marketing | readonly
```

**Key Feature:** Users can have different roles at different properties, enabling:
- Hotel chain staff with varying permissions across properties
- Regional managers overseeing multiple locations
- Corporate reporting across the organization

**Assessment:** Multi-tenancy is well-designed and will support hotel chain operations without modification.

---

## 2. Accommodation Type Taxonomy

### 2.1 Proposed Accommodation Category System

**Design Principle:** Separate *category* (what it is) from *attributes* (what features it has).

#### New AccommodationType Enum
```prisma
enum AccommodationType {
  // Outdoor/Camping
  rv_site           # RV with hookups
  tent_site         # Primitive camping
  group_site        # Large group area

  // Structures - Rustic
  cabin             # Basic cabin
  cottage           # Full amenity cottage
  treehouse         # Elevated structure

  # Structures - Glamping
  yurt              # Fabric yurt
  safari_tent       # Canvas glamping tent
  dome              # Geodesic dome
  tiny_house        # Mobile tiny home
  airstream         # Vintage trailer rental

  // Hotel-Style
  hotel_room        # Standard room
  suite             # Multi-room suite
  lodge_room        # Lodge accommodation

  // Specialty
  boat_slip         # Marina slip
  storage_unit      # Dry storage
}
```

### 2.2 Universal vs Type-Specific Attributes

#### Universal Attributes (All Types)
```prisma
model Accommodation {
  // Identity
  id                String   @id
  campgroundId      String
  accommodationClassId String?
  name              String
  unitNumber        String
  accommodationType AccommodationType

  // Capacity
  maxOccupancy      Int
  maxAdults         Int?
  maxChildren       Int?

  // Status
  status            AccommodationStatus  // available, out_of_service, offline
  housekeepingStatus HousekeepingStatus
  isActive          Boolean

  // Location
  latitude          Decimal?
  longitude         Decimal?
  zone              String?   // "Loop A", "Building 2", "Lakefront"

  // Pricing
  baseRate          Int       // Cents per night

  // Content
  photos            String[]
  description       String?
  amenityTags       String[]

  // Accessibility
  accessible        Boolean
  accessibilityFeatures String[]  // wheelchair, hearing_loop, visual_aids

  // Operational
  cleaningMinutes   Int?      // Standard cleaning time
  checkInTime       String?   // Override property default
  checkOutTime      String?   // Override property default
}
```

#### RV-Specific Attributes
```prisma
model RvSiteAttributes {
  accommodationId   String   @id

  // Dimensions
  rigMaxLength      Int?
  rigMaxWidth       Int?
  rigMaxHeight      Int?
  padLength         Int?
  padWidth          Int?

  // Configuration
  pullThrough       Boolean
  backIn            Boolean
  slideOuts         Int?      // Number of slide-outs supported

  // Hookups
  electricAmps      Int?      // 30, 50, 100
  electricVolts     Int?      // 120, 240
  waterHookup       Boolean
  sewerHookup       Boolean
  cableHookup       Boolean
  wifiDirect        Boolean

  // Surface
  surfaceType       String?   // gravel, concrete, grass, paved
  padSlopePercent   Int?
  levelingRequired  Boolean?
}
```

#### Structure-Specific Attributes (Cabins, Cottages, Yurts, etc.)
```prisma
model StructureAttributes {
  accommodationId   String   @id

  // Sleeping
  bedConfiguration  Json      // [{type: "king", count: 1}, {type: "bunk", count: 2}]
  totalBeds         Int
  bedroomCount      Int?

  // Facilities
  bathroomCount     Int?
  bathroomType      String?   // private, shared, none
  hasKitchen        Boolean
  kitchenType       String?   // full, kitchenette, none
  hasHeat           Boolean
  hasAC             Boolean
  hasFireplace      Boolean

  // Building
  floorNumber       Int?
  buildingName      String?
  squareFeet        Int?

  // Features
  hasBalcony        Boolean?
  hasPatio          Boolean?
  viewType          String?   // lake, mountain, forest, pool, parking_lot

  // Linens
  linensProvided    Boolean
  towelsProvided    Boolean
}
```

#### Hotel Room Specific Attributes
```prisma
model HotelRoomAttributes {
  accommodationId    String   @id

  // extends StructureAttributes plus:

  // Room Type
  roomClass          String?   // standard, deluxe, premium, suite

  // Connectivity
  connectingRoomIds  String[]  // Adjacent rooms that can connect
  isConnecting       Boolean

  // Hotel Features
  minibar            Boolean
  safe               Boolean
  ironBoard          Boolean
  coffeemaker        Boolean
  robeSlippers       Boolean
  turndownService    Boolean

  // Floor Plan
  floorPlanType      String?   // studio, one_bedroom, two_bedroom
  rollawayAllowed    Boolean
  maxRollaways       Int?
  cribAllowed        Boolean

  // Key Management
  keyType            String?   // physical, rfid, mobile, code
  keyCodePattern     String?   // How codes are generated
}
```

### 2.3 AccommodationClass (Category Templates)

```prisma
model AccommodationClass {
  id                  String   @id
  campgroundId        String
  name                String              // "Deluxe Lakefront Cabin"
  accommodationType   AccommodationType

  // Default values for accommodations in this class
  defaultBaseRate     Int
  defaultMaxOccupancy Int
  defaultCleaningMinutes Int?

  // Template attributes (copied to new accommodations)
  defaultRvAttributes     Json?
  defaultStructureAttributes Json?
  defaultHotelAttributes  Json?

  // Pricing
  pricingRules        PricingRule[]
  seasonalRates       SeasonalRate[]

  // Content
  photos              String[]
  description         String?
  amenityTags         String[]
}
```

### 2.4 Adding New Accommodation Types

**Extensibility Design:**

1. **Enum Extension:** Add new types to `AccommodationType` enum via migration
2. **Attribute Tables:** Create new `*Attributes` table for type-specific fields
3. **Class Templates:** Property creates `AccommodationClass` with defaults
4. **No Code Changes Required:** Booking flow uses universal attributes; type-specific logic is opt-in

**Example: Adding "Floating Cabin" Type**
```sql
-- 1. Extend enum
ALTER TYPE "AccommodationType" ADD VALUE 'floating_cabin';

-- 2. Optionally create attributes table
CREATE TABLE "FloatingCabinAttributes" (
  "accommodationId" TEXT PRIMARY KEY,
  "dockNumber" TEXT,
  "maxBoatLength" INTEGER,
  "waterDepth" DECIMAL,
  ...
);

-- 3. Property creates classes and units via admin UI
```

---

## 3. Hotel-Level Cleaning Management System

### 3.1 Room Status State Machine

**Proposed States:**

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ROOM STATUS STATES                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   VACANT_DIRTY ──────┬──────► CLEANING_IN_PROGRESS                 │
│        ▲             │               │                              │
│        │             │               ▼                              │
│        │             │        PENDING_INSPECTION ◄── (skip clean)   │
│        │             │               │                              │
│        │             │               ▼                              │
│        │             │        INSPECTION_FAILED ─► CLEANING_...     │
│        │             │               │                              │
│        │             │               ▼                              │
│        │             └────► VACANT_CLEAN ◄─────────────────────┐   │
│        │                          │                             │   │
│        │                          ▼                             │   │
│        │                    VACANT_INSPECTED                    │   │
│        │                          │                             │   │
│        │                          ▼                             │   │
│        │                   ┌─── OCCUPIED ───┐                   │   │
│        │                   │                │                   │   │
│        │                   ▼                ▼                   │   │
│        │          OCCUPIED_SERVICE    OCCUPIED_DND              │   │
│        │              (touchup OK)    (do not disturb)          │   │
│        │                   │                                    │   │
│        │                   └────────────────────────────────────┘   │
│        │                                │                           │
│        └────────────────────────────────┘                           │
│                        (checkout)                                   │
│                                                                     │
│   OUT_OF_ORDER ◄───────────────────── (maintenance issue)          │
│   OUT_OF_INVENTORY ◄─────────────────  (blocked for renovations)   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Schema:**
```prisma
enum HousekeepingStatus {
  // Vacant states
  vacant_dirty
  cleaning_in_progress
  pending_inspection
  inspection_failed
  vacant_clean
  vacant_inspected

  // Occupied states
  occupied
  occupied_service     // Can receive service
  occupied_dnd        // Do Not Disturb

  // Blocked states
  out_of_order        // Maintenance issue
  out_of_inventory    // Offline (renovations, seasonal)
}
```

### 3.2 Task Types and Templates

```prisma
enum CleaningTaskType {
  turnover           // Full clean between guests
  deep_clean         // Periodic deep cleaning
  touch_up           // Light service (occupied room)
  inspection         // Quality check only
  make_ready         // Final prep before arrival

  // Specialized
  checkout_express   // Quick turnover (same-day arrival)
  vip_prep           // Enhanced prep for VIP guests
  pet_treatment      // Post-pet departure sanitization
  maintenance_clean  // Post-maintenance cleanup
}
```

**Task Template System:**
```prisma
model CleaningTaskTemplate {
  id              String   @id
  campgroundId    String
  taskType        CleaningTaskType
  accommodationType AccommodationType?  // null = applies to all

  name            String
  estimatedMinutes Int
  checklist       Json      // Structured checklist items
  suppliesNeeded  Json?     // Required supplies
  priority        Int       // Default priority

  // SLA
  slaMinutes      Int?      // Time to complete after creation

  // Staff requirements
  minStaffLevel   String?   // trainee, standard, senior
  requiresTwo     Boolean   // Two-person job
}
```

### 3.3 Staff Assignment and Workload Balancing

**Zone/Building Model:**
```prisma
model CleaningZone {
  id              String   @id
  campgroundId    String
  name            String            // "Building A Floor 2", "Lakeside Loop"
  zoneType        String            // building_floor, outdoor_loop, wing

  // Hierarchy
  parentZoneId    String?

  // Assignment
  primaryTeamId   String?           // Default assigned team

  // Geography
  boundaryGeoJson Json?             // For map visualization
}

model AccommodationZoneAssignment {
  accommodationId String
  zoneId          String

  @@id([accommodationId, zoneId])
}
```

**Workload Balancing Service:**
```typescript
interface WorkloadBalancer {
  // Calculate optimal task distribution
  distributeTasksForDay(
    date: Date,
    campgroundId: string,
    options: {
      respectZones: boolean;
      balanceByTime: boolean;    // vs by task count
      prioritizeSLAs: boolean;
    }
  ): Promise<TaskAssignment[]>;

  // Real-time rebalancing
  rebalanceAfterCompletion(
    completedTaskId: string
  ): Promise<void>;

  // Metrics
  getStaffWorkloadMetrics(
    date: Date,
    campgroundId: string
  ): Promise<StaffWorkloadReport>;
}
```

**Assignment Algorithm Factors:**
1. Staff availability (shift hours)
2. Zone assignment preferences
3. Travel time between units (for outdoor properties)
4. Task priority and SLA deadlines
5. Staff skill level vs task complexity
6. Historical performance (tasks/hour by accommodation type)

### 3.4 Scheduling Integration

**Checkout/Checkin Coordination:**
```prisma
model DailyHousekeepingSchedule {
  id              String   @id
  campgroundId    String
  date            DateTime @db.Date

  // Auto-generated from reservations
  expectedCheckouts     Json    // [{accommodationId, expectedTime, guestName}]
  expectedCheckins      Json    // [{accommodationId, arrivalWindow, isVIP}]

  // Prioritization
  priorityUnits         String[]  // Units needing earliest attention
  earlyArrivalUnits     String[]  // Confirmed early arrivals
  lateCheckoutUnits     String[]  // Approved late checkouts

  // Summary
  totalTurnovers        Int
  stayoverServices      Int
  deepCleans            Int

  generatedAt           DateTime
}
```

**Early Arrival Handling:**
```typescript
interface EarlyArrivalWorkflow {
  // Guest requests early arrival
  requestEarlyArrival(
    reservationId: string,
    requestedTime: string
  ): Promise<EarlyArrivalStatus>;

  // System checks room status
  // Returns: guaranteed, likely, unlikely, unavailable

  // If room is ready early, auto-notify guest
  onRoomReady(accommodationId: string): void;

  // Prioritize cleaning if confirmed early arrival
  prioritizeForEarlyArrival(reservationId: string): void;
}
```

### 3.5 Mobile-First Staff Interface

**Housekeeping Staff App Features:**

```
┌─────────────────────────────────────────┐
│  HOUSEKEEPING STAFF MOBILE APP          │
├─────────────────────────────────────────┤
│                                         │
│  📋 MY TASKS                            │
│  ├─ Today's Assignments (12)            │
│  ├─ Completed (5)                       │
│  └─ Priority Queue                      │
│                                         │
│  🔄 CURRENT TASK                        │
│  ├─ Unit: Cabin 14                      │
│  ├─ Type: Turnover Clean                │
│  ├─ Time: Started 2:34 PM               │
│  ├─ SLA: Due by 3:30 PM ⏱️              │
│  └─ [Checklist Progress: 8/12]          │
│                                         │
│  ☑️ CHECKLIST                           │
│  ├─ ☑ Strip beds                        │
│  ├─ ☑ Clean bathroom                    │
│  ├─ ☐ Vacuum floors                     │
│  ├─ ☐ Restock supplies                  │
│  └─ ☐ Final inspection                  │
│                                         │
│  📸 REPORT ISSUE                        │
│  ├─ [Take Photo]                        │
│  ├─ Issue Type: [Dropdown]              │
│  └─ [Submit to Maintenance]             │
│                                         │
│  ⏸️ PAUSE / ✓ COMPLETE                  │
│                                         │
└─────────────────────────────────────────┘
```

**API Surface for Mobile:**
```typescript
// Staff task endpoints
GET    /staff/me/tasks/today
GET    /staff/me/tasks/:id
PATCH  /staff/me/tasks/:id/status
PATCH  /staff/me/tasks/:id/checklist
POST   /staff/me/tasks/:id/issues
POST   /staff/me/tasks/:id/photos

// Real-time
WS     /staff/me/tasks/subscribe  // New task notifications
```

### 3.6 Inspection Checklists

**Configurable Checklist System:**
```prisma
model InspectionChecklist {
  id                String   @id
  campgroundId      String
  name              String
  accommodationType AccommodationType?
  taskType          CleaningTaskType?

  // Checklist structure
  sections          Json
  // [{
  //   name: "Bathroom",
  //   items: [
  //     {id: "1", text: "Toilet clean", type: "pass_fail"},
  //     {id: "2", text: "Towel count", type: "number", expected: 4},
  //     {id: "3", text: "Notes", type: "text"}
  //   ]
  // }]

  // Requirements
  minPassRate       Int?     // Percentage required to pass
  criticalItems     String[] // Item IDs that must pass

  isActive          Boolean
}
```

**Inspection Result:**
```prisma
model InspectionResult {
  id              String   @id
  taskId          String
  checklistId     String
  inspectorId     String

  // Results
  responses       Json     // Item responses
  overallResult   String   // passed, failed, partial
  score           Int?     // Percentage score

  // Follow-up
  failedItems     String[] // Item IDs that failed
  requiresReclean Boolean
  notes           String?
  photos          String[]

  completedAt     DateTime
}
```

### 3.7 Maintenance Issue Handoff

**Issue Discovery Workflow:**
```
Staff finds issue during cleaning
           │
           ▼
    ┌──────────────────┐
    │ Log Issue in App │
    │ - Category       │
    │ - Severity       │
    │ - Photo          │
    │ - Description    │
    └────────┬─────────┘
             │
             ▼
    ┌──────────────────┐
    │ Auto-Create      │
    │ MaintenanceTicket│
    └────────┬─────────┘
             │
    ┌────────┴────────┐
    │                 │
    ▼                 ▼
 Blocking?         Non-blocking
    │                 │
    ▼                 ▼
 Set unit to      Continue
 OUT_OF_ORDER     cleaning
    │                 │
    ▼                 ▼
 Notify manager   Notify maintenance
 + maintenance    for scheduling
```

**Schema Extension:**
```prisma
// Extend MaintenanceTicket
model MaintenanceTicket {
  // ... existing fields ...

  // Discovery context
  discoveredByTaskId    String?   // Linked cleaning task
  discoveredDuring      String?   // cleaning, inspection, guest_report

  // Urgency classification
  guestImpact           String?   // none, minor, major, safety
  requiresEvacuation    Boolean   @default(false)

  // Resolution
  roomReadyAfterFix     Boolean   @default(false)  // Skip re-clean?
}
```

### 3.8 Manager Dashboard

**Daily Board View:**
```
┌─────────────────────────────────────────────────────────────────────┐
│  HOUSEKEEPING DASHBOARD - December 20, 2024                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  SUMMARY                     │  STAFF ON DUTY                       │
│  ┌─────────┬─────────┐      │  ┌─────────────────────────────────┐ │
│  │ Total   │   42    │      │  │ Maria S.    ████████░░  8/10    │ │
│  │ Done    │   28    │      │  │ James K.    ██████░░░░  6/10    │ │
│  │ In Prog │    6    │      │  │ Lisa M.     ████░░░░░░  4/10    │ │
│  │ Pending │    8    │      │  │ Carlos R.   ██████████ 10/10    │ │
│  └─────────┴─────────┘      │  └─────────────────────────────────┘ │
│                                                                     │
│  SLA STATUS                                                         │
│  🟢 On Track: 35    🟡 At Risk: 5    🔴 Breached: 2                 │
│                                                                     │
│  PRIORITY UNITS (Arrivals < 2 hours)                               │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 🔴 Cabin 7    │ Turnover │ VIP Arrival 3:00 PM │ Unassigned │   │
│  │ 🟡 Room 204   │ Cleaning │ Arrival 3:30 PM     │ Maria S.   │   │
│  │ 🟢 Yurt 3     │ Inspecting│ Arrival 4:00 PM    │ James K.   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  BOTTLENECKS                                                        │
│  ⚠️ Building B Floor 3: 4 units pending, 0 staff assigned          │
│  ⚠️ Deep cleans behind schedule (2 of 5 complete)                  │
│                                                                     │
│  [Reassign Tasks]  [Add Staff]  [View Full Board]                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Productivity Metrics:**
```typescript
interface HousekeepingMetrics {
  // Per-staff metrics
  staffProductivity: {
    staffId: string;
    tasksCompleted: number;
    averageMinutesPerTask: number;
    byAccommodationType: Record<AccommodationType, {
      count: number;
      avgMinutes: number;
    }>;
    slaBreachRate: number;
    inspectionPassRate: number;
  }[];

  // Property-wide metrics
  dailyTurnovers: number;
  averageTurnoverTime: number;
  roomsReadyByCheckIn: number;  // % ready before arrival
  guestWaitInstances: number;   // Times guest waited for room

  // Trends
  weekOverWeekChange: {
    productivity: number;  // % change
    slaBreaches: number;
    guestWaits: number;
  };
}
```

---

## 4. Room Rental Operations Gaps

### 4.1 Current vs Required Capabilities

| Capability | Current State | Required for Hotels |
|------------|---------------|---------------------|
| Room blocking | `SiteHold` model exists | ✅ Adequate, extend for reasons |
| Out-of-order | `MaintenanceTicket.outOfOrder` | ✅ Adequate |
| Early check-in | Not implemented | ❌ Need pricing + workflow |
| Late checkout | Not implemented | ❌ Need pricing + workflow |
| Room moves | Not implemented | ❌ Need mid-stay transfer flow |
| Multi-room booking | Separate reservations | ❌ Need linked group booking |
| Room preferences | Not implemented | ❌ Need preference matching |
| Walk-in handling | Basic booking | ⚠️ Needs optimization UI |
| Key/access codes | `SmartLock` + `AccessGrant` | ✅ Foundation exists |

### 4.2 Room Blocking and Out-of-Order Management

**Enhanced Hold System:**
```prisma
model AccommodationHold {
  id              String   @id
  campgroundId    String
  accommodationId String

  // Date range
  startDate       DateTime
  endDate         DateTime

  // Hold type
  holdType        HoldType
  // temporary_hold (expires)
  // maintenance (linked to ticket)
  // group_block (linked to group)
  // owner_use (owner block)
  // seasonal_closure
  // renovation

  // Context
  maintenanceTicketId String?
  groupBookingId      String?
  note                String?

  // Expiration (for temporary holds)
  expiresAt       DateTime?

  // Audit
  createdById     String
  createdAt       DateTime
  releasedAt      DateTime?
  releasedById    String?
  releaseReason   String?
}
```

### 4.3 Early Check-in / Late Checkout

**Pricing Configuration:**
```prisma
model FlexCheckPolicy {
  id              String   @id
  campgroundId    String

  // Early check-in
  earlyCheckInEnabled     Boolean
  earlyCheckInMinHours    Int?      // How early allowed
  earlyCheckInPricing     Json      // {type: "flat", amount: 2500} or {type: "hourly", amount: 1000}
  earlyCheckInAutoApprove Boolean   // Or require staff approval

  // Late checkout
  lateCheckoutEnabled     Boolean
  lateCheckoutMaxHours    Int?      // How late allowed
  lateCheckoutPricing     Json
  lateCheckoutAutoApprove Boolean

  // VIP override
  vipEarlyFree            Boolean   // VIPs get free early check-in
  vipLateFree             Boolean
}
```

**Workflow:**
```typescript
interface FlexCheckService {
  // Guest requests early check-in
  requestEarlyCheckIn(
    reservationId: string,
    requestedTime: string
  ): Promise<{
    status: 'approved' | 'pending' | 'unavailable';
    additionalCharge?: number;
    roomReadyTime?: string;
  }>;

  // Staff approval flow
  approveEarlyCheckIn(reservationId: string, approvedTime: string): Promise<void>;

  // Automatic room-ready detection
  onRoomReady(accommodationId: string): Promise<void>;
  // Checks if pending early arrivals can be notified

  // Late checkout
  requestLateCheckout(
    reservationId: string,
    requestedTime: string
  ): Promise<{
    status: 'approved' | 'pending' | 'unavailable';
    additionalCharge?: number;
    conflictingArrival?: string;  // Next guest arrival time
  }>;
}
```

### 4.4 Room Moves and Upgrades Mid-Stay

**Room Move Workflow:**
```prisma
model RoomMoveRequest {
  id                String   @id
  reservationId     String

  // Units
  fromAccommodationId String
  toAccommodationId   String

  // Timing
  moveDate            DateTime
  requestedAt         DateTime
  completedAt         DateTime?

  // Reason
  moveReason          String    // guest_request, maintenance, upgrade, downgrade
  isComplimentary     Boolean
  priceDifference     Int?      // Positive = guest pays, negative = refund

  // Status
  status              String    // requested, approved, in_progress, completed, cancelled

  // Logistics
  luggageAssistance   Boolean
  newKeysIssued       Boolean

  // Audit
  requestedById       String
  approvedById        String?
  completedById       String?
  notes               String?
}
```

**Upgrade Logic:**
```typescript
interface RoomMoveService {
  // Find available upgrades
  getAvailableUpgrades(
    reservationId: string
  ): Promise<{
    accommodation: Accommodation;
    upgradeType: 'same_class' | 'better_class' | 'premium';
    priceDifference: number;
    features: string[];  // What they gain
  }[]>;

  // Execute move
  executeRoomMove(
    moveRequestId: string,
    options: {
      transferAccessCodes: boolean;
      createCleaningTask: boolean;  // For vacated room
      notifyGuest: boolean;
    }
  ): Promise<void>;
}
```

### 4.5 Multi-Room Bookings

**Group Booking Model:**
```prisma
model GroupBooking {
  id              String   @id
  campgroundId    String

  // Group info
  groupName       String
  primaryGuestId  String
  groupType       String    // family, corporate, wedding, reunion

  // Rooms
  reservations    Reservation[]
  roomCount       Int

  // Preferences
  preferAdjacent      Boolean
  preferSameFloor     Boolean
  preferConnecting    Boolean
  preferredBuilding   String?
  preferredFloor      Int?

  // Assignment
  assignmentStatus    String   // pending, partial, complete
  assignmentNotes     String?

  // Billing
  billingType         String   // individual, master_folio, split
  masterFolioId       String?

  // Coordination
  groupArrivalTime    String?
  groupDepartureTime  String?
  welcomeAmenity      String?

  createdAt           DateTime
}
```

**Room Assignment Optimization:**
```typescript
interface GroupAssignmentService {
  // Auto-assign rooms based on preferences
  optimizeGroupAssignment(
    groupBookingId: string
  ): Promise<{
    assignments: { reservationId: string; accommodationId: string }[];
    preferencesMetScore: number;  // 0-100
    unmetPreferences: string[];
  }>;

  // Manual override
  reassignGroupRoom(
    groupBookingId: string,
    reservationId: string,
    newAccommodationId: string
  ): Promise<void>;

  // Check availability for adjacent rooms
  findAdjacentAvailability(
    campgroundId: string,
    arrivalDate: Date,
    departureDate: Date,
    roomCount: number
  ): Promise<AdjacentRoomSet[]>;
}
```

### 4.6 Walk-in Reservations

**Walk-in Optimization UI:**
```typescript
interface WalkInService {
  // Get optimal room suggestions
  getWalkInSuggestions(
    campgroundId: string,
    guestCount: number,
    nights: number,
    preferences?: {
      maxPrice?: number;
      accommodationType?: AccommodationType;
      accessible?: boolean;
    }
  ): Promise<{
    recommendations: {
      accommodation: Accommodation;
      reason: string;  // "Best value", "Ready now", "Premium upgrade"
      price: number;
      readyStatus: HousekeepingStatus;
      readyIn?: number;  // Minutes until ready
    }[];

    soldOut: boolean;
    waitlistAvailable: boolean;
  }>;

  // Quick booking
  createWalkInReservation(
    accommodationId: string,
    guestInfo: GuestInfo,
    paymentMethod: string
  ): Promise<Reservation>;
}
```

### 4.7 Key/Access Code Management

**Current State:** `SmartLock` and `AccessGrant` models exist.

**Extensions Needed:**
```prisma
model AccessCodePolicy {
  id              String   @id
  campgroundId    String

  // Code generation
  codeFormat      String   // numeric_4, numeric_6, alphanumeric
  codeRotation    String   // per_reservation, daily, weekly

  // Timing
  codeValidFrom   String   // relative to check-in, e.g., "-2h"
  codeValidUntil  String   // relative to checkout, e.g., "+2h"

  // Delivery
  deliveryMethod  String[] // email, sms, app_push
  deliveryTiming  String   // immediately, day_before, on_checkin

  // Integration
  lockVendor      String
  lockApiConfig   Json     // Encrypted vendor credentials
}

// Extend AccessGrant
model AccessGrant {
  // ... existing fields ...

  // Code details
  accessCode      String?   // The actual code (encrypted)
  codeDeliveredAt DateTime?
  codeDeliveryMethod String?

  // Mobile key
  mobileKeyToken  String?
  mobileKeyActivatedAt DateTime?

  // Physical key
  physicalKeyNumber String?
  physicalKeyIssuedAt DateTime?
  physicalKeyReturnedAt DateTime?
}
```

---

## 5. Architecture Recommendations

### 5.1 Schema Changes Summary

**New Tables:**
| Table | Purpose |
|-------|---------|
| `Accommodation` | Replace/extend Site with universal attributes |
| `RvSiteAttributes` | RV-specific extension |
| `StructureAttributes` | Cabin/room extension |
| `HotelRoomAttributes` | Hotel-specific extension |
| `AccommodationClass` | Category templates (evolve from SiteClass) |
| `CleaningZone` | Geographic grouping for assignments |
| `CleaningTaskTemplate` | Configurable task definitions |
| `InspectionChecklist` | Configurable checklists |
| `InspectionResult` | Inspection outcomes |
| `DailyHousekeepingSchedule` | Pre-computed daily workload |
| `FlexCheckPolicy` | Early/late check configuration |
| `RoomMoveRequest` | Mid-stay room changes |
| `GroupBooking` | Multi-room coordination |
| `AccessCodePolicy` | Key/code generation rules |

**Enum Extensions:**
- `AccommodationType` - Expanded from SiteType
- `HousekeepingStatus` - Full state machine
- `CleaningTaskType` - Task categorization
- `HoldType` - Reasons for blocking

**Field Additions:**
- `Reservation.groupBookingId` - Link to group
- `Reservation.earlyCheckInApproved/lateCheckoutApproved`
- `MaintenanceTicket.discoveredByTaskId`
- `Task` - Enhanced checklist and photo fields

### 5.2 New Services/Modules

```
platform/apps/api/src/
├── accommodations/           # NEW - Core accommodation management
│   ├── accommodations.module.ts
│   ├── accommodations.service.ts
│   ├── accommodations.controller.ts
│   └── dto/
│       ├── create-accommodation.dto.ts
│       └── accommodation-search.dto.ts
│
├── housekeeping/             # NEW - Dedicated housekeeping module
│   ├── housekeeping.module.ts
│   ├── housekeeping.service.ts
│   ├── housekeeping.controller.ts
│   ├── workload-balancer.service.ts
│   ├── inspection.service.ts
│   └── daily-schedule.service.ts
│
├── flex-check/               # NEW - Early/late check handling
│   ├── flex-check.module.ts
│   ├── flex-check.service.ts
│   └── flex-check.controller.ts
│
├── room-moves/               # NEW - Mid-stay room changes
│   ├── room-moves.module.ts
│   ├── room-moves.service.ts
│   └── room-moves.controller.ts
│
├── group-bookings/           # NEW - Multi-room coordination
│   ├── group-bookings.module.ts
│   ├── group-bookings.service.ts
│   ├── room-assignment.service.ts
│   └── group-bookings.controller.ts
│
└── access-codes/             # EXTEND - Key/code management
    ├── code-generator.service.ts
    └── code-delivery.service.ts
```

### 5.3 Modifications to Existing Services

**ReservationsService:**
- Add `groupBookingId` handling
- Integrate flex-check validation
- Support room move reservations
- Enhanced availability for hotel room attributes

**AvailabilityEngine:**
- Extend search filters for bed configuration
- Add room feature filtering
- Support adjacent/connecting room searches
- Priority scoring for walk-ins

**TasksService:**
- Integrate with CleaningTaskTemplate
- Enhanced checklist validation
- Photo upload handling
- Inspection result processing

### 5.4 API Surface for Staff Mobile Apps

**Core Endpoints:**
```typescript
// Authentication
POST   /auth/staff/login          // Staff-specific login (PIN option)

// My Tasks
GET    /staff/me/tasks            // All my assigned tasks
GET    /staff/me/tasks/today      // Today's tasks
GET    /staff/me/tasks/:id        // Task detail
PATCH  /staff/me/tasks/:id/status // Update status
PATCH  /staff/me/tasks/:id/checklist  // Update checklist items
POST   /staff/me/tasks/:id/photos // Upload task photos
POST   /staff/me/tasks/:id/issues // Report maintenance issue

// Time Clock
POST   /staff/me/clock-in
POST   /staff/me/clock-out
GET    /staff/me/time-entries

// Real-time (WebSocket)
WS     /staff/me/subscribe        // Task assignments, updates
```

**Mobile App Requirements:**
- Offline capability for checklist completion
- Photo compression before upload
- Push notification integration
- Barcode/QR scanning for unit identification

### 5.5 Real-Time Update Requirements

**Events to Broadcast:**

| Event | Channel | Consumers |
|-------|---------|-----------|
| `room.status.changed` | `housekeeping:{campgroundId}` | Dashboard, staff app |
| `task.assigned` | `staff:{userId}` | Staff mobile app |
| `task.sla.warning` | `housekeeping:{campgroundId}` | Dashboard, manager |
| `room.ready` | `reservations:{reservationId}` | Guest notification |
| `early.arrival.requested` | `front-desk:{campgroundId}` | Front desk staff |
| `maintenance.issue.created` | `maintenance:{campgroundId}` | Maintenance team |

**Implementation:**
- WebSocket gateway using Socket.IO
- Redis pub/sub for multi-instance distribution
- Event-driven architecture with NestJS EventEmitter

---

## 6. Implementation Phasing

### Phase 1: Foundation (4-6 weeks)

**Goal:** Establish accommodation model and basic hotel room support without breaking existing functionality.

**Deliverables:**
1. **Schema Migration**
   - Add `AccommodationType` enum
   - Create attribute extension tables
   - Migrate existing Sites to new structure (backward compatible)

2. **Accommodation Service**
   - CRUD for accommodations with type-specific attributes
   - Filtering by accommodation type and features
   - Admin UI for managing accommodations

3. **Enhanced Housekeeping Status**
   - Implement full status state machine
   - Add status transition validation
   - Update housekeeping dashboard

**Dependencies:** None - can run in parallel with existing features

**Risk:** Migration of existing Site data. Mitigation: Create parallel structure, run both during transition.

### Phase 2: Hotel Cleaning Operations (4-6 weeks)

**Goal:** Full housekeeping management for hotel-style operations.

**Deliverables:**
1. **Task Templates & Checklists**
   - Configurable cleaning task templates
   - Inspection checklists by accommodation type
   - Admin UI for template management

2. **Workload Management**
   - Zone/building assignment
   - Workload balancing algorithm
   - Daily schedule generation

3. **Staff Mobile Interface**
   - Task list view
   - Checklist completion
   - Photo upload for issues
   - Maintenance handoff workflow

4. **Manager Dashboard**
   - Daily board view
   - SLA monitoring
   - Staff productivity metrics

**Dependencies:** Phase 1 complete

### Phase 3: Room Operations (3-4 weeks)

**Goal:** Hotel-level room operations features.

**Deliverables:**
1. **Early Check-in / Late Checkout**
   - Policy configuration
   - Request workflow
   - Pricing integration
   - Auto-notification on room ready

2. **Room Moves & Upgrades**
   - Move request workflow
   - Upgrade suggestions
   - Key transfer handling
   - Billing adjustments

3. **Enhanced Blocking**
   - Reason-coded holds
   - Maintenance integration
   - Calendar visualization

**Dependencies:** Phase 1 complete. Can run parallel to Phase 2.

### Phase 4: Group Bookings (3-4 weeks)

**Goal:** Multi-room booking coordination.

**Deliverables:**
1. **Group Booking Model**
   - Create group with room count
   - Link multiple reservations
   - Preference capture

2. **Room Assignment Optimization**
   - Adjacent room detection
   - Floor/building grouping
   - Connecting room support

3. **Group Management UI**
   - Group overview
   - Room assignment interface
   - Billing split options

**Dependencies:** Phase 1 complete. Can run parallel to Phase 2/3.

### Phase 5: Access Control Integration (2-3 weeks)

**Goal:** Automated key/code management.

**Deliverables:**
1. **Code Generation Policies**
   - Per-property configuration
   - Multiple format support
   - Rotation rules

2. **Automated Delivery**
   - Pre-arrival code sending
   - Multi-channel delivery
   - Mobile key activation

3. **Physical Key Tracking**
   - Issuance logging
   - Return tracking
   - Lost key handling

**Dependencies:** Phase 3 (flex-check integration)

### Phase 6: Analytics & Reporting (2-3 weeks)

**Goal:** Operational intelligence.

**Deliverables:**
1. **Housekeeping Analytics**
   - Staff productivity dashboards
   - Cleaning time trends
   - SLA performance

2. **Room Operations Reports**
   - Early/late check usage
   - Upgrade conversion rates
   - Occupancy by accommodation type

3. **Forecasting**
   - Staffing needs prediction
   - Supply usage forecasting

**Dependencies:** All previous phases (uses accumulated data)

---

## 7. Architectural Decisions Requiring Input

### Decision 1: Accommodation Model Strategy

**Options:**
1. **Extend Site Model** - Add fields to existing Site, use discriminator pattern
2. **New Accommodation Model** - Parallel model with migration path
3. **Rename and Extend** - Rename Site → Accommodation, extend in place

**Recommendation:** Option 2 (New Accommodation Model) for cleaner separation

**Trade-offs:**
- Option 1: Less migration risk, but cluttered model
- Option 2: Clean model, more migration work
- Option 3: Moderate approach, but breaking changes

**Need Decision On:** Which approach aligns with team preferences and risk tolerance?

### Decision 2: Mobile App Technology

**Options:**
1. **Progressive Web App (PWA)** - Single codebase, works offline
2. **React Native** - Native feel, existing Expo setup in project
3. **Native iOS/Android** - Best performance, highest cost

**Recommendation:** PWA for Phase 2, evaluate native if needed

**Need Decision On:** Staff device requirements (iOS only? Android? BYOD?)

### Decision 3: Real-Time Infrastructure

**Options:**
1. **Socket.IO with Redis** - Mature, well-supported
2. **Server-Sent Events (SSE)** - Simpler, one-directional
3. **Firebase/Pusher** - Managed service, less control

**Recommendation:** Socket.IO with Redis (already have Redis for caching)

**Need Decision On:** Infrastructure constraints? Preference for managed services?

### Decision 4: Housekeeping Scheduling Algorithm

**Options:**
1. **Simple Round-Robin** - Even distribution, no optimization
2. **Zone-Based Priority** - Assign by building/area
3. **Constraint-Based Optimization** - Consider SLAs, travel time, skills
4. **ML-Based Prediction** - Learn from historical patterns

**Recommendation:** Start with Zone-Based Priority (Option 2), add constraints (Option 3) in Phase 2

**Need Decision On:** How sophisticated should initial version be?

### Decision 5: Backward Compatibility Period

**Options:**
1. **Hard Cutover** - All properties migrate at once
2. **Feature Flags** - New features opt-in per property
3. **Parallel Systems** - Run old and new during transition

**Recommendation:** Feature Flags per campground

**Need Decision On:** Timeline for deprecating Site model? Properties grandfathered?

---

## Appendix A: File Reference Summary

**Core Schema:**
- `/platform/apps/api/prisma/schema.prisma`

**Existing Services to Modify:**
- `/platform/apps/api/src/reservations/reservations.service.ts`
- `/platform/apps/api/src/tasks/tasks.service.ts`
- `/platform/apps/api/src/sites/sites.service.ts`
- `/platform/apps/api/src/maintenance/maintenance.service.ts`

**Existing UI to Extend:**
- `/platform/apps/web/app/campgrounds/[campgroundId]/housekeeping/page.tsx`
- `/platform/apps/web/app/booking-lab/page.tsx`
- `/platform/apps/web/app/booking/v2/page.tsx`

**Documentation:**
- `/platform/docs/` - API documentation
- `/AGENTS.md` - Agent guidelines

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| Accommodation | Generic term for any bookable unit (site, room, cabin) |
| Turnover | Cleaning process between guest stays |
| Stayover | Cleaning service during guest's stay |
| DND | Do Not Disturb status |
| OOO | Out of Order (maintenance issue) |
| OOI | Out of Inventory (offline/seasonal) |
| SLA | Service Level Agreement (time target) |
| Zone | Geographic grouping of accommodations |
| Flex-check | Early check-in or late checkout |
| Group Booking | Multiple linked reservations |
| Master Folio | Central bill for group bookings |

---

*Document prepared for Campreserv hotel operations expansion project.*
