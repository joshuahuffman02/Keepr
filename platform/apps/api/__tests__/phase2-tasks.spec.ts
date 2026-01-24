import { Test, TestingModule } from "@nestjs/testing";
import { TasksService } from "../src/tasks/tasks.service";
import { PrismaService } from "../src/prisma/prisma.service";

describe("TasksService", () => {
  let service: TasksService;
  let prisma: PrismaService;

  const mockPrisma = {
    task: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    reservation: {
      update: jest.fn(),
    },
    communication: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TasksService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<TasksService>(TasksService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("computeSlaStatus", () => {
    it("returns on_track for null slaDueAt", () => {
      expect(service.computeSlaStatus(null, "pending")).toBe("on_track");
    });

    it("returns on_track for done state", () => {
      const future = new Date(Date.now() + 1000 * 60 * 60);
      expect(service.computeSlaStatus(future, "done")).toBe("on_track");
    });

    it("returns breached for past due date", () => {
      const past = new Date(Date.now() - 1000 * 60 * 60);
      expect(service.computeSlaStatus(past, "pending")).toBe("breached");
    });
  });

  describe("create", () => {
    it("creates a task with computed slaStatus", async () => {
      const payload: Parameters<TasksService["create"]>[0] = {
        tenantId: "tenant-1",
        type: "turnover",
        siteId: "site-1",
        createdBy: "user-1",
      };

      mockPrisma.task.create.mockResolvedValue({
        id: "task-1",
        ...payload,
        state: "pending",
        slaStatus: "on_track",
      });

      const result = await service.create(payload);

      expect(mockPrisma.task.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: "tenant-1",
          type: "turnover",
          state: "pending",
          slaStatus: "on_track",
        }),
      });
      expect(result.id).toBe("task-1");
    });
  });

  describe("update", () => {
    it("marks site ready when turnover task completed", async () => {
      const existingTask = {
        id: "task-1",
        tenantId: "tenant-1",
        type: "turnover",
        state: "in_progress",
        siteId: "site-1",
        reservationId: "res-1",
        slaDueAt: new Date(Date.now() + 3600000),
        slaStatus: "on_track",
      };

      mockPrisma.task.findUnique.mockResolvedValue(existingTask);
      mockPrisma.task.update.mockResolvedValue({
        ...existingTask,
        state: "done",
      });
      mockPrisma.reservation.update.mockResolvedValue({
        id: "res-1",
        siteReady: true,
        campgroundId: "cg-1",
        guestId: "guest-1",
        campground: { name: "Test Camp" },
        guest: { email: "test@test.com" },
        site: { siteNumber: "12" },
      });
      mockPrisma.communication.create.mockResolvedValue({});

      await service.update("task-1", { state: "done" });

      expect(mockPrisma.reservation.update).toHaveBeenCalledWith({
        where: { id: "res-1" },
        data: expect.objectContaining({
          siteReady: true,
        }),
        include: expect.any(Object),
      });
    });
  });

  describe("findAll", () => {
    it("filters by tenantId and state", async () => {
      mockPrisma.task.findMany.mockResolvedValue([]);

      await service.findAll("tenant-1", { state: "pending" });

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: "tenant-1",
          state: "pending",
          siteId: undefined,
          slaStatus: undefined,
          type: undefined,
          assignedToUserId: undefined,
        },
        orderBy: [{ slaDueAt: "asc" }, { createdAt: "desc" }],
      });
    });
  });
});
