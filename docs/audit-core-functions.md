## Reporting & Exports
- Export queue enforces a capacity guard with 503 + `retryAfter`, records to observability, and fires alerting before creating jobs; exports are capped by `REPORT_EXPORT_MAX_ROWS` and paginated via resumable tokens.
- Export summaries return ADR, RevPAR, occupancy, revenue, liability, and channel mix pulled from dashboard/booking sources; attach rate is not computed anywhere.
- Report execution has a concurrency guard but does not record/alert when the guard trips, so saturation is silent apart from the 503.
- No scheduler/recurring exports: jobs are only created via API calls, and the cron just flips queued jobs to success; there is no cadence/email delivery or emailed report distribution.
- Export processor is stubbed: the cron marks jobs `success` without generating/storing CSV/XLSX, no download URL/email is produced, and there is no export audit trail.
- UI parity risks: analytics UI pulls ADR/RevPAR/occupancy/liability from the period-aware `dashboard-metrics` endpoint, while CSV summaries use the 30-day/all-time `dashboard.summary`, so totals can diverge; no UI surface triggers CSV exports despite API client helpers.

### Evidence
```343:375:platform/apps/api/src/reports/reports.service.ts
  private async enforceCapacityGuard() {
    const depth = await this.prisma.integrationExportJob.count({
      where: { resource: "reports", status: { in: ["queued", "processing"] as any } }
    });
    ...
      this.alerting.dispatch(
        "Report export capacity guard",
        `Queued exports=${depth} (threshold ${threshold})`,
        "warning",
        "reports-capacity-guard",
        payload
      ).catch(() => undefined);
    ...
      throw error;
    }
    return depth;
  }
```

```440:512:platform/apps/api/src/reports/reports.service.ts
  async generateExportPage(params: {
    campgroundId: string;
    paginationToken?: string;
    pageSize?: number;
    filters?: Record<string, any>;
  }) {
    ...
    const maxRows = this.exportMaxRows();
    if (emitted >= maxRows) {
      return {
        rows: [],
        nextToken: null,
        emitted,
        remaining: 0,
        summary: await this.buildExportSummary(campgroundId)
      };
    }
    ...
    return {
      rows,
      nextToken,
      emitted: newEmitted,
      remaining: Math.max(0, maxRows - newEmitted),
      summary: await this.buildExportSummary(campgroundId)
    };
  }

  private async buildExportSummary(campgroundId: string) {
    const summary = await this.dashboard.summary(campgroundId);
    const sources = await this.getBookingSources(campgroundId);
    return {
      revenue: summary.revenue,
      adr: summary.adr,
      revpar: summary.revpar,
      occupancy: summary.occupancy,
      liability: summary.overdueBalance,
      channelMix: sources.bySource
    };
  }
```

```519:668:platform/apps/api/src/reports/reports.service.ts
  async getDashboardMetrics(campgroundId: string, days: number = 30) {
    ...
    const adrCents = totalRoomNights > 0 ? Math.round(totalRevenueCents / totalRoomNights) : 0;
    const revparCents = availableNights > 0 ? Math.round(totalRevenueCents / availableNights) : 0;
    const occupancyPct = availableNights > 0 ? Math.round((totalNights / availableNights) * 100) : 0;
    ...
    const outstandingCents = allActive.reduce((sum, r) => {
      const balance = (r.totalAmount || 0) - (r.paidAmount || 0);
      return sum + (balance > 0 ? balance : 0);
    }, 0);
    ...
    return {
      period: { start: startDate, end: now, days },
      revenue: { totalCents: totalRevenueCents, adrCents, revparCents, changePct: revenueChangePct },
      occupancy: { pct: occupancyPct, totalNights, availableNights },
      balances: { outstandingCents },
      today: { arrivals: todayArrivals, departures: todayDepartures },
      futureBookings,
      totalSites
    };
  }
```

```8:84:platform/apps/api/src/dashboard/dashboard.service.ts
  async summary(campgroundId: string, orgId?: string) {
    ...
    const occupancy = sites > 0 ? Math.min(100, Math.round((bookedNights / (sites * 30)) * 100)) : 0;
    const adr = totalNights > 0 ? revenueCents / 100 / totalNights : 0;
    const revpar = sites > 0 ? revenueCents / 100 / (sites * 30) : 0;
    return {
      campground: { id: campground.id, name: campground.name },
      sites,
      futureReservations,
      occupancy,
      adr,
      revpar,
      revenue: revenueCents / 100,
      overdueBalance: overdueBalancesCents / 100,
      maintenanceOpen,
      maintenanceOverdue
    };
  }
```

```127:189:platform/apps/api/src/__tests__/reports-export-smoke.spec.ts
  it("enforces capacity guard with 503 and retry-after", async () => {
    prismaStub.integrationExportJob.count.mockResolvedValue(999);
    ...
    expect(res.body).toMatchObject({
      message: expect.stringContaining("capacity"),
      retryAfter: expect.any(Number),
      reason: "capacity_guard"
    });
    expect(observabilityStub.recordReportResult).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ reason: "capacity_guard" })
    );
    expect(alertingStub.dispatch).toHaveBeenCalled();
    prismaStub.integrationExportJob.count.mockResolvedValue(0);
  });

  it("paginates with resumable tokens and caps row budget", async () => {
    process.env.REPORT_EXPORT_MAX_ROWS = "5";
    ...
    expect(second.summary).toMatchObject({
      adr: 120,
      revpar: 84,
      revenue: 7200,
      liability: 300
    });
  });
```

