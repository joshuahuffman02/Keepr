import { Injectable } from "@nestjs/common";

type ApiSample = {
  method: string;
  path: string;
  status: number;
  durationMs: number;
  at: number;
};

type JobSample = {
  name: string;
  durationMs: number;
  success: boolean;
  queueDepth: number;
  at: number;
};

type DomainSample = {
  ok: boolean;
  latencyMs?: number;
  at: number;
  kind?: string;
  value?: number;
  meta?: Record<string, unknown>;
};

type DomainKey = "redeem" | "offline" | "offer" | "report" | "comms" | "ota" | "ready";

type Aggregate = {
  count: number;
  errors: number;
  p50: number;
  p95: number;
  p99: number;
  avg: number;
};

type ObservabilitySnapshot = {
  captured: number;
  targets: {
    apiP95Ms: number;
    apiErrorRate: number;
    jobP95Ms: number;
    jobFailureRate: number;
    webLcpP75Ms: number;
    webTtfbP75Ms: number;
  };
  api: Aggregate & {
    recentErrors: { path: string; status: number; at: number }[];
  };
  jobs: Aggregate & {
    queues: Record<
      string,
      { running: number; queued: number; oldestMs?: number; rawName?: string }
    >;
  };
  web: {
    lcp: Aggregate;
    ttfb: Aggregate;
    p75: { lcp: number; ttfb: number };
  };
  synthetics: Record<string, { ok: boolean; latencyMs?: number; at: number; message?: string }>;
};

type CommsProviderTotals = {
  total: number;
  delivered: number;
  failures: number;
};

type CommsTotals = {
  total: number;
  delivered: number;
  bounced: number;
  complaints: number;
  failures: number;
  byProvider: Record<string, CommsProviderTotals>;
};

@Injectable()
export class ObservabilityService {
  private readonly apiSamples: ApiSample[] = [];
  private readonly jobSamples: JobSample[] = [];
  private readonly queues: Record<
    string,
    {
      running: number;
      queued: number;
      oldestMs?: number;
      maxQueue?: number;
      concurrency?: number;
      updatedAt?: number;
      rawName?: string;
    }
  > = {};
  private readonly domainEvents: Record<string, DomainSample[]> = {
    redeem: [],
    offline: [],
    offer: [],
    report: [],
    comms: [],
    ota: [],
    ready: [],
  };
  private readonly webLcpSamples: DomainSample[] = [];
  private readonly webTtfbSamples: DomainSample[] = [];
  private readonly syntheticResults: Record<
    string,
    { ok: boolean; latencyMs?: number; at: number; message?: string }
  > = {};
  private readonly maxSamples = Number(process.env.OBS_MAX_SAMPLES ?? 800);
  private readonly targets = {
    apiP95Ms: Number(process.env.SLO_API_P95_MS ?? 400),
    apiErrorRate: Number(process.env.SLO_API_ERROR_RATE ?? 0.01),
    jobP95Ms: Number(process.env.SLO_JOB_P95_MS ?? 30000),
    jobFailureRate: Number(process.env.SLO_JOB_FAILURE_RATE ?? 0.02),
    webLcpP75Ms: Number(process.env.SLO_WEB_LCP_P75_MS ?? 2500),
    webTtfbP75Ms: Number(process.env.SLO_WEB_TTFB_P75_MS ?? 500),
    smsFailureRate: Number(process.env.SLO_SMS_FAILURE_RATE ?? 0.05),
    smsMinFailures: Number(process.env.SLO_SMS_MIN_FAILURES ?? 3),
  };
  private readonly queueMaxDepth = Number(process.env.SLO_QUEUE_MAX_DEPTH ?? 200);
  private readonly queueLagThresholdMs = Number(process.env.SLO_QUEUE_LAG_MS ?? 5 * 60 * 1000);
  private readonly domainWindowMs = Number(process.env.OBS_DOMAIN_WINDOW_MS ?? 15 * 60 * 1000); // 15 minutes

  recordApiRequest(sample: Omit<ApiSample, "at">) {
    this.apiSamples.unshift({ ...sample, at: Date.now() });
    if (this.apiSamples.length > this.maxSamples) {
      this.apiSamples.pop();
    }
  }

