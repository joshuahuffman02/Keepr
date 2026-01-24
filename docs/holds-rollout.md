# Holds Rollout Guide

Scope: staff-only site holds that temporarily block availability.

Endpoints (JWT):

- `POST /holds` { campgroundId, siteId, arrivalDate, departureDate, holdMinutes?, note? }
- `GET /holds/campgrounds/:campgroundId` (active, non-expired holds)
- `DELETE /holds/:id` (release)
- `POST /holds/expire` (expire stale holds; wire to cron)

Behavior:

- Availability (public + staff) treats active, non-expired holds as locked.
- Overlaps rejected against active holds and existing reservations.

Runbook:

- Migrate DB (adds SiteHold).
- Add cron to call `/holds/expire` (or invoke HoldsService.expireStale) every 5–15 minutes.
- Optionally tighten booking flow to require a hold before confirmation.

Manual checks:

- Create hold → site disappears/locks in availability.
- Release hold → site becomes available.
- Expired hold after TTL → availability shows site.

Flags/monitoring:

- Restrict holds endpoints to staff (JwtAuthGuard).
- Log hold create/release/expire counts.