```28:146:platform/apps/web/app/analytics/page.tsx
  const metricsQuery = useQuery({
    queryKey: ["dashboard-metrics", selectedCampgroundId, period],
    queryFn: () => apiClient.getDashboardMetrics(selectedCampgroundId!, period),
    enabled: !!selectedCampgroundId,
    refetchInterval: 60000 // Refresh every minute
  });
  ...
  <KpiCard
    label="ADR"
    value={metrics ? formatCurrency(metrics.revenue.adrCents) : "—"}
    subtitle="Avg Daily Rate"
    loading={metricsQuery.isLoading}
    color="blue"
  />
  <KpiCard
    label="RevPAR"
    value={metrics ? formatCurrency(metrics.revenue.revparCents) : "—"}
    subtitle="Revenue per Available Room"
    loading={metricsQuery.isLoading}
    color="violet"
  />
  <KpiCard
    label="Occupancy"
    value={metrics ? `${metrics.occupancy.pct}%` : "—"}
    subtitle={metrics ? `${metrics.occupancy.totalNights} nights sold` : undefined}
    loading={metricsQuery.isLoading}
    color="amber"
  />
  <QuickStat label="Outstanding Balance" value={metrics ? formatCurrency(metrics.balances.outstandingCents) : "—"} icon="💰" href="/billing/repeat-charges" />
```

```410:434:platform/apps/api/src/reports/reports.service.ts
  @Cron(CronExpression.EVERY_MINUTE)
  async processQueuedExports() {
    const queued = await this.prisma.integrationExportJob.findMany({
      where: { resource: "reports", status: "queued" },
      take: 25
    });

    for (const job of queued) {
      await this.prisma.integrationExportJob.update({
        where: { id: job.id },
        data: {
          status: "success",
          startedAt: job.startedAt ?? new Date(),
          completedAt: new Date(),
          location: job.location ?? "csv",
          lastError: null
        }
      });
    }

    return { processed: queued.length };
  }
```

```1127:1155:platform/apps/api/src/reports/reports.service.ts
  private async withCapacityGuard(isHeavy: boolean) {
    if (isHeavy) {
      if (this.heavyRuns >= this.heavyQueryLimit) {
        const error = new ServiceUnavailableException({
          message: "Report queries temporarily limited (heavy)",
          retryAfter: this.capacityGuardRetryAfterSec(),
          reason: "capacity_guard",
        });
        (error as any).retryAfter = this.capacityGuardRetryAfterSec();
        throw error;
      }
      this.heavyRuns += 1;
    }
    if (this.activeRuns >= this.queryLimit) {
      const error = new ServiceUnavailableException({
        message: "Report queries temporarily limited",
        retryAfter: this.capacityGuardRetryAfterSec(),
        reason: "capacity_guard",
      });
      (error as any).retryAfter = this.capacityGuardRetryAfterSec();
      throw error;
    }
    this.activeRuns += 1;
  }
```
# Core Function Audit

## Comms & Observability
- Consent, quiet hours, approvals: Email/SMS send flow enforces per-channel consent using `privacySetting` + `consentLog`, blocks during campground quiet hours unless `quietHoursOverride` is set, and requires templates to be `approved` when referenced; playbook jobs reschedule to quietHoursEnd when needed (platform/apps/api/src/communications/communications.controller.ts).
- Deliverability handling: Postmark status webhook updates records and dispatches alerts for bounce/complaint events; Twilio status webhook only records metrics. Email sending retries Postmark once, then falls back to SMTP/log; SMS retries once with no provider failover. Playbook jobs retry up to 3 times with incremental delay before failing (platform/apps/api/src/communications/communications.controller.ts, platform/apps/api/src/email/email.service.ts, platform/apps/api/src/sms/sms.service.ts).
- Alerts and monitoring: Observability aggregates domain signals (redeem, offline backlog, offer lag, report failures, comms delivery/bounce/complaint, readiness, OTA backlog placeholder) and AlertMonitor emits Slack/PagerDuty alerts for breaches plus DLQ/queue lag detection and OTA adapter alerts; failed synthetics recorded every 5m (env-gated) are also surfaced. Readiness endpoint checks DB/Redis, records readiness status, and returns 503 on failure (platform/apps/api/src/observability/observability.service.ts, platform/apps/api/src/observability/alert-monitor.service.ts, platform/apps/api/src/observability/synthetics.service.ts, platform/apps/api/src/health/health.service.ts).
- Gaps/Risks: No producers currently call observability hooks for report results, offer lag, or OTA backlog, so those alerts will never trigger without new emitters. SMS failures do not alert (only metrics), and Postmark alerting is bounce/complaint-only. Consent can be bypassed by setting `consentGranted=true` on the request, and template approval is not enforced when sending raw body without a template. DLQ detection relies on queue names containing “dlq”, and queue depth/lag telemetry only works when callers use `JobQueueService`. Synthetics/comms/ready/OTA alerts are controlled by env flags and can be disabled unintentionally.
- Follow-ups (proposed): Wire observability.emit calls in report flows, offer lag, and OTA sync/backlog; add SMS alerting + provider failover/backoff (or secondary SMS provider); enforce consent/template checks even on raw-body sends and ignore client-provided consentGranted flags; harden DLQ/queue monitoring via consistent queue naming and mandatory JobQueueService usage; guard alerting/synthetics flags with defaults + admin visibility so they cannot be silently off; add bounce/complaint thresholds to trigger PagerDuty/Slack for SMS as well as email.
# Core Function Audit

