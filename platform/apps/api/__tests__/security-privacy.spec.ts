import { Test } from "@nestjs/testing";
import { AuditService } from "../src/audit/audit.service";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Security/Privacy audit API smoke", () => {
  let audit: AuditService;
  const prisma = {
    auditLog: {
      findMany: jest.fn(),
    },
    privacySetting: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    auditExport: {
      create: jest.fn(),
    },
    piiFieldTag: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const sampleRows = [
    {
      id: "a1",
      campgroundId: "cg1",
      actorId: "u1",
      action: "updated",
      entity: "privacy",
      entityId: "cg1",
      createdAt: new Date().toISOString(),
      ip: "127.0.0.1",
      userAgent: "jest",
      chainHash: "hash-1",
      prevHash: "hash-0",
      before: null,
      after: null,
      User: { id: "u1", email: "user@example.com", firstName: "Test", lastName: "User" },
    },
    {
      id: "a2",
      campgroundId: "cg1",
      actorId: null,
      action: "viewed",
      entity: "audit",
      entityId: "cg1",
      createdAt: new Date().toISOString(),
      ip: null,
      userAgent: null,
      chainHash: "hash-2",
      prevHash: "hash-1",
      before: null,
      after: null,
      User: null,
    },
  ];

  beforeAll(async () => {
    prisma.auditLog.findMany.mockResolvedValue(sampleRows);
    prisma.privacySetting.findUnique.mockResolvedValue({
      campgroundId: "cg1",
      redactPII: false,
      consentRequired: true,
      backupRetentionDays: 30,
      keyRotationDays: 90,
    });
    prisma.auditExport.create.mockResolvedValue({});
    prisma.piiFieldTag.count.mockResolvedValue(3);
    prisma.piiFieldTag.findMany.mockResolvedValue([
      { resource: "guests", field: "email", classification: "pii", redactionMode: null },
      { resource: "guests", field: "phone", classification: "pii", redactionMode: "mask" },
    ]);

    const moduleRef = await Test.createTestingModule({
      providers: [AuditService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    audit = moduleRef.get(AuditService);
  });

  it("returns 200 and basic shape for audit list", async () => {
    const rows = await audit.exportJson({ campgroundId: "cg1", limit: 5 });

    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        action: expect.any(String),
        entity: expect.any(String),
      }),
    );
  });

  it("returns csv export with audit rows and download headers", async () => {
    const headers: Record<string, string> = {};
    const res = {
      setHeader: (key: string, value: string) => {
        headers[key] = value;
      },
      send: jest.fn((payload: string) => payload),
    };

    const csv = await audit.exportCsv({ campgroundId: "cg1" }, res);

    expect(headers["Content-Type"]).toContain("text/csv");
    expect(headers["Content-Disposition"]).toContain("attachment; filename=audit.csv");

    const lines = csv.split("\n").filter(Boolean);
    expect(lines[0]).toContain(
      "id,campgroundId,actorId,action,entity,entityId,createdAt,ip,userAgent,chainHash,prevHash,before,after",
    );
    expect(lines[1]).toContain("a1");
  });

  it("returns json export with correct headers and shape", async () => {
    const rows = await audit.exportJson({ campgroundId: "cg1" });

    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        action: expect.any(String),
        createdAt: expect.anything(),
      }),
    );
  });

  it("returns quick audit summary", async () => {
    const summary = await audit.quickAudit({ campgroundId: "cg1", limit: 5 });

    expect(summary).toEqual(
      expect.objectContaining({
        privacyDefaults: expect.objectContaining({
          redactPII: expect.any(Boolean),
          consentRequired: expect.any(Boolean),
        }),
        piiTagCount: expect.any(Number),
        auditEvents: expect.any(Array),
      }),
    );
    expect(summary.auditEvents.length).toBeGreaterThan(0);
  });
});
