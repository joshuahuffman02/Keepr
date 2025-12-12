import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { AuditService } from "../audit/audit.service";
import { EmailService } from "../email/email.service";
import { PrismaService } from "../prisma/prisma.service";
import { SmsService } from "../sms/sms.service";
import { CreateSignatureRequestDto } from "@/signatures/dto/create-signature-request.dto";
import { SignatureWebhookDto } from "@/signatures/dto/signature-webhook.dto";
import { CoiUploadDto } from "@/signatures/dto/coi-upload.dto";
import { createHash, randomBytes } from "crypto";

const SignatureRequestStatus = {
  draft: "draft",
  sent: "sent",
  viewed: "viewed",
  signed: "signed",
  declined: "declined",
  voided: "voided",
  expired: "expired"
} as const;
type SignatureRequestStatus = (typeof SignatureRequestStatus)[keyof typeof SignatureRequestStatus];

const SignatureDeliveryChannel = {
  email: "email",
  sms: "sms",
  email_and_sms: "email_and_sms"
} as const;
type SignatureDeliveryChannel = (typeof SignatureDeliveryChannel)[keyof typeof SignatureDeliveryChannel];

const SignatureDocumentType = {
  long_term_stay: "long_term_stay",
  park_rules: "park_rules",
  deposit: "deposit",
  waiver: "waiver",
  coi: "coi",
  other: "other"
} as const;
type SignatureDocumentType = (typeof SignatureDocumentType)[keyof typeof SignatureDocumentType];

const CoiStatus = {
  pending: "pending",
  active: "active",
  voided: "voided",
  expired: "expired"
} as const;
type CoiStatus = (typeof CoiStatus)[keyof typeof CoiStatus];

const FINAL_SIGNATURE_STATES: SignatureRequestStatus[] = [
  SignatureRequestStatus.signed,
  SignatureRequestStatus.declined,
  SignatureRequestStatus.voided,
  SignatureRequestStatus.expired
];

@Injectable()
export class SignaturesService {
  private readonly logger = new Logger(SignaturesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly sms: SmsService,
    private readonly audit: AuditService
  ) { }

  private appBaseUrl() {
    return process.env.FRONTEND_URL || "https://app.campreserv.com";
  }

  private signingUrl(token: string) {
    return `${this.appBaseUrl()}/sign/${token}`;
  }

  private computeReminder(expiresAt?: Date | null, fallbackDays = 2) {
    if (!expiresAt) return new Date(Date.now() + fallbackDays * 24 * 60 * 60 * 1000);
    const target = new Date(expiresAt.getTime() - fallbackDays * 24 * 60 * 60 * 1000);
    return target > new Date() ? target : new Date(Date.now() + fallbackDays * 60 * 60 * 1000);
  }

  private buildStubPdf(request: any, payload?: SignatureWebhookDto) {
    const lines = [
      `Campground: ${request.campgroundId}`,
      `Reservation: ${request.reservationId ?? "n/a"}`,
      `Document: ${request.documentType}`,
      `Recipient: ${payload?.recipientEmail ?? request.recipientEmail ?? "guest"}`,
      `Status: signed`,
      `Signed At: ${new Date().toISOString()}`
    ].join("\n");
    const base64 = Buffer.from(lines).toString("base64");
    return `data:application/pdf;base64,${base64}`;
  }

  private async deliverRequest(request: any, context?: { reservation?: any; guest?: any; message?: string }) {
    const link = this.signingUrl(request.token);
    const subject = request.subject || "Signature requested";
    const recipientEmail = request.recipientEmail || context?.guest?.email;
    const recipientPhone = request.recipientPhone || context?.guest?.phone;

    if (request.deliveryChannel === SignatureDeliveryChannel.email || request.deliveryChannel === SignatureDeliveryChannel.email_and_sms) {
      if (!recipientEmail) {
        throw new BadRequestException("Recipient email required for email delivery");
      }

      const html = `
        <p>Hello ${request.recipientName || context?.guest?.primaryFirstName || "there"},</p>
        <p>You have a document to review and sign for your stay. Use the secure link below:</p>
        <p><a href="${link}">${link}</a></p>
        <p>${context?.message || request.message || "This link expires soon; please sign at your earliest convenience."}</p>
      `;

      await this.email.sendEmail({
        to: recipientEmail,
        subject,
        html,
        reservationId: request.reservationId,
        guestId: request.guestId,
        campgroundId: request.campgroundId
      });
    }

    if (request.deliveryChannel === SignatureDeliveryChannel.sms || request.deliveryChannel === SignatureDeliveryChannel.email_and_sms) {
      if (recipientPhone) {
        const body = `Campreserv: Signature needed for your stay. ${link}`;
        await this.sms.sendSms({ to: recipientPhone, body, reservationId: request.reservationId, campgroundId: request.campgroundId });
      } else {
        this.logger.warn(`SMS delivery requested but no phone found for request ${request.id}`);
      }
    }
  }