## Staff Booking & Assignment
- Speed of entry: Staff console booking screen `platform/apps/web/app/campgrounds/[campgroundId]/reservations/page.tsx` requires manual site and guest selection plus manual dollar inputs; no quick-create defaults or keyboard-friendly shortcuts. Availability/overlap flags are computed (`overlapCheckQuery`, `selectedSiteUnavailable`) but never surfaced in the form, so conflicts are only caught after submit.
- Conflict checks: API asserts overlap and blackouts via `assertSiteAvailable` in `platform/apps/api/src/reservations/reservations.service.ts` (used by `POST /reservations` and `PATCH /reservations/:id`). Holds and maintenance are skipped—holds are only validated when a `holdId` is passed, and maintenance tickets are not considered. UI auto-creates a hold before submit but ignores failures (`createReservation` in the same page), so staff can book over holds without warning.
- Rig-fit / ADA / amenities: Rig compatibility is only applied to availability search (`searchAvailability` → `isRigCompatible` in `reservations.service.ts`); the create/update paths do not re-check rig type/length or any ADA/amenity constraints, allowing mismatched assignments. No ADA/amenity filters exist in the staff UI.
- Auto-assign quality: Auto-pick when only a site class is provided simply returns the first available site (`findAvailableSiteInClass` in `reservations.service.ts`) with no scoring or constraint checks. A match scorer exists (`/campgrounds/:id/matches` using `platform/apps/api/src/reservations/match-score.service.ts`) but is not wired into the booking UI, so staff get no ranked recommendations.
- Rate override / discount / comp approvals & audit: Override workflow exists (`POST /api/staff/overrides`, decisions in `platform/apps/api/src/staff/staff.service.ts` with `AuditService.record`), but the booking screen lets staff set totals/discounts directly without triggering approvals or writing to the override audit trail. Comps/voids are not linked to payments or folio entries.
- Deposits: Deposit enforcement happens server-side via `assertDepositV2` in `reservations.service.ts` (create/update will reject under-collection). UI only shows a suggested deposit (`computeDepositDue` in `reservations/page.tsx`) and does not block submit when paidAmount < required, so errors surface late; deposits are not broken out by tender.
- Folio / tender mix: Payments recorded through `POST /reservations/:id/payments` ignore payment method (controller passes only amount to `recordPayment`), defaulting to “card” and hard-coding ledger lines. No support for split tenders, cash/check, or folio-level adjustments on creation.
- Offline queue handling: Staff booking calls are synchronous fetches (e.g., `createReservation` in `reservations/page.tsx`) with no retry/queue/offline capture; failures during network drop simply lose the transaction.
- Follow-ups (proposed: staff booking): Enforce `maxOccupancy` server-side on create/update; require approvals/audit when `totalAmount` is manually supplied; capture `createdBy/updatedBy` and audit all staff bookings and site moves; re-check maintenance/ADA/access-control when reassigning sites and auto-sync access grants; validate payments/tender mix against quoted totals (including discounts/deposits) instead of defaulting to card.
# Core Functions Audit

