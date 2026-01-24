import { Test, type TestingModule } from "@nestjs/testing";
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
  campground: { findUnique: jest.Mock };
};

describe("PublicReservationsService site lock validation", () => {
  let service: PublicReservationsService;
  let prisma: PrismaMock;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    prisma = {
      campground: { findUnique: jest.fn() },
    };

    moduleRef = await Test.createTestingModule({
      providers: [
        PublicReservationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: LockService, useValue: {} },
        { provide: PromotionsService, useValue: {} },
        { provide: EmailService, useValue: {} },
        { provide: AbandonedCartService, useValue: {} },
        {
          provide: MembershipsService,
          useValue: { getActiveMembershipById: jest.fn(), getActiveMembershipByGuest: jest.fn() },
        },
        { provide: SignaturesService, useValue: {} },
        {
          provide: PoliciesService,
          useValue: {
            evaluatePolicies: jest
              .fn()
              .mockResolvedValue({ waiverRequired: false, signatureRequired: false }),
          },
        },
        { provide: AccessControlService, useValue: {} },
        { provide: PricingV2Service, useValue: {} },
        {
          provide: DepositPoliciesService,
          useValue: {
            resolve: jest.fn().mockResolvedValue(null),
            calculateDeposit: jest.fn().mockResolvedValue(null),
          },
        },
        { provide: StripeService, useValue: {} },
      ],
    }).compile();

    service = moduleRef.get(PublicReservationsService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it("requires siteId when siteLocked is true", async () => {
    prisma.campground.findUnique.mockResolvedValue({
      id: "cg1",
      isPublished: true,
      isBookable: true,
      isExternal: false,
      nonBookableReason: null,
      depositRule: null,
      depositPercentage: null,
    });

    await expect(
      service.createReservation({
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
          zipCode: "12345",
        },
      }),
    ).rejects.toThrow("siteLocked requires siteId.");
  });
});
