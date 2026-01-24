## Post-completion polish checklist

Scope: hardening only (no new features). Owners are suggested; update status as you progress.

### Observability & reliability

| Item                                                                                 | Owner        | Status | Notes                                                                       |
| ------------------------------------------------------------------------------------ | ------------ | ------ | --------------------------------------------------------------------------- |
| `/health` (liveness) + `/ready` (DB/cache/queue reachability)                        | Backend      | DONE   | `health.controller.ts` + `health.service.ts` with DB, Redis, queue checks   |
| Cron/queues: emit success/failure/lag; alert on lag >5m or failure >1%               | Platform     | DONE   | `observability.service.ts` + `alert-monitor.service.ts` with SLO thresholds |
| OTA sync: success rate/latency/backlog; alert on drop >5% or backlog >15m            | Integrations | DONE   | `recordOtaStatus()` + OTA monitoring in alert-monitor                       |
| Comms: delivery %, bounce/complaint %, SMS DLR; alert on delivery <98% or bounce >2% | Messaging    | DONE   | `recordCommsStatus()` with delivery/bounce/complaint tracking               |
| Perf budgets: LCP <2.5s p75, TTFB <500ms; API p95 <400ms                             | FE/BE        | DONE   | SLO targets in `observability.service.ts` (configurable via env)            |
| Sentry error tracking                                                                | Platform     | DONE   | Full integration in API + Web (needs DSN env var)                           |
| Alert sinks (Slack, PagerDuty)                                                       | Platform     | DONE   | `alert-sinks.service.ts` with rate limiting                                 |
| Synthetic checks (DB, Redis, Stripe, Email)                                          | Platform     | DONE   | `synthetic-checks.service.ts` with configurable intervals                   |

### Security & compliance

| Item                                                                                                         | Owner           | Status | Notes                                                                                    |
| ------------------------------------------------------------------------------------------------------------ | --------------- | ------ | ---------------------------------------------------------------------------------------- |
| Auth guards on new pages (pricing, workflows, staff scheduling, portfolio) + server actions ownership checks | Security        | DONE   | Middleware protects all /dashboard routes; ScopeGuard validates campgroundId on API      |
| PII redaction in logs/traces (phone/email/card-last4) + sample review                                        | Platform        | DONE   | Implemented redacting logger in API (`platform/apps/api/src/logger/redacting.logger.ts`) |
| Rate limiting                                                                                                | Platform        | DONE   | @Throttle decorators on all endpoints; configurable via env                              |
| Multi-tenant isolation                                                                                       | Platform        | DONE   | ScopeGuard validates user.memberships contains campgroundId                              |
| Consent/SMS/email compliance: opt-in stored, unsubscribe visible, quiet hours, sender ID/shortcode rules     | Messaging/Legal | TODO   | Confirm auditability                                                                     |
| Backup/DR: validate RPO/RTO, recent restore test, tabletop for OTA outage + comms provider failover          | Infra           | TODO   | Schedule drill (Supabase has auto backups)                                               |

### UX polish

| Item                                                                                                           | Owner        | Status | Notes                                 |
| -------------------------------------------------------------------------------------------------------------- | ------------ | ------ | ------------------------------------- |
| Navigation consistency across new pages                                                                        | Design       | TODO   | Match primary/secondary nav patterns  |
| Empty/loading/error states: pricing, workflows, staff scheduling, portfolio (skeleton + friendly copy + retry) | FE           | TODO   | Prevent blank screens on partial data |
| Accessibility: keyboard/focus order, ARIA on controls, contrast, form error announcements                      | FE/Design QA | TODO   | Quick a11y pass first                 |
| Partial data guards: safe defaults for missing shifts/portfolio items                                          | FE           | TODO   | Avoid crashes on sparse datasets      |

### Tests (smoke/E2E)

| Item                                                                            | Owner           | Status | Notes                            |
| ------------------------------------------------------------------------------- | --------------- | ------ | -------------------------------- |
| Pricing change propagates to listing                                            | QA              | TODO   | Create/update rule, verify price |
| Workflow run marks steps complete and sends comms                               | QA              | TODO   | Assert comms dispatch            |
| Staff scheduling: create/assign, calendar renders, perms enforced               | QA              | TODO   | Role-based checks                |
| Portfolio dashboard loads >20 properties; pagination/filters                    | QA              | TODO   | Guard against slow queries       |
| OTA sync happy-path: push listing + pull reservation; monitoring events emitted | QA/Integrations | TODO   | Include provider variance        |

