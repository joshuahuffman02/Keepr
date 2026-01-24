import { AccessGrantStatus, AccessProviderType, IdempotencyStatus } from "@prisma/client";
import { Test } from "@nestjs/testing";
import { AccessControlService } from "../access-control/access-control.service";
import { IdempotencyService } from "../payments/idempotency.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AccessProviderRegistry } from "../access-control/access-provider.registry";

describe("AccessControlService", () => {
  const adapter = {
    provider: AccessProviderType.kisi,
    provisionAccess: jest
      .fn()
      .mockResolvedValue({ status: AccessGrantStatus.active, providerAccessId: "external-1" }),
    revokeAccess: jest.fn().mockResolvedValue({ status: AccessGrantStatus.revoked }),
    verifyWebhookSignature: jest.fn().mockReturnValue(true),
  };

  const registry = {
    getAdapter: jest.fn(() => adapter),
  };

  const makePrisma = () => ({
    reservation: {
      findUnique: jest.fn().mockResolvedValue({
        id: "res-1",
        campgroundId: "camp-1",
        guestId: "guest-1",
        status: "confirmed",
        siteId: "site-1",
        guest: { primaryFirstName: "Ada", primaryLastName: "Lovelace" },
        site: { id: "site-1" },
        rigLength: 30,
        rigType: "rv",
        vehiclePlate: "ABC123",
      }),
    },
    accessGrant: {
      upsert: jest.fn().mockResolvedValue({
        id: "grant-1",
        reservationId: "res-1",
        provider: AccessProviderType.kisi,
        status: AccessGrantStatus.pending,
      }),
      update: jest.fn().mockImplementation((_args: Record<string, unknown>) => ({
        id: "grant-1",
        status: AccessGrantStatus.active,
        providerAccessId: "external-1",
      })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findFirst: jest.fn().mockResolvedValue({
        id: "grant-1",
        reservationId: "res-1",
        provider: AccessProviderType.kisi,
        providerAccessId: "external-1",
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    accessCredential: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: "cred-1" }),
    },
    vehicle: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: "veh-1", plate: "ABC123" }),
    },
    accessIntegration: {
      findFirst: jest.fn().mockResolvedValue({
        id: "int-1",
        campgroundId: "camp-1",
        provider: AccessProviderType.kisi,
        credentials: {},
        webhookSecret: "secret",
      }),
    },
  });

  const makeIdempotency = () => ({
    start: jest.fn(),
    complete: jest.fn(),
    fail: jest.fn(),
  });

  const makeAudit = () => ({
    record: jest.fn(),
  });

  const createService = async () => {
    const prisma = makePrisma();
    const idempotency = makeIdempotency();
    const audit = makeAudit();

    const moduleRef = await Test.createTestingModule({
      providers: [
        AccessControlService,
        { provide: PrismaService, useValue: prisma },
        { provide: AccessProviderRegistry, useValue: registry },
        { provide: IdempotencyService, useValue: idempotency },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    return {
      service: moduleRef.get(AccessControlService),
      prisma,
      idempotency,
      audit,
      close: () => moduleRef.close(),
    };
  };

  const hasGrant = (value: unknown): value is { grant: { status: AccessGrantStatus } } =>
    typeof value === "object" && value !== null && "grant" in value;

  it("uses idempotent grant responses when available", async () => {
    const { service, idempotency, close } = await createService();

    try {
      idempotency.start.mockResolvedValueOnce({ status: IdempotencyStatus.pending });

      await service.grantAccess(
        "res-1",
        {
          provider: AccessProviderType.kisi,
          credentialValue: "1234",
        },
        "camp-1",
      );
      expect(adapter.provisionAccess).toHaveBeenCalledTimes(1);

      idempotency.start.mockResolvedValueOnce({
        status: IdempotencyStatus.succeeded,
        responseJson: { grant: { id: "grant-1", status: AccessGrantStatus.active } },
      });

      const result = await service.grantAccess(
        "res-1",
        {
          provider: AccessProviderType.kisi,
          credentialValue: "1234",
        },
        "camp-1",
      );
      if (!hasGrant(result)) {
        throw new Error("Expected grant response to include grant payload");
      }
      expect(result.grant.status).toBe(AccessGrantStatus.active);
      expect(adapter.provisionAccess).toHaveBeenCalledTimes(1);
    } finally {
      await close();
    }
  });

  it("verifies webhook signatures with adapter", async () => {
    const { service, close } = await createService();

    try {
      const ok = await service.verifyWebhook(AccessProviderType.kisi, "sig", '{"hello":"world"}');
      expect(ok).toBe(true);
      expect(adapter.verifyWebhookSignature).toHaveBeenCalled();
    } finally {
      await close();
    }
  });

  it("blocks active grants on cancel/expiry", async () => {
    const { service, prisma, close } = await createService();

    try {
      await service.blockAccessForReservation("res-1", "cancelled");
      expect(prisma.accessGrant.updateMany).toHaveBeenCalledWith({
        where: {
          reservationId: "res-1",
          status: { in: [AccessGrantStatus.active, AccessGrantStatus.pending] },
        },
        data: expect.objectContaining({ status: AccessGrantStatus.blocked }),
      });
    } finally {
      await close();
    }
  });
});
