import "reflect-metadata";
import { Test, TestingModule } from "@nestjs/testing";
import { SignaturesService } from "../signatures/signatures.service";
import { SignaturesController } from "../signatures/signatures.controller";
import { AuditService } from "../audit/audit.service";
import { EmailService } from "../email/email.service";
import { SmsService } from "../sms/sms.service";
import { SignatureRequestStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

describe("Signatures module", () => {
  type PrismaMock = {
    reservation: { findUnique: jest.Mock };
    guest: { findUnique: jest.Mock };
    signatureRequest: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
    };
    signatureArtifact: { findUnique: jest.Mock; upsert: jest.Mock };
    coiUpload: { create: jest.Mock; findMany: jest.Mock; update: jest.Mock };
  };

  type EmailMock = { sendEmail: jest.Mock };
  type SmsMock = { sendSms: jest.Mock };
  type AuditMock = { record: jest.Mock };

  let prisma: PrismaMock;
  let email: EmailMock;
  let sms: SmsMock;
  let audit: AuditMock;
  let service: SignaturesService;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    prisma = {
      reservation: { findUnique: jest.fn() },
      guest: { findUnique: jest.fn() },
      signatureRequest: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      signatureArtifact: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      coiUpload: {
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };
    email = { sendEmail: jest.fn().mockResolvedValue({}) };
    sms = { sendSms: jest.fn().mockResolvedValue({}) };
    audit = { record: jest.fn().mockResolvedValue({}) };

    moduleRef = await Test.createTestingModule({
      providers: [
        SignaturesService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: email },
        { provide: SmsService, useValue: sms },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = moduleRef.get(SignaturesService);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await moduleRef.close();
  });

  it("creates and sends a signature request with email", async () => {
    prisma.reservation.findUnique.mockResolvedValue({
      id: "res1",
      campgroundId: "camp1",
      Guest: {
        id: "guest1",
        email: "guest@example.com",
        primaryFirstName: "Test",
        primaryLastName: "User",
      },
    });
    prisma.signatureRequest.create.mockImplementation(
      (input: { data: Record<string, unknown> }) => ({
        ...input.data,
        id: "req1",
      }),
    );

    const { request, signingUrl } = await service.createAndSend(
      { reservationId: "res1", documentType: "long_term_stay", deliveryChannel: "email" },
      "user-actor",
    );

    expect(request.status).toBe(SignatureRequestStatus.sent);
    expect(signingUrl).toContain("/sign/");
    expect(email.sendEmail).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "signature.request_sent" }),
    );
  });

  it("handles webhook idempotently when already signed", async () => {
    let record = {
      id: "req1",
      campgroundId: "camp1",
      reservationId: "res1",
      guestId: "guest1",
      token: "tok",
      documentType: "waiver",
      status: SignatureRequestStatus.sent,
      reminderCount: 0,
    };
    prisma.signatureRequest.findUnique.mockImplementation(() => Promise.resolve(record));
    prisma.signatureRequest.update.mockImplementation(
      (input: { data: Record<string, unknown> }) => {
        record = { ...record, ...input.data };
        return Promise.resolve(record);
      },
    );
    prisma.signatureArtifact.findUnique.mockResolvedValue(null);
    prisma.signatureArtifact.upsert.mockResolvedValue({
      id: "art1",
      requestId: "req1",
      pdfUrl: "data:pdf",
    });

    await service.handleWebhook({ token: "tok", status: "signed" });
    expect(record.status).toBe(SignatureRequestStatus.signed);
    expect(prisma.signatureArtifact.upsert).toHaveBeenCalledTimes(1);

    // Second webhook should not duplicate artifacts
    prisma.signatureArtifact.findUnique.mockResolvedValue({
      id: "art1",
      requestId: "req1",
      pdfUrl: "data:pdf",
    });
    await service.handleWebhook({ token: "tok", status: "signed" });
    expect(prisma.signatureArtifact.upsert).toHaveBeenCalledTimes(1);
  });

  it("applies auth guards on write routes", () => {
    const guards = Reflect.getMetadata("__guards__", SignaturesController.prototype.create) || [];
    expect(guards.length).toBeGreaterThan(0);
  });
});
