# Hospitality Staff UI Redesign Blueprint

Goal: rebuild the staff-facing experience to be hospitality industry standard for campgrounds. The system should feel calm, predictable, and operationally fast. No dark mode, no gradients.

## Design principles
- Calm control: soft surfaces, minimal shadow, strong borders, consistent spacing.
- Scan in 3 seconds: top row answers "what is happening today" without scrolling.
- One source of truth: same data shown across calendar, list, and detail views.
- Operational safety: every action shows what will change, with undo when possible.
- Role-based clarity: front desk, ops, and revenue teams see the right default views.

## Visual system (tokens)

### Typography
- Heading: Source Serif 4 (600-700)
- Body: Source Sans 3 (400-600)
- Numbers: Source Sans 3 (600), tabular if possible

Scale:
- H1 28/34
- H2 22/28
- H3 18/24
- Body 14/20
- Caption 12/16

### Color palette (light, no gradients)
- Background: #F7F6F2
- Surface: #FFFFFF
- Surface muted: #F1EFE9
- Border: #E3E0D8
- Text primary: #1F2421
- Text muted: #6B736A
- Primary (evergreen): #1F6D4E
- Primary hover: #195A40
- Accent (amber): #B9791F
- Accent soft: #F6E9D2
- Danger: #B94A3B
- Danger soft: #F7DAD5
- Info: #2B6CB0
- Info soft: #D9E8F7

### Spacing
- 4, 8, 12, 16, 24, 32, 40, 48
- Page padding: 24 desktop, 16 mobile
- Card padding: 16-24

### Shadows and borders
- Shadows: 1 level only (0 2px 8px rgba(0,0,0,0.04))
- Borders: 1px #E3E0D8, 2px for emphasis only

## Component system

### Core components
- PageHeader: title + subtitle + actions + optional right rail toggles
- MetricCard: label, value, delta, status chip
- StatusChip: Confirmed, Checked in, Pending, Cancelled, OOO
- FilterBar: search + date range + status + saved views
- TableRow: consistent row height, sticky header, zebra optional
- Drawer: reservation details, right side, persistent action bar
- Toast: success, warning, error
- InlineEdit: quick update with undo

### Buttons
- Primary: evergreen, white text
- Secondary: white background, border
- Ghost: text only for low risk actions

### Inputs
- Uniform height 40
- Left icons for search and filters
- Strong focus ring (primary 20 percent)

## Navigation and IA

Primary nav:
- Dashboard
- Calendar
- Reservations
- Guests
- Operations
  - Check-in/out
  - Housekeeping
  - Maintenance
- Rates
- Reports
- Settings

Top bar:
- Campground switcher
- Global search (guest, reservation, site)
- Quick actions (New booking, Check-in, Post payment)

## Page wireframes (core)

### 1) Dashboard (front desk)

```
Top bar: Campground | Search | Quick actions

Today strip (6 tiles):
[Arrivals] [Departures] [In-house] [OOO] [Balance due] [Occupancy]

Action queue (cards, ordered by urgency):
- Overdue balances
- Unassigned sites
- Late arrivals
- Maintenance ready

Ops snapshot (2 columns):
Left: Arrivals list (next 6)
Right: Departures list (next 6)

Performance snapshot (3 tiles):
[ADR] [RevPAR] [Revenue today]

Footer:
Recent notes + shift handoff
```

Key interactions:
- Clicking any tile filters the Reservations view
- Action queue items open detail drawer
- Handoff note pinned to top of shift

### 2) Calendar (timeline)

```
Header:
Date range controls | Density toggle | Status filter | Site type filter

Left column (Sites):
Loop, site name, constraints icons (rig length, hookups)

Right grid:
Reservations as chips (name, status, balance flag)

Right drawer:
Reservation detail + actions (Check-in, Move, Extend, Charge)
```

Key interactions:
- Drag to create hold, release -> pricing preview
- Right click or menu on chip -> Move, Split, Extend
- OOO blocks visible and draggable

### 3) Reservations list

```
Header:
Saved views | Filters | Bulk actions | Export

Summary row:
Total reservations | Total balance | ADR | Avg length of stay

Table:
Status | Guest | Site | Dates | Balance | Source | Notes

Right drawer:
Reservation details and action bar
```

Key interactions:
- Bulk select -> collect payment / send message
- Inline status change with audit

### 4) Reservation detail drawer

```
Header:
Guest name + status chip + balance

Tabs:
Overview | Folio | Comms | Documents | History

Sticky actions:
Check-in / Check-out / Charge / Refund / Move site
```

### 5) Check-in/out board

```
Tabs: Arrivals | Departures | In-house

Each row:
Guest | Site | ETA | Balance | Notes | Quick actions
```

### 6) Housekeeping

```
List of sites:
Status (Dirty, Clean, Inspect) | Assigned staff | SLA timer
```

### 7) Maintenance

```
Kanban:
Open | In Progress | Waiting | Done
```

### 8) POS

```
Header:
Location | Shift status | Sync status

Left:
Product grid + category tabs + search

Right:
Cart, totals, payments, receipts
```

### 9) Guests

```
Search + filters
Guest list with badges (VIP, Repeat, Outstanding balance)
Profile drawer with stays + notes
```

### 10) Rates and Yield

