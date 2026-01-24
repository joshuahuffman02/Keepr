import { Test, TestingModule } from "@nestjs/testing";
import { GroupsService } from "../src/groups/groups.service";
import { BlocksService } from "../src/groups/blocks.service";
import { PrismaService } from "../src/prisma/prisma.service";

describe("GroupsService", () => {
  let service: GroupsService;

  const mockPrisma = {
    group: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    reservation: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    guest: {
      findMany: jest.fn(),
    },
    site: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GroupsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<GroupsService>(GroupsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("creates a group with default settings", async () => {
      const payload = {
        tenantId: "tenant-1",
        sharedPayment: true,
        sharedComm: true,
      };

      mockPrisma.group.create.mockResolvedValue({
        id: "group-1",
        ...payload,
      });

      const result = await service.create(payload);

      expect(mockPrisma.group.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: "tenant-1",
          sharedPayment: true,
          sharedComm: true,
        }),
      });
      expect(result.id).toBe("group-1");
    });
  });

  describe("linkReservation", () => {
    it("links a reservation to a group as member", async () => {
      mockPrisma.group.findUnique.mockResolvedValue({
        id: "group-1",
        tenantId: "tenant-1",
      });

      mockPrisma.reservation.update.mockResolvedValue({
        id: "res-1",
        groupId: "group-1",
        groupRole: "member",
      });

      const result = await service.linkReservation("group-1", "res-1");

      expect(mockPrisma.reservation.update).toHaveBeenCalledWith({
        where: { id: "res-1" },
        data: {
          groupId: "group-1",
          groupRole: "member",
        },
      });
      expect(result.groupId).toBe("group-1");
    });

    it("links a reservation as primary when specified", async () => {
      mockPrisma.group.findUnique.mockResolvedValue({
        id: "group-1",
        tenantId: "tenant-1",
      });

      mockPrisma.reservation.update.mockResolvedValue({
        id: "res-1",
        groupId: "group-1",
        groupRole: "primary",
      });

      const result = await service.linkReservation("group-1", "res-1", "primary");

      expect(mockPrisma.reservation.update).toHaveBeenCalledWith({
        where: { id: "res-1" },
        data: {
          groupId: "group-1",
          groupRole: "primary",
        },
      });
      expect(result.groupRole).toBe("primary");
    });
  });

  describe("unlinkReservation", () => {
    it("removes a reservation from a group", async () => {
      mockPrisma.reservation.update.mockResolvedValue({
        id: "res-1",
        groupId: null,
        groupRole: null,
      });

      const result = await service.unlinkReservation("res-1");

      expect(mockPrisma.reservation.update).toHaveBeenCalledWith({
        where: { id: "res-1" },
        data: {
          groupId: null,
          groupRole: null,
        },
      });
      expect(result.groupId).toBeNull();
    });
  });
});

describe("BlocksService", () => {
  let service: BlocksService;

  const mockPrisma = {
    inventoryBlock: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    reservation: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BlocksService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<BlocksService>(BlocksService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("creates a block when no conflicts exist", async () => {
      const payload = {
        tenantId: "tenant-1",
        sites: ["site-1", "site-2"],
        windowStart: "2025-01-01",
        windowEnd: "2025-01-05",
        reason: "group_hold",
        lockId: "lock-1",
        createdBy: "user-1",
      };

      mockPrisma.inventoryBlock.findMany.mockResolvedValue([]);
      mockPrisma.reservation.findMany.mockResolvedValue([]);
      mockPrisma.inventoryBlock.create.mockResolvedValue({
        blockId: "block-1",
        ...payload,
        state: "active",
      });

      const result = await service.create(payload);

      expect(result.blockId).toBe("block-1");
      expect(result.state).toBe("active");
    });

    it("throws conflict when overlapping block exists", async () => {
      const payload = {
        tenantId: "tenant-1",
        sites: ["site-1"],
        windowStart: "2025-01-01",
        windowEnd: "2025-01-05",
        reason: "group_hold",
        lockId: "lock-1",
        createdBy: "user-1",
      };

      mockPrisma.inventoryBlock.findMany.mockResolvedValue([
        {
          blockId: "existing-block",
          sites: ["site-1"],
          windowStart: new Date("2025-01-02"),
          windowEnd: new Date("2025-01-04"),
          state: "active",
        },
      ]);

      await expect(service.create(payload)).rejects.toThrow("conflict");
    });

    it("throws conflict when overlapping reservation exists", async () => {
      const payload = {
        tenantId: "tenant-1",
        sites: ["site-1"],
        windowStart: "2025-01-01",
        windowEnd: "2025-01-05",
        reason: "group_hold",
        lockId: "lock-1",
        createdBy: "user-1",
      };

      mockPrisma.inventoryBlock.findMany.mockResolvedValue([]);
      mockPrisma.reservation.findMany.mockResolvedValue([
        {
          id: "res-1",
          siteId: "site-1",
          arrivalDate: new Date("2025-01-02"),
          departureDate: new Date("2025-01-04"),
        },
      ]);

      await expect(service.create(payload)).rejects.toThrow("conflict");
    });
  });

  describe("release", () => {
    it("marks a block as released", async () => {
      mockPrisma.inventoryBlock.findUnique.mockResolvedValue({
        blockId: "block-1",
        state: "active",
      });

      mockPrisma.inventoryBlock.update.mockResolvedValue({
        blockId: "block-1",
        state: "released",
      });

      const result = await service.release("block-1");

      expect(mockPrisma.inventoryBlock.update).toHaveBeenCalledWith({
        where: { blockId: "block-1" },
        data: { state: "released" },
      });
      expect(result.state).toBe("released");
    });
  });
});
