import { createHmac } from "crypto";
import { Test, type TestingModule } from "@nestjs/testing";
import { PosIntegrationStatus, PosProviderCapability } from "@prisma/client";
import { PosProviderService } from "../pos/pos-provider.service";
import { PosProviderRegistry } from "../pos/pos-provider.registry";
import {
  CloverAdapter,
  SquareAdapter,
  ToastAdapter,
  LightspeedAdapter,
  ShopifyPosAdapter,
  VendAdapter,
} from "../pos/pos-provider.adapters";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { IdempotencyService } from "../payments/idempotency.service";

describe("PosProviderService", () => {
  let moduleRef: TestingModule;
  let service: PosProviderService;

  const prisma = {
    posProviderIntegration: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    posProviderSync: {
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const audit = { record: jest.fn() };
  const idempotency = {
    start: jest.fn().mockResolvedValue(null),
    complete: jest.fn().mockResolvedValue(null),
  };

  const clover = new CloverAdapter();
  const square = new SquareAdapter();
  const toast = new ToastAdapter();
  const lightspeed = new LightspeedAdapter();
  const shopify = new ShopifyPosAdapter();
  const vend = new VendAdapter();
  const registry = new PosProviderRegistry(clover, square, toast, lightspeed, shopify, vend);

  beforeEach(async () => {
    jest.clearAllMocks();
    moduleRef = await Test.createTestingModule({
      providers: [
        PosProviderService,
        { provide: PrismaService, useValue: prisma },
        { provide: PosProviderRegistry, useValue: registry },
        { provide: AuditService, useValue: audit },
        { provide: IdempotencyService, useValue: idempotency },
        { provide: CloverAdapter, useValue: clover },
        { provide: SquareAdapter, useValue: square },
        { provide: ToastAdapter, useValue: toast },
        { provide: LightspeedAdapter, useValue: lightspeed },
        { provide: ShopifyPosAdapter, useValue: shopify },
        { provide: VendAdapter, useValue: vend },
      ],
    }).compile();

    service = moduleRef.get(PosProviderService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it("validates provider credentials via adapter", async () => {
    prisma.posProviderIntegration.updateMany.mockResolvedValue({ count: 1 });
    const result = await service.validateCredentials("camp-1", "clover", {
      credentials: { apiKey: "abc" },
    });
    expect(result.ok).toBe(true);
    expect(prisma.posProviderIntegration.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { campgroundId: "camp-1", provider: "clover" } }),
    );
  });

  it("routes payments through an enabled provider when capability present", async () => {
    prisma.posProviderIntegration.findFirst.mockResolvedValue({
      id: "int-1",
      campgroundId: "camp-1",
      provider: "clover",
      status: PosIntegrationStatus.enabled,
      capabilities: [PosProviderCapability.payments],
      credentials: {},
    });

    const spy = jest.spyOn(clover, "processPayment");
    const result = await service.routePayment("camp-1", "terminal-1", {
      amountCents: 100,
      currency: "USD",
      idempotencyKey: "idem-1",
      cartId: "cart-1",
    });

    expect(spy).toHaveBeenCalled();
    expect(result?.provider).toBe("clover");
    expect(result?.processorIds).toBeDefined();
  });

  it("verifies webhook signatures and returns stubbed handler result", async () => {
    prisma.posProviderIntegration.findUnique.mockResolvedValue({
      id: "int-1",
      campgroundId: "camp-1",
      provider: "clover",
      capabilities: [PosProviderCapability.payments],
      credentials: { webhookSecret: "whsec" },
      webhookSecret: "whsec",
      status: PosIntegrationStatus.enabled,
    });
    const raw = JSON.stringify({ id: "evt-1" });
    const signature = createHmac("sha256", "whsec").update(raw).digest("hex");
    const resp = await service.handleWebhook(
      "clover",
      "camp-1",
      { id: "evt-1" },
      { "x-pos-signature": signature },
      raw,
    );
    expect(resp.acknowledged).toBe(true);
  });
});
