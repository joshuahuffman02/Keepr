import { ConflictException } from "@nestjs/common";
import { WaitlistService } from "../waitlist/waitlist.service";

type Status = "active" | "fulfilled" | "expired" | "cancelled" | string;

describe("Waitlist accept guard", () => {
  it("returns conflict on second accept", async () => {
    const prisma = {
      waitlistEntry: {
        findUnique: jest.fn().mockResolvedValue({ id: "w1", campgroundId: "camp-1", status: "fulfilled" as Status }),
        update: jest.fn()
      }
    };

    const emailService = { sendEmail: jest.fn() };
    const idempotency = {
      findBySequence: jest.fn().mockResolvedValue(null),
      start: jest.fn().mockResolvedValue({ status: "pending", createdAt: new Date() }),
      complete: jest.fn(),
      fail: jest.fn()
    };

    const service = new WaitlistService(prisma as any, emailService as any, idempotency as any);

    await expect(service.accept("w1", "idem", "seq-1", { campgroundId: "camp-1" })).rejects.toBeInstanceOf(
      ConflictException
    );
    expect(idempotency.fail).toHaveBeenCalled();
  });
});
