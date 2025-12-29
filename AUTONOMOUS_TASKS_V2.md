# Autonomous Task Queue - Campreserv V2 Vision Implementation

**Owner**: Josh
**Vision**: V1 done right + AI everywhere + Platform for ecosystem
**Reference**: /Users/josh/.claude/plans/encapsulated-leaping-popcorn.md
**Created**: December 29, 2024

---

## The V2 Philosophy

> "Don't add features, add intelligence to existing features."

Three Pillars:
1. **AI-Native, Not AI-Bolted** - Every feature asks "how can AI make this better?"
2. **Delightfully Simple, Quietly Powerful** - Hide complexity
3. **Ecosystem, Not Just Software** - Platform others build on

---

## Instructions for Claude

Use **ultrathink** for all architecture decisions and AI feature design.

For each task:
1. Mark it `[IN PROGRESS]` when starting
2. Research thoroughly - understand existing code, consider patterns
3. Log findings to **Findings Log**
4. For implementation tasks: show approach, wait for "ok"
5. Mark `[DONE]` with summary
6. Ask **"Next? (y/n)"** before proceeding

**AI Development Guidelines:**
- Prefer Claude API for conversational/generative tasks
- Consider cost implications (tokens add up)
- Build with graceful degradation (works without AI, better with)
- User always has manual override option

**Reference Skills:**
- `nestjs-api` for backend patterns
- `ui-development` for frontend
- `prisma-database` for data models

---

## PHASE 0: V1 COMPLETION (Must Do First)

Before any V2 work, V1 must be solid.

### 0.1 Critical Bug Fixes (From Audit)
- [x] Payment amount not updating on online booking - FIXED
- [x] Multi-tenant scope guards on 14 controllers - FIXED

### 0.2 Complete Stubbed Features
- [x] **Wallet/Gift Card UI** - DONE: Already fully implemented (backend controller, service, frontend API client, PaymentContext loading, GuestWalletMethod UI)
- [x] **OTA Integrations** - DONE: Full implementation exists (channels, mappings, iCal import/export, webhooks, monitoring). Provider HTTP calls stubbed awaiting credentials.
- [x] **Multi-currency FX** - DONE: OpenExchangeRates integration with hourly cron, graceful degradation to manual rates

### 0.3 Infrastructure Upgrades
- [x] **Redis Migration** - DONE: All critical services now use Redis with graceful fallback
  - [x] Session storage - Already uses RedisService
  - [x] Rate limiting state - RedisRateLimitService already complete
  - [x] Distributed locks - LockService already uses Redis
  - [x] Account lockout state - MIGRATED to Redis with memory fallback
  - [ ] Job queues (BullMQ) - Not critical, deferred
- [x] **WebSockets (Socket.io)** - DONE: Full implementation with JWT auth
  - [x] RealtimeGateway with JWT authentication and room-based subscriptions
  - [x] RealtimeService for emitting events from services
  - [x] Integrated with ReservationsService (create, update, cancel, check-in/out)
  - [x] Frontend useRealtime hook with TypeScript types
  - [x] Real-time reservation status changes
  - [x] Dashboard live metrics support
  - [x] Staff notifications support
- [ ] **Observability Wiring**
  - [ ] PagerDuty/Slack alert sinks
  - [ ] Grafana/Prometheus dashboards
  - [ ] Synthetic checks for critical paths

### 0.4 Seasonal Auto-Scheduler
- [x] **Cron job for past_due status** - DONE: Daily at 1:00 AM, also sends overdue notification emails
- [x] **Payment reminder notifications** - DONE:
  - Weekly reminders (Mondays 9 AM) for payments due within 7 days
  - Daily urgent reminders (9 AM) for payments due within 3 days
  - Past-due notifications when payments are marked overdue
  - Professional HTML email templates

---

## PHASE 1: AI-NATIVE REFINEMENT

### 1.1 Natural Language Search (First AI Feature) - DONE

**Goal**: "Find me a pet-friendly RV site next weekend under $50/night"

