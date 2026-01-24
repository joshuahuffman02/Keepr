import { Test, type TestingModule } from "@nestjs/testing";
import { CommunicationsController } from "../src/communications/communications.controller";
import { PrismaService } from "../src/prisma/prisma.service";
import { EmailService } from "../src/email/email.service";
import { SmsService } from "../src/sms/sms.service";
import { NpsService } from "../src/nps/nps.service";
import { ObservabilityService } from "../src/observability/observability.service";
import { AlertingService } from "../src/observability/alerting.service";
import { AiAutoReplyService } from "../src/ai/ai-auto-reply.service";
import { AiSentimentService } from "../src/ai/ai-sentiment.service";

type PrismaMock = {
  communicationTemplate: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  communicationPlaybook: {
    findUnique: jest.Mock;
  };
  communicationPlaybookJob: {
    update: jest.Mock;
  };
  reservation: {
    findUnique: jest.Mock;
  };
  guest: {
    findUnique: jest.Mock;
  };
};

const getPrivateMethod = (target: object, key: string): Function => {
  const value = Reflect.get(target, key);
  if (typeof value !== "function") {
    throw new Error(`Expected ${key} to be a function`);
  }
  return value;
};

describe("Communications smoke (approvals & playbooks)", () => {
  const emailService = { sendEmail: jest.fn() };
  const smsService = { sendSms: jest.fn() };
  let controller: CommunicationsController;
  let prisma: PrismaMock;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma = {
      communicationTemplate: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      communicationPlaybook: {
        findUnique: jest.fn(),
      },
      communicationPlaybookJob: {
        update: jest.fn(),
      },
      reservation: {
        findUnique: jest.fn(),
      },
      guest: {
        findUnique: jest.fn(),
      },
    };

    moduleRef = await Test.createTestingModule({
      controllers: [CommunicationsController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: emailService },
        { provide: SmsService, useValue: smsService },
        { provide: NpsService, useValue: { scheduleNps: jest.fn() } },
        { provide: ObservabilityService, useValue: { recordCommsOutcome: jest.fn() } },
        { provide: AlertingService, useValue: { notify: jest.fn() } },
        { provide: AiAutoReplyService, useValue: { maybeAutoReply: jest.fn() } },
        { provide: AiSentimentService, useValue: { analyze: jest.fn() } },
      ],
    }).compile();

    controller = moduleRef.get(CommunicationsController);
    process.env.EMAIL_SENDER_DOMAINS = "allowed.com";
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it("rejects outbound email when sender domain is not allowed", async () => {
    await expect(
      controller.send({
        campgroundId: "cg1",
        guestId: "g1",
        reservationId: null,
        type: "email",
        direction: "outbound",
        toAddress: "user@example.com",
        fromAddress: "bad@notallowed.com",
        body: "hi",
      }),
    ).rejects.toThrow(/Unverified sender domain/);
    expect(prisma.communication?.create).toBeUndefined();
  });

  it("appends audit log on template update when fields change", async () => {
    const existing = {
      id: "t1",
      campgroundId: "cg1",
      name: "Old",
      subject: "S",
      bodyHtml: "<p>a</p>",
      status: "draft",
      auditLog: [],
    };
    prisma.communicationTemplate.findUnique.mockResolvedValue(existing);
    prisma.communicationTemplate.update.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => data,
    );

    const updated = await controller.updateTemplate("t1", { name: "New name" }, "cg1");

    expect(prisma.communicationTemplate.update).toHaveBeenCalled();
    expect(updated.auditLog?.length).toBe(1);
    expect(updated.auditLog?.[0]?.action).toBe("updated");
    expect(updated.name).toBe("New name");
  });

  it("reschedules playbook job during quiet hours", async () => {
    Object.defineProperty(controller, "isQuietHours", { value: () => true });
    prisma.communicationPlaybook.findUnique.mockResolvedValue({
      id: "pb1",
      enabled: true,
      channel: "email",
      campground: {},
      template: { status: "approved", subject: "Hi", bodyHtml: "<p>hi</p>" },
    });
    prisma.communicationPlaybookJob.update.mockResolvedValue({});

    const processJob = getPrivateMethod(controller, "processJob");
    await processJob.call(controller, {
      id: "job1",
      playbookId: "pb1",
      attempts: 0,
      reservationId: null,
      guestId: null,
    });

    expect(prisma.communicationPlaybookJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job1" },
        data: expect.objectContaining({
          scheduledAt: expect.any(Date),
          attempts: 1,
        }),
      }),
    );
    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });

  it("sends playbook email when not in quiet hours", async () => {
    Object.defineProperty(controller, "isQuietHours", { value: () => false });
    prisma.communicationPlaybook.findUnique.mockResolvedValue({
      id: "pb1",
      enabled: true,
      channel: "email",
      campground: {},
      template: { status: "approved", subject: "Hi", bodyHtml: "<p>hi</p>" },
    });
    prisma.reservation.findUnique.mockResolvedValue({
      id: "r1",
      guest: { email: "user@example.com" },
    });
    prisma.communicationPlaybookJob.update.mockResolvedValue({});

    const processJob = getPrivateMethod(controller, "processJob");
    await processJob.call(controller, {
      id: "job1",
      playbookId: "pb1",
      attempts: 0,
      reservationId: "r1",
    });

    expect(emailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "user@example.com" }),
    );
    expect(prisma.communicationPlaybookJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job1" },
        data: expect.objectContaining({ status: "sent" }),
      }),
    );
  });
});
