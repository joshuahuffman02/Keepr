import { Test, type TestingModule } from "@nestjs/testing";
import { AnalyticsService } from "../analytics/analytics.service";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";

describe("Analytics smoke", () => {
  let moduleRef: TestingModule;
  let service: AnalyticsService;
  const campgroundId = "camp-analytics-test";
  const prismaStub = {
    analyticsEvent: {
      create: jest.fn().mockResolvedValue({ id: "evt-1" }),
    },
    analyticsDailyAggregate: {
      upsert: jest.fn().mockResolvedValue({ id: "agg-1", count: 1 }),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: "agg-2", count: 1 }),
      update: jest.fn().mockResolvedValue({ id: "agg-2", count: 2 }),
    },
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: AuditService,
          useValue: {
            record: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: prismaStub,
        },
      ],
    }).compile();
    service = moduleRef.get(AnalyticsService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it("ingests an event and returns recommendations (stub)", async () => {
    await service.ingest(
      {
        sessionId: "sess-1",
        eventName: "page_view",
        occurredAt: new Date().toISOString(),
        campgroundId,
        deviceType: "desktop",
        metadata: { siteId: "site-1" },
      },
      { campgroundId, organizationId: null, userId: "analytics-user" },
    );

    const recs = await service.getRecommendations(campgroundId);
    expect(Array.isArray(recs.recommendations)).toBe(true);
  });
});
