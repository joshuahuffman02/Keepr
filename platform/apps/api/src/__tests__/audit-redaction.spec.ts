import { Test, type TestingModule } from "@nestjs/testing";
import { AuditService } from "../audit/audit.service";
import { PrivacyService } from "../privacy/privacy.service";
import { PrismaService } from "../prisma/prisma.service";

// Minimal e2e-ish check: redaction on/off for audit list

describe("Audit redaction", () => {
  let moduleRef: TestingModule;
  let prisma: {
    auditLog: { findMany: jest.Mock };
    privacySetting: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
  };
  let auditService: AuditService;
  let privacyService: PrivacyService;
  const campgroundId = "camp-audit-test";
  const actorId = "user-audit";
  const actor = { id: actorId, email: "actor@example.com", firstName: "Act", lastName: "Or" };
  const auditRows: Array<{
    id: string;
    campgroundId: string;
    actorId: string;
    action: string;
    entity: string;
    entityId: string;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    createdAt: Date;
    ip?: string | null;
    userAgent?: string | null;
    User: typeof actor;
  }> = [];
  let privacySetting = {
    id: "privacy-1",
    campgroundId,
    redactPII: true,
    consentRequired: true,
    backupRetentionDays: 30,
    keyRotationDays: 90,
    updatedAt: new Date(),
  };

  beforeAll(async () => {
    prisma = {
      auditLog: {
        findMany: jest.fn().mockImplementation(async () => auditRows),
      },
      privacySetting: {
        findUnique: jest.fn().mockImplementation(async () => privacySetting),
        create: jest.fn().mockImplementation(async ({ data }: { data: typeof privacySetting }) => {
          privacySetting = { ...data };
          return privacySetting;
        }),
        update: jest
          .fn()
          .mockImplementation(async ({ data }: { data: Partial<typeof privacySetting> }) => {
            privacySetting = { ...privacySetting, ...data, updatedAt: new Date() };
            return privacySetting;
          }),
      },
    };

    moduleRef = await Test.createTestingModule({
      providers: [AuditService, PrivacyService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    auditService = moduleRef.get(AuditService);
    privacyService = moduleRef.get(PrivacyService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it("redacts when privacy is on, shows raw when off", async () => {
    auditRows.length = 0;
    auditRows.push({
      id: "audit-1",
      campgroundId,
      actorId,
      action: "update",
      entity: "guest",
      entityId: "g1",
      before: { email: "guest@example.com", phone: "555-123-1234" },
      after: { email: "guest@example.com", phone: "555-123-1234" },
      createdAt: new Date(),
      ip: null,
      userAgent: null,
      User: actor,
    });

    // privacy on (default true)
    const redacted = await auditService.list({ campgroundId });
    expect(JSON.stringify(redacted)).toContain("***@redacted");
    expect(JSON.stringify(redacted)).toContain("***-***-****");

    // turn off redaction
    await privacyService.updateSettings(campgroundId, { redactPII: false });
    const raw = await auditService.list({ campgroundId });
    expect(JSON.stringify(raw)).toContain("guest@example.com");
    expect(JSON.stringify(raw)).toContain("555-123-1234");
  });
});
