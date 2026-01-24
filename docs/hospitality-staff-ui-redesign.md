# Hospitality Staff UI Redesign Blueprint

Goal: rebuild the staff-facing experience to be hospitality industry standard for campgrounds. The system should feel calm, predictable, and operationally fast. Light theme only. No gradients. NPS + Charity must be the first metrics visible on the dashboard.

## Inputs and references

- docs/cloudbeds-competitive-analysis.md
- docs/staff-dashboard-ux-audit.md
- docs/staff-dashboard-modern-ui-audit.md
- docs/professional-feel-checklist.md
- docs/staff-dashboard-repolish-plan.md
- docs/staff-dashboard-ux-audit.md

## Non-negotiables

- Light UI only (no dark mode).
- Flat surfaces (no gradients).
- NPS and Charity are first in the dashboard.
- Remove or hide lab/v2/prototype routes from staff-facing nav.

## Global design system (light, no gradients)

### Typography

- Headings: Source Serif 4 (600-700)
- Body: Source Sans 3 (400-600)
- Numbers: Source Sans 3 (600), tabular if possible

Scale:

- H1 28/34
- H2 22/28
- H3 18/24
- Body 14/20
- Caption 12/16

### Color palette

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

### Layout and spacing

- 8pt grid with 4, 8, 12, 16, 24, 32, 40, 48
- Page padding: 24 desktop, 16 mobile
- Card padding: 16-24
- Data-dense layout mode for calendar, reservations, reports, messages

### Surfaces and elevation

- One shadow level only (0 2px 8px rgba(0,0,0,0.04))
- Borders 1px; 2px only for emphasis
- Use semantic tokens everywhere (no hard-coded slate or bg-white)

## Global IA and navigation

- Left nav grouped by workflow: Dashboard, Calendar, Reservations, Guests, Operations, Finance, Reports, Settings
- Top bar: Campground switcher, global search, quick actions, alerts, profile
- Day Bar in header: date, occupancy, arrivals, departures, weather, fire ban

## Execution plan (priority order)

### Phase 0: Foundation (must do first)

- Unify PageHeader and PageFrame (title, subtitle, actions, breadcrumbs, right-rail controls).
- Add layout modes (standard vs data-dense) controlled by DashboardShell.
- Enforce tokens (bg-card, text-foreground, border-border).
- Remove lab/v2 routes from staff nav.
- Normalize loading/empty states (skeletons + action prompts).

### Phase 1: Core daily ops

- Dashboard
- Calendar
- Reservations list
- Reservation detail (drawer or page)
- Check-in/out board
- Messages

### Phase 2: Support systems

- Guests
- Operations (tasks, housekeeping, maintenance)
- Maintenance details
- Finance
- Reports
- POS
- Settings
- Reviews/Feedback
- Site map and inventory
- Groups

## Page-by-page redesign plan

Each section includes strengths from current pages worth keeping, then the redesign direction and implementation steps.

### Dashboard (home)

Current strengths worth keeping:

- Quick actions row (New booking, POS, Profile settings).
- Alerts panel with clear zero-state messaging.
- NPS card with interpretation tooltip.
- Charity Impact widget.
- 14-day occupancy chart and Today stats.

Redesign direction:

- Top row: NPS + Charity side by side, full width.
- Day Bar beneath header (occupancy, arrivals, departures, weather).
- Action queue centered (payments due, unassigned sites, late arrivals).
- Ops snapshot (arrivals/departures/in-house) with next actions.
- Shift handoff notes pinned.

Execution steps:

1. Rebuild header and top row to prioritize NPS + Charity.
2. Replace mixed panels with a consistent card grid.
3. Standardize alerts and action queue components.

Priority: Phase 1

### Calendar

Current strengths worth keeping:

- Density toggle (compact, standard, expanded).
- Site type filter and status legend.
- Search with guest filtering.
- Reservation chip details with status colors.

Redesign direction:

- Calm, data-dense grid with a fixed left site column.
- Right drawer for reservation details and quick actions.
- Persistent filter bar (date range, density, site type, status).
- Visual OOO blocks and maintenance overlays.

Execution steps:

1. Normalize chip styling and legend tokens.
2. Add right drawer with check-in, move, extend actions.
3. Add draggable OOO blocks and site readiness indicators.

Priority: Phase 1

### Reservations list (campground scoped)

Current strengths worth keeping:

- Filter chips, bulk actions, export flows.
- Tabs for All vs In-house.
- Comms filter and quick payment tools.

Redesign direction:

- Table with consistent row height and a sticky header.
- Summary row with totals and balances.
- Right-side drawer for quick edits and comms.

Execution steps:

1. Convert filters into a unified filter bar at top.
2. Create summary strip and compact row layout.
3. Add right drawer with actions and comms.

Priority: Phase 1

### Reservation detail

Current strengths worth keeping:

- Tabs (overview, folio, comms, documents, history).
- Audit log timeline.
- Payment collection modal and check-in/out celebration.
- Access control settings and forms.

Redesign direction:

- Split layout: left essentials, center timeline, right actions.
- Sticky action bar for check-in/out, charge, move.
- Clear financial summary with balance and payments.

Execution steps:

1. Reorganize content into three columns.
2. Standardize action bar and primary actions.
3. Add contextual status chips and warnings.

Priority: Phase 1

### Check-in/out

Current strengths worth keeping:

- Tabs for arrivals, departures, onsite.
- Bulk check-in/out.
- Inline messaging and payment collection.

