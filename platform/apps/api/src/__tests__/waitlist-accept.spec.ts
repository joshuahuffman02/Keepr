import { ConflictException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { WaitlistService } from "../waitlist/waitlist.service";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { IdempotencyService } from "../payments/idempotency.service";
import { ObservabilityService } from "../observability/observability.service";

describe("Waitlist accept guard", () => {
  it("returns conflict on second accept", async () => {
    const prisma = {
      waitlistEntry: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: "w1", campgroundId: "camp-1", status: "fulfilled" }),
        update: jest.fn(),
      },
    };

    const emailService = { sendEmail: jest.fn() };
    const idempotency = {
      findBySequence: jest.fn().mockResolvedValue(null),
      start: jest.fn().mockResolvedValue({ status: "pending", createdAt: new Date() }),
      complete: jest.fn(),
      fail: jest.fn(),
    };
    const observability = { recordOfferLag: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        WaitlistService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: emailService },
        { provide: IdempotencyService, useValue: idempotency },
        { provide: ObservabilityService, useValue: observability },
      ],
    }).compile();

    const service = moduleRef.get(WaitlistService);

    await expect(
      service.accept("w1", "idem", "seq-1", { campgroundId: "camp-1" }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(idempotency.fail).toHaveBeenCalled();

    await moduleRef.close();
  });
});
