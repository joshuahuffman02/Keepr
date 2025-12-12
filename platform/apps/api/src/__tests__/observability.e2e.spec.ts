import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as request from "supertest";
import { PerfModule } from "../perf/perf.module";
import { ObservabilityModule } from "../observability/observability.module";
import { PerfService } from "../perf/perf.service";
import { ObservabilityService } from "../observability/observability.service";
import { PerfInterceptor } from "../perf/perf.interceptor";
import { ScheduleModule } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { OtaService } from "../ota/ota.service";

describe("Perf/Observability smoke", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ScheduleModule.forRoot(), PerfModule, ObservabilityModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ $connect: jest.fn(), $on: jest.fn(), reportRun: { count: jest.fn().mockResolvedValue(0) } })
      .overrideProvider(OtaService)
      .useValue({ alerts: () => ({ thresholds: {}, freshnessBreaches: [], webhookBreaches: [], successBreaches: [] }) })
      .compile();

    app = moduleRef.createNestApplication();
    const perfService = app.get(PerfService);
    const observabilityService = app.get(ObservabilityService);
    // Mirror main bootstrap: record latency and surface SLO snapshots.
    app.useGlobalInterceptors(new PerfInterceptor(perfService, observabilityService));

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /ops/perf returns perf snapshot shape", async () => {
    const res = await request(app.getHttpServer()).get("/ops/perf").expect(200);
    expect(res.body).toMatchObject({
      timestamp: expect.any(String),
      windowMs: expect.any(Number),
      counts: expect.any(Object),
      latencyMs: expect.any(Object),
      errorRate: expect.any(Number),
      limiter: expect.any(Object),
    });
    expect(res.body.latencyMs).toHaveProperty("p50");
    expect(res.body.latencyMs).toHaveProperty("p95");
    expect(res.body.latencyMs).toHaveProperty("p99");
  });

  it("GET /observability/snapshot returns SLO snapshot shape", async () => {
    const res = await request(app.getHttpServer()).get("/observability/snapshot").expect(200);
    expect(res.body).toMatchObject({
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
    expect(res.body.targets.apiErrorRate).toBeGreaterThanOrEqual(0);
    expect(res.body.targets.jobFailureRate).toBeGreaterThanOrEqual(0);
    expect(res.body.api).toEqual(
      expect.objectContaining({
        count: expect.any(Number),
        p95: expect.any(Number),
        p99: expect.any(Number),
        errors: expect.any(Number),
      })
    );
    expect(res.body.jobs).toEqual(
      expect.objectContaining({
        count: expect.any(Number),
        p95: expect.any(Number),
        p99: expect.any(Number),
        errors: expect.any(Number),
        queues: expect.any(Object),
      })
    );
  });

  it("GET /observability/alerts returns breaches shape", async () => {
    const res = await request(app.getHttpServer()).get("/observability/alerts").expect(200);
    expect(res.body).toMatchObject({
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

