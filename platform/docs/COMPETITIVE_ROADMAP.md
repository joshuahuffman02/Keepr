# Competitive Roadmap

## Keepr - Path to Market Leadership

**Positioning**: The Modern Alternative to Legacy Campground Software

---

## 1. Marketing: "Modern Alternative" Positioning

### Messaging Framework

**Core Message**: "Built for how campgrounds run today, not 2010."

**Key Differentiators**:

- AI-powered (competitors have zero AI)
- Modern tech stack (React/Node vs PHP)
- Mobile-first design
- Real-time everything
- No marketplace commission

**Content Pillars**:

1. "Switching from [Competitor]" guides
2. "Why [Competitor] isn't cutting it anymore"
3. Feature comparison pages
4. ROI calculators (show cost savings)

**SEO Targets**:

- "Campspot alternative"
- "Newbook vs Keepr"
- "Best campground management software 2025"
- "Modern RV park software"

### Comparison Landing Pages

Create dedicated pages:

- `/compare/campspot`
- `/compare/newbook`
- `/compare/firefly`
- `/compare/rms`

Each page should:

- Acknowledge what they do well
- Highlight where we're better
- Show migration path
- Include switching testimonials

---

## 2. Booking Calendar - Critical Upgrade

### Current State

- Functional but basic
- Missing key features competitors have
- Not competitive with Campspot, Newbook, K2

### Required Features

**Must Have (P0)**:
| Feature | Competitor Has | We Have |
|---------|----------------|---------|
| Drag-to-extend reservations | Yes | No |
| Drag-to-move between sites | Yes | No |
| Multi-site selection | Yes | No |
| Split-stay handling | Yes | No |
| Housekeeping status overlay | Yes | Partial |
| Quick quote on hover | Yes | No |

**Should Have (P1)**:
| Feature | Description |
|---------|-------------|
| Timeline view | Gantt-style view of reservations |
| Resource view | Group by site class |
| Conflict highlighting | Visual overlap warnings |
| Quick actions toolbar | Check-in, checkout, move, cancel |
| Print day sheet | Staff daily operations |

**Nice to Have (P2)**:
| Feature | Description |
|---------|-------------|
| Keyboard shortcuts | Power user efficiency |
| Bulk operations | Select multiple, take action |
| Calendar sync (iCal) | Owner personal calendars |
| Color coding by status | Visual at-a-glance |

### Technical Approach

Consider:

- **React Big Calendar** - flexible but needs customization
- **FullCalendar** - feature-rich, good for resource views
- **Custom build** - full control, more effort

Recommendation: Start with FullCalendar Pro ($599/year), customize heavily.

---

## 3. Interactive Site Map

### Requirements

**Core Functionality**:

- Visual campground map
- Click site to book/view availability
- Real-time status (available, occupied, blocked)
- Mobile-friendly touch interactions

**Integration Points**:

- Booking flow starts from map click
- Availability filter applies to map
- Reservation details on hover/tap

### Implementation Options

**Option A: Custom SVG Map**

- Owner uploads campground image
- Admin draws clickable regions
- Store coordinates in database
- Pros: Cheap, works offline
- Cons: Manual setup, no mapping features

**Option B: Mapbox/Google Maps Integration**

- Plot sites as markers on real map
- Satellite imagery background
- GPS coordinates for navigation
- Pros: Professional, directions work
- Cons: Requires accurate GPS data

**Option C: Map Builder Tool**

- Drag-and-drop site placement
- Grid/template system
- Auto-generate from site list
- Pros: Easy for owners
- Cons: Development time

**Recommendation**: Start with Option A (SVG), add Option B for premium tier.

### UI Components Needed

- Map canvas component
- Site marker component
- Legend/key
- Filter panel
- Detail panel (on site click)

---

## 4. Bulletproof Onboarding & Data Import

### Philosophy

> "If migration is scary, they won't switch. Make it feel like unpacking a bag, not moving houses."

### Import Categories

**Critical Data**:
| Data Type | Fields | Validation |
|-----------|--------|------------|
| Sites | Name, number, type, class, rates, amenities | Unique site numbers |
| Site Classes | Name, base rate, max occupancy | Rate > 0 |
| Guests | Name, email, phone, address | Valid email format |
| Reservations | Guest, site, dates, amounts, status | No date overlaps |

**Important Data**:
| Data Type | Fields | Validation |
|-----------|--------|------------|
| Policies | Cancellation, deposits, check-in/out | Required fields |
| Pricing Rules | Seasonal, weekend, discounts | Valid date ranges |
| Staff/Users | Email, role, permissions | Unique emails |
| Add-ons | Name, price, type | Price > 0 |

**Nice to Have**:
| Data Type | Fields |
|-----------|--------|
| Historical transactions | For accounting continuity |
| Guest notes/preferences | For service continuity |
| Maintenance history | For site tracking |

### Import Flow