```
Calendar-based rates | occupancy forecast | competitor comp (optional)
Explainable suggestions with reasons and overrides
```

### 11) Reports

```
Quick presets + export
KPIs with clear footnotes
```

## Interaction standards
- Everything has a keyboard path
- Drawer closes with ESC, preserves scroll position
- Optimistic UI for non-critical changes, confirm for money moves
- Always show "last updated" for operational confidence

## Values-first dashboard (must-have)
- NPS and Charity are the first visible cards on the dashboard, above all operational KPIs.
- NPS card shows: current score, delta vs last period, sample verbatim, and "learn why" link.
- Charity card shows: month-to-date total, top charity, and last donation time.
- Values row is visually calm but prominent; use the same card size as ops metrics for parity.

## Detailed page specs

### Dashboard (command center)
- Intent: immediate understanding of today, plus the brand values (NPS + Charity) front and center.
- Top row: NPS, Charity, Arrivals, Departures, In-house, Balance due.
- Ops queue: overdue balances, unassigned sites, late arrivals, maintenance ready.
- Arrivals and departures lists: show 6 each with status chip, balance flag, and ETA.
- Performance row: Occupancy, ADR, RevPAR, Revenue today.
- Handoff module: shift notes + "next shift checklist".

### Calendar (timeline + map)
- Intent: visual planning and fast rework of stays.
- Modes: Timeline (grid) and Map (site layout), with shared selection state.
- Sticky controls: date range, density, status filter, site type, "today".
- Chip content: guest name, status icon, balance dot, length of stay.
- Drag actions: create hold, move, extend, split, shorten.
- OOO blocks: same behavior as reservations, visible across timeline and map.
- Right drawer: reservation detail with action bar (check-in, move, charge, extend).

### Reservations list
- Intent: operational back office for filtering and bulk actions.
- Filter bar: search, date range, status, site type, balance due, source, saved views.
- Summary row: total count, total balance, ADR, avg length of stay.
- Table columns: status, guest, site, dates, balance, source, flags.
- Bulk actions: send message, collect payment, export, change status.
- Inline edit: status, assigned site, arrival/departure dates.

### Reservation detail drawer
- Intent: edit and transact without leaving the list or calendar.
- Header: guest name, status chip, balance, stay dates.
- Tabs: Overview, Folio, Comms, Documents, History.
- Sticky actions: check-in/out, post payment, refund, move site.
- Signals: late arrival, early departure, special requests.

### Check-in/out board
- Intent: reduce front desk decision time.
- Tabs: Arrivals, Departures, In-house.
- Rows: guest, site, ETA, balance, key notes, quick actions.
- Quick actions: check-in, check-out, send message, post payment.

### Guests
- Intent: faster recognition and repeat guest care.
- Search: name, phone, email, rig plate.
- Badges: VIP, repeat, balance due, accessibility needs.
- Profile drawer: stays, folio, notes, documents, preferences.

### Housekeeping
- Intent: clear task ownership and SLA visibility.
- View: list by site with status (dirty, clean, inspect), assigned staff, time since checkout.
- Filters: today, overdue, staff member, loop.
- Quick action: mark clean, assign staff, add note.

### Maintenance
- Intent: repair workflow with accountability.
- Kanban: open, in progress, waiting, done.
- Card: site, issue, priority, SLA, assigned tech.
- Links: site history and related reservations.

### Rates and yield
- Intent: manage seasonal pricing with confidence.
- Calendar view: base rate + overrides by date and loop.
- Rules panel: min stay, blackout, promos, deposits.
- Explainable suggestions: show reason and allow override.

### POS
- Intent: register-style speed with clear totals.
- Layout: left product grid, right cart and totals.
- Controls: location, shift status, sync status.
- Search: always visible, keyboard first.
- Payments: card, cash, split, refund flow from order history.

### Reports
- Intent: fast export with hospitality KPIs.
- Presets: occupancy, ADR, RevPAR, LOS, cancellation rate.
- Export: CSV, PDF, email scheduled.
- Footnotes: data ranges and refresh time.

### Settings
- Intent: predictable control without hunting.
- Sections: property, billing, policies, communications, integrations, roles.
- Consistent left nav with inline search.

## Data and content standards
- Status naming is consistent everywhere (Confirmed, Checked In, Pending, Cancelled, OOO).
- Money is always formatted and includes currency.
- Dates are always in local property timezone.

## Empty and error states
- Empty states include a single next action (add reservation, create rate rule, add staff).
- Error states show "what failed" plus a retry and a link to support.

## Performance and reliability
- Use skeletons for grids and lists.
- Keep drawer state in URL for shareable context.
- Cache critical queries (sites, reservations, guests) with background refresh.

## Accessibility and usability
- Contrast meets AA.
- Keyboard shortcuts for search, new booking, jump to today, open drawer.
- Touch targets at least 40px.

## Campground-specific enhancements
- Site constraints always visible (rig length, hookups, slope)
- OOO (out of order) blocks handled like reservations
- Rate rules by season and loop
- Quiet hours banner for staff reminder

## Implementation guidance
- Use existing shells: DashboardShell, PageHeader, Card, Table, Drawer
- Add: StatusChip, MetricCard, FilterBar, ReservationDrawer
- Keep a single spacing and typography scale across all staff pages
