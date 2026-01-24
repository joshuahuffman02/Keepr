import { Test, type TestingModule } from "@nestjs/testing";
import { ActivitiesService } from "../activities/activities.service";
import { PrismaService } from "../prisma/prisma.service";

describe("Activities capacity smoke", () => {
  let moduleRef: TestingModule;
  let service: ActivitiesService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [ActivitiesService, { provide: PrismaService, useValue: {} }],
    }).compile();

    service = moduleRef.get(ActivitiesService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it("exposes capacity snapshot, updates cap, and accepts waitlist entries (stub)", async () => {
    const capacity = await service.getCapacitySnapshot("demo-activity");
    expect(capacity.capacity).toBeGreaterThan(0);
    expect(capacity).toHaveProperty("remaining");

    const updated = await service.updateCapacitySettings("demo-activity", {
      capacity: 25,
      waitlistEnabled: true,
    });
    expect(updated.capacity).toBe(25);
    expect(updated.waitlistEnabled).toBe(true);

    const waitlist = await service.addWaitlistEntry("demo-activity", {
      guestName: "Capacity Test",
      partySize: 3,
    });
    expect(waitlist.snapshot.waitlistCount).toBeGreaterThan(0);
  });
});
