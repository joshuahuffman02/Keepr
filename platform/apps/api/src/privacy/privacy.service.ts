import { BadRequestException, Injectable } from "@nestjs/common";
import { ConsentMethod, PiiClassification, RedactionMode, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { randomUUID } from "crypto";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === "string";

const isJsonValue = (value: unknown): value is Prisma.InputJsonValue => {
  if (value === null) return true;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (isRecord(value)) return Object.values(value).every(isJsonValue);
  return false;
};

const toNullableJsonInput = (
  value: unknown,
): Prisma.InputJsonValue | Prisma.NullTypes.DbNull | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.DbNull;
  return isJsonValue(value) ? value : undefined;
};

const toIsoString = (value: Date | string | null | undefined): string | null => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (isString(value)) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
};

const CONSENT_METHOD_VALUES: ConsentMethod[] = [
  ConsentMethod.verbal,
  ConsentMethod.written,
  ConsentMethod.digital,
];

const PII_CLASSIFICATION_VALUES: PiiClassification[] = [
  PiiClassification.basic,
  PiiClassification.sensitive,
  PiiClassification.payment,
  PiiClassification.secret,
];

const REDACTION_MODE_VALUES: RedactionMode[] = [RedactionMode.mask, RedactionMode.remove];

const parseConsentMethod = (value: unknown): ConsentMethod | undefined => {
  if (!isString(value)) return undefined;
  return CONSENT_METHOD_VALUES.find((method) => method === value);
};

const parsePiiClassification = (value: unknown): PiiClassification | undefined => {
  if (!isString(value)) return undefined;
  return PII_CLASSIFICATION_VALUES.find((classification) => classification === value);
};

const parseRedactionMode = (value: unknown): RedactionMode | undefined => {
  if (!isString(value)) return undefined;
  return REDACTION_MODE_VALUES.find((mode) => mode === value);
};

type PrivacyExportResponse = {
  set: (name: string, value: string) => unknown;
  send: (body: string) => unknown;
};

@Injectable()
export class PrivacyService {
  constructor(private readonly prisma: PrismaService) {}

