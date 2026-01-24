import { Test } from "@nestjs/testing";
import { PrivacyService } from "../src/privacy/privacy.service";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Privacy export API smoke", () => {
  let privacy: PrivacyService;
  const prisma = {
    privacySetting: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    consentLog: {
      findMany: jest.fn(),
    },
    piiFieldTag: {
      findMany: jest.fn(),
    },
  };

  beforeAll(async () => {
    prisma.privacySetting.findUnique.mockResolvedValue({
      campgroundId: "cg1",
      redactPII: true,
      consentRequired: false,
      backupRetentionDays: 45,
      keyRotationDays: 60,
    });
    prisma.privacySetting.create.mockResolvedValue({
      campgroundId: "cg1",
      redactPII: true,
      consentRequired: false,
      backupRetentionDays: 45,
      keyRotationDays: 60,
    });
    prisma.consentLog.findMany.mockResolvedValue([
      {
        id: "consent-1",
        campgroundId: "cg1",
        subject: "guest@example.com",
        consentType: "marketing",
        grantedBy: "admin@example.com",
        grantedAt: new Date("2024-01-01T00:00:00.000Z"),
        purpose: "promotions",
        method: "digital",
        expiresAt: null,
        revokedAt: null,
      },
    ]);
    prisma.piiFieldTag.findMany.mockResolvedValue([
      { resource: "guest", field: "email", classification: "sensitive", redactionMode: "mask" },
    ]);

    const moduleRef = await Test.createTestingModule({
      providers: [PrivacyService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    privacy = moduleRef.get(PrivacyService);
  });

  it("returns JSON bundle with settings, consents, and tags", async () => {
    const res = await privacy.exportConsentBundle("cg1");

    expect(res).toEqual(
      expect.objectContaining({
        campgroundId: "cg1",
        settings: expect.objectContaining({
          redactPII: expect.any(Boolean),
          consentRequired: expect.any(Boolean),
          backupRetentionDays: expect.any(Number),
          keyRotationDays: expect.any(Number),
        }),
        consents: expect.any(Array),
        piiTags: expect.any(Array),
      }),
    );
    expect(res.consents.length).toBeGreaterThan(0);
    expect(res.piiTags[0]).toEqual(
      expect.objectContaining({
        resource: expect.any(String),
        field: expect.any(String),
      }),
    );
  });

  it("returns CSV export with download headers", async () => {
    const headers: Record<string, string> = {};
    const res = {
      set: (key: string, value: string) => {
        headers[key] = value;
        return res;
      },
      send: jest.fn((payload: string) => payload),
    };

    const csv = await privacy.exportConsentCsv("cg1", res);

    expect(headers["Content-Type"]).toContain("text/csv");
    expect(headers["Content-Disposition"]).toContain("privacy-consent-export.csv");
    const lines = csv.split("\n").filter(Boolean);
    expect(lines[0]).toContain("type,campgroundId");
    expect(lines.some((line) => line.startsWith("consent"))).toBe(true);
    expect(lines.some((line) => line.startsWith("pii_tag"))).toBe(true);
  });
});
