import { Test, TestingModule } from "@nestjs/testing";
import { DynamicPricingService } from "../src/dynamic-pricing/dynamic-pricing.service";
import { WorkflowsService } from "../src/workflows/workflows.service";
import { StaffService } from "../src/staff/staff.service";
import { PortfolioService } from "../src/portfolio/portfolio.service";
import { PrismaService } from "../src/prisma/prisma.service";

const mockPrisma = {
  dynamicPricingRule: {
    findMany: jest.fn(),
  },
  occupancySnapshot: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  site: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  reservation: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  maintenanceTicket: {
    count: jest.fn(),
  },
  revenueForecast: {
    upsert: jest.fn(),
    findMany: jest.fn(),
  },
  communicationWorkflow: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  workflowExecution: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  workflowStep: {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  staffShift: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  staffAvailability: {
    upsert: jest.fn(),
    findMany: jest.fn(),
  },
  pushNotification: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  pushSubscription: {
    findMany: jest.fn(),
  },
  staffPerformance: {
    upsert: jest.fn(),
    findMany: jest.fn(),
  },
  task: {
    findMany: jest.fn(),
  },
  portfolioDashboard: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  portfolioMetric: {
    findFirst: jest.fn(),
    upsert: jest.fn(),
    findMany: jest.fn(),
  },
  campground: {
    findMany: jest.fn(),
  },
};

describe("Phase 3 modules", () => {
  let pricing: DynamicPricingService;
  let workflows: WorkflowsService;
  let staff: StaffService;
  let portfolio: PortfolioService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DynamicPricingService,
        WorkflowsService,
        StaffService,
        PortfolioService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    pricing = module.get(DynamicPricingService);
    workflows = module.get(WorkflowsService);
    staff = module.get(StaffService);
    portfolio = module.get(PortfolioService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("calculates occupancy-based adjustments", async () => {
    mockPrisma.occupancySnapshot.findUnique.mockResolvedValue({ occupancyPct: 80 });
    mockPrisma.dynamicPricingRule.findMany.mockResolvedValue([
      {
        name: "High Occ",
        siteClassIds: [],
        conditions: { occupancyMin: 70 },
        adjustmentType: "percent",
        adjustmentValue: 10,
      },
    ]);
    const result = await pricing.calculateAdjustment("cg", null, new Date(), 10000);
    expect(result.adjustedPrice).toBeGreaterThan(10000);
  });

  it("processes workflow executions (cron)", async () => {
    mockPrisma.workflowExecution.findMany.mockResolvedValue([
      {
        id: "w1",
        status: "pending",
        currentStep: 0,
        workflow: { steps: [{ isActive: true, actionType: "condition", config: {} }] },
      },
    ]);
    mockPrisma.workflowExecution.update.mockResolvedValue({});
    const out = await workflows.processPendingExecutions();
    expect(out.length).toBeGreaterThanOrEqual(1);
  });

  it("records staff performance", async () => {
    mockPrisma.task.findMany.mockResolvedValue([{ slaStatus: "on_track" }]);
    mockPrisma.staffShift.findMany.mockResolvedValue([
      { clockedInAt: new Date(Date.now() - 2 * 3600 * 1000), clockedOutAt: new Date() },
    ]);
    await staff.calculatePerformanceMetrics("cg", "user", new Date(), new Date());
    expect(mockPrisma.staffPerformance.upsert).toHaveBeenCalled();
  });

  it("aggregates portfolio metrics", async () => {
    mockPrisma.campground.findMany.mockResolvedValue([{ id: "c1", name: "Camp" }]);
    mockPrisma.reservation.count.mockResolvedValue(10);
    mockPrisma.reservation.aggregate = jest
      .fn()
      .mockResolvedValue({ _sum: { totalAmount: 100000 } });
    await portfolio.calculateDailyMetrics("org", new Date());
    expect(mockPrisma.portfolioMetric.upsert).toHaveBeenCalled();
  });
});
