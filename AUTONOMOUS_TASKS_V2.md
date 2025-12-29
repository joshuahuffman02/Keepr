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
- [ ] Create cron job to mark SeasonalPayment status to "past_due" when dueDate passes
- [ ] Send reminder notifications before due dates

---

## PHASE 1: AI-NATIVE REFINEMENT

### 1.1 Natural Language Search (First AI Feature)

**Goal**: "Find me a pet-friendly RV site next weekend under $50/night"

#### 1.1.1 Architecture Design
- [ ] **Define search intent schema** - What can users search for? (dates, site type, amenities, price, guests)
- [ ] **Choose approach**:
  - Option A: Claude API parses query → structured search params → existing search API
  - Option B: Vector embeddings (Pinecone) for semantic site matching
  - Recommendation: Start with Option A (simpler, faster to ship)
- [ ] **Design fallback** - If AI parsing fails, show standard search form

#### 1.1.2 Backend Implementation
- [ ] **Create NL Search endpoint** - POST /search/natural-language
- [ ] **Claude integration** - Parse user query to structured intent
- [ ] **Map to existing search** - Use availability/pricing APIs
- [ ] **Return ranked results** - With explanation of why each matches

#### 1.1.3 Frontend Implementation
- [ ] **Search bar component** - Prominent on booking page
- [ ] **Typeahead suggestions** - Common queries
- [ ] **Results display** - Show AI's interpretation, allow refinement
- [ ] **"Did you mean?" corrections**

#### 1.1.4 Testing & Polish
- [ ] **Test edge cases** - Vague queries, impossible requests, typos
- [ ] **Measure latency** - AI response time acceptable?
- [ ] **Cost monitoring** - Track Claude API usage

---

### 1.2 AI-Enhanced Messaging

**Goal**: Auto-draft replies, sentiment flagging on guest messages

#### 1.2.1 Sentiment Analysis
- [ ] **Analyze incoming messages** - Flag negative sentiment for priority
- [ ] **Tag urgency** - Complaints, emergencies, praise
- [ ] **Dashboard indicators** - Show sentiment trends

#### 1.2.2 Auto-Draft Replies
- [ ] **Generate draft responses** - Staff reviews before sending
- [ ] **Context-aware** - Include reservation details, guest history
- [ ] **Tone matching** - Professional, friendly, apologetic as needed
- [ ] **Template library** - AI-suggested templates for common scenarios

#### 1.2.3 Smart Compose
- [ ] **Inline suggestions** - As staff types, offer completions
- [ ] **Grammar/tone check** - Flag potentially problematic phrasing

---

### 1.3 AI Dashboard Insights

**Goal**: "Revenue down 15% vs last year - here's why"

#### 1.3.1 Anomaly Narratives
- [ ] **Generate explanations** - When metrics change, AI explains likely causes
- [ ] **Compare to benchmarks** - "Your occupancy is below similar parks"
- [ ] **Suggest actions** - "Consider a promotion for these empty dates"

#### 1.3.2 Morning Briefing
- [ ] **Daily AI summary** - What happened yesterday, what to watch today
- [ ] **Arrivals preview** - Special requests, VIPs, potential issues
- [ ] **Weather impact** - Rain forecast may affect bookings

#### 1.3.3 Proactive Alerts
- [ ] **Revenue at risk** - "3 reservations might cancel based on patterns"
- [ ] **Opportunity alerts** - "High demand period coming, raise prices?"
- [ ] **Operational heads-up** - "Maintenance ticket overdue, affects check-in"

---

### 1.4 AI-Enhanced Reports

**Goal**: "Show me revenue by site type last quarter"

#### 1.4.1 Natural Language Queries
- [ ] **Parse report requests** - Convert to structured report params
- [ ] **Map to report registry** - Use existing 100+ report templates
- [ ] **Custom aggregations** - AI builds SQL for novel requests

#### 1.4.2 Report Narratives
- [ ] **Summarize reports** - Key takeaways in plain English
- [ ] **Highlight outliers** - What's unusual in the data
- [ ] **Trend explanations** - Why metrics moved

---

### 1.5 Campaign AI

**Goal**: AI writes subject lines, suggests send times

#### 1.5.1 Subject Line Generator
- [ ] **Generate options** - Multiple subject lines to choose from
- [ ] **A/B test suggestions** - "Test these two variants"
- [ ] **Performance learning** - Track opens, improve over time

#### 1.5.2 Send Time Optimization
- [ ] **Analyze open patterns** - When do your guests open emails?
- [ ] **Personalized timing** - Different times for different segments
- [ ] **Timezone awareness** - Send at right local time

#### 1.5.3 Content Suggestions
- [ ] **Draft email body** - Based on campaign type
- [ ] **Image suggestions** - From uploaded media library
- [ ] **Call-to-action optimization** - Best performing CTAs

---

## PHASE 2: REVENUE MANAGEMENT AI

### 2.1 Yield Dashboard

**Goal**: Airline-style revenue optimization interface

#### 2.1.1 Dashboard Design
- [ ] **Revenue command center** - Single view of optimization status
- [ ] **Occupancy gauges** - Today, this week, next 30 days
- [ ] **Pricing recommendations** - Per day, per site class
- [ ] **"Money on table" alerts** - Opportunities being missed

#### 2.1.2 Implementation
- [ ] **Real-time occupancy** - WebSocket updates
- [ ] **Price elasticity display** - How demand changes with price
- [ ] **Quick actions** - One-click price adjustments
- [ ] **Competitor comparison** - Side panel (if data available)

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

---

## AI Feature Decisions

| Feature | Approach | AI Provider | Cost Model | Status |
|---------|----------|-------------|------------|--------|
| Natural Language Search | Query parsing | Claude API | Per query | First priority |
| Message Sentiment | Classification | Claude API | Per message | Phase 1.2 |
| Reply Drafts | Generation | Claude API | Per draft | Phase 1.2 |
| Dashboard Insights | Analysis | Claude API | Daily batch | Phase 1.3 |
| Report Queries | Parsing | Claude API | Per query | Phase 1.4 |
| Demand Forecasting | Time series | Custom ML | Training cost | Phase 2.2 |
| Dynamic Pricing | Optimization | Custom ML | Training cost | Phase 2.3 |

---

## Progress Log

| Date | Phase | Task | Summary |
|------|-------|------|---------|
| | | | |

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