#### 1.1.1 Architecture Design
- [x] **Define search intent schema** - DONE: SearchIntent interface with dates, site type, amenities, price, guests, hookups, accessibility, etc.
- [x] **Choose approach**: Option A (Claude API parses query -> structured search params -> existing availability API)
- [x] **Design fallback** - DONE: fallbackParse() uses regex for dates, keywords, price extraction

#### 1.1.2 Backend Implementation
- [x] **Create NL Search endpoint** - POST /public/campgrounds/:slug/search (30 req/min rate limit)
- [x] **Claude integration** - AiNaturalSearchService uses AiProviderService with structured output
- [x] **Map to existing search** - Uses getPublicAvailability API to fetch available sites
- [x] **Return ranked results** - Site scoring algorithm with matchReasons explanation

#### 1.1.3 Frontend Implementation
- [x] **Search bar component** - NaturalLanguageSearch.tsx added to DateStep on booking page
- [x] **Typeahead suggestions** - Example queries shown on focus
- [x] **Results display** - Shows AI interpretation, match scores, amenity badges
- [x] **"Apply & View Sites"** - One-click to apply intent and proceed to site selection

#### 1.1.4 Testing & Polish
- [ ] **Test edge cases** - Vague queries, impossible requests, typos
- [ ] **Measure latency** - AI response time acceptable?
- [ ] **Cost monitoring** - Track Claude API usage

---

### 1.2 AI-Enhanced Messaging - DONE

**Goal**: Auto-draft replies, sentiment flagging on guest messages

#### 1.2.1 Sentiment Analysis - DONE
- [x] **Analyze incoming messages** - AiSentimentService with Claude API + fallback
- [x] **Tag urgency** - Urgency levels (low/normal/high/critical), intent detection
- [x] **Dashboard indicators** - SentimentBadge, SentimentScore, SentimentSummary components
- [x] **Webhook integration** - Auto-analyzes Twilio SMS and Postmark email inbound

#### 1.2.2 Auto-Draft Replies - EXISTING
- [x] **Generate draft responses** - AiReplyAssistService already exists
- [x] **Context-aware** - AiAutoReplyService with reservation context
- [x] **Tone matching** - AI-powered via AiProviderService
- [x] **Template library** - AutopilotConfig manages templates

#### 1.2.3 Smart Compose - DEFERRED
- [ ] **Inline suggestions** - As staff types, offer completions (low priority)
- [ ] **Grammar/tone check** - Flag potentially problematic phrasing

---

### 1.3 AI Dashboard Insights - DONE

**Goal**: "Revenue down 15% vs last year - here's why"

#### 1.3.1 Anomaly Narratives - EXISTING
- [x] **Generate explanations** - AiAnomalyDetectionService generates AI explanations with context
- [x] **Suggest actions** - suggestedAction field with AI-powered recommendations
- [ ] **Compare to benchmarks** - Would need external data sources (deferred)

#### 1.3.2 Morning Briefing - DONE
- [x] **Daily AI summary** - AiMorningBriefingService generates comprehensive briefing
- [x] **Arrivals preview** - Special requests, VIPs, guest counts
- [x] **Weather impact** - Integrates weather alerts if available
- [x] **Cron email delivery** - Daily at 7 AM with beautiful HTML email

#### 1.3.3 Proactive Alerts - DONE
- [x] **Opportunity alerts** - Detects high demand periods, gap nights, last-minute availability
- [x] **Maintenance reminders** - High-priority overdue tickets
- [x] **Revenue potential** - Shows estimated revenue for each opportunity
- [ ] **Revenue at risk** - AiNoShowPredictionService exists but not yet in briefing

---

### 1.4 AI-Enhanced Reports - DONE

**Goal**: "Show me revenue by site type last quarter"

#### 1.4.1 Natural Language Queries - DONE
- [x] **Parse report requests** - AiReportQueryService parses NL to ReportQueryInput
- [x] **Map to report registry** - Uses existing 135+ report templates from registry
- [x] **Fallback parser** - Rule-based fallback when AI fails
- [ ] **Custom aggregations** - Would require SQL generation (deferred for safety)

#### 1.4.2 Report Narratives - DONE
- [x] **Summarize reports** - generateNarrative() creates key takeaways
- [x] **Key findings** - Extracts bullet point insights from data
- [x] **Recommendations** - AI suggests actions when appropriate
- [x] **Suggested queries** - getSuggestedQueries() by category

