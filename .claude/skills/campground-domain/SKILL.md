---
name: campground-domain
description: Campground and RV park management domain knowledge. Use when working on reservation logic, site management, pricing rules, or understanding campground-specific business requirements.
allowed-tools: Read, Glob, Grep
---

# Campground Domain Knowledge

## Core Concepts

### Sites
A camping **Site** is a rentable location where guests stay. Sites belong to a **Site Class** (category).

**Site Types**:
- **RV Sites**: Full hookup, partial hookup, dry camping
- **Tent Sites**: Primitive, platform, glamping
- **Cabins**: Rustic, modern, luxury
- **Unique**: Yurts, treehouses, airstreams

**Site Attributes**:
- Max RV length
- Hookups (water, electric, sewer)
- Amp service (30/50)
- Pull-through vs back-in
- Waterfront, shaded, pet-friendly

### Reservations

**Reservation Lifecycle**:
```
Quote → Pending → Confirmed → Checked-In → Checked-Out
                    ↓
                Cancelled
```

**Key Fields**:
- `arrivalDate` / `departureDate`
- `site` or `siteClass` (specific vs floating)
- `guest` - Primary contact
- `occupants` - Adults, children, pets
- `rig` - RV type and length (if applicable)
- `totalAmount` / `paidAmount` / `balance`

### Guests
Guests are customers who make reservations.

**Guest Record**:
- Contact info (name, email, phone)
- Address
- Rig information (saved for RV parks)
- Membership status
- Reservation history
- Communication preferences

## Pricing Model

### Base Rate Structure
```
Daily Rate × Nights = Subtotal
+ Extra Person Fees
+ Pet Fees
+ Site-specific Premiums
+ Upsells/Add-ons
- Discounts/Promotions
+ Taxes
= Total
```

### Dynamic Pricing Factors
- **Seasonality**: Peak, shoulder, off-peak
- **Day of week**: Weekend premiums
- **Length of stay**: Weekly/monthly discounts
- **Occupancy**: High demand pricing
- **Holidays**: Special event pricing
- **Site premium**: Waterfront, pull-through

### Deposit Policies
- Percentage at booking (25-100%)
- Balance due at check-in
- Cancellation refund rules (based on days before arrival)

## Operations

### Check-In Process
1. Verify reservation
2. Confirm site assignment
3. Collect balance due
4. Get signatures (rules, liability)
5. Issue gate code/keys
6. Hand off welcome packet

### Check-Out Process
1. Inspect site
2. Process final charges (late fees, damages)
3. Collect keys/equipment
4. Process refunds if applicable
5. Request review

### Housekeeping/Turnover
- Site inspection checklist
- Cleaning requirements by site type
- Maintenance issue reporting
- Ready status update

## Inventory Management

### Availability
```
Site is available if:
- Not already reserved for those dates
- Not blocked out
- Not under maintenance
- Meets guest requirements (RV length, hookups)
```

### Overbooking
Some parks oversell by percentage, similar to hotels.
Requires waitlist management and upgrade/downgrade policies.

### Site Locking
- **Floating**: Guest assigned to site class, specific site at check-in
- **Locked**: Guest assigned specific site at booking

## Channel Management

### OTA Integrations
- Campspot
- Hipcamp
- RoverPass
- Recreation.gov
- ReserveAmerica

Requires inventory sync, rate parity, and booking notifications.

## Compliance

### PCI DSS
- Never store card numbers
- Use tokenization (Stripe)
- Secure transmission

### ADA
- Accessible site inventory
- Reasonable accommodation requests

### Local Regulations
- Occupancy limits
- Quiet hours
- Fire regulations
- Pet policies

## Common Business Rules

### Minimum Stay
- Peak season: 2-3 night minimum
- Holidays: 3-4 night minimum
- Monthly: 28-30 nights

### Gap Management
- Prevent 1-night gaps between reservations
- Auto-extend pricing for gap filling

### Early Check-in / Late Check-out
- Subject to availability
- May incur fees
- Automatic or request-based

### Group Bookings
- Multiple sites, single invoice
- Deposit/payment schedules
- Shared amenities

## Key Metrics

### Revenue
- **ADR**: Average Daily Rate
- **RevPAR**: Revenue Per Available Site
- **Occupancy Rate**: % of sites occupied

### Operations
- Average length of stay
- Cancellation rate
- No-show rate
- Check-in time

### Guest
- Repeat guest rate
- NPS score
- Review ratings
