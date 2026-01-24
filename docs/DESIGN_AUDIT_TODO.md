# Keepr Public Design Audit TODO

Scope: keeprstay.com public pages (home + public routes). Excludes /owners per request.
Sources: Playwright screenshots + code review of public components.

## P0 / Critical

- [x] Unify public layout: add the public header/footer to `/about`, `/contact`, `/terms`, `/privacy`, `/help`, `/roi-calculator` so users always have a menu and footer.
- [x] Replace staff-only `/help` with a true public help center (or redirect to a public FAQ page); remove staff shell and “Unable to load campgrounds” error from public traffic.
- [x] Fix broken public links: `/cookies` (404) and `/national-parks` (404). Either implement pages or remove/redirect links.

## P1 / High

- [x] Replace static “Top Rated” hero card with live data (world‑class NPS >= 70) and prioritize nearby campgrounds if location permission is granted; provide fallback if no eligible campgrounds.
- [x] Make “This Week’s Top Pick” fully dynamic: require real image or hide the hero image block; remove fallback copy that reads generic when data is missing.
- [x] Desktop navigation is missing primary links (only Explore + auth show); include key public routes in header (Campgrounds, About, Contact, Help/FAQ, Pricing).
- [x] Fix footer anchor links: `/help#faq` and `/help#cancellation` have no targets; `/#charity` has no anchor. Add anchors or update links.

## P2 / Medium

- [x] Homepage heading spacing: “Find yourperfect escape” should include a space for screen readers and copy clarity.
- [x] Homepage “Search Results” H2 appears when no search is active; update logic to only show when filters/search are actually applied.
- [x] `/camping?category=*` currently doesn’t apply filters; add URL param handling or change footer links to match supported filtering.
- [x] Event card routes: audit `/events/:id` and internal event links (currently redirect to `/activities`), and ensure card links point to existing detail pages.
- [x] Reduce floating “Submit ticket” widget overlap on marketing pages (e.g., terms/privacy/about/contact) or add collision avoidance.

## P3 / Accessibility & UX

- [x] Add `id="main-content"` to public `<main>` so skip‑link works on all public pages.
- [x] Add labels to newsletter email input (visible or sr‑only); ensure form is functional or disabled with copy.
- [x] Add `aria-expanded` and `aria-controls` to header dropdown toggles; ensure keyboard navigation for Explore menu.
- [x] Make hover-only CTAs (e.g., campground quick action) accessible via focus state.

## P4 / Consistency & Visual System

- [x] Normalize design language across public pages (hero gradients, button styles, spacing, typography) so `/about`, `/contact`, `/terms`, `/privacy`, `/roi-calculator` match home/camping.
- [x] Ensure public pages use the same brand palette tokens and typography scale.

## Content/Data Integrity Checks

- [x] Confirm “Top Rated” and “This Week’s Top Pick” labels match actual data definitions.
- [x] Validate “trending this week” (activity feed) uses real data and rotates reliably; avoid stale or misleading copy.
- [x] Make sure public stats/ratings never show placeholder counts (e.g., “Top Rated” without real rating data).

## Routing/IA Cleanups

- [x] Decide on the public help IA: public help center vs. redirect to `/contact` or `/faq`, and update header/footer accordingly.
- [x] Add/verify public “Cookies” policy route or remove the link entirely.
- [x] Add a public “National Parks” page or route it to `/camping` with proper filtering.

## QA / Regression Checklist

- [x] Verify header/footer on every public route: `/`, `/camping`, `/about`, `/contact`, `/terms`, `/privacy`, `/help`, `/roi-calculator`, `/careers`.
- [x] Check all footer links and anchors for 200 responses and valid anchors.
- [x] Confirm dynamic campground selection (world‑class NPS >= 70) and geo‑prioritization works with and without location permission.
- [x] Confirm no visual regressions in hero, Top Pick, and footer sections across desktop and mobile.
