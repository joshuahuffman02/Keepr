import { Test, TestingModule } from "@nestjs/testing";
import { NotificationTriggersService, TriggerPayload } from "./notification-triggers.service";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { SmsService } from "../sms/sms.service";

describe("NotificationTriggersService", () => {
  let moduleRef: TestingModule;
  let service: NotificationTriggersService;

  const mockPrisma = {
    notificationTrigger: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    scheduledNotification: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    campground: {
      findUnique: jest.fn(),
    },
  };

  const mockEmailService = {
    sendEmail: jest.fn().mockResolvedValue(undefined),
  };

  const mockSmsService = {
    sendSms: jest.fn().mockResolvedValue({ success: true }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    moduleRef = await Test.createTestingModule({
      providers: [
        NotificationTriggersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EmailService, useValue: mockEmailService },
        { provide: SmsService, useValue: mockSmsService },
      ],
    }).compile();

    service = moduleRef.get(NotificationTriggersService);
  });

  afterEach(async () => {
    await moduleRef?.close();
  });

  describe("matchesConditions", () => {
    const matchesConditions = (conditions: Record<string, unknown>, payload: TriggerPayload) => {
      return service.matchesConditions(conditions, payload);
    };

    describe("simple equality", () => {
      it("should match when payload value equals condition", () => {
        const conditions = { guestName: "John Doe" };
        const payload: TriggerPayload = { campgroundId: "cg-1", guestName: "John Doe" };
        expect(matchesConditions(conditions, payload)).toBe(true);
      });

      it("should not match when payload value differs", () => {
        const conditions = { guestName: "John Doe" };
        const payload: TriggerPayload = { campgroundId: "cg-1", guestName: "Jane Doe" };
        expect(matchesConditions(conditions, payload)).toBe(false);
      });

      it("should match multiple conditions", () => {
        const conditions = { guestName: "John Doe", siteNumber: "A1" };
        const payload: TriggerPayload = {
          campgroundId: "cg-1",
          guestName: "John Doe",
          siteNumber: "A1",
        };
        expect(matchesConditions(conditions, payload)).toBe(true);
      });

      it("should fail if any condition does not match", () => {
        const conditions = { guestName: "John Doe", siteNumber: "A1" };
        const payload: TriggerPayload = {
          campgroundId: "cg-1",
          guestName: "John Doe",
          siteNumber: "B2",
        };
        expect(matchesConditions(conditions, payload)).toBe(false);
      });
    });

    describe("operator conditions", () => {
      it("should match gt (greater than)", () => {
        const conditions = { amountCents: { gt: 10000 } };
        const payload: TriggerPayload = { campgroundId: "cg-1", amountCents: 15000 };
        expect(matchesConditions(conditions, payload)).toBe(true);
      });

      it("should not match gt when equal", () => {
        const conditions = { amountCents: { gt: 10000 } };
        const payload: TriggerPayload = { campgroundId: "cg-1", amountCents: 10000 };
        expect(matchesConditions(conditions, payload)).toBe(false);
      });

      it("should match lt (less than)", () => {
        const conditions = { amountCents: { lt: 10000 } };
        const payload: TriggerPayload = { campgroundId: "cg-1", amountCents: 5000 };
        expect(matchesConditions(conditions, payload)).toBe(true);
      });

      it("should match eq (equals)", () => {
        const conditions = { amountCents: { eq: 10000 } };
        const payload: TriggerPayload = { campgroundId: "cg-1", amountCents: 10000 };
        expect(matchesConditions(conditions, payload)).toBe(true);
      });

      it("should match in (array membership)", () => {
        const conditions = { siteNumber: { in: ["A1", "A2", "A3"] } };
        const payload: TriggerPayload = { campgroundId: "cg-1", siteNumber: "A2" };
        expect(matchesConditions(conditions, payload)).toBe(true);
      });

      it("should not match in when value not in array", () => {
        const conditions = { siteNumber: { in: ["A1", "A2", "A3"] } };
        const payload: TriggerPayload = { campgroundId: "cg-1", siteNumber: "B1" };
        expect(matchesConditions(conditions, payload)).toBe(false);
      });

      it("should match combined operators", () => {
        const conditions = { amountCents: { gt: 5000, lt: 20000 } };
        const payload: TriggerPayload = { campgroundId: "cg-1", amountCents: 10000 };
        expect(matchesConditions(conditions, payload)).toBe(true);
      });

      it("should not match when one operator fails", () => {
        const conditions = { amountCents: { gt: 5000, lt: 8000 } };
        const payload: TriggerPayload = { campgroundId: "cg-1", amountCents: 10000 };
        expect(matchesConditions(conditions, payload)).toBe(false);
      });
    });

    describe("customData access", () => {
      it("should check customData when property not in payload", () => {
        const conditions = { vipLevel: "gold" };
        const payload: TriggerPayload = {
          campgroundId: "cg-1",
          customData: { vipLevel: "gold" },
        };
        expect(matchesConditions(conditions, payload)).toBe(true);
      });

      it("should prefer payload property over customData", () => {
        const conditions = { guestName: "John" };
        const payload: TriggerPayload = {
          campgroundId: "cg-1",
          guestName: "John", // Direct property
          customData: { guestName: "Jane" }, // Should be ignored
        };
        expect(matchesConditions(conditions, payload)).toBe(true);
      });
    });

    describe("edge cases", () => {
      it("should return true for empty conditions", () => {
        const conditions = {};
        const payload: TriggerPayload = { campgroundId: "cg-1", guestName: "John" };
        expect(matchesConditions(conditions, payload)).toBe(true);
      });

      it("should handle undefined payload values", () => {
        const conditions = { guestName: undefined };
        const payload: TriggerPayload = { campgroundId: "cg-1" };
        expect(matchesConditions(conditions, payload)).toBe(true);
      });

      it("should handle null condition values", () => {
        // Null condition value requires payload to be null/undefined as well
        const conditions = { guestName: null };
        const payload: TriggerPayload = { campgroundId: "cg-1" };
        // guestName is undefined in payload, which !== null
        expect(matchesConditions(conditions, payload)).toBe(false);

        // When payload has null, it should match
        const payloadWithNull: TriggerPayload = { campgroundId: "cg-1", guestName: undefined };
        expect(
          matchesConditions(conditions, { campgroundId: "cg-1", customData: { guestName: null } }),
        ).toBe(true);
      });
    });
  });

  describe("interpolate", () => {
    const interpolate = (
      template: string,
      payload: TriggerPayload,
      campground?: { name: string } | null,
    ) => {
      return service.interpolate(template, payload, campground);
    };

    it("should replace guest_name placeholder", () => {
      const result = interpolate("Hello {{guest_name}}!", {
        campgroundId: "cg-1",
        guestName: "John",
      });
      expect(result).toBe("Hello John!");
    });

    it('should use default "Guest" when name not provided', () => {
      const result = interpolate("Hello {{guest_name}}!", { campgroundId: "cg-1" });
      expect(result).toBe("Hello Guest!");
    });

    it("should replace campground_name placeholder", () => {
      const result = interpolate(
        "Welcome to {{campground_name}}!",
        { campgroundId: "cg-1" },
        { name: "Happy Camper RV" },
      );
      expect(result).toBe("Welcome to Happy Camper RV!");
    });

    it("should replace site_number placeholder", () => {
      const result = interpolate("Your site is {{site_number}}", {
        campgroundId: "cg-1",
        siteNumber: "A15",
      });
      expect(result).toBe("Your site is A15");
    });

    it("should replace date placeholders", () => {
      const arrival = new Date("2024-06-15T12:00:00"); // Use noon to avoid timezone issues
      const departure = new Date("2024-06-20T12:00:00");
      const result = interpolate("Check-in: {{arrival_date}}, Check-out: {{departure_date}}", {
        campgroundId: "cg-1",
        arrivalDate: arrival,
        departureDate: departure,
      });
      // Date formatting varies by locale, just verify dates are interpolated
      expect(result).not.toContain("{{arrival_date}}");
      expect(result).not.toContain("{{departure_date}}");
      expect(result).toContain("Check-in:");
      expect(result).toContain("Check-out:");
    });

    it("should format amount as currency", () => {
      const result = interpolate("Amount due: {{amount}}", {
        campgroundId: "cg-1",
        amountCents: 15000,
      });
      expect(result).toBe("Amount due: $150.00");
    });

    it("should replace reservation_id placeholder", () => {
      const result = interpolate("Confirmation #{{reservation_id}}", {
        campgroundId: "cg-1",
        reservationId: "RES-123",
      });
      expect(result).toBe("Confirmation #RES-123");
    });

    it("should handle multiple placeholders", () => {
      const result = interpolate(
        "Dear {{guest_name}}, your reservation {{reservation_id}} at {{campground_name}} is confirmed for {{site_number}}.",
        {
          campgroundId: "cg-1",
          guestName: "John",
          reservationId: "RES-456",
          siteNumber: "B10",
        },
        { name: "Pine Forest Camp" },
      );
      expect(result).toBe(
        "Dear John, your reservation RES-456 at Pine Forest Camp is confirmed for B10.",
      );
    });

    it("should handle missing placeholders gracefully", () => {
      const result = interpolate("Site: {{site_number}}, Amount: {{amount}}", {
        campgroundId: "cg-1",
      });
      expect(result).toBe("Site: , Amount: ");
    });
  });

  describe("stripHtml", () => {
    const stripHtml = (html: string) => {
      return service.stripHtml(html);
    };

    it("should remove HTML tags", () => {
      expect(stripHtml("<p>Hello World</p>")).toBe("Hello World");
      // Adjacent tags without whitespace results in concatenated text
      expect(stripHtml("<h1>Title</h1><p>Content</p>")).toBe("TitleContent");
    });

    it("should collapse whitespace", () => {
      expect(stripHtml("<p>Hello    World</p>")).toBe("Hello World");
      expect(stripHtml("<p>Hello\n\nWorld</p>")).toBe("Hello World");
    });

    it("should trim result", () => {
      expect(stripHtml("  <p>Hello</p>  ")).toBe("Hello");
    });

    it("should handle complex HTML", () => {
      const html = `
        <div>
          <h1>Welcome!</h1>
          <p>Your reservation is <strong>confirmed</strong>.</p>
        </div>
      `;
      const result = stripHtml(html);
      expect(result).toContain("Welcome!");
      expect(result).toContain("Your reservation is");
      expect(result).toContain("confirmed");
    });

    it("should handle empty string", () => {
      expect(stripHtml("")).toBe("");
    });
  });

  describe("getDefaultSubject", () => {
    const getDefaultSubject = (event: string, campgroundName?: string) => {
      return service.getDefaultSubject(event, campgroundName);
    };

    it("should return appropriate subject for reservation_created", () => {
      const subject = getDefaultSubject("reservation_created", "Happy Camp");
      expect(subject).toContain("Reservation");
      expect(subject).toContain("Happy Camp");
    });

    it("should return appropriate subject for checkin_reminder", () => {
      const subject = getDefaultSubject("checkin_reminder", "Pine Resort");
      expect(subject).toContain("Check-in");
    });

    it("should return appropriate subject for payment_failed", () => {
      const subject = getDefaultSubject("payment_failed", "RV Park");
      expect(subject).toContain("Payment");
      expect(subject).toContain("Action Required");
    });

    it("should use default campground name when not provided", () => {
      const subject = getDefaultSubject("reservation_created");
      expect(subject).toContain("our campground");
    });

    it("should handle unknown events", () => {
      const subject = getDefaultSubject("unknown_event", "Camp");
      expect(subject).toContain("Update from Camp");
    });
  });

  describe("fire", () => {
    it("should return 0 fired when no triggers configured", async () => {
      mockPrisma.notificationTrigger.findMany.mockResolvedValue([]);

      const result = await service.fire("reservation_created", { campgroundId: "cg-1" });

      expect(result.fired).toBe(0);
    });

    it("should fire trigger and send email immediately when delay is 0", async () => {
      mockPrisma.notificationTrigger.findMany.mockResolvedValue([
        {
          id: "trigger-1",
          event: "reservation_created",
          channel: "email",
          enabled: true,
          delayMinutes: 0,
          conditions: null,
          CampaignTemplate: null,
        },
      ]);
      mockPrisma.campground.findUnique.mockResolvedValue({ name: "Test Camp" });

      const result = await service.fire("reservation_created", {
        campgroundId: "cg-1",
        guestEmail: "guest@example.com",
        guestName: "John",
      });

      expect(result.fired).toBe(1);
      expect(mockEmailService.sendEmail).toHaveBeenCalled();
    });

    it("should schedule notification when delay > 0", async () => {
      mockPrisma.notificationTrigger.findMany.mockResolvedValue([
        {
          id: "trigger-1",
          event: "checkin_reminder",
          channel: "email",
          enabled: true,
          delayMinutes: 60, // 1 hour delay
          conditions: null,
          CampaignTemplate: null,
        },
      ]);

      const result = await service.fire("checkin_reminder", {
        campgroundId: "cg-1",
        guestEmail: "guest@example.com",
      });

      expect(result.fired).toBe(1);
      expect(mockPrisma.scheduledNotification.create).toHaveBeenCalled();
      expect(mockEmailService.sendEmail).not.toHaveBeenCalled();
    });

    it("should skip trigger when conditions do not match", async () => {
      mockPrisma.notificationTrigger.findMany.mockResolvedValue([
        {
          id: "trigger-1",
          event: "payment_received",
          channel: "email",
          enabled: true,
          delayMinutes: 0,
          conditions: { amountCents: { gt: 50000 } }, // Only for payments > $500
          CampaignTemplate: null,
        },
      ]);

      const result = await service.fire("payment_received", {
        campgroundId: "cg-1",
        amountCents: 10000, // $100 - doesn't meet condition
        guestEmail: "guest@example.com",
      });

      expect(result.fired).toBe(0);
    });

    it("should fire trigger when conditions match", async () => {
      mockPrisma.notificationTrigger.findMany.mockResolvedValue([
        {
          id: "trigger-1",
          event: "payment_received",
          channel: "email",
          enabled: true,
          delayMinutes: 0,
          conditions: { amountCents: { gt: 5000 } },
          CampaignTemplate: null,
        },
      ]);
      mockPrisma.campground.findUnique.mockResolvedValue({ name: "Test Camp" });

      const result = await service.fire("payment_received", {
        campgroundId: "cg-1",
        amountCents: 10000,
        guestEmail: "guest@example.com",
      });

      expect(result.fired).toBe(1);
    });

    it("should send SMS when channel is sms and phone provided", async () => {
      mockPrisma.notificationTrigger.findMany.mockResolvedValue([
        {
          id: "trigger-1",
          event: "checkin_reminder",
          channel: "sms",
          enabled: true,
          delayMinutes: 0,
          conditions: null,
          CampaignTemplate: null,
        },
      ]);
      mockPrisma.campground.findUnique.mockResolvedValue({ name: "Test Camp" });

      await service.fire("checkin_reminder", {
        campgroundId: "cg-1",
        guestEmail: "guest@example.com",
        customData: { phone: "+15551234567" },
      });

      expect(mockSmsService.sendSms).toHaveBeenCalled();
    });

    it("should send both email and SMS when channel is both", async () => {
      mockPrisma.notificationTrigger.findMany.mockResolvedValue([
        {
          id: "trigger-1",
          event: "reservation_created",
          channel: "both",
          enabled: true,
          delayMinutes: 0,
          conditions: null,
          CampaignTemplate: null,
        },
      ]);
      mockPrisma.campground.findUnique.mockResolvedValue({ name: "Test Camp" });

      await service.fire("reservation_created", {
        campgroundId: "cg-1",
        guestEmail: "guest@example.com",
        customData: { phone: "+15551234567" },
      });

      expect(mockEmailService.sendEmail).toHaveBeenCalled();
      expect(mockSmsService.sendSms).toHaveBeenCalled();
    });
  });

  describe("CRUD operations", () => {
    it("should create trigger with defaults", async () => {
      mockPrisma.notificationTrigger.create.mockResolvedValue({
        id: "trigger-1",
        event: "reservation_created",
        channel: "email",
        enabled: true,
        delayMinutes: 0,
      });

      await service.create("cg-1", {
        event: "reservation_created",
        channel: "email",
      });

      expect(mockPrisma.notificationTrigger.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          campgroundId: "cg-1",
          event: "reservation_created",
          channel: "email",
          enabled: true,
          templateId: null,
          delayMinutes: 0,
        }),
      });
    });

    it("should create trigger with custom options", async () => {
      mockPrisma.notificationTrigger.create.mockResolvedValue({ id: "trigger-1" });

      await service.create("cg-1", {
        event: "payment_received",
        channel: "both",
        enabled: false,
        templateId: "template-1",
        delayMinutes: 30,
        conditions: { amountCents: { gt: 10000 } },
      });

      expect(mockPrisma.notificationTrigger.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          enabled: false,
          templateId: "template-1",
          delayMinutes: 30,
        }),
      });
    });

    it("should update trigger", async () => {
      mockPrisma.notificationTrigger.findUnique.mockResolvedValue({
        id: "trigger-1",
        campgroundId: "cg-1",
      });
      mockPrisma.notificationTrigger.update.mockResolvedValue({ id: "trigger-1" });

      await service.update("trigger-1", { enabled: false, delayMinutes: 60 }, "cg-1");

      expect(mockPrisma.notificationTrigger.update).toHaveBeenCalledWith({
        where: { id: "trigger-1" },
        data: expect.objectContaining({
          enabled: false,
          delayMinutes: 60,
        }),
      });
    });

    it("should delete trigger", async () => {
      mockPrisma.notificationTrigger.findUnique.mockResolvedValue({
        id: "trigger-1",
        campgroundId: "cg-1",
      });
      mockPrisma.notificationTrigger.delete.mockResolvedValue({ id: "trigger-1" });

      await service.delete("trigger-1", "cg-1");

      expect(mockPrisma.notificationTrigger.delete).toHaveBeenCalledWith({
        where: { id: "trigger-1" },
      });
    });

    it("should list triggers for campground", async () => {
      mockPrisma.notificationTrigger.findMany.mockResolvedValue([
        { id: "trigger-1", event: "reservation_created" },
        { id: "trigger-2", event: "checkin_reminder" },
      ]);

      const result = await service.list("cg-1");

      expect(result).toHaveLength(2);
      expect(mockPrisma.notificationTrigger.findMany).toHaveBeenCalledWith({
        where: { campgroundId: "cg-1" },
        orderBy: [{ event: "asc" }, { createdAt: "desc" }],
        include: { CampaignTemplate: true },
      });
    });
  });
});