  recordJobRun(sample: Omit<JobSample, "at">) {
    this.jobSamples.unshift({ ...sample, at: Date.now() });
    if (this.jobSamples.length > this.maxSamples) {
      this.jobSamples.pop();
    }
  }

  setQueueState(
    queue: string,
    running: number,
    queued: number,
    oldestMs?: number,
    meta?: { maxQueue?: number; concurrency?: number },
  ) {
    const normalized = this.normalizeQueueName(queue);
    this.queues[normalized] = {
      running,
      queued,
      oldestMs,
      maxQueue: meta?.maxQueue,
      concurrency: meta?.concurrency,
      updatedAt: Date.now(),
      rawName: queue,
    };
  }

  recordRedeemOutcome(ok: boolean, latencyMs?: number, meta?: Record<string, unknown>) {
    this.emit("redeem", { ok, latencyMs, meta });
  }

  recordOfflineReplay(ok: boolean, latencyMs?: number, meta?: Record<string, unknown>) {
    this.emit("offline", { ok, latencyMs, meta });
  }

  recordOfferLag(seconds: number, meta?: Record<string, unknown>) {
    this.emit("offer", { ok: seconds <= 30, latencyMs: seconds * 1000, value: seconds, meta });
  }

  recordReportResult(ok: boolean, latencyMs?: number, meta?: Record<string, unknown>) {
    this.emit("report", { ok, latencyMs, meta });
  }

  recordCommsStatus(
    status: "delivered" | "sent" | "bounced" | "spam_complaint" | "failed",
    meta?: Record<string, unknown>,
  ) {
    const ok = status === "delivered" || status === "sent";
    this.emit("comms", { ok, kind: status, meta });
  }

  recordOtaStatus(ok: boolean, backlogSeconds?: number, meta?: Record<string, unknown>) {
    this.emit("ota", { ok, value: backlogSeconds, meta });
  }

  recordWebMetric(kind: "lcp" | "ttfb", valueMs: number) {
    const entry: DomainSample = { ok: true, value: valueMs, latencyMs: valueMs, at: Date.now() };
    const targetArray = kind === "lcp" ? this.webLcpSamples : this.webTtfbSamples;
    targetArray.unshift(entry);
    if (targetArray.length > this.maxSamples) targetArray.pop();
  }

  recordSynthetic(name: string, ok: boolean, latencyMs?: number, message?: string) {
    this.syntheticResults[name] = { ok, latencyMs, at: Date.now(), message };
  }

  recordReady(ok: boolean, meta?: Record<string, unknown>) {
    this.emit("ready", { ok, meta });
  }

  emit(key: DomainKey, event: Omit<DomainSample, "at"> & { at?: number }) {
    this.recordDomainEvent(key, event);
  }

  snapshot(): ObservabilitySnapshot {
    const apiAgg = this.aggregate(this.apiSamples.map((s) => s.durationMs));
    const jobAgg = this.aggregate(this.jobSamples.map((s) => s.durationMs));
    const lcpAgg = this.aggregate(this.webLcpSamples.map((s) => s.value ?? 0));
    const ttfbAgg = this.aggregate(this.webTtfbSamples.map((s) => s.value ?? 0));
    const percentile = (values: number[], p: number) => {
      if (!values.length) return 0;
      const sorted = [...values].sort((a, b) => a - b);
      const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
      return sorted[idx];
    };
    const lcpP75 = percentile(
      this.webLcpSamples.map((s) => s.value ?? 0),
      0.75,
    );
    const ttfbP75 = percentile(
      this.webTtfbSamples.map((s) => s.value ?? 0),
      0.75,
    );

    return {
      captured: Math.max(this.apiSamples.length, this.jobSamples.length),
      targets: this.targets,
      api: {
        ...apiAgg,
        errors: this.apiSamples.filter((s) => s.status >= 400).length,
        recentErrors: this.apiSamples
          .filter((s) => s.status >= 400)
          .slice(0, 10)
          .map((s) => ({ path: s.path, status: s.status, at: s.at })),
      },
      jobs: {
        ...jobAgg,
        errors: this.jobSamples.filter((s) => !s.success).length,
        queues: this.queues,
      },
      web: {
        lcp: lcpAgg,
        ttfb: ttfbAgg,
        p75: { lcp: lcpP75, ttfb: ttfbP75 },
      },
      synthetics: this.syntheticResults,
    };
  }