  private maskValue(val: unknown) {
    if (!isString(val)) return val;
    const emailMasked = val.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "***@redacted");
    const phoneMasked = emailMasked.replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "***-***-****");
    return phoneMasked;
  }

  private scrub(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((v) => this.scrub(v));
    if (isRecord(value)) {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        result[key] = this.scrub(val);
      }
      return result;
    }
    return this.maskValue(value);
  }

  private applyTagRedactions(
    sample: unknown,
    tags: { field: string; redactionMode?: RedactionMode | null }[],
  ): unknown {
    if (Array.isArray(sample)) return sample.map((v) => this.applyTagRedactions(v, tags));
    if (isRecord(sample)) {
      const byField = new Map(tags.map((tag) => [tag.field, tag.redactionMode]));
      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(sample)) {
        const mode = byField.get(key);
        if (mode === "remove") continue;
        out[key] = mode ? this.maskValue(value) : this.applyTagRedactions(value, tags);
      }
      return out;
    }
    return this.maskValue(sample);
  }

  async getSettings(campgroundId: string) {
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

  async updateSettings(
    campgroundId: string,
    patch: Partial<{
      redactPII: boolean;
      consentRequired: boolean;
      backupRetentionDays: number;
      keyRotationDays: number;
    }>,
  ) {
    await this.getSettings(campgroundId);
    return this.prisma.privacySetting.update({
      where: { campgroundId },
      data: patch,
    });
  }

  async recordConsent(entry: {
    campgroundId: string;
    subject: string;
    consentType: string;
    grantedBy: string;
    method?: string;
    purpose?: string;
    expiresAt?: Date | null;
    revokedAt?: Date | null;
    metadata?: Record<string, unknown>;
  }) {
    const method = parseConsentMethod(entry.method);
    return this.prisma.consentLog.create({
      data: {
        id: randomUUID(),
        campgroundId: entry.campgroundId,
        subject: entry.subject,
        consentType: entry.consentType,
        grantedBy: entry.grantedBy,
        method: method ?? undefined,
        purpose: entry.purpose ?? null,
        expiresAt: entry.expiresAt ?? null,
        revokedAt: entry.revokedAt ?? null,
        metadata: toNullableJsonInput(entry.metadata),
      },
    });
  }

  async listConsents(campgroundId: string) {
    return this.prisma.consentLog.findMany({
      where: { campgroundId },
      orderBy: { grantedAt: "desc" },
      take: 200,
    });
  }

  async listPiiTags() {
    return this.prisma.piiFieldTag.findMany({ orderBy: [{ resource: "asc" }, { field: "asc" }] });
  }

  async upsertPiiTag(entry: {
    resource: string;
    field: string;
    classification: string;
    redactionMode?: string;
    createdById?: string | null;
  }) {
    const classification = parsePiiClassification(entry.classification);
    if (!classification) {
      throw new BadRequestException("Invalid PII classification");
    }
    const redactionMode = entry.redactionMode ? parseRedactionMode(entry.redactionMode) : undefined;
    if (entry.redactionMode && !redactionMode) {
      throw new BadRequestException("Invalid redaction mode");
    }
    return this.prisma.piiFieldTag.upsert({
      where: { resource_field: { resource: entry.resource, field: entry.field } },
      create: {
        id: randomUUID(),
        resource: entry.resource,
        field: entry.field,
        classification,
        redactionMode,
        createdById: entry.createdById ?? null,
      },
      update: {
        classification,
        redactionMode,
      },
    });
  }

  async previewRedaction(campgroundId: string, resource: string | undefined, sample: unknown) {
    // Pull tags for the resource if provided; otherwise apply generic masking.
    const tags = await this.prisma.piiFieldTag.findMany({
      where: resource ? { resource } : undefined,
      select: { field: true, redactionMode: true, classification: true },
      orderBy: [{ resource: "asc" }, { field: "asc" }],
      take: 100,
    });

    const redacted = tags.length ? this.applyTagRedactions(sample, tags) : this.scrub(sample);

    return {
      redacted,
      rulesApplied: tags.map((t) => ({
        field: t.field,
        redactionMode: t.redactionMode,
        classification: t.classification,
      })),
      campgroundId,
    };
  }

  async listRecentRedactions(campgroundId: string) {
    const logs = await this.prisma.auditLog.findMany({
      where: { campgroundId },
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        before: true,
        after: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      createdAt: log.createdAt,
      sample: this.scrub({ before: log.before, after: log.after }),
    }));
  }

  async exportConsentBundle(campgroundId: string) {
    const [settings, consents, piiTags] = await Promise.all([
      this.getSettings(campgroundId),
      this.prisma.consentLog.findMany({
        where: { campgroundId },
        orderBy: { grantedAt: "desc" },
        take: 200,
      }),
      this.prisma.piiFieldTag.findMany({
        orderBy: [{ resource: "asc" }, { field: "asc" }],
        take: 200,
      }),
    ]);

    type ConsentRow = {
      id?: string | null;
      subject: string;
      consentType: string;
      grantedBy: string;
      grantedAt: Date | string;
      purpose?: string | null;
      method?: ConsentMethod | string | null;
      expiresAt?: Date | string | null;
      revokedAt?: Date | string | null;
    };

    type PiiRow = {
      resource: string;
      field: string;
      classification: PiiClassification | string;
      redactionMode?: RedactionMode | string | null;
    };

    const consentRows: ConsentRow[] =
      consents.length > 0
        ? consents.map((consent) => ({
            id: consent.id,
            subject: consent.subject,
            consentType: consent.consentType,
            grantedBy: consent.grantedBy,
            grantedAt: consent.grantedAt,
            purpose: consent.purpose ?? null,
            method: consent.method ?? null,
            expiresAt: consent.expiresAt ?? null,
            revokedAt: consent.revokedAt ?? null,
          }))
        : [
            {
              id: "stub-consent",
              subject: "guest@example.com",
              consentType: "marketing",
              grantedBy: "system",
              grantedAt: new Date().toISOString(),
              purpose: "demo",
              method: ConsentMethod.digital,
              expiresAt: null,
              revokedAt: null,
            },
          ];

    const piiRows: PiiRow[] =
      piiTags.length > 0
        ? piiTags.map((tag) => ({
            resource: tag.resource,
            field: tag.field,
            classification: tag.classification,
            redactionMode: tag.redactionMode ?? null,
          }))
        : [
            {
              resource: "guest",
              field: "email",
              classification: PiiClassification.sensitive,
              redactionMode: RedactionMode.mask,
            },
          ];

    return {
      exportVersion: "stub",
      campgroundId,
      generatedAt: new Date().toISOString(),
      settings: {
        redactPII: settings.redactPII,
        consentRequired: settings.consentRequired,
        backupRetentionDays: settings.backupRetentionDays,
        keyRotationDays: settings.keyRotationDays,
      },
      consents: consentRows.map((c) => ({
        id: c.id ?? null,
        subject: c.subject,
        consentType: c.consentType,
        grantedBy: c.grantedBy,
        grantedAt: toIsoString(c.grantedAt) ?? new Date().toISOString(),
        purpose: c.purpose ?? null,
        method: c.method ?? null,
        expiresAt: toIsoString(c.expiresAt),
        revokedAt: toIsoString(c.revokedAt),
      })),
      piiTags: piiRows.map((p) => ({
        resource: p.resource,
        field: p.field,
        classification: p.classification,
        redactionMode: p.redactionMode ?? null,
      })),
    };
  }

  async exportConsentCsv(campgroundId: string, res: PrivacyExportResponse) {
    const bundle = await this.exportConsentBundle(campgroundId);
    const rows: string[] = [];
    rows.push(
      [
        "type",
        "campgroundId",
        "subject",
        "consentType",
        "grantedBy",
        "grantedAt",
        "purpose",
        "expiresAt",
        "resource",
        "field",
        "classification",
        "redactionMode",
        "settingKey",
        "settingValue",
      ].join(","),
    );

    const sanitize = (value: unknown) => {
      if (value === null || value === undefined) return "";
      return String(value).replace(/,/g, ";");
    };

    for (const consent of bundle.consents) {
      rows.push(
        [
          "consent",
          campgroundId,
          sanitize(consent.subject),
          sanitize(consent.consentType),
          sanitize(consent.grantedBy),
          sanitize(consent.grantedAt),
          sanitize(consent.purpose),
          sanitize(consent.expiresAt),
          "",
          "",
          "",
          "",
          "",
          "",
        ].join(","),
      );
    }

    for (const tag of bundle.piiTags) {
      rows.push(
        [
          "pii_tag",
          campgroundId,
          "",
          "",
          "",
          "",
          "",
          "",
          sanitize(tag.resource),
          sanitize(tag.field),
          sanitize(tag.classification),
          sanitize(tag.redactionMode),
          "",
          "",
        ].join(","),
      );
    }

    rows.push(
      [
        "setting",
        campgroundId,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "redactPII",
        sanitize(bundle.settings.redactPII),
      ].join(","),
    );
    rows.push(
      [
        "setting",
        campgroundId,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "consentRequired",
        sanitize(bundle.settings.consentRequired),
      ].join(","),
    );
    rows.push(
      [
        "setting",
        campgroundId,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "backupRetentionDays",
        sanitize(bundle.settings.backupRetentionDays),
      ].join(","),
    );
    rows.push(
      [
        "setting",
        campgroundId,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "keyRotationDays",
        sanitize(bundle.settings.keyRotationDays),
      ].join(","),
    );

    res.set("Content-Type", "text/csv");
    res.set("Content-Disposition", "attachment; filename=privacy-consent-export.csv");
    return res.send(rows.join("\n"));
  }
}