### Quick wins to do first

- [x] ~~Add lag/failure alerts for cron/queues.~~ - Done via `alert-monitor.service.ts`
- [x] ~~Add OTA backlog gauge + >15m alert.~~ - Done via `recordOtaStatus()` + alert-monitor
- [x] ~~Enable log redaction filter and spot-check logs.~~ - Done via `redacting.logger.ts`
- [ ] Add empty/error/loading states on new pages.
- [ ] Run a fast keyboard/contrast a11y pass.

### Config/env to stage

- `PAGERDUTY_SERVICE_KEY`, `SLACK_ALERT_WEBHOOK`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `METRICS_NAMESPACE=campreserv`.
- `SMS_PROVIDER_WEBHOOK_SECRET`, `EMAIL_BOUNCE_WEBHOOK_SECRET`.
- Flags: `ENABLE_READY_PROBE=true`, `ENABLE_COMMS_METRICS=true`, `ENABLE_OTA_MONITORING=true`.

### Proposed dashboards

- Reliability: health pass rate, queue lag, cron runtimes, error rate.
- OTA: success by provider, backlog depth, time-since-last-sync per property, top errors.
- Comms: delivery %, bounce/complaint %, latency, template failures.
- Perf: LCP/TTFB (web), API p95 by endpoint, DB slow queries.

### Risks & mitigations

- Silent cron/queue drift → lag/failure alerts.
- OTA backlog growth → backlog gauge + alert (>15m).
- PII leaking into logs → redaction filters + sample checks.
- Missing consent proof → verify opt-in persisted and auditable.
- Fragile UX on empty/error states → skeletons + retries.
- A11y gaps → keyboard/contrast audit and fixes.

### Owners (suggested placeholders)

- Observability: Backend (Alex), Platform (Priya), Integrations (Sam), Messaging (Dana), FE/BE split per page.
- Security: Security (Ravi), Platform (Priya), Messaging/Legal (Dana + GC), Infra (Noah).
- UX: Design (Mia), FE (Taylor), FE/Design QA (joint).
- Tests: QA (Kim), QA/Integrations (Kim + Sam).

### Alert routing examples (adjust routes/thresholds)

- Cron/queue lag: trigger when `queue_lag_seconds > 300` for 5m. Route: PD "Async"; Slack `#alerts-async`.
- Cron failures: trigger when `cron_failure_rate > 0.01` over 10m. Route: PD "Async".
- OTA backlog: trigger when `ota_backlog_seconds > 900` for 5m. Route: PD "Integrations"; Slack `#alerts-integrations`.
- Comms delivery: trigger when `comms_delivery_success_rate < 0.98` for 10m; bounce when `comms_bounce_rate > 0.02`. Route: PD "Messaging"; Slack `#alerts-messaging`.
- Perf budgets: trigger when API p95 >400ms on key endpoints or Web LCP p75 >2.5s. Route: PD "Web/API"; Slack `#alerts-perf`.

### Health/readiness runbook (drop into ops guide)

- `/health`: liveness only; no dependencies. If failing → recycle pod.
- `/ready`: checks DB/cache/queue reachability. If failing → keep pod out of rotation; investigate dependency.
- Deploy guard: ensure readiness passes before adding instances to LB; alert if readiness fails >2m during deploy.

### A11y + UX quick pass (per new page)

- Keyboard: tab order reaches all controls; visible focus ring.
- ARIA: labels on inputs/buttons, roles on toggles, `aria-live` for form errors.
- Contrast: primary text/background meets WCAG AA.
- States: loading skeleton, empty copy with CTA, error with retry/log reference.

### CI/ops hooks to wire

- Web perf budgets: `pnpm --dir platform/apps/web budgets` (already referenced in observability docs) — fail CI if LCP/TTFB budgets exceeded.
- API perf guard (smoke): add a short k6/Artillery step for key endpoints to assert p95 <400ms on pricing change, workflow exec, staff scheduling load, portfolio load, OTA kick-off.
- E2E tags: tag new smokes as `@smoke-hardening` and run on every PR + scheduled nightly.
- Alert test: add a synthetic that purposely delays a queue job to validate the lag alert route (PD + Slack).

