import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as request from "supertest";
import { HealthModule } from "../health/health.module";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { ObservabilityService } from "../observability/observability.service";
import { ScheduleModule } from "@nestjs/schedule";

describe("Healthz endpoint", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ScheduleModule.forRoot(), HealthModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ $queryRaw: jest.fn().mockResolvedValue([1]) })
      .overrideProvider(RedisService)
      .useValue({ isEnabled: true, ping: jest.fn().mockResolvedValue("PONG") })
      .overrideProvider(ObservabilityService)
      .useValue({
        snapshot: jest.fn().mockReturnValue({
          captured: 1,
          targets: { apiP95Ms: 800, apiErrorRate: 0.01, jobP95Ms: 30000, jobFailureRate: 0.02, webLcpP75Ms: 2500, webTtfbP75Ms: 500 },
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
          web: { lcp: { count: 0, errors: 0, p50: 0, p95: 0, p99: 0, avg: 0 }, ttfb: { count: 0, errors: 0, p50: 0, p95: 0, p99: 0, avg: 0 }, p75: { lcp: 0, ttfb: 0 } },
          synthetics: {},
        }),
        recordReady: jest.fn(),
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns liveness for /health", async () => {
    const res = await request(app.getHttpServer()).get("/api/health").expect(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.status).toBe("up");
    expect(res.body.uptimeMs).toBeGreaterThan(0);
  });

  it("returns readiness snapshot with checks and perf", async () => {
    const res = await request(app.getHttpServer()).get("/api/ready").expect(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.checks).toBeDefined();
    expect(res.body.perf).toBeDefined();
    expect(Array.isArray(res.body.queues)).toBe(true);
  });
});

