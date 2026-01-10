import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { AuditService } from "../audit/audit.service";
import { EmailService } from "../email/email.service";
import { PrismaService } from "../prisma/prisma.service";
import { SmsService } from "../sms/sms.service";
import { CreateSignatureRequestDto } from "@/signatures/dto/create-signature-request.dto";
import { SignatureWebhookDto } from "@/signatures/dto/signature-webhook.dto";
import { CoiUploadDto } from "@/signatures/dto/coi-upload.dto";
import { MarkPaperSignedDto } from "@/signatures/dto/mark-paper-signed.dto";
import { WaiveSignatureDto } from "@/signatures/dto/waive-signature.dto";
import { ContractStats } from "@/signatures/dto/contract-stats.dto";
import { SendRenewalCampaignDto } from "@/signatures/dto/send-renewal-campaign.dto";
import { createHash, randomBytes } from "crypto";

const SignatureRequestStatus = {
  preview: "preview",
  draft: "draft",
  sent: "sent",
  viewed: "viewed",
  signed: "signed",
  signed_paper: "signed_paper",
  waived: "waived",
  declined: "declined",
  voided: "voided",
  expired: "expired"
} as const;
type SignatureRequestStatus = (typeof SignatureRequestStatus)[keyof typeof SignatureRequestStatus];

const SignatureMethod = {
  digital: "digital",
  paper: "paper",
  waived: "waived"
} as const;
type SignatureMethod = (typeof SignatureMethod)[keyof typeof SignatureMethod];

const WaiverReason = {
  returning_same_terms: "returning_same_terms",
  corporate_agreement: "corporate_agreement",
  grandfathered: "grandfathered",
  family_member: "family_member",
  owner_discretion: "owner_discretion",
  other: "other"
} as const;
type WaiverReason = (typeof WaiverReason)[keyof typeof WaiverReason];

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
  SignatureRequestStatus.signed_paper,
  SignatureRequestStatus.waived,
  SignatureRequestStatus.declined,
  SignatureRequestStatus.voided,
  SignatureRequestStatus.expired
];

// Completed statuses (for calculating completion rate)
const COMPLETED_STATUSES: SignatureRequestStatus[] = [
  SignatureRequestStatus.signed,
  SignatureRequestStatus.signed_paper,
  SignatureRequestStatus.waived
];