### Sample perf smoke (k6)

```javascript
import http from "k6/http";
import { check, Trend } from "k6";

const pricing = new Trend("api_pricing_p95");

export const options = { vus: 5, duration: "1m" };

export default function () {
  const res = http.post(`${__ENV.API_BASE}/pricing/rules`, {
    /* minimal payload */
  });
  pricing.add(res.timings.duration);
  check(res, {
    "status 2xx": (r) => r.status >= 200 && r.status < 300,
    "p95 < 400ms": (r) => r.timings.duration < 400,
  });
}
```

### Sample E2E tag pattern (Playwright/Cypress)

- Add `@smoke-hardening` to tests covering: pricing change propagates, workflow run, staff scheduling, portfolio load, OTA happy-path.
- Configure CI matrix to run tagged tests on PR + nightly; run full suite nightly/weekly.

### Sample E2E skeleton (Playwright)

```typescript
import { test, expect } from "@playwright/test";

test.describe("@smoke-hardening pricing-change", () => {
  test("propagates updated price to listing", async ({ page, request }) => {
    const authHeaders = { Authorization: `Bearer ${process.env.TEST_TOKEN}` };

    // Setup: create a pricing rule via API
    const rule = await request.post(`${process.env.API_BASE}/pricing/rules`, {
      headers: authHeaders,
      data: {
        /* minimal valid payload */
      },
    });
    expect(rule.ok()).toBeTruthy();

    // Visit listing page and wait for data load
    await page.goto(`${process.env.WEB_BASE}/campgrounds/123`);
    await page.waitForSelector('[data-testid="price-value"]');

    // Assert price reflects new rule
    const priceText = await page.textContent('[data-testid="price-value"]');
    expect(priceText).toContain("$"); // refine to expected value if deterministic

    // Optional: refresh to ensure persisted state
    await page.reload();
    const refreshedPrice = await page.textContent('[data-testid="price-value"]');
    expect(refreshedPrice).toContain("$");
  });
});
```

### Sample E2E skeleton (Cypress)

```javascript
// cypress/e2e/pricing-change.smoke.cy.js
describe("@smoke-hardening pricing-change", () => {
  it("propagates updated price to listing", () => {
    const token = Cypress.env("TEST_TOKEN");
    const apiBase = Cypress.env("API_BASE");
    const webBase = Cypress.env("WEB_BASE");

    cy.request({
      method: "POST",
      url: `${apiBase}/pricing/rules`,
      headers: { Authorization: `Bearer ${token}` },
      body: {
        /* minimal valid payload */
      },
    })
      .its("status")
      .should("be.oneOf", [200, 201]);

    cy.visit(`${webBase}/campgrounds/123`);
    cy.get('[data-testid="price-value"]').should("be.visible");
    cy.get('[data-testid="price-value"]')
      .invoke("text")
      .should((text) => {
        expect(text).to.contain("$"); // refine expected value if deterministic
      });
  });
});
```

### Other smoke outlines (tests to fill)

- Workflow run: seed a simple workflow via API; trigger execution; assert step statuses and that a comms event is recorded (API check) and appears in UI timeline.
- Staff scheduling: create a shift via API; assign a staff member; visit calendar page; assert the shift renders and is hidden for unauthorized role.
- Portfolio load: seed >20 properties; visit portfolio dashboard; assert first page renders quickly, pagination/filters function, and no slow-query error surfaces.
- OTA happy-path: trigger sync via API; poll status until success; verify outbound listing payload was accepted (mock or sandbox), then verify a reservation pull appears in UI; assert monitoring events emitted.

### Minimal API payload hints (replace with real shapes)

- Pricing rule: `{ propertyId, ruleType: 'seasonal', startDate, endDate, priceCents }`
- Workflow: `{ name, steps: [{ type: 'email', templateId, to }], trigger: { type: 'manual' } }`
- Staff shift: `{ staffId, role, startsAt, endsAt, locationId }`
- OTA sync trigger: `{ provider: 'airbnb', propertyId, mode: 'full' }`

### Suggested `data-testid` anchors for stability

