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
import { JwtAuthGuard } from "../auth/guards";
import { RolesGuard } from "../auth/guards/roles.guard";
import { ScopeGuard } from "../permissions/scope.guard";

describe("Communications sender status", () => {
  let app: any;

  beforeAll(async () => {
    process.env.EMAIL_SENDER_DOMAINS = "campreserv.com,example.com";
    process.env.EMAIL_VERIFIED_DOMAINS = "campreserv.com";
    process.env.SMTP_FROM = "no-reply@campreserv.com";

    const moduleRef = await Test.createTestingModule({
      controllers: [CommunicationsController],
      providers: [
        { provide: PrismaService, useValue: {} },
        { provide: EmailService, useValue: {} },
        { provide: SmsService, useValue: {} },
        { provide: NpsService, useValue: {} },
        { provide: ObservabilityService, useValue: { recordCommsStatus: () => undefined } }
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

  afterAll(async () => {
    await app.close();
  });

  it("returns allowed and verified domains with issues for unverified ones", async () => {
    const api = request(app.getHttpServer());
    const res = await api.get("/api/communications/sender-status").expect(200);

    expect(res.body.allowedDomains).toContain("campreserv.com");
    expect(res.body.allowedDomains).toContain("example.com");

    const example = res.body.domains.find((d: any) => d.domain === "example.com");
    expect(example.verified).toBe(false);
    expect(example.issues.length).toBeGreaterThan(0);

    const verified = res.body.domains.find((d: any) => d.domain === "campreserv.com");
    expect(verified.verified).toBe(true);
  });
});

