import { Test, type TestingModule } from "@nestjs/testing";
import { IntegrationsService } from "../src/integrations/integrations.service";
import { PrismaService } from "../src/prisma/prisma.service";

describe("IntegrationsService sandbox QBO", () => {
  let moduleRef: TestingModule;
  let service: IntegrationsService;

  const prisma = {
    integrationConnection: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    integrationSyncLog: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    Object.defineProperty(globalThis, "fetch", {
      value: jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            QueryResponse: {
              Account: [
                { Id: "1", Name: "Cash", AccountType: "Asset" },
                { Id: "2", Name: "Payable", AccountType: "Liability" },
              ],
            },
          }),
      }),
      configurable: true,
    });

    process.env.QBO_SANDBOX_TOKEN = "token";
    process.env.QBO_SANDBOX_REALMID = "realm";

    moduleRef = await Test.createTestingModule({
      providers: [IntegrationsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(IntegrationsService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it("runs sandbox pull and logs success", async () => {
    prisma.integrationConnection.findUnique.mockResolvedValue({
      id: "conn1",
      provider: "qbo",
      type: "accounting",
      settings: { realmId: "realm" },
    });
    prisma.integrationConnection.update.mockResolvedValue({});
    prisma.integrationSyncLog.create.mockResolvedValue({});

    const result = await service.triggerSync("conn1", { note: "test" });

    expect(result?.sandbox).toBe(true);
    expect(prisma.integrationSyncLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "queued",
        }),
      }),
    );
    expect(prisma.integrationConnection.update).toHaveBeenCalled();
  });
});
