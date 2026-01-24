import { Test, type TestingModule } from "@nestjs/testing";
import { OperationsService } from "../operations/operations.service";
import { PrismaService } from "../prisma/prisma.service";
import { GamificationService } from "../gamification/gamification.service";
import { EmailService } from "../email/email.service";

describe("Operations health smoke", () => {
  let moduleRef: TestingModule;
  let service: OperationsService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        OperationsService,
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: GamificationService,
          useValue: { recordEvent: jest.fn() },
        },
        {
          provide: EmailService,
          useValue: { sendEmail: jest.fn() },
        },
      ],
    }).compile();
    service = moduleRef.get(OperationsService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it("returns ops health shape", async () => {
    const res = await service.getOpsHealth("camp-ops-health");

    expect(res.campgroundId).toBe("camp-ops-health");
    expect(res.autoTasking).toBeDefined();
    expect(Array.isArray(res.autoTasking.recentRuns)).toBe(true);
    expect(res.reorders).toBeDefined();
  });
});
