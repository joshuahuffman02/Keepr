import { Injectable } from "@nestjs/common";
import { Response } from "express";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PrivacyService {
  constructor(private readonly prisma: PrismaService) {}

  private maskValue(val: any) {
    if (typeof val !== "string") return val;
    const emailMasked = val.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "***@redacted");
    const phoneMasked = emailMasked.replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "***-***-****");
    return phoneMasked;
  }

  private scrub(value: any): any {
    if (Array.isArray(value)) return value.map((v) => this.scrub(v));
    if (value && typeof value === "object") {
      return Object.entries(value).reduce((acc, [k, v]) => {
        acc[k] = this.scrub(v);
        return acc;
      }, {} as Record<string, any>);
    }
    return this.maskValue(value);
  }

  private applyTagRedactions(sample: any, tags: { field: string; redactionMode?: string | null }[]): any {
    if (Array.isArray(sample)) return sample.map((v) => this.applyTagRedactions(v, tags));
    if (sample && typeof sample === "object") {
      const byField = new Map(tags.map((t) => [t.field, t.redactionMode]));
      const out: Record<string, any> = {};
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
        campgroundId,
        redactPII: true,
        consentRequired: true,
        backupRetentionDays: 30,
        keyRotationDays: 90,
      },
    });
  }

  async updateSettings(
    campgroundId: string,
    patch: Partial<{ redactPII: boolean; consentRequired: boolean; backupRetentionDays: number; keyRotationDays: number }>
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
    metadata?: Record<string, any>;
  }) {
    return this.prisma.consentLog.create({
      data: {
        campgroundId: entry.campgroundId,
        subject: entry.subject,
        consentType: entry.consentType,
        grantedBy: entry.grantedBy,
        method: entry.method as any,
        purpose: entry.purpose ?? null,
        expiresAt: entry.expiresAt ?? null,
        revokedAt: entry.revokedAt ?? null,
        metadata: entry.metadata ?? undefined
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
    return this.prisma.piiFieldTag.upsert({
      where: { resource_field: { resource: entry.resource, field: entry.field } } as any,
      create: {
        resource: entry.resource,
        field: entry.field,
        classification: entry.classification as any,
        redactionMode: entry.redactionMode as any,
        createdById: entry.createdById ?? null,
      },
      update: {
        classification: entry.classification as any,
        redactionMode: entry.redactionMode as any,
      },
    });
  }

  async previewRedaction(campgroundId: string, resource: string | undefined, sample: any) {
    // Pull tags for the resource if provided; otherwise apply generic masking.
    const tags = await this.prisma.piiFieldTag.findMany({
      where: resource ? { resource } : undefined,
      select: { field: true, redactionMode: true, classification: true },
      orderBy: [{ resource: "asc" }, { field: "asc" }],
      take: 100
    });

    const redacted = tags.length ? this.applyTagRedactions(sample, tags) : this.scrub(sample);

    return {
      redacted,
      rulesApplied: tags.map((t) => ({ field: t.field, redactionMode: t.redactionMode, classification: t.classification })),
      campgroundId,
    };
  }

  async listRecentRedactions(campgroundId: string) {
    const logs = await this.prisma.auditLog.findMany({
      where: { campgroundId },
      select: { id: true, action: true, entity: true, entityId: true, before: true, after: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return logs.map((log: any) => ({
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

    const consentRows =
      consents.length > 0
        ? consents
        : [
            {
              id: "stub-consent",
              campgroundId,
              subject: "guest@example.com",
              consentType: "marketing",
              grantedBy: "system",
              grantedAt: new Date().toISOString(),
              purpose: "demo",
              method: "digital",
              expiresAt: null,
              revokedAt: null,
            },
          ];

    const piiRows =
      piiTags.length > 0
        ? piiTags
        : [
            {
              resource: "guest",
              field: "email",
              classification: "sensitive",
              redactionMode: "mask",
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
      consents: consentRows.map((c: any) => ({
        id: c.id ?? null,
        subject: c.subject,
        consentType: c.consentType,
        grantedBy: c.grantedBy,
        grantedAt: (c as any).grantedAt ? new Date((c as any).grantedAt).toISOString() : new Date().toISOString(),
        purpose: c.purpose ?? null,
        method: c.method ?? null,
        expiresAt: (c as any).expiresAt ? new Date((c as any).expiresAt).toISOString() : null,
        revokedAt: (c as any).revokedAt ? new Date((c as any).revokedAt).toISOString() : null,
      })),
      piiTags: piiRows.map((p: any) => ({
        resource: p.resource,
        field: p.field,
        classification: p.classification,
        redactionMode: p.redactionMode ?? null,
      })),
    };
  }

  async exportConsentCsv(campgroundId: string, res: Response) {
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

    const sanitize = (value: any) => {
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
      ["setting", campgroundId, "", "", "", "", "", "", "", "", "", "", "redactPII", sanitize(bundle.settings.redactPII)].join(","),
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

    (res as any).setHeader("Content-Type", "text/csv");
    (res as any).setHeader("Content-Disposition", "attachment; filename=privacy-consent-export.csv");
    return (res as any).send(rows.join("\n"));
  }
}

