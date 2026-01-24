import { Test } from "@nestjs/testing";
import { SiteMapService } from "../site-map/site-map.service";
import { PrismaService } from "../prisma/prisma.service";

type PrismaMock = {
  site: { findUnique: jest.Mock; findMany: jest.Mock; count: jest.Mock };
  reservation: { findMany: jest.Mock };
  siteHold: { findMany: jest.Mock };
  maintenanceTicket: { findMany: jest.Mock };
  blackoutDate: { findMany: jest.Mock };
  siteMapLayout: { findMany: jest.Mock; upsert: jest.Mock };
  campgroundMapConfig: { findUnique: jest.Mock; upsert: jest.Mock };
  $transaction: jest.Mock;
};

const baseSite = {
  campgroundId: "cg1",
  rigMaxLength: 30,
  rigMaxWidth: 10,
  rigMaxHeight: 11,
  pullThrough: false,
  accessible: true,
  amenityTags: ["water", "power"],
  tags: [],
  maxOccupancy: 6,
  hookupsPower: true,
  hookupsWater: true,
  hookupsSewer: false,
  mapLabel: null,
  status: null,
};

const createPrismaMock = (): PrismaMock => ({
  site: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  reservation: { findMany: jest.fn() },
  siteHold: { findMany: jest.fn() },
  maintenanceTicket: { findMany: jest.fn() },
  blackoutDate: { findMany: jest.fn() },
  siteMapLayout: { findMany: jest.fn(), upsert: jest.fn() },
  campgroundMapConfig: { findUnique: jest.fn(), upsert: jest.fn() },
  $transaction: jest.fn(async (ops: Array<Promise<unknown>>) => Promise.all(ops)),
});

const createService = async (prisma: PrismaMock) => {
  const moduleRef = await Test.createTestingModule({
    providers: [SiteMapService, { provide: PrismaService, useValue: prisma }],
  }).compile();

  return { service: moduleRef.get(SiteMapService), close: () => moduleRef.close() };
};

describe("SiteMapService", () => {
  describe("checkAssignment", () => {
    it("flags active holds as conflicts", async () => {
      const prisma = createPrismaMock();
      prisma.site.findUnique.mockResolvedValue({ ...baseSite, id: "site-1" });
      prisma.reservation.findMany.mockResolvedValue([]);
      prisma.siteHold.findMany.mockResolvedValue([
        {
          id: "hold-1",
          siteId: "site-1",
          arrivalDate: new Date("2025-01-02"),
          departureDate: new Date("2025-01-05"),
          status: "active",
        },
      ]);
      prisma.maintenanceTicket.findMany.mockResolvedValue([]);
      prisma.blackoutDate.findMany.mockResolvedValue([]);

      const { service, close } = await createService(prisma);
      try {
        const result = await service.checkAssignment("cg1", {
          siteId: "site-1",
          startDate: "2025-01-02",
          endDate: "2025-01-04",
        });

        expect(result.ok).toBe(false);
        expect(result.reasons).toContain("status_blocked");
        expect(result.conflicts.some((conflict) => conflict.type === "hold")).toBe(true);
      } finally {
        await close();
      }
    });

    it("fails rig/ADA/amenity/occupancy constraints", async () => {
      const prisma = createPrismaMock();
      prisma.site.findUnique.mockResolvedValue({
        ...baseSite,
        id: "site-2",
        accessible: false,
        amenityTags: ["power"],
        rigMaxLength: 30,
        rigMaxWidth: 8,
        rigMaxHeight: 10,
        maxOccupancy: 4,
      });
      prisma.reservation.findMany.mockResolvedValue([]);
      prisma.siteHold.findMany.mockResolvedValue([]);
      prisma.maintenanceTicket.findMany.mockResolvedValue([]);
      prisma.blackoutDate.findMany.mockResolvedValue([]);

      const { service, close } = await createService(prisma);
      try {
        const result = await service.checkAssignment("cg1", {
          siteId: "site-2",
          startDate: "2025-01-10",
          endDate: "2025-01-12",
          needsADA: true,
          requiredAmenities: ["sewer"],
          rig: { length: 32, width: 9, height: 11 },
          partySize: 5,
        });

        expect(result.ok).toBe(false);
        expect(result.reasons).toEqual(
          expect.arrayContaining([
            "rig_too_long",
            "rig_too_wide",
            "rig_too_tall",
            "missing_amenities",
            "ada_required",
            "party_too_large",
          ]),
        );
      } finally {
        await close();
      }
    });
  });

  describe("previewAssignments", () => {
    it("splits eligible and ineligible sites and includes conflicts", async () => {
      const prisma = createPrismaMock();
      const sites = [
        { ...baseSite, id: "site-a", amenityTags: ["water", "sewer", "power"] },
        { ...baseSite, id: "site-b" },
      ];

      prisma.site.findMany.mockResolvedValue(sites);
      prisma.reservation.findMany.mockResolvedValue([
        {
          id: "res-1",
          siteId: "site-b",
          arrivalDate: new Date("2025-02-02"),
          departureDate: new Date("2025-02-04"),
          status: "confirmed",
        },
      ]);
      prisma.siteHold.findMany.mockResolvedValue([]);
      prisma.maintenanceTicket.findMany.mockResolvedValue([]);
      prisma.blackoutDate.findMany.mockResolvedValue([]);

      const { service, close } = await createService(prisma);
      try {
        const result = await service.previewAssignments("cg1", {
          startDate: "2025-02-02",
          endDate: "2025-02-04",
          requiredAmenities: ["sewer"],
          rig: { length: 25 },
        });

        expect(result.eligible.map((entry) => entry.siteId)).toContain("site-a");
        expect(result.ineligible.map((entry) => entry.siteId)).toContain("site-b");
        const blocked = result.ineligible.find((entry) => entry.siteId === "site-b");
        expect(blocked?.reasons).toContain("status_blocked");
      } finally {
        await close();
      }
    });
  });
});