## Accounting & FinOps
- Double-entry / ledger: Ledger exposed at `GET campgrounds/:campgroundId/ledger*` (`platform/apps/api/src/ledger/ledger.controller.ts`, `ledger.service.ts`). Reservation payments create debit Cash / credit revenue entries (`platform/apps/api/src/reservations/reservations.service.ts`). Long-stay billing posts AR debit / revenue credit per line (`platform/apps/api/src/billing/billing.service.ts#createLedgerPair`). Gaps: no global balancing or enforcement of paired entries; GL codes often null (OTA imports, refunds, fees). Ledger entries deduped by description/amount in reconciliation, risking missed duplicates. No period close or lock.
- Payouts + reconciliation: Hourly job reconciles Stripe accounts (`payments.scheduler.ts#reconcilePayouts`) using balance transactions to seed payout lines and ledger adjustments for Stripe fees, platform fees, and chargebacks (`payments/reconciliation.service.ts`). Payout recon summary exposed at `GET campgrounds/:campgroundId/payouts/:payoutId/recon` and CSV export routes in `payments.controller.ts`. Gaps: Stripe-only; no bank feed tie-out or status tracking; drift alerts only via webhook URL env; no persisted recon state or approval workflow; ledger not updated with payout net cash movement.
- Fee handling (platform/provider/FX, absorb vs pass-through): Payment intent creation computes pass-through vs absorb for platform and gateway fees (`payments.controller.ts#computeChargeAmounts`) and applies Stripe application_fee, but ledger posts only gross amount to revenue with no split of platform vs gateway fees. OTA imports optionally record channel fees but without GL codes (`ota.service.ts`). FX/tax config is stubbed with static rates (`currency-tax/currency-tax.service.ts`); no real FX revaluation or settlement handling.
- Payment processors + configuration: Gateway config model allows `stripe|adyen|authorize_net|other` (`payments/gateway-config.service.ts`), but `payments.controller.ts#getPaymentContext` hard-rejects any non-Stripe gateway and the default seed forces Stripe test mode. No UI/admin workflow to pick a processor per campground or store per-processor credentials/webhooks, so multi-processor compatibility is absent.
- Tax engine (taxable-load, exemptions): Tax rules allow exemptions by nights + waiver (`tax-rules.service.ts`, used in pricing V2 within `reservations.service.ts#computePriceV2`). Stored value tracks taxable_load flag and blocks mismatched reloads (`stored-value.service.ts`). Gaps: no tax calculation engine for occupancy/sales/VAT; no jurisdiction or product taxability matrices; no reporting/filing; OTA/POS/pricing flows do not compute tax lines; taxable_load not surfaced into GL or remittance.
- Liability (gift/store credit/deposits): Stored value has its own ledger (issue/redeem/hold/capture/expire) and liability snapshot (`stored-value.service.ts`), but balances are not posted into the main GL/liability accounts. Reservation deposits are taken as revenue (cash credit to revenue) rather than deferring to liability/AR. Deposit policies exist for amounts (`deposit-policies.service.ts`, `reservations.service.ts`) but not for accounting recognition.
- Revenue recognition (long-stay/POS/activities): Long-stay billing cycles generate invoices and AR/revenue entries (`billing.service.ts`), but recognition is on invoice generation, not stay completion; no schedules for deferrals. POS checkout records payments/ tills (`pos.service.ts`) with no revenue or tax posting. Activities/OTA imports post simple credits without timing or GL mapping. No rule-based rev rec for multi-day stays, addons, or POS items.
- Chargebacks / evidence kits: Disputes upserted from Stripe webhooks and payout ingestion (`payments.reconciliation.service.ts`), alerts sent for due dates (`payments.scheduler.ts#alertDisputesDue`). Chargeback ledger is expense vs cash. Gaps: no evidence kit assembly/storage, tasking, or win/loss workflow; no re-presentment actions or document upload; UI/exports absent.
- Exports to QBO/Xero: Integrations service has sandbox QBO account pull stub and export job metadata (`integrations.service.ts`), but no mapping from ledger/invoices/payments to QBO/Xero objects, no file/package generation, and Xero not implemented. Exports landing page mentioned in tests but no actual accounting export payloads.
- Audit logs: Chain-hashed audit log service (`audit.service.ts`) with CSV/JSON export endpoints; some calls from POS provider payments (`pos.service.ts#audit.record`). Gaps: payments/ledger/tax configuration changes not audited; no coverage over reconciliation actions or exports; audit logs stored in primary DB without tamper-evident storage/retention policy enforcement beyond defaults.
- Follow-ups (proposed: payments): Build provider-agnostic capture/refund/void adapters with per-campground gateway selection + credentials/webhook config UI; route `payments.controller.ts` through adapters instead of Stripe-only guard; surface fee/payout drift per provider; add admin UI to choose gateway and manage keys/webhooks by environment; document failover/backoff and receipt issuance across providers.
# Audit Core Functions

