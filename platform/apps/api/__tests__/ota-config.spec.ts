import { describe, it, expect, jest } from "@jest/globals";
import { Test, type TestingModule } from "@nestjs/testing";
import { OtaController } from "../src/ota/ota.controller";
import { OtaService } from "../src/ota/ota.service";
import { PrismaService } from "../src/prisma/prisma.service";

describe("OTA config stub endpoint", () => {
  let moduleRef: TestingModule;
  let controller: OtaController;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      controllers: [OtaController],
      providers: [OtaService, { provide: PrismaService, useValue: {} }],
    }).compile();

    controller = moduleRef.get(OtaController);
    Object.defineProperty(globalThis, "fetch", { value: jest.fn(), configurable: true });
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it("stores and returns OTA config without external calls", async () => {
    const saved = await controller.saveConfig("cg-test", {
      provider: "Hipcamp",
      externalAccountId: "acct_123",
      propertyId: "prop_456",
      apiKey: "key_abc",
      channelId: "chan_789",
      notes: "Stub credentials for smoke test",
    });

    expect(saved.lastSyncStatus).toBe("stubbed");
    expect(saved.pendingSyncs).toBe(0);
    expect(saved.externalAccountId).toBe("acct_123");
    expect(saved.propertyId).toBe("prop_456");
    expect(saved.lastUpdatedAt).toBeTruthy();

    const fetched = await controller.getConfig("cg-test");
    expect(fetched.externalAccountId).toBe("acct_123");
    expect(fetched.lastSyncMessage).toMatch(/Saved locally/i);

    const syncStatus = await controller.getSyncStatus("cg-test");
    expect(syncStatus.lastSyncStatus).toBe("stubbed");
    expect(syncStatus.pendingSyncs).toBe(0);

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
