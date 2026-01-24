# Staff Dashboard Repolish Plan

## Context

This plan aligns with `docs/cloudbeds-competitive-analysis.md` and focuses on staff-facing pages (dashboard, operations, reservations, calendar, guests, finance, and settings). The target is a professional, calm, hospitality-first UI for campground management. Constraints: light theme only, no gradients, minimal animation.

## Goals

- Make staff pages feel premium, reliable, and easy to learn in days.
- Reduce visual noise and decorative styling; emphasize clarity and actions.
- Use a consistent layout and component system across all staff pages.
- Adapt to campground workflows (arrivals, turnovers, site readiness, seasonal stays).

## Design Principles

- Calm hierarchy: clear primary action, secondary actions grouped, tertiary actions hidden.
- Hospitality-first language: "Turnovers", "Quiet hours", "Site readiness", "Arrival window".
- Operational clarity: strong status system, minimal colors, consistent iconography.
- Predictable layouts: same header structure and filter bars across pages.
- Low-motion: subtle transitions only for state changes.

## Visual System (Light Theme Only)

- Backgrounds: off-white and neutral surfaces; avoid stark white everywhere.
- Accents: pine/sage green for success, amber for warnings, blue for info, red for errors.
- Typography: use a clean, non-default UI font (example: "Source Sans 3") with tabular numerals for KPIs.
- Cards: flat surfaces, 1px borders, subtle shadows only where needed.
- Badges: single-tone fills (no gradients), consistent sizing.

## Layout Templates

- Overview template: header + KPIs + action queue + recent activity.
- List template: header + filters + table + right-side detail (optional).
- Detail template: left content + right context sidebar.
- Settings template: left nav + section cards with clear grouping.

## Component Standards

- Page header: title, short subtitle, primary CTA, secondary actions.
- Filter bar: unified filter chips, search, date range, export.
- Tables: fixed header, compact density, inline actions on hover.
- Status pills: consistent sizes and colors with tooltips for definitions.
- Empty states: calm message + one CTA, no illustrations or gradients.

## Page-by-Page Repolish Plan (Prioritized)

### Phase 1: Daily-use core

- Dashboard overview `platform/apps/web/app/dashboard/v2/page.tsx`
  - Convert to "Today at a glance" blocks (Arrivals, Departures, In-house, Occupancy).
  - Add an "Action queue" (check-ins, payments, site moves).
  - Make KPIs consistent with finance/ops styling.
- Calendar `platform/apps/web/app/calendar/*`
  - Reduce color noise, emphasize availability vs occupied.
  - Stronger selection states and hover details.
  - Add unassigned reservation lane and site readiness indicators.
- Reservations list `platform/apps/web/app/reservations/*`
  - Standard filter bar and export pattern.
  - Compact rows, status pills, quick actions in-row.
- Guest profile `platform/apps/web/app/guests/[id]/page.tsx`
  - Timeline-first layout (stays, comms, payments).
  - Normalize badges and notes styling.

### Phase 2: Operations + Property

- Operations `platform/apps/web/app/operations/page.tsx`
  - Task lanes by priority and SLA indicator.
  - Separate staff vs guest impact tasks.
- Incidents `platform/apps/web/app/incidents/page.tsx`
  - Checklist-driven layout, evidence, and follow-up.
- Sites `platform/apps/web/app/campgrounds/[campgroundId]/sites/page.tsx`
  - Site readiness, utilities, and occupancy flags.
- Seasonals `platform/apps/web/app/campgrounds/[campgroundId]/seasonals/page.tsx`
  - Lease clarity, renewal timelines, payment status.
- Staff scheduling `platform/apps/web/app/campgrounds/[campgroundId]/staff-scheduling/page.tsx`
  - Shift coverage clarity and request approvals.

### Phase 3: Finance and Reporting

- Finance `platform/apps/web/app/finance/page.tsx`
  - Consolidate KPIs into a clean "Financial health" grid.
  - Replace decorative blocks with clean data cards.
- Ledger `platform/apps/web/app/ledger/page.tsx`
  - Tighten filters, summary blocks, and verification panel.
- Reports `platform/apps/web/app/reports/page.tsx`
  - Simplify report catalog, flatten charts, align table styles.
- Payouts/Disputes `platform/apps/web/app/payouts/*`, `platform/apps/web/app/disputes/*`
  - Clear dispute lifecycle and evidence timeline.

### Phase 4: Settings + Admin

- Settings (global + campground) `platform/apps/web/app/dashboard/settings/*` and `platform/apps/web/app/campgrounds/[campgroundId]/settings/*`
  - Standardize section cards and form spacing.
  - Clearer inline help, reduce copy density.
- Store/Inventory `platform/apps/web/app/store/*`
  - Standard list layout, bulk actions, and inventory alerts.
- Forms/Contracts `platform/apps/web/app/forms/*`
  - Flat cards, consistent modals, clearer creation flow.

## Campground-Specific Enhancements

- Site plan as a first-class view (map + list).
- "Site readiness" and "utility hookups" badges.
- Weather/fire restriction status in the header.
- Arrival window and quiet hours on reservation detail.
- Seasonal lease timeline and payment schedule visual.

## Implementation Phases (Delivery Plan)

1. Foundation: tokens, typography, spacing, component cleanup.
2. Core workflow pages (Dashboard, Calendar, Reservations, Guests).
3. Operations and site management pages.
4. Finance, reports, and analytics pages.
5. Settings, store, and long-tail pages.

## Definition of Done

- No gradients or dark-mode classes on staff pages.
- Consistent header/filter templates across core pages.
- Status colors and badges are uniform across the app.
- Tables and lists use the same density and action patterns.
- Copy and labels are hospitality-focused and consistent.

## Open Questions

- Final brand palette for staff UI (sage vs pine emphasis).
- Preferred UI font choice and licensing.
- Priority of site plan/map work vs other backlog items.
