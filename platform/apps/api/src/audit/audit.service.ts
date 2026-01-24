import { Injectable } from "@nestjs/common";
import { createHash, randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import type { Prisma } from "@prisma/client";

const toJsonValue = (value: unknown): Prisma.InputJsonValue | undefined => {
  if (value === undefined || value === null) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return undefined;
  }
};

type AuditLogWithUser = Prisma.AuditLogGetPayload<{
  include: { User: { select: { id: true; email: true; firstName: true; lastName: true } } };
}>;

type AuditLogWithActor = Omit<AuditLogWithUser, "User"> & {
  actor: AuditLogWithUser["User"];
};

type AuditExportResponse = {
  setHeader: (name: string, value: string) => unknown;
  send: (body: string) => unknown;
};

const toActorRow = (row: AuditLogWithUser): AuditLogWithActor => {
  const { User, ...rest } = row;
  return { ...rest, actor: User };
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    params: {
      campgroundId: string;
      action?: string;
      actorId?: string;
      start?: Date;
      end?: Date;
      limit?: number;
    },
    ip?: string | null,
    userAgent?: string | null,
  ) {
    const privacy = await this.getPrivacy(params.campgroundId);
    const rows = await this.prisma.auditLog.findMany({
      where: {
        campgroundId: params.campgroundId,
        action: params.action || undefined,
        actorId: params.actorId || undefined,
        createdAt:
          params.start || params.end
            ? {
                ...(params.start ? { gte: params.start } : {}),
                ...(params.end ? { lte: params.end } : {}),
              }
            : undefined,
      },
      include: {
        User: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: params.limit || 200,
    });

    const actorRows = rows.map(toActorRow);
    if (!privacy.redactPII) return actorRows;
    return actorRows.map((row) => this.redactRow(row));
  }

  async quickAudit(params: { campgroundId: string; limit?: number }) {
    const limit = Math.min(Math.max(params.limit ?? 5, 1), 25);
    const privacy = await this.getPrivacy(params.campgroundId);

    const [piiTagCount, piiTags, auditEventsRaw] = await Promise.all([
      this.prisma.piiFieldTag.count(),
      this.prisma.piiFieldTag.findMany({
        orderBy: [{ resource: "asc" }, { field: "asc" }],
        take: 8,
      }),
      this.prisma.auditLog.findMany({
        where: { campgroundId: params.campgroundId },
        include: {
          User: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
    ]);

    const auditEventsMapped = auditEventsRaw.map(toActorRow);
    const auditEvents = privacy.redactPII
      ? auditEventsMapped.map((row) => this.redactRow(row))
      : auditEventsMapped;

    return {
      privacyDefaults: {
        redactPII: privacy.redactPII,
        consentRequired: privacy.consentRequired,
        backupRetentionDays: privacy.backupRetentionDays,
        keyRotationDays: privacy.keyRotationDays,
      },
      piiTagCount,
      piiTagsPreview: piiTags,
      auditEvents,
    };
  }

  async exportCsv(
    params: {
      campgroundId: string;
      action?: string;
      actorId?: string;
      start?: Date;
      end?: Date;
      limit?: number;
    },
    res: AuditExportResponse,
  ) {
    const rows = await this.list(params);
    const headers = [
      "id",
      "campgroundId",
      "actorId",
      "action",
      "entity",
      "entityId",
      "createdAt",
      "ip",
      "userAgent",
      "chainHash",
      "prevHash",
      "before",
      "after",
    ];
    const csv = [headers.join(",")]
      .concat(
        rows.map((r) =>
          [
            r.id,
            r.campgroundId,
            r.actorId ?? "",
            r.action,
            r.entity,
            r.entityId,
            new Date(r.createdAt).toISOString(),
            r.ip ?? "",
            (r.userAgent ?? "").replace(/,/g, ";"),
            r.chainHash,
            r.prevHash ?? "",
            r.before ? JSON.stringify(r.before).replace(/"/g, '""') : "",
            r.after ? JSON.stringify(r.after).replace(/"/g, '""') : "",
          ].join(","),
        ),
      )
      .join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=audit.csv");
    return res.send(csv);
  }

  async exportJson(params: {
    campgroundId: string;
    action?: string;
    actorId?: string;
    start?: Date;
    end?: Date;
    limit?: number;
  }) {
    return this.list(params);
  }

  /**
   * Get audit logs for a specific entity (e.g., guest or reservation)
   */
  async listByEntity(params: {
    campgroundId: string;
    entity: string;
    entityId: string;
    limit?: number;
  }) {
    const privacy = await this.getPrivacy(params.campgroundId);
    const rows = await this.prisma.auditLog.findMany({
      where: {
        campgroundId: params.campgroundId,
        entity: params.entity,
        entityId: params.entityId,
      },
      include: {
        User: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: params.limit || 100,
    });

    const actorRows = rows.map(toActorRow);
    if (!privacy.redactPII) return actorRows;
    return actorRows.map((row) => this.redactRow(row));
  }

  async record(event: {
    campgroundId: string;
    actorId: string | null;
    action: string;
    entity: string;
    entityId: string;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    ip?: string | null;
    userAgent?: string | null;
    retentionDays?: number | null;
  }) {
    const now = new Date();
    const prev = await this.prisma.auditLog.findFirst({
      where: { campgroundId: event.campgroundId },
      orderBy: { createdAt: "desc" },
      select: { chainHash: true },
    });
    const prevHash = prev?.chainHash ?? null;
    const before = toJsonValue(event.before);
    const after = toJsonValue(event.after);
    const payload = {
      campgroundId: event.campgroundId,
      actorId: event.actorId,
      action: event.action,
      entity: event.entity,
      entityId: event.entityId,
      before: before ?? null,
      after: after ?? null,
      ip: event.ip ?? null,
      userAgent: event.userAgent ?? null,
      createdAt: now.toISOString(),
      prevHash,
    };
    const chainHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    const retentionAt = event.retentionDays
      ? new Date(now.getTime() + event.retentionDays * 24 * 60 * 60 * 1000)
      : null;

    return this.prisma.auditLog.create({
      data: {
        id: randomUUID(),
        ...payload,
        before,
        after,
        createdAt: now,
        prevHash,
        chainHash,
        retentionAt,
      },
    });
  }

  async recordExport(params: {
    campgroundId: string;
    requestedById: string;
    format: "csv" | "json";
    filters?: Record<string, unknown>;
    recordCount: number;
  }) {
    return this.prisma.auditExport.create({
      data: {
        id: randomUUID(),
        campgroundId: params.campgroundId,
        requestedById: params.requestedById,
        format: params.format,
        filters: toJsonValue(params.filters),
        recordCount: params.recordCount,
      },
    });
  }

  async listExports(campgroundId: string) {
    return this.prisma.auditExport.findMany({
      where: { campgroundId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  private async getPrivacy(campgroundId: string) {
    const existing = await this.prisma.privacySetting.findUnique({ where: { campgroundId } });
    if (existing) return existing;
    return this.prisma.privacySetting.create({
      data: {
        id: randomUUID(),
        campgroundId,
        redactPII: true,
        consentRequired: true,
        backupRetentionDays: 30,
        keyRotationDays: 90,
        updatedAt: new Date(),
      },
    });
  }

  private redactRow(row: AuditLogWithActor) {
    const mask = (val: unknown) => {
      if (typeof val !== "string") return val;
      const emailMasked = val.replace(
        /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
        "***@redacted",
      );
      const phoneMasked = emailMasked.replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "***-***-****");
      return phoneMasked;
    };
    const scrubJson = (obj: unknown) => {
      if (obj == null) return obj;
      const json = JSON.stringify(obj, (_, value) => mask(value));
      try {
        return JSON.parse(json);
      } catch {
        return obj;
      }
    };

    return {
      ...row,
      actor: row.actor
        ? {
            ...row.actor,
            email: mask(row.actor.email),
            firstName: mask(row.actor.firstName),
            lastName: mask(row.actor.lastName),
          }
        : row.actor,
      before: scrubJson(row.before),
      after: scrubJson(row.after),
      ip: row.ip ? "***.***.***.***" : row.ip,
      userAgent: row.userAgent ? "redacted" : row.userAgent,
    };
  }
}
