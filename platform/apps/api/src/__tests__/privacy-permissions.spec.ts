import { Test, type TestingModule } from "@nestjs/testing";
import { PrivacyService } from "../privacy/privacy.service";
import { PermissionsService } from "../permissions/permissions.service";
import { PrismaService } from "../prisma/prisma.service";

// Note: uses in-memory Nest app; DB must be available.
describe("Privacy & Permissions APIs (e2e-ish)", () => {
  let moduleRef: TestingModule;
  let privacyService: PrivacyService;
  let permissionsService: PermissionsService;
  const campgroundId = "camp-pp-test";
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;
  const privacySettings = new Map<
    string,
    {
      campgroundId: string;
      redactPII: boolean;
      consentRequired: boolean;
      backupRetentionDays: number;
      keyRotationDays: number;
    }
  >();
  const consentLogs: Array<{
    id: string;
    campgroundId: string;
    subject: string;
    consentType: string;
    grantedBy: string;
    grantedAt: Date;
  }> = [];
  const approvalRequests: Array<{
    id: string;
    campgroundId: string | null;
    action: string;
    status: string;
    requestedBy: string;
  }> = [];
  const prismaStub = {
    privacySetting: {
      findUnique: jest.fn(async ({ where }: { where: { campgroundId: string } }) => {
        return privacySettings.get(where.campgroundId) ?? null;
      }),
      create: jest.fn(
        async ({
          data,
        }: {
          data: {
            campgroundId: string;
            redactPII: boolean;
            consentRequired: boolean;
            backupRetentionDays: number;
            keyRotationDays: number;
          };
        }) => {
          privacySettings.set(data.campgroundId, data);
          return data;
        },
      ),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { campgroundId: string };
          data: Partial<{
            redactPII: boolean;
            consentRequired: boolean;
            backupRetentionDays: number;
            keyRotationDays: number;
          }>;
        }) => {
          const existing = privacySettings.get(where.campgroundId);
          const updated = {
            ...(existing ?? {
              campgroundId: where.campgroundId,
              redactPII: true,
              consentRequired: true,
              backupRetentionDays: 30,
              keyRotationDays: 90,
            }),
            ...data,
          };
          privacySettings.set(where.campgroundId, updated);
          return updated;
        },
      ),
      deleteMany: jest.fn(async ({ where }: { where: { campgroundId: string } }) => {
        privacySettings.delete(where.campgroundId);
        return { count: 1 };
      }),
    },
    consentLog: {
      create: jest.fn(
        async ({
          data,
        }: {
          data: {
            id: string;
            campgroundId: string;
            subject: string;
            consentType: string;
            grantedBy: string;
            grantedAt?: Date;
          };
        }) => {
          const entry = { ...data, grantedAt: data.grantedAt ?? new Date() };
          consentLogs.push(entry);
          return entry;
        },
      ),
      findMany: jest.fn(async ({ where }: { where: { campgroundId: string } }) => {
        return consentLogs.filter((row) => row.campgroundId === where.campgroundId);
      }),
      deleteMany: jest.fn(async ({ where }: { where: { campgroundId: string } }) => {
        let removed = 0;
        for (let i = consentLogs.length - 1; i >= 0; i -= 1) {
          if (consentLogs[i].campgroundId === where.campgroundId) {
            consentLogs.splice(i, 1);
            removed += 1;
          }
        }
        return { count: removed };
      }),
    },
    approvalRequest: {
      create: jest.fn(
        async ({
          data,
        }: {
          data: {
            id: string;
            campgroundId: string | null;
            action: string;
            status: string;
            requestedBy: string;
          };
        }) => {
          approvalRequests.push(data);
          return data;
        },
      ),
      findMany: jest.fn(async ({ where }: { where: { campgroundId?: string } }) => {
        return approvalRequests.filter(
          (row) => !where.campgroundId || row.campgroundId === where.campgroundId,
        );
      }),
      deleteMany: jest.fn(async ({ where }: { where: { campgroundId: string } }) => {
        let removed = 0;
        for (let i = approvalRequests.length - 1; i >= 0; i -= 1) {
          if (approvalRequests[i].campgroundId === where.campgroundId) {
            approvalRequests.splice(i, 1);
            removed += 1;
          }
        }
        return { count: removed };
      }),
      findUnique: jest.fn(async () => null),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => data),
    },
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        PrivacyService,
        PermissionsService,
        { provide: PrismaService, useValue: prismaStub },
      ],
    }).compile();

    privacyService = moduleRef.get(PrivacyService);
    permissionsService = moduleRef.get(PermissionsService);
  });

  afterAll(async () => {
    await prismaStub.consentLog.deleteMany({ where: { campgroundId } });
    await prismaStub.privacySetting.deleteMany({ where: { campgroundId } });
    await prismaStub.approvalRequest.deleteMany({ where: { campgroundId } });
    await moduleRef.close();
  });

  it("updates privacy settings and logs consent", async () => {
    const settingsRes = await privacyService.updateSettings(campgroundId, {
      redactPII: true,
      consentRequired: true,
      backupRetentionDays: 15,
      keyRotationDays: 45,
    });

    expect(settingsRes.backupRetentionDays).toBe(15);

    const consentRes = await privacyService.recordConsent({
      campgroundId,
      subject: "guest@example.com",
      consentType: "marketing",
      grantedBy: "tester",
    });

    expect(consentRes.consentType).toBe("marketing");

    const listRes = await privacyService.listConsents(campgroundId);
    expect(listRes.length).toBeGreaterThanOrEqual(1);
  });

  it("creates and lists approval requests (auto-approved stub)", async () => {
    const createRes = await permissionsService.requestApproval({
      action: "export_pii",
      requestedBy: "tester",
      campgroundId,
    });

    expect(createRes.status).toBe("approved");

    const approvals = await permissionsService.listApprovals();
    expect(approvals.some((row) => isRecord(row) && row.id === createRes.id)).toBe(true);
  });
});
