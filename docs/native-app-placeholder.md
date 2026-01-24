# Native app placeholder deliverable

Purpose: document the lightweight handoff from PWA to a store-listed native wrapper, ensuring push readiness and offline parity without adding new backend scope.

Deliverable snapshot:

- PWA-to-native handoff: package existing guest/staff PWA slices in a minimal native shell (WebView + deep links) with store listing copy/assets. No new APIs; reuse current auth and routing.
- Push readiness: keep device registration/push preferences surfaced; permissions prompt copy finalized; server endpoints stay stubbed/feature-flagged for vendor keys later.
- Offline parity: reuse existing service worker caches and IndexedDB queues inside the shell; surface offline/queue status banners so parity is explicit for staff/guests.

Notes:

- Treat this as a placeholder milestone—validates the wrapping and readiness story, not a full native UI rewrite.
- Link back to roadmap entry for visibility in the public view.
