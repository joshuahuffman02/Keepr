# Product Roadmap (Public)
Living view of what's shipping for RV hospitality operators and guests. Themes only—details may change as we learn.

## Update — Dec 17, 2025: Self-Service & Support Automation (SHIPPED)

We've completed our Product-Led Growth initiative to make Keepr fully self-service:

### Self-Service Signup & Onboarding
- **Early Access Program**: Choose your tier (Pioneer, Trailblazer, or Base Camp) with transparent pricing
- **Guided Onboarding**: Step-by-step wizard to set up your campground
- **Welcome Dashboard**: Track your setup progress and get started quickly

### AI-Powered Support
- **Support Chat Assistant**: Get instant answers about using Keepr
- **Smart Help Articles**: Context-aware suggestions based on your questions
- **Seamless Escalation**: Create support tickets when you need human help

### Referral Program
- **Earn $50 Credits**: Refer other campground owners and both get credited
- **Easy Sharing**: Copy your link or share via email, Twitter, or Facebook
- **Track Progress**: See clicks, signups, and earned credits in your dashboard

### Guided Feature Tours
- **Welcome Tour**: New users get a guided introduction to key features
- **On-Demand Tours**: Learn about specific features (booking, pricing, referrals)
- **Smart Highlighting**: Tours point directly to relevant UI elements

---

## Update — Dec 17, 2025: Guest Experience Polish (SHIPPED)
We've shipped a comprehensive update to the guest booking experience:
- **Trust & Security**: Clear security badges during checkout (SSL, PCI compliant, Stripe secure)
- **Booking Confirmation**: Celebration screen with next steps, copy/print/share options
- **Smoother Navigation**: Scroll animations and improved loading states throughout
- **Clearer CTAs**: Action-oriented language ("Reserve Your Stay", "Find Your Perfect Spot")
- **Mobile Improvements**: Swipe gestures in photo galleries, better touch targets
- **Form Validation**: Real-time feedback on required fields

## Planning Update — Dec 09, 2025
- Focus: revenue reliability first, then operations, then distribution and sales, with insights and monetization trailing.
- Snapshot (phased):
  - Phase 1: Dynamic pricing/seasonal rate plans; deposits/auto-collect; add-ons/upsells; automated comms; audit/RBAC hardening.
  - Phase 2: Housekeeping/turnover tasking; maintenance tickets with site-out-of-order; self-service check-in/express checkout; group/linked bookings and blocks.
  - Phase 3: OTA/channel manager sync; memberships/discount plans and promo codes; public website/SEO tools.
  - Phase 4: Gift cards/store credit; point of sale (POS) for on-site store/activities; reporting/analytics (average daily rate/ADR, revenue, channel mix); waitlist with auto-offers.
- Quick wins: add-ons at checkout; deposits/auto-collect; comms templates for confirmations/mods/cancellations; lightweight occupancy/ADR dashboard; waitlist capture UI (manual convert).
- Update (Dec 10, 2025): Phase 1 (pricing/deposits/upsells/audit/RBAC) marked complete; remaining items shift to later-phase polish.
- Update (Dec 10, 2025): Phase 2 feature track marked complete; remaining work will roll into next-phase tracks and polish.
- Update (Dec 10, 2025): Phase 3 (OTA/channel sync, memberships/discounts, public website/SEO) marked complete; further polish will follow in future tracks.
- Update (Dec 10, 2025): Phase 4 is underway — gift card issuance/redemption and POS checkout scaffolds are in place, and waitlist automation/reporting builds have started.
- Update (Dec 10, 2025): Phase 4 remaining work: on-site POS/till handling, revenue and channel reporting, waitlist auto-offers, and guardrails/alerts for cash and reconciliation.
- Update (Dec 11, 2025): Reliability/payments/POS hardening shipped — live alerts + synthetic checks, stronger idempotency/rate limits, POS till open/close with needs-review on tender mismatch, stored value safeguards, export guard with resumable tokens, and consent/quiet-hour enforcement for email/SMS.

### Coming next
- Payment gateway choice with fee pass-through, big reports library with charts/email, POS integrations, onboarding/import/export, e-sign/waivers, utilities/late fees, access control automation, referrals/reason-for-stay polish.

