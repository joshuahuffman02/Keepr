import "reflect-metadata";
import { SignaturesService } from "../signatures/signatures.service";
import { SignaturesController } from "../signatures/signatures.controller";
import { AuditService } from "../audit/audit.service";
import { EmailService } from "../email/email.service";
import { SmsService } from "../sms/sms.service";
import { SignatureRequestStatus } from "@prisma/client";

describe("Signatures module", () => {
  const prisma = {
    reservation: { findUnique: jest.fn() },
    guest: { findUnique: jest.fn() },
    signatureRequest: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn()
    },
    signatureArtifact: {
      findUnique: jest.fn(),
      upsert: jest.fn()
    },
    coiUpload: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn()
    }
  } as any;
  const email = { sendEmail: jest.fn().mockResolvedValue({}) } as unknown as EmailService;
  const sms = { sendSms: jest.fn().mockResolvedValue({}) } as unknown as SmsService;
  const audit = { record: jest.fn().mockResolvedValue({}) } as unknown as AuditService;
  const service = new SignaturesService(prisma, email, sms, audit);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates and sends a signature request with email", async () => {
    prisma.reservation.findUnique.mockResolvedValue({
      id: "res1",
      campgroundId: "camp1",
      guest: { id: "guest1", email: "guest@example.com", primaryFirstName: "Test", primaryLastName: "User" }
    });
    prisma.signatureRequest.create.mockImplementation(({ data }: any) => ({ ...data, id: "req1" }));

    const { request, signingUrl } = await service.createAndSend(
      { reservationId: "res1", documentType: "long_term_stay", deliveryChannel: "email" } as any,
      "user-actor"
    );

    expect(request.status).toBe(SignatureRequestStatus.sent);
    expect(signingUrl).toContain("/sign/");
    expect(email.sendEmail).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "signature.request_sent" }));
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
      reminderCount: 0
    };
    prisma.signatureRequest.findUnique.mockImplementation(() => Promise.resolve(record));
    prisma.signatureRequest.update.mockImplementation(({ data }: any) => {
      record = { ...record, ...data };
      return Promise.resolve(record);
    });
    prisma.signatureArtifact.findUnique.mockResolvedValue(null);
    prisma.signatureArtifact.upsert.mockResolvedValue({ id: "art1", requestId: "req1", pdfUrl: "data:pdf" });

    await service.handleWebhook({ token: "tok", status: "signed" });
    expect(record.status).toBe(SignatureRequestStatus.signed);
    expect(prisma.signatureArtifact.upsert).toHaveBeenCalledTimes(1);

    // Second webhook should not duplicate artifacts
    prisma.signatureArtifact.findUnique.mockResolvedValue({ id: "art1", requestId: "req1", pdfUrl: "data:pdf" });
    await service.handleWebhook({ token: "tok", status: "signed" });
    expect(prisma.signatureArtifact.upsert).toHaveBeenCalledTimes(1);
  });

  it("applies auth guards on write routes", () => {
    const guards = Reflect.getMetadata("__guards__", SignaturesController.prototype.create) || [];
    expect(guards.length).toBeGreaterThan(0);
  });
});
