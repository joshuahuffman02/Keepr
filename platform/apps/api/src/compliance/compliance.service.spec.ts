import { Test, TestingModule } from "@nestjs/testing";
import { ComplianceService } from "./compliance.service";
import { PrismaService } from "../prisma/prisma.service";

describe("ComplianceService", () => {
  let moduleRef: TestingModule;
  let service: ComplianceService;
  let prisma: PrismaService;

  const mockPrismaService = {
    organization: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [ComplianceService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = moduleRef.get<ComplianceService>(ComplianceService);
    prisma = moduleRef.get<PrismaService>(PrismaService);
  });

  afterEach(async () => {
    await moduleRef?.close();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should return true if regions match", async () => {
    mockPrismaService.organization.findUnique.mockResolvedValue({ dataRegion: "us-east-1" });
    // Default impl uses process.env.AWS_REGION || 'us-east-1'
    const result = await service.verifyDataResidency("org-1");
    expect(result).toBe(true);
  });

  it("should return false if regions do not match", async () => {
    mockPrismaService.organization.findUnique.mockResolvedValue({ dataRegion: "eu-central-1" });
    const result = await service.verifyDataResidency("org-1");
    expect(result).toBe(false);
  });
});