---

### 1.5 Campaign AI - DONE

**Goal**: AI writes subject lines, suggests send times

#### 1.5.1 Subject Line Generator - DONE
- [x] **Generate options** - AiCampaignService.generateSubjectLines() returns 5 options with tone/reasoning
- [x] **A/B test suggestions** - generateAbTest() creates test variations with hypothesis
- [ ] **Performance learning** - Track opens, improve over time (deferred - needs email tracking data)

#### 1.5.2 Send Time Optimization - DONE
- [x] **Campaign type rules** - Industry best practices by campaign type (promotional, newsletter, seasonal, etc.)
- [x] **Suggested alternatives** - Provides recommended + 3 alternative times with reasoning
- [x] **Send time insights** - General tips for email timing

#### 1.5.3 Content Suggestions - DONE
- [x] **Draft email body** - generateContent() creates headline, body, CTA with template variables
- [x] **Content improvement** - improveContent() with goals: clarity, urgency, warmth, brevity, persuasion
- [ ] **Image suggestions** - Would require media library API (deferred)

---

## PHASE 2: REVENUE MANAGEMENT AI

### 2.1 Yield Dashboard - BACKEND DONE

**Goal**: Airline-style revenue optimization interface

#### 2.1.1 Backend Infrastructure - DONE
- [x] **AiYieldService** - Unified yield metrics service with cron snapshots
- [x] **Occupancy snapshots** - Daily recording at 11:59 PM, backfill support
- [x] **Yield metrics** - Today + period metrics, ADR, RevPAN, YoY comparison
- [x] **Forecast generation** - 30-day occupancy forecasts from reservation data
- [x] **Gap detection** - Count 1-2 night gaps that could be filled
- [x] **API endpoints** - /yield/dashboard, /yield/metrics, /yield/forecast, /yield/trend

#### 2.1.2 Frontend Dashboard - PENDING
- [ ] **Revenue command center** - Single view of optimization status (needs UI)
- [ ] **Occupancy gauges** - Today, this week, next 30 days (needs UI)
- [ ] **Pricing recommendations** - Integrated via existing AI pricing endpoints
- [ ] **"Money on table" alerts** - Integrated via AiRevenueInsight

#### 2.1.3 Enhancements - DEFERRED
- [ ] **Real-time WebSocket updates** - Existing RealtimeGateway can be extended
- [ ] **Price elasticity display** - Needs historical price/booking correlation
- [ ] **Competitor comparison** - Needs external data source

---

### 2.2 Predictive Demand Engine

**Goal**: ML-based 90-day occupancy forecast

#### 2.2.1 Data Pipeline
- [ ] **Feature engineering** - Historical bookings, seasonality, day-of-week, holidays
- [ ] **External signals** - Weather API, local events (if available)
- [ ] **Training data prep** - Clean historical data

#### 2.2.2 Model Development
- [ ] **Choose approach** - Time series (Prophet), gradient boosting, or neural net
- [ ] **Train initial model** - On historical data
- [ ] **Validation** - Backtest against known periods
- [ ] **Confidence intervals** - Show certainty ranges

#### 2.2.3 Integration
- [ ] **Daily forecast refresh** - Cron job retrains/updates
- [ ] **API endpoint** - GET /forecasts/occupancy
- [ ] **Dashboard integration** - Demand heatmap calendar

---

### 2.3 Dynamic Pricing 2.0

**Goal**: Upgrade from rules to ML-driven pricing

#### 2.3.1 ML Pricing Model
- [ ] **Define objective** - Maximize RevPAR? Occupancy? Revenue?
- [ ] **Price sensitivity analysis** - How do bookings change with price?
- [ ] **Demand curve estimation** - What's the optimal price point?

#### 2.3.2 Autopilot Mode
- [ ] **Automated adjustments** - AI changes prices within bounds
- [ ] **Guard rails** - Min/max prices, max daily change %
- [ ] **Human override** - Staff can always take control
- [ ] **Audit log** - Track all AI pricing decisions

