import { Test, type TestingModule } from "@nestjs/testing";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";

describe("Audit quick view", () => {
  let moduleRef: TestingModule;
  let service: AuditService;
  const campgroundId = "camp-quick-audit";

  const prismaStub = {
    auditLog: {
      findMany: jest.fn(),
    },
    piiFieldTag: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    privacySetting: {
      findUnique: jest.fn(),
    },
    auditExport: {
      create: jest.fn(),
    },
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: PrismaService,
          useValue: prismaStub,
        },
      ],
    }).compile();

    service = moduleRef.get(AuditService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prismaStub.privacySetting.findUnique.mockResolvedValue({
      campgroundId,
      redactPII: true,
      consentRequired: true,
      backupRetentionDays: 30,
      keyRotationDays: 90,
    });
    prismaStub.piiFieldTag.count.mockResolvedValue(3);
    prismaStub.piiFieldTag.findMany.mockResolvedValue([
      { resource: "guest", field: "email", classification: "sensitive" },
      { resource: "guest", field: "phone", classification: "sensitive" },
    ]);
    prismaStub.auditLog.findMany.mockResolvedValue([
      {
        id: "a1",
        campgroundId,
        action: "update",
        entity: "privacySetting",
        entityId: "ps1",
        createdAt: new Date().toISOString(),
        ip: "127.0.0.1",
        userAgent: "jest",
        chainHash: "hash-1",
        prevHash: null,
        before: { email: "guest@example.com" },
        after: { email: "guest@example.com" },
        User: { id: "user-1", email: "owner@test.com" },
      },
    ]);
    prismaStub.auditExport.create.mockResolvedValue({});
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it("returns quick-audit snapshot with privacy defaults and audit events", async () => {
    const res = await service.quickAudit({ campgroundId, limit: 5 });

    expect(res.privacyDefaults).toMatchObject({
      redactPII: true,
      consentRequired: true,
      backupRetentionDays: 30,
      keyRotationDays: 90,
    });
    expect(res.piiTagCount).toBe(3);
    expect(Array.isArray(res.piiTagsPreview)).toBe(true);
    expect(Array.isArray(res.auditEvents)).toBe(true);
    expect(res.auditEvents[0]).toMatchObject({
      action: "update",
      entity: "privacySetting",
    });
  });

  it("exports audit events as csv", async () => {
    const headers: Record<string, string> = {};
    let body = "";
    const res = {
      setHeader: (name: string, value: string) => {
        headers[name.toLowerCase()] = String(value);
      },
      send: (payload: string) => {
        body = String(payload);
        return payload;
      },
    };

    await service.exportCsv({ campgroundId, limit: 5 }, res);

    expect(headers["content-type"]).toContain("text/csv");
    expect(body.split("\n")[0]).toContain("action");
    expect(body).toContain("update");
  });
});
