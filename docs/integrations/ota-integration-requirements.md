# OTA Integration Requirements

## Overview

Online Travel Agencies (OTAs) represent a significant distribution channel for campgrounds. This document outlines the technical and business requirements for integrating with major OTA platforms.

---

## Priority OTA Platforms

### Tier 1: High Priority

| Platform                 | Type                | Market Share | Integration Method |
| ------------------------ | ------------------- | ------------ | ------------------ |
| **RoverPass**            | Campground OTA      | Growing      | API (REST)         |
| **Hipcamp**              | Alternative camping | Significant  | API + iCal         |
| **Campspot Marketplace** | Campground OTA      | Large        | Proprietary        |
| **Harvest Hosts**        | Membership          | Niche        | Manual/API         |

### Tier 2: Medium Priority

| Platform                | Type              | Market Share             | Integration Method |
| ----------------------- | ----------------- | ------------------------ | ------------------ |
| **Booking.com**         | General OTA       | Huge (exploring camping) | Channel Manager    |
| **Airbnb**              | Short-term rental | Large (glamping)         | API                |
| **Google Things to Do** | Discovery         | Growing                  | Feed               |
| **Tripadvisor**         | Reviews + Booking | Medium                   | API                |

### Tier 3: Future Consideration

| Platform      | Type                | Notes                 |
| ------------- | ------------------- | --------------------- |
| **Expedia**   | General OTA         | Exploring outdoor     |
| **VRBO**      | Vacation rental     | Cabin/glamping focus  |
| **Outdoorsy** | RV rental + camping | Partnership potential |
| **The Dyrt**  | Discovery + booking | Growing platform      |

---

## Technical Requirements

### Core Integration Capabilities

#### 1. Availability Sync (Required for all)

**Outbound (Push to OTA):**

- Real-time availability updates
- Support for date ranges
- Site-type level granularity
- Rate updates

**Inbound (Receive from OTA):**

- Booking notifications
- Modification requests
- Cancellation notifications

**Sync Methods:**

- REST API (preferred)
- Webhook notifications
- iCal feed (basic)
- Channel manager (aggregated)

#### 2. Rate Management

**Required Capabilities:**

- Base rate sync
- Date-specific rates
- Minimum stay requirements
- Closed-to-arrival dates
- Rate plans/packages

**Nice-to-Have:**

- Dynamic rate rules
- Last-minute discounts
- Length-of-stay pricing
- Seasonal rate groups

#### 3. Booking Management

**Required Data Exchange:**

```typescript
interface OTABooking {
  // Booking identifiers
  otaBookingId: string;
  otaPlatform: string;

  // Guest information
  guest: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };

  // Stay details
  checkIn: Date;
  checkOut: Date;
  siteType: string; // Mapped to our site classes
  numberOfGuests: number;

  // Pricing
  totalAmount: number;
  currency: string;
  commission?: number;

  // Status
  status: "pending" | "confirmed" | "cancelled" | "modified";

  // Metadata
  guestNotes?: string;
  specialRequests?: string;
}
```

#### 4. Content Sync

**Property Information:**

- Name and description
- Location (coordinates, address)
- Amenities list
- Policies (check-in/out, cancellation)
- Photos

**Site/Unit Information:**

- Site types/categories
- Capacity limits
- Amenities per site type
- Photos per site type

---

## Platform-Specific Requirements

### RoverPass Integration

**API Documentation:** Partner API access required

**Endpoints Needed:**

- Property listing management
- Availability calendar
- Rate management
- Booking webhook
- Booking confirmation

**Data Requirements:**

- Property ID mapping
- Site type mapping to RoverPass categories
- Commission structure (typically 15-20%)

**Technical Notes:**

- REST API
- OAuth 2.0 authentication
- Webhook for booking notifications
- Daily availability sync recommended

---

### Hipcamp Integration

**API Documentation:** Request partnership access

**Integration Options:**

1. **iCal Sync** (Basic)
   - One-way availability block
   - Manual booking entry required
   - Good for testing

2. **API Integration** (Full)
   - Two-way sync
   - Automatic booking import
   - Rate management

**Commission:** 10-15% typically

**Unique Requirements:**

- Eco-friendly focus in listings
- Host verification process
- Photo quality standards