Redesign direction:

- Queue-first layout with big action buttons.
- Add check-in readiness indicators (forms, payments, site assigned).
- Add quick notes and handoff tags.

Execution steps:

1. Rebuild list as a queue with readiness chips.
2. Add inline payment capture and message templates.
3. Add bulk action bar with progress feedback.

Priority: Phase 1

### Messages

Current strengths worth keeping:

- Guest vs team tabs.
- Compose modal and multi-channel send.
- Keyboard shortcuts.
- SLA indicators.

Redesign direction:

- Unified inbox with context panel (reservation + guest + balance).
- Clear unread priority and SLA countdown.
- Templates and quick replies in composer.

Execution steps:

1. Add right context panel for selected conversation.
2. Standardize filters and unread states.
3. Add saved replies and note templates.

Priority: Phase 1

### Guests

Current strengths worth keeping:

- Loyalty tier badges and points.
- Equipment/rig info sections.
- Merge guest flow.

Redesign direction:

- Split list and profile drawer.
- Quick badges for VIP, repeat, balance due.
- One-click send message or open reservation.

Execution steps:

1. Convert details to right drawer.
2. Standardize badges and profile summary.
3. Add direct links to reservation and billing.

Priority: Phase 2

### Operations (task board)

Current strengths worth keeping:

- Task board, SLA metrics, templates, teams, leaderboard.
- Category badges and priority tags.

Redesign direction:

- Kanban with SLA status badges and due times.
- Quick create task modal.
- Staff workload summary at top.

Execution steps:

1. Normalize board layout and status colors.
2. Add staff workload summary row.
3. Add task creation shortcuts and templates.

Priority: Phase 2

### Maintenance

Current strengths worth keeping:

- Tabs by status, priority ribbons, quick notes.
- Create ticket flow.

Redesign direction:

- Maintenance list integrated with operations board.
- Site readiness and ETA visible on each card.
- Quick assign and close actions.

Execution steps:

1. Standardize ticket cards and status chips.
2. Add site readiness and ETA labels.
3. Merge key views with operations tasks.

Priority: Phase 2

### Finance

Current strengths worth keeping:

- Next payout card and revenue totals.
- Dispute alert panel.
- Payout and dispute quick links.

Redesign direction:

- Finance overview with clear cash flow summary.
- Disputes and chargebacks in right rail.
- Daily, weekly, monthly revenue summary.

Execution steps:

1. Rebuild top summary row and quick actions.
2. Add finance timeline chart with payouts.
3. Add dispute deadlines and risk panel.

Priority: Phase 2

### Reports

Current strengths worth keeping:

- Saved reports and export flow.
- Report catalog and filters.

Redesign direction:

- Report preset cards with short summary and insights.
- Clear filter drawer and export guidance.
- Consistent chart styling across reports.

Execution steps:

1. Build a report home with presets.
2. Standardize charts and legends.
3. Add an insight panel for each report.

Priority: Phase 2

### POS

Current strengths worth keeping:

- Product grid + cart + checkout flow.
- Offline queue and sync status.
- Voice commands.

Redesign direction:

- Larger touch targets, kiosk-ready mode.
- Order history and refunds in a right drawer.
- Clear staff shift status.

Execution steps:

1. Rebuild POS shell with kiosk mode.
2. Add order history drawer.
3. Standardize receipts and refund UI.

Priority: Phase 2

### Settings

Current strengths worth keeping:

- Category cards with descriptions and deep links.
- Clear grouping (pricing, communications, security, property).

Redesign direction:

- Central settings index with search and filters.
- Page-level setting summaries and last-updated metadata.
- One-click access to Profile settings from dashboard.

Execution steps:

1. Build central settings search and filter.
2. Add summaries and consistency in section layouts.
3. Consolidate breadcrumb and header patterns.

Priority: Phase 2

### Reviews and feedback

Current strengths worth keeping:

- Review stats cards and reply flow.
- Status filtering and search.

Redesign direction:

- Unified guest feedback hub (NPS + reviews).
- Actionable insights for low scores.

Execution steps:

1. Merge NPS insights into reviews hub.
2. Add SLA for replies and templates.

Priority: Phase 2

### Site map and inventory (sites, site classes, map)

Current strengths worth keeping:

- Site layout editor and map upload.
- Keyboard shortcuts and unsaved changes badge.

Redesign direction:

- Map + list split view.
- Site readiness and constraints visible on hover.

Execution steps:

1. Add list panel next to map.
2. Add readiness indicators and OOO controls.
3. Standardize site constraints and badges.

Priority: Phase 2

### Groups

Current strengths worth keeping:

- Split list + detail layout.
- Shared payment and comms chips.

Redesign direction:

- Group booking hub with linked reservations and shared balance.
- Quick actions for shared payments and messaging.

Execution steps:

1. Add shared balance and payment actions.
2. Add group activity timeline.

Priority: Phase 2

## Shared components to build or standardize

- PageHeader (title, subtitle, actions, breadcrumbs)
- FilterBar (search, filters, saved views)
- MetricCard (value, delta, status chip)
- StatusChip (consistent statuses across all pages)
- RightDrawer (details and actions)
- ActionQueue (time-sensitive actions)
- EmptyState (with clear CTA)
- DayBar (date, occupancy, weather, alerts)

## Success metrics

- Time to complete check-in < 30 seconds
- Training time for new staff under 1 day
- Fewer than 2 clicks to reach critical actions
- NPS and Charity visible without scrolling
