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

const getPrivateMethod = (target: object, key: string): Function => {
  const value = Reflect.get(target, key);
  if (typeof value !== "function") {
    throw new Error(`Expected ${key} to be a function`);
  }
  return value;
};

// Lightweight unit tests to guard rig-fit logic used by availability + reservation creation
describe("PublicReservationsService rig validation", () => {
  let moduleRef: TestingModule;
  let service: PublicReservationsService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        PublicReservationsService,
        { provide: PrismaService, useValue: {} },
        { provide: LockService, useValue: {} },
        { provide: PromotionsService, useValue: {} },
        { provide: EmailService, useValue: {} },
        { provide: AbandonedCartService, useValue: {} },
        { provide: MembershipsService, useValue: {} },
        { provide: SignaturesService, useValue: {} },
        { provide: PoliciesService, useValue: {} },
        { provide: AccessControlService, useValue: {} },
        { provide: PricingV2Service, useValue: {} },
        { provide: DepositPoliciesService, useValue: { calculateDeposit: jest.fn() } },
        { provide: StripeService, useValue: {} },
      ],
    }).compile();

    service = moduleRef.get(PublicReservationsService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it("allows tents and cars on non-RV sites", () => {
    const isRigCompatible = getPrivateMethod(service, "isRigCompatible");
    expect(isRigCompatible.call(service, { siteType: "tent" }, "tent", null)).toBe(true);
    expect(isRigCompatible.call(service, { siteType: "cabin" }, "car", null)).toBe(true);
  });

  it("rejects RVs on non-RV sites", () => {
    const isRigCompatible = getPrivateMethod(service, "isRigCompatible");
    expect(isRigCompatible.call(service, { siteType: "tent" }, "rv", 20)).toBe(false);
  });

  it("rejects rigs that exceed maximum length", () => {
    const isRigCompatible = getPrivateMethod(service, "isRigCompatible");
    expect(isRigCompatible.call(service, { siteType: "rv", rigMaxLength: 30 }, "rv", 35)).toBe(
      false,
    );
  });

  it("allows rigs within maximum length", () => {
    const isRigCompatible = getPrivateMethod(service, "isRigCompatible");
    expect(isRigCompatible.call(service, { siteType: "rv", rigMaxLength: 35 }, "rv", 32)).toBe(
      true,
    );
  });
});
