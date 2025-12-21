import { ReservationsService } from "../reservations/reservations.service";
import { PrismaService } from "../prisma/prisma.service";
import { postBalancedLedgerEntries } from "../ledger/ledger-posting.util";

jest.mock("../ledger/ledger-posting.util", () => ({
  postBalancedLedgerEntries: jest.fn().mockResolvedValue(undefined)
}));

describe("ReservationsService refundPayment", () => {
  let prisma: {
    reservation: { findUnique: jest.Mock; update: jest.Mock };
    payment: { create: jest.Mock };
  };
  let service: ReservationsService;

  beforeEach(() => {
    prisma = {
      reservation: { findUnique: jest.fn(), update: jest.fn() },
      payment: { create: jest.fn() }
    };

    service = new ReservationsService(
      prisma as unknown as PrismaService,
      {} as any,
      {} as any,
      { sendPaymentReceipt: jest.fn().mockResolvedValue(undefined) } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );
  });

  it("throws when refund exceeds paid amount", async () => {
    prisma.reservation.findUnique.mockResolvedValue({
      id: "res1",
      campgroundId: "cg1",
      totalAmount: 5000,
      paidAmount: 5000,
      site: { siteClass: { glCode: "GL", clientAccount: "Revenue" } },
      guest: { email: "guest@example.com", primaryFirstName: "Test", primaryLastName: "Guest" },
      campground: { name: "Campground" }
    });

    await expect(service.refundPayment("res1", 6000)).rejects.toThrow("Refund exceeds paid amount");
  });

  it("updates paid amount and posts ledger entries", async () => {
    prisma.reservation.findUnique.mockResolvedValue({
      id: "res1",
      campgroundId: "cg1",
      totalAmount: 5000,
      paidAmount: 5000,
      site: { siteClass: { glCode: "GL", clientAccount: "Revenue" } },
      guest: { email: "guest@example.com", primaryFirstName: "Test", primaryLastName: "Guest" },
      campground: { name: "Campground" }
    });
    prisma.reservation.update.mockResolvedValue({ id: "res1" });

    await service.refundPayment("res1", 2000);

    expect(prisma.reservation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paidAmount: 3000,
          balanceAmount: 2000,
          paymentStatus: "partial"
        })
      })
    );
    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amountCents: 2000,
          direction: "refund"
        })
      })
    );
    expect(postBalancedLedgerEntries).toHaveBeenCalled();
  });
});
