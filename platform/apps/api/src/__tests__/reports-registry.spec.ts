import { ServiceUnavailableException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { ReportsService } from "../reports/reports.service";
import { PrismaService } from "../prisma/prisma.service";
import { ObservabilityService } from "../observability/observability.service";
import { AlertingService } from "../observability/alerting.service";
import { DashboardService } from "../dashboard/dashboard.service";
import { UploadsService } from "../uploads/uploads.service";
import { AuditService } from "../audit/audit.service";
import { JobQueueService } from "../observability/job-queue.service";
import { EmailService } from "../email/email.service";

describe("Report registry & executor", () => {
  let moduleRef: TestingModule;
  let service: ReportsService;
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
      leadTimeDays: 4,
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
      leadTimeDays: 1,
    },
  ];

  const paymentRows = [
    {
      id: "pay-1",
      campgroundId,
      createdAt: new Date("2025-01-02T00:00:00Z"),
      amountCents: 10000,
      method: "card",
      direction: "charge",
      stripeFeeCents: 300,
    },
    {
      id: "pay-2",
      campgroundId,
      createdAt: new Date("2025-01-03T00:00:00Z"),
      amountCents: -2000,
      method: "card",
      direction: "refund",
      stripeFeeCents: 0,
    },
  ];

  const prismaStub = {
    reservation: {
      findMany: jest.fn().mockResolvedValue(reservationRows),
    },
    payment: {
      findMany: jest.fn().mockResolvedValue(paymentRows),
    },
    ledgerEntry: { findMany: jest.fn().mockResolvedValue([]) },
    payout: { findMany: jest.fn().mockResolvedValue([]) },
    supportReport: { findMany: jest.fn().mockResolvedValue([]) },
    task: { findMany: jest.fn().mockResolvedValue([]) },
    analyticsEvent: { findMany: jest.fn().mockResolvedValue([]) },
    integrationExportJob: { count: jest.fn().mockResolvedValue(0) },
  };

  const observabilityStub = { recordReportResult: jest.fn() };
  const alertingStub = { dispatch: jest.fn().mockResolvedValue({ ok: true }) };
  const dashboardStub = { summary: jest.fn() };
  const uploadsStub = {
    uploadBuffer: jest.fn().mockResolvedValue({ url: "file://export.csv", key: "export.csv" }),
  };
  const auditStub = { recordExport: jest.fn() };
  const jobQueueStub = { enqueue: jest.fn((_q: string, fn: () => unknown) => fn()) };
  const emailStub = { sendEmail: jest.fn() };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: PrismaService,
          useValue: prismaStub,
        },
        { provide: ObservabilityService, useValue: observabilityStub },
        { provide: AlertingService, useValue: alertingStub },
        { provide: DashboardService, useValue: dashboardStub },
        { provide: UploadsService, useValue: uploadsStub },
        { provide: AuditService, useValue: auditStub },
        { provide: JobQueueService, useValue: jobQueueStub },
        { provide: EmailService, useValue: emailStub },
      ],
    }).compile();
    service = moduleRef.get(ReportsService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it("lists catalog entries with dimensions and metrics", async () => {
    const res = await service.listReportCatalog();
    expect(res.size).toBeGreaterThan(10);
    expect(res.catalog[0].dimensions.length).toBeGreaterThan(0);
    expect(res.catalog[0].metrics.length).toBeGreaterThan(0);
  });

  it("runs a report and returns series + rows", async () => {
    const res = await service.runReport(campgroundId, {
      reportId: "bookings.daily_bookings",
      limit: 5,
    });

    expect(res.meta.id).toBe("bookings.daily_bookings");
    expect(Array.isArray(res.rows)).toBe(true);
    expect(Array.isArray(res.series)).toBe(true);
    expect(res.series[0].points.length).toBeGreaterThan(0);
  });

  it("returns 503 when capacity guard triggers", async () => {
    const queryLimit = Reflect.get(service, "queryLimit");
    if (typeof queryLimit !== "number") {
      throw new Error("Expected report service queryLimit to be a number");
    }
    Reflect.set(service, "activeRuns", queryLimit);
    let caught: ServiceUnavailableException | null = null;
    try {
      await service.runReport(campgroundId, { reportId: "bookings.daily_bookings" });
    } catch (err) {
      if (err instanceof ServiceUnavailableException) {
        caught = err;
      } else {
        throw err;
      }
    }
    expect(caught).not.toBeNull();
    if (caught) {
      expect(caught.getResponse()).toMatchObject({ reason: "capacity_guard" });
    }
    Reflect.set(service, "activeRuns", 0);
  });
});