  alerts() {
    const snapshot = this.snapshot();
    const apiErrorRate = snapshot.api.count ? snapshot.api.errors / snapshot.api.count : 0;
    const jobFailureRate = snapshot.jobs.count ? snapshot.jobs.errors / snapshot.jobs.count : 0;
    const queues = snapshot.jobs.queues || {};
    const queueDepthBreaches = Object.entries(queues)
      .filter(([, state]) => (state?.queued ?? 0) > this.queueMaxDepth)
      .map(([name, state]) => ({
        name: state.rawName ?? name,
        queued: state.queued,
        running: state.running,
      }));
    const queueLagBreaches = Object.entries(queues)
      .filter(([, state]) => (state?.oldestMs ?? 0) > this.queueLagThresholdMs)
      .map(([name, state]) => ({
        name: state.rawName ?? name,
        oldestMs: state.oldestMs,
        queued: state.queued,
      }));

    const percentile = (values: number[], p: number) => {
      if (!values.length) return 0;
      const sorted = [...values].sort((a, b) => a - b);
      const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
      return sorted[idx];
    };

    const windowStart = Date.now() - this.domainWindowMs;
    const domainRate = (key: string) => {
      const events = (this.domainEvents[key] || []).filter((e) => e.at >= windowStart);
      const total = events.length;
      const failures = events.filter((e) => !e.ok).length;
      const failureRate = total === 0 ? 0 : failures / total;
      return { total, failures, failureRate, events };
    };

    const redeemStats = domainRate("redeem");
    const offlineStats = domainRate("offline");
    const offerStats = domainRate("offer");
    const reportStats = domainRate("report");
    const commsEvents = (this.domainEvents["comms"] || []).filter((e) => e.at >= windowStart);
    const initialCommsTotals: CommsTotals = {
      total: 0,
      delivered: 0,
      bounced: 0,
      complaints: 0,
      failures: 0,
      byProvider: {},
    };
    const commsTotals = commsEvents.reduce((acc, e) => {
      const status = e.kind ?? "sent";
      const provider = typeof e.meta?.provider === "string" ? e.meta.provider : "unknown";
      acc.total += 1;
      acc.byProvider[provider] = acc.byProvider[provider] ?? {
        total: 0,
        delivered: 0,
        failures: 0,
      };
      acc.byProvider[provider].total += 1;
      if (status === "delivered" || status === "sent") {
        acc.delivered += 1;
        acc.byProvider[provider].delivered += 1;
      }
      if (status === "bounced") acc.bounced += 1;
      if (status === "spam_complaint") acc.complaints += 1;
      if (!e.ok) {
        acc.failures += 1;
        acc.byProvider[provider].failures += 1;
      }
      return acc;
    }, initialCommsTotals);
    const commsDeliveryRate =
      commsTotals.total === 0 ? 1 : commsTotals.delivered / commsTotals.total;
    const commsBounceRate = commsTotals.total === 0 ? 0 : commsTotals.bounced / commsTotals.total;
    const commsComplaintRate =
      commsTotals.total === 0 ? 0 : commsTotals.complaints / commsTotals.total;
    const twilio = commsTotals.byProvider["twilio"] || { total: 0, failures: 0, delivered: 0 };
    const smsFailureRate = twilio.total === 0 ? 0 : twilio.failures / twilio.total;

    const webLcp = snapshot.web.lcp;
    const webTtfb = snapshot.web.ttfb;
    const lcpValues = this.webLcpSamples.map((s) => s.value ?? 0);
    const ttfbValues = this.webTtfbSamples.map((s) => s.value ?? 0);
    const webLcpP75 = percentile(lcpValues, 0.75);
    const webTtfbP75 = percentile(ttfbValues, 0.75);

    const otaEvents = domainRate("ota");
    const otaBacklogBreaches = otaEvents.events
      .filter((e) => typeof e.value === "number" && (e.value ?? 0) > 900)
      .map((e) => ({ backlogSeconds: e.value, meta: e.meta }));

    const readyEvents = (this.domainEvents["ready"] || []).filter((e) => e.at >= windowStart);
    const lastReadyOkAt =
      readyEvents.filter((e) => e.ok).sort((a, b) => b.at - a.at)[0]?.at ?? null;
    const readyFailures = readyEvents.filter((e) => !e.ok);
    const readyBreach =
      readyFailures.length > 0 && (!lastReadyOkAt || Date.now() - lastReadyOkAt > 2 * 60 * 1000);

    return {
      captured: snapshot.captured,
      targets: this.targets,
      api: {
        p95: snapshot.api.p95,
        errorRate: apiErrorRate,
        breaches: {
          p95: snapshot.api.p95 > this.targets.apiP95Ms,
          errorRate: apiErrorRate > this.targets.apiErrorRate,
        },
      },
      jobs: {
        p95: snapshot.jobs.p95,
        failureRate: jobFailureRate,
        breaches: {
          p95: snapshot.jobs.p95 > this.targets.jobP95Ms,
          failureRate: jobFailureRate > this.targets.jobFailureRate,
        },
      },
      queues: {
        maxDepth: this.queueMaxDepth,
        depthBreaches: queueDepthBreaches,
        lagBreaches: queueLagBreaches,
        state: queues,
      },
      domain: {
        redeem: {
          failureRate: redeemStats.failureRate,
          total: redeemStats.total,
          failures: redeemStats.failures,
          breach: redeemStats.failureRate > 0.05 && redeemStats.failures >= 3,
        },
        offlineBacklog: {
          total: offlineStats.total,
          failures: offlineStats.failures,
          breach:
            offlineStats.failureRate > 0.1 ||
            queueDepthBreaches.some((q) => q.name.includes("offline")),
        },
        offerLag: {
          samples: offerStats.total,
          maxSeconds: Math.max(0, ...offerStats.events.map((e) => e.value ?? 0)),
          breach: offerStats.events.some((e) => (e.value ?? 0) > 300),
        },
        reports: {
          failureRate: reportStats.failureRate,
          total: reportStats.total,
          failures: reportStats.failures,
          breach: reportStats.failureRate > 0.05 && reportStats.failures >= 1,
        },
        ready: {
          lastOkAt: lastReadyOkAt,
          failures: readyFailures.length,
          breach: readyBreach,
        },
      },
      comms: {
        deliveryRate: commsDeliveryRate,
        bounceRate: commsBounceRate,
        complaintRate: commsComplaintRate,
        totals: commsTotals,
        breaches: {
          delivery: commsDeliveryRate < 0.98,
          bounce: commsBounceRate > 0.02,
          complaint: commsComplaintRate > 0.01,
          smsFailures:
            smsFailureRate > this.targets.smsFailureRate &&
            twilio.failures >= this.targets.smsMinFailures,
        },
        providers: {
          twilio: {
            failureRate: smsFailureRate,
            failures: twilio.failures,
            total: twilio.total,
          },
        },
      },
      web: {
        lcp: webLcp,
        ttfb: webTtfb,
        p75: { lcp: webLcpP75, ttfb: webTtfbP75 },
        breaches: {
          lcp: webLcpP75 > this.targets.webLcpP75Ms,
          ttfb: webTtfbP75 > this.targets.webTtfbP75Ms,
        },
      },
      synthetics: this.syntheticResults,
      ota: {
        backlogBreaches: otaBacklogBreaches,
      },
    };
  }

  private recordDomainEvent(key: string, event: Omit<DomainSample, "at"> & { at?: number }) {
    if (!this.domainEvents[key]) {
      this.domainEvents[key] = [];
    }
    this.domainEvents[key].unshift({ ...event, at: event.at ?? Date.now() });
    if (this.domainEvents[key].length > this.maxSamples) {
      this.domainEvents[key].pop();
    }
  }

  private normalizeQueueName(name: string) {
    const lower = (name || "").toLowerCase();
    if (lower.includes("dead") && lower.includes("letter") && !lower.includes("dlq")) {
      return `${lower}-dlq`;
    }
    return lower;
  }

  private aggregate(durations: number[]): Aggregate {
    if (durations.length === 0) {
      return { count: 0, errors: 0, p50: 0, p95: 0, p99: 0, avg: 0 };
    }
    const sorted = [...durations].sort((a, b) => a - b);
    const quantile = (p: number) => {
      const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
      return sorted[idx];
    };
    const total = sorted.reduce((sum, n) => sum + n, 0);
    return {
      count: durations.length,
      errors: 0,
      p50: quantile(0.5),
      p95: quantile(0.95),
      p99: quantile(0.99),
      avg: Math.round((total / durations.length) * 100) / 100,
    };
  }
}
