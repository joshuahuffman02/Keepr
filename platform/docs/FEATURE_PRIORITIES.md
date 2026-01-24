# Keepr - Feature Priorities

**Last Updated:** December 17, 2025

These are the 7 key features identified as critical for competitive positioning and acquisition readiness.

---

## Priority Features

| #   | Feature                   | Status   | Priority | Notes                                              |
| --- | ------------------------- | -------- | -------- | -------------------------------------------------- |
| 1   | Marketing messaging       | **DONE** | P1       | "Modern alternative to legacy systems" positioning |
| 2   | Booking calendar upgrade  | Pending  | P1       | Major upgrade needed to compete with Campspot      |
| 3   | Interactive site map      | Pending  | P2       | Site selection via visual map                      |
| 4   | Onboarding/Import         | **DONE** | P0       | CSV/Campspot/Newbook import with field mapping UI  |
| 5   | Campground billing portal | **DONE** | P0       | Stripe subscription billing integrated             |
| 6   | Email/SMS integration     | Partial  | P1       | SMS exists via Twilio, needs polish                |
| 7   | Modern dashboard UI/UX    | Pending  | P2       | Visual refresh for modern feel                     |

---

## Completed

### Marketing Messaging (Dec 2025)

- Updated HeroSection with "Modern Alternative to Legacy Systems" headline
- Added pain point badges (no contracts, no setup fees, no hidden costs)
- Created WhySwitch component comparing Keepr vs legacy systems
- Updated OwnerCTA with switch-focused messaging
- Updated pricing copy to emphasize savings vs competitors
- Updated meta titles/descriptions for SEO
- Explicitly calls out Campspot, Newbook, ResNexus as legacy alternatives

### Onboarding/Import System (Dec 2025)

- CSV parser with field mapping and auto-detection
- Campspot format parser with field mappings
- NewBook format parser with field mappings
- Sites and Guests import support
- Field mapping UI with suggestions
- Preview before import with validation
- Import wizard at `/dashboard/settings/import`

### Campground Billing Portal (Dec 2025)

- Stripe subscription billing with metered usage
- Per-booking fees tracked automatically
- SMS usage tracked automatically
- Billing dashboard UI at `/dashboard/settings/billing`
- Webhook handlers for subscription lifecycle
- Support for all early access tiers (Founders, Pioneer, Trailblazer, Standard)

---

## Next Up: Booking Calendar Upgrade

**Why it's critical:**

- Main competitor differentiator (Campspot has superior calendar)
- Most-used feature for daily operations
- Current calendar needs modernization

**Requirements:**

- [ ] Full-width calendar view
- [ ] Drag-and-drop reservations
- [ ] Multi-site selection
- [ ] Quick booking modal
- [ ] Color coding by status/site type
- [ ] Better mobile experience

---

## Feature Details

### 1. Marketing Messaging

- Update copy to position as "modern alternative"
- Highlight: No contracts, transparent pricing, modern UI
- Target pain points of legacy system users

### 2. Booking Calendar

- Full-width calendar view
- Drag-and-drop reservations
- Multi-site selection
- Quick booking modal
- Color coding by status/site type

### 3. Interactive Site Map

- Visual campground map
- Click site to see availability
- Drag to assign reservations
- Real-time availability overlay
- Mobile-friendly

### 4. Onboarding/Import

See "Next Up" section above

### 5. Campground Billing Portal

**COMPLETED** - See "Completed" section

### 6. Email/SMS Integration

- Twilio SMS already working
- Add SendGrid for email
- Template management
- Automated triggers (confirmation, reminder, etc.)
- Delivery tracking

### 7. Modern Dashboard UI/UX

- Clean, minimal design
- Consistent component library
- Fast, responsive
- Dark mode support
- Mobile-optimized