  async createAndSend(dto: CreateSignatureRequestDto, actorId: string | null) {
    const reservation = dto.reservationId
      ? await this.prisma.reservation.findUnique({ where: { id: dto.reservationId }, include: { guest: true } })
      : null;
    const campgroundId = dto.campgroundId || reservation?.campgroundId;
    if (!campgroundId) {
      throw new BadRequestException("campgroundId is required");
    }

    const guest = reservation?.guest ?? (dto.guestId ? await this.prisma.guest.findUnique({ where: { id: dto.guestId } }) : null);
    const token = randomBytes(24).toString("hex");
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const reminderAt = dto.reminderAt ? new Date(dto.reminderAt) : this.computeReminder(expiresAt);
    const deliveryChannel = dto.deliveryChannel || SignatureDeliveryChannel.email;
    const documentType = dto.documentType || SignatureDocumentType.other;

    const created = await this.prisma.signatureRequest.create({
      data: {
        campgroundId,
        reservationId: reservation?.id ?? dto.reservationId ?? null,
        guestId: guest?.id ?? dto.guestId ?? null,
        templateId: dto.templateId ?? null,
        documentType,
        status: SignatureRequestStatus.sent,
        deliveryChannel,
        token,
        subject: dto.subject ?? null,
        message: dto.message ?? null,
        recipientName: dto.recipientName ?? guest?.primaryFirstName ?? null,
        recipientEmail: dto.recipientEmail ?? guest?.email ?? null,
        recipientPhone: dto.recipientPhone ?? guest?.phone ?? null,
        sentAt: new Date(),
        expiresAt,
        reminderAt,
        metadata: dto.metadata ?? null
      }
    });

    await this.deliverRequest(created, { reservation, guest, message: dto.message });

    await this.audit.record({
      campgroundId,
      actorId,
      action: "signature.request_sent",
      entity: "SignatureRequest",
      entityId: created.id,
      after: { status: created.status, documentType, reservationId: created.reservationId, guestId: created.guestId }
    });

    return { request: created, signingUrl: this.signingUrl(token) };
  }

  async resend(id: string, actorId: string | null) {
    const existing = await this.prisma.signatureRequest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Signature request not found");
    if (FINAL_SIGNATURE_STATES.includes(existing.status)) {
      throw new BadRequestException("Cannot resend a completed request");
    }

    const reminderAt = this.computeReminder(existing.expiresAt);
    const updated = await this.prisma.signatureRequest.update({
      where: { id },
      data: {
        status: SignatureRequestStatus.sent,
        sentAt: new Date(),
        reminderAt,
        reminderCount: existing.reminderCount + 1
      }
    });

    const reservation = updated.reservationId
      ? await this.prisma.reservation.findUnique({ where: { id: updated.reservationId }, include: { guest: true } })
      : null;

    await this.deliverRequest(updated, { reservation, guest: reservation?.guest });

    await this.audit.record({
      campgroundId: updated.campgroundId,
      actorId,
      action: "signature.request_resent",
      entity: "SignatureRequest",
      entityId: updated.id,
      before: { reminderCount: existing.reminderCount },
      after: { reminderCount: updated.reminderCount }
    });

    return updated;
  }

  async voidRequest(id: string, actorId: string | null) {
    const existing = await this.prisma.signatureRequest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Signature request not found");
    if (existing.status === SignatureRequestStatus.voided) return existing;

    const updated = await this.prisma.signatureRequest.update({
      where: { id },
      data: {
        status: SignatureRequestStatus.voided,
        voidedAt: new Date(),
        reminderAt: null
      }
    });

    await this.audit.record({
      campgroundId: updated.campgroundId,
      actorId,
      action: "signature.request_voided",
      entity: "SignatureRequest",
      entityId: updated.id,
      before: { status: existing.status },
      after: { status: updated.status }
    });

    return updated;
  }

