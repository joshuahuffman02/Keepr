import { createHmac } from "crypto";
import { Test, TestingModule } from "@nestjs/testing";
import { PublicReservationsService } from "../public-reservations/public-reservations.service";
import { PrismaService } from "../prisma/prisma.service";
import { LockService } from "../redis/lock.service";
import { PromotionsService } from "../promotions/promotions.service";
import { EmailService } from "../email/email.service";
import { AbandonedCartService } from "../abandoned-cart/abandoned-cart.service";
import { MembershipsService } from "../memberships/memberships.service";
import { SignaturesService } from "../signatures/signatures.service";
import { PoliciesService } from "../policies/policies.service";
import { AccessControlService } from "../access-control/access-control.service";
import { PricingV2Service } from "../pricing-v2/pricing-v2.service";
import { DepositPoliciesService } from "../deposit-policies/deposit-policies.service";
import { StripeService } from "../payments/stripe.service";

jest.mock("@prisma/client", () => ({
  PrismaClient: class {},
  ReservationStatus: {
    pending: "pending",
    confirmed: "confirmed",
    checked_in: "checked_in",
    checked_out: "checked_out",
    cancelled: "cancelled",
  },
  TaxRuleType: {
    tax: "tax",
    exemption: "exemption",
    percentage: "percentage",
    flat: "flat",
  },
  SignatureRequestStatus: {
    preview: "preview",
    draft: "draft",
    sent: "sent",
    viewed: "viewed",
    signed: "signed",
    signed_paper: "signed_paper",
    waived: "waived",
    declined: "declined",
    voided: "voided",
    expired: "expired",
  },
  SignatureDocumentType: {
    long_term_stay: "long_term_stay",
    seasonal: "seasonal",
    monthly: "monthly",
    park_rules: "park_rules",
    deposit: "deposit",
    waiver: "waiver",
    coi: "coi",
    other: "other",
  },
  SignatureDeliveryChannel: {
    email: "email",
    sms: "sms",
    email_and_sms: "email_and_sms",
  },
  SignatureMethod: {
    digital: "digital",
    paper: "paper",
    waived: "waived",
  },
  CoiStatus: {
    pending: "pending",
    active: "active",
    expired: "expired",
    rejected: "rejected",
  },
  MembershipType: class {},
  GuestMembership: class {},
  Prisma: {},
}));

type PrismaMock = {
  pricingRule: { findMany: jest.Mock };
  site: { findUnique: jest.Mock };
  taxRule: { findMany: jest.Mock };
  campground: { findUnique: jest.Mock };
  reservation: { findUnique: jest.Mock };
  onboardingInvite: { findUnique: jest.Mock };
};

type LockMock = { withLocks: jest.Mock };
type PromotionsMock = { validate: jest.Mock };
type MembershipsMock = {
  getActiveMembershipById: jest.Mock;
  getActiveMembershipByGuest: jest.Mock;
};
type PoliciesMock = { evaluatePolicies: jest.Mock };
type PricingV2Mock = { evaluate: jest.Mock };
type DepositPoliciesMock = { resolve: jest.Mock; calculateDeposit: jest.Mock };

type ReservationRecord = {
  id: string;
  campgroundId: string;
  siteId: string;
  guestId: string;
  arrivalDate: Date;
  departureDate: Date;
  promoCode: string | null;
  taxWaiverSigned: boolean | null;
  Guest: { primaryFirstName: string; primaryLastName: string };
  Campground: { name: string; slug: string; city: string; state: string; timezone: string };
  Site: { SiteClass: { name: string; photos: string[] } };
};

type QuoteResult = Awaited<ReturnType<PublicReservationsService["getQuote"]>>;