- Pricing page: `price-value`, `pricing-rule-row`, `pricing-save-button`
- Workflow run: `workflow-run-status`, `workflow-step-row`, `workflow-trigger-button`
- Staff scheduling: `shift-tile`, `calendar-view`, `assign-staff-button`
- Portfolio: `portfolio-table`, `portfolio-row`, `pagination-next`, `filter-apply`
- OTA: `ota-sync-status`, `ota-provider-select`, `ota-sync-trigger`
- Added: reservations KPIs (inhouse/arrivals/departures/balance), waitlist header/stats/table/rows, pricing form/table, workflows create/list, staff scheduling create/list, portfolio header/table, and OTA header/sync/channel/mapping tables now expose `data-testid` anchors.

### Log redaction quick pattern (PII)

- Add a log/trace filter that masks email/phone/card last4 in structured logs; run a sample log query to confirm masking.
- Redact on ingress (logger middleware) and before emitting traces; avoid logging full request bodies for POST/PATCH with PII.
- Implemented: API default logger now masks email/phone/last4 (see `platform/apps/api/src/logger/redacting.logger.ts`).

### Consent/SMS/email compliance quick check

- Store explicit opt-in with timestamp/source; expose in audit log.
- Ensure unsubscribe link present on emails; STOP keywords honored for SMS; respect quiet hours.
- Verify sender ID/shortcode matches compliance rules per region.

### Backup/DR drill steps

- Verify latest backup timestamp and retention meets RPO.
- Perform a restore to staging and measure RTO; document duration.
- Run tabletop: OTA provider outage and comms provider failover; document decision path and contacts.

### Alert validation steps

- Cron/queue lag: intentionally delay a job; confirm PD + Slack fire, then clear.
- OTA backlog: pause sync for one provider; confirm backlog alert fires.
- Comms: send test messages to trigger bounce/complaint webhooks in sandbox; confirm alert thresholds trip.

### Alert routing quickstart (PagerDuty/Slack)

- Set env/secrets: `PAGERDUTY_SERVICE_KEY`, `SLACK_ALERT_WEBHOOK`, `METRICS_NAMESPACE=campreserv`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `ENABLE_READY_PROBE=true`, `ENABLE_COMMS_METRICS=true`, `ENABLE_OTA_MONITORING=true`.
- Cron/queues: alert when `queue_lag_seconds > 300` for 5m or `cron_failure_rate > 0.01` for 10m; route to PD "Async" + Slack `#alerts-async`.
- OTA: alert when `ota_backlog_seconds > 900` or OTA success rate drops >5%; route to PD "Integrations" + Slack `#alerts-integrations`.
- Comms: alert when `comms_delivery_success_rate < 0.98` or `comms_bounce_rate > 0.02`; route to PD "Messaging" + Slack `#alerts-messaging`.
- Perf: alert when API p95 >400ms on key endpoints or Web LCP p75 >2.5s; route to PD "Web/API" + Slack `#alerts-perf`.

### Handy code patterns (drop-in examples)

- NestJS log redaction guard:

```typescript
import { Injectable, LoggerService, Scope } from "@nestjs/common";

const redact = (msg: string) =>
  msg
    .replace(/\b[\w.-]+@[\w.-]+\.\w+\b/g, "[redacted_email]")
    .replace(/\+?\d[\d\s().-]{7,}\b/g, "[redacted_phone]");

@Injectable({ scope: Scope.TRANSIENT })
export class RedactingLogger implements LoggerService {
  log(message: string, ...optional: any[]) {
    console.log(redact(message), ...optional.map(redact));
  }
  error(message: string, ...optional: any[]) {
    console.error(redact(message), ...optional.map(redact));
  }
  warn(message: string, ...optional: any[]) {
    console.warn(redact(message), ...optional.map(redact));
  }
  debug(message: string, ...optional: any[]) {
    console.debug(redact(message), ...optional.map(redact));
  }
  verbose(message: string, ...optional: any[]) {
    console.debug(redact(message), ...optional.map(redact));
  }
}
```

- Next.js data-testid helper (React):

```typescript jsx
type TestIdProps = { testId?: string } & React.HTMLAttributes<HTMLDivElement>;
export const Box = ({ testId, ...rest }: TestIdProps) => <div data-testid={testId} {...rest} />;
```

- Playwright selector pattern:

```typescript
const price = page.getByTestId("price-value");
await expect(price).toContainText("$");
```
