# Cloudbeds parity audit for campground management (website builder excluded)

Date: 2026-01-01

## Scope

- Cloudbeds product pages and FAQ schema for PMS, channel manager, booking engine, payments, guest experience, revenue intelligence, guest marketing CRM, reputation management, integrations/marketplace.
- Campreserv baseline from `docs/feature-audit.md` and `docs/KNOWN_LIMITATIONS.md`.
- Website builder is explicitly excluded per request.

Legend (from repo audit): [OK], [PARTIAL], [STUB], [API], [PENDING].

## Cloudbeds capability inventory (excluding website builder)

Operations and PMS

- Calendar management, real-time channel sync, multi-property, unified guest profiles.
- Custom roles and permissions, reporting, groups functionality, upsells.
- "Guest Experience" integration and universal search.

Channel manager and distribution

- Real-time availability and rate sync to many channels.
- Centralized inventory, no overbookings, channel mix control.
- Global, local, and niche channels.

Booking engine

- Mobile-first embedded booking on property site.
- Widgets (rate checker), promotions/packages, upsells/add-ons, group booking.
- Analytics and tracking (GTM, GA, Facebook Pixel), full-funnel tracking.
- Secure payments in booking flow.

Payments

- Unified payments dashboard, automated reconciliation.
- Chargeback/dispute management.
- Multiple payment methods, pay-by-link, terminals, tokenization, 3DS, PCI.

Guest experience

- AI chatbot, unified inbox (SMS, email, WhatsApp, OTA messaging).
- Guest portal for add-ons, digital check-in/out, kiosk.
- Tickets and tasks for staff coordination.

Revenue intelligence

- Causal AI forecasting, pricing recommendations.
- Competitor rate tracking, multi-property analytics.
- Integration with CRM for targeted demand fill.

Guest marketing CRM

- Campaign builder, templates, AI copy tools, automation.
- Guest database dedupe, unified profiles, segmentation.
- Performance tied to booking revenue, OTA winback campaigns.

Digital marketing

- Metasearch, PMax, retargeting, direct booking strategy tools.

Reputation management

- Aggregated reviews across OTAs and Google.
- Sentiment analysis and AI response support.
- Multi-property review filters.

Integrations and platform

- Marketplace with 400+ integrations.
- Open API for custom builds.
- Partner program for integrations and channel partners.

## Campreserv parity map (current state vs Cloudbeds)

| Domain                   | Cloudbeds capability (short)                            | Campreserv feature(s)                                        | Status    | Notes / gaps                                                  |
| ------------------------ | ------------------------------------------------------- | ------------------------------------------------------------ | --------- | ------------------------------------------------------------- |
| PMS core                 | Calendar, roles, reporting, multi-property              | Reservations, calendar, site classes, reporting, permissions | [PARTIAL] | Calendar upgrade pending; reporting unvalidated               |
| Channel manager          | 2-way sync, channel mix control                         | OTA settings                                                 | [PARTIAL] | Outbound push stubbed; OTA sync is stubbed                    |
| Booking engine           | Embedded, mobile-first, widgets/upsells                 | Public booking V2, upsells                                   | [PARTIAL] | Payment flow and abandoned cart unverified; no widget toolkit |
| Payments                 | Unified dashboard, reconciliation, chargebacks          | Payments, payouts, disputes, ledger                          | [PARTIAL] | Payouts/disputes unverified; gift cards stubbed               |
| Guest experience         | Chatbot, unified inbox, portal, digital check-in, kiosk | Messaging, guest portal, check-in/kiosk                      | [PARTIAL] | Portal auth unverified; messaging delivery unverified         |
| Revenue intelligence     | Forecasting, comp set, AI recs                          | Dynamic pricing AI, analytics                                | [PARTIAL] | Analytics unvalidated; AI features stubbed without keys       |
| Guest marketing CRM      | Segmentation, automation, OTA winback                   | Campaigns, templates, notification triggers                  | [PARTIAL] | Triggers stubbed; abandoned cart stubbed; CRM sync stubbed    |
| Digital marketing        | Metasearch, PMax, retargeting                           | Marketing pages, social planner                              | [STUB]    | Social posting local-only; no paid media tooling              |
| Reputation management    | Review aggregation, sentiment                           | Reviews, NPS                                                 | [PARTIAL] | No multi-channel ingestion or sentiment tooling               |
| Integrations marketplace | 400+ partners, open API                                 | Integrations hub, developer API                              | [PARTIAL] | Integrations hub unvalidated; CRM sync stubbed                |
| IoT access control       | Locks, kiosks, device integration                       | Access control                                               | [STUB]    | No real device APIs                                           |
| Mobile/push              | Unified comms and messaging                             | PWA push                                                     | [STUB]    | Push server not implemented                                   |