describe("PublicReservationsService pricing", () => {
  let service: PublicReservationsService;
  let prisma: PrismaMock;
  let moduleRef: TestingModule;
  let locks: LockMock;
  let promotionsService: PromotionsMock;
  let membershipsService: MembershipsMock;
  let policiesService: PoliciesMock;
  let pricingV2Service: PricingV2Mock;
  let depositPoliciesService: DepositPoliciesMock;
  let emailService: Partial<EmailService>;
  let abandonedCartService: Partial<AbandonedCartService>;
  let signaturesService: Partial<SignaturesService>;
  let accessControlService: Partial<AccessControlService>;
  let stripeService: Partial<StripeService>;

  const tokenSecret = "test-public-reservation-secret";
  const originalTokenSecret = process.env.PUBLIC_RESERVATION_TOKEN_SECRET;

  beforeAll(() => {
    process.env.PUBLIC_RESERVATION_TOKEN_SECRET = tokenSecret;
  });

  afterAll(() => {
    if (originalTokenSecret === undefined) {
      delete process.env.PUBLIC_RESERVATION_TOKEN_SECRET;
    } else {
      process.env.PUBLIC_RESERVATION_TOKEN_SECRET = originalTokenSecret;
    }
  });

  beforeEach(async () => {
    prisma = {
      pricingRule: { findMany: jest.fn() },
      site: { findUnique: jest.fn() },
      taxRule: { findMany: jest.fn() },
      campground: { findUnique: jest.fn() },
      reservation: { findUnique: jest.fn() },
      onboardingInvite: { findUnique: jest.fn() },
    };
    locks = { withLocks: jest.fn((_keys: string[], fn: () => Promise<unknown>) => fn()) };
    promotionsService = { validate: jest.fn() };
    membershipsService = {
      getActiveMembershipById: jest.fn(),
      getActiveMembershipByGuest: jest.fn(),
    };
    policiesService = { evaluatePolicies: jest.fn().mockResolvedValue([]) };
    pricingV2Service = { evaluate: jest.fn() };
    depositPoliciesService = {
      resolve: jest.fn().mockResolvedValue(null),
      calculateDeposit: jest.fn().mockResolvedValue(null),
    };
    emailService = {};
    abandonedCartService = {};
    signaturesService = {};
    accessControlService = {};
    stripeService = {};

    moduleRef = await Test.createTestingModule({
      providers: [
        PublicReservationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: LockService, useValue: locks },
        { provide: PromotionsService, useValue: promotionsService },
        { provide: EmailService, useValue: emailService },
        { provide: AbandonedCartService, useValue: abandonedCartService },
        { provide: MembershipsService, useValue: membershipsService },
        { provide: SignaturesService, useValue: signaturesService },
        { provide: PoliciesService, useValue: policiesService },
        { provide: AccessControlService, useValue: accessControlService },
        { provide: PricingV2Service, useValue: pricingV2Service },
        { provide: DepositPoliciesService, useValue: depositPoliciesService },
        { provide: StripeService, useValue: stripeService },
      ],
    }).compile();

    service = moduleRef.get(PublicReservationsService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it("applies promo then membership and computes taxes on discounted subtotal", async () => {
    prisma.campground.findUnique = jest.fn().mockResolvedValue({
      id: "cg1",
      isPublished: true,
      isBookable: true,
      isExternal: false,
      nonBookableReason: null,
    });

    prisma.site.findUnique = jest.fn().mockResolvedValue({
      id: "site1",
      campgroundId: "cg1",
      siteClassId: "sc1",
      siteClass: { defaultRate: 10000 }, // $100.00
    });

    pricingV2Service.evaluate.mockResolvedValue({
      nights: 2,
      baseSubtotalCents: 20000,
      adjustmentsCents: 0,
      demandAdjustmentCents: 0,
      totalBeforeTaxCents: 20000,
      appliedRules: [],
      pricingRuleVersion: "v2:test",
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
      value: 20,
    });
    promotionsService.validate = promoValidate;

    // Membership 10%
    membershipsService.getActiveMembershipById = jest.fn().mockResolvedValue({
      id: "mem1",
      MembershipType: { discountPercent: 10, isActive: true },
    });

    const quote = await service.getQuote("slug", {
      siteId: "site1",
      arrivalDate: "2025-06-01",
      departureDate: "2025-06-03",
      promoCode: "PROMO20",
      membershipId: "mem1",
      taxWaiverSigned: false,
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
      nonBookableReason: null,
    });

    prisma.site.findUnique = jest.fn().mockResolvedValue({
      id: "site1",
      campgroundId: "cg1",
      siteClassId: "sc1",
      siteClass: { defaultRate: 10000 }, // $100/night
    });

    pricingV2Service.evaluate.mockResolvedValue({
      nights: 1,
      baseSubtotalCents: 10000,
      adjustmentsCents: 0,
      demandAdjustmentCents: 0,
      totalBeforeTaxCents: 10000,
      appliedRules: [],
      pricingRuleVersion: "v2:test",
    });

    // Exemption requires waiver; also a tax rule exists (10%) to verify waiver needed
    prisma.taxRule.findMany = jest.fn().mockImplementation(({ where }) => {
      if (where.type === "exemption") {
        return [
          {
            minNights: 1,
            maxNights: 10,
            requiresWaiver: true,
            waiverText: "Sign to waive",
            isActive: true,
          },
        ];
      }
      return [{ rate: 0.1, isActive: true }];
    });

    // No promos/memberships here
    promotionsService.validate = jest.fn();
    membershipsService.getActiveMembershipById = jest.fn();

    // Without waiver: taxes apply, waiverRequired flagged
    const quoteNoWaiver = await service.getQuote("slug", {
      siteId: "site1",
      arrivalDate: "2025-06-01",
      departureDate: "2025-06-02",
      taxWaiverSigned: false,
    });
    expect(quoteNoWaiver.taxesCents).toBe(1000); // 10% of $100
    expect(quoteNoWaiver.taxWaiverRequired).toBe(true);
    expect(quoteNoWaiver.taxExemptionApplied).toBe(false);

    // With waiver: exemption applies, taxes zero
    const quoteWithWaiver = await service.getQuote("slug", {
      siteId: "site1",
      arrivalDate: "2025-06-01",
      departureDate: "2025-06-02",
      taxWaiverSigned: true,
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
      nonBookableReason: null,
    });

    prisma.site.findUnique = jest.fn().mockResolvedValue({
      id: "site1",
      campgroundId: "cg1",
      siteClassId: "sc1",
      siteClass: { defaultRate: 10000 }, // $100/night
    });

    pricingV2Service.evaluate.mockResolvedValue({
      nights: 1,
      baseSubtotalCents: 10000,
      adjustmentsCents: 0,
      demandAdjustmentCents: 0,
      totalBeforeTaxCents: 10000,
      appliedRules: [],
      pricingRuleVersion: "v2:test",
    });
    prisma.taxRule.findMany = jest.fn().mockResolvedValue([]); // ignore taxes here

    // Promo flat $50 off (5000 cents)
    promotionsService.validate = jest.fn().mockResolvedValue({
      valid: true,
      discountCents: 5000,
      promotionId: "promo-flat",
      code: "HALF",
      type: "flat",
      value: 5000,
    });

    // Membership 30% off -> $30
    membershipsService.getActiveMembershipById = jest.fn().mockResolvedValue({
      id: "mem-big",
      MembershipType: { discountPercent: 30, isActive: true },
    });

    const quote = await service.getQuote("slug", {
      siteId: "site1",
      arrivalDate: "2025-06-01",
      departureDate: "2025-06-02",
      promoCode: "HALF",
      membershipId: "mem-big",
      taxWaiverSigned: false,
    });

    // Base $100. Max discount at 40% cap => $40 max.
    expect(quote.discountCents).toBe(4000);
    expect(quote.discountCapped).toBe(true);
    expect(quote.appliedDiscounts?.some((d) => d.capped)).toBe(true);
    expect(quote.totalAfterDiscountCents).toBe(6000); // 10000 - 4000
    expect(quote.rejectedDiscounts?.length).toBeGreaterThan(0);
  });

  it("returns zero taxes when no tax rules are active", async () => {
    prisma.campground.findUnique = jest.fn().mockResolvedValue({
      id: "cg1",
      isPublished: true,
      isBookable: true,
      isExternal: false,
      nonBookableReason: null,
    });

    prisma.site.findUnique = jest.fn().mockResolvedValue({
      id: "site1",
      campgroundId: "cg1",
      siteClassId: "sc1",
      siteClass: { defaultRate: 12000 }, // $120/night
    });

    pricingV2Service.evaluate.mockResolvedValue({
      nights: 2,
      baseSubtotalCents: 24000,
      adjustmentsCents: 0,
      demandAdjustmentCents: 0,
      totalBeforeTaxCents: 24000,
      appliedRules: [],
      pricingRuleVersion: "v2:test",
    });

    prisma.pricingRule.findMany = jest.fn().mockResolvedValue([]);
    prisma.taxRule.findMany = jest.fn().mockResolvedValue([]); // no taxes, no exemptions

    // No promos/memberships
    promotionsService.validate = jest.fn();
    membershipsService.getActiveMembershipById = jest.fn();

    const quote = await service.getQuote("slug", {
      siteId: "site1",
      arrivalDate: "2025-07-01",
      departureDate: "2025-07-03",
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
      nonBookableReason: null,
    });

    prisma.site.findUnique = jest.fn().mockResolvedValue({
      id: "site1",
      campgroundId: "cg1",
      siteClassId: "sc1",
      siteClass: { defaultRate: 11000 }, // price is tax-inclusive at 10%
    });

    pricingV2Service.evaluate.mockResolvedValue({
      nights: 1,
      baseSubtotalCents: 11000,
      adjustmentsCents: 0,
      demandAdjustmentCents: 0,
      totalBeforeTaxCents: 11000,
      appliedRules: [],
      pricingRuleVersion: "v2:test",
    });

    prisma.pricingRule.findMany = jest.fn().mockResolvedValue([]);
    // Tax rule inclusive 10%
    prisma.taxRule.findMany = jest.fn().mockImplementation(({ where }) => {
      if (where.type === "exemption") return [];
      return [{ rate: 0.1, isActive: true, inclusive: true }];
    });

    // No promos/memberships
    promotionsService.validate = jest.fn();
    membershipsService.getActiveMembershipById = jest.fn();

    const quote = await service.getQuote("slug", {
      siteId: "site1",
      arrivalDate: "2025-08-01",
      departureDate: "2025-08-02",
    });

    // With inclusive tax, the taxable base should be backed out: price / 1.1
    const expectedNet = Math.round(11000 / 1.1);
    const expectedTax = 11000 - expectedNet;

    expect(quote.baseSubtotalCents).toBe(11000);
    expect(quote.taxesCents).toBeCloseTo(expectedTax, 0);
    expect(quote.totalWithTaxesCents).toBe(11000); // inclusive price remains
  });

  it("surfaces rejected discounts when fetching a reservation", async () => {
    const reservationRecord: ReservationRecord = {
      id: "res1",
      campgroundId: "cg1",
      siteId: "site1",
      guestId: "guest1",
      arrivalDate: new Date("2025-06-01"),
      departureDate: new Date("2025-06-02"),
      promoCode: "PROMO20",
      taxWaiverSigned: false,
      Guest: { primaryFirstName: "Guest", primaryLastName: "One" },
      Campground: { name: "Camp One", slug: "camp-one", city: "X", state: "Y", timezone: "UTC" },
      Site: { SiteClass: { name: "A", photos: [] } },
    };

    prisma.reservation.findUnique = jest.fn().mockResolvedValue(reservationRecord);
    membershipsService.getActiveMembershipByGuest = jest.fn().mockResolvedValue(null);

    const mockQuote: QuoteResult = {
      nights: 1,
      baseSubtotalCents: 10000,
      rulesDeltaCents: 0,
      totalCents: 10000,
      discountCents: 4000,
      discountCapped: false,
      promotionId: "promo",
      appliedDiscounts: [{ id: "promo", type: "promo", amountCents: 4000, capped: false }],
      rejectedDiscounts: [{ id: "membership", reason: "non_stackable" }],
      totalAfterDiscountCents: 6000,
      taxesCents: 0,
      totalWithTaxesCents: 6000,
      perNightCents: 6000,
      taxWaiverRequired: false,
      taxWaiverText: null,
      taxExemptionApplied: false,
      referralProgramId: null,
      referralDiscountCents: 0,
      referralIncentiveType: null,
      referralIncentiveValue: 0,
      referralSource: null,
      referralChannel: null,
      policyRequirements: [],
    };
    const quoteSpy = jest.spyOn(service, "getQuote").mockResolvedValue(mockQuote);

    const token = createHmac("sha256", tokenSecret).update("res1").digest("base64url");
    const result = await service.getReservation("res1", token);

    expect(result.appliedDiscounts).toEqual(mockQuote.appliedDiscounts);
    expect(result.rejectedDiscounts).toEqual(mockQuote.rejectedDiscounts);
    expect(result.discountCapped).toBe(false);
    expect(quoteSpy).toHaveBeenCalled();
  });
});
