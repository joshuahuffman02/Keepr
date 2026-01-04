# Staff Dashboard UX Audit (Professionalism Pass)

Scope: staff-facing dashboard pages (routes using `DashboardShell`) and shared chrome (nav, top bar). Public booking/marketing pages excluded per request. Review based on code inspection only (no runtime UI or real data).

## Findings

### High
- Prototype/experimental routes are live and user-accessible (lab/v2/typoed URLs), which undermines trust and feels unfinished. Evidence: `platform/apps/web/app/calendar/page.tsx:1` (imports `../calender-lab`), `platform/apps/web/app/booking/page.tsx:1` (imports `../booking-lab`), `platform/apps/web/app/booking-lab/page.tsx:82`, `platform/apps/web/app/calender-lab/page.tsx:1`, `platform/apps/web/app/booking/v2/page.tsx:81`, `platform/apps/web/app/check-in-out/v2/page.tsx:1`, `platform/apps/web/app/dashboard/v2/page.tsx:1`.
- Visible “coming soon / stubbed / sandbox” copy appears inside staff workflows; this reads as unfinished and erodes confidence in core operations. Evidence: `platform/apps/web/app/booking-lab/page.tsx:1232` (Card reader coming soon) and `platform/apps/web/app/booking-lab/page.tsx:1237` (sandbox copy), `platform/apps/web/app/campgrounds/[campgroundId]/seasonals/page.tsx:2217` (COI tracking coming soon), `platform/apps/web/app/dashboard/settings/localization/page.tsx:149`, `platform/apps/web/app/dashboard/settings/integrations/page.tsx:218`, `platform/apps/web/app/pos/page.tsx:845`, `platform/apps/web/app/marketing/promotions/page.tsx:148`, `platform/apps/web/app/marketing/promotions/page.tsx:515`, `platform/apps/web/app/reports/portfolio/page.tsx:279`, `platform/apps/web/app/reports/portfolio/page.tsx:293`, `platform/apps/web/app/reports/portfolio/page.tsx:298`, `platform/apps/web/app/dashboard/settings/privacy/page.tsx:161`, `platform/apps/web/app/dashboard/settings/privacy/page.tsx:184`, `platform/apps/web/app/dashboard/settings/privacy/page.tsx:192`.
- Navigation registry exposes a missing “Contact Support” page, creating a dead-end experience. Evidence: `platform/apps/web/lib/page-registry.ts:1366` points to `/help/contact`, but `platform/apps/web/app/help/contact/page.tsx` does not exist.

### Medium
- Branding/naming is inconsistent inside the staff shell (e.g., “Host” vs “Keepr Host”), which makes the product feel stitched together. Evidence: `platform/apps/web/components/ui/layout/DashboardShell.tsx:911` and `platform/apps/web/components/ui/layout/DashboardShell.tsx:918` (sidebar brand), `platform/apps/web/app/dashboard/page.tsx:575` (Welcome to Keepr Host).
- Page chrome and hierarchy patterns are inconsistent (breadcrumbs vs none, multiple breadcrumb components, titles sometimes in shell and sometimes inside content), causing uneven typography and spacing across pages. Evidence: `platform/apps/web/components/ui/layout/DashboardShell.tsx:1065` (optional shell title/subtitle), `platform/apps/web/app/reservations/page.tsx:26` (custom header inside card), `platform/apps/web/app/finance/page.tsx:8` (Breadcrumbs from `ui/breadcrumbs`), `platform/apps/web/app/guests/page.tsx:5` (Breadcrumbs from `components/breadcrumbs`), `platform/apps/web/app/dashboard/settings/layout.tsx:79` (custom breadcrumb layout).
- Global max width (`max-w-7xl`) is applied to all staff pages, including data-dense workflows like calendar/reservations, which can feel cramped compared to enterprise dashboards. Evidence: `platform/apps/web/components/ui/layout/DashboardShell.tsx:1064`.
- Loading/empty state quality varies widely (full skeletons on dashboard vs plain text loaders elsewhere), making the experience feel uneven. Evidence: `platform/apps/web/app/dashboard/page.tsx:53` (skeleton pattern), `platform/apps/web/app/booking-lab/page.tsx:84` (text-only loader), `platform/apps/web/app/pos/page.tsx:853` (text-only loader).

### Low
- Sidebar styling mismatch in dark nav (light border) draws attention and looks off-brand. Evidence: `platform/apps/web/components/ui/layout/DashboardShell.tsx:936`.
- Default navigation can be empty until a user pins pages, which looks unfinished for first-time staff. Evidence: `platform/apps/web/components/ui/layout/DashboardShell.tsx:847`, `platform/apps/web/components/ui/layout/DashboardShell.tsx:999`.

## Recommendations (Professional Feel)
- Ship a “Production Page Frame” and enforce it everywhere: standardized header slot (title, subtitle, breadcrumb, primary action), consistent spacing, and a shared filter bar pattern. Deprecate ad-hoc `h1` inside cards.
- Remove “lab/v2” and typo routes from production. Keep experiments behind feature flags and rename routes to stable URLs.
- Replace “coming soon / stubbed / sandbox” text with either hidden UI, “Request access”, or a clear Beta label tied to a roadmap toggle. Never surface internal dev language to staff.
- Normalize branding (product name + logo) across shell, header, and onboarding copy.
- Make loading/empty states consistent: skeletons for primary panels and action-driven empty states (e.g., “Create first reservation”).
- Relax or override the global max width on data-heavy pages (calendar, reservation grid, reports) to match enterprise dashboards.
- Pre-pin a default menu per role so new staff see a complete nav immediately.

## Open Questions / Assumptions
- Are “lab” and “v2” routes intended to be customer-visible or strictly internal testing?
- Should “Host” be the final staff-facing brand name, or should it match Campreserv/Keepr?
- Which pages are considered GA vs beta? That impacts how aggressively to remove “coming soon” UI.
