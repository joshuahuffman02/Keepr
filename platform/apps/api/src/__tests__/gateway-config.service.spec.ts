import { BadRequestException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { GatewayConfigService } from "../payments/gateway-config.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

type FeePreset = {
  id: string;
  gateway: string;
  mode: string;
  percentBasisPoints: number;
  flatFeeCents: number;
  label: string;
};

type ConfigRecord = {
  id: string;
  campgroundId: string;
  feePresetId?: string;
  GatewayFeePreset?: FeePreset | null;
  [key: string]: unknown;
};

type GatewayFeePresetFindUniqueArgs = { where: { id: string } };

type GatewayFeePresetFindFirstArgs = { where: { gateway: string; mode: string } };

type GatewayConfigCreateArgs = { data: ConfigRecord; include?: { GatewayFeePreset?: boolean } };

type GatewayConfigUpsertArgs = {
  where: { campgroundId: string };
  create: ConfigRecord;
  update: Partial<ConfigRecord>;
  include?: { GatewayFeePreset?: boolean };
};

const buildPrisma = () => {
  const configs: ConfigRecord[] = [];
  const presets: FeePreset[] = [
    {
      id: "preset_stripe_test",
      gateway: "stripe",
      mode: "test",
      percentBasisPoints: 0,
      flatFeeCents: 0,
      label: "Stripe test",
    },
    {
      id: "preset_stripe_prod",
      gateway: "stripe",
      mode: "prod",
      percentBasisPoints: 290,
      flatFeeCents: 30,
      label: "Stripe prod",
    },
  ];

  return {
    gatewayFeePreset: {
      findUnique: jest.fn(
        async ({ where }: GatewayFeePresetFindUniqueArgs) =>
          presets.find((p) => p.id === where.id) ?? null,
      ),
      findFirst: jest.fn(
        async ({ where }: GatewayFeePresetFindFirstArgs) =>
          presets.find((p) => p.gateway === where.gateway && p.mode === where.mode) ?? null,
      ),
    },
    campgroundPaymentGatewayConfig: {
      findUnique: jest.fn(
        async ({ where }: { where: { campgroundId: string } }) =>
          configs.find((c) => c.campgroundId === where.campgroundId) ?? null,
      ),
      create: jest.fn(async ({ data, include }: GatewayConfigCreateArgs) => {
        const preset = presets.find((p) => p.id === data.feePresetId) ?? null;
        const { id: _ignored, ...rest } = data;
        const rec: ConfigRecord = {
          id: `cfg_${configs.length}`,
          ...rest,
          GatewayFeePreset: preset,
        };
        configs.push(rec);
        return include?.GatewayFeePreset ? rec : { ...rec, GatewayFeePreset: undefined };
      }),
      upsert: jest.fn(async ({ where, create, update, include }: GatewayConfigUpsertArgs) => {
        let rec = configs.find((c) => c.campgroundId === where.campgroundId);
        if (!rec) {
          const preset = presets.find((p) => p.id === create.feePresetId) ?? null;
          const { id: _ignored, ...rest } = create;
          rec = { id: `cfg_${configs.length}`, ...rest, GatewayFeePreset: preset };
          configs.push(rec);
        } else {
          Object.assign(rec, update);
          rec.GatewayFeePreset =
            presets.find((p) => p.id === rec?.feePresetId) ?? rec.GatewayFeePreset;
        }
        return include?.GatewayFeePreset ? rec : { ...rec, GatewayFeePreset: undefined };
      }),
    },
  };
};

const createService = async (prisma: ReturnType<typeof buildPrisma>) => {
  const audit = { record: jest.fn() };
  const moduleRef = await Test.createTestingModule({
    providers: [
      GatewayConfigService,
      { provide: PrismaService, useValue: prisma },
      { provide: AuditService, useValue: audit },
    ],
  }).compile();

  return { service: moduleRef.get(GatewayConfigService), prisma, close: () => moduleRef.close() };
};

describe("GatewayConfigService", () => {
  it("creates a default config when none exists", async () => {
    const prisma = buildPrisma();
    const { service, close } = await createService(prisma);
    try {
      const cfg = await service.getConfig("cg-1");
      expect(cfg?.gateway).toBe("stripe");
      expect(cfg?.mode).toBe("test");
      expect(cfg?.feePresetId).toBe("preset_stripe_test");
    } finally {
      await close();
    }
  });

  it("requires credentials before switching to production", async () => {
    const prisma = buildPrisma();
    const { service, close } = await createService(prisma);
    try {
      await expect(
        service.upsertConfig("cg-2", {
          gateway: "stripe",
          mode: "prod",
          feeMode: "absorb",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    } finally {
      await close();
    }
  });

  it("is idempotent when no changes are provided", async () => {
    const prisma = buildPrisma();
    const { service, close } = await createService(prisma);

    try {
      await service.upsertConfig("cg-3", {
        gateway: "stripe",
        mode: "test",
        feeMode: "absorb",
        secretKeySecretId: "sec_1",
      });

      const beforeCalls = prisma.campgroundPaymentGatewayConfig.upsert.mock.calls.length;
      const cfg = await service.upsertConfig("cg-3", {
        gateway: "stripe",
        mode: "test",
        feeMode: "absorb",
      });
      const afterCalls = prisma.campgroundPaymentGatewayConfig.upsert.mock.calls.length;

      expect(cfg?.campgroundId).toBe("cg-3");
      expect(afterCalls).toBe(beforeCalls); // no additional upsert when unchanged
    } finally {
      await close();
    }
  });
});
