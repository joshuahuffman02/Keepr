import { SocialPlannerService } from "./social-planner.service";
import type { SocialPlannerStore } from "./social-planner.service";

describe("SocialPlannerService", () => {
  const monday = new Date("2025-01-06T10:00:00Z");
  const anchor = new Date("2025-01-06T00:00:00.000Z");

  it("generates weekly ideas when none exist", async () => {
    const prismaStub: SocialPlannerStore = {
      socialWeeklyIdea: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest
          .fn()
          .mockImplementation(
            (args: Parameters<SocialPlannerStore["socialWeeklyIdea"]["create"]>[0]) => {
              const data = args.data;
              const campgroundId = data.Campground?.connect?.id;
              if (!campgroundId) {
                throw new Error("Missing Campground relation");
              }
              return {
                id: "weekly-1",
                campgroundId,
                generatedFor: data.generatedFor,
                ideas: data.ideas,
                cadence: data.cadence ?? null,
                createdAt: data.generatedFor,
                updatedAt: data.generatedFor,
              };
            },
          ),
      },
      // unused in this call but required by ctor signatures in some methods
      site: { count: jest.fn() },
      reservation: { count: jest.fn() },
      event: { findMany: jest.fn() },
      promotion: { findMany: jest.fn() },
      socialSuggestion: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      socialPost: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      socialTemplate: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      socialContentAsset: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      socialStrategy: { create: jest.fn(), findMany: jest.fn() },
      socialOpportunityAlert: { create: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      socialPerformanceInput: { create: jest.fn(), findMany: jest.fn() },
      campground: { findMany: jest.fn() },
    };

    const service = new SocialPlannerService(prismaStub);
    // Force deterministic Monday
    jest.useFakeTimers().setSystemTime(monday);

    const result = await service.generateWeeklyIdeas("camp-1");

    expect(prismaStub.socialWeeklyIdea.create).toHaveBeenCalled();
    expect(result.campgroundId).toBe("camp-1");
    expect(result.generatedFor.toISOString()).toBe(anchor.toISOString());

    jest.useRealTimers();
  });
});