## Payments/POS/Stored Value
- Gateway selection and fee preset enforcement exist before creating intents; production credentials are validated and only Stripe is permitted today. Pass-through/platform fee math is computed with both platform and gateway fee modes.  
```133:244:platform/apps/api/src/payments/payments.controller.ts
  private async getPaymentContext(reservationId: string) {
    const gatewayConfig = await this.gatewayConfigService.getConfig(reservation.campgroundId);
    if (!gatewayConfig) {
      throw new BadRequestException("Payment gateway configuration is missing for this campground.");
    }
    if (gatewayConfig.mode === "prod" && !gatewayConfig.hasProductionCredentials) {
      throw new BadRequestException("Payment gateway is in production mode but credentials are not configured.");
    }
    if (gatewayConfig.gateway !== "stripe") {
      throw new BadRequestException(`Gateway ${gatewayConfig.gateway} is not yet supported.`);
    }
    ...
    const { amountCents, platformPassThroughFeeCents, gatewayPassThroughFeeCents, baseDue } = this.computeChargeAmounts({
      reservation,
      platformFeeMode: feeMode,
      applicationFeeCents,
      gatewayFeeMode: gatewayConfig?.feeMode ?? feeMode,
      gatewayFeePercentBasisPoints,
      gatewayFeeFlatCents,
      requestedAmountCents: body.amountCents
    });
```
- Idempotency and replay guardrails are applied on staff payment POSTs, POS checkout, and stored-value actions; completions mark snapshots and conflicts block duplicates.  
```257:356:platform/apps/api/src/payments/payments.controller.ts
  async createIntent(
    ...
    if (idempotencyKey) {
      const existing = await this.idempotency.start(idempotencyKey, body, campgroundId);
      if (existing.status === IdempotencyStatus.succeeded && existing.responseJson) {
        return existing.responseJson;
      }
      if (existing.status === IdempotencyStatus.inflight && existing.createdAt) {
        const ageMs = Date.now() - new Date(existing.createdAt).getTime();
        if (ageMs < 60000) {
          throw new ConflictException("Request already in progress");
        }
      }
    }
    ...
    if (idempotencyKey) {
      await this.idempotency.complete(idempotencyKey, response);
    }
```
```83:129:platform/apps/api/src/pos/pos.service.ts
  async checkout(cartId: string, dto: CheckoutCartDto, idempotencyKey?: string, actor?: any) {
    const existing = await this.guardIdempotency(idempotencyKey, { cartId, dto }, actor, "pos/checkout");
    if (existing?.status === IdempotencyStatus.succeeded && existing.responseJson) return existing.responseJson;
    ...
    if (hasCash && !cashTillSession) {
      throw new BadRequestException("No open till session for this terminal");
    }
```
```592:623:platform/apps/api/src/stored-value/stored-value.service.ts
  async liabilitySnapshot(campgroundId: string) {
    const accounts = await this.prisma.storedValueAccount.findMany({
      where: { campgroundId },
      select: { id: true, metadata: true }
    });
    ...
    return { campgroundId, taxableCents, nonTaxableCents, totalCents: taxableCents + nonTaxableCents };
  }
```
- POS split tender accuracy: carts are repriced server-side and any tender-total mismatch (>1¢) forces `needs_review`; cash requires an open till and cash movements are written.  
```90:129:platform/apps/api/src/pos/pos.service.ts
    const expected = this.reprice(cart);
    const expectedTotal = expected.totalCents;
    const tenderTotal = dto.payments.reduce((sum, p) => sum + p.amountCents, 0);
    const delta = tenderTotal - expectedTotal;
    const tolerance = 1; // cents
    if (Math.abs(delta) > tolerance) {
      const resp = await this.prisma.posCart.update({
        where: { id: cartId },
        data: { needsReview: true },
        include: { items: true, payments: true }
      });
      ...
    }
    const hasCash = dto.payments.some((p) => p.method === "cash");
    const cashTillSession = hasCash
      ? await this.till.findOpenSessionForTerminal(actor?.campgroundId ?? null, cart.terminalId)
      : null;
    if (hasCash && !cashTillSession) {
      throw new BadRequestException("No open till session for this terminal");
    }
```
- Till sessions enforce open/close flows, over/short calculation, duplicate-movement protection, and daily rollups; anomalies trigger audit events.  
```31:144:platform/apps/api/src/pos/till.service.ts
  async open(dto: OpenTillDto, actor: Actor) {
    ...
    const session = await this.prisma.tillSession.create({
      data: {
        campgroundId: actor.campgroundId,
        terminalId: dto.terminalId,
        openingFloatCents: dto.openingFloatCents,
        currency: dto.currency,
        notes: dto.notes,
        openedByUserId: actor.id
      }
    });
  }
  ...
  async close(id: string, dto: CloseTillDto, actor: Actor) {
    ...
    const overShort = dto.countedCloseCents - expected;
    const toleranceBreached = Math.abs(overShort) > OVER_SHORT_ALERT_TOLERANCE_CENTS;
    const updated = await this.prisma.tillSession.update({
      where: { id },
      data: {
        status: TillSessionStatus.closed,
        expectedCloseCents: expected,
        countedCloseCents: dto.countedCloseCents,
        overShortCents: overShort,
        closedAt: new Date(),
        closedByUserId: actor.id,
        notes: dto.notes ?? session.notes
      }
    });
```
- Offline POS replay dedupes by clientTxId + totals hash; mismatches land in review and success is recorded in observability metrics.  
```299:387:platform/apps/api/src/pos/pos.service.ts
  async replayOffline(dto: OfflineReplayDto, idempotencyKey?: string, actor?: any) {
    if (dto.clientTxId) {
      const seqExisting = await this.idempotency.findBySequence(scope, "pos/offline/replay", dto.clientTxId);
      if (seqExisting?.responseJson) {
        this.logger.warn(`Duplicate offline replay detected for seq ${dto.clientTxId} scope ${scope}`);
        return seqExisting.responseJson;
      }
      ...
    }
    ...
    const expectedHash = this.hashTotals(expected);
    ...
    const response = matches
      ? { clientTxId: dto.clientTxId, status: "accepted", cartId, expectedBreakdown: expected }
      : { clientTxId: dto.clientTxId, status: "needs_review", reason: "totals_mismatch", cartId, expectedBreakdown: expected, expectedHash, recordedTotalsHash: dto.recordedTotalsHash };
```
- Stored value enforces taxable/non-taxable load consistency, idempotent issue/reload/redeem, PIN checks, and liability snapshotting by taxability bucket.  
```31:158:platform/apps/api/src/stored-value/stored-value.service.ts
  async issue(dto: IssueStoredValueDto, idempotencyKey?: string, actor?: any) {
    ...
        const account =
          existingAccount ??
          (await tx.storedValueAccount.create({
            data: {
              campgroundId: campgroundId ?? dto.tenantId,
              type: dto.type,
              currency: dto.currency.toLowerCase(),
              status: StoredValueStatus.active,
              issuedAt: now,
              expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
              createdBy: actor?.id,
              createdVia: "api",
              metadata: this.mergeMetadata(dto.metadata, dto.taxableLoad)
            }
          }));
```

