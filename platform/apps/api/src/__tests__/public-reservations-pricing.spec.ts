import { PublicReservationsService } from "../public-reservations/public-reservations.service";
import { PrismaService } from "../prisma/prisma.service";
import { LockService } from "../redis/lock.service";
import { PromotionsService } from "../promotions/promotions.service";
import { EmailService } from "../email/email.service";
import { AbandonedCartService } from "../abandoned-cart/abandoned-cart.service";
import { MembershipsService } from "../memberships/memberships.service";

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
  pricingRule: { findMany: jest.Mock };
  site: { findUnique: jest.Mock };
  taxRule: { findMany: jest.Mock };
  campground: { findUnique: jest.Mock };
  reservation: { findUnique: jest.Mock };
} & Partial<PrismaService>;

describe("PublicReservationsService pricing", () => {
  let service: PublicReservationsService;
  let prisma: PrismaMock;
  let pricingV2Service: { evaluate: jest.Mock };

  beforeEach(() => {
    prisma = {
      pricingRule: { findMany: jest.fn() },
      site: { findUnique: jest.fn() },
      taxRule: { findMany: jest.fn() },
      campground: { findUnique: jest.fn() },
      reservation: { findUnique: jest.fn() }
    } as PrismaMock;
    pricingV2Service = { evaluate: jest.fn() };
    service = new PublicReservationsService(
      prisma as unknown as PrismaService,
      { withLocks: (_keys: any, fn: any) => fn() } as LockService,
      { validate: jest.fn() } as unknown as PromotionsService,
      {} as EmailService,
      {} as AbandonedCartService,
      { getActiveMembershipById: jest.fn(), getActiveMembershipByGuest: jest.fn() } as unknown as MembershipsService,
      {} as any,
      {} as any,
      {} as any,
      pricingV2Service as any,
      {} as any
    );
  });

  it("applies promo then membership and computes taxes on discounted subtotal", async () => {
    prisma.campground.findUnique = jest.fn().mockResolvedValue({
      id: "cg1",
      isPublished: true,
      isBookable: true,
      isExternal: false,
      nonBookableReason: null
    });

    prisma.site.findUnique = jest.fn().mockResolvedValue({
      id: "site1",
      campgroundId: "cg1",
      siteClassId: "sc1",
      siteClass: { defaultRate: 10000 } // $100.00
    });

    pricingV2Service.evaluate.mockResolvedValue({
      nights: 2,
      baseSubtotalCents: 20000,
      adjustmentsCents: 0,
      demandAdjustmentCents: 0,
      totalBeforeTaxCents: 20000,
      appliedRules: [],
      pricingRuleVersion: "v2:test"
    });

    // Tax 10%
    prisma.taxRule.findMany = jest.fn().mockImplementation(({ where }) => {
      if (where.type === "exemption") return [];
      return [{ rate: 0.1 }];
    });

    // Promo 20% off, membership 10% off (priority favors membership if we choose, but both are non-stackable in resolver)
    const promoValidate = jest.fn().mockResolvedValue({
      valid: true,
      discountCents: 2000,
      promotionId: "promo1",
      code: "PROMO20",
      type: "percentage",
      value: 20
    });
    // @ts-ignore
    service["promotionsService"].validate = promoValidate;

    // Membership 10%
    // @ts-ignore
    service["memberships"].getActiveMembershipById = jest.fn().mockResolvedValue({
      id: "mem1",
      membershipType: { discountPercent: 10, isActive: true }
    });

    const quote = await service.getQuote("slug", {
      siteId: "site1",
      arrivalDate: "2025-06-01",
      departureDate: "2025-06-03",
      promoCode: "PROMO20",
      membershipId: "mem1",
      taxWaiverSigned: false
    });

    // Base: 2 nights * $100 = $20000 cents
    expect(quote.baseSubtotalCents).toBe(20000);
    // Discount should pick best non-stackable; promo 20% = $40, membership 10% = $20 => expect promo wins
    expect(quote.discountCents).toBe(4000);
    // Taxes at 10% on discounted subtotal ($160) => 16000 * 0.1 = 1600 cents
    expect(quote.taxesCents).toBe(1600);
    expect(quote.totalWithTaxesCents).toBe(20000 - 4000 + 1600);
    expect(quote.appliedDiscounts?.length).toBeGreaterThan(0);
  });

  it("applies tax exemption only when waiver signed", async () => {
    prisma.campground.findUnique = jest.fn().mockResolvedValue({
      id: "cg1",
      isPublished: true,
      isBookable: true,
      isExternal: false,
      nonBookableReason: null
    });

    prisma.site.findUnique = jest.fn().mockResolvedValue({
      id: "site1",
      campgroundId: "cg1",
      siteClassId: "sc1",
      siteClass: { defaultRate: 10000 } // $100/night
    });

    pricingV2Service.evaluate.mockResolvedValue({
      nights: 1,
      baseSubtotalCents: 10000,
      adjustmentsCents: 0,
      demandAdjustmentCents: 0,
      totalBeforeTaxCents: 10000,
      appliedRules: [],
      pricingRuleVersion: "v2:test"
    });

    // Exemption requires waiver; also a tax rule exists (10%) to verify waiver needed
    prisma.taxRule.findMany = jest.fn().mockImplementation(({ where }) => {
      if (where.type === "exemption") {
        return [{ minNights: 1, maxNights: 10, requiresWaiver: true, waiverText: "Sign to waive", isActive: true }];
      }
      return [{ rate: 0.1, isActive: true }];
    });

    // No promos/memberships here
    // @ts-ignore
    service["promotionsService"].validate = jest.fn();
    // @ts-ignore
    service["memberships"].getActiveMembershipById = jest.fn();

    // Without waiver: taxes apply, waiverRequired flagged
    const quoteNoWaiver = await service.getQuote("slug", {
      siteId: "site1",
      arrivalDate: "2025-06-01",
      departureDate: "2025-06-02",
      taxWaiverSigned: false
    });
    expect(quoteNoWaiver.taxesCents).toBe(1000); // 10% of $100
    expect(quoteNoWaiver.taxWaiverRequired).toBe(true);
    expect(quoteNoWaiver.taxExemptionApplied).toBe(false);

    // With waiver: exemption applies, taxes zero
    const quoteWithWaiver = await service.getQuote("slug", {
      siteId: "site1",
      arrivalDate: "2025-06-01",
      departureDate: "2025-06-02",
      taxWaiverSigned: true
    });
    expect(quoteWithWaiver.taxesCents).toBe(0);
    expect(quoteWithWaiver.taxExemptionApplied).toBe(true);
    expect(quoteWithWaiver.taxWaiverRequired).toBe(false);
  });

  it("caps stacked discounts at max fraction (default 40%)", async () => {
    prisma.campground.findUnique = jest.fn().mockResolvedValue({
      id: "cg1",
      isPublished: true,
      isBookable: true,
      isExternal: false,
      nonBookableReason: null
    });

    prisma.site.findUnique = jest.fn().mockResolvedValue({
      id: "site1",
      campgroundId: "cg1",
      siteClassId: "sc1",
      siteClass: { defaultRate: 10000 } // $100/night
    });

    pricingV2Service.evaluate.mockResolvedValue({
      nights: 1,
      baseSubtotalCents: 10000,
      adjustmentsCents: 0,
      demandAdjustmentCents: 0,
      totalBeforeTaxCents: 10000,
      appliedRules: [],
      pricingRuleVersion: "v2:test"
    });
    prisma.taxRule.findMany = jest.fn().mockResolvedValue([]); // ignore taxes here

    // Promo flat $50 off (5000 cents)
    // @ts-ignore
    service["promotionsService"].validate = jest.fn().mockResolvedValue({
      valid: true,
      discountCents: 5000,
      promotionId: "promo-flat",
      code: "HALF",
      type: "flat",
      value: 5000
    });

    // Membership 30% off -> $30
    // @ts-ignore
    service["memberships"].getActiveMembershipById = jest.fn().mockResolvedValue({
      id: "mem-big",
      membershipType: { discountPercent: 30, isActive: true }
    });

    const quote = await service.getQuote("slug", {
      siteId: "site1",
      arrivalDate: "2025-06-01",
      departureDate: "2025-06-02",
      promoCode: "HALF",
      membershipId: "mem-big",
      taxWaiverSigned: false
    });

    // Base $100. Max discount at 40% cap => $40 max.
    expect(quote.discountCents).toBe(4000);
    expect(quote.discountCapped).toBe(true);
    expect(quote.appliedDiscounts?.some(d => d.capped)).toBe(true);
    expect(quote.totalAfterDiscountCents).toBe(6000); // 10000 - 4000
    expect(quote.rejectedDiscounts?.length).toBeGreaterThan(0);
  });

  it("returns zero taxes when no tax rules are active", async () => {
    prisma.campground.findUnique = jest.fn().mockResolvedValue({
      id: "cg1",
      isPublished: true,
      isBookable: true,
      isExternal: false,
      nonBookableReason: null
    });

    prisma.site.findUnique = jest.fn().mockResolvedValue({
      id: "site1",
      campgroundId: "cg1",
      siteClassId: "sc1",
      siteClass: { defaultRate: 12000 } // $120/night
    });

    prisma.pricingRule.findMany = jest.fn().mockResolvedValue([]);
    prisma.taxRule.findMany = jest.fn().mockResolvedValue([]); // no taxes, no exemptions

    // No promos/memberships
    // @ts-ignore
    service["promotionsService"].validate = jest.fn();
    // @ts-ignore
    service["memberships"].getActiveMembershipById = jest.fn();

    const quote = await service.getQuote("slug", {
      siteId: "site1",
      arrivalDate: "2025-07-01",
      departureDate: "2025-07-03"
    });

    expect(quote.baseSubtotalCents).toBe(24000); // 2 nights * 120
    expect(quote.taxesCents).toBe(0);
    expect(quote.totalWithTaxesCents).toBe(quote.totalAfterDiscountCents);
  });

  it("handles tax-inclusive pricing by backing out tax before discounts", async () => {
    prisma.campground.findUnique = jest.fn().mockResolvedValue({
      id: "cg1",
      isPublished: true,
      isBookable: true,
      isExternal: false,
      nonBookableReason: null
    });

    prisma.site.findUnique = jest.fn().mockResolvedValue({
      id: "site1",
      campgroundId: "cg1",
      siteClassId: "sc1",
      siteClass: { defaultRate: 11000 } // price is tax-inclusive at 10%
    });

    prisma.pricingRule.findMany = jest.fn().mockResolvedValue([]);
    // Tax rule inclusive 10%
    prisma.taxRule.findMany = jest.fn().mockImplementation(({ where }) => {
      if (where.type === "exemption") return [];
      return [{ rate: 0.1, isActive: true, inclusive: true }];
    });

    // No promos/memberships
    // @ts-ignore
    service["promotionsService"].validate = jest.fn();
    // @ts-ignore
    service["memberships"].getActiveMembershipById = jest.fn();

    const quote = await service.getQuote("slug", {
      siteId: "site1",
      arrivalDate: "2025-08-01",
      departureDate: "2025-08-02"
    });

    // With inclusive tax, the taxable base should be backed out: price / 1.1
    const expectedNet = Math.round(11000 / 1.1);
    const expectedTax = 11000 - expectedNet;

    expect(quote.baseSubtotalCents).toBe(11000);
    expect(quote.taxesCents).toBeCloseTo(expectedTax, 0);
    expect(quote.totalWithTaxesCents).toBe(11000); // inclusive price remains
  });

  it("surfaces rejected discounts when fetching a reservation", async () => {
    const reservationRecord = {
      id: "res1",
      campgroundId: "cg1",
      siteId: "site1",
      guestId: "guest1",
      arrivalDate: new Date("2025-06-01"),
      departureDate: new Date("2025-06-02"),
      promoCode: "PROMO20",
      taxWaiverSigned: false,
      guest: { primaryFirstName: "Guest", primaryLastName: "One" },
      campground: { name: "Camp One", slug: "camp-one", city: "X", state: "Y", timezone: "UTC" },
      site: { siteClass: { name: "A", photos: [] } }
    };

    prisma.reservation.findUnique = jest.fn().mockResolvedValue(reservationRecord as any);
    // @ts-ignore
    service["memberships"].getActiveMembershipByGuest = jest.fn().mockResolvedValue(null);

    const mockQuote = {
      appliedDiscounts: [{ id: "promo", type: "promo", amountCents: 4000 }],
      rejectedDiscounts: [{ id: "membership", reason: "non_stackable" }],
      discountCapped: false
    };
    const quoteSpy = jest.spyOn(service, "getQuote").mockResolvedValue(mockQuote as any);

    const result = await service.getReservation("res1");

    expect(result.appliedDiscounts).toEqual(mockQuote.appliedDiscounts);
    expect(result.rejectedDiscounts).toEqual(mockQuote.rejectedDiscounts);
    expect(result.discountCapped).toBe(false);
    expect(quoteSpy).toHaveBeenCalled();
  });
});
