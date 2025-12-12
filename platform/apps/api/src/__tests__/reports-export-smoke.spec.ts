// @ts-nocheck
import * as request from "supertest";
import { Test } from "@nestjs/testing";
import { ValidationPipe } from "@nestjs/common";
import { ReportsController } from "../reports/reports.controller";
import { ReportsService } from "../reports/reports.service";
import { PrismaService } from "../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/guards";
import { RolesGuard } from "../auth/guards/roles.guard";
import { ObservabilityService } from "../observability/observability.service";
import { AlertingService } from "../observability/alerting.service";
import { DashboardService } from "../dashboard/dashboard.service";
import { UploadsService } from "../uploads/uploads.service";
import { AuditService } from "../audit/audit.service";
import { JobQueueService } from "../observability/job-queue.service";
import { EmailService } from "../email/email.service";

describe("Reports exports smoke", () => {
  let app: any;
  const campgroundId = "camp-reports-test";
  const now = new Date().toISOString();
  const stubExports = [
    {
      id: "exp-1",
      campgroundId,
      type: "api",
      resource: "reports",
      status: "success",
      location: "csv",
      filters: { range: "last_30_days" },
      requestedById: "user-1",
      createdAt: now,
      completedAt: now
    }
  ];
  const jobs = [...stubExports];

  const reservationRows = Array.from({ length: 6 }).map((_, idx) => ({
    id: `res-${idx + 1}`,
    campgroundId,
    arrivalDate: new Date(2025, 0, idx + 1),
    departureDate: new Date(2025, 0, idx + 2),
    totalAmount: 10000,
    paidAmount: 9000,
    status: "confirmed",
    source: idx % 2 === 0 ? "online" : "admin",
    createdAt: new Date(2025, 0, idx + 1)
  }));

  const prismaStub = {
    integrationExportJob: {
      findMany: jest.fn().mockImplementation(({ where }: any) => {
        const filtered = where?.status
          ? jobs.filter((j) => j.status === where.status)
          : jobs;
        return Promise.resolve(filtered.slice(0, where?.take ?? filtered.length));
      }),
      findUnique: jest.fn().mockImplementation(({ where }: any) => {
        return Promise.resolve(jobs.find((e) => e.id === where.id) || null);
      }),
      create: jest.fn().mockImplementation(({ data }: any) => {
        const created = {
          id: "exp-new",
          ...data,
          createdAt: new Date().toISOString()
        };
        jobs.push(created as any);
        return Promise.resolve(created);
      }),
      count: jest.fn().mockImplementation(({ where }: any) => {
        if (where?.status?.in) {
          return Promise.resolve(jobs.filter((j) => (where.status.in as any[]).includes(j.status)).length);
        }
        return Promise.resolve(jobs.length);
      }),
      update: jest.fn().mockImplementation(({ where, data }: any) => {
        const idx = jobs.findIndex((j) => j.id === where.id);
        if (idx >= 0) {
          jobs[idx] = { ...jobs[idx], ...data };
          return Promise.resolve(jobs[idx]);
        }
        return Promise.resolve(null);
      })
    },
    reservation: {
      findMany: jest.fn().mockImplementation(({ cursor, take }: any) => {
        const startIdx = cursor
          ? reservationRows.findIndex((r) => r.id === cursor.id) + 1
          : 0;
        return Promise.resolve(reservationRows.slice(startIdx, startIdx + take));
      }),
      count: jest.fn().mockResolvedValue(0)
    },
    site: {
      findMany: jest.fn().mockResolvedValue([{ id: "site-1" }, { id: "site-2" }])
    },
    reservationUpsell: {
      count: jest.fn().mockResolvedValue(0)
    }
  };

  const observabilityStub = {
    recordReportResult: jest.fn()
  };

  const alertingStub = {
    dispatch: jest.fn().mockResolvedValue({ ok: true })
  };

  const uploadsStub = {
    uploadBuffer: jest.fn().mockResolvedValue({ url: "file://export.csv", key: "export.csv" })
  };

  const auditStub = { recordExport: jest.fn() };
  const jobQueueStub = { enqueue: jest.fn().mockResolvedValue(null) };
  const emailStub = { sendEmail: jest.fn() };

  const dashboardStub = {
    summary: jest.fn().mockResolvedValue({
      campground: { id: campgroundId, name: "Test Camp" },
      sites: 10,
      futureReservations: 5,
      occupancy: 70,
      adr: 120,
      revpar: 84,
      revenue: 7200,
      overdueBalance: 300,
      maintenanceOpen: 0,
      maintenanceOverdue: 0
    })
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        ReportsService,
        {
          provide: PrismaService,
          useValue: prismaStub
        },
        {
          provide: ObservabilityService,
          useValue: observabilityStub
        },
        {
          provide: AlertingService,
          useValue: alertingStub
        },
        {
          provide: UploadsService,
          useValue: uploadsStub
        },
        {
          provide: AuditService,
          useValue: auditStub
        },
        {
          provide: JobQueueService,
          useValue: jobQueueStub
        },
        {
          provide: EmailService,
          useValue: emailStub
        },
        {
          provide: DashboardService,
          useValue: dashboardStub
        }
      ]
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.use((req: any, _res: any, next: any) => {
      req.user = { id: "tester", role: "owner" };
      next();
    });
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it("lists and queues report exports with filters", async () => {
    const api = request(app.getHttpServer());
    const list = await api.get(`/api/campgrounds/${campgroundId}/reports/exports`).expect(200);
    expect(Array.isArray(list.body)).toBe(true);
    expect(list.body[0]).toMatchObject({ id: "exp-1", filters: { range: "last_30_days" } });

    const queued = await api
      .post(`/api/campgrounds/${campgroundId}/reports/exports`)
      .send({ filters: { range: "last_7_days", tab: "overview" }, format: "csv" })
      .expect(201);
    expect(queued.body.filters).toMatchObject({ range: "last_7_days", tab: "overview" });

    const rerun = await api.post(`/api/campgrounds/${campgroundId}/reports/exports/exp-1/rerun`).expect(201);
    expect(rerun.body.filters).toMatchObject({ range: "last_30_days" });
  });

  it("enforces capacity guard with 503 and retry-after", async () => {
    prismaStub.integrationExportJob.count.mockResolvedValue(999);
    const api = request(app.getHttpServer());
    const res = await api
      .post(`/api/campgrounds/${campgroundId}/reports/exports`)
      .send({ filters: { range: "last_7_days" } })
      .expect(503);
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
    const service = app.get(ReportsService) as ReportsService;
    const first = await service.generateExportPage({ campgroundId, pageSize: 3 });
    expect(first.rows).toHaveLength(3);
    expect(first.nextToken).toBeTruthy();
    const second = await service.generateExportPage({
      campgroundId,
      paginationToken: first.nextToken ?? undefined,
      pageSize: 3
    });
    expect(second.rows).toHaveLength(2);
    expect(second.nextToken).toBeNull();
    expect(second.summary).toMatchObject({
      adr: expect.any(Number),
      revpar: expect.any(Number),
      revenue: expect.any(Number),
      liability: expect.any(Number)
    });
    expect(second.summary).toHaveProperty("attachRate");
  });

  it("generates an export file with download url and sends email", async () => {
    const api = request(app.getHttpServer());
    const service = app.get(ReportsService) as ReportsService;
    expect((service as any).email).toBe(emailStub);
    const queued = await api
      .post(`/api/campgrounds/${campgroundId}/reports/exports`)
      .send({ format: "csv", filters: { range: "last_7_days" }, emailTo: ["ops@test.com"] })
      .expect(201);
    expect(queued.body.filters?.emailTo).toEqual(["ops@test.com"]);

    await service.processQueuedExports();

    const detail = await api
      .get(`/api/campgrounds/${campgroundId}/reports/exports/${queued.body.id}`)
      .expect(200);
    expect(detail.body.downloadUrl).toBeTruthy();
    expect(auditStub.recordExport).toHaveBeenCalled();
    expect(emailStub.sendEmail).toHaveBeenCalled();
  });
});


