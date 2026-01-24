import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";

type UpsertParams = {
  subscription: unknown;
  userId?: string;
  campgroundId?: string;
  userAgent?: string | null;
};

type PushSubscriptionPayload = {
  endpoint: string;
  expirationTime?: string | number | null;
  keys?: Record<string, string>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const toStringRecord = (value: unknown): Record<string, string> | null => {
  if (!isRecord(value)) return null;
  const record: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") {
      record[key] = entry;
    }
  }
  return record;
};

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
export class PushSubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertSubscription({ subscription, userId, campgroundId, userAgent }: UpsertParams) {
    const record = isRecord(subscription) ? subscription : null;
    const endpoint = record ? getString(record.endpoint) : undefined;
    if (!endpoint) {
      throw new BadRequestException("subscription.endpoint is required");
    }

    const expirationValue = record?.expirationTime;
    const normalizedExpiration =
      typeof expirationValue === "string" || typeof expirationValue === "number"
        ? expirationValue
        : null;
    const expirationTime = normalizedExpiration !== null ? new Date(normalizedExpiration) : null;
    const keys = toStringRecord(record?.keys) ?? null;
    const payload: PushSubscriptionPayload = {
      endpoint,
      expirationTime: normalizedExpiration,
      keys: keys ?? undefined,
    };

    return this.prisma.pushSubscription.upsert({
      where: { endpoint },
      update: {
        subscription: toNullableJsonInput(payload),
        keys: toNullableJsonInput(keys),
        expirationTime: expirationTime ?? undefined,
        userId: userId ?? null,
        campgroundId: campgroundId ?? null,
        userAgent: userAgent ?? null,
        updatedAt: new Date(),
      },
      create: {
        id: randomUUID(),
        endpoint,
        subscription: toNullableJsonInput(payload),
        keys: toNullableJsonInput(keys),
        expirationTime: expirationTime ?? undefined,
        userId: userId ?? null,
        campgroundId: campgroundId ?? null,
        userAgent: userAgent ?? null,
        updatedAt: new Date(),
      },
    });
  }
}
