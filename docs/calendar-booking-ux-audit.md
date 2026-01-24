# Calendar + Booking UX Audit (Staff)

Date: 2026-01-01

## Scope

- Staff calendar: `/calendar` -> `platform/apps/web/app/calender-lab/page.tsx`
- Staff booking: `/booking` -> `platform/apps/web/app/booking-lab/page.tsx`
- Excludes public booking and the broader staff dashboard shell.

## Summary

These pages are feature-rich but read as "lab" prototypes due to copy, layout density, and missing guidance patterns. Professional polish requires predictable IA, staged workflows, and clarity cues (filters, statuses, reasons behind pricing/AI).

## Findings (High)

1. "Lab" and sandbox language in staff flow reduces trust.

- `platform/apps/web/app/booking-lab/page.tsx:83`
- `platform/apps/web/app/booking-lab/page.tsx:1232`
- Recommendation: remove or gate these states; replace with production-ready messaging and error handling.

2. Booking flow is a long, three-column form with no stepper or required-field cues.

- `platform/apps/web/app/booking-lab/page.tsx:665`
- Recommendation: introduce a staged workflow (Guest -> Stay -> Site -> Pricing -> Payment) with progress and validation gating.

3. Calendar grid forces horizontal scroll and lacks density controls.

- `platform/apps/web/app/calender-lab/page.tsx:50`
- Recommendation: add compact/standard/expanded density modes and day/week toggle.

4. Calendar depends on an external campground selector without in-page fallback.

- `platform/apps/web/app/calender-lab/page.tsx:451`
- Recommendation: add an inline campground selector in the calendar header.

## Findings (Medium)

1. Calendar filters are shallow for operations (no site class, availability/holds, maintenance).

- `platform/apps/web/app/calender-lab/page.tsx:361`
- Recommendation: add filter chips for site class, availability status, holds, maintenance, and groups.

2. Reservation chips rely on color only, no legend.

- `platform/apps/web/app/calender-lab/page.tsx:1086`
- Recommendation: add a legend and/or small text labels for status, with accessibility-friendly contrast.

3. Pricing panel uses internal jargon (e.g., "Rules delta") without explanation.

- `platform/apps/web/app/booking-lab/page.tsx:1153`
- Recommendation: add a hover breakdown or inline "Why" with rule explanations.

4. AI suggestions show a score but no explanation.

- `platform/apps/web/app/booking-lab/page.tsx:977`
- Recommendation: show 1-2 reason bullets ("Close to ADA", "Preferred hookup") to build trust.

5. Availability selection has no inline calendar view, conflict hints, or map toggle.

- `platform/apps/web/app/booking-lab/page.tsx:1003`
- Recommendation: offer a compact availability strip or map toggle for faster selection.

## Findings (Low)

1. The calendar header mixes utility (day range, nav, date badge) but no "quick actions".

- `platform/apps/web/app/calender-lab/page.tsx:319`
- Recommendation: add "New reservation", "Block", "Maintenance hold", "Check-in list" actions.

2. The booking flow hides "collect payment" logic (no explicit toggle).

- `platform/apps/web/app/booking-lab/page.tsx:193`
- Recommendation: surface a "Collect now / Pay later" toggle with policy defaults.

## Professional feel improvements (Cloudbeds-style)

Calendar

- Add a compact day/week toggle, density mode, and filter chips row.
- Add a legend for statuses and a clear "today" focus band.
- Add right-side quick drawer for selected reservation (view, edit, collect payment) instead of modal.
- Allow drag-to-select with immediate inline quote (rate + fees) in the header band.

Booking

- Convert to a staged flow with a sticky summary panel.
- Put required fields and errors inline with explicit labels.
- Make site selection multi-view: cards + mini-grid + map toggle.
- Add "why this price" and "why this site" explanations.
- Make payments a separate step with defaults based on policies (deposit, balance).

## MVP parity changes (prioritized)

P0 (must do)

- Remove "lab"/sandbox messaging and tighten error states.
- Add stepper + validation gating to booking.
- Add calendar density toggle + in-page campground selector.
- Add status legend + filter chips on calendar.

P1 (next)

- Add pricing breakdown with explainability.
- Add AI recommendation reasons.
- Add booking summary sidebar with editable sections.
- Add quick actions on calendar header.

P2 (polish)

- Add reservation quick drawer instead of modal.
- Add map toggle for site selection.
- Add keyboard hints/shortcuts surfaced in UI (not just modal).

## Notes

- This audit focuses on UX and presentation; no backend changes were reviewed.
- Public booking pages are out of scope for this request.
