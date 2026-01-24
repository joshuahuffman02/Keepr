# Shared Types Documentation

This package contains Zod schemas and TypeScript types shared between API and Web.

## Core Domain Models

### Organization Hierarchy

```
Organization (multi-tenant root)
  └── Campground (individual property)
       ├── SiteClass (category of sites)
       │    └── Site (bookable unit)
       ├── Guest (customer record)
       ├── Reservation (booking)
       └── Payment / LedgerEntry (financials)
```

### Key Schemas

| Schema               | Description                                |
| -------------------- | ------------------------------------------ |
| `OrganizationSchema` | Multi-tenant root with billing info        |
| `CampgroundSchema`   | Property with location, branding, settings |
| `SiteClassSchema`    | Site category (RV, Tent, Cabin, etc.)      |
| `SiteSchema`         | Individual bookable unit                   |
| `GuestSchema`        | Customer with contact info & preferences   |
| `ReservationSchema`  | Booking with dates, pricing, status        |
| `PaymentSchema`      | Payment transaction                        |
| `LedgerEntrySchema`  | Accounting entry                           |

## Reservation Status Flow

```
pending → confirmed → checked_in → checked_out
    ↓
cancelled
```

## Site Types

- `rv` - RV/Trailer sites
- `tent` - Tent camping
- `cabin` - Cabins/cottages
- `group` - Group camping areas
- `glamping` - Glamping (yurts, treehouses, etc.)
- `hotel_room` - Standard hotel rooms
- `suite` - Hotel suites
- `lodge_room` - Lodge accommodations
- `boat_slip` - Marina slips

## Money Handling

**All monetary values are stored in cents (integers)**

```typescript
// Correct
const price = 9999; // $99.99

// Wrong
const price = 99.99; // Floating point issues!
```

Use `@keepr/shared` format utilities for display:

```typescript
import { formatCents } from "@keepr/shared";
formatCents(9999); // "$99.99"
```

## Deposit Configuration

Deposits use a tiered system based on booking value and timing:

```typescript
interface DepositConfig {
  tiers: DepositTier[]; // Amount-based tiers
  seasons: DepositSeason[]; // Seasonal overrides
  schedule: DepositScheduleEntry[]; // Payment schedule
}
```

## User Roles

| Role          | Description            |
| ------------- | ---------------------- |
| `owner`       | Full access, org-level |
| `manager`     | Full campground access |
| `front_desk`  | Reservations, guests   |
| `maintenance` | Maintenance tickets    |
| `finance`     | Reports, payments      |
| `marketing`   | Campaigns, reviews     |
| `readonly`    | View only              |

## Validation Patterns

### Creating Records

Use `Create*Schema` variants which omit auto-generated fields:

```typescript
import { CreateReservationSchema, CreateGuestSchema } from "@keepr/shared";

// These omit: id, createdAt, updatedAt
const validGuest = CreateGuestSchema.parse(input);
```

### Partial Updates

Use `.partial()` for patch operations:

```typescript
const UpdateGuestSchema = GuestSchema.partial();
```

## Common Fields

### Timestamps

- `createdAt` - ISO 8601 string
- `updatedAt` - ISO 8601 string

### IDs

- All IDs use CUID format
- Validated with `z.string().cuid()`

### Nullable vs Optional

- `nullish()` - can be null, undefined, or omitted
- `optional()` - can be undefined or omitted
- `nullable()` - can be null but not omitted

## Usage Examples

```typescript
import {
  ReservationSchema,
  CreateReservationSchema,
  type Reservation,
  type CreateReservationDto,
} from "@keepr/shared";

// Validate API response
const reservation = ReservationSchema.parse(apiResponse);

// Validate form input
const createDto = CreateReservationSchema.parse(formData);

// Type for component props
function ReservationCard({ reservation }: { reservation: Reservation }) {}
```
