import { Test, type TestingModule } from "@nestjs/testing";
import { CommunicationsController } from "../communications/communications.controller";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { SmsService } from "../sms/sms.service";
import { NpsService } from "../nps/nps.service";
import { ObservabilityService } from "../observability/observability.service";
import { AlertingService } from "../observability/alerting.service";
import { AiAutoReplyService } from "../ai/ai-auto-reply.service";
import { AiSentimentService } from "../ai/ai-sentiment.service";
import { JwtAuthGuard } from "../auth/guards";
import { RolesGuard } from "../auth/guards/roles.guard";
import { ScopeGuard } from "../permissions/scope.guard";

describe("Communications sender status", () => {
  let moduleRef: TestingModule;
  let controller: CommunicationsController;

  const isDomainRow = (
    value: unknown,
  ): value is { domain?: string; verified?: boolean; issues?: unknown[] } =>
    typeof value === "object" && value !== null;

  beforeAll(async () => {
    process.env.EMAIL_SENDER_DOMAINS = "campreserv.com,example.com";
    process.env.EMAIL_VERIFIED_DOMAINS = "campreserv.com";
    process.env.SMTP_FROM = "no-reply@campreserv.com";

    moduleRef = await Test.createTestingModule({
      controllers: [CommunicationsController],
      providers: [
        { provide: PrismaService, useValue: {} },
        { provide: EmailService, useValue: {} },
        { provide: SmsService, useValue: {} },
        { provide: NpsService, useValue: {} },
        { provide: ObservabilityService, useValue: { recordCommsStatus: () => undefined } },
        { provide: AlertingService, useValue: { notify: () => undefined } },
        { provide: AiAutoReplyService, useValue: {} },
        { provide: AiSentimentService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ScopeGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = moduleRef.get(CommunicationsController);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it("returns allowed and verified domains with issues for unverified ones", async () => {
    const res = await controller.senderStatus();

    expect(res.allowedDomains).toContain("campreserv.com");
    expect(res.allowedDomains).toContain("example.com");

    const domains = Array.isArray(res.domains) ? res.domains : [];
    const example = domains.find(
      (entry: unknown) => isDomainRow(entry) && entry.domain === "example.com",
    );
    expect(example?.verified).toBe(false);
    expect(Array.isArray(example?.issues)).toBe(true);
    expect(example?.issues?.length ?? 0).toBeGreaterThan(0);

    const verified = domains.find(
      (entry: unknown) => isDomainRow(entry) && entry.domain === "campreserv.com",
    );
    expect(verified?.verified).toBe(true);
  });
});
