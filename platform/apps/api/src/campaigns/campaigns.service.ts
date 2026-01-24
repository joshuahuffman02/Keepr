import { randomUUID } from "node:crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { CampaignSendStatus, SiteType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCampaignDto } from "./dto/create-campaign.dto";
import { UpdateCampaignDto } from "./dto/update-campaign.dto";
import { EmailService } from "../email/email.service";
import { SmsService } from "../sms/sms.service";
import { CreateTemplateDto } from "./dto/create-template.dto";
import { AudienceFiltersDto } from "./dto/audience.dto";

type ChannelType = "email" | "sms" | "both";
const ChannelTypeValues: Record<ChannelType, ChannelType> = {
  email: "email",
  sms: "sms",
  both: "both",
};

const isChannelType = (value: string): value is ChannelType =>
  value === ChannelTypeValues.email ||
  value === ChannelTypeValues.sms ||
  value === ChannelTypeValues.both;

const siteTypeValues = new Set<string>(Object.values(SiteType));
const isSiteType = (value: string): value is SiteType => siteTypeValues.has(value);

type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "cancelled";
const CampaignStatusValues: Record<CampaignStatus, CampaignStatus> = {
  draft: "draft",
  scheduled: "scheduled",
  sending: "sending",
  sent: "sent",
  cancelled: "cancelled",
};