### Milestones & how to follow
- Dec 17: lock scope and payments/comms choices for gift cards and POS.
- Dec 20: approve POS hardware/offline guardrails and guest/staff UX for gift cards, POS, and waitlist.
- Dec 24: stage reliability, observability, and idempotent flows for Phase 4 in non-prod.
- Jan 3: Phase 4 Go/No-Go targeting gift cards, POS, waitlist, and reporting readiness.
- Roadmap lives here; release notes ship via Updates in-app.

## Now (in progress)
- Resilient operations: offline-ready PWA with service worker caching + queued actions, POS/check-in that syncs safely when back online.
- RV-native accuracy: rig-fit safeguards, smart site assignments, fewer conflicts.
- Payments & trust: Stripe Connect live for per-booking fees/plans; adding payout reconciliation, saved wallets/ACH, and chargeback tooling.
- Performance & reliability (shipped): API SLOs with live dashboards, per-IP/org rate limits with 429s, backpressure on campaign/payout jobs, CI bundle-size budgets, and a published DR runbook (RPO 15m / RTO 60m).
- Guest communications: deliverability health (DMARC/DKIM/SPF + bounce/complaint classification), retries/failover, template approvals with audit, automation playbooks (arrival/unpaid/upsell/abandoned cart) respecting quiet hours/routing, and inbox/reservation/guest SLA badges.
- Integrations wave 1 (shipped): accounting (QuickBooks/Xero), CRM/helpdesk, access control, and API/SFTP export paths with webhook guards, admin UI, and a starter SDK. Sandbox QBO path is live; production QBO/Xero and some vendor creds remain pending approval.
- Native app placeholder: wrap the guest/staff PWA slices in a store-listed shell with push-ready registration toggles and the same offline caching/queues for parity while we plan deeper native UX.
- Hardening pass: post-completion polish in flight (observability alerts, PII-redacted logging, UX states, and tagged smoke/E2E coverage for pricing, workflows, staff scheduling, portfolio, OTA sync).

## Readiness snapshot
- Target Go/No-Go: Jan 3 for gift cards, POS, waitlist, and reporting, with launch-readiness gates in review.
- Reliability: API Service Level Objectives (SLOs) with live dashboards and a published Disaster Recovery (DR) runbook; monitors cover Phase 4 flows.
- Privacy & consent: Personally identifiable information (PII) is masked in logs; consent-aware communications, quiet-hour routing, and bounce/complaint handling are live.

## Next
- Arrival automation: self check-in, gate/lock/RFID options, late-arrival flow, “site ready” status.
- Smarter upsells: context-aware offers (arrival bundles, mid-stay activities, late checkout) tied to the folio.
- Social Media Planner: in-app content calendar with suggestions from occupancy/events/deals/seasonality, weekly ideas, templates, and reporting (no auto-posting).
- Activities & rentals: schedule, cap, and book on-site experiences and equipment.
- Insights: pickup/forecasting, attach-rate visibility, exports to analytics tools.
- Staff gamification (opt-in): XP/levels tied to real work (tasks, check-ins, maintenance, reviews), weekly challenges, leaderboards by category, badges/achievements, and a staff performance dashboard. Opt-in per campground; guests never see it.

## Later
- Developer ecosystem: public API/webhooks, sandbox, SDKs, extensibility points.
- AI ops copilot: suggested replies, task bundling/route optimization, semantic search.
- IoT & utilities: smart metering, leak/noise alerts, QR-at-site for “report/upsell”.
- Enterprise/international: multi-property views, approvals, localization, multi-currency/tax readiness.

## Data Intelligence & Decision Engine
- Privacy-first tracking across the booking journey (views → add-to-stay → abandon/complete) with aggregated insights only.
- Image/site/pricing intelligence that surfaces “what the data says” with confidence and projected impact.
- Recommendation hub with Apply/Update buttons for permitted roles; others see “requires approval”.
- Reports dashboard: funnel drop-offs, image performance, pricing/occupancy signals, deal impact, channel attribution, forecasting.

## How to follow
- Roadmap page in the app under Settings & About → Roadmap.
- Updates page for changelog-style releases.

