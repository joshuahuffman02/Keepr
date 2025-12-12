// @ts-nocheck
import * as request from "supertest";
import { Test } from "@nestjs/testing";
import { ValidationPipe } from "@nestjs/common";
import { CommunicationsController } from "../communications/communications.controller";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { SmsService } from "../sms/sms.service";
import { NpsService } from "../nps/nps.service";
import { ObservabilityService } from "../observability/observability.service";
import { AlertingService } from "../observability/alerting.service";
import { JwtAuthGuard } from "../auth/guards";
import { RolesGuard } from "../auth/guards/roles.guard";
import { ScopeGuard } from "../permissions/scope.guard";

describe("Communications consent, quiet hours, and alerts", () => {
  let app: any;
  let prisma: any;
  let email: any;
  let sms: any;
  let observability: any;
  let alerting: any;

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date("2025-01-01T05:00:00.000Z")); // 00:00 EST

    prisma = {
      communication: {
        create: jest.fn().mockImplementation(async (data) => ({ id: "comm-1", ...data })),
        update: jest.fn().mockImplementation(async (_opts) => ({ id: "comm-1", status: "sent" })),
        updateMany: jest.fn().mockResolvedValue({})
      },
      privacySetting: { findUnique: jest.fn().mockResolvedValue({ consentRequired: true }) },
      consentLog: { findFirst: jest.fn().mockResolvedValue(null) },
      campground: {
        findUnique: jest.fn().mockResolvedValue({
          id: "cg-1",
          quietHoursStart: "21:00",
          quietHoursEnd: "07:00",
          timezone: "America/New_York",
          parkTimeZone: "America/New_York"
        })
      },
      communicationTemplate: { findUnique: jest.fn() }
    };

    email = { sendEmail: jest.fn().mockResolvedValue({ provider: "postmark", providerMessageId: "pm-1" }) };
    sms = { sendSms: jest.fn().mockResolvedValue({ success: true, provider: "twilio", providerMessageId: "tw-1" }) };
    observability = { recordCommsStatus: jest.fn() };
    alerting = { dispatch: jest.fn().mockResolvedValue({ ok: true }) };

    const moduleRef = await Test.createTestingModule({
      controllers: [CommunicationsController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: email },
        { provide: SmsService, useValue: sms },
        { provide: NpsService, useValue: {} },
        { provide: ObservabilityService, useValue: observability },
        { provide: AlertingService, useValue: alerting }
      ]
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ScopeGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterEach(async () => {
    jest.useRealTimers();
    await app.close();
  });

  it("rejects outbound email when consent is missing", async () => {
    prisma.communicationTemplate.findUnique.mockResolvedValueOnce({
      id: "tpl-1",
      campgroundId: "cg-1",
      status: "approved",
      subject: "Hello",
      bodyHtml: "<p>Body</p>"
    });
    const api = request(app.getHttpServer());
    const res = await api
      .post("/api/communications/send")
      .send({
        campgroundId: "cg-1",
        type: "email",
        direction: "outbound",
        toAddress: "guest@example.com",
        subject: "Hello",
        body: "Body",
        templateId: "tpl-1"
      })
      .expect(400);

    expect(res.body.message).toMatch(/Consent required/i);
    expect(prisma.communication.create).not.toHaveBeenCalled();
  });

  it("requires consent log even if consentGranted flag is passed", async () => {
    prisma.campground.findUnique.mockResolvedValueOnce({
      id: "cg-1",
      quietHoursStart: null,
      quietHoursEnd: null,
      timezone: "America/New_York",
      parkTimeZone: "America/New_York"
    });
    prisma.communicationTemplate.findUnique.mockResolvedValueOnce({
      id: "tpl-1",
      campgroundId: "cg-1",
      status: "approved",
      subject: "Hello",
      bodyHtml: "<p>Body</p>"
    });

    const api = request(app.getHttpServer());
    const res = await api
      .post("/api/communications/send")
      .send({
        campgroundId: "cg-1",
        type: "email",
        direction: "outbound",
        toAddress: "guest@example.com",
        subject: "Hello",
        body: "Body",
        consentGranted: true,
        templateId: "tpl-1"
      })
      .expect(400);

    expect(res.body.message).toMatch(/Consent required/i);
    expect(prisma.communication.create).not.toHaveBeenCalled();
  });

  it("succeeds when consent log exists and template is approved", async () => {
    prisma.campground.findUnique.mockResolvedValueOnce({
      id: "cg-1",
      quietHoursStart: null,
      quietHoursEnd: null,
      timezone: "America/New_York",
      parkTimeZone: "America/New_York"
    });
    prisma.consentLog.findFirst.mockResolvedValueOnce({ grantedAt: new Date().toISOString(), consentType: "email" });
    prisma.communicationTemplate.findUnique.mockResolvedValueOnce({
      id: "tpl-1",
      campgroundId: "cg-1",
      status: "approved",
      subject: "Approved",
      bodyHtml: "<p>Hello</p>"
    });

    const api = request(app.getHttpServer());
    const res = await api
      .post("/api/communications/send")
      .send({
        campgroundId: "cg-1",
        type: "email",
        direction: "outbound",
        toAddress: "guest@example.com",
        subject: "Hello",
        body: "Body",
        templateId: "tpl-1"
      })
      .expect(201);

    expect(res.body.status).toBe("sent");
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
      bodyHtml: "Body"
    });
    prisma.consentLog.findFirst.mockResolvedValueOnce({ grantedAt: new Date().toISOString(), consentType: "email" });
    const api = request(app.getHttpServer());
    await api
      .post("/api/communications/send")
      .send({
        campgroundId: "cg-1",
        type: "email",
        direction: "outbound",
        toAddress: "guest@example.com",
        subject: "Quiet",
        body: "Body",
        templateId: "tpl-quiet"
      })
      .expect(400);
  });

  it("rejects unapproved templates", async () => {
    jest.setSystemTime(new Date("2025-01-01T15:00:00.000Z")); // outside quiet hours
    prisma.communicationTemplate.findUnique.mockResolvedValue({
      id: "tpl-1",
      campgroundId: "cg-1",
      status: "draft"
    });
    prisma.campground.findUnique.mockResolvedValue({
      id: "cg-1",
      quietHoursStart: "21:00",
      quietHoursEnd: "07:00",
      timezone: "America/New_York",
      parkTimeZone: "America/New_York"
    });

    const api = request(app.getHttpServer());
    const res = await api
      .post("/api/communications/send")
      .send({
        campgroundId: "cg-1",
        type: "email",
        direction: "outbound",
        toAddress: "guest@example.com",
        subject: "Hello",
        body: "Body",
        templateId: "tpl-1"
      })
      .expect(400);

    expect(res.body.message).toMatch(/Template not approved/i);
  });

  it("rejects raw email without template by default", async () => {
    prisma.campground.findUnique.mockResolvedValueOnce({
      id: "cg-1",
      quietHoursStart: null,
      quietHoursEnd: null,
      timezone: "America/New_York",
      parkTimeZone: "America/New_York"
    });
    prisma.consentLog.findFirst.mockResolvedValueOnce({ grantedAt: new Date().toISOString(), consentType: "email" });

    const api = request(app.getHttpServer());
    const res = await api
      .post("/api/communications/send")
      .send({
        campgroundId: "cg-1",
        type: "email",
        direction: "outbound",
        toAddress: "guest@example.com",
        subject: "Hello",
        body: "Body"
      })
      .expect(400);

    expect(res.body.message).toMatch(/Template is required/i);
  });

  it("dispatches alerts when SMS fails", async () => {
    prisma.consentLog.findFirst.mockResolvedValueOnce({ grantedAt: new Date().toISOString(), consentType: "sms" });
    prisma.campground.findUnique.mockResolvedValueOnce({
      id: "cg-1",
      quietHoursStart: null,
      quietHoursEnd: null,
      timezone: "America/New_York",
      parkTimeZone: "America/New_York"
    });
    prisma.communicationTemplate.findUnique.mockResolvedValueOnce({
      id: "tpl-2",
      campgroundId: "cg-1",
      status: "approved",
      subject: "Hi",
      bodyHtml: "Hi"
    });
    sms.sendSms.mockResolvedValueOnce({ success: false, provider: "twilio", fallback: "send_failed" });

    const api = request(app.getHttpServer());
    await api
      .post("/api/communications/send")
      .send({
        campgroundId: "cg-1",
        type: "sms",
        direction: "outbound",
        toPhone: "5551234567",
        body: "Hi",
        templateId: "tpl-2"
      })
      .expect(500);

    expect(alerting.dispatch).toHaveBeenCalled();
  });

  it("sends alerts on bounce events", async () => {
    const api = request(app.getHttpServer());
    await api
      .post("/api/communications/webhook/postmark/status")
      .send({
        MessageID: "msg-1",
        RecordType: "Bounce",
        BounceType: "HardBounce",
        Description: "Mailbox not found"
      })
      .expect(200);

    expect(prisma.communication.updateMany).toHaveBeenCalled();
    expect(alerting.dispatch).toHaveBeenCalledWith(
      expect.stringContaining("Email bounced"),
      expect.any(String),
      "warning",
      expect.stringContaining("postmark-bounce-msg-1"),
      expect.objectContaining({ bounceType: "HardBounce" })
    );
  });
});