```
Step 1: Choose Source
├── CSV/Excel (Universal)
├── Campspot Export
├── Newbook Export
├── RMS Export
└── Manual Entry

Step 2: Upload & Parse
├── File validation
├── Column mapping interface
├── Preview first 10 rows
└── Error highlighting

Step 3: Validation
├── Check required fields
├── Identify duplicates
├── Flag conflicts (date overlaps)
├── Show resolution options
└── Allow skip/fix/cancel

Step 4: Review Summary
├── Total records by type
├── Issues found
├── Estimated import time
└── Confirm or go back

Step 5: Import Progress
├── Real-time progress bar
├── Success/error counts
├── Detailed log
├── Pause/resume capability

Step 6: Verification
├── Sample checks presented
├── "Does this look right?" prompts
├── Quick fix common issues
└── Mark import complete
```

### Validation Rules

**Reservations Import Validation**:

```
1. Guest exists (or create from data)
2. Site exists (or fail with clear message)
3. Dates don't overlap with existing
4. Amounts are positive
5. Status is valid enum
6. Departure > Arrival
```

**Accounting Validation**:

```
1. Sum of payments = paid amount
2. Balance = total - paid
3. Ledger entries balance
4. Tax calculations match
```

### Competitor-Specific Parsers

**Campspot**:

- Export format: CSV
- Key fields mapping
- Known quirks/gotchas

**Newbook**:

- Export format: XML/CSV
- Key fields mapping
- Date format handling

**RMS**:

- Export format: CSV
- Key fields mapping
- Multi-property handling

### Error Recovery

Every import step should be:

- **Reversible**: Can undo entire import
- **Partial**: Can complete valid records, skip invalid
- **Documented**: Clear log of what happened
- **Fixable**: Can edit/retry failed records

---

## 5. Campground Billing Portal

### Overview

Campground owners need visibility into what they're being charged and why.

### Billing Dashboard Components

**Summary Card**:

```
┌─────────────────────────────────────────┐
│ Current Period: Dec 1 - Dec 31, 2024    │
├─────────────────────────────────────────┤
│ Monthly Subscription    $29.00          │
│ Per-Booking Fees        $127.50 (51)    │
│ SMS (Outbound)          $12.40 (124)    │
│ SMS (Inbound)           $4.80 (48)      │
│ AI Features             $8.25           │
├─────────────────────────────────────────┤
│ TOTAL DUE               $181.95         │
│ Next Billing Date       Jan 1, 2025     │
└─────────────────────────────────────────┘
```

**Detailed Breakdown**:

- Per-booking fee breakdown by reservation
- SMS usage log with message preview
- AI token usage breakdown
- Historical billing (past 12 months)

**Invoice Section**:

- Download PDF invoices
- View payment history
- Update payment method
- View upcoming charges

### Billing Models to Support

**Early Access Tiers**:
| Tier | Monthly | Per-Booking | SMS | AI |
|------|---------|-------------|-----|-----|
| Founder's Circle | $0 | $0.75 | TBD | TBD |
| Pioneer | $0 (12mo) | $1.00 | TBD | TBD |
| Trailblazer | $14.50 (6mo) | $1.25 | TBD | TBD |

**Standard Pricing**:
| Plan | Monthly | Per-Booking | SMS Out | SMS In |
|------|---------|-------------|---------|--------|
| Standard | $69 | $2.50 | $0.10 | $0.04 |

### Implementation Requirements

**Database**:

```prisma
model BillingPeriod {
  id              String    @id @default(cuid())
  organizationId  String
  startDate       DateTime
  endDate         DateTime
  status          BillingStatus
  totalCents      Int
  paidAt          DateTime?
  stripeInvoiceId String?

  lineItems       BillingLineItem[]
  organization    Organization @relation(...)
}

model BillingLineItem {
  id               String   @id @default(cuid())
  billingPeriodId  String
  type             LineItemType // subscription, booking_fee, sms_out, sms_in, ai
  description      String
  quantity         Int
  unitCents        Int
  totalCents       Int
  metadata         Json?

  billingPeriod    BillingPeriod @relation(...)
}

enum LineItemType {
  subscription
  booking_fee
  sms_outbound
  sms_inbound
  ai_usage
  overage
  credit
}
```

**API Endpoints**:

```
GET  /api/billing/current          - Current period summary
GET  /api/billing/history          - Past billing periods
GET  /api/billing/:periodId        - Period detail with line items
GET  /api/billing/invoices         - PDF invoices
POST /api/billing/payment-method   - Update Stripe payment method
GET  /api/billing/usage/sms        - SMS usage detail
GET  /api/billing/usage/ai         - AI usage detail
```

**Stripe Integration**:

- Create metered billing items
- Track usage events
- Generate invoices
- Handle failed payments
- Dunning management

---

## 6. Email & SMS Integration (3rd Party)

### Requirements

**Email Provider**:

- Transactional emails (confirmations, receipts)
- Marketing emails (optional)
- Custom domain support
- Template management
- Analytics (opens, clicks)

**SMS Provider**:

- Two-way messaging
- US/Canada numbers
- Toll-free or local numbers
- MMS support (future)
- Delivery receipts

### Provider Options