const toJsonValue = (value: unknown): Prisma.InputJsonValue | undefined => {
  if (value === undefined || value === null) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return undefined;
  }
};

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
  ) {}

  private appendEmailFooter(html: string) {
    const footer = `
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
      <p style="font-size:12px;color:#64748b;margin:0;">
        You received this because you opted in to updates from this campground.
        <br/>To unsubscribe, reply to this email or update your preferences.
      </p>
    `;
    return `${html}${footer}`;
  }

  private appendSmsFooter(body: string) {
    const stop = " Reply STOP to opt out.";
    return body.includes("STOP") ? body : `${body}${stop}`;
  }

  create(dto: CreateCampaignDto) {
    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    return this.prisma.campaign.create({
      data: {
        id: randomUUID(),
        campgroundId: dto.campgroundId,
        name: dto.name,
        subject: dto.subject,
        fromEmail: dto.fromEmail,
        fromName: dto.fromName || null,
        html: dto.html,
        textBody: dto.textBody || null,
        channel: dto.channel || ChannelTypeValues.email,
        status: CampaignStatusValues.draft,
        variables: toJsonValue(dto.variables),
        scheduledAt,
      },
    });
  }

  createTemplate(dto: CreateTemplateDto) {
    const templateClient = this.prisma.campaignTemplate;
    if (!templateClient?.create) return null;
    return templateClient.create({
      data: {
        id: randomUUID(),
        campgroundId: dto.campgroundId,
        name: dto.name,
        channel: dto.channel || ChannelTypeValues.email,
        category: dto.category || "general",
        subject: dto.subject || null,
        html: dto.html || null,
        textBody: dto.textBody || null,
      },
    });
  }

  listTemplates(campgroundId: string) {
    const templateClient = this.prisma.campaignTemplate;
    if (!templateClient?.findMany) return [];
    return templateClient.findMany({
      where: { campgroundId },
      orderBy: { updatedAt: "desc" },
    });
  }

  async updateTemplate(
    id: string,
    data: Partial<{
      name: string;
      channel: string;
      category: string;
      subject: string | null;
      html: string | null;
      textBody: string | null;
    }>,
  ) {
    const templateClient = this.prisma.campaignTemplate;
    if (!templateClient?.update) throw new NotFoundException("Template model not available");
    const existing = await templateClient.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Template not found");
    let channel: ChannelType | undefined;
    if (data.channel !== undefined) {
      if (!isChannelType(data.channel)) {
        throw new BadRequestException("Invalid channel");
      }
      channel = data.channel;
    }
    const updateData: Prisma.CampaignTemplateUpdateInput = {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(channel !== undefined ? { channel } : {}),
      ...(data.category !== undefined ? { category: data.category } : {}),
      ...(data.subject !== undefined ? { subject: data.subject } : {}),
      ...(data.html !== undefined ? { html: data.html } : {}),
      ...(data.textBody !== undefined ? { textBody: data.textBody } : {}),
    };
    return templateClient.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteTemplate(id: string) {
    const templateClient = this.prisma.campaignTemplate;
    if (!templateClient?.delete) throw new NotFoundException("Template model not available");
    const existing = await templateClient.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Template not found");
    await templateClient.delete({ where: { id } });
    return { success: true };
  }

  async audiencePreview(filters: AudienceFiltersDto) {
    const whereReservation: Prisma.ReservationWhereInput = {
      ...(filters.campgroundId ? { campgroundId: filters.campgroundId } : {}),
    };
    if (filters.stayedFrom || filters.stayedTo) {
      const departureDate: Prisma.DateTimeFilter = {};
      if (filters.stayedFrom) departureDate.gte = new Date(filters.stayedFrom);
      if (filters.stayedTo) departureDate.lte = new Date(filters.stayedTo);
      whereReservation.departureDate = departureDate;
    }
    if (filters.stayFrom || filters.stayTo) {
      const arrivalDate: Prisma.DateTimeFilter = {};
      if (filters.stayFrom) arrivalDate.gte = new Date(filters.stayFrom);
      if (filters.stayTo) arrivalDate.lte = new Date(filters.stayTo);
      whereReservation.arrivalDate = arrivalDate;
    }
    const siteType = filters.siteType
      ? isSiteType(filters.siteType)
        ? filters.siteType
        : undefined
      : undefined;
    if (filters.siteType && !siteType) {
      throw new BadRequestException("Invalid site type");
    }

    const guests = await this.prisma.guest.findMany({
      where: {
        marketingOptIn: true,
        email: { not: "" },
        Reservation: {
          some: {
            ...whereReservation,
            ...(siteType ? { Site: { siteType } } : {}),
            ...(filters.siteClassId ? { siteClassId: filters.siteClassId } : {}),
          },
        },
        ...(filters.state ? { state: filters.state } : {}),
        ...(filters.vip ? { vip: true } : {}),
        ...(filters.loyaltyTier ? { loyaltyProfile: { tier: filters.loyaltyTier } } : {}),
      },
      select: {
        id: true,
        email: true,
        phone: true,
        primaryFirstName: true,
        primaryLastName: true,
        Reservation: {
          select: { arrivalDate: true, departureDate: true, promoCode: true },
          orderBy: { arrivalDate: "desc" },
          take: 1,
        },
      },
      take: 200,
    });

    const currentYear = new Date().getFullYear();
    const filtered = guests.filter((g) => {
      const lastStay = g.Reservation[0]?.departureDate;
      if (
        filters.lastStayBefore &&
        lastStay &&
        new Date(lastStay) >= new Date(filters.lastStayBefore)
      )
        return false;
      if (filters.notStayedThisYear && lastStay && new Date(lastStay).getFullYear() === currentYear)
        return false;
      if (filters.promoUsed && !g.Reservation[0]?.promoCode) return false;
      return true;
    });

    return {
      count: filtered.length,
      sample: filtered.slice(0, 20).map((g) => ({
        id: g.id,
        name: `${g.primaryFirstName || ""} ${g.primaryLastName || ""}`.trim(),
        email: g.email,
        phone: g.phone,
        lastStay: g.Reservation[0]?.departureDate || null,
      })),
    };
  }

  async suggestions(campgroundId: string) {
    // Expanded suggestions: occupancy, lapsed, promo, loyalty
    const now = new Date();
    const end14 = new Date();
    end14.setDate(now.getDate() + 14);
    const end30 = new Date();
    end30.setDate(now.getDate() + 30);

    const siteCounts = await this.prisma.site.groupBy({
      by: ["siteType"],
      where: { campgroundId, isActive: true },
      _count: { _all: true },
    });

    const reservations = await this.prisma.reservation.findMany({
      where: {
        campgroundId,
        status: { not: "cancelled" },
        arrivalDate: { lt: end14 },
        departureDate: { gt: now },
      },
      select: { Site: { select: { siteType: true } } },
    });

    const activeByType: Record<string, number> = {};
    reservations.forEach((r) => {
      const t = (r.Site?.siteType || "rv").toLowerCase();
      activeByType[t] = (activeByType[t] || 0) + 1;
    });

    const suggestions14 = siteCounts
      .map((sc) => {
        const type = (sc.siteType ?? "rv").toLowerCase();
        const total = sc._count._all;
        const active = activeByType[type] || 0;
        const occ = total > 0 ? active / total : 1;
        return { type, total, active, occ };
      })
      .filter((s) => s.occ < 0.6 && s.total > 0)
      .map((s) => ({
        reason: `${s.type.toUpperCase()} occupancy ${Math.round(s.occ * 100)}% in next 14 days`,
        filters: {
          campgroundId,
          siteType: s.type,
          notStayedThisYear: true,
        },
      }));

    // 30-day softer occupancy
    const reservations30 = await this.prisma.reservation.findMany({
      where: {
        campgroundId,
        status: { not: "cancelled" },
        arrivalDate: { lt: end30 },
        departureDate: { gt: now },
      },
      select: { Site: { select: { siteType: true } } },
    });
    const activeByType30: Record<string, number> = {};
    reservations30.forEach((r) => {
      const t = (r.Site?.siteType || "rv").toLowerCase();
      activeByType30[t] = (activeByType30[t] || 0) + 1;
    });
    const suggestions30 = siteCounts
      .map((sc) => {
        const type = (sc.siteType ?? "rv").toLowerCase();
        const total = sc._count._all;
        const active = activeByType30[type] || 0;
        const occ = total > 0 ? active / total : 1;
        return { type, total, active, occ };
      })
      .filter((s) => s.occ < 0.7 && s.total > 0)
      .map((s) => ({
        reason: `${s.type.toUpperCase()} soft occupancy in next 30 days (${Math.round(s.occ * 100)}%)`,
        filters: {
          campgroundId,
          siteType: s.type,
        },
      }));

    // Lapsed guests 12 months
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const lapsed = [
      {
        reason: "Lapsed guests: no stay in 12 months",
        filters: {
          campgroundId,
          lastStayBefore: oneYearAgo.toISOString().slice(0, 10),
        },
      },
    ];

    // Repeat month last year but not this year
    const lastYear = new Date();
    lastYear.setFullYear(lastYear.getFullYear() - 1);
    const month = lastYear.getMonth() + 1;
    const repeatMonth = [
      {
        reason: `Guests who stayed in month ${month} last year but not this year`,
        filters: {
          campgroundId,
          stayedFrom: new Date(lastYear.getFullYear(), month - 1, 1).toISOString().slice(0, 10),
          stayedTo: new Date(lastYear.getFullYear(), month, 0).toISOString().slice(0, 10),
          notStayedThisYear: true,
        },
      },
    ];

    const promoUsers = [
      {
        reason: "Guests who used a promo last year but not this year",
        filters: {
          campgroundId,
          promoUsed: true,
          notStayedThisYear: true,
        },
      },
    ];

    const vip = [
      {
        reason: "VIP/loyalty guests to win back",
        filters: {
          campgroundId,
          vip: true,
          notStayedThisYear: true,
        },
      },
    ];

    return [...suggestions14, ...suggestions30, ...lapsed, ...repeatMonth, ...promoUsers, ...vip];
  }

  list(campgroundId?: string) {
    const campaignClient = this.prisma.campaign;
    if (!campaignClient?.findMany) return [];
    return campaignClient.findMany({
      where: campgroundId ? { campgroundId } : {},
      orderBy: { updatedAt: "desc" },
    });
  }

  async update(id: string, dto: UpdateCampaignDto) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException("Campaign not found");
    const scheduledAt =
      dto.scheduledAt === undefined
        ? undefined
        : dto.scheduledAt
          ? new Date(dto.scheduledAt)
          : null;
    return this.prisma.campaign.update({
      where: { id },
      data: {
        name: dto.name ?? campaign.name,
        subject: dto.subject ?? campaign.subject,
        fromEmail: dto.fromEmail ?? campaign.fromEmail,
        fromName: dto.fromName ?? campaign.fromName,
        html: dto.html ?? campaign.html,
        status: dto.status ?? campaign.status,
        scheduledAt,
      },
    });
  }

  async sendNow(
    id: string,
    opts?: { scheduledAt?: string | null; batchPerMinute?: string | null },
  ) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: { Campground: true },
    });
    if (!campaign) throw new NotFoundException("Campaign not found");
    if (
      campaign.status !== CampaignStatusValues.draft &&
      campaign.status !== CampaignStatusValues.scheduled
    ) {
      throw new BadRequestException("Campaign cannot be sent from current status");
    }

    if (opts?.scheduledAt) {
      const sched = new Date(opts.scheduledAt);
      if (sched > new Date()) {
        await this.prisma.campaign.update({
          where: { id },
          data: { status: CampaignStatusValues.scheduled, scheduledAt: sched },
        });
        return { scheduledAt: sched };
      }
    }

    await this.prisma.campaign.update({
      where: { id },
      data: { status: CampaignStatusValues.sending, scheduledAt: null },
    });

    const guests = await this.prisma.guest.findMany({
      where: {
        marketingOptIn: true,
        OR: [{ email: { not: "" } }, { phone: { not: "" } }],
        Reservation: {
          some: { campgroundId: campaign.campgroundId },
        },
      },
      select: { id: true, email: true, phone: true, primaryFirstName: true, primaryLastName: true },
    });

    const batch = opts?.batchPerMinute ? Number(opts.batchPerMinute) : 0;
    const delayMs = batch > 0 ? Math.max(0, Math.floor(60000 / batch)) : 0;
    let sent = 0;
    for (const guest of guests) {
      const targetEmail = guest.email;
      const targetPhone = guest.phone;

      // send email if channel includes email and we have an address
      if (
        (campaign.channel === ChannelTypeValues.email ||
          campaign.channel === ChannelTypeValues.both) &&
        targetEmail
      ) {
        const send = await this.prisma.campaignSend.create({
          data: {
            id: randomUUID(),
            campaignId: campaign.id,
            campgroundId: campaign.campgroundId,
            guestId: guest.id,
            email: targetEmail,
            phone: "",
            channel: ChannelTypeValues.email,
            status: CampaignSendStatus.queued,
          },
        });
        try {
          const html = this.appendEmailFooter(campaign.html);
          const result = await this.emailService.sendEmail({
            to: targetEmail,
            subject: campaign.subject,
            html,
          });
          await this.prisma.campaignSend.update({
            where: { id: send.id },
            data: {
              status: CampaignSendStatus.sent,
              providerMessageId: result.providerMessageId || null,
              sentAt: new Date(),
            },
          });
          sent += 1;
        } catch (err) {
          await this.prisma.campaignSend.update({
            where: { id: send.id },
            data: {
              status: CampaignSendStatus.failed,
              error: err instanceof Error ? err.message : "Failed to send",
            },
          });
        }
      }

      // send sms if channel includes sms and we have a phone
      if (
        (campaign.channel === ChannelTypeValues.sms ||
          campaign.channel === ChannelTypeValues.both) &&
        targetPhone
      ) {
        const send = await this.prisma.campaignSend.create({
          data: {
            id: randomUUID(),
            campaignId: campaign.id,
            campgroundId: campaign.campgroundId,
            guestId: guest.id,
            phone: targetPhone,
            email: "",
            channel: ChannelTypeValues.sms,
            status: CampaignSendStatus.queued,
          },
        });
        try {
          const body = this.appendSmsFooter(campaign.textBody || "");
          const result = await this.smsService.sendSms({
            to: targetPhone,
            body,
          });
          await this.prisma.campaignSend.update({
            where: { id: send.id },
            data: {
              status: CampaignSendStatus.sent,
              providerMessageId: result.providerMessageId || null,
              sentAt: new Date(),
            },
          });
          sent += 1;
        } catch (err) {
          await this.prisma.campaignSend.update({
            where: { id: send.id },
            data: {
              status: CampaignSendStatus.failed,
              error: err instanceof Error ? err.message : "Failed to send SMS",
            },
          });
        }
      }

      if (delayMs > 0) {
        await new Promise((res) => setTimeout(res, delayMs));
      }
    }

    await this.prisma.campaign.update({
      where: { id },
      data: { status: CampaignStatusValues.sent },
    });
    return { sent };
  }

  async testSend(id: string, opts: { email?: string; phone?: string }) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException("Campaign not found");
    const targets: { channel: ChannelType; email?: string; phone?: string }[] = [];
    if (
      (campaign.channel === ChannelTypeValues.email ||
        campaign.channel === ChannelTypeValues.both) &&
      opts.email
    ) {
      targets.push({ channel: ChannelTypeValues.email, email: opts.email });
    }
    if (
      (campaign.channel === ChannelTypeValues.sms || campaign.channel === ChannelTypeValues.both) &&
      opts.phone
    ) {
      targets.push({ channel: ChannelTypeValues.sms, phone: opts.phone });
    }
    let sent = 0;
    for (const t of targets) {
      if (t.channel === ChannelTypeValues.email && t.email) {
        const html = this.appendEmailFooter(campaign.html);
        await this.emailService.sendEmail({
          to: t.email,
          subject: `[TEST] ${campaign.subject}`,
          html,
        });
        sent += 1;
      }
      if (t.channel === ChannelTypeValues.sms && t.phone) {
        const body = this.appendSmsFooter(campaign.textBody || "");
        await this.smsService.sendSms({ to: t.phone, body: `[TEST] ${body}` });
        sent += 1;
      }
    }
    return { sent };
  }
}