  async handleWebhook(dto: SignatureWebhookDto) {
    const request = await this.prisma.signatureRequest.findUnique({
      where: { token: dto.token },
      include: { reservation: true, guest: true }
    });
    if (!request) throw new NotFoundException("Signature request not found");

    const now = new Date();
    if (FINAL_SIGNATURE_STATES.includes(request.status) && dto.status !== "viewed") {
      return { request, artifact: await this.prisma.signatureArtifact.findUnique({ where: { requestId: request.id } }) };
    }

    let nextStatus = request.status;
    let viewedAt: Date | null = null;
    let signedAt: Date | null = null;
    let declinedAt: Date | null = null;
    let voidedAt: Date | null = null;

    switch (dto.status) {
      case "signed":
        nextStatus = SignatureRequestStatus.signed;
        signedAt = now;
        break;
      case "declined":
        nextStatus = SignatureRequestStatus.declined;
        declinedAt = now;
        break;
      case "voided":
        nextStatus = SignatureRequestStatus.voided;
        voidedAt = now;
        break;
      case "expired":
        nextStatus = SignatureRequestStatus.expired;
        break;
      case "viewed":
        nextStatus = request.status === SignatureRequestStatus.sent ? SignatureRequestStatus.viewed : request.status;
        viewedAt = now;
        break;
      default:
        break;
    }

    const updatedRequest = await this.prisma.signatureRequest.update({
      where: { id: request.id },
      data: {
        status: nextStatus,
        viewedAt: viewedAt ?? request.viewedAt,
        signedAt: signedAt ?? request.signedAt,
        declinedAt: declinedAt ?? request.declinedAt,
        voidedAt: voidedAt ?? request.voidedAt,
        reminderAt: null
      }
    });

    let artifact = await this.prisma.signatureArtifact.findUnique({ where: { requestId: request.id } });
    if (dto.status === "signed") {
      const pdfUrl = dto.pdfUrl || this.buildStubPdf(updatedRequest, dto);
      const checksum = createHash("sha256").update(pdfUrl).digest("hex");
      artifact = await this.prisma.signatureArtifact.upsert({
        where: { requestId: request.id },
        update: {
          pdfUrl,
          storageKey: dto.storageKey ?? artifact?.storageKey ?? null,
          checksum,
          metadata: dto.metadata ?? artifact?.metadata ?? null,
          completedAt: dto.completedAt ? new Date(dto.completedAt) : now,
          reservationId: updatedRequest.reservationId,
          guestId: updatedRequest.guestId
        },
        create: {
          requestId: request.id,
          campgroundId: updatedRequest.campgroundId,
          reservationId: updatedRequest.reservationId,
          guestId: updatedRequest.guestId,
          pdfUrl,
          storageKey: dto.storageKey ?? null,
          checksum,
          metadata: dto.metadata ?? null,
          completedAt: dto.completedAt ? new Date(dto.completedAt) : now
        }
      });
    }

    await this.audit.record({
      campgroundId: updatedRequest.campgroundId,
      actorId: null,
      action: `signature.${dto.status}`,
      entity: "SignatureRequest",
      entityId: updatedRequest.id,
      before: { status: request.status },
      after: { status: updatedRequest.status },
      ip: dto.ipAddress,
      userAgent: dto.userAgent
    });

    return { request: updatedRequest, artifact };
  }

  async listByReservation(reservationId: string) {
    return this.prisma.signatureRequest.findMany({
      where: { reservationId },
      include: { artifact: true, template: true }
    });
  }

  async getById(id: string) {
    return this.prisma.signatureRequest.findUnique({
      where: { id },
      include: { artifact: true, template: true }
    });
  }

  private scoreTemplate(tpl: any, siteId?: string | null, siteClassId?: string | null) {
    let score = 0;
    if (tpl.siteId && tpl.siteId === siteId) score += 3;
    if (tpl.siteClassId && tpl.siteClassId === siteClassId) score += 2;
    if (!tpl.siteId && !tpl.siteClassId) score += 1;
    score += (tpl.version ?? 0) / 1000;
    return score;
  }