### Gaps / Risks
- Public payment intents do not use the idempotency service; retries could double-create PaymentIntents or double-apply pass-through fees.  
```406:477:platform/apps/api/src/payments/payments.controller.ts
  @Post("public/payments/intents")
  async createPublicIntent(@Body() body: CreatePublicPaymentIntentDto) {
    ...
    const intent = await this.stripeService.createPaymentIntent(
      amountCents,
      currency,
      metadata,
      stripeAccountId,
      applicationFeeCents,
      body.captureMethod === 'manual' ? 'manual' : 'automatic',
      this.getPaymentMethodTypes(capabilities)
    );
```
- SCA/3DS is not explicitly required; Stripe PaymentIntents rely on `automatic_payment_methods` defaults with no `request_three_d_secure` or regional policy controls, and there is no gateway failover beyond Stripe-only support.  
```31:59:platform/apps/api/src/payments/stripe.service.ts
    async createPaymentIntent(
        amountCents: number,
        currency: string,
        metadata: Record<string, string>,
        stripeAccountId: string,
        applicationFeeCents: number,
        captureMethod: 'automatic' | 'manual' = 'automatic',
        paymentMethodTypes?: string[],
        idempotencyKey?: string
    ) {
        this.assertConfigured("create payment intents");
        const requestOptions: Stripe.RequestOptions = {};
        if (idempotencyKey) {
            requestOptions.idempotencyKey = idempotencyKey;
        }
        return this.stripe.paymentIntents.create({
            amount: amountCents,
            currency,
            metadata,
            capture_method: captureMethod,
            automatic_payment_methods: {
                enabled: true,
            },
            payment_method_types: paymentMethodTypes,
            application_fee_amount: applicationFeeCents,
            transfer_data: {
                destination: stripeAccountId
            }
        }, requestOptions);
```
- No explicit retry/backoff or secondary-gateway failover for payment capture/refund or POS card payments; transient network errors propagate to callers without replay guidance.  
- Receipts are not auto-issued or itemized from payment flows; API responses simply return IDs/amounts and do not call `EmailService.sendPaymentReceipt` or include line items/tax/fee breakdowns.  
```338:352:platform/apps/api/src/payments/payments.controller.ts
      const response = {
        id: intent.id,
        clientSecret: intent.client_secret,
        amountCents,
        currency,
        reservationId: body.reservationId,
        status: intent.status,
        fees: feeBreakdown
      };
```
- POS offline replay dedupe stores only hash comparison and status; it does not persist tender details/line items from the offline payload, so reconciliation still depends on server cart presence.  
- Stored-value taxable-load enforcement depends on metadata flag consistency; there is no tax engine validation that “taxable_load” amounts align with jurisdictional requirements, and liability snapshotting relies on ledger integrity without independent roll-forward checks.  

