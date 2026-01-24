import {
  Body,
  Controller,
  Get,
  Post,
  BadRequestException,
  UseGuards,
  Query,
  InternalServerErrorException,
  Patch,
  Param,
  HttpCode,
  Logger,
} from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCommunicationDto } from "./dto/create-communication.dto";
import { ListCommunicationsDto } from "./dto/list-communications.dto";
import { SendCommunicationDto } from "./dto/send-communication.dto";
import { JwtAuthGuard } from "../auth/guards";
import { RolesGuard, Roles } from "../auth/guards/roles.guard";
import { ScopeGuard } from "../permissions/scope.guard";
import { RequireScope } from "../permissions/scope.decorator";
import { UserRole } from "@prisma/client";
import { EmailService } from "../email/email.service";
import { SmsService } from "../sms/sms.service";
import { Prisma } from "@prisma/client";
import { BadRequestException as NestBadRequestException } from "@nestjs/common";
import { NpsService } from "../nps/nps.service";
import { ObservabilityService } from "../observability/observability.service";
import { AlertingService } from "../observability/alerting.service";
import { AiAutoReplyService } from "../ai/ai-auto-reply.service";
import { AiSentimentService } from "../ai/ai-sentiment.service";
import { isRecord } from "../utils/type-guards";
import { randomUUID } from "crypto";

type CommunicationCampground = {
  parkTimeZone?: string | null;
  timezone?: string | null;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
};

type CommunicationJob = {
  id: string;
  playbookId: string;
  campgroundId: string;
  attempts: number;
  scheduledAt: Date;
  metadata?: Prisma.JsonValue | null;
  reservationId?: string | null;
  guestId?: string | null;
};

type ConversationRow = {
  conversationId: string;
  lastMessageId: string;
  lastMessagePreview: string | null;
  lastMessageDirection: string;
  toAddress: string | null;
  fromAddress: string | null;
  guestId: string | null;
  lastMessageAt: Date;
  messageCount: bigint | number;
  unreadCount: bigint | number;
  guestFirstName: string | null;
  guestLastName: string | null;
  guestPhone: string | null;
};

type TwilioInboundBody = {
  From?: string;
  To?: string;
  MessageSid?: string;
  Body?: string;
  campgroundId?: string;
};

type TwilioStatusBody = {
  MessageSid?: string;
  MessageStatus?: string;
  SmsStatus?: string;
  ErrorCode?: string;
  To?: string;
  From?: string;
};

type PostmarkInboundBody = {
  FromFull?: { Email?: string };
  ToFull?: Array<{ Email?: string }>;
  Subject?: string;
  TextBody?: string;
  HtmlBody?: string;
  MessageID?: string;
  campgroundId?: string;
};

type PostmarkStatusBody = {
  MessageID?: string;
  RecordType?: string;
  BounceType?: string;
  BounceSubType?: string;
  Description?: string;
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const readString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const toJsonValue = (value: unknown): Prisma.InputJsonValue | undefined => {
  if (value === undefined || value === null) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return undefined;
  }
};

@Controller()
export class CommunicationsController {
  private readonly logger = new Logger(CommunicationsController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    private readonly npsService: NpsService,
    private readonly observability: ObservabilityService,
    private readonly alerting: AlertingService,
    private readonly aiAutoReplyService: AiAutoReplyService,
    private readonly aiSentimentService: AiSentimentService,
  ) {}

  private readonly commsMetricsEnabled =
    (process.env.ENABLE_COMMS_METRICS ?? process.env.comms_alerts_enabled ?? "true")
      .toString()
      .toLowerCase() === "true";

  private normalizePostmarkStatus(recordType?: string) {
    const rt = (recordType || "").toLowerCase();
    if (rt === "delivery") return "delivered";
    if (rt === "bounce") return "bounced";
    if (rt === "spamcomplaint") return "spam_complaint";
    if (rt === "deferred" || rt === "tempfail") return "deferred";
    if (rt === "open" || rt === "click") return "sent";
    return rt || "unknown";
  }

  private normalizeTwilioStatus(status?: string) {
    const s = (status || "").toLowerCase();
    if (s === "delivered") return "delivered";
    if (s === "sent") return "sent";
    if (s === "queued" || s === "accepted") return "queued";
    if (s === "failed" || s === "undelivered") return "failed";
    if (s === "receiving" || s === "received") return "received";
    return s || "unknown";
  }

  private getSenderDomain(address?: string) {
    if (!address) return null;
    const parts = address.split("@");
    return parts.length === 2 ? parts[1].toLowerCase() : null;
  }

  private ensureVerifiedSenderDomain(address?: string) {
    const allowedList = (process.env.EMAIL_SENDER_DOMAINS || "campreserv.com")
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
    const verifiedList = (process.env.EMAIL_VERIFIED_DOMAINS || "")
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
    const domain = this.getSenderDomain(address);
    if (!domain) {
      throw new BadRequestException("fromAddress must include a domain");
    }
    if (!allowedList.includes(domain)) {
      throw new BadRequestException(
        `Unverified sender domain ${domain}. Configure SPF/DKIM/DMARC and add to EMAIL_SENDER_DOMAINS.`,
      );
    }
    if (verifiedList.length > 0 && !verifiedList.includes(domain)) {
      throw new BadRequestException(
        `Sender domain ${domain} is not verified (SPF/DKIM/DMARC). Add to EMAIL_VERIFIED_DOMAINS after provider verification.`,
      );
    }
    return domain;
  }

  private normalizePhone(phone?: string) {
    if (!phone) return "";
    const digits = phone.replace(/\D/g, "");
    if (digits.length > 10) return digits.slice(-10);
    return digits;
  }

  /**
   * Generate a consistent conversation ID for SMS threading
   * This creates the same ID regardless of who sent the message
   */
  private generateSmsConversationId(phone1: string, phone2: string, campgroundId: string): string {
    const norm1 = this.normalizePhone(phone1);
    const norm2 = this.normalizePhone(phone2);
    // Sort to ensure same ID regardless of direction
    const sorted = [norm1, norm2].sort().join("-");
    // Include campgroundId to scope conversations per campground
    return `sms:${campgroundId}:${sorted}`;
  }

  private normalizeEmail(email?: string) {
    return email?.trim().toLowerCase() || "";
  }