  async autoSendForReservation(reservation: any) {
    if (!reservation?.campgroundId || !reservation?.id) return null;

    const guest =
      reservation.guest ??
      (reservation.guestId
        ? await this.prisma.guest.findUnique({ where: { id: reservation.guestId } })
        : null);
    if (!guest?.email) return null;

    const templates = await this.prisma.documentTemplate.findMany({
      where: {
        campgroundId: reservation.campgroundId,
        isActive: true,
        autoSend: true,
        OR: [
          reservation.siteId ? { siteId: reservation.siteId } : undefined,
          reservation.site?.siteClassId ? { siteClassId: reservation.site.siteClassId } : undefined,
          { siteId: null, siteClassId: null }
        ].filter(Boolean) as any[]
      }
    });

    if (!templates.length) return null;

    const ranked = templates
      .map((tpl: any) => ({
        tpl,
        score: this.scoreTemplate(tpl, reservation.siteId, reservation.site?.siteClassId ?? null)
      }))
      .sort((a: { tpl: any; score: number }, b: { tpl: any; score: number }) => b.score - a.score);

    const template = ranked[0]?.tpl;
    if (!template) return null;

    const existing = await this.prisma.signatureRequest.findFirst({
      where: {
        reservationId: reservation.id,
        documentType: template.type,
        status: { notIn: FINAL_SIGNATURE_STATES }
      }
    });
    if (existing) return existing;

    try {
      return await this.createAndSend(
        {
          campgroundId: reservation.campgroundId,
          reservationId: reservation.id,
          guestId: guest.id,
          templateId: template.id,
          documentType: template.type,
          subject: template.name,
          recipientEmail: guest.email,
          recipientPhone: guest.phone ?? undefined,
          message: template.content ? template.content.slice(0, 280) : undefined
        },
        null
      );
    } catch (err) {
      this.logger.warn(`Auto-send signature failed for reservation ${reservation.id}: ${err}`);
      return null;
    }
  }

  async createCoi(dto: CoiUploadDto, actorId: string | null) {
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    const reminderAt = expiresAt ? this.computeReminder(expiresAt, 7) : null;
    const upload = await this.prisma.coiUpload.create({
      data: {
        campgroundId: dto.campgroundId,
        reservationId: dto.reservationId ?? null,
        guestId: dto.guestId ?? null,
        fileUrl: dto.fileUrl,
        storageKey: dto.storageKey ?? null,
        status: dto.status ?? CoiStatus.active,
        expiresAt,
        reminderAt,
        notes: dto.notes ?? null
      }
    });

    await this.audit.record({
      campgroundId: dto.campgroundId,
      actorId,
      action: "coi.uploaded",
      entity: "CoiUpload",
      entityId: upload.id,
      after: { reservationId: dto.reservationId, guestId: dto.guestId, expiresAt }
    });

    return upload;
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async dispatchReminders() {
    const now = new Date();
    const signatureCandidates = await this.prisma.signatureRequest.findMany({
      where: {
        status: { in: [SignatureRequestStatus.sent, SignatureRequestStatus.viewed] },
        reminderAt: { lte: now },
        expiresAt: { gt: now }
      },
      take: 25
    });

    for (const req of signatureCandidates) {
      try {
        await this.deliverRequest(req);
        await this.prisma.signatureRequest.update({
          where: { id: req.id },
          data: {
            reminderCount: req.reminderCount + 1,
            reminderAt: this.computeReminder(req.expiresAt)
          }
        });
      } catch (err) {
        this.logger.warn(`Failed to send reminder for ${req.id}: ${err}`);
      }
    }

    const expiryThreshold = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const coiCandidates = await this.prisma.coiUpload.findMany({
      where: {
        status: { in: [CoiStatus.pending, CoiStatus.active] },
        expiresAt: { lte: expiryThreshold },
        OR: [{ reminderAt: null }, { reminderAt: { lte: now } }]
      },
      take: 25
    });

    for (const coi of coiCandidates) {
      try {
        const subject = "Certificate of Insurance expiring soon";
        const email = coi.guestId
          ? (await this.prisma.guest.findUnique({ where: { id: coi.guestId }, select: { email: true } }))?.email
          : null;
        if (email) {
          await this.email.sendEmail({
            to: email,
            subject,
            html: `<p>Your certificate of insurance on file will expire on ${coi.expiresAt?.toISOString()}. Please upload a new COI.</p>`
          });
        }
        await this.prisma.coiUpload.update({
          where: { id: coi.id },
          data: { reminderCount: coi.reminderCount + 1, reminderAt: this.computeReminder(coi.expiresAt, 3) }
        });
      } catch (err) {
        this.logger.warn(`Failed COI reminder for ${coi.id}: ${err}`);
      }
    }
  }
}

