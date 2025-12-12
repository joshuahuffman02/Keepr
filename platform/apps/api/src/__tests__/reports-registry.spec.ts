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

describe("Report registry & executor", () => {
  let app: any;
  const campgroundId = "camp-catalog";

  const reservationRows = [
    {
      id: "res-1",
      campgroundId,
      createdAt: new Date("2025-01-01T00:00:00Z"),
      arrivalDate: new Date("2025-01-05T00:00:00Z"),
      departureDate: new Date("2025-01-07T00:00:00Z"),
      status: "confirmed",
      source: "online",
      totalAmount: 10000,
      paidAmount: 9000,
      balanceAmount: 1000,
      stayType: "standard",
      rigType: "rv",
      promoCode: "NY25",
      leadTimeDays: 4
    },
    {
      id: "res-2",
      campgroundId,
      createdAt: new Date("2025-01-02T00:00:00Z"),
      arrivalDate: new Date("2025-01-03T00:00:00Z"),
      departureDate: new Date("2025-01-04T00:00:00Z"),
      status: "confirmed",
      source: "admin",
      totalAmount: 5000,
      paidAmount: 5000,
      balanceAmount: 0,
      stayType: "group",
      rigType: "tent",
      promoCode: null,
      leadTimeDays: 1
    }
  ];

  const paymentRows = [
    {
      id: "pay-1",
      campgroundId,
      createdAt: new Date("2025-01-02T00:00:00Z"),
      amountCents: 10000,
      method: "card",
      direction: "charge",
      stripeFeeCents: 300
    },
    {
      id: "pay-2",
      campgroundId,
      createdAt: new Date("2025-01-03T00:00:00Z"),
      amountCents: -2000,
      method: "card",
      direction: "refund",
      stripeFeeCents: 0
    }
  ];

  const prismaStub = {
    reservation: {
      findMany: jest.fn().mockResolvedValue(reservationRows)
    },
    payment: {
      findMany: jest.fn().mockResolvedValue(paymentRows)
    },
    ledgerEntry: { findMany: jest.fn().mockResolvedValue([]) },
    payout: { findMany: jest.fn().mockResolvedValue([]) },
    supportReport: { findMany: jest.fn().mockResolvedValue([]) },
    task: { findMany: jest.fn().mockResolvedValue([]) },
    analyticsEvent: { findMany: jest.fn().mockResolvedValue([]) },
    integrationExportJob: { count: jest.fn().mockResolvedValue(0) }
  };

  const observabilityStub = { recordReportResult: jest.fn() };
  const alertingStub = { dispatch: jest.fn().mockResolvedValue({ ok: true }) };
  const dashboardStub = { summary: jest.fn() };
  const uploadsStub = { uploadBuffer: jest.fn().mockResolvedValue({ url: "file://export.csv", key: "export.csv" }) };
  const auditStub = { recordExport: jest.fn() };
  const jobQueueStub = { enqueue: jest.fn((_q: string, fn: any) => fn()) };
  const emailStub = { sendEmail: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        ReportsService,
        {
          provide: PrismaService,
          useValue: prismaStub
        },
        { provide: ObservabilityService, useValue: observabilityStub },
        { provide: AlertingService, useValue: alertingStub },
        { provide: DashboardService, useValue: dashboardStub },
        { provide: UploadsService, useValue: uploadsStub },
        { provide: AuditService, useValue: auditStub },
        { provide: JobQueueService, useValue: jobQueueStub },
        { provide: EmailService, useValue: emailStub }
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

  it("lists catalog entries with dimensions and metrics", async () => {
    const api = request(app.getHttpServer());
    const res = await api.get(`/api/campgrounds/${campgroundId}/reports/catalog`).expect(200);
    expect(res.body.size).toBeGreaterThan(10);
    expect(res.body.catalog[0].dimensions.length).toBeGreaterThan(0);
    expect(res.body.catalog[0].metrics.length).toBeGreaterThan(0);
  });

  it("runs a report and returns series + rows", async () => {
    const api = request(app.getHttpServer());
    const res = await api
      .post(`/api/campgrounds/${campgroundId}/reports/run`)
      .send({ reportId: "bookings.daily_bookings", limit: 5 })
      .expect(200);

    expect(res.body.meta.id).toBe("bookings.daily_bookings");
    expect(Array.isArray(res.body.rows)).toBe(true);
    expect(Array.isArray(res.body.series)).toBe(true);
    expect(res.body.series[0].points.length).toBeGreaterThan(0);
  });

  it("returns 503 when capacity guard triggers", async () => {
    const service = app.get(ReportsService) as ReportsService;
    // simulate saturation
    (service as any).activeRuns = (service as any).queryLimit;
    const api = request(app.getHttpServer());
    const res = await api
      .post(`/api/campgrounds/${campgroundId}/reports/run`)
      .send({ reportId: "bookings.daily_bookings" })
      .expect(503);
    expect(res.body).toMatchObject({ reason: "capacity_guard" });
    (service as any).activeRuns = 0;
  });
});
