# Staff Dashboard Modern UI/UX Audit

Scope: staff-facing dashboard UI (routes using `DashboardShell`) with a focus on modern, clean, professional presentation. Public booking/marketing pages excluded. Review is code-based only (no runtime UI).

## Findings

### High

- Visual tokens exist but are not consistently applied, which breaks theme cohesion and makes the UI feel “patched together.” Evidence: semantic tokens are defined in `platform/apps/web/app/globals.css:50`, yet pages hardcode colors (e.g., `text-slate-900` in `platform/apps/web/components/ui/layout/DashboardShell.tsx:1067`, `bg-white` in `platform/apps/web/app/booking-lab/page.tsx:651`, `bg-white` in `platform/apps/web/app/calender-lab/page.tsx:320`).
- Typography scale is inconsistent across page headers, so hierarchy feels uneven and non‑systematic. Evidence: `platform/apps/web/components/ui/layout/DashboardShell.tsx:1067` uses `text-2xl`, while `platform/apps/web/app/calender-lab/page.tsx:310` and `platform/apps/web/app/booking-lab/page.tsx:642` use `text-3xl font-black`, and `platform/apps/web/app/reservations/page.tsx:28` uses `text-xl`.
- Layout density is inconsistent because some pages override the global container width and others do not, producing a different feel between workflows. Evidence: default container is `max-w-7xl` in `platform/apps/web/components/ui/layout/DashboardShell.tsx:1064`, but `platform/apps/web/app/booking-lab/page.tsx:626` and `platform/apps/web/app/calender-lab/page.tsx:293` override to `max-w-none`.
- Surface system is split between `Card` components and ad‑hoc `div className="card"` usage, which makes spacing and shadows drift from page to page. Evidence: `platform/apps/web/app/booking-lab/page.tsx:668` uses `<Card>`, while `platform/apps/web/app/reservations/page.tsx:26` and many report panels use `className="card"` (e.g., `platform/apps/web/app/reports/page.tsx:4498`).

### Medium

- Accent color changes by area (teal in nav, emerald/blue in pages), which weakens brand consistency and reads as “styled per screen.” Evidence: nav accent uses `#14b8a6` in `platform/apps/web/components/ui/layout/DashboardShell.tsx:93`, booking header uses emerald in `platform/apps/web/app/booking-lab/page.tsx:637`, calendar header uses blue in `platform/apps/web/app/calender-lab/page.tsx:305`.
- Breadcrumb patterns are duplicated and inconsistent, leading to different spacing/typography across sections. Evidence: `platform/apps/web/app/finance/page.tsx:8` uses `@/components/ui/breadcrumbs`, `platform/apps/web/app/guests/page.tsx:5` uses `../../components/breadcrumbs`, and `platform/apps/web/app/dashboard/settings/layout.tsx:79` renders custom breadcrumbs.
- Dark mode is wired into the UI (toggle + `.dark` tokens), which adds complexity and styling overhead if the product is light‑only. Evidence: `platform/apps/web/components/ui/layout/AdminTopBar.tsx:336` (ThemeToggle), `platform/apps/web/app/globals.css:84` (dark tokens).
- Dashboard uses decorative gradients and celebratory panels that feel more marketing‑like than operational, creating a visual mismatch with a clean, flat staff UI. Evidence: `platform/apps/web/app/dashboard/page.tsx:78` (time-of-day gradient tokens).

### Low

- Sidebar section uses a light border in a dark nav, which adds visual noise. Evidence: `platform/apps/web/components/ui/layout/DashboardShell.tsx:936` (`border-slate-200`).
- Form label styling varies between screens (uppercase micro-labels vs standard labels), which makes forms feel inconsistent. Evidence: `platform/apps/web/app/calender-lab/page.tsx:364` uses `text-[10px] font-bold uppercase tracking-widest`, while `platform/apps/web/app/booking-lab/page.tsx:1222` uses `text-xs text-slate-500`.

## Recommendations (Modern, Clean, Professional)

- Enforce semantic tokens everywhere: replace direct `slate/*` and `bg-white` usage with `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, and action/status tokens.
- Standardize typography scale: define a `PageHeader` component (title/subtitle/actions) with a single type scale and remove `font-black` headers in ops pages.
- Define layout modes: “data‑dense” (full width) vs “form‑centric” (constrained). Use a prop on `DashboardShell` instead of page‑level `max-w-none`.
- Normalize surfaces: use `Card` component for all panels; eliminate `div className="card"` in staff pages.
- Unify breadcrumb system to a single component and standard placement.
- Remove decorative gradients from staff UI and keep surfaces flat with subtle elevation.
- Drop dark mode: remove the toggle and `.dark` token layer to simplify the system into a single, clean palette.
- Choose one brand accent color and apply it consistently to nav, page headers, and primary actions.

## Assumptions

- Staff UI is light‑only (no dark mode).
- Staff UI avoids gradients and uses flat, professional surfaces.