---

### Booking.com Integration

**Channel Manager Required:**

- Direct API access restricted to channel managers
- Consider: Cloudbeds, SiteMinder, or similar

**Data Requirements:**

- Property registration
- Rate plans
- Room types (mapped to site classes)
- Policies

**Commission:** 15-18% typically

**Certification Process:**

- Technical integration test
- Content review
- Booking flow testing

---

### Airbnb Integration

**Use Case:** Primarily for cabins and glamping units

**API Access:** Apply for Professional Hosting API

**Integration Components:**

- Listings management
- Calendar sync
- Pricing sync
- Messaging
- Booking management

**Commission:** 3% host fee + guest fee

**Requirements:**

- High-quality photos
- Response time requirements
- Cancellation policy compliance

---

### Google Things to Do

**Integration Method:** Structured data feed

**Feed Format:**

```json
{
  "@context": "https://schema.org",
  "@type": "LodgingBusiness",
  "name": "Park Name",
  "address": {...},
  "aggregateRating": {...},
  "amenityFeature": [...],
  "availabilityStarts": "...",
  "priceRange": "$$"
}
```

**Requirements:**

- Schema.org structured data
- Google Business Profile
- Review integration
- Booking action button

---

## Channel Manager Architecture

### Why Channel Manager?

Direct integration with each OTA requires:

- Individual API implementations
- Separate rate management
- Multiple booking reconciliation
- Per-platform maintenance

Channel manager provides:

- Single integration point
- Unified rate/availability management
- Aggregated booking inbox
- Reduced development effort

### Recommended Approach

**Phase 1: Direct Integration**

- RoverPass (campground-specific)
- Hipcamp (alternative camping)
- Google structured data

**Phase 2: Channel Manager**

- Evaluate SiteMinder, Cloudbeds, or STAAH
- Add Booking.com, Airbnb through channel manager
- Unified dashboard for all channels

---

## Database Schema Additions

### OTA Configuration

```prisma
model OTAConnection {
  id           String   @id @default(cuid())
  campgroundId String
  platform     OTAPlatform
  apiKey       String?  @db.Text
  apiSecret    String?  @db.Text
  propertyId   String?  // External property ID on OTA
  isActive     Boolean  @default(true)
  syncEnabled  Boolean  @default(true)
  lastSyncAt   DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  campground   Campground @relation(fields: [campgroundId], references: [id])
  bookings     OTABooking[]

  @@unique([campgroundId, platform])
}

enum OTAPlatform {
  ROVERPASS
  HIPCAMP
  BOOKING_COM
  AIRBNB
  GOOGLE
  TRIPADVISOR
  OTHER
}

model OTABooking {
  id               String   @id @default(cuid())
  connectionId     String
  externalId       String   // OTA's booking ID
  reservationId    String?  // Our reservation ID (once imported)

  guestName        String
  guestEmail       String
  guestPhone       String?

  checkIn          DateTime
  checkOut         DateTime
  siteTypeName     String
  guests           Int

  totalAmount      Int      // In cents
  commission       Int      // In cents
  currency         String   @default("USD")

  status           OTABookingStatus
  syncStatus       SyncStatus
  rawData          Json?    // Original OTA response

  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  connection       OTAConnection @relation(fields: [connectionId], references: [id])
  reservation      Reservation?  @relation(fields: [reservationId], references: [id])

  @@unique([connectionId, externalId])
}

enum OTABookingStatus {
  PENDING
  CONFIRMED
  CANCELLED
  MODIFIED
  COMPLETED
}

enum SyncStatus {
  PENDING
  SYNCED
  FAILED
  MANUAL_REQUIRED
}

model OTASiteMapping {
  id              String   @id @default(cuid())
  connectionId    String
  siteClassId     String
  externalTypeId  String   // OTA's room/site type ID
  externalName    String   // OTA's room/site type name

  connection      OTAConnection @relation(fields: [connectionId], references: [id])
  siteClass       SiteClass     @relation(fields: [siteClassId], references: [id])

  @@unique([connectionId, siteClassId])
}
```

---

## API Service Design

### OTA Service Interface

