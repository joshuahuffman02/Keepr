import { PublicReservationsService } from "../public-reservations/public-reservations.service";
import { PrismaService } from "../prisma/prisma.service";

jest.mock("@prisma/client", () => ({
  PrismaClient: class { },
  ReservationStatus: {
    pending: "pending",
    confirmed: "confirmed",
    checked_in: "checked_in",
    checked_out: "checked_out",
    cancelled: "cancelled"
  },
  TaxRuleType: {
    tax: "tax",
    exemption: "exemption",
    percentage: "percentage",
    flat: "flat"
  },
  MembershipType: class { },
  GuestMembership: class { },
  Prisma: {}
}));

type PrismaMock = {
  campground: { findUnique: jest.Mock };
} & Partial<PrismaService>;

describe("PublicReservationsService site lock validation", () => {
  let service: PublicReservationsService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = {
      campground: { findUnique: jest.fn() }
    } as PrismaMock;

    service = new PublicReservationsService(
      prisma as unknown as PrismaService,
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

  it("requires siteId when siteLocked is true", async () => {
    prisma.campground.findUnique = jest.fn().mockResolvedValue({
      id: "cg1",
      isPublished: true,
      isBookable: true,
      isExternal: false,
      nonBookableReason: null,
      depositRule: null,
      depositPercentage: null
    });

    await expect(service.createReservation({
      campgroundSlug: "camp-1",
      siteLocked: true,
      arrivalDate: "2025-06-10",
      departureDate: "2025-06-12",
      adults: 2,
      guest: {
        firstName: "Test",
        lastName: "Guest",
        email: "test@example.com",
        phone: "555-555-1212",
        zipCode: "12345"
      }
    } as any)).rejects.toThrow("siteLocked requires siteId.");
  });
});
