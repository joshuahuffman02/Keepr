import { Test, type TestingModule } from "@nestjs/testing";
import { BackupService, BackupProvider } from "../backup/backup.service";
import { PrismaService } from "../prisma/prisma.service";

describe("Backup/DR readiness endpoints", () => {
  let moduleRef: TestingModule;
  let service: BackupService;
  const campgroundId = "camp-backup-dr";
  const providerMock: jest.Mocked<BackupProvider> = {
    healthCheck: jest.fn(),
    getLatestBackup: jest.fn(),
    runRestoreDrill: jest.fn(),
  };

  const prismaStub = {
    privacySetting: {
      findUnique: jest.fn(),
    },
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        BackupService,
        {
          provide: PrismaService,
          useValue: prismaStub,
        },
        {
          provide: BackupProvider,
          useValue: providerMock,
        },
      ],
    }).compile();
    service = moduleRef.get(BackupService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prismaStub.privacySetting.findUnique.mockResolvedValue({
      campgroundId,
      backupRetentionDays: 14,
    });
    providerMock.healthCheck.mockResolvedValue({ ok: true, message: "ok" });
    providerMock.getLatestBackup.mockResolvedValue({
      lastBackupAt: new Date().toISOString(),
      location: "s3://test-bucket/snap",
      verifiedAt: new Date().toISOString(),
    });
    providerMock.runRestoreDrill.mockResolvedValue({
      ok: true,
      verifiedAt: new Date().toISOString(),
      message: "restore verified",
    });
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it("returns backup status snapshot", async () => {
    const res = await service.getStatus(campgroundId);

    expect(res.retentionDays).toBe(14);
    expect(res.lastBackupLocation).toContain("s3://test-bucket");
    expect(res.restoreSimulation.status).toBe("idle");
    expect(res.status).toBe("healthy");
    expect(new Date(res.lastBackupAt ?? "").valueOf()).not.toBeNaN();
  });

  it("marks stale when beyond retention", async () => {
    providerMock.getLatestBackup.mockResolvedValueOnce({
      lastBackupAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(), // 20 days ago
      location: "s3://test-bucket/snap",
      verifiedAt: new Date().toISOString(),
    });
    prismaStub.privacySetting.findUnique.mockResolvedValueOnce({
      campgroundId,
      backupRetentionDays: 10,
    });

    const res = await service.getStatus(campgroundId);
    expect(res.status).toBe("stale");
  });

  it("propagates provider errors", async () => {
    providerMock.getLatestBackup.mockRejectedValueOnce(new Error("provider down"));
    await expect(service.getStatus(campgroundId)).rejects.toThrow("provider down");
  });

  it("runs restore simulation and updates status", async () => {
    const sim = await service.simulateRestore(campgroundId);
    expect(sim.restoreSimulation.status).toBe("ok");
    expect(sim.retentionDays).toBe(14);
    expect(sim.lastRestoreDrillAt).toBeTruthy();

    // status call is stateless; just ensure it succeeds
    await service.getStatus(campgroundId);
  });

  it("fails when no backup is present", async () => {
    providerMock.getLatestBackup.mockResolvedValueOnce({
      lastBackupAt: null,
      location: null,
      verifiedAt: null,
    });
    await expect(service.getStatus(campgroundId)).rejects.toThrow(
      "No backup record found for campground",
    );
  });

  it("fails restore when provider fails", async () => {
    providerMock.runRestoreDrill.mockResolvedValueOnce({
      ok: false,
      verifiedAt: null,
      message: "restore failed",
    });
    await expect(service.simulateRestore(campgroundId)).rejects.toThrow("restore failed");
  });
});