  private getLocalTimeParts(date: Date, timeZone: string) {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts = dtf.formatToParts(date).reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});
    return {
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
      hour: Number(parts.hour),
      minute: Number(parts.minute),
      second: Number(parts.second),
    };
  }

  private getTimezoneOffsetMinutes(date: Date, timeZone: string) {
    const parts = this.getLocalTimeParts(date, timeZone);
    const asUTC = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    return (asUTC - date.getTime()) / 60000;
  }

  private buildZonedDate(
    parts: { year: number; month: number; day: number },
    time: { hour: number; minute: number },
    timeZone: string,
  ) {
    const baseUtc = Date.UTC(parts.year, parts.month - 1, parts.day, time.hour, time.minute, 0, 0);
    const offsetMinutes = this.getTimezoneOffsetMinutes(new Date(baseUtc), timeZone);
    return new Date(baseUtc - offsetMinutes * 60000);
  }

  private campgroundTz(campground: CommunicationCampground | null | undefined) {
    return campground?.parkTimeZone || campground?.timezone || "UTC";
  }

  private async ensureChannelConsent(
    channel: "email" | "sms",
    recipient: string | null,
    _body: SendCommunicationDto,
    campgroundId: string,
  ) {
    const normalized =
      channel === "email"
        ? this.normalizeEmail(recipient ?? "")
        : this.normalizePhone(recipient ?? "");
    const consentRequiredSetting = await this.prisma.privacySetting.findUnique({
      where: { campgroundId },
    });
    const consentRequired = consentRequiredSetting?.consentRequired !== false;
    if (!consentRequired) {
      return {
        consentOk: true,
        consentSource: "disabled",
        consentCheckedAt: new Date().toISOString(),
      };
    }

    if (!normalized) {
      throw new BadRequestException(`${channel} recipient missing, unable to verify consent`);
    }

    const latest = await this.prisma.consentLog.findFirst({
      where: { campgroundId, subject: normalized, consentType: channel },
      orderBy: { grantedAt: "desc" },
    });

    if (!latest || latest.revokedAt || (latest.expiresAt && latest.expiresAt < new Date())) {
      throw new BadRequestException(`Consent required for ${channel}; none on file or revoked`);
    }

    return {
      consentOk: true,
      consentSource: "consent_log",
      consentCheckedAt: new Date().toISOString(),
      consentSubject: normalized,
      consentGrantedAt: latest.grantedAt,
    };
  }

  private async requireTemplateApproval(templateId: string, campgroundId: string) {
    const tpl = await this.prisma.communicationTemplate.findUnique({ where: { id: templateId } });
    if (!tpl || tpl.campgroundId !== campgroundId) {
      throw new BadRequestException("Template not found for campground");
    }
    if (tpl.status !== "approved") {
      throw new BadRequestException("Template not approved");
    }
    return tpl;
  }

  private requireTemplateForOutbound(body: SendCommunicationDto, channel: "email" | "sms") {
    if (!body.templateId) {
      throw new BadRequestException(
        `Template is required for outbound ${channel}. Raw bodies are not permitted without an approved template.`,
      );
    }
  }

  private isQuietHours(campground: CommunicationCampground | null | undefined, date: Date) {
    if (!campground?.quietHoursStart || !campground?.quietHoursEnd) return false;
    const timeZone = this.campgroundTz(campground);
    const parts = this.getLocalTimeParts(date, timeZone);
    const minutes = parts.hour * 60 + parts.minute;
    const [sh, sm] = campground.quietHoursStart.split(":").map((n: string) => Number(n));
    const [eh, em] = campground.quietHoursEnd.split(":").map((n: string) => Number(n));
    const start = sh * 60 + (sm || 0);
    const end = eh * 60 + (em || 0);
    if (start === end) return false;
    if (start < end) return minutes >= start && minutes < end;
    return minutes >= start || minutes < end;
  }

  private async resolveGuestAndReservationByPhone(phone: string) {
    const normalized = this.normalizePhone(phone);
    if (!normalized) return { guestId: null, reservationId: null, campgroundId: null };

    const guest = await this.prisma.guest.findFirst({
      where: { phone: { contains: normalized } },
      select: { id: true },
    });

    if (!guest) return { guestId: null, reservationId: null, campgroundId: null };

    const reservation = await this.prisma.reservation.findFirst({
      where: { guestId: guest.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, campgroundId: true },
    });

    return {
      guestId: guest.id,
      reservationId: reservation?.id ?? null,
      campgroundId: reservation?.campgroundId ?? null,
    };
  }

  private ensureWebhookToken(token?: string) {
    const expected = process.env.TWILIO_WEBHOOK_TOKEN;
    if (!expected) return true; // allow if not set
    return token === expected;
  }

  private ensurePostmarkToken(token?: string) {
    const expected = process.env.POSTMARK_WEBHOOK_TOKEN;
    if (!expected) return true;
    return token === expected;
  }

  private recordComms(
    status: "delivered" | "sent" | "bounced" | "spam_complaint" | "failed",
    meta?: Record<string, unknown>,
  ) {
    if (!this.commsMetricsEnabled) return;
    this.observability.recordCommsStatus(status, meta);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @RequireScope({ resource: "communications", action: "write" })
  @Roles(
    UserRole.owner,
    UserRole.manager,
    UserRole.front_desk,
    UserRole.finance,
    UserRole.marketing,
    UserRole.readonly,
  )
  @Post("communications")
  async create(@Body() body: CreateCommunicationDto) {
    if (!body.guestId && !body.reservationId) {
      throw new BadRequestException("guestId or reservationId is required");
    }
    const communication = await this.prisma.communication.create({
      data: {
        id: randomUUID(),
        campgroundId: body.campgroundId,
        organizationId: body.organizationId ?? null,
        guestId: body.guestId ?? null,
        reservationId: body.reservationId ?? null,
        type: body.type,
        direction: body.direction,
        subject: body.subject ?? null,
        body: body.body ?? null,
        preview: body.body ? body.body.slice(0, 280) : null,
        status: body.direction === "inbound" ? "received" : "sent",
        provider: body.provider ?? null,
        providerMessageId: body.providerMessageId ?? null,
        toAddress: body.toAddress ?? null,
        fromAddress: body.fromAddress ?? null,
      },
    });
    return communication;
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @RequireScope({ resource: "communications", action: "read" })
  @Roles(
    UserRole.owner,
    UserRole.manager,
    UserRole.front_desk,
    UserRole.finance,
    UserRole.marketing,
    UserRole.readonly,
  )
  @Get("communications")
  async list(@Query() query: ListCommunicationsDto) {
    if (!query.campgroundId) throw new BadRequestException("campgroundId is required");
    const limit = Math.min(query.limit || 20, 100);

    const where: Prisma.CommunicationWhereInput = { campgroundId: query.campgroundId };
    if (query.guestId) where.guestId = query.guestId;
    if (query.reservationId) where.reservationId = query.reservationId;
    if (query.type) where.type = query.type;
    if (query.direction) where.direction = query.direction;

    const communications = await this.prisma.communication.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
    });

    const hasMore = communications.length > limit;
    const items = hasMore ? communications.slice(0, limit) : communications;

    return {
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  /**
   * Send outbound communication (email now; sms stub)
   */
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @RequireScope({ resource: "communications", action: "write" })
  @Roles(
    UserRole.owner,
    UserRole.manager,
    UserRole.front_desk,
    UserRole.finance,
    UserRole.marketing,
  )
  @Post("communications/send")
  async send(@Body() body: SendCommunicationDto) {
    if (!body.campgroundId) throw new BadRequestException("campgroundId is required");
    const prisma = this.prisma;
    const clientConsentProvided = body.consentGranted === true || Boolean(body.consentSource);
    if (clientConsentProvided) {
      // Do not trust client-provided consent flags; enforce server-side logs only.
      this.logger.debug("Client-provided consent flags ignored");
    }
    const campground = await this.prisma.campground.findUnique({
      where: { id: body.campgroundId },
      select: {
        id: true,
        quietHoursStart: true,
        quietHoursEnd: true,
        timezone: true,
        parkTimeZone: true,
      },
    });
    if (!campground) throw new BadRequestException("Invalid campgroundId");

    if (body.type === "email") {
      if (!body.toAddress) throw new BadRequestException("toAddress is required for email");
      this.requireTemplateForOutbound(body, "email");
      const template = body.templateId
        ? await this.requireTemplateApproval(body.templateId, body.campgroundId)
        : null;
      const consentMeta = await this.ensureChannelConsent(
        "email",
        body.toAddress,
        body,
        body.campgroundId,
      );
      if (this.isQuietHours(campground, new Date()) && !body.quietHoursOverride) {
        throw new BadRequestException("Quiet hours in effect; try again later or override");
      }
      const senderAddress = body.fromAddress || process.env.SMTP_FROM || "no-reply@keeprstay.com";
      const senderDomain = this.ensureVerifiedSenderDomain(senderAddress);
      const html = template?.bodyHtml ?? body.body ?? "";
      const subject = template?.subject ?? body.subject ?? "Message from campground";

      const comm = await prisma.communication.create({
        data: {
          id: randomUUID(),
          campgroundId: body.campgroundId,
          organizationId: body.organizationId ?? null,
          guestId: body.guestId ?? null,
          reservationId: body.reservationId ?? null,
          type: "email",
          direction: "outbound",
          subject,
          body: html,
          preview: html ? html.slice(0, 280) : (subject ?? null),
          status: "queued",
          provider: "postmark",
          providerMessageId: null,
          toAddress: body.toAddress,
          fromAddress: senderAddress,
          metadata: {
            senderDomain,
            senderDomainAllowed: true,
            templateId: template?.id ?? null,
            consentSource: consentMeta.consentSource,
            consentCheckedAt: consentMeta.consentCheckedAt,
            consentSubject: consentMeta.consentSubject ?? null,
            consentGrantedAt: consentMeta.consentGrantedAt ?? null,
            clientConsentProvided: clientConsentProvided || undefined,
          },
        },
      });

      try {
        const result = await this.emailService.sendEmail({
          to: body.toAddress,
          subject,
          html,
        });
        const updated = await prisma.communication.update({
          where: { id: comm.id },
          data: {
            status: "sent",
            provider: result.provider || "postmark",
            providerMessageId: result.providerMessageId ?? null,
            sentAt: new Date(),
            metadata: {
              ...(isRecord(comm.metadata) ? comm.metadata : {}),
              provider: result.provider,
              fallback: result.fallback,
            },
          },
        });
        this.recordComms("sent", { campgroundId: body.campgroundId, provider: result.provider });
        return updated;
      } catch (err) {
        await prisma.communication.update({
          where: { id: comm.id },
          data: {
            status: "failed",
            metadata: {
              ...(isRecord(comm.metadata) ? comm.metadata : {}),
              error: getErrorMessage(err),
            },
          },
        });
        this.recordComms("failed", {
          campgroundId: body.campgroundId,
          error: getErrorMessage(err),
        });
        throw new InternalServerErrorException("Failed to send email");
      }
    }

    if (body.type === "sms") {
      const toPhone = body.toPhone || body.toAddress;
      if (!toPhone) throw new BadRequestException("toPhone is required for sms");
      this.requireTemplateForOutbound(body, "sms");
      const consentMeta = await this.ensureChannelConsent("sms", toPhone, body, body.campgroundId);
      if (this.isQuietHours(campground, new Date()) && !body.quietHoursOverride) {
        throw new BadRequestException("Quiet hours in effect; try again later or override");
      }
      const normalizedPhone = this.normalizePhone(toPhone);
      const campgroundFromPhone = process.env.TWILIO_FROM_NUMBER || body.fromAddress || "";
      const conversationId = this.generateSmsConversationId(
        normalizedPhone,
        campgroundFromPhone,
        body.campgroundId,
      );
      const comm = await prisma.communication.create({
        data: {
          id: randomUUID(),
          campgroundId: body.campgroundId,
          organizationId: body.organizationId ?? null,
          guestId: body.guestId ?? null,
          reservationId: body.reservationId ?? null,
          conversationId,
          type: "sms",
          direction: "outbound",
          subject: null,
          body: body.body ?? null,
          preview: body.body ? body.body.slice(0, 280) : null,
          status: "queued",
          provider: "twilio",
          providerMessageId: null,
          toAddress: normalizedPhone,
          fromAddress: campgroundFromPhone || null,
          metadata: {
            consentSource: consentMeta.consentSource,
            consentCheckedAt: consentMeta.consentCheckedAt,
            consentSubject: consentMeta.consentSubject ?? null,
            consentGrantedAt: consentMeta.consentGrantedAt ?? null,
            clientConsentProvided: clientConsentProvided || undefined,
          },
        },
      });

      try {
        const result = await this.smsService.sendSms({
          to: normalizedPhone,
          body: body.body ?? "",
        });
        const updated = await prisma.communication.update({
          where: { id: comm.id },
          data: {
            status: result.success ? "sent" : "failed",
            provider: result.provider,
            providerMessageId: result.providerMessageId ?? null,
            metadata: {
              ...(isRecord(comm.metadata) ? comm.metadata : {}),
              fallback: result.fallback,
            },
          },
        });
        if (result.success) {
          this.recordComms("sent", { campgroundId: body.campgroundId, provider: result.provider });
        } else {
          this.recordComms("failed", {
            campgroundId: body.campgroundId,
            provider: result.provider,
          });
          await this.alerting
            .dispatch(
              "SMS send failure",
              `Failed to send SMS via ${result.provider} to ${normalizedPhone}`,
              "error",
              `sms-send-failure-${comm.id}`,
              {
                campgroundId: body.campgroundId,
                provider: result.provider,
                fallback: result.fallback,
              },
            )
            .catch(() => undefined);
        }
        if (!result.success) throw new InternalServerErrorException("Failed to send sms");
        return updated;
      } catch (err) {
        await prisma.communication.update({
          where: { id: comm.id },
          data: {
            status: "failed",
            metadata: {
              ...(isRecord(comm.metadata) ? comm.metadata : {}),
              error: getErrorMessage(err),
            },
          },
        });
        this.recordComms("failed", {
          campgroundId: body.campgroundId,
          error: getErrorMessage(err),
        });
        await this.alerting
          .dispatch(
            "SMS send failure",
            `SMS send errored for ${normalizedPhone}`,
            "error",
            `sms-send-error-${comm.id}`,
            { campgroundId: body.campgroundId, error: getErrorMessage(err) },
          )
          .catch(() => undefined);
        throw new InternalServerErrorException("Failed to send sms");
      }
    }

    // For other types just create a note record
    const comm = await prisma.communication.create({
      data: {
        id: randomUUID(),
        campgroundId: body.campgroundId,
        organizationId: body.organizationId ?? null,
        guestId: body.guestId ?? null,
        reservationId: body.reservationId ?? null,
        type: body.type,
        direction: "outbound",
        subject: body.subject ?? null,
        body: body.body ?? null,
        preview: body.body ? body.body.slice(0, 280) : (body.subject ?? null),
        status: "sent",
        provider: body.provider ?? null,
        providerMessageId: body.providerMessageId ?? null,
        toAddress: body.toAddress ?? null,
        fromAddress: body.fromAddress ?? null,
      },
    });
    return comm;
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @RequireScope({ resource: "communications", action: "read" })
  @Roles(
    UserRole.owner,
    UserRole.manager,
    UserRole.front_desk,
    UserRole.finance,
    UserRole.marketing,
    UserRole.readonly,
  )
  @Get("communications/sender-status")
  async senderStatus() {
    const allowedList = (process.env.EMAIL_SENDER_DOMAINS || "campreserv.com")
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
    const verifiedList = (process.env.EMAIL_VERIFIED_DOMAINS || "")
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
    const defaultFrom = process.env.SMTP_FROM || "no-reply@keeprstay.com";
    const domains = allowedList.map((d) => ({
      domain: d,
      allowed: true,
      verified: verifiedList.includes(d),
      issues: verifiedList.includes(d)
        ? []
        : ["Domain not in EMAIL_VERIFIED_DOMAINS (SPF/DKIM/DMARC not confirmed)"],
    }));
    const smsConfigured = Boolean(process.env.TWILIO_WEBHOOK_TOKEN);
    const commsAlertsEnabled = this.commsMetricsEnabled;
    return {
      allowedDomains: allowedList,
      verifiedDomains: verifiedList,
      domains,
      defaultFrom,
      configured: allowedList.length > 0,
      smsWebhookConfigured: smsConfigured,
      commsAlertsEnabled,
      enforcement: "fail_closed",
      note: "Domains must be listed in EMAIL_SENDER_DOMAINS and EMAIL_VERIFIED_DOMAINS after provider verification (SPF/DKIM/DMARC).",
    };
  }

  /**
   * Twilio inbound SMS webhook
   */
  @Post("communications/webhook/twilio")
  async twilioInbound(@Body() body: TwilioInboundBody, @Query("token") token?: string) {
    if (!this.ensureWebhookToken(token)) {
      throw new BadRequestException("Invalid webhook token");
    }
    const from = readString(body.From);
    const to = readString(body.To);
    const messageSid = readString(body.MessageSid);
    const text = readString(body.Body);
    if (!from || !to || !messageSid) {
      throw new BadRequestException("Missing required Twilio fields");
    }

    const { guestId, reservationId, campgroundId } =
      await this.resolveGuestAndReservationByPhone(from);
    const resolvedCampgroundId = body.campgroundId ?? campgroundId ?? "";
    const conversationId = resolvedCampgroundId
      ? this.generateSmsConversationId(from, to, resolvedCampgroundId)
      : null;

    const communication = await this.prisma.communication.create({
      data: {
        id: randomUUID(),
        campgroundId: resolvedCampgroundId,
        organizationId: null,
        guestId,
        reservationId,
        conversationId,
        type: "sms",
        direction: "inbound",
        subject: null,
        body: text ?? null,
        preview: text ? text.slice(0, 280) : null,
        status: "received",
        provider: "twilio",
        providerMessageId: messageSid,
        toAddress: to,
        fromAddress: from,
        receivedAt: new Date(),
      },
    });

    // Trigger AI processing (fire and forget)
    if (communication.campgroundId) {
      // Sentiment analysis
      this.aiSentimentService.analyzeCommunication(communication.id).catch((err) => {
        this.logger.warn(`AI sentiment analysis failed for ${communication.id}: ${err.message}`);
      });

      // Auto-reply processing
      this.aiAutoReplyService.processInboundMessage(communication.id).catch((err) => {
        this.logger.warn(`AI auto-reply processing failed for ${communication.id}: ${err.message}`);
      });
    }

    return { ok: true, id: communication.id };
  }

  /**
   * Twilio status webhook for outbound SMS
   */
  @Post("communications/webhook/twilio/status")
  async twilioStatus(@Body() body: TwilioStatusBody, @Query("token") token?: string) {
    if (!this.ensureWebhookToken(token)) {
      throw new BadRequestException("Invalid webhook token");
    }
    const messageSid = readString(body.MessageSid);
    if (!messageSid) {
      throw new BadRequestException("Missing MessageSid");
    }
    const status = this.normalizeTwilioStatus(
      readString(body.MessageStatus ?? body.SmsStatus) ?? "",
    );

    await this.prisma.communication.updateMany({
      where: { providerMessageId: messageSid },
      data: { status, metadata: body },
    });

    if (status === "failed") {
      this.recordComms("failed", { provider: "twilio" });
      await this.alerting
        .dispatch(
          "SMS delivery failure",
          `Twilio reported failure for message ${messageSid}`,
          "error",
          `sms-delivery-failure-${messageSid}`,
          {
            status: readString(body.MessageStatus ?? body.SmsStatus),
            to: body.To,
            from: body.From,
          },
        )
        .catch(() => undefined);
    } else if (status === "delivered") {
      this.recordComms("delivered", { provider: "twilio" });
    } else if (status === "sent" || status === "queued") {
      this.recordComms("sent", { provider: "twilio" });
    }
    return { ok: true };
  }

  /**
   * Postmark inbound email webhook
   */
  @Post("communications/webhook/postmark/inbound")
  async postmarkInbound(@Body() body: PostmarkInboundBody, @Query("token") token?: string) {
    if (!this.ensurePostmarkToken(token)) {
      throw new BadRequestException("Invalid webhook token");
    }
    const from = readString(body.FromFull?.Email);
    const to = readString(body.ToFull?.[0]?.Email);
    const subject = readString(body.Subject);
    const textBody = readString(body.TextBody);
    const messageId = readString(body.MessageID);

    if (!from || !to || !messageId) {
      throw new BadRequestException("Missing required Postmark fields");
    }

    // Best-effort match by sender email to guest
    const normalizedFrom = this.normalizeEmail(from);
    const guest = normalizedFrom
      ? await this.prisma.guest.findFirst({
          where: { email: { equals: normalizedFrom, mode: "insensitive" } },
          select: { id: true },
        })
      : null;

    const reservation = guest
      ? await this.prisma.reservation.findFirst({
          where: { guestId: guest.id },
          orderBy: { createdAt: "desc" },
          select: { id: true, campgroundId: true },
        })
      : null;

    const communication = await this.prisma.communication.create({
      data: {
        id: randomUUID(),
        campgroundId: body.campgroundId || reservation?.campgroundId || "",
        organizationId: null,
        guestId: guest?.id ?? null,
        reservationId: reservation?.id ?? null,
        type: "email",
        direction: "inbound",
        subject: subject ?? null,
        body: textBody ?? null,
        preview: textBody ? textBody.slice(0, 280) : (subject ?? null),
        status: "received",
        provider: "postmark",
        providerMessageId: messageId,
        toAddress: to,
        fromAddress: from,
        receivedAt: new Date(),
      },
    });

    // Trigger AI processing (fire and forget)
    if (communication.campgroundId) {
      // Sentiment analysis
      this.aiSentimentService.analyzeCommunication(communication.id).catch((err) => {
        this.logger.warn(`AI sentiment analysis failed for ${communication.id}: ${err.message}`);
      });

      // Auto-reply processing
      this.aiAutoReplyService.processInboundMessage(communication.id).catch((err) => {
        this.logger.warn(`AI auto-reply processing failed for ${communication.id}: ${err.message}`);
      });
    }

    return { ok: true, id: communication.id };
  }

  /**
   * Postmark delivery/bounce webhook
   */
  @HttpCode(200)
  @Post("communications/webhook/postmark/status")
  async postmarkStatus(@Body() body: PostmarkStatusBody, @Query("token") token?: string) {
    if (!this.ensurePostmarkToken(token)) {
      throw new BadRequestException("Invalid webhook token");
    }
    const messageId = readString(body.MessageID);
    if (!messageId) {
      throw new BadRequestException("Missing MessageID");
    }
    const status = this.normalizePostmarkStatus(body.RecordType);
    const bounceTypeRaw = body.BounceType;
    const bounceType = (bounceTypeRaw || "").toString().toLowerCase();
    const isHardFail =
      status === "bounced" || status === "spam_complaint" || bounceType === "hardbounce";
    const finalStatus = isHardFail ? "failed" : status;
    const metadata = {
      ...body,
      normalizedStatus: status,
      bounceType: bounceTypeRaw,
      bounceSubType: body.BounceSubType,
      description: body.Description,
    };

    await this.prisma.communication.updateMany({
      where: { providerMessageId: messageId },
      data: { status: finalStatus, metadata },
    });

    if (finalStatus === "failed" || finalStatus === "bounced") {
      this.recordComms("bounced", { provider: "postmark", bounceType });
      await this.alerting.dispatch(
        "Email bounced",
        `Postmark message ${messageId} bounced (${bounceType || status})`,
        "warning",
        `postmark-bounce-${messageId}`,
        { bounceType: bounceTypeRaw || body.BounceType, description: body.Description },
      );
    } else if (finalStatus === "spam_complaint") {
      this.recordComms("spam_complaint", { provider: "postmark" });
      await this.alerting.dispatch(
        "Spam complaint",
        `Postmark complaint for message ${messageId}`,
        "error",
        `postmark-complaint-${messageId}`,
        { bounceType, description: body.Description },
      );
    } else if (finalStatus === "delivered" || finalStatus === "sent") {
      this.recordComms("delivered", { provider: "postmark" });
    }
    return { ok: true };
  }

  // ===========================================================================
  // TEMPLATES
  // ===========================================================================

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.marketing)
  @Get("communications/templates")
  async listTemplates(
    @Query("campgroundId") campgroundId?: string,
    @Query("status") status?: string,
  ) {
    if (!campgroundId) throw new BadRequestException("campgroundId is required");
    const where: Prisma.CommunicationTemplateWhereInput = { campgroundId };
    if (status) where.status = status;
    const templates = await this.prisma.communicationTemplate.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
    });
    return templates;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.marketing)
  @Post("communications/templates")
  async createTemplate(
    @Body() body: { campgroundId: string; name: string; subject?: string; bodyHtml?: string },
  ) {
    if (!body.campgroundId || !body.name) {
      throw new BadRequestException("campgroundId and name are required");
    }
    const template = await this.prisma.communicationTemplate.create({
      data: {
        id: randomUUID(),
        campgroundId: body.campgroundId,
        name: body.name,
        subject: body.subject ?? null,
        bodyHtml: body.bodyHtml ?? null,
        status: "draft",
        version: 1,
        auditLog: [{ action: "created", at: new Date().toISOString() }],
        updatedAt: new Date(),
      },
    });
    return template;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.marketing)
  @Patch("communications/templates/:id")
  async updateTemplate(
    @Param("id") id: string,
    @Body()
    body: {
      name?: string;
      subject?: string;
      bodyHtml?: string;
      status?: string;
      campgroundId?: string;
    },
    @Query("campgroundId") campgroundId?: string,
  ) {
    const existing = await this.prisma.communicationTemplate.findUnique({ where: { id } });
    if (!existing) throw new BadRequestException("Template not found");
    if (campgroundId && existing.campgroundId !== campgroundId) {
      throw new BadRequestException("Unauthorized campground scope");
    }

    const before: Record<string, unknown> = {
      name: existing.name,
      subject: existing.subject,
      bodyHtml: existing.bodyHtml,
      status: existing.status,
    };
    const after: Record<string, unknown> = {
      name: body.name,
      subject: body.subject,
      bodyHtml: body.bodyHtml,
      status: body.status,
    };
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const key of ["name", "subject", "bodyHtml", "status"]) {
      const afterValue = after[key];
      const beforeValue = before[key];
      if (afterValue !== undefined && afterValue !== beforeValue) {
        changes[key] = { from: beforeValue, to: afterValue };
      }
    }

    const auditEntry = {
      action: "updated",
      at: new Date().toISOString(),
      changes,
    };
    const auditLog =
      toJsonValue([...(Array.isArray(existing.auditLog) ? existing.auditLog : []), auditEntry]) ??
      [];

    const updated = await this.prisma.communicationTemplate.update({
      where: { id },
      data: {
        name: body.name ?? existing.name,
        subject: body.subject ?? existing.subject,
        bodyHtml: body.bodyHtml ?? existing.bodyHtml,
        status: body.status ?? existing.status,
        auditLog,
      },
    });
    return updated;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.marketing)
  @Get("communications/playbooks/jobs")
  async listJobs(@Query("campgroundId") campgroundId?: string, @Query("status") status?: string) {
    if (!campgroundId) throw new BadRequestException("campgroundId is required");
    const where: Prisma.CommunicationPlaybookJobWhereInput = { campgroundId };
    if (status) where.status = status;
    return this.prisma.communicationPlaybookJob.findMany({
      where,
      orderBy: [{ scheduledAt: "asc" }],
    });
  }

  private async processJob(job: CommunicationJob) {
    const playbook = await this.prisma.communicationPlaybook.findUnique({
      where: { id: job.playbookId },
      include: { Campground: true, CommunicationTemplate: true },
    });
    if (!playbook || !playbook.enabled) {
      await this.prisma.communicationPlaybookJob.update({
        where: { id: job.id },
        data: { status: "skipped", lastError: "Playbook disabled" },
      });
      return;
    }
    const campground = playbook.Campground;
    const template = playbook.CommunicationTemplate;
    if (!template || template.status !== "approved") {
      await this.prisma.communicationPlaybookJob.update({
        where: { id: job.id },
        data: { status: "skipped", lastError: "Template not approved" },
      });
      return;
    }
    const now = new Date();
    if (this.isQuietHours(campground, now)) {
      // reschedule to quietHoursEnd in campground timezone
      const [eh, em] = (campground.quietHoursEnd || "08:00")
        .split(":")
        .map((n: string) => Number(n));
      const tz = this.campgroundTz(campground);
      const localParts = this.getLocalTimeParts(now, tz);
      const next = this.buildZonedDate(
        { year: localParts.year, month: localParts.month, day: localParts.day },
        { hour: eh || 8, minute: em || 0 },
        tz,
      );
      if (next <= now) {
        const tomorrow = new Date(next.getTime() + 24 * 60 * 60 * 1000);
        const tomorrowParts = this.getLocalTimeParts(tomorrow, tz);
        next.setTime(
          this.buildZonedDate(
            { year: tomorrowParts.year, month: tomorrowParts.month, day: tomorrowParts.day },
            { hour: eh || 8, minute: em || 0 },
            tz,
          ).getTime(),
        );
      }
      await this.prisma.communicationPlaybookJob.update({
        where: { id: job.id },
        data: { scheduledAt: next, attempts: job.attempts + 1 },
      });
      return;
    }

    const reservation = job.reservationId
      ? await this.prisma.reservation.findUnique({
          where: { id: job.reservationId },
          include: { Guest: true },
        })
      : null;
    const guest =
      reservation?.Guest ||
      (job.guestId ? await this.prisma.guest.findUnique({ where: { id: job.guestId } }) : null);

    const toEmail = guest?.email || reservation?.Guest?.email;
    const toPhone = guest?.phone || reservation?.Guest?.phone;

    try {
      await this.prisma.communicationPlaybookJob.update({
        where: { id: job.id },
        data: { status: "processing", attempts: job.attempts + 1 },
      });

      if (playbook.type === "nps") {
        if (!toEmail) throw new BadRequestException("Missing recipient email");
        const metadata = isRecord(job.metadata) ? job.metadata : {};
        const surveyId = readString(metadata.surveyId);
        if (!surveyId) throw new BadRequestException("Missing surveyId for NPS job");
        const templateId = readString(metadata.templateId) ?? playbook.templateId ?? null;
        await this.npsService.createInvite({
          surveyId,
          campgroundId: job.campgroundId,
          guestId: job.guestId ?? undefined,
          reservationId: job.reservationId ?? undefined,
          channel: "email",
          email: toEmail,
          templateId: templateId ?? undefined,
          expireDays: 30,
        });
      } else if (playbook.channel === "email") {
        if (!toEmail) throw new BadRequestException("Missing recipient email");
        await this.emailService.sendEmail({
          to: toEmail,
          subject: template.subject || "Message from campground",
          html: template.bodyHtml || "",
        });
      } else if (playbook.channel === "sms") {
        if (!toPhone) throw new BadRequestException("Missing recipient phone");
        await this.smsService.sendSms({
          to: toPhone,
          body: template.bodyHtml || template.subject || "Message",
        });
      }

      await this.prisma.communicationPlaybookJob.update({
        where: { id: job.id },
        data: { status: "sent", lastError: null },
      });
    } catch (err) {
      const attempts = job.attempts + 1;
      const maxAttempts = 3;
      const nextTime = new Date(now);
      nextTime.setMinutes(nextTime.getMinutes() + Math.min(30, attempts * 5));
      await this.prisma.communicationPlaybookJob.update({
        where: { id: job.id },
        data: {
          status: attempts >= maxAttempts ? "failed" : "pending",
          scheduledAt: attempts >= maxAttempts ? job.scheduledAt : nextTime,
          attempts,
          lastError: getErrorMessage(err) || "Send failed",
        },
      });
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.marketing)
  @Post("communications/playbooks/run")
  async runPlaybookJobs(@Query("campgroundId") campgroundId?: string) {
    const now = new Date();
    const jobs = await this.prisma.communicationPlaybookJob.findMany({
      where: {
        status: "pending",
        scheduledAt: { lte: now },
        ...(campgroundId ? { campgroundId } : {}),
      },
      orderBy: { scheduledAt: "asc" },
      take: 25,
    });
    for (const job of jobs) {
      await this.processJob(job);
    }
    return { processed: jobs.length };
  }

  @Cron("*/5 * * * *") // every 5 minutes
  async cronRunPlaybookJobs() {
    await this.runPlaybookJobs();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.marketing)
  @Post("communications/playbooks/jobs/:id/retry")
  async retryPlaybookJob(@Param("id") id: string, @Query("campgroundId") campgroundId?: string) {
    const job = await this.prisma.communicationPlaybookJob.findUnique({ where: { id } });
    if (!job) throw new BadRequestException("Job not found");
    if (campgroundId && job.campgroundId !== campgroundId) {
      throw new BadRequestException("Job does not belong to this campground");
    }
    const updated = await this.prisma.communicationPlaybookJob.update({
      where: { id },
      data: {
        status: "pending",
        scheduledAt: new Date(),
        lastError: null,
      },
    });
    return updated;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Post("communications/playbooks/enqueue-unpaid")
  async enqueueUnpaidPlaybooks(@Query("campgroundId") campgroundId?: string) {
    const reservations = await this.prisma.reservation.findMany({
      where: {
        ...(campgroundId ? { campgroundId } : {}),
        status: { not: "cancelled" },
        totalAmount: { gt: 0 },
      },
      select: { id: true, campgroundId: true, guestId: true, totalAmount: true, paidAmount: true },
    });

    const due = reservations.filter((r) => Number(r.paidAmount || 0) < Number(r.totalAmount || 0));

    const playbooks = await this.prisma.communicationPlaybook.findMany({
      where: {
        ...(campgroundId ? { campgroundId } : {}),
        type: "unpaid",
        enabled: true,
        templateId: { not: null },
      },
    });

    let enqueued = 0;
    for (const pb of playbooks) {
      if (!pb.templateId) continue;
      const tpl = await this.prisma.communicationTemplate.findFirst({
        where: { id: pb.templateId, status: "approved" },
      });
      if (!tpl) continue;
      for (const r of due.filter((d) => d.campgroundId === pb.campgroundId)) {
        const scheduledAt = new Date();
        if (pb.offsetMinutes && Number.isFinite(pb.offsetMinutes)) {
          scheduledAt.setMinutes(scheduledAt.getMinutes() + pb.offsetMinutes);
        }
        await this.prisma.communicationPlaybookJob.create({
          data: {
            id: randomUUID(),
            playbookId: pb.id,
            campgroundId: r.campgroundId,
            reservationId: r.id,
            guestId: r.guestId,
            status: "pending",
            scheduledAt,
            updatedAt: new Date(),
          },
        });
        enqueued++;
      }
    }

    return { enqueued };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager)
  @Post("communications/templates/:id/approve")
  async approveTemplate(
    @Param("id") id: string,
    @Body() body: { reason?: string },
    @Query("campgroundId") campgroundId?: string,
    @Query("actorId") actorId?: string,
  ) {
    const existing = await this.prisma.communicationTemplate.findUnique({ where: { id } });
    if (!existing) throw new BadRequestException("Template not found");
    if (campgroundId && existing.campgroundId !== campgroundId) {
      throw new BadRequestException("Unauthorized campground scope");
    }
    const auditEntry = {
      action: "approved",
      at: new Date().toISOString(),
      actorId: actorId ?? null,
      reason: body.reason ?? null,
    };
    const auditLog =
      toJsonValue([...(Array.isArray(existing.auditLog) ? existing.auditLog : []), auditEntry]) ??
      [];
    const updated = await this.prisma.communicationTemplate.update({
      where: { id },
      data: {
        status: "approved",
        approvedById: actorId ?? null,
        approvedAt: new Date(),
        auditLog,
      },
    });
    return updated;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager)
  @Post("communications/templates/:id/reject")
  async rejectTemplate(
    @Param("id") id: string,
    @Body() body: { reason?: string },
    @Query("campgroundId") campgroundId?: string,
    @Query("actorId") actorId?: string,
  ) {
    const existing = await this.prisma.communicationTemplate.findUnique({ where: { id } });
    if (!existing) throw new BadRequestException("Template not found");
    if (campgroundId && existing.campgroundId !== campgroundId) {
      throw new BadRequestException("Unauthorized campground scope");
    }
    const auditEntry = {
      action: "rejected",
      at: new Date().toISOString(),
      actorId: actorId ?? null,
      reason: body.reason ?? null,
    };
    const auditLog =
      toJsonValue([...(Array.isArray(existing.auditLog) ? existing.auditLog : []), auditEntry]) ??
      [];
    const updated = await this.prisma.communicationTemplate.update({
      where: { id },
      data: {
        status: "rejected",
        approvedById: null,
        approvedAt: null,
        auditLog,
      },
    });
    return updated;
  }

  // ===========================================================================
  // PLAYBOOKS (CRUD only; wiring to events pending)
  // ===========================================================================

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.marketing)
  @Get("communications/playbooks")
  async listPlaybooks(@Query("campgroundId") campgroundId?: string) {
    if (!campgroundId) throw new BadRequestException("campgroundId is required");
    return this.prisma.communicationPlaybook.findMany({
      where: { campgroundId },
      orderBy: { updatedAt: "desc" },
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.marketing)
  @Post("communications/playbooks")
  async createPlaybook(
    @Body()
    body: {
      campgroundId: string;
      type: string;
      enabled?: boolean;
      templateId?: string;
      channel?: string;
      offsetMinutes?: number;
      quietHoursStart?: string;
      quietHoursEnd?: string;
      throttlePerMinute?: number;
      routingAssigneeId?: string;
    },
  ) {
    if (!body.campgroundId || !body.type)
      throw new BadRequestException("campgroundId and type are required");
    return this.prisma.communicationPlaybook.create({
      data: {
        id: randomUUID(),
        campgroundId: body.campgroundId,
        type: body.type,
        enabled: body.enabled ?? false,
        templateId: body.templateId ?? null,
        channel: body.channel ?? null,
        offsetMinutes: body.offsetMinutes ?? null,
        quietHoursStart: body.quietHoursStart ?? null,
        quietHoursEnd: body.quietHoursEnd ?? null,
        throttlePerMinute: body.throttlePerMinute ?? null,
        routingAssigneeId: body.routingAssigneeId ?? null,
        updatedAt: new Date(),
      },
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.marketing)
  @Patch("communications/playbooks/:id")
  async updatePlaybook(
    @Param("id") id: string,
    @Body()
    body: {
      campgroundId?: string;
      enabled?: boolean;
      templateId?: string | null;
      channel?: string | null;
      offsetMinutes?: number | null;
      quietHoursStart?: string | null;
      quietHoursEnd?: string | null;
      throttlePerMinute?: number | null;
      routingAssigneeId?: string | null;
    },
    @Query("campgroundId") campgroundId?: string,
  ) {
    const existing = await this.prisma.communicationPlaybook.findUnique({ where: { id } });
    if (!existing) throw new BadRequestException("Playbook not found");
    if (campgroundId && existing.campgroundId !== campgroundId) {
      throw new BadRequestException("Unauthorized campground scope");
    }
    return this.prisma.communicationPlaybook.update({
      where: { id },
      data: {
        enabled: body.enabled ?? existing.enabled,
        templateId: body.templateId !== undefined ? body.templateId : existing.templateId,
        channel: body.channel !== undefined ? body.channel : existing.channel,
        offsetMinutes:
          body.offsetMinutes !== undefined ? body.offsetMinutes : existing.offsetMinutes,
        quietHoursStart:
          body.quietHoursStart !== undefined ? body.quietHoursStart : existing.quietHoursStart,
        quietHoursEnd:
          body.quietHoursEnd !== undefined ? body.quietHoursEnd : existing.quietHoursEnd,
        throttlePerMinute:
          body.throttlePerMinute !== undefined
            ? body.throttlePerMinute
            : existing.throttlePerMinute,
        routingAssigneeId:
          body.routingAssigneeId !== undefined
            ? body.routingAssigneeId
            : existing.routingAssigneeId,
      },
    });
  }

  // ===========================================================================
  // SMS CONVERSATIONS (Threading)
  // ===========================================================================

  /**
   * List SMS conversations (grouped by conversationId)
   */
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @RequireScope({ resource: "communications", action: "read" })
  @Roles(
    UserRole.owner,
    UserRole.manager,
    UserRole.front_desk,
    UserRole.finance,
    UserRole.marketing,
    UserRole.readonly,
  )
  @Get("communications/sms/conversations")
  async listSmsConversations(@Query("campgroundId") campgroundId?: string) {
    if (!campgroundId) throw new BadRequestException("campgroundId is required");

    // Get the latest message per conversationId, plus metadata
    const conversations = await this.prisma.$queryRaw<ConversationRow[]>`
      WITH latest_messages AS (
        SELECT
          "conversationId",
          MAX("createdAt") as "lastMessageAt",
          COUNT(*) as "messageCount",
          SUM(CASE WHEN direction = 'inbound' AND status = 'received' THEN 1 ELSE 0 END) as "unreadCount"
        FROM "Communication"
        WHERE "campgroundId" = ${campgroundId}
          AND type = 'sms'
          AND "conversationId" IS NOT NULL
        GROUP BY "conversationId"
      )
      SELECT
        c."conversationId",
        c.id as "lastMessageId",
        c.body as "lastMessagePreview",
        c.direction as "lastMessageDirection",
        c."toAddress",
        c."fromAddress",
        c."guestId",
        c."createdAt" as "lastMessageAt",
        lm."messageCount",
        lm."unreadCount",
        g."primaryFirstName" as "guestFirstName",
        g."primaryLastName" as "guestLastName",
        g.phone as "guestPhone"
      FROM "Communication" c
      INNER JOIN latest_messages lm ON c."conversationId" = lm."conversationId" AND c."createdAt" = lm."lastMessageAt"
      LEFT JOIN "Guest" g ON c."guestId" = g.id
      WHERE c."campgroundId" = ${campgroundId}
        AND c.type = 'sms'
      ORDER BY c."createdAt" DESC
    `;

    return conversations.map((conv) => ({
      conversationId: conv.conversationId,
      lastMessageId: conv.lastMessageId,
      lastMessagePreview: conv.lastMessagePreview?.slice(0, 100) || "",
      lastMessageDirection: conv.lastMessageDirection,
      lastMessageAt: conv.lastMessageAt,
      messageCount: Number(conv.messageCount),
      unreadCount: Number(conv.unreadCount),
      guestId: conv.guestId,
      guestName:
        conv.guestFirstName || conv.guestLastName
          ? `${conv.guestFirstName || ""} ${conv.guestLastName || ""}`.trim()
          : null,
      phoneNumber: conv.lastMessageDirection === "inbound" ? conv.fromAddress : conv.toAddress,
    }));
  }

  /**
   * Get messages in an SMS conversation
   */
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @RequireScope({ resource: "communications", action: "read" })
  @Roles(
    UserRole.owner,
    UserRole.manager,
    UserRole.front_desk,
    UserRole.finance,
    UserRole.marketing,
    UserRole.readonly,
  )
  @Get("communications/sms/conversations/:conversationId")
  async getSmsConversation(
    @Param("conversationId") conversationId: string,
    @Query("campgroundId") campgroundId?: string,
    @Query("limit") limit?: string,
  ) {
    if (!campgroundId) throw new BadRequestException("campgroundId is required");
    const take = Math.min(Number(limit) || 50, 200);

    const messages = await this.prisma.communication.findMany({
      where: {
        campgroundId,
        conversationId,
        type: "sms",
      },
      orderBy: { createdAt: "asc" },
      take,
      include: {
        Guest: {
          select: {
            id: true,
            primaryFirstName: true,
            primaryLastName: true,
            phone: true,
          },
        },
        Reservation: {
          select: {
            id: true,
            arrivalDate: true,
            departureDate: true,
            status: true,
            Site: {
              select: {
                siteNumber: true,
              },
            },
          },
        },
      },
    });

    const mappedMessages = messages.map(({ Guest, Reservation, ...rest }) => {
      const reservation = Reservation
        ? {
            ...Reservation,
            site: Reservation.Site ?? null,
          }
        : null;
      return {
        ...rest,
        guest: Guest ?? null,
        reservation,
      };
    });

    return { messages: mappedMessages, conversationId };
  }

  /**
   * Send a reply in an SMS conversation
   */
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @RequireScope({ resource: "communications", action: "write" })
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk, UserRole.marketing)
  @Post("communications/sms/conversations/:conversationId/reply")
  async replySmsConversation(
    @Param("conversationId") conversationId: string,
    @Body() body: { campgroundId: string; message: string; toPhone?: string },
  ) {
    if (!body.campgroundId || !body.message) {
      throw new BadRequestException("campgroundId and message are required");
    }

    // Get the conversation to find the phone number to reply to
    const lastMessage = await this.prisma.communication.findFirst({
      where: {
        campgroundId: body.campgroundId,
        conversationId,
        type: "sms",
      },
      orderBy: { createdAt: "desc" },
    });

    if (!lastMessage) {
      throw new BadRequestException("Conversation not found");
    }

    // Determine the recipient (the other party in the conversation)
    const toPhone =
      body.toPhone ||
      (lastMessage.direction === "inbound" ? lastMessage.fromAddress : lastMessage.toAddress);
    if (!toPhone) {
      throw new BadRequestException("Could not determine recipient phone number");
    }

    const normalizedPhone = this.normalizePhone(toPhone);
    const campgroundFromPhone = process.env.TWILIO_FROM_NUMBER || "";

    const comm = await this.prisma.communication.create({
      data: {
        id: randomUUID(),
        campgroundId: body.campgroundId,
        organizationId: null,
        guestId: lastMessage.guestId,
        reservationId: lastMessage.reservationId,
        conversationId,
        type: "sms",
        direction: "outbound",
        subject: null,
        body: body.message,
        preview: body.message.slice(0, 280),
        status: "queued",
        provider: "twilio",
        providerMessageId: null,
        toAddress: normalizedPhone,
        fromAddress: campgroundFromPhone,
      },
    });

    try {
      const result = await this.smsService.sendSms({ to: normalizedPhone, body: body.message });
      const updated = await this.prisma.communication.update({
        where: { id: comm.id },
        data: {
          status: result.success ? "sent" : "failed",
          provider: result.provider,
          providerMessageId: result.providerMessageId ?? null,
          sentAt: new Date(),
        },
      });

      if (result.success) {
        this.recordComms("sent", { campgroundId: body.campgroundId, provider: result.provider });
      } else {
        this.recordComms("failed", { campgroundId: body.campgroundId, provider: result.provider });
      }

      return updated;
    } catch (err) {
      await this.prisma.communication.update({
        where: { id: comm.id },
        data: { status: "failed", metadata: { error: getErrorMessage(err) } },
      });
      this.recordComms("failed", { campgroundId: body.campgroundId, error: getErrorMessage(err) });
      throw new InternalServerErrorException("Failed to send SMS reply");
    }
  }

  /**
   * Mark SMS conversation messages as read
   */
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @RequireScope({ resource: "communications", action: "write" })
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk, UserRole.marketing)
  @Patch("communications/sms/conversations/:conversationId/read")
  async markSmsConversationRead(
    @Param("conversationId") conversationId: string,
    @Query("campgroundId") campgroundId?: string,
  ) {
    if (!campgroundId) throw new BadRequestException("campgroundId is required");

    // Mark inbound messages as "delivered" (read)
    const result = await this.prisma.communication.updateMany({
      where: {
        campgroundId,
        conversationId,
        type: "sms",
        direction: "inbound",
        status: "received",
      },
      data: {
        status: "delivered",
      },
    });

    return { updated: result.count };
  }
}
