import { CheckInStatus } from "@prisma/client";
import { Test, type TestingModule } from "@nestjs/testing";
import { SelfCheckinService } from "../self-checkin/self-checkin.service";
import { PrismaService } from "../prisma/prisma.service";
import { SignaturesService } from "../signatures/signatures.service";
import { AuditService } from "../audit/audit.service";
import { AccessControlService } from "../access-control/access-control.service";
import { StripeService } from "../payments/stripe.service";
import { GatewayConfigService } from "../payments/gateway-config.service";
import { PoliciesService } from "../policies/policies.service";

type PrismaMock = {
  reservation: { findUnique: jest.Mock; update: jest.Mock };
  maintenanceTicket: { findFirst: jest.Mock };
  communication: { create: jest.Mock };
  signatureRequest: { findFirst: jest.Mock };
  signatureArtifact: { findFirst: jest.Mock };
  digitalWaiver: { findFirst: jest.Mock };
  idVerification: { findFirst: jest.Mock };
};

describe("SelfCheckinService compliance enforcement", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaMock;
  let signatures: { autoSendForReservation: jest.Mock };
  let audit: { record: jest.Mock };
  let access: { autoGrantForReservation: jest.Mock; revokeAllForReservation: jest.Mock };
  let stripe: { createPaymentIntent: jest.Mock; isConfigured: jest.Mock };
  let gatewayConfig: { getConfig: jest.Mock };
  let policies: { getPendingPolicyCompliance: jest.Mock };
  let service: SelfCheckinService;

  const baseReservation = {
    id: "res1",
    campgroundId: "cg1",
    siteId: "site1",
    guestId: "guest1",
    paymentRequired: true,
    paymentStatus: "paid",
    idVerificationRequired: false,
    waiverRequired: true,
    siteReady: true,
    status: "confirmed",
    guest: { id: "guest1", email: "guest@test.com" },
    campground: { id: "cg1", name: "Test Camp" },
    site: { siteNumber: "A1" },
  };

  beforeEach(async () => {
    prisma = {
      reservation: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      maintenanceTicket: { findFirst: jest.fn() },
      communication: { create: jest.fn() },
      signatureRequest: { findFirst: jest.fn() },
      signatureArtifact: { findFirst: jest.fn() },
      digitalWaiver: { findFirst: jest.fn() },
      idVerification: { findFirst: jest.fn() },
    };
    signatures = { autoSendForReservation: jest.fn() };
    audit = { record: jest.fn() };
    access = { autoGrantForReservation: jest.fn(), revokeAllForReservation: jest.fn() };
    stripe = { createPaymentIntent: jest.fn(), isConfigured: jest.fn() };
    gatewayConfig = { getConfig: jest.fn() };
    policies = { getPendingPolicyCompliance: jest.fn().mockResolvedValue({ ok: true }) };

    moduleRef = await Test.createTestingModule({
      providers: [
        SelfCheckinService,
        { provide: PrismaService, useValue: prisma },
        { provide: SignaturesService, useValue: signatures },
        { provide: AuditService, useValue: audit },
        { provide: AccessControlService, useValue: access },
        { provide: StripeService, useValue: stripe },
        { provide: GatewayConfigService, useValue: gatewayConfig },
        { provide: PoliciesService, useValue: policies },
      ],
    }).compile();

    service = moduleRef.get(SelfCheckinService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it("blocks check-in until waiver is signed and returns signing URL", async () => {
    prisma.reservation.findUnique.mockResolvedValue(baseReservation);
    prisma.maintenanceTicket.findFirst.mockResolvedValue(null);
    prisma.signatureRequest.findFirst.mockResolvedValue(null);
    prisma.signatureArtifact.findFirst.mockResolvedValue(null);
    prisma.digitalWaiver.findFirst.mockResolvedValue(null);
    prisma.reservation.update.mockResolvedValue({
      ...baseReservation,
      checkInStatus: CheckInStatus.pending_waiver,
    });
    signatures.autoSendForReservation.mockResolvedValue({
      signingUrl: "https://app.campreserv.com/sign/token",
    });

    const result = await service.selfCheckin("res1");

    expect(result.status).toBe("failed");
    expect(result.reason).toBe("waiver_required");
    expect(result.signingUrl).toContain("/sign/");
    expect(prisma.reservation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ checkInStatus: CheckInStatus.pending_waiver }),
      }),
    );
  });

  it("allows override but audits and auto-grants access", async () => {
    prisma.reservation.findUnique.mockResolvedValue(baseReservation);
    prisma.maintenanceTicket.findFirst.mockResolvedValue(null);
    prisma.signatureRequest.findFirst.mockResolvedValue(null);
    prisma.signatureArtifact.findFirst.mockResolvedValue(null);
    prisma.digitalWaiver.findFirst.mockResolvedValue(null);
    prisma.reservation.update.mockResolvedValue({
      ...baseReservation,
      status: "checked_in",
      checkInStatus: CheckInStatus.completed,
      selfCheckInAt: new Date(),
    });

    const result = await service.selfCheckin("res1", {
      override: true,
      overrideReason: "staff override",
      actorId: "guest1",
    });

    expect(result.status).toBe("completed");
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "checkin.override",
        actorId: "guest1",
        entityId: "res1",
      }),
    );
    expect(access.autoGrantForReservation).toHaveBeenCalledWith("res1", "guest1");
  });
});
