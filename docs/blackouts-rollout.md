# Blackouts Rollout Guide

Scope: park-wide and site-specific blackout dates across admin UI, availability search, and booking flows.

## Acceptance checks

- Cannot create park-wide/site blackout with end <= start.
- Cannot create overlapping blackouts (park-wide vs site-specific).
- Site must belong to the campground; missing campground/site throws.
- Availability/search/booking reject blacked-out ranges with clear errors.
- Admin UI lists, creates, edits, deletes blackouts and shows park-wide badge.

## Quick test script (manual)

- API: `POST /blackouts` (campgroundId, siteId?, startDate, endDate, reason) → 201
- API: overlapping create → 400
- Admin UI: create park-wide blackout; verify calendar/availability hide all sites.
- Admin UI: create site blackout; only that site blocked.
- Booking: attempt to book in blocked range → conflict error.

## Rollout

- Ship behind admin-only permissions (current JwtAuthGuard).
- Monitor logs for `ConflictException` / blackout validation errors after release.
- Add seed fixtures in lower envs for park-wide and site-specific cases.
