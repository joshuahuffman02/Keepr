import { ConflictException, Injectable, HttpException, HttpStatus } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { IdempotencyStatus, Prisma, type IdempotencyRecord } from "@prisma/client";
import * as crypto from "crypto";
import { RedisService } from "../redis/redis.service";
import type { Request } from "express";

export type RateAction = "lookup" | "apply" | "report";

type IdempotencyOptions = {
  tenantId?: string | null;
  campgroundId?: string | null;
  endpoint?: string;
  checksum?: string;
  sequence?: string | number | null;
  ttlSeconds?: number;
  metadata?: Record<string, unknown> | null;
  rateAction?: RateAction;
  requestBody?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toNullableJsonInput = (
  value: unknown,
): Prisma.InputJsonValue | Prisma.NullTypes.DbNull | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.DbNull;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return undefined;
  }
};

@Injectable()
export class IdempotencyService {
  private readonly defaultTtlSeconds = Number(process.env.IDEMPOTENCY_TTL_SECONDS ?? 72 * 60 * 60);
  private readonly rateLimitDefault = Number(process.env.IDEMPOTENCY_RATE_LIMIT ?? 60);
  private readonly rateWindowSeconds = Number(process.env.IDEMPOTENCY_RATE_WINDOW_SEC ?? 60);
  private readonly scopeCache = new Map<string, string>();
  private readonly memoryCounters = new Map<string, { count: number; expiresAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private stableStringify(value: unknown): string {
    if (value === null || value === undefined) return "null";
    if (typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) {
      return `[${value.map((v) => this.stableStringify(v)).join(",")}]`;
    }
    if (!isRecord(value)) {
      return JSON.stringify(String(value));
    }
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${this.stableStringify(value[k])}`).join(",")}}`;
  }

  private hashRequest(body: unknown) {
    const normalized = typeof body === "string" ? body : this.stableStringify(body ?? {});
    return crypto.createHash("sha256").update(normalized).digest("hex");
  }

  private scopeKey(tenantId?: string | null, campgroundId?: string | null) {
    return tenantId ?? campgroundId ?? "global";
  }

  private computeExpiry(ttlSeconds?: number) {
    const ttl = ttlSeconds ?? this.defaultTtlSeconds;
    return ttl > 0 ? new Date(Date.now() + ttl * 1000) : null;
  }

  private isExpired(expiresAt?: Date | null) {
    return Boolean(expiresAt && expiresAt.getTime() < Date.now());
  }

  private normalizeSequence(sequence?: string | number | null) {
    if (sequence === undefined || sequence === null) return null;
    return String(sequence);
  }

  private cacheScope(key: string, scope: string) {
    this.scopeCache.set(key, scope);
    if (this.scopeCache.size > 5000) {
      // trim oldest entry
      const firstKey = this.scopeCache.keys().next().value;
      if (firstKey) this.scopeCache.delete(firstKey);
    }
  }

  private rateLimitError() {
    return new HttpException("Idempotency rate limit exceeded", HttpStatus.TOO_MANY_REQUESTS);
  }

  private async touchRecord(id: string) {
    await this.prisma.idempotencyRecord
      .update({
        where: { id },
        data: { lastSeenAt: new Date() },
      })
      .catch(() => null);
  }

  private ensureHashConsistency(
    existing: IdempotencyRecord,
    requestHash: string,
    checksum?: string,
  ) {
    if (existing.requestHash && existing.requestHash !== requestHash) {
      throw new ConflictException("Idempotency key reused with different payload");
    }
    if (checksum && existing.checksum && existing.checksum !== checksum) {
      throw new ConflictException("Idempotency checksum mismatch");
    }
  }

  private async enforceRateLimit(scope: string, action: RateAction) {
    const windowSeconds = this.rateWindowSeconds > 0 ? this.rateWindowSeconds : 60;
    const max = this.rateLimitDefault > 0 ? this.rateLimitDefault : 60;
    const windowBucket = Math.floor(Date.now() / (windowSeconds * 1000));
    const key = `idemp:${scope}:${action}:${windowBucket}`;

    if (this.redis?.isEnabled) {
      const client = this.redis.getClient();
      if (client) {
        const count = await client.incr(key);
        if (count === 1) {
          await client.expire(key, windowSeconds);
        }
        if (count > max) {
          throw this.rateLimitError();
        }
        return;
      }
    }

    const now = Date.now();
    const cached = this.memoryCounters.get(key);
    if (!cached || cached.expiresAt < now) {
      this.memoryCounters.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
      return;
    }
    cached.count += 1;
    if (cached.count > max) {
      throw this.rateLimitError();
    }
  }

  /**
   * Start or reuse an idempotency record. Applies per-scope rate limiting.
   */
  async start(
    key: string,
    body: unknown,
    campgroundId?: string | null,
    options?: IdempotencyOptions,
  ) {
    const opts = options ?? {};
    const scope = this.scopeKey(opts.tenantId ?? null, opts.campgroundId ?? campgroundId ?? null);
    await this.enforceRateLimit(scope, opts.rateAction ?? "lookup");

    const requestHash = this.hashRequest(body ?? opts.requestBody ?? {});
    const checksum = opts.checksum ?? requestHash;
    const normalizedSequence = this.normalizeSequence(opts.sequence);
    const endpoint = opts.endpoint ?? "unknown";

    if (normalizedSequence) {
      const seqExisting = await this.prisma.idempotencyRecord
        .findFirst({
          where: { scope, endpoint, sequence: normalizedSequence },
        })
        .catch(() => null);

      if (seqExisting && !this.isExpired(seqExisting.expiresAt)) {
        this.ensureHashConsistency(seqExisting, requestHash, opts.checksum);
        this.cacheScope(key, seqExisting.scope);
        if (seqExisting.status === IdempotencyStatus.succeeded && seqExisting.responseJson) {
          return seqExisting;
        }
        if (seqExisting.status === IdempotencyStatus.inflight) {
          throw new ConflictException("Request already in progress");
        }
      }
    }

    let existing = await this.prisma.idempotencyRecord
      .findUnique({
        where: { scope_idempotencyKey: { scope, idempotencyKey: key } },
      })
      .catch(() => null);

    if (existing) {
      this.ensureHashConsistency(existing, requestHash, opts.checksum);
      if (this.isExpired(existing.expiresAt)) {
        existing = await this.prisma.idempotencyRecord.update({
          where: { id: existing.id },
          data: {
            requestHash,
            checksum,
            requestBody: toNullableJsonInput(opts.requestBody ?? body ?? existing.requestBody),
            status: IdempotencyStatus.inflight,
            expiresAt: this.computeExpiry(opts.ttlSeconds),
            lastSeenAt: new Date(),
            updatedAt: new Date(),
          },
        });
      } else {
        await this.touchRecord(existing.id);
      }
      this.cacheScope(key, scope);
      return existing;
    }

    const created = await this.prisma.idempotencyRecord.create({
      data: {
        id: crypto.randomUUID(),
        updatedAt: new Date(),
        scope,
        tenantId: opts.tenantId ?? undefined,
        campgroundId: opts.campgroundId ?? campgroundId ?? undefined,
        endpoint,
        idempotencyKey: key,
        requestHash,
        checksum,
        requestBody: toNullableJsonInput(opts.requestBody ?? body ?? {}),
        responseJson: Prisma.DbNull,
        status: IdempotencyStatus.inflight,
        sequence: normalizedSequence,
        expiresAt: this.computeExpiry(opts.ttlSeconds),
        lastSeenAt: new Date(),
        metadata: toNullableJsonInput(opts.metadata ?? null),
      },
    });

    this.cacheScope(key, scope);
    return created;
  }

  /**
   * Complete an idempotent call by persisting the response snapshot.
   */
  async complete(key: string, response: unknown) {
    const updated = await this.updateRecord(key, {
      status: IdempotencyStatus.succeeded,
      responseJson: toNullableJsonInput(response),
      lastSeenAt: new Date(),
      updatedAt: new Date(),
    });
    if (updated) return updated;

    // Legacy fallback
    return this.prisma.idempotencyKey.update({
      where: { key },
      data: {
        status: IdempotencyStatus.succeeded,
        responseJson: toNullableJsonInput(response),
        lastSeenAt: new Date(),
      },
    });
  }

  /**
   * Mark an idempotent call as failed.
   */
  async fail(key: string) {
    const updated = await this.updateRecord(key, {
      status: IdempotencyStatus.failed,
      lastSeenAt: new Date(),
      updatedAt: new Date(),
    });
    if (updated) return updated;

    return this.prisma.idempotencyKey.update({
      where: { key },
      data: {
        status: IdempotencyStatus.failed,
        lastSeenAt: new Date(),
      },
    });
  }

  /**
   * Locate an existing record by sequence for replay dedupe.
   */
  async findBySequence(scope: string, endpoint: string, sequence?: string | number | null) {
    if (sequence === undefined || sequence === null) return null;
    await this.enforceRateLimit(scope, "lookup");
    return this.prisma.idempotencyRecord.findFirst({
      where: { scope, endpoint, sequence: String(sequence) },
    });
  }

  /**
   * Apply rate limiting without creating an idempotency record.
   */
  async throttleScope(
    campgroundId?: string | null,
    tenantId?: string | null,
    action: RateAction = "lookup",
  ) {
    const scope = this.scopeKey(tenantId ?? null, campgroundId ?? null);
    await this.enforceRateLimit(scope, action);
  }

  private async updateRecord(key: string, data: Prisma.IdempotencyRecordUpdateInput) {
    const scope = this.scopeCache.get(key);
    if (scope) {
      const result = await this.prisma.idempotencyRecord
        .update({
          where: { scope_idempotencyKey: { scope, idempotencyKey: key } },
          data,
        })
        .catch(() => null);
      if (result) return result;
    }

    const updated = await this.prisma.idempotencyRecord.updateMany({
      where: { idempotencyKey: key },
      data,
    });

    if (updated.count > 0) {
      return this.prisma.idempotencyRecord.findFirst({ where: { idempotencyKey: key } });
    }

    return null;
  }
}