#### 2.3.3 A/B Testing
- [ ] **Price experiments** - Test different rates on identical sites
- [ ] **Statistical significance** - Know when results are real
- [ ] **Auto-winner selection** - Apply winning price automatically

---

### 2.4 Competitive Intelligence

**Goal**: Track competitor pricing, market positioning

#### 2.4.1 Rate Shopping
- [ ] **Legal considerations** - Only scrape public rates, respect ToS
- [ ] **Competitor list** - Define local competitors
- [ ] **Rate collection** - Automated or manual entry
- [ ] **Comparison dashboard** - Your rates vs market

#### 2.4.2 Rate Parity Alerts
- [ ] **OTA vs direct** - Alert if OTA cheaper than direct
- [ ] **Competitor undercutting** - Alert on significant price gaps
- [ ] **Positioning insights** - "You're the 3rd cheapest for RV sites"

---

## PHASE 3: ECOSYSTEM FOUNDATION

### 3.1 Developer Platform

#### 3.1.1 Public REST API
- [ ] **OAuth2 implementation** - Third-party app authentication
- [ ] **API versioning** - /v1/ prefix, deprecation policy
- [ ] **Rate limiting tiers** - Free, standard, enterprise
- [ ] **OpenAPI 3.1 spec** - Auto-generated from NestJS decorators

#### 3.1.2 GraphQL Endpoint
- [ ] **Schema design** - Reservations, guests, sites, payments
- [ ] **Query complexity limits** - Prevent expensive queries
- [ ] **Subscriptions** - Real-time updates via WebSocket

#### 3.1.3 Developer Portal
- [ ] **Documentation site** - API reference, guides, examples
- [ ] **Sandbox environment** - Test without affecting real data
- [ ] **API key management** - Self-service provisioning
- [ ] **Usage dashboard** - Track API calls, billing

#### 3.1.4 TypeScript SDK
- [ ] **Type-safe client** - Generated from OpenAPI spec
- [ ] **Error handling** - Typed errors, retry logic
- [ ] **NPM package** - @campreserv/sdk

---

### 3.2 Webhook 2.0

#### 3.2.1 Enhanced Webhooks
- [ ] **HMAC signatures** - Verify webhook authenticity
- [ ] **Retry with backoff** - 3 retries with exponential delay
- [ ] **Event filtering** - Subscribe to specific event types
- [ ] **Delivery logs** - See what was sent, response received

#### 3.2.2 Event Catalog
- [ ] **Document all events** - reservation.created, payment.succeeded, etc.
- [ ] **Payload schemas** - JSON Schema for each event type
- [ ] **Testing tool** - Send test webhooks from dashboard

---

### 3.3 Integration Marketplace (v1)

#### 3.3.1 Curated Integrations
- [ ] **Accounting** - QuickBooks (priority), Xero
- [ ] **Email Marketing** - Mailchimp, Klaviyo
- [ ] **Smart Locks** - August, Yale, RemoteLock
- [ ] **Insurance** - Guest protection plans

#### 3.3.2 Integration Framework
- [ ] **OAuth connection flow** - Standard pattern for all integrations
- [ ] **Data sync** - Define what syncs, how often
- [ ] **Error handling** - Clear status, retry options
- [ ] **Disconnect cleanup** - Remove access gracefully

---

## Findings Log

