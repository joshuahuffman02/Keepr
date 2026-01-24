import { Test, TestingModule } from "@nestjs/testing";
import { SelfCheckinService } from "../src/self-checkin/self-checkin.service";
import { PrismaService } from "../src/prisma/prisma.service";

describe("SelfCheckinService", () => {
  let service: SelfCheckinService;

  const mockReservation = {
    id: "res-1",
    campgroundId: "cg-1",
    siteId: "site-1",
    guestId: "guest-1",
    paymentRequired: true,
    paymentStatus: "paid",
    idVerificationRequired: false,
    waiverRequired: false,
    siteReady: true,
    checkInStatus: "not_started",
    checkOutStatus: "not_started",
    totalAmount: 10000,
    balanceAmount: 0,
    Campground: {
      id: "cg-1",
      name: "Test Camp",
      stripeAccountId: null,
      applicationFeeFlatCents: null,
      perBookingFeeCents: null,
      billingPlan: null,
      feeMode: null,
    },
    Guest: { email: "test@test.com", primaryFirstName: "Test", primaryLastName: "User" },
    Site: { siteNumber: "12" },
  };

  const mockPrisma = {
    reservation: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    maintenanceTicket: {
      findFirst: jest.fn(),
    },
    communication: {
      create: jest.fn(),
    },
    task: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SelfCheckinService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<SelfCheckinService>(SelfCheckinService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("validateCheckinPrerequisites", () => {
    it("returns valid when all prerequisites met", async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue(mockReservation);
      mockPrisma.maintenanceTicket.findFirst.mockResolvedValue(null);

      const result = await service.validateCheckinPrerequisites("res-1");

      expect(result.valid).toBe(true);
    });

    it("returns invalid when payment required but not paid", async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue({
        ...mockReservation,
        paymentStatus: "unpaid",
      });

      const result = await service.validateCheckinPrerequisites("res-1");

      expect(result.valid).toBe(false);
      expect(result.reason).toBe("payment_required");
    });

    it("returns invalid when site not ready", async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue({
        ...mockReservation,
        siteReady: false,
      });

      const result = await service.validateCheckinPrerequisites("res-1");

      expect(result.valid).toBe(false);
      expect(result.reason).toBe("site_not_ready");
    });

    it("returns invalid when site out of order", async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue(mockReservation);
      mockPrisma.maintenanceTicket.findFirst.mockResolvedValue({
        id: "mt-1",
        outOfOrder: true,
      });

      const result = await service.validateCheckinPrerequisites("res-1");

      expect(result.valid).toBe(false);
      expect(result.reason).toBe("site_out_of_order");
    });
  });

  describe("selfCheckin", () => {
    it("completes checkin when prerequisites met", async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue(mockReservation);
      mockPrisma.maintenanceTicket.findFirst.mockResolvedValue(null);
      mockPrisma.reservation.update.mockResolvedValue({
        ...mockReservation,
        checkInStatus: "completed",
        status: "checked_in",
      });
      mockPrisma.communication.create.mockResolvedValue({});

      const result = await service.selfCheckin("res-1");

      expect(result.status).toBe("completed");
      expect(mockPrisma.reservation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "res-1" },
          data: expect.objectContaining({
            checkInStatus: "completed",
            status: "checked_in",
          }),
        }),
      );
    });

    it("fails checkin when prerequisites not met", async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue({
        ...mockReservation,
        siteReady: false,
      });
      mockPrisma.reservation.update.mockResolvedValue({
        ...mockReservation,
        checkInStatus: "failed",
      });
      mockPrisma.communication.create.mockResolvedValue({});

      const result = await service.selfCheckin("res-1");

      expect(result.status).toBe("failed");
      expect(result.reason).toBe("site_not_ready");
    });

    it("allows override to bypass prerequisites", async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue({
        ...mockReservation,
        siteReady: false,
      });
      mockPrisma.reservation.update.mockResolvedValue({
        ...mockReservation,
        checkInStatus: "completed",
      });
      mockPrisma.communication.create.mockResolvedValue({});

      const result = await service.selfCheckin("res-1", { override: true });

      expect(result.status).toBe("completed");
    });
  });

  describe("selfCheckout", () => {
    it("completes checkout successfully", async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue(mockReservation);
      mockPrisma.reservation.update.mockResolvedValue({
        ...mockReservation,
        checkOutStatus: "completed",
        status: "checked_out",
      });
      mockPrisma.communication.create.mockResolvedValue({});

      const result = await service.selfCheckout("res-1");

      expect(result.status).toBe("completed");
    });

    it("fails checkout when balance remains", async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue({
        ...mockReservation,
        balanceAmount: 5000,
      });
      mockPrisma.reservation.update.mockResolvedValue({
        ...mockReservation,
        checkOutStatus: "failed",
      });

      const result = await service.selfCheckout("res-1");

      expect(result.status).toBe("failed");
      expect(result.reason).toBe("payment_not_configured");
    });

    it("creates damage task when damage reported", async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue(mockReservation);
      mockPrisma.reservation.update.mockResolvedValue({
        ...mockReservation,
        checkOutStatus: "completed",
      });
      mockPrisma.communication.create.mockResolvedValue({});
      mockPrisma.task.create.mockResolvedValue({});

      await service.selfCheckout("res-1", {
        damageNotes: "Broken window",
        damagePhotos: ["photo1.jpg"],
      });

      expect(mockPrisma.task.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: "inspection",
          notes: expect.stringContaining("Broken window"),
        }),
      });
    });
  });
});
