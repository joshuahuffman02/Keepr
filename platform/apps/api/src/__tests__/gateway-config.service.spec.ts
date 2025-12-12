import { BadRequestException } from "@nestjs/common";
import { GatewayConfigService } from "../payments/gateway-config.service";

const buildPrisma = () => {
  const configs: any[] = [];
  const presets: any[] = [
    { id: "preset_stripe_test", gateway: "stripe", mode: "test", percentBasisPoints: 0, flatFeeCents: 0, label: "Stripe test" },
    { id: "preset_stripe_prod", gateway: "stripe", mode: "prod", percentBasisPoints: 290, flatFeeCents: 30, label: "Stripe prod" }
  ];

  return {
    gatewayFeePreset: {
      findUnique: jest.fn(async ({ where }: any) => presets.find((p) => p.id === where.id) ?? null),
      findFirst: jest.fn(async ({ where }: any) => presets.find((p) => p.gateway === where.gateway && p.mode === where.mode) ?? null)
    },
    campgroundPaymentGatewayConfig: {
      findUnique: jest.fn(async ({ where }: any) => configs.find((c) => c.campgroundId === where.campgroundId) ?? null),
      create: jest.fn(async ({ data, include }: any) => {
        const preset = presets.find((p) => p.id === data.feePresetId) ?? null;
        const rec = { id: `cfg_${configs.length}`, ...data, feePreset: preset };
        configs.push(rec);
        return include?.feePreset ? rec : { ...rec, feePreset: undefined };
      }),
      upsert: jest.fn(async ({ where, create, update, include }: any) => {
        let rec = configs.find((c) => c.campgroundId === where.campgroundId);
        if (!rec) {
          const preset = presets.find((p) => p.id === create.feePresetId) ?? null;
          rec = { id: `cfg_${configs.length}`, ...create, feePreset: preset };
          configs.push(rec);
        } else {
          Object.assign(rec, update);
          rec.feePreset = presets.find((p) => p.id === rec.feePresetId) ?? rec.feePreset;
        }
        return include?.feePreset ? rec : { ...rec, feePreset: undefined };
      })
    }
  };
};

describe("GatewayConfigService", () => {
  it("creates a default config when none exists", async () => {
    const prisma = buildPrisma();
    const audit = { record: jest.fn() };
    const service = new GatewayConfigService(prisma as any, audit as any);

    const cfg = await service.getConfig("cg-1");
    expect(cfg?.gateway).toBe("stripe");
    expect(cfg?.mode).toBe("test");
    expect(cfg?.feePresetId).toBe("preset_stripe_test");
  });

  it("requires credentials before switching to production", async () => {
    const prisma = buildPrisma();
    const audit = { record: jest.fn() };
    const service = new GatewayConfigService(prisma as any, audit as any);

    await expect(
      service.upsertConfig("cg-2", {
        gateway: "stripe",
        mode: "prod",
        feeMode: "absorb"
      } as any)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("is idempotent when no changes are provided", async () => {
    const prisma = buildPrisma();
    const audit = { record: jest.fn() };
    const service = new GatewayConfigService(prisma as any, audit as any);

    await service.upsertConfig("cg-3", {
      gateway: "stripe",
      mode: "test",
      feeMode: "absorb",
      secretKeySecretId: "sec_1"
    } as any);

    const beforeCalls = (prisma.campgroundPaymentGatewayConfig.upsert as jest.Mock).mock.calls.length;
    const cfg = await service.upsertConfig("cg-3", {
      gateway: "stripe",
      mode: "test",
      feeMode: "absorb"
    } as any);
    const afterCalls = (prisma.campgroundPaymentGatewayConfig.upsert as jest.Mock).mock.calls.length;

    expect(cfg?.campgroundId).toBe("cg-3");
    expect(afterCalls).toBe(beforeCalls); // no additional upsert when unchanged
  });
});
