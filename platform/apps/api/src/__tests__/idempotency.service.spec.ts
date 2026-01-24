import { ConflictException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { IdempotencyService } from "../payments/idempotency.service";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";

type FakeStatus = "pending" | "inflight" | "succeeded" | "failed";

type RecordShape = {
  id: string;
  scope: string;
  endpoint: string;
  idempotencyKey: string;
  requestHash: string;
  checksum?: string | null;
  requestBody?: unknown;
  responseJson?: unknown;
  status: FakeStatus;
  sequence?: string | null;
  expiresAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  lastSeenAt?: Date;
  metadata?: unknown;
};

type LegacyRecord = { key: string; [key: string]: unknown };

type IdempotencyRecordWhere = {
  id?: string;
  scope_idempotencyKey?: { scope: string; idempotencyKey: string };
  idempotencyKey?: string;
  scope?: string;
  endpoint?: string;
  sequence?: string | number | null;
};

type IdempotencyRecordCreateArgs = { data: RecordShape };

type IdempotencyRecordUpdateArgs = {
  where: { id?: string; scope_idempotencyKey?: { scope: string; idempotencyKey: string } };
  data: Partial<RecordShape>;
};

type IdempotencyRecordUpdateManyArgs = {
  where?: { idempotencyKey?: string };
  data: Partial<RecordShape>;
};

type IdempotencyRecordFindFirstArgs = {
  where?: {
    scope?: string;
    endpoint?: string;
    sequence?: string | number | null;
    idempotencyKey?: string;
  };
};

type IdempotencyKeyWhere = { key: string };

type IdempotencyKeyUpdateArgs = { where: IdempotencyKeyWhere; data: Record<string, unknown> };

type IdempotencyKeyCreateArgs = { data: LegacyRecord };

const buildPrisma = () => {
  const records: RecordShape[] = [];
  const legacy: LegacyRecord[] = [];

  return {
    idempotencyRecord: {
      findUnique: jest.fn(async ({ where }: { where: IdempotencyRecordWhere }) => {
        const match = where?.scope_idempotencyKey;
        if (!match) return null;
        return (
          records.find(
            (r) => r.scope === match.scope && r.idempotencyKey === match.idempotencyKey,
          ) ?? null
        );
      }),
      create: jest.fn(async ({ data }: IdempotencyRecordCreateArgs) => {
        const rec: RecordShape = {
          ...data,
          id: data.id ?? `rec_${records.length}`,
          createdAt: data.createdAt ?? new Date(),
          updatedAt: data.updatedAt ?? new Date(),
        };
        records.push(rec);
        return rec;
      }),
      update: jest.fn(async ({ where, data }: IdempotencyRecordUpdateArgs) => {
        let rec: RecordShape | undefined;
        if (where?.id) {
          rec = records.find((r) => r.id === where.id);
        }
        if (where?.scope_idempotencyKey) {
          rec = records.find(
            (r) =>
              r.scope === where.scope_idempotencyKey?.scope &&
              r.idempotencyKey === where.scope_idempotencyKey?.idempotencyKey,
          );
        }
        if (!rec) throw new Error("not found");
        Object.assign(rec, data, { updatedAt: new Date() });
        return rec;
      }),
      updateMany: jest.fn(async ({ where, data }: IdempotencyRecordUpdateManyArgs) => {
        const matched = records.filter((r) =>
          where?.idempotencyKey ? r.idempotencyKey === where.idempotencyKey : true,
        );
        matched.forEach((r) => Object.assign(r, data, { updatedAt: new Date() }));
        return { count: matched.length };
      }),
      findFirst: jest.fn(async ({ where }: IdempotencyRecordFindFirstArgs) => {
        if (where?.scope && where?.endpoint && where?.sequence !== undefined) {
          return (
            records.find(
              (r) =>
                r.scope === where.scope &&
                r.endpoint === where.endpoint &&
                r.sequence === String(where.sequence),
            ) ?? null
          );
        }
        if (where?.idempotencyKey) {
          return records.find((r) => r.idempotencyKey === where.idempotencyKey) ?? null;
        }
        return null;
      }),
    },
    idempotencyKey: {
      update: jest.fn(async ({ where, data }: IdempotencyKeyUpdateArgs) => {
        const rec = legacy.find((entry) => entry.key === where.key);
        if (!rec) throw new Error("not found");
        Object.assign(rec, data);
        return rec;
      }),
      findUnique: jest.fn(
        async ({ where }: { where: IdempotencyKeyWhere }) =>
          legacy.find((entry) => entry.key === where.key) ?? null,
      ),
      create: jest.fn(async ({ data }: IdempotencyKeyCreateArgs) => {
        const rec: LegacyRecord = { ...data };
        legacy.push(rec);
        return rec;
      }),
    },
  };
};

const buildRedis = () => ({
  isEnabled: false,
  getClient: () => null,
});

const createService = async (prisma: ReturnType<typeof buildPrisma>) => {
  const moduleRef = await Test.createTestingModule({
    providers: [
      IdempotencyService,
      { provide: PrismaService, useValue: prisma },
      { provide: RedisService, useValue: buildRedis() },
    ],
  }).compile();

  return { service: moduleRef.get(IdempotencyService), close: () => moduleRef.close() };
};

describe("IdempotencyService", () => {
  beforeEach(() => {
    delete process.env.IDEMPOTENCY_RATE_LIMIT;
    delete process.env.IDEMPOTENCY_RATE_WINDOW_SEC;
  });

  it("returns stored response on duplicate payload", async () => {
    const prisma = buildPrisma();
    const { service, close } = await createService(prisma);
    try {
      await service.start("key-1", { foo: "bar" }, "camp-1", { endpoint: "pos/checkout" });
      await service.complete("key-1", { ok: true });

      const duplicate = await service.start("key-1", { foo: "bar" }, "camp-1", {
        endpoint: "pos/checkout",
      });
      expect(duplicate?.status).toBe("succeeded");
      expect(duplicate?.responseJson).toEqual({ ok: true });
    } finally {
      await close();
    }
  });

  it("throws conflict when payload hash differs", async () => {
    const prisma = buildPrisma();
    const { service, close } = await createService(prisma);
    try {
      await service.start("key-2", { foo: "bar" }, "camp-1", { endpoint: "pos/checkout" });
      await expect(
        service.start("key-2", { foo: "baz" }, "camp-1", { endpoint: "pos/checkout" }),
      ).rejects.toBeInstanceOf(ConflictException);
    } finally {
      await close();
    }
  });

  it("returns response via sequence dedupe", async () => {
    const prisma = buildPrisma();
    const { service, close } = await createService(prisma);
    try {
      await service.start("key-seq", { foo: "bar" }, "camp-1", {
        endpoint: "pos/offline",
        sequence: "123",
      });
      await service.complete("key-seq", { accepted: true });

      const found = await service.findBySequence("camp-1", "pos/offline", "123");
      expect(found?.responseJson).toEqual({ accepted: true });
    } finally {
      await close();
    }
  });

  it("enforces per-scope rate limits", async () => {
    process.env.IDEMPOTENCY_RATE_LIMIT = "1";
    const prisma = buildPrisma();
    const { service, close } = await createService(prisma);
    try {
      await service.start("rate-1", {}, "camp-1", { endpoint: "pos/apply" });
      await expect(
        service.start("rate-2", {}, "camp-1", { endpoint: "pos/apply" }),
      ).rejects.toThrow("Idempotency rate limit exceeded");
    } finally {
      await close();
    }
  });
});