| Date | Task | Finding | Impact | Notes |
|------|------|---------|--------|-------|
| 2024-12-29 | Wallet/Gift Card UI | Already complete | None | Backend: GuestWalletController + Service. Frontend: apiClient methods, PaymentContext, GuestWalletMethod.tsx |
| 2024-12-29 | OTA Integrations | API-ready, providers stubbed | None | Full channel/mapping/webhook/iCal/monitoring implementation. Only provider HTTP calls await credentials. |
| 2024-12-29 | Multi-currency FX | Implemented | Medium | OpenExchangeRates integration. Hourly cron refresh. Endpoints: GET /status, POST /refresh. Env: OPEN_EXCHANGE_RATES_API_KEY |
| 2024-12-29 | Redis Migration | Mostly already done | Low | RedisService, LockService, RedisRateLimitService were complete. Only AccountLockoutService needed migration (now done). |
| 2024-12-29 | WebSockets | Fully implemented | High | RealtimeGateway + RealtimeService (global module). Integrated with ReservationsService. Frontend useRealtime hook created. |
| 2024-12-29 | Seasonal Scheduler | Enhanced | Medium | Added EmailService, payment reminder emails (weekly + urgent), past-due notifications. Scheduler was already partially implemented. |
| 2024-12-29 | NL Search | Full implementation | High | AiNaturalSearchService with Claude API parsing, fallback regex, site scoring. Frontend component with animated results. |
| 2024-12-29 | Sentiment Analysis | Full implementation | High | AiSentimentService with Claude API analysis, webhook integration, SentimentBadge components. Urgency/intent detection. |
| 2024-12-29 | Dashboard Insights | Mostly existing | Medium | AiInsightsService, AiAnomalyDetectionService, AiDashboardService already comprehensive. Added AiMorningBriefingService for daily email. |
| 2024-12-29 | AI Reports | Full implementation | High | AiReportQueryService parses NL queries to report params using 135+ template registry. Generates narratives with findings/recommendations. |
| 2024-12-29 | Campaign AI | Full implementation | High | AiCampaignService with subject line generation, content drafting, send time optimization, content improvement, A/B test generation. |
| 2024-12-29 | Yield Dashboard | Backend complete | High | AiYieldService with daily snapshots, yield metrics (ADR, RevPAN, YoY), forecasts, gap detection. Leverages existing AiDynamicPricingService and AiRevenueManagerService. |

---

## AI Feature Decisions

| Feature | Approach | AI Provider | Cost Model | Status |
|---------|----------|-------------|------------|--------|
| Natural Language Search | Query parsing | Claude API | Per query | DONE |
| Message Sentiment | Classification | Claude API | Per message | DONE |
| Reply Drafts | Generation | Claude API | Per draft | EXISTING |
| Dashboard Insights | Analysis | Claude API | Daily batch | DONE |
| Report Queries | Parsing | Claude API | Per query | DONE |
| Campaign Content | Generation | Claude API | Per generation | DONE |
| Yield Metrics | Aggregation | None (DB queries) | Free | DONE |
| Demand Forecasting | Time series | Custom ML | Training cost | Phase 2.2 |
| Dynamic Pricing | Optimization | Custom ML | Training cost | Phase 2.3 |

---

## Progress Log

| Date | Phase | Task | Summary |
|------|-------|------|---------|
| 2024-12-29 | 1.1 | Natural Language Search | Complete AI-powered search with Claude API parsing, fallback regex, site scoring algorithm, frontend component |
| 2024-12-29 | 1.2 | AI-Enhanced Messaging | Sentiment analysis with urgency/intent detection, webhook integration, SentimentBadge components. Auto-reply already existed. |
| 2024-12-29 | 1.3 | AI Dashboard Insights | Morning briefing service with cron email, opportunity detection, arrivals preview. Anomaly narratives already existed. |
| 2024-12-29 | 1.4 | AI-Enhanced Reports | NL query parsing with 135+ report templates, narrative generation with findings/recommendations, suggested queries. |
| 2024-12-29 | 1.5 | Campaign AI | Subject line generator with A/B testing, send time optimization, content drafting and improvement. Full API endpoints. |
| 2024-12-29 | 2.1 | Yield Dashboard | Backend complete: AiYieldService with occupancy snapshots, yield metrics (ADR, RevPAN), YoY comparison, forecasts, gap detection. API endpoints ready. Frontend pending. |

---

## Open Questions for Josh

| Question | Context | Decision |
|----------|---------|----------|
| AI pricing model | Include in base or charge extra? | Pending |
| Claude vs OpenAI | For conversational features | Pending |
| QuickBooks priority | For Phase 3 integrations | Pending |
| Mobile app strategy | PWA vs native for V2? | Pending |

---

## Session Notes

**How to Start:**
```
Read AUTONOMOUS_TASKS_V2.md and work through tasks in order.
Use ultrathink for all AI feature design and architecture decisions.
Start with Phase 0 (V1 completion) if not done, otherwise Phase 1.
Ask y/n before each task. Show implementation approach before coding.
```

**Key Principle:**
The goal isn't 50 new features. It's making existing features *intelligent*.
