import { Test, type TestingModule } from "@nestjs/testing";
import { HealthService } from "../health/health.service";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { ObservabilityService } from "../observability/observability.service";

describe("Healthz endpoint", () => {
  let moduleRef: TestingModule;
  let service: HealthService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: { $queryRaw: jest.fn().mockResolvedValue([1]) } },
        {
          provide: RedisService,
          useValue: { isEnabled: true, ping: jest.fn().mockResolvedValue("PONG") },
        },
        {
          provide: ObservabilityService,
          useValue: {
            snapshot: jest.fn().mockReturnValue({
              captured: 1,
              targets: {
                apiP95Ms: 800,
                apiErrorRate: 0.01,
                jobP95Ms: 30000,
                jobFailureRate: 0.02,
                webLcpP75Ms: 2500,
                webTtfbP75Ms: 500,
              },
              api: { count: 2, errors: 0, p50: 10, p95: 20, p99: 30, avg: 15, recentErrors: [] },
              jobs: {
                count: 1,
                errors: 0,
                p50: 50,
                p95: 60,
                p99: 70,
                avg: 55,
                queues: { default: { running: 0, queued: 0 } },
              },
              web: {
                lcp: { count: 0, errors: 0, p50: 0, p95: 0, p99: 0, avg: 0 },
                ttfb: { count: 0, errors: 0, p50: 0, p95: 0, p99: 0, avg: 0 },
                p75: { lcp: 0, ttfb: 0 },
              },
              synthetics: {},
            }),
            recordReady: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(HealthService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it("returns liveness for /health", async () => {
    const res = await service.liveness();
    expect(res.ok).toBe(true);
    expect(res.status).toBe("up");
    expect(res.uptimeMs).toBeGreaterThan(0);
  });

  it("returns readiness snapshot with checks and perf", async () => {
    const res = await service.readiness();
    expect(res.ok).toBe(true);
    expect(res.checks).toBeDefined();
    expect(res.perf).toBeDefined();
    expect(Array.isArray(res.queues)).toBe(true);
  });
});
