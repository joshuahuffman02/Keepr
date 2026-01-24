import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { Test, type TestingModule } from "@nestjs/testing";
import { NpsService } from "../src/nps/nps.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { EmailService } from "../src/email/email.service";
import { SupportService } from "../src/support/support.service";

describe("NPS schedule enqueue", () => {
  const emailService = { sendEmail: jest.fn() };
  const supportService = { create: jest.fn() };
  let prisma: {
    campground: { findMany: jest.Mock };
    npsSurvey: { findMany: jest.Mock };
    communicationPlaybook: { findFirst: jest.Mock; create: jest.Mock };
    reservation: { findMany: jest.Mock };
    communicationPlaybookJob: { findFirst: jest.Mock; create: jest.Mock };
  };
  let service: NpsService;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2025-01-01T07:30:00Z"));
    prisma = {
      campground: { findMany: jest.fn() },
      npsSurvey: { findMany: jest.fn() },
      communicationPlaybook: { findFirst: jest.fn(), create: jest.fn() },
      reservation: { findMany: jest.fn() },
      communicationPlaybookJob: { findFirst: jest.fn(), create: jest.fn() },
    };

    moduleRef = await Test.createTestingModule({
      providers: [
        NpsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: emailService },
        { provide: SupportService, useValue: supportService },
      ],
    }).compile();

    service = moduleRef.get(NpsService);
  });

  afterEach(async () => {
    jest.useRealTimers();
    jest.resetAllMocks();
    await moduleRef.close();
  });

  it("creates jobs for arrival-before and departure-after entries at the correct offsets", async () => {
    prisma.campground.findMany.mockResolvedValue([
      {
        id: "cg1",
        timezone: "UTC",
        npsAutoSendEnabled: true,
        npsSendHour: 7,
        npsTemplateId: "tpl-default",
        npsSchedule: [
          {
            id: "arr-before-0d",
            anchor: "arrival",
            direction: "before",
            offset: 0,
            unit: "days",
            enabled: true,
          },
          {
            id: "dep-after-0d",
            anchor: "departure",
            direction: "after",
            offset: 0,
            unit: "days",
            enabled: true,
          },
        ],
      },
    ]);
    prisma.npsSurvey.findMany.mockResolvedValue([
      { id: "survey1", campgroundId: "cg1", rules: [{}] },
    ]);
    prisma.communicationPlaybook.findFirst.mockResolvedValue({
      id: "pb-nps",
      templateId: "tpl-default",
    });
    prisma.reservation.findMany.mockResolvedValue([
      {
        id: "res-arrival",
        campgroundId: "cg1",
        guestId: "guest-arrival",
        arrivalDate: new Date("2025-01-01T12:00:00Z"),
        departureDate: new Date("2025-01-02T12:00:00Z"),
        status: "confirmed",
        guest: { email: "arrival@example.com" },
      },
      {
        id: "res-departure",
        campgroundId: "cg1",
        guestId: "guest-departure",
        arrivalDate: new Date("2024-12-31T12:00:00Z"),
        departureDate: new Date("2025-01-01T12:00:00Z"),
        status: "confirmed",
        guest: { email: "departure@example.com" },
      },
    ]);
    prisma.communicationPlaybookJob.findFirst.mockResolvedValue(null);

    await service.sendPostCheckoutInvites();

    expect(prisma.communicationPlaybookJob.create).toHaveBeenCalledTimes(2);
    const calls = prisma.communicationPlaybookJob.create.mock.calls.map((call) => call[0]?.data);

    const arrivalJob = calls.find((entry) => entry?.reservationId === "res-arrival");
    const departureJob = calls.find((entry) => entry?.reservationId === "res-departure");

    expect(arrivalJob?.metadata.entryId).toBe("arr-before-0d");
    expect(departureJob?.metadata.entryId).toBe("dep-after-0d");

    expect(new Date(arrivalJob!.scheduledAt).toISOString()).toContain("2025-01-01T07:00:00");
    expect(new Date(departureJob!.scheduledAt).toISOString()).toContain("2025-01-01T07:00:00");
  });
});
