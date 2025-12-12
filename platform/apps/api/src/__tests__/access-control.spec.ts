import { AccessGrantStatus, AccessProviderType, IdempotencyStatus } from "@prisma/client";
import { AccessControlService } from "../access-control/access-control.service";
import { IdempotencyService } from "../payments/idempotency.service";

describe("AccessControlService", () => {
  const adapter = {
    provider: AccessProviderType.kisi,
    provisionAccess: jest.fn().mockResolvedValue({ status: AccessGrantStatus.active, providerAccessId: "external-1" }),
    revokeAccess: jest.fn().mockResolvedValue({ status: AccessGrantStatus.revoked }),
    verifyWebhookSignature: jest.fn().mockReturnValue(true)
  };

  const registry = {
    getAdapter: jest.fn(() => adapter)
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
        vehiclePlate: "ABC123"
      })
    },
    accessGrant: {
      upsert: jest.fn().mockResolvedValue({
        id: "grant-1",
        reservationId: "res-1",
        provider: AccessProviderType.kisi,
        status: AccessGrantStatus.pending
      }),
      update: jest.fn().mockImplementation((_args: any) => ({
        id: "grant-1",
        status: AccessGrantStatus.active,
        providerAccessId: "external-1"
      })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findFirst: jest.fn().mockResolvedValue({
        id: "grant-1",
        reservationId: "res-1",
        provider: AccessProviderType.kisi,
        providerAccessId: "external-1"
      }),
      findMany: jest.fn().mockResolvedValue([])
    },
    accessCredential: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: "cred-1" })
    },
    vehicle: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: "veh-1", plate: "ABC123" })
    },
    accessIntegration: {
      findFirst: jest.fn().mockResolvedValue({
        id: "int-1",
        campgroundId: "camp-1",
        provider: AccessProviderType.kisi,
        credentials: {},
        webhookSecret: "secret"
      })
    }
  });

  const makeIdempotency = () =>
    ({
      start: jest.fn(),
      complete: jest.fn(),
      fail: jest.fn()
    } as unknown as IdempotencyService);

  it("uses idempotent grant responses when available", async () => {
    const prisma = makePrisma();
    const idempotency = makeIdempotency();

    // First call performs the work
    (idempotency.start as any).mockResolvedValueOnce({ status: IdempotencyStatus.pending });
    const service = new AccessControlService(prisma as any, registry as any, idempotency);

    await service.grantAccess("res-1", {
      provider: AccessProviderType.kisi,
      credentialValue: "1234"
    } as any);
    expect(adapter.provisionAccess).toHaveBeenCalledTimes(1);

    // Second call returns cached response
    (idempotency.start as any).mockResolvedValueOnce({
      status: IdempotencyStatus.succeeded,
      responseJson: { grant: { id: "grant-1", status: AccessGrantStatus.active } }
    });

    const result = await service.grantAccess("res-1", {
      provider: AccessProviderType.kisi,
      credentialValue: "1234"
    } as any);

    expect(result.grant.status).toBe(AccessGrantStatus.active);
    expect(adapter.provisionAccess).toHaveBeenCalledTimes(1);
  });

  it("verifies webhook signatures with adapter", async () => {
    const prisma = makePrisma();
    const idempotency = makeIdempotency();
    const service = new AccessControlService(prisma as any, registry as any, idempotency);

    const ok = await service.verifyWebhook(AccessProviderType.kisi, "sig", '{"hello":"world"}');
    expect(ok).toBe(true);
    expect(adapter.verifyWebhookSignature).toHaveBeenCalled();
  });

  it("blocks active grants on cancel/expiry", async () => {
    const prisma = makePrisma();
    const idempotency = makeIdempotency();
    const service = new AccessControlService(prisma as any, registry as any, idempotency);

    await service.blockAccessForReservation("res-1", "cancelled");
    expect(prisma.accessGrant.updateMany).toHaveBeenCalledWith({
      where: { reservationId: "res-1", status: { in: [AccessGrantStatus.active, AccessGrantStatus.pending] } },
      data: expect.objectContaining({ status: AccessGrantStatus.blocked })
    });
  });
});