// Pending statuses (needs guest action)
const PENDING_STATUSES: SignatureRequestStatus[] = [
  SignatureRequestStatus.sent,
  SignatureRequestStatus.viewed
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

  private computeReminder(expiresAt?: Date | null, fallbackDays = 2, cadenceDays?: number | null) {
    if (cadenceDays && cadenceDays > 0) {
      return new Date(Date.now() + cadenceDays * 24 * 60 * 60 * 1000);
    }
    if (!expiresAt) return new Date(Date.now() + fallbackDays * 24 * 60 * 60 * 1000);
    const target = new Date(expiresAt.getTime() - fallbackDays * 24 * 60 * 60 * 1000);
    return target > new Date() ? target : new Date(Date.now() + fallbackDays * 60 * 60 * 1000);
  }

  private getReminderCadenceDays(request: any) {
    const cadence = Number(request?.metadata?.reminderCadenceDays);
    if (!Number.isFinite(cadence) || cadence <= 0) return null;
    return cadence;
  }

  private getReminderMaxCount(request: any) {
    const max = Number(request?.metadata?.reminderMaxCount);
    if (!Number.isFinite(max) || max <= 0) return null;
    return max;
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
        const body = `Keepr Host: Signature needed for your stay. ${link}`;
        await this.sms.sendSms({ to: recipientPhone, body, reservationId: request.reservationId, campgroundId: request.campgroundId });
      } else {
        this.logger.warn(`SMS delivery requested but no phone found for request ${request.id}`);
      }
    }
  }

  async createAndSend(dto: CreateSignatureRequestDto, actorId: string | null) {
    const reservation = dto.reservationId
      ? await this.prisma.reservation.findUnique({ where: { id: dto.reservationId }, include: { Guest: true } })
      : null;
    const campgroundId = dto.campgroundId || reservation?.campgroundId;
    if (!campgroundId) {
      throw new BadRequestException("campgroundId is required");
    }

    const guest = reservation?.guest ?? (dto.guestId ? await this.prisma.guest.findUnique({ where: { id: dto.guestId } }) : null);
    const token = randomBytes(24).toString("hex");
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const cadenceDays = dto.metadata?.reminderCadenceDays ? Number(dto.metadata.reminderCadenceDays) : null;
    const reminderAt = dto.reminderAt ? new Date(dto.reminderAt) : this.computeReminder(expiresAt, 2, cadenceDays);
    const deliveryChannel = dto.deliveryChannel || SignatureDeliveryChannel.email;
    const documentType = dto.documentType || SignatureDocumentType.other;
    const signatureMethod = dto.signatureMethod || SignatureMethod.digital;

    // Determine initial status based on preview/signing availability
    const now = new Date();
    const previewAvailableAt = dto.previewAvailableAt ? new Date(dto.previewAvailableAt) : null;
    const availableForSigningAt = dto.availableForSigningAt ? new Date(dto.availableForSigningAt) : null;

    let initialStatus: SignatureRequestStatus = SignatureRequestStatus.sent;
    let shouldDeliver = true;

    // If there's a future signing date, start in preview or draft
    if (availableForSigningAt && availableForSigningAt > now) {
      if (previewAvailableAt && previewAvailableAt <= now) {
        initialStatus = SignatureRequestStatus.preview;
      } else {
        initialStatus = SignatureRequestStatus.draft;
        shouldDeliver = false; // Don't send yet
      }
    }

    const created = await this.prisma.signatureRequest.create({
      data: {
        campgroundId,
        reservationId: reservation?.id ?? dto.reservationId ?? null,
        guestId: guest?.id ?? dto.guestId ?? null,
        templateId: dto.templateId ?? null,
        documentType,
        status: initialStatus,
        deliveryChannel,
        signatureMethod,
        token,
        subject: dto.subject ?? null,
        message: dto.message ?? null,
        recipientName: dto.recipientName ?? guest?.primaryFirstName ?? null,
        recipientEmail: dto.recipientEmail ?? guest?.email ?? null,
        recipientPhone: dto.recipientPhone ?? guest?.phone ?? null,
        sentAt: shouldDeliver ? new Date() : null,
        expiresAt,
        reminderAt: shouldDeliver ? reminderAt : null,
        previewAvailableAt,
        availableForSigningAt,
        renewsContractId: dto.renewsContractId ?? null,
        seasonYear: dto.seasonYear ?? null,
        metadata: dto.metadata ?? null
      }
    });

    if (shouldDeliver) {
      await this.deliverRequest(created, { reservation, guest, message: dto.message });
    }

    await this.audit.record({
      campgroundId,
      actorId,
      action: shouldDeliver ? "signature.request_sent" : "signature.request_created",
      entity: "SignatureRequest",
      entityId: created.id,
      after: {
        status: created.status,
        documentType,
        reservationId: created.reservationId,
        guestId: created.guestId,
        seasonYear: created.seasonYear
      }
    });

    return { request: created, signingUrl: this.signingUrl(token) };
  }

  async createSignedRequest(dto: {
    campgroundId?: string;
    reservationId?: string;
    guestId?: string;
    templateId?: string;
    documentType?: SignatureDocumentType;
    deliveryChannel?: SignatureDeliveryChannel;
    subject?: string;
    message?: string;
    recipientName?: string | null;
    recipientEmail?: string | null;
    recipientPhone?: string | null;
    metadata?: Record<string, any>;
  }) {
    const token = randomBytes(24).toString("hex");
    const request = await this.prisma.signatureRequest.create({
      data: {
        campgroundId: dto.campgroundId!,
        reservationId: dto.reservationId ?? null,
        guestId: dto.guestId ?? null,
        templateId: dto.templateId ?? null,
        documentType: dto.documentType ?? SignatureDocumentType.other,
        status: SignatureRequestStatus.sent,
        deliveryChannel: dto.deliveryChannel ?? SignatureDeliveryChannel.email,
        token,
        subject: dto.subject ?? null,
        message: dto.message ?? null,
        recipientName: dto.recipientName ?? null,
        recipientEmail: dto.recipientEmail ?? null,
        recipientPhone: dto.recipientPhone ?? null,
        sentAt: new Date(),
        metadata: dto.metadata ?? null
      }
    });

    const signed = await this.handleWebhook({
      token,
      status: "signed",
      recipientEmail: dto.recipientEmail ?? undefined,
      metadata: dto.metadata ?? undefined
    });

    return signed.request ?? request;
  }

  async resend(id: string, actorId: string | null) {
    const existing = await this.prisma.signatureRequest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Signature request not found");
    if (FINAL_SIGNATURE_STATES.includes(existing.status)) {
      throw new BadRequestException("Cannot resend a completed request");
    }

    const cadenceDays = this.getReminderCadenceDays(existing);
    const reminderAt = this.computeReminder(existing.expiresAt, 2, cadenceDays);
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
      ? await this.prisma.reservation.findUnique({ where: { id: updated.reservationId }, include: { Guest: true } })
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

  async getByToken(token: string) {
    return this.prisma.signatureRequest.findUnique({
      where: { token },
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
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
      },
      take: 25
    });

    for (const req of signatureCandidates) {
      const maxCount = this.getReminderMaxCount(req);
      if (maxCount !== null && req.reminderCount >= maxCount) {
        await this.prisma.signatureRequest.update({
          where: { id: req.id },
          data: { reminderAt: null }
        });
        continue;
      }
      try {
        await this.deliverRequest(req);
        const cadenceDays = this.getReminderCadenceDays(req);
        await this.prisma.signatureRequest.update({
          where: { id: req.id },
          data: {
            reminderCount: req.reminderCount + 1,
            reminderAt: this.computeReminder(req.expiresAt, 2, cadenceDays)
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

  // ==================== PAPER SIGNING ====================

  async markPaperSigned(dto: MarkPaperSignedDto, actorId: string) {
    const existing = await this.prisma.signatureRequest.findUnique({ where: { id: dto.id } });
    if (!existing) throw new NotFoundException("Signature request not found");

    if (FINAL_SIGNATURE_STATES.includes(existing.status)) {
      throw new BadRequestException("Cannot mark a completed request as paper signed");
    }

    const paperSignedAt = dto.paperSignedAt ? new Date(dto.paperSignedAt) : new Date();

    const updated = await this.prisma.signatureRequest.update({
      where: { id: dto.id },
      data: {
        status: SignatureRequestStatus.signed_paper,
        signatureMethod: SignatureMethod.paper,
        paperSignedAt,
        paperReceivedBy: actorId,
        paperArtifactUrl: dto.paperArtifactUrl ?? null,
        signedAt: paperSignedAt,
        reminderAt: null, // Stop reminders
        metadata: {
          ...(existing.metadata as object || {}),
          paperSigningNotes: dto.notes
        }
      }
    });

    // Create artifact for paper signing
    await this.prisma.signatureArtifact.upsert({
      where: { requestId: existing.id },
      update: {
        pdfUrl: dto.paperArtifactUrl || "paper-signed-no-scan",
        completedAt: paperSignedAt,
        metadata: { paperSigned: true, receivedBy: actorId }
      },
      create: {
        requestId: existing.id,
        campgroundId: existing.campgroundId,
        reservationId: existing.reservationId,
        guestId: existing.guestId,
        pdfUrl: dto.paperArtifactUrl || "paper-signed-no-scan",
        completedAt: paperSignedAt,
        metadata: { paperSigned: true, receivedBy: actorId }
      }
    });

    await this.audit.record({
      campgroundId: existing.campgroundId,
      actorId,
      action: "signature.marked_paper_signed",
      entity: "SignatureRequest",
      entityId: existing.id,
      before: { status: existing.status },
      after: { status: updated.status, paperSignedAt, paperReceivedBy: actorId }
    });

    return updated;
  }

  // ==================== SIGNATURE WAIVER ====================

  async waiveSignature(dto: WaiveSignatureDto, actorId: string) {
    const existing = await this.prisma.signatureRequest.findUnique({ where: { id: dto.id } });
    if (!existing) throw new NotFoundException("Signature request not found");

    if (FINAL_SIGNATURE_STATES.includes(existing.status)) {
      throw new BadRequestException("Cannot waive a completed request");
    }

    if (dto.reason === "other" && !dto.notes) {
      throw new BadRequestException("Notes are required when waiver reason is 'other'");
    }

    const waivedAt = new Date();

    const updated = await this.prisma.signatureRequest.update({
      where: { id: dto.id },
      data: {
        status: SignatureRequestStatus.waived,
        signatureMethod: SignatureMethod.waived,
        signatureWaived: true,
        waiverReason: dto.reason as WaiverReason,
        waiverNotes: dto.notes ?? null,
        waivedBy: actorId,
        waivedAt,
        reminderAt: null // Stop reminders
      }
    });

    await this.audit.record({
      campgroundId: existing.campgroundId,
      actorId,
      action: "signature.waived",
      entity: "SignatureRequest",
      entityId: existing.id,
      before: { status: existing.status },
      after: { status: updated.status, waiverReason: dto.reason, waivedBy: actorId }
    });

    return updated;
  }

  // ==================== CONTRACT STATS ====================

  async getContractStats(campgroundId: string, seasonYear?: number, documentType?: string): Promise<ContractStats> {
    const where: any = { campgroundId };
    if (seasonYear) where.seasonYear = seasonYear;
    if (documentType) where.documentType = documentType;

    const counts = await this.prisma.signatureRequest.groupBy({
      by: ["status"],
      where,
      _count: { status: true }
    });

    const statusMap: Record<string, number> = {};
    let total = 0;
    for (const c of counts) {
      statusMap[c.status] = c._count.status;
      total += c._count.status;
    }

    const signed = statusMap[SignatureRequestStatus.signed] || 0;
    const signedPaper = statusMap[SignatureRequestStatus.signed_paper] || 0;
    const waived = statusMap[SignatureRequestStatus.waived] || 0;
    const completed = signed + signedPaper + waived;
    const sent = statusMap[SignatureRequestStatus.sent] || 0;
    const viewed = statusMap[SignatureRequestStatus.viewed] || 0;
    const pendingCount = sent + viewed;

    // Find nearest expiry deadline for pending contracts
    const nearestExpiry = await this.prisma.signatureRequest.findFirst({
      where: {
        ...where,
        status: { in: PENDING_STATUSES },
        expiresAt: { not: null }
      },
      orderBy: { expiresAt: "asc" },
      select: { expiresAt: true }
    });

    let daysUntilDeadline: number | undefined;
    if (nearestExpiry?.expiresAt) {
      const diff = nearestExpiry.expiresAt.getTime() - Date.now();
      daysUntilDeadline = Math.ceil(diff / (1000 * 60 * 60 * 24));
    }

    return {
      total,
      preview: statusMap[SignatureRequestStatus.preview] || 0,
      draft: statusMap[SignatureRequestStatus.draft] || 0,
      sent,
      viewed,
      signed,
      signedPaper,
      waived,
      declined: statusMap[SignatureRequestStatus.declined] || 0,
      expired: statusMap[SignatureRequestStatus.expired] || 0,
      voided: statusMap[SignatureRequestStatus.voided] || 0,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      pendingCount,
      daysUntilDeadline
    };
  }

  // ==================== CONTRACT LISTING ====================

  async listContracts(campgroundId: string, options?: {
    seasonYear?: number;
    documentType?: string;
    status?: string | string[];
    guestId?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = { campgroundId };
    if (options?.seasonYear) where.seasonYear = options.seasonYear;
    if (options?.documentType) where.documentType = options.documentType;
    if (options?.guestId) where.guestId = options.guestId;
    if (options?.status) {
      where.status = Array.isArray(options.status) ? { in: options.status } : options.status;
    }

    const [contracts, total] = await Promise.all([
      this.prisma.signatureRequest.findMany({
        where,
        include: {
          guest: { select: { id: true, primaryFirstName: true, primaryLastName: true, email: true, phone: true } },
          template: { select: { id: true, name: true, type: true } },
          artifact: { select: { id: true, pdfUrl: true, completedAt: true } },
          reservation: { select: { id: true, arrivalDate: true, departureDate: true, siteId: true } }
        },
        orderBy: [{ seasonYear: "desc" }, { createdAt: "desc" }],
        take: options?.limit ?? 50,
        skip: options?.offset ?? 0
      }),
      this.prisma.signatureRequest.count({ where })
    ]);

    return { contracts, total };
  }

  // ==================== RENEWAL CAMPAIGNS ====================

  async sendRenewalCampaign(dto: SendRenewalCampaignDto, actorId: string) {
    const template = await this.prisma.documentTemplate.findUnique({ where: { id: dto.templateId } });
    if (!template) throw new NotFoundException("Document template not found");
    if (template.campgroundId !== dto.campgroundId) {
      throw new BadRequestException("Template does not belong to this campground");
    }

    const results: { guestId: string; requestId?: string; error?: string }[] = [];
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const previewAvailableAt = dto.previewAvailableAt ? new Date(dto.previewAvailableAt) : null;
    const availableForSigningAt = dto.availableForSigningAt ? new Date(dto.availableForSigningAt) : null;

    for (const recipient of dto.recipients) {
      try {
        const guest = await this.prisma.guest.findUnique({ where: { id: recipient.guestId } });
        if (!guest) {
          results.push({ guestId: recipient.guestId, error: "Guest not found" });
          continue;
        }

        // Check for existing contract for this guest/season
        const existingContract = await this.prisma.signatureRequest.findFirst({
          where: {
            campgroundId: dto.campgroundId,
            guestId: recipient.guestId,
            seasonYear: dto.seasonYear,
            documentType: template.type,
            status: { notIn: [SignatureRequestStatus.voided, SignatureRequestStatus.expired] }
          }
        });

        if (existingContract) {
          results.push({ guestId: recipient.guestId, requestId: existingContract.id, error: "Contract already exists" });
          continue;
        }

        const { request } = await this.createAndSend({
          campgroundId: dto.campgroundId,
          guestId: recipient.guestId,
          reservationId: recipient.reservationId,
          templateId: dto.templateId,
          documentType: template.type as any,
          deliveryChannel: dto.deliveryChannel,
          subject: dto.subject || `${dto.seasonYear} Seasonal Contract`,
          message: dto.message,
          recipientName: `${guest.primaryFirstName} ${guest.primaryLastName}`.trim(),
          recipientEmail: guest.email ?? undefined,
          recipientPhone: guest.phone ?? undefined,
          expiresAt: expiresAt.toISOString(),
          previewAvailableAt: previewAvailableAt?.toISOString(),
          availableForSigningAt: availableForSigningAt?.toISOString(),
          renewsContractId: recipient.previousContractId,
          seasonYear: dto.seasonYear,
          metadata: {
            renewalCampaign: true,
            previousSiteId: recipient.siteId
          }
        }, actorId);

        results.push({ guestId: recipient.guestId, requestId: request.id });
      } catch (err) {
        this.logger.error(`Failed to create renewal for guest ${recipient.guestId}: ${err}`);
        results.push({ guestId: recipient.guestId, error: String(err) });
      }
    }

    await this.audit.record({
      campgroundId: dto.campgroundId,
      actorId,
      action: "signature.renewal_campaign_sent",
      entity: "SignatureRequest",
      entityId: dto.templateId,
      after: {
        seasonYear: dto.seasonYear,
        recipientCount: dto.recipients.length,
        successCount: results.filter(r => r.requestId && !r.error).length
      }
    });

    return {
      seasonYear: dto.seasonYear,
      total: dto.recipients.length,
      success: results.filter(r => r.requestId && !r.error).length,
      failed: results.filter(r => r.error).length,
      results
    };
  }

  // ==================== PDF DOWNLOAD ====================

  async getContractPdfUrl(requestId: string) {
    const request = await this.prisma.signatureRequest.findUnique({
      where: { id: requestId },
      include: { artifact: true, template: true }
    });

    if (!request) throw new NotFoundException("Signature request not found");

    // If there's an artifact with a PDF, return it
    if (request.artifact?.pdfUrl) {
      return {
        url: request.artifact.pdfUrl,
        status: request.status,
        signedAt: request.signedAt || request.paperSignedAt,
        isPreview: false
      };
    }

    // Otherwise, generate a preview URL (for unsigned contracts)
    // In production, this would generate an actual PDF
    return {
      url: null,
      previewContent: request.template?.content ?? null,
      status: request.status,
      isPreview: true
    };
  }

  // ==================== CRON: Preview/Signing Availability ====================

  @Cron(CronExpression.EVERY_HOUR)
  async checkPreviewAvailability() {
    const now = new Date();

    // Find contracts that should transition from draft to preview
    const toPreview = await this.prisma.signatureRequest.findMany({
      where: {
        status: SignatureRequestStatus.draft,
        previewAvailableAt: { lte: now },
        OR: [
          { availableForSigningAt: null },
          { availableForSigningAt: { gt: now } }
        ]
      },
      take: 50
    });

    for (const req of toPreview) {
      try {
        await this.prisma.signatureRequest.update({
          where: { id: req.id },
          data: { status: SignatureRequestStatus.preview }
        });

        // Notify guest that preview is available
        if (req.recipientEmail) {
          await this.email.sendEmail({
            to: req.recipientEmail,
            subject: req.subject || "Your contract is ready for preview",
            html: `<p>Hello ${req.recipientName || "there"},</p>
                   <p>Your ${req.seasonYear ? `${req.seasonYear} ` : ""}contract is now available for preview.</p>
                   <p>You can view it at: <a href="${this.signingUrl(req.token)}">${this.signingUrl(req.token)}</a></p>
                   <p>Signing will open soon.</p>`,
            campgroundId: req.campgroundId
          });
        }

        this.logger.log(`Contract ${req.id} transitioned to preview`);
      } catch (err) {
        this.logger.warn(`Failed to transition ${req.id} to preview: ${err}`);
      }
    }

    // Find contracts that should transition from preview to sent
    const toSent = await this.prisma.signatureRequest.findMany({
      where: {
        status: { in: [SignatureRequestStatus.draft, SignatureRequestStatus.preview] },
        availableForSigningAt: { lte: now }
      },
      take: 50
    });

    for (const req of toSent) {
      try {
        const cadenceDays = this.getReminderCadenceDays(req);
        const reminderAt = this.computeReminder(req.expiresAt, 2, cadenceDays);

        await this.prisma.signatureRequest.update({
          where: { id: req.id },
          data: {
            status: SignatureRequestStatus.sent,
            sentAt: now,
            reminderAt
          }
        });

        // Send the signing notification
        await this.deliverRequest(req);

        this.logger.log(`Contract ${req.id} transitioned to sent (signing now open)`);
      } catch (err) {
        this.logger.warn(`Failed to transition ${req.id} to sent: ${err}`);
      }
    }
  }
}
