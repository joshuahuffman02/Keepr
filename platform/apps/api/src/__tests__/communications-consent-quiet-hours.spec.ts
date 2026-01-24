import { Test, TestingModule } from "@nestjs/testing";
import { Reflector } from "@nestjs/core";
import { CommunicationsController } from "../communications/communications.controller";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { SmsService } from "../sms/sms.service";
import { NpsService } from "../nps/nps.service";
import { ObservabilityService } from "../observability/observability.service";
import { AlertingService } from "../observability/alerting.service";
import { AiAutoReplyService } from "../ai/ai-auto-reply.service";
import { AiSentimentService } from "../ai/ai-sentiment.service";
import { PermissionsService } from "../permissions/permissions.service";

type PrismaMock = {
  communication: { create: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
  privacySetting: { findUnique: jest.Mock };
  consentLog: { findFirst: jest.Mock };
  campground: { findUnique: jest.Mock };
  communicationTemplate: { findUnique: jest.Mock };
};

type EmailMock = { sendEmail: jest.Mock };
type SmsMock = { sendSms: jest.Mock };
type ObservabilityMock = { recordCommsStatus: jest.Mock };
type AlertingMock = { dispatch: jest.Mock };

describe("Communications consent, quiet hours, and alerts", () => {
  jest.setTimeout(30000); // Increase timeout for Nest.js test module setup

  let controller: CommunicationsController;
  let prisma: PrismaMock;
  let email: EmailMock;
  let sms: SmsMock;
  let observability: ObservabilityMock;
  let alerting: AlertingMock;
  let moduleRef: TestingModule | undefined;
  let previousSenderDomains: string | undefined;
  let previousVerifiedDomains: string | undefined;

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date("2025-01-01T05:00:00.000Z")); // 00:00 EST
    previousSenderDomains = process.env.EMAIL_SENDER_DOMAINS;
    previousVerifiedDomains = process.env.EMAIL_VERIFIED_DOMAINS;
    process.env.EMAIL_SENDER_DOMAINS = "keeprstay.com";
    process.env.EMAIL_VERIFIED_DOMAINS = "";

    prisma = {
      communication: {
        create: jest.fn().mockImplementation(async (data) => ({ id: "comm-1", ...data })),
        update: jest.fn().mockImplementation(async (_opts) => ({ id: "comm-1", status: "sent" })),
        updateMany: jest.fn().mockResolvedValue({}),
      },
      privacySetting: { findUnique: jest.fn().mockResolvedValue({ consentRequired: true }) },
      consentLog: { findFirst: jest.fn().mockResolvedValue(null) },
      campground: {
        findUnique: jest.fn().mockResolvedValue({
          id: "cg-1",
          quietHoursStart: "21:00",
          quietHoursEnd: "07:00",
          timezone: "America/New_York",
          parkTimeZone: "America/New_York",
        }),
      },
      communicationTemplate: { findUnique: jest.fn() },
    };

    email = {
      sendEmail: jest.fn().mockResolvedValue({ provider: "postmark", providerMessageId: "pm-1" }),
    };
    sms = {
      sendSms: jest
        .fn()
        .mockResolvedValue({ success: true, provider: "twilio", providerMessageId: "tw-1" }),
    };
    observability = { recordCommsStatus: jest.fn() };
    alerting = { dispatch: jest.fn().mockResolvedValue({ ok: true }) };

    moduleRef = await Test.createTestingModule({
      controllers: [CommunicationsController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: email },
        { provide: SmsService, useValue: sms },
        { provide: NpsService, useValue: {} },
        { provide: ObservabilityService, useValue: observability },
        { provide: AlertingService, useValue: alerting },
        { provide: AiAutoReplyService, useValue: { processInboundMessage: jest.fn() } },
        { provide: AiSentimentService, useValue: { analyzeCommunication: jest.fn() } },
        { provide: Reflector, useValue: new Reflector() },
        {
          provide: PermissionsService,
          useValue: {
            isPlatformStaff: () => false,
            checkAccess: async () => ({ allowed: true }),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(CommunicationsController);
  });

  afterEach(async () => {
    jest.useRealTimers();
    if (moduleRef) {
      await moduleRef.close();
    }
    if (previousSenderDomains === undefined) {
      delete process.env.EMAIL_SENDER_DOMAINS;
    } else {
      process.env.EMAIL_SENDER_DOMAINS = previousSenderDomains;
    }
    if (previousVerifiedDomains === undefined) {
      delete process.env.EMAIL_VERIFIED_DOMAINS;
    } else {
      process.env.EMAIL_VERIFIED_DOMAINS = previousVerifiedDomains;
    }
  });

  it("rejects outbound email when consent is missing", async () => {
    prisma.communicationTemplate.findUnique.mockResolvedValueOnce({
      id: "tpl-1",
      campgroundId: "cg-1",
      status: "approved",
      subject: "Hello",
      bodyHtml: "<p>Body</p>",
    });
    await expect(
      controller.send({
        campgroundId: "cg-1",
        type: "email",
        direction: "outbound",
        toAddress: "guest@example.com",
        subject: "Hello",
        body: "Body",
        templateId: "tpl-1",
      }),
    ).rejects.toThrow(/Consent required/i);
    expect(prisma.communication.create).not.toHaveBeenCalled();
  });

  it("requires consent log even if consentGranted flag is passed", async () => {
    prisma.campground.findUnique.mockResolvedValueOnce({
      id: "cg-1",
      quietHoursStart: null,
      quietHoursEnd: null,
      timezone: "America/New_York",
      parkTimeZone: "America/New_York",
    });
    prisma.communicationTemplate.findUnique.mockResolvedValueOnce({
      id: "tpl-1",
      campgroundId: "cg-1",
      status: "approved",
      subject: "Hello",
      bodyHtml: "<p>Body</p>",
    });

    await expect(
      controller.send({
        campgroundId: "cg-1",
        type: "email",
        direction: "outbound",
        toAddress: "guest@example.com",
        subject: "Hello",
        body: "Body",
        consentGranted: true,
        templateId: "tpl-1",
      }),
    ).rejects.toThrow(/Consent required/i);
    expect(prisma.communication.create).not.toHaveBeenCalled();
  });

  it("succeeds when consent log exists and template is approved", async () => {
    prisma.campground.findUnique.mockResolvedValueOnce({
      id: "cg-1",
      quietHoursStart: null,
      quietHoursEnd: null,
      timezone: "America/New_York",
      parkTimeZone: "America/New_York",
    });
    prisma.consentLog.findFirst.mockResolvedValueOnce({
      grantedAt: new Date().toISOString(),
      consentType: "email",
    });
    prisma.communicationTemplate.findUnique.mockResolvedValueOnce({
      id: "tpl-1",
      campgroundId: "cg-1",
      status: "approved",
      subject: "Approved",
      bodyHtml: "<p>Hello</p>",
    });

    const res = await controller.send({
      campgroundId: "cg-1",
      type: "email",
      direction: "outbound",
      toAddress: "guest@example.com",
      subject: "Hello",
      body: "Body",
      templateId: "tpl-1",
    });

    expect(res.status).toBe("sent");
    expect(prisma.communication.create).toHaveBeenCalled();
    const metadata = prisma.communication.create.mock.calls[0][0].data.metadata;
    expect(metadata.consentSource).toBe("consent_log");
  });

  it("blocks sends during quiet hours unless overridden", async () => {
    prisma.communicationTemplate.findUnique.mockResolvedValueOnce({
      id: "tpl-quiet",
      campgroundId: "cg-1",
      status: "approved",
      subject: "Quiet",
      bodyHtml: "Body",
    });
    prisma.consentLog.findFirst.mockResolvedValueOnce({
      grantedAt: new Date().toISOString(),
      consentType: "email",
    });
    await expect(
      controller.send({
        campgroundId: "cg-1",
        type: "email",
        direction: "outbound",
        toAddress: "guest@example.com",
        subject: "Quiet",
        body: "Body",
        templateId: "tpl-quiet",
      }),
    ).rejects.toThrow(/Quiet hours/i);
  });

  it("rejects unapproved templates", async () => {
    jest.setSystemTime(new Date("2025-01-01T15:00:00.000Z")); // outside quiet hours
    prisma.communicationTemplate.findUnique.mockResolvedValue({
      id: "tpl-1",
      campgroundId: "cg-1",
      status: "draft",
    });
    prisma.campground.findUnique.mockResolvedValue({
      id: "cg-1",
      quietHoursStart: "21:00",
      quietHoursEnd: "07:00",
      timezone: "America/New_York",
      parkTimeZone: "America/New_York",
    });

    await expect(
      controller.send({
        campgroundId: "cg-1",
        type: "email",
        direction: "outbound",
        toAddress: "guest@example.com",
        subject: "Hello",
        body: "Body",
        templateId: "tpl-1",
      }),
    ).rejects.toThrow(/Template not approved/i);
  });

  it("rejects raw email without template by default", async () => {
    prisma.campground.findUnique.mockResolvedValueOnce({
      id: "cg-1",
      quietHoursStart: null,
      quietHoursEnd: null,
      timezone: "America/New_York",
      parkTimeZone: "America/New_York",
    });
    prisma.consentLog.findFirst.mockResolvedValueOnce({
      grantedAt: new Date().toISOString(),
      consentType: "email",
    });

    await expect(
      controller.send({
        campgroundId: "cg-1",
        type: "email",
        direction: "outbound",
        toAddress: "guest@example.com",
        subject: "Hello",
        body: "Body",
      }),
    ).rejects.toThrow(/Template is required/i);
  });

  it("dispatches alerts when SMS fails", async () => {
    prisma.consentLog.findFirst.mockResolvedValueOnce({
      grantedAt: new Date().toISOString(),
      consentType: "sms",
    });
    prisma.campground.findUnique.mockResolvedValueOnce({
      id: "cg-1",
      quietHoursStart: null,
      quietHoursEnd: null,
      timezone: "America/New_York",
      parkTimeZone: "America/New_York",
    });
    prisma.communicationTemplate.findUnique.mockResolvedValueOnce({
      id: "tpl-2",
      campgroundId: "cg-1",
      status: "approved",
      subject: "Hi",
      bodyHtml: "Hi",
    });
    sms.sendSms.mockResolvedValueOnce({
      success: false,
      provider: "twilio",
      fallback: "send_failed",
    });

    await expect(
      controller.send({
        campgroundId: "cg-1",
        type: "sms",
        direction: "outbound",
        toPhone: "5551234567",
        body: "Hi",
        templateId: "tpl-2",
      }),
    ).rejects.toThrow(/Failed to send sms/i);

    expect(alerting.dispatch).toHaveBeenCalled();
  });

  it("sends alerts on bounce events", async () => {
    await controller.postmarkStatus({
      MessageID: "msg-1",
      RecordType: "Bounce",
      BounceType: "HardBounce",
      Description: "Mailbox not found",
    });

    expect(prisma.communication.updateMany).toHaveBeenCalled();
    expect(alerting.dispatch).toHaveBeenCalledWith(
      expect.stringContaining("Email bounced"),
      expect.any(String),
      "warning",
      expect.stringContaining("postmark-bounce-msg-1"),
      expect.objectContaining({ bounceType: "HardBounce" }),
    );
  });
});
