import { PerfService } from "../perf/perf.service";
import { ObservabilityService } from "../observability/observability.service";

describe("Perf/Observability smoke", () => {
  let perfService: PerfService;
  let observabilityService: ObservabilityService;

  beforeAll(async () => {
    perfService = new PerfService();
    observabilityService = new ObservabilityService();
  });

  it("returns perf snapshot shape", async () => {
    const res = perfService.getSnapshot();
    expect(res).toMatchObject({
      timestamp: expect.any(String),
      windowMs: expect.any(Number),
      counts: expect.any(Object),
      latencyMs: expect.any(Object),
      errorRate: expect.any(Number),
      limiter: expect.any(Object),
    });
    expect(res.latencyMs).toHaveProperty("p50");
    expect(res.latencyMs).toHaveProperty("p95");
    expect(res.latencyMs).toHaveProperty("p99");
  });

  it("returns SLO snapshot shape", async () => {
    const res = observabilityService.snapshot();
    expect(res).toMatchObject({
      captured: expect.any(Number),
      targets: expect.objectContaining({
        apiP95Ms: expect.any(Number),
        apiErrorRate: expect.any(Number),
        jobP95Ms: expect.any(Number),
        jobFailureRate: expect.any(Number),
      }),
      api: expect.any(Object),
      jobs: expect.any(Object),
    });
    expect(res.targets.apiErrorRate).toBeGreaterThanOrEqual(0);
    expect(res.targets.jobFailureRate).toBeGreaterThanOrEqual(0);
    expect(res.api).toEqual(
      expect.objectContaining({
        count: expect.any(Number),
        p95: expect.any(Number),
        p99: expect.any(Number),
        errors: expect.any(Number),
      }),
    );
    expect(res.jobs).toEqual(
      expect.objectContaining({
        count: expect.any(Number),
        p95: expect.any(Number),
        p99: expect.any(Number),
        errors: expect.any(Number),
        queues: expect.any(Object),
      }),
    );
  });

  it("returns breaches shape", async () => {
    const res = observabilityService.alerts();
    expect(res).toMatchObject({
      captured: expect.any(Number),
      targets: expect.objectContaining({
        apiP95Ms: expect.any(Number),
        apiErrorRate: expect.any(Number),
        jobP95Ms: expect.any(Number),
        jobFailureRate: expect.any(Number),
      }),
      api: expect.objectContaining({
        p95: expect.any(Number),
        errorRate: expect.any(Number),
        breaches: expect.any(Object),
      }),
      jobs: expect.objectContaining({
        p95: expect.any(Number),
        failureRate: expect.any(Number),
        breaches: expect.any(Object),
      }),
      queues: expect.objectContaining({
        maxDepth: expect.any(Number),
        depthBreaches: expect.any(Array),
      }),
    });
  });
});
