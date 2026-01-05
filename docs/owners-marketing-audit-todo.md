# Owners Marketing Audit TODO

Scope: /owners and the related owner-marketing pages: /compare/*, /roi-calculator, /demo, /demo/preview, /pricing, /campground-management-software, /rv-park-reservation-system, /switch-from-campspot.

## Navigation and IA
- [x] Remove duplicate header on `/owners` (only one marketing header should render).
- [x] Use the marketing nav on all owner-marketing pages (header consistency across compare/demo/roi/pricing/etc).
- [x] Update marketing nav anchor links to use `/owners#features` and `/owners#pricing` when off-page.
- [x] Add focus-visible styles and ARIA to the marketing nav and compare dropdown.
- [x] Ensure missing menu links are present on compare/roi/demo pages.
- [x] Verify top-of-page spacing on `/pricing` with the fixed header (adjust top padding if any heading is covered).

## Footer Consistency
- [x] Replace custom footers on compare/roi/demo/solutions pages with the shared marketing footer.
- [x] Fix footer contrast (headings should not be white on a light-muted footer).

## Anchor and Scroll Behavior
- [x] Add scroll offsets to in-page anchors: `#features`, `#pricing`, `#resources`, `#about`.
- [x] Ensure pricing section uses `scroll-mt` to avoid the fixed header covering content.

## Visual Consistency and Layout
- [x] Reduce hero key-feature density on mobile (stack the 3 highlight cards).
- [x] Fix blob animation delay classes to use valid Tailwind arbitrary values.
- [x] Align compare/roi/demo color palettes to the owners brand palette.

## Content Accuracy and Transparency
- [x] Update CampLife transparency block to avoid "no hidden fees" claim; call out SMS at cost + AI overage.
- [x] Update Newbook quick stat copy to "Add-ons clearly priced".
- [x] Rename "Camp Everyday" to "Keepr" in the CampLife pricing block.
- [x] Align early-access copy to live availability (no static "45 spots" when data is live).
- [ ] Confirm expected early-access inventory with the team; if Founder's Circle should be open, reset availability in the admin/DB.

## Data and Live Availability
- [x] Drive early-access tiers from live API (`/early-access/availability`) instead of hardcoded counts.
- [x] Show correct copy when availability is loading or unavailable.
- [x] Update bottom CTA and "founding spots" metric to use live counts when available.

## Accessibility
- [x] Add ARIA roles/controls for the PopularFeatures tablist/panel.
- [x] Add ARIA controls/regions for FAQ accordions.
- [x] Add keyboard focus styles for marketing nav items and dropdowns.

## Marketing Widget Visibility
- [x] Hide the floating ticket widget on owner-marketing pages to avoid distraction.

## QA and Verification
- [ ] Visual sweep on desktop + mobile for `/owners`, `/compare/campspot`, `/compare/newbook`, `/compare/camplife`, `/roi-calculator`, `/demo`, `/demo/preview`, `/pricing`, `/campground-management-software`, `/rv-park-reservation-system`, `/switch-from-campspot`.
- [ ] Confirm header + footer show on `/roi-calculator` after a local dev-server restart.
- [ ] Verify early-access availability is correct in production and in local environments (if API base differs).

## API Snapshot
- [note] Live availability (2025-02-14): Founder's Circle 0/5 remaining (sold out), Pioneer 15/15, Trailblazer 25/25 → 40 total remaining.