```typescript
interface OTAProvider {
  platform: OTAPlatform;

  // Connection management
  validateCredentials(credentials: OTACredentials): Promise<boolean>;
  getPropertyInfo(): Promise<OTAProperty>;

  // Availability
  pushAvailability(availability: AvailabilityUpdate[]): Promise<void>;
  getAvailability(dateRange: DateRange): Promise<OTAAvailability[]>;

  // Rates
  pushRates(rates: RateUpdate[]): Promise<void>;
  getRates(dateRange: DateRange): Promise<OTARates[]>;

  // Bookings
  getNewBookings(): Promise<OTABooking[]>;
  confirmBooking(bookingId: string): Promise<void>;
  cancelBooking(bookingId: string, reason?: string): Promise<void>;

  // Webhooks
  handleWebhook(payload: unknown): Promise<WebhookResult>;
}
```

### Sync Service

```typescript
class OTASyncService {
  // Scheduled sync (every 15 minutes)
  async syncAllConnections(): Promise<void>;

  // Manual sync trigger
  async syncConnection(connectionId: string): Promise<SyncResult>;

  // Real-time updates
  async pushAvailabilityChange(
    campgroundId: string,
    siteClassId: string,
    dates: Date[],
  ): Promise<void>;

  // Booking import
  async importOTABooking(otaBooking: OTABooking): Promise<Reservation>;

  // Conflict resolution
  async resolveDoubleBooking(
    otaBooking: OTABooking,
    existingReservation: Reservation,
  ): Promise<ConflictResolution>;
}
```

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4)

- [ ] Database schema for OTA connections
- [ ] OTA provider interface design
- [ ] iCal export endpoint (universal fallback)
- [ ] Webhook receiver infrastructure
- [ ] Admin UI for OTA settings

### Phase 2: RoverPass (Weeks 5-8)

- [ ] RoverPass API client implementation
- [ ] Availability push service
- [ ] Booking webhook handler
- [ ] Site type mapping interface
- [ ] Rate sync service
- [ ] Testing with sandbox environment
- [ ] Production launch

### Phase 3: Hipcamp (Weeks 9-12)

- [ ] Hipcamp API client (if available)
- [ ] iCal sync as fallback
- [ ] Booking import workflow
- [ ] Content sync for listings
- [ ] Testing and launch

### Phase 4: Channel Manager Evaluation (Weeks 13-16)

- [ ] Evaluate channel manager options
- [ ] POC with selected provider
- [ ] Integration architecture
- [ ] Cost-benefit analysis
- [ ] Decision and planning

---

## Business Considerations

### Commission Handling

**Options:**

1. **Pass-through** - Show commission separately, guest pays
2. **Absorbed** - Park absorbs commission as marketing cost
3. **Markup** - OTA rate higher to cover commission

**Recommendation:** Configuration per OTA connection

### Rate Parity

Many OTAs require rate parity (same price on all channels):

- Monitor for violations
- Consider OTA-specific rate adjustments
- Document any rate differences

### Inventory Allocation

**Strategies:**

1. **Full sync** - All inventory on all channels (overbooking risk)
2. **Allocated** - X sites per channel (underutilization risk)
3. **Dynamic** - Adjust based on demand (complex)

**Recommendation:** Start with allocated, move to dynamic

### Cancellation Policies

OTA policies may differ from direct booking:

- Map OTA cancellation rules
- Handle refunds per channel
- Track cancellation patterns by channel

---

## Success Metrics

| Metric              | Target       | Tracking   |
| ------------------- | ------------ | ---------- |
| OTA booking volume  | 20% of total | Database   |
| Sync reliability    | 99.5% uptime | Monitoring |
| Booking import time | <5 minutes   | Logs       |
| Double booking rate | <0.1%        | Alerts     |
| Revenue from OTA    | Track        | Reports    |
| Commission cost     | Track        | Reports    |

---

## Risk Mitigation

### Double Booking Prevention

- Lock inventory during import
- Real-time availability check
- Automatic overbooking alerts
- Manual resolution workflow

### Data Integrity

- Idempotent booking imports
- External ID tracking
- Audit trail for all changes
- Daily reconciliation reports

### API Reliability

- Retry logic with backoff
- Circuit breaker pattern
- Fallback to iCal if API fails
- Health monitoring and alerts