**Email**:
| Provider | Pros | Cons | Pricing |
|----------|------|------|---------|
| SendGrid | Reliable, good API | Can be expensive | $0.0004/email |
| Postmark | Excellent deliverability | Less marketing features | $1.25/1000 |
| Resend | Modern API, React Email | Newer, less proven | $0.001/email |
| AWS SES | Cheap at scale | Complex setup | $0.10/1000 |

**Recommendation**: Start with Resend (modern, cheap, great DX)

**SMS**:
| Provider | Pros | Cons | Pricing |
|----------|------|------|---------|
| Twilio | Industry standard | Expensive | $0.0079/SMS |
| Vonage | Good global coverage | Less dev-friendly | $0.0068/SMS |
| Telnyx | Cheaper | Smaller company | $0.004/SMS |
| MessageBird | Good EU coverage | Less US focus | Varies |

**Recommendation**: Start with Twilio (reliability matters for reservations)

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Communication Service               │
├─────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │  Queue   │  │ Templates│  │ Provider Adapter │  │
│  │ (Bull)   │──│ Engine   │──│ - Email (Resend) │  │
│  │          │  │          │  │ - SMS (Twilio)   │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│                   Webhook Handler                    │
│  - Delivery status                                   │
│  - Bounces                                           │
│  - Inbound SMS                                       │
│  - Opens/clicks                                      │
└─────────────────────────────────────────────────────┘
```

### Features to Build

**Email**:

- [ ] Provider integration (Resend)
- [ ] Template system with variables
- [ ] Custom domain (DKIM/SPF)
- [ ] Bounce handling
- [ ] Unsubscribe management
- [ ] Analytics dashboard

**SMS**:

- [ ] Provider integration (Twilio)
- [ ] Number provisioning per campground
- [ ] Two-way conversation threading
- [ ] Opt-out handling (STOP)
- [ ] Usage tracking for billing
- [ ] Rate limiting

---

## 7. Modern Dashboard UI/UX

### Current Assessment

- Functional but not "wow"
- Feels like a utility, not a premium product
- Missing modern touches competitors don't have

### "Modern" Checklist

**Visual Polish**:

- [ ] Smooth animations/transitions
- [ ] Skeleton loading states
- [ ] Micro-interactions (hover, click feedback)
- [ ] Dark mode support
- [ ] Consistent spacing/typography
- [ ] Quality iconography

**UX Improvements**:

- [ ] Command palette (Cmd+K)
- [ ] Global search
- [ ] Keyboard shortcuts
- [ ] Customizable dashboard widgets
- [ ] Quick actions floating button
- [ ] Recent activity feed
- [ ] Smart notifications

**Data Visualization**:

- [ ] Beautiful charts (not basic)
- [ ] Real-time updates
- [ ] Interactive filters
- [ ] Export to PDF/Excel
- [ ] Comparison views

**Mobile Experience**:

- [ ] True mobile optimization
- [ ] Touch-friendly targets
- [ ] Swipe gestures
- [ ] Offline capability
- [ ] Push notifications

### Component Upgrades

| Component    | Current      | Target                               |
| ------------ | ------------ | ------------------------------------ |
| Tables       | Basic HTML   | Tanstack Table with sorting, filters |
| Charts       | Chart.js     | Recharts or Tremor                   |
| Forms        | Basic inputs | React Hook Form + shadcn             |
| Modals       | Basic        | Animated sheets/dialogs              |
| Navigation   | Sidebar      | Collapsible + command palette        |
| Empty States | Text only    | Illustrated + CTAs                   |

### Inspiration Sources

- Linear (issue tracker) - animations, command palette
- Vercel Dashboard - clean, minimal
- Stripe Dashboard - data-rich, professional
- Notion - customization, flexibility

---

## Priority Matrix

| Feature               | Impact   | Effort | Priority |
| --------------------- | -------- | ------ | -------- |
| Onboarding/Import     | Critical | High   | **P0**   |
| Campground Billing    | Critical | Medium | **P0**   |
| Booking Calendar      | Critical | High   | **P1**   |
| Email/SMS Integration | High     | Medium | **P1**   |
| Site Map              | High     | Medium | **P1**   |
| Dashboard UI/UX       | Medium   | Medium | **P2**   |
| Marketing Positioning | High     | Low    | **P2**   |

---

## Implementation Order

### Phase 1: Foundation (Weeks 1-4)

1. Email/SMS integration (needed for everything else)
2. Campground billing portal (need to charge customers)
3. Basic data import (CSV at minimum)

### Phase 2: Core Product (Weeks 5-8)

4. Booking calendar upgrade (main differentiator)
5. Advanced import (competitor-specific)
6. Import verification/accounting checks

### Phase 3: Polish (Weeks 9-12)

7. Interactive site map
8. Dashboard UI modernization
9. Marketing comparison pages

---

## Success Metrics

| Metric                      | Current | Target       |
| --------------------------- | ------- | ------------ |
| Onboarding completion rate  | Unknown | >80%         |
| Time to first booking       | Unknown | <48 hours    |
| Calendar interactions/day   | Unknown | Increase 50% |
| Support tickets (migration) | High    | Reduce 70%   |
| NPS score                   | Unknown | >50          |

---

_"Don't just be an alternative. Be the obvious upgrade."_
