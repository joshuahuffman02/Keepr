import { Injectable } from "@nestjs/common";

type Sample = {
  ts: number;
  durationMs: number;
  statusCode: number;
  route: string;
  orgId?: string | null;
  ip?: string | null;
};

type LimiterEvent = {
  ts: number;
  type: "ip" | "org";
};

@Injectable()
export class PerfService {
  private samples: Sample[] = [];
  private limiterEvents: LimiterEvent[] = [];

  private readonly windowMs = Number(process.env.PERF_WINDOW_MS ?? 300_000); // 5 minutes default
  private readonly maxSamples = 500;

  recordSample(sample: Omit<Sample, "ts"> & { ts?: number }) {
    const entry: Sample = { ts: sample.ts ?? Date.now(), ...sample };
    this.samples.push(entry);
    if (this.samples.length > this.maxSamples) {
      this.samples.splice(0, this.samples.length - this.maxSamples);
    }
    this.prune(entry.ts);
  }

  recordLimiterHit(type: LimiterEvent["type"], ts: number = Date.now()) {
    this.limiterEvents.push({ ts, type });
    this.prune(ts);
  }

  getSnapshot() {
    const now = Date.now();
    this.prune(now);
    const windowStart = now - this.windowMs;

    const windowSamples = this.samples.filter((s) => s.ts >= windowStart);
    const durations = windowSamples.map((s) => s.durationMs).sort((a, b) => a - b);
    const total = windowSamples.length;
    const errors = windowSamples.filter((s) => s.statusCode >= 500).length;

    const limiterWindow = this.limiterEvents.filter((e) => e.ts >= windowStart);
    const limiter = {
      ip: limiterWindow.filter((e) => e.type === "ip").length,
      org: limiterWindow.filter((e) => e.type === "org").length,
    };

    return {
      timestamp: new Date(now).toISOString(),
      windowMs: this.windowMs,
      counts: { total, errors },
      latencyMs: {
        p50: this.percentile(durations, 0.5),
        p95: this.percentile(durations, 0.95),
        p99: this.percentile(durations, 0.99),
      },
      errorRate: total === 0 ? 0 : errors / total,
      limiter,
    };
  }

  private percentile(values: number[], percentile: number): number | null {
    if (values.length === 0) return null;
    if (values.length === 1) return values[0];
    const index = Math.min(values.length - 1, Math.floor((values.length - 1) * percentile));
    return values[index];
  }

  private prune(now: number) {
    const cutoff = now - this.windowMs;
    this.samples = this.samples.filter((s) => s.ts >= cutoff);
    this.limiterEvents = this.limiterEvents.filter((e) => e.ts >= cutoff);
  }
}