## Highest priority gaps (website builder excluded)

1. Channel manager and OTA distribution

- 2-way sync (availability, rates, restrictions).
- Partner coverage for campgrounds: Hipcamp, RoverPass, Campspot, Airbnb, Booking.com.
- Channel mix and rate parity controls.

2. Booking engine conversion toolkit

- Widgets (rate checker), promotions/packages, upsells/add-ons.
- Tracking integrations for conversion and attribution.
- Abandoned cart recovery wired to booking flow.

3. Payments operations parity

- Unified reconciliation, chargeback workflow, pay-by-link, in-person terminals.
- Payouts, disputes, and gift cards verified end-to-end.

4. Guest communications and digital experience

- Unified inbox across SMS/email/OTA messaging.
- AI chatbot entry point for booking and support.
- Guest portal with add-ons, digital check-in/out, kiosk flow.

5. Revenue intelligence and comp set

- Demand forecasting and rate recommendations with transparency.
- Competitor rate tracking and multi-property analytics.

6. Guest marketing CRM and automation

- Segmentation, lifecycle campaigns, OTA winback.
- Event-driven automation and campaign revenue attribution.

7. Reputation management

- Review aggregation from OTAs/Google, sentiment and response tooling.

8. Integrations ecosystem

- Marketplace, partner program, documented open API.

## Campground-specific adaptation notes

Channel management

- Map rooms to site classes and individual sites.
- Support RV length, hookups, and occupancy constraints.
- Sync seasonal rates, minimum stay, and closed-to-arrival dates.

Booking experience

- Site map selection as a first-class step.
- Add-ons relevant to campgrounds: firewood, equipment rentals, day passes.
- Group and long-stay workflows (monthly or seasonal).

Payments and billing

- Deposit rules, staged payments, and long-stay billing.
- Utilities billing integration for metered stays.

Guest experience

- Pre-arrival instructions, gate codes, and site-specific guides.
- Self-serve changes and extensions through the guest portal.

Reputation and marketing

- Review ingestion from campground OTAs.
- Automated post-stay campaigns tailored to return visits.

## Recommended phased plan

Phase 1 - Distribution and booking

- Ship OTA 2-way sync for top campground channels.
- Complete public booking flow with abandoned cart and analytics.

Phase 2 - Payments and guest experience

- Reconciliation, disputes, terminals, pay-by-link.
- Unified inbox, chatbot, and guest portal with upsells.

Phase 3 - Revenue and marketing

- Forecasting, comp set, and pricing automation.
- CRM automation, retargeting, and reputation management.

## Open questions

- Which OTAs are mandatory for phase 1 (Hipcamp, RoverPass, Campspot, Airbnb)?
- Do we want to own payments fully (Stripe Connect + terminals), or rely on integrations?
- What is the target guest messaging stack (SMS only vs SMS + WhatsApp + OTA inbox)?

## Sources

- Cloudbeds: https://www.cloudbeds.com/property-management-system/
- Cloudbeds: https://www.cloudbeds.com/channel-manager/
- Cloudbeds: https://www.cloudbeds.com/booking-engine/
- Cloudbeds: https://www.cloudbeds.com/payments/
- Cloudbeds: https://www.cloudbeds.com/guest-engagement-software/
- Cloudbeds: https://www.cloudbeds.com/revenue-intelligence/
- Cloudbeds: https://www.cloudbeds.com/hotel-crm-solution/
- Cloudbeds: https://www.cloudbeds.com/reputation-management/
- Cloudbeds: https://www.cloudbeds.com/integrations/
- Campreserv: `docs/feature-audit.md`
- Campreserv: `docs/KNOWN_LIMITATIONS.md`
