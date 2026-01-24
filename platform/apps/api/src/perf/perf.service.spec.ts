import { PerfService } from "./perf.service";

describe("PerfService", () => {
  let service: PerfService;

  beforeEach(() => {
    service = new PerfService();
  });

  it("computes latency percentiles and error rate", () => {
    const samples = [100, 150, 200, 250, 300];
    samples.forEach((duration, index) =>
      service.recordSample({
        durationMs: duration,
        statusCode: index === samples.length - 1 ? 500 : 200,
        route: "GET /test",
      }),
    );

    const snapshot = service.getSnapshot();
    expect(snapshot.latencyMs.p50).toBe(200);
    expect(snapshot.latencyMs.p95).toBe(250);
    expect(snapshot.latencyMs.p99).toBe(250);
    expect(snapshot.errorRate).toBeCloseTo(0.2);
    expect(snapshot.counts.total).toBe(5);
    expect(snapshot.counts.errors).toBe(1);
  });

  it("drops samples outside the window and tracks limiter hits", () => {
    const now = Date.now();
    service.recordSample({
      durationMs: 50,
      statusCode: 200,
      route: "GET /old",
      ts: now - 400_000,
    });
    service.recordLimiterHit("ip", now - 400_000);

    service.recordSample({
      durationMs: 120,
      statusCode: 200,
      route: "GET /new",
      ts: now,
    });
    service.recordLimiterHit("org", now);

    const snapshot = service.getSnapshot();
    expect(snapshot.counts.total).toBe(1);
    expect(snapshot.limiter.ip).toBe(0);
    expect(snapshot.limiter.org).toBe(1);
  });
});