## Compliance & Ops
- E-sign / waivers / COI: Signatures module issues and audits signature requests (types include waiver/coi), stores signed artifacts, and auto-reminds expiring COIs; waivers module can generate inline PDFs when enabled. Gaps: self-check-in only flags `waiverRequired` but never verifies a signed waiver or ID verification completion.  
```131:181:platform/apps/api/src/signatures/signatures.service.ts
  async createAndSend(dto: CreateSignatureRequestDto, actorId: string | null) {
    ...
    await this.audit.record({
      campgroundId,
      actorId,
      action: "signature.request_sent",
      entity: "SignatureRequest",
      entityId: created.id,
      after: { status: created.status, documentType, reservationId: created.reservationId, guestId: created.guestId }
    });
    return { request: created, signingUrl: this.signingUrl(token) };
  }
```
```289:520:platform/apps/api/src/signatures/signatures.service.ts
    let artifact = await this.prisma.signatureArtifact.findUnique({ where: { requestId: request.id } });
    if (dto.status === "signed") {
      const pdfUrl = dto.pdfUrl || this.buildStubPdf(updatedRequest, dto);
      ...
    }
    ...
  async createCoi(dto: CoiUploadDto, actorId: string | null) {
    ...
    await this.audit.record({
      campgroundId: dto.campgroundId,
      actorId,
      action: "coi.uploaded",
      entity: "CoiUpload",
      entityId: upload.id,
      after: { reservationId: dto.reservationId, guestId: dto.guestId, expiresAt }
    });
  }
  @Cron(CronExpression.EVERY_10_MINUTES)
  async dispatchReminders() {
    ...
    const coiCandidates = await this.prisma.coiUpload.findMany({
      where: {
        status: { in: [CoiStatus.pending, CoiStatus.active] },
        expiresAt: { lte: expiryThreshold },
        OR: [{ reminderAt: null }, { reminderAt: { lte: now } }]
      },
      take: 25
    });
    ...
  }
```
```48:51:platform/apps/api/src/self-checkin/self-checkin.service.ts
    // Check waiver if required
    if (reservation.waiverRequired) {
      // TODO: Check if waiver signed
      // For now, assume it's handled elsewhere or skip
    }
```
- Check-in enforcement + overrides: Self-checkin enforces prerequisites unless `override` is passed; it does not verify signed waivers/IDV, and override bypass leaves no audit trail or reporting hook. Policy gap: “cannot check in unless waivers signed unless staff override; overrides must appear in a report.” Current state: overrides are generic (`overrideRequest`) but not tied to check-in nor exported/reported.  
```78:145:platform/apps/api/src/self-checkin/self-checkin.service.ts
  async selfCheckin(
    reservationId: string,
    options?: { lateArrival?: boolean; override?: boolean },
  ): Promise<CheckinResult> {
    // Validate prerequisites unless override
    if (!options?.override) {
      const validation = await this.validateCheckinPrerequisites(reservationId);
      if (!validation.valid) {
        ...
        return { status: 'failed', reason: validation.reason };
      }
    }
    const now = new Date();
    const reservation = await this.prisma.reservation.update({
      where: { id: reservationId },
      data: {
        checkInStatus: 'completed',
        selfCheckInAt: now,
        lateArrivalFlag: options?.lateArrival ?? false,
        status: 'checked_in',
      },
      include: { campground: true, guest: true, site: true },
    });
    ...
  }
```
```24:52:platform/apps/api/src/self-checkin/self-checkin.service.ts
    // Check ID verification if required
    if (reservation.idVerificationRequired) {
      // TODO: Check if ID verification completed via external service
      // For now, assume it's handled elsewhere or skip
    }
    // Check waiver if required
    if (reservation.waiverRequired) {
      // TODO: Check if waiver signed
      // For now, assume it's handled elsewhere or skip
    }
```
```288:352:platform/apps/api/src/staff/staff.service.ts
  async requestOverride(dto: OverrideRequestDto) {
    const record = await (this.prisma as any).overrideRequest.create({
      data: {
        campgroundId: dto.campgroundId,
        userId: dto.userId,
        type: dto.type,
        reason: dto.reason,
        targetEntity: dto.targetEntity ?? null,
        targetId: dto.targetId ?? null,
        deltaAmount: dto.deltaAmount ?? null,
        metadata: dto.metadata ?? null,
        status: "pending"
      }
    });
    await this.audit.record({
      campgroundId: dto.campgroundId,
      actorId: dto.userId,
      action: "override.request",
      entity: dto.targetEntity ?? "override",
      entityId: record.id,
      after: record
    });
    return record;
  }
  ...
  async decideOverride(id: string, approverId: string, status: "approved" | "rejected" | "cancelled", note?: string) {
    const existing = await (this.prisma as any).overrideRequest.findUnique({ where: { id } });
    ...
    await this.audit.record({
      campgroundId: existing.campgroundId,
      actorId: approverId,
      action: `override.${status}`,
      entity: existing.targetEntity ?? "override",
      entityId: existing.targetId ?? id,
      before: existing,
      after: updated
    });
  }
```
- Kiosk check-in: Kiosk flow marks reservations checked_in without validating waivers or ID verification and has no override recording or audit linkage; only pending forms block the check-in. Requires adding waiver/ID enforcement and logging any staff override to a report.  
```1654:1720:platform/apps/api/src/reservations/reservations.service.ts
  async kioskCheckIn(id: string, upsellTotalCents: number) {
    ...
    // Require forms to be completed before check-in
    const pendingForms = await (this.prisma as any).formSubmission?.count?.({
      where: { reservationId: id, status: "pending" }
    }) ?? 0;
    if (pendingForms > 0) {
      throw new ConflictException("Forms must be completed before check-in");
    }
    ...
    const updated = await this.prisma.reservation.update({
      where: { id },
      data: {
        status: ReservationStatus.checked_in,
        checkInAt: new Date(),
        ...
      }
    });
    ...
  }
```
- Kiosk waiver capture: Kiosk flow never surfaces or collects required waivers/signatures; guests cannot sign on-device before status flips to `checked_in`. Needs embedded signature request (or redirect to `/sign/:token`) and a block until signed.  
```1654:1720:platform/apps/api/src/reservations/reservations.service.ts
  async kioskCheckIn(id: string, upsellTotalCents: number) {
    ...
    if (pendingForms > 0) {
      throw new ConflictException("Forms must be completed before check-in");
    }
    // No waiver/ID verification enforcement or signature capture is invoked here
    ...
    const updated = await this.prisma.reservation.update({
      where: { id },
      data: {
        status: ReservationStatus.checked_in,
        checkInAt: new Date(),
        ...
      }
    });
    ...
  }
```
- Access control on check-in/out: Grant/revoke flows exist with idempotency and provider adapters, but reservation status changes only block access on cancel/checkout—no automatic grant or un-block on check-in, so door/lock provisioning depends on separate manual calls.  
```161:304:platform/apps/api/src/access-control/access-control.service.ts
  async grantAccess(reservationId: string, dto: GrantAccessDto) {
    ...
    const result = await adapter.provisionAccess(integration, {
      reservationId,
      siteId: reservation.siteId,
      ...
    });
    const updated = await this.grantsRepo().update({
      where: { id: grant.id },
      data: {
        providerAccessId: result.providerAccessId ?? grant.providerAccessId,
        status: result.status ?? AccessGrantStatus.active,
        lastSyncAt: new Date()
      }
    });
    ...
  }
  async revokeAccess(reservationId: string, dto: RevokeAccessDto) {
    ...
    const result = await adapter.revokeAccess(integration, {
      reservationId,
      providerAccessId: dto.providerAccessId ?? grant.providerAccessId ?? undefined,
      reason: dto.reason
    });
    const updated = await this.grantsRepo().update({
      where: { id: grant.id },
      data: {
        status: result.status ?? AccessGrantStatus.revoked,
        blockedReason: dto.reason ?? grant.blockedReason ?? null,
        lastSyncAt: new Date()
      }
    });
    ...
  }
```
```1190:1235:platform/apps/api/src/reservations/reservations.service.ts
        if (data.status === 'cancelled' && existing.status !== 'cancelled') {
          ...
          await this.accessControl.blockAccessForReservation(id, "reservation_cancelled");
        }
        ...
        if (data.status === ReservationStatus.checked_out && existing.status !== ReservationStatus.checked_out) {
          ...
          await this.accessControl.blockAccessForReservation(id, "checked_out");
        }
```
- Incident log / evidence / exports: Incidents support creation, status updates/close, evidence uploads, COI attachment, tasks with reminders, claim linkage, and CSV/JSON summary exports with per-status/type breakdown.  
```24:214:platform/apps/api/src/incidents/incidents.service.ts
  async list(campgroundId: string) {
    return this.prisma.incident.findMany({
      where: { campgroundId },
      include: { tasks: true, evidence: true },
      orderBy: { createdAt: "desc" },
    });
  }
  ...
  async addEvidence(incidentId: string, dto: AddEvidenceDto) {
    ...
    return this.prisma.incidentEvidence.create({
      data: {
        incidentId,
        type: dto.type ?? EvidenceType.photo,
        url: dto.url,
        storageKey: dto.storageKey,
        description: dto.description,
        uploadedBy: dto.uploadedBy,
        metadata: dto.url ? { source: "direct_url" } : undefined,
      },
    });
  }
  ...
  async report(campgroundId: string, format?: string) {
    const byStatus = await this.prisma.incident.groupBy({
      by: ["status"],
      _count: { _all: true },
      where: { campgroundId },
      orderBy: { status: "asc" },
    });
    ...
    if (format === "csv") {
      const statusLines = byStatus.map((s) => `${s.status},${s._count._all}`).join("\n");
      ...
      return `section,count\n${statusLines}\n---\n${typeLines}\nopenTasks,${openTasks}`;
    }
    return summary;
  }
```
- Referrals + reason-for-stay capture/reporting: Reservation creation accepts referral code/program + stayReason preset/other, stores incentive amounts and sources, and reporting surfaces performance and reason breakdowns.  
```883:1018:platform/apps/api/src/reservations/reservations.service.ts
        if (data.referralProgramId || data.referralCode) {
          referralProgram = await (this.prisma as any).referralProgram.findFirst({
            where: {
              campgroundId: data.campgroundId,
              isActive: true,
              OR: [
                data.referralProgramId ? { id: data.referralProgramId } : undefined,
                data.referralCode ? { code: data.referralCode } : undefined,
                data.referralCode ? { linkSlug: data.referralCode } : undefined
              ].filter(Boolean) as any[]
            }
          });
          ...
        }
        ...
        const reservation = await this.prisma.reservation.create({
          data: {
            ...
            referralProgramId: referralProgram?.id ?? data.referralProgramId ?? null,
            referralCode: referralProgram?.code ?? data.referralCode ?? null,
            referralSource: referralSource ?? null,
            referralChannel: referralChannel ?? null,
            referralIncentiveType: referralIncentiveType,
            referralIncentiveValue: referralDiscountCents || referralIncentiveValue || null,
            stayReasonPreset: data.stayReasonPreset ?? null,
            stayReasonOther: data.stayReasonOther ?? null,
            ...
          },
```
```232:340:platform/apps/api/src/reports/reports.service.ts
    async getReferralPerformance(campgroundId: string, startDate?: string, endDate?: string) {
      ...
      return {
        period: { start, end },
        totalBookings: reservations.length,
        totalRevenueCents,
        totalReferralDiscountCents,
        programs: Object.values(byProgram)
      };
    }

    async getStayReasonBreakdown(campgroundId: string, startDate?: string, endDate?: string) {
      ...
      return {
        period: { start, end },
        breakdown: Object.values(byReason).sort((a, b) => b.count - a.count),
        otherReasons
      };
    }
```
- Staff UI loading: Add a “fun” blocking loading/processing screen on staff payments while waiting for processor responses (e.g., `platform/apps/web/app/campgrounds/[campgroundId]/reservations/page.tsx` and POS checkout). Should show animation/progress, timeout/fallback messaging, and stay idempotent-friendly during retry.
