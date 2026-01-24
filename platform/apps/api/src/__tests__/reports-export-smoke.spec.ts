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

type ExportJob = {
  id: string;
  campgroundId: string;
  type: string;
  resource: string;
  status: string;
  location: string;
  filters: Record<string, unknown>;
  requestedById: string;
  createdAt: string;
  completedAt: string;
};

type ExportJobStatusFilter = string | { in?: string[] };

type ExportJobFindManyArgs = {
  where?: { status?: ExportJobStatusFilter };
  take?: number;
};

type ExportJobFindUniqueArgs = { where: { id: string } };

type ExportJobCreateArgs = { data: Partial<ExportJob> };

type ExportJobUpdateArgs = { where: { id: string }; data: Partial<ExportJob> };

type ExportJobCountArgs = { where?: { status?: { in?: string[] } } };

type ReservationFindManyArgs = { cursor?: { id: string }; take: number };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const resolveStatusFilter = (status: ExportJobStatusFilter | undefined): string[] | undefined => {
  if (!status) return undefined;
  if (typeof status === "string") return [status];
  if (isRecord(status) && Array.isArray(status.in)) {
    return status.in.filter((entry) => typeof entry === "string");
  }
  return undefined;
};

describe("Reports exports smoke", () => {
  let moduleRef: TestingModule;
  let service: ReportsService;
  const campgroundId = "camp-reports-test";
  const now = new Date().toISOString();
  const stubExports: ExportJob[] = [
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
      completedAt: now,
    },
  ];
  const jobs: ExportJob[] = [...stubExports];

  const reservationRows = Array.from({ length: 6 }).map((_, idx) => ({
    id: `res-${idx + 1}`,
    campgroundId,
    arrivalDate: new Date(2025, 0, idx + 1),
    departureDate: new Date(2025, 0, idx + 2),
    totalAmount: 10000,
    paidAmount: 9000,
    status: "confirmed",
    source: idx % 2 === 0 ? "online" : "admin",
    createdAt: new Date(2025, 0, idx + 1),
  }));

  const prismaStub = {
    integrationExportJob: {
      findMany: jest.fn().mockImplementation((args: ExportJobFindManyArgs) => {
        const statuses = resolveStatusFilter(args.where?.status);
        const filtered = statuses ? jobs.filter((job) => statuses.includes(job.status)) : jobs;
        return Promise.resolve(filtered.slice(0, args.take ?? filtered.length));
      }),
      findUnique: jest.fn().mockImplementation((args: ExportJobFindUniqueArgs) => {
        return Promise.resolve(jobs.find((entry) => entry.id === args.where.id) || null);
      }),
      create: jest.fn().mockImplementation((args: ExportJobCreateArgs) => {
        const base: ExportJob = {
          id: "exp-new",
          campgroundId,
          type: "api",
          resource: "reports",
          status: "queued",
          location: "csv",
          filters: {},
          requestedById: "user-1",
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        };
        const created: ExportJob = { ...base, ...args.data, createdAt: base.createdAt };
        jobs.push(created);
        return Promise.resolve(created);
      }),
      count: jest.fn().mockImplementation((args: ExportJobCountArgs) => {
        const statuses = Array.isArray(args.where?.status?.in)
          ? args.where?.status?.in.filter((entry) => typeof entry === "string")
          : undefined;
        if (statuses) {
          return Promise.resolve(jobs.filter((job) => statuses.includes(job.status)).length);
        }
        return Promise.resolve(jobs.length);
      }),
      update: jest.fn().mockImplementation((args: ExportJobUpdateArgs) => {
        const idx = jobs.findIndex((job) => job.id === args.where.id);
        if (idx >= 0) {
          const updated = { ...jobs[idx], ...args.data };
          jobs[idx] = updated;
          return Promise.resolve(updated);
        }
        return Promise.resolve(null);
      }),
    },
    reservation: {
      findMany: jest.fn().mockImplementation((args: ReservationFindManyArgs) => {
        const startIdx = args.cursor
          ? reservationRows.findIndex((row) => row.id === args.cursor?.id) + 1
          : 0;
        return Promise.resolve(reservationRows.slice(startIdx, startIdx + args.take));
      }),
      count: jest.fn().mockResolvedValue(0),
    },
    site: {
      findMany: jest.fn().mockResolvedValue([{ id: "site-1" }, { id: "site-2" }]),
    },
    reservationUpsell: {
      count: jest.fn().mockResolvedValue(0),
    },
    campground: {
      findUnique: jest.fn().mockResolvedValue({ timezone: "UTC" }),
    },
  };

  const observabilityStub = {
    recordReportResult: jest.fn(),
  };

  const alertingStub = {
    dispatch: jest.fn().mockResolvedValue({ ok: true }),
  };

  const uploadsStub = {
    uploadBuffer: jest.fn().mockResolvedValue({ url: "file://export.csv", key: "export.csv" }),
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
      maintenanceOverdue: 0,
    }),
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: PrismaService,
          useValue: prismaStub,
        },
        {
          provide: ObservabilityService,
          useValue: observabilityStub,
        },
        {
          provide: AlertingService,
          useValue: alertingStub,
        },
        {
          provide: UploadsService,
          useValue: uploadsStub,
        },
        {
          provide: AuditService,
          useValue: auditStub,
        },
        {
          provide: JobQueueService,
          useValue: jobQueueStub,
        },
        {
          provide: EmailService,
          useValue: emailStub,
        },
        {
          provide: DashboardService,
          useValue: dashboardStub,
        },
      ],
    }).compile();

    service = moduleRef.get(ReportsService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it("lists and queues report exports with filters", async () => {
    const list = await service.listExports(campgroundId);
    expect(Array.isArray(list)).toBe(true);
    expect(list[0]).toMatchObject({ id: "exp-1", filters: { range: "last_30_days" } });

    const queued = await service.queueExport({
      campgroundId,
      filters: { range: "last_7_days", tab: "overview" },
      format: "csv",
      requestedById: "tester",
    });
    expect(queued.filters).toMatchObject({ range: "last_7_days", tab: "overview" });

    const rerun = await service.rerunExport(campgroundId, "exp-1", "tester");
    expect(rerun.filters).toMatchObject({ range: "last_30_days" });
  });

  it("enforces capacity guard with 503 and retry-after", async () => {
    prismaStub.integrationExportJob.count.mockResolvedValue(999);
    let caught: ServiceUnavailableException | null = null;
    try {
      await service.queueExport({
        campgroundId,
        filters: { range: "last_7_days" },
        requestedById: "tester",
      });
    } catch (err) {
      if (err instanceof ServiceUnavailableException) {
        caught = err;
      } else {
        throw err;
      }
    }
    expect(caught).not.toBeNull();
    if (caught) {
      const response = caught.getResponse();
      expect(isRecord(response)).toBe(true);
      if (isRecord(response)) {
        expect(response.message).toContain("capacity");
        expect(response.retryAfter).toEqual(expect.any(Number));
        expect(response.reason).toBe("capacity_guard");
      }
    }
    expect(observabilityStub.recordReportResult).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ reason: "capacity_guard" }),
    );
    expect(alertingStub.dispatch).toHaveBeenCalled();
    prismaStub.integrationExportJob.count.mockResolvedValue(0);
  });

  it("paginates with resumable tokens and caps row budget", async () => {
    const previousMax = process.env.REPORT_EXPORT_MAX_ROWS;
    process.env.REPORT_EXPORT_MAX_ROWS = "5";
    const first = await service.generateExportPage({ campgroundId, pageSize: 3 });
    expect(first.rows).toHaveLength(3);
    expect(first.nextToken).toBeTruthy();
    const second = await service.generateExportPage({
      campgroundId,
      paginationToken: first.nextToken ?? undefined,
      pageSize: 3,
    });
    expect(second.rows).toHaveLength(2);
    expect(second.nextToken).toBeNull();
    expect(second.summary).toMatchObject({
      adr: expect.any(Number),
      revpar: expect.any(Number),
      revenue: expect.any(Number),
      liability: expect.any(Number),
    });
    expect(second.summary).toHaveProperty("attachRate");
    if (previousMax === undefined) {
      delete process.env.REPORT_EXPORT_MAX_ROWS;
    } else {
      process.env.REPORT_EXPORT_MAX_ROWS = previousMax;
    }
  });

  it("generates an export file with download url and sends email", async () => {
    const serviceEmail = Reflect.get(service, "email");
    expect(serviceEmail).toBe(emailStub);
    const queued = await service.queueExport({
      campgroundId,
      format: "csv",
      filters: { range: "last_7_days" },
      emailTo: ["ops@test.com"],
      requestedById: "tester",
    });
    const queuedFilters = isRecord(queued.filters) ? queued.filters : {};
    expect(queuedFilters.emailTo).toEqual(["ops@test.com"]);

    await service.processQueuedExports();

    const detail = await service.getExport(campgroundId, queued.id);
    expect(detail.downloadUrl).toBeTruthy();
    expect(auditStub.recordExport).toHaveBeenCalled();
    expect(emailStub.sendEmail).toHaveBeenCalled();
  });
});
