# Runtime Tier Map (Keepr)

This maps Keepr modules to runtime tiers for the best end-state architecture. It is intended to guide where each capability should live (edge vs core vs async) to maximize correctness and performance.

## Tiers

- **Edge/Read**: cacheable, read-heavy, public or non-critical reads.
- **Core/Transactional**: booking, payments, inventory, and security-critical operations.
- **Async/Worker**: slow, external, or batch tasks; never on the critical path.
- **Realtime**: live updates via managed pubsub/websocket layer.

## Web App Surfaces

| Surface                 | Path(s)                                                                 | Tier                          | Notes                                             |
| ----------------------- | ----------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------- |
| Public marketing pages  | `platform/apps/web/app/(public)`                                        | Edge/Read                     | ISR + edge cache for SEO and discovery            |
| Public search/discovery | `platform/apps/web/app/(public)/search`, `/explore`, `/near`, `/browse` | Edge/Read                     | Fast cached queries; revalidate frequently        |
| Campground profiles     | `platform/apps/web/app/(public)/campground`, `/park`                    | Edge/Read                     | Serve cached data + dynamic availability snippets |
| Booking flow            | `platform/apps/web/app/booking`, `/booking-v2`                          | Mixed                         | Read paths at edge, mutations via Core API        |
| Guest portal            | `platform/apps/web/app/portal/*`                                        | Core/Transactional            | Authenticated reads + writes                      |
| Ops dashboard           | `platform/apps/web/app/dashboard/*`, `/operations`, `/calendar*`        | Core/Transactional + Realtime | Live updates via pubsub                           |
| Admin and staff tools   | `platform/apps/web/app/admin/*`                                         | Core/Transactional            | Security and audit heavy                          |
| AI surfaces             | `platform/apps/web/app/ai/*`                                            | Mixed                         | AI inference async; results cached                |

## API Modules (NestJS)

| Domain          | Module Path                                         | Tier               | Notes                                    |
| --------------- | --------------------------------------------------- | ------------------ | ---------------------------------------- |
| Reservations    | `platform/apps/api/src/reservations`                | Core/Transactional | Strong consistency + idempotency         |
| Availability    | `platform/apps/api/src/availability` / Rust service | Core/Transactional | Delegate to Rust service for correctness |
| Pricing         | `platform/apps/api/src/pricing`, `pricing-v2`       | Core/Transactional | Deterministic rule evaluation            |
| Payments        | `platform/apps/api/src/payments`, `stripe-payments` | Core/Transactional | Ledger + refund correctness              |
| Sites/Inventory | `platform/apps/api/src/sites`, `site-classes`       | Core/Transactional | Inventory and allocation integrity       |
| Auth/RBAC       | `platform/apps/api/src/auth`, `permissions`         | Core/Transactional | Security critical                        |
| Messaging       | `platform/apps/api/src/messages`, `communications`  | Realtime + Async   | Core writes + async delivery             |
| OTA sync        | `platform/apps/api/src/ota`                         | Async/Worker       | External dependency, long-running        |
| Reporting       | `platform/apps/api/src/reports`, `analytics`        | Async/Worker       | Aggregations and exports                 |
| Social planner  | `platform/apps/api/src/social-planner`              | Async/Worker       | Content generation and scheduling        |
| Imports/exports | `platform/apps/api/src/data-import`, `uploads`      | Async/Worker       | Batch processing                         |
| Observability   | `platform/apps/api/src/observability`               | Core/Transactional | Live signals + snapshots                 |

## Rust Services

| Service           | Path                                     | Tier               | Notes                       |
| ----------------- | ---------------------------------------- | ------------------ | --------------------------- |
| Availability      | `platform/services/availability-rs`      | Core/Transactional | High integrity calculations |
| Auth              | `platform/services/auth-service-rs`      | Core/Transactional | Security primitives         |
| Payment processor | `platform/services/payment-processor-rs` | Core/Transactional | Ledger guardrails           |

## Async/Worker Targets

- Email/SMS delivery
- OTA sync and reconciliation
- Reporting and exports
- Search indexing and cache refresh
- Background pricing updates
- Data migration and backfills

## Realtime Targets

- Live arrival/departure boards
- Calendar grid updates
- Staff messaging and task status
- System alerts and incident updates
