import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { CampaignSendStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCampaignDto } from "./dto/create-campaign.dto";
import { UpdateCampaignDto } from "./dto/update-campaign.dto";
import { EmailService } from "../email/email.service";
import { SmsService } from "../sms/sms.service";
import { CreateTemplateDto } from "./dto/create-template.dto";
import { AudienceFiltersDto } from "./dto/audience.dto";

const ChannelTypeValues = { email: "email", sms: "sms", both: "both" } as const;
type ChannelType = (typeof ChannelTypeValues)[keyof typeof ChannelTypeValues];

const CampaignStatusValues = { draft: "draft", scheduled: "scheduled", sending: "sending", sent: "sent", cancelled: "cancelled" } as const;
type CampaignStatus = (typeof CampaignStatusValues)[keyof typeof CampaignStatusValues];

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService
  ) { }

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
        campgroundId: dto.campgroundId,
        name: dto.name,
        subject: dto.subject,
        fromEmail: dto.fromEmail,
        fromName: dto.fromName || null,
        html: dto.html,
        textBody: dto.textBody || null,
        channel: dto.channel || ChannelTypeValues.email,
        status: CampaignStatusValues.draft,
        variables: dto.variables || {},
        scheduledAt
      }
    });
  }

  createTemplate(dto: CreateTemplateDto) {
    const templateClient = this.prisma.campaignTemplate;
    if (!templateClient?.create) return null;
    return templateClient.create({
      data: {
        campgroundId: dto.campgroundId,
        name: dto.name,
        channel: dto.channel || ChannelTypeValues.email,
        category: dto.category || "general",
        subject: dto.subject || null,
        html: dto.html || null,
        textBody: dto.textBody || null
      }
    });
  }

  listTemplates(campgroundId: string) {
    const templateClient = this.prisma.campaignTemplate;
    if (!templateClient?.findMany) return [];
    return templateClient.findMany({
      where: { campgroundId },
      orderBy: { updatedAt: "desc" }
    });
  }

  async updateTemplate(id: string, data: Partial<{
    name: string;
    channel: string;
    category: string;
    subject: string | null;
    html: string | null;
    textBody: string | null;
  }>) {
    const templateClient = this.prisma.campaignTemplate;
    if (!templateClient?.update) throw new NotFoundException("Template model not available");
    const existing = await templateClient.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Template not found");
    return templateClient.update({
      where: { id },
      data
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
    const whereReservation: any = {
      ...(filters.campgroundId ? { campgroundId: filters.campgroundId } : {})
    };
    if (filters.stayedFrom) {
      whereReservation.departureDate = { ...(whereReservation.departureDate || {}), gte: new Date(filters.stayedFrom) };
    }
    if (filters.stayedTo) {
      whereReservation.arrivalDate = { ...(whereReservation.arrivalDate || {}), lte: new Date(filters.stayedTo) };
    }
    if (filters.stayFrom || filters.stayTo) {
      whereReservation.arrivalDate = {
        ...(whereReservation.arrivalDate || {}),
        ...(filters.stayFrom ? { gte: new Date(filters.stayFrom) } : {}),
        ...(filters.stayTo ? { lte: new Date(filters.stayTo) } : {})
      };
    }
    const guests = await this.prisma.guest.findMany({
      where: {
        marketingOptIn: true,
        email: { not: "" } as any,
        reservations: {
          some: {
            ...whereReservation,
            ...(filters.siteType ? { site: { siteType: filters.siteType as any } } : {}),
            ...(filters.siteClassId ? { siteClassId: filters.siteClassId } : {})
          }
        },
        ...(filters.state ? { state: filters.state } : {}),
        ...(filters.vip ? { vip: true } : {}),
        ...(filters.loyaltyTier ? { loyaltyProfile: { tier: filters.loyaltyTier } } : {})
      },
      select: {
        id: true,
        email: true,
        phone: true,
        primaryFirstName: true,
        primaryLastName: true,
        reservations: {
          select: { arrivalDate: true, departureDate: true, promoCode: true },
          orderBy: { arrivalDate: "desc" },
          take: 1
        }
      },
      take: 200
    });

    const currentYear = new Date().getFullYear();
    const filtered = guests.filter((g: any) => {
      const lastStay = g.reservations[0]?.departureDate;
      if (filters.lastStayBefore && lastStay && new Date(lastStay) >= new Date(filters.lastStayBefore)) return false;
      if (filters.notStayedThisYear && lastStay && new Date(lastStay).getFullYear() === currentYear) return false;
      if (filters.promoUsed && !g.reservations[0]?.promoCode) return false;
      return true;
    });

    return {
      count: filtered.length,
      sample: filtered.slice(0, 20).map((g: any) => ({
        id: g.id,
        name: `${g.primaryFirstName || ""} ${g.primaryLastName || ""}`.trim(),
        email: g.email,
        phone: g.phone,
        lastStay: g.reservations[0]?.departureDate || null
      }))
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
      _count: { _all: true }
    });

    const reservations = await this.prisma.reservation.findMany({
      where: {
        campgroundId,
        status: { not: "cancelled" },
        arrivalDate: { lt: end14 },
        departureDate: { gt: now }
      },
      select: { site: { select: { siteType: true } } }
    });

    const activeByType: Record<string, number> = {};
    reservations.forEach((r: any) => {
      const t = (r.site?.siteType || "rv").toLowerCase();
      activeByType[t] = (activeByType[t] || 0) + 1;
    });

    const suggestions14 = siteCounts
      .map((sc: any) => {
        const type = (sc.siteType as string).toLowerCase();
        const total = sc._count._all;
        const active = activeByType[type] || 0;
        const occ = total > 0 ? active / total : 1;
        return { type, total, active, occ };
      })
      .filter((s: any) => s.occ < 0.6 && s.total > 0)
      .map((s: any) => ({
        reason: `${s.type.toUpperCase()} occupancy ${Math.round(s.occ * 100)}% in next 14 days`,
        filters: {
          campgroundId,
          siteType: s.type,
          notStayedThisYear: true
        }
      }));

    // 30-day softer occupancy
    const reservations30 = await this.prisma.reservation.findMany({
      where: {
        campgroundId,
        status: { not: "cancelled" },
        arrivalDate: { lt: end30 },
        departureDate: { gt: now }
      },
      select: { site: { select: { siteType: true } } }
    });
    const activeByType30: Record<string, number> = {};
    reservations30.forEach((r: any) => {
      const t = (r.site?.siteType || "rv").toLowerCase();
      activeByType30[t] = (activeByType30[t] || 0) + 1;
    });
    const suggestions30 = siteCounts
      .map((sc: any) => {
        const type = (sc.siteType as string).toLowerCase();
        const total = sc._count._all;
        const active = activeByType30[type] || 0;
        const occ = total > 0 ? active / total : 1;
        return { type, total, active, occ };
      })
      .filter((s: any) => s.occ < 0.7 && s.total > 0)
      .map((s: any) => ({
        reason: `${s.type.toUpperCase()} soft occupancy in next 30 days (${Math.round(s.occ * 100)}%)`,
        filters: {
          campgroundId,
          siteType: s.type
        }
      }));

    // Lapsed guests 12 months
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const lapsed = [
      {
        reason: "Lapsed guests: no stay in 12 months",
        filters: {
          campgroundId,
          lastStayBefore: oneYearAgo.toISOString().slice(0, 10)
        }
      }
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
          notStayedThisYear: true
        }
      }
    ];

    const promoUsers = [
      {
        reason: "Guests who used a promo last year but not this year",
        filters: {
          campgroundId,
          promoUsed: true,
          notStayedThisYear: true
        }
      }
    ];

    const vip = [
      {
        reason: "VIP/loyalty guests to win back",
        filters: {
          campgroundId,
          vip: true,
          notStayedThisYear: true
        }
      }
    ];

    return [...suggestions14, ...suggestions30, ...lapsed, ...repeatMonth, ...promoUsers, ...vip];
  }

  list(campgroundId?: string) {
    const campaignClient = this.prisma.campaign;
    if (!campaignClient?.findMany) return [];
    return campaignClient.findMany({
      where: campgroundId ? { campgroundId } : {},
      orderBy: { updatedAt: "desc" }
    });
  }

  async update(id: string, dto: UpdateCampaignDto) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException("Campaign not found");
    const scheduledAt = dto.scheduledAt === undefined ? undefined : dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    return this.prisma.campaign.update({
      where: { id },
      data: {
        name: dto.name ?? campaign.name,
        subject: dto.subject ?? campaign.subject,
        fromEmail: dto.fromEmail ?? campaign.fromEmail,
        fromName: dto.fromName ?? campaign.fromName,
        html: dto.html ?? campaign.html,
        status: dto.status ?? campaign.status,
        scheduledAt
      }
    });
  }

  async sendNow(id: string, opts?: { scheduledAt?: string | null; batchPerMinute?: string | null }) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: { campground: true }
    });
    if (!campaign) throw new NotFoundException("Campaign not found");
    if (campaign.status !== CampaignStatusValues.draft && campaign.status !== CampaignStatusValues.scheduled) {
      throw new BadRequestException("Campaign cannot be sent from current status");
    }

    if (opts?.scheduledAt) {
      const sched = new Date(opts.scheduledAt);
      if (sched > new Date()) {
        await this.prisma.campaign.update({
          where: { id },
          data: { status: CampaignStatusValues.scheduled, scheduledAt: sched }
        });
        return { scheduledAt: sched };
      }
    }

    await this.prisma.campaign.update({ where: { id }, data: { status: CampaignStatusValues.sending, scheduledAt: null } });

    const guests = await this.prisma.guest.findMany({
      where: {
        marketingOptIn: true,
        OR: [
          { email: { not: "" } },
          { phone: { not: "" } }
        ],
        reservations: {
          some: { campgroundId: campaign.campgroundId }
        }
      },
      select: { id: true, email: true, phone: true, primaryFirstName: true, primaryLastName: true }
    });

    const batch = opts?.batchPerMinute ? Number(opts.batchPerMinute) : 0;
    const delayMs = batch > 0 ? Math.max(0, Math.floor(60000 / batch)) : 0;
    let sent = 0;
    for (const guest of guests) {
      const targetEmail = guest.email;
      const targetPhone = guest.phone;

      // send email if channel includes email and we have an address
      if ((campaign.channel === ChannelTypeValues.email || campaign.channel === ChannelTypeValues.both) && targetEmail) {
        const send = await this.prisma.campaignSend.create({
          data: {
            campaignId: campaign.id,
            campgroundId: campaign.campgroundId,
            guestId: guest.id,
            email: targetEmail,
            phone: "",
            channel: ChannelTypeValues.email,
            status: CampaignSendStatus.queued
          }
        });
        try {
          const html = this.appendEmailFooter(campaign.html);
          const result = await this.emailService.sendEmail({
            to: targetEmail,
            subject: campaign.subject,
            html
          });
          await this.prisma.campaignSend.update({
            where: { id: send.id },
            data: {
              status: CampaignSendStatus.sent,
              providerMessageId: result.providerMessageId || null,
              sentAt: new Date()
            }
          });
          sent += 1;
        } catch (err) {
          await this.prisma.campaignSend.update({
            where: { id: send.id },
            data: {
              status: CampaignSendStatus.failed,
              error: err instanceof Error ? err.message : "Failed to send"
            }
          });
        }
      }

      // send sms if channel includes sms and we have a phone
      if ((campaign.channel === ChannelTypeValues.sms || campaign.channel === ChannelTypeValues.both) && targetPhone) {
        const send = await this.prisma.campaignSend.create({
          data: {
            campaignId: campaign.id,
            campgroundId: campaign.campgroundId,
            guestId: guest.id,
            phone: targetPhone,
            email: "",
            channel: ChannelTypeValues.sms,
            status: CampaignSendStatus.queued
          }
        });
        try {
          const body = this.appendSmsFooter(campaign.textBody || "");
          const result = await this.smsService.sendSms({
            to: targetPhone,
            body
          });
          await this.prisma.campaignSend.update({
            where: { id: send.id },
            data: {
              status: CampaignSendStatus.sent,
              providerMessageId: result.providerMessageId || null,
              sentAt: new Date()
            }
          });
          sent += 1;
        } catch (err) {
          await this.prisma.campaignSend.update({
            where: { id: send.id },
            data: {
              status: CampaignSendStatus.failed,
              error: err instanceof Error ? err.message : "Failed to send SMS"
            }
          });
        }
      }

      if (delayMs > 0) {
        await new Promise((res) => setTimeout(res, delayMs));
      }
    }

    await this.prisma.campaign.update({ where: { id }, data: { status: CampaignStatusValues.sent } });
    return { sent };
  }

  async testSend(id: string, opts: { email?: string; phone?: string }) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException("Campaign not found");
    const targets: { channel: ChannelType; email?: string; phone?: string }[] = [];
    if ((campaign.channel === ChannelTypeValues.email || campaign.channel === ChannelTypeValues.both) && opts.email) {
      targets.push({ channel: ChannelTypeValues.email, email: opts.email });
    }
    if ((campaign.channel === ChannelTypeValues.sms || campaign.channel === ChannelTypeValues.both) && opts.phone) {
      targets.push({ channel: ChannelTypeValues.sms, phone: opts.phone });
    }
    let sent = 0;
    for (const t of targets) {
      if (t.channel === ChannelTypeValues.email && t.email) {
        const html = this.appendEmailFooter(campaign.html);
        await this.emailService.sendEmail({
          to: t.email,
          subject: `[TEST] ${campaign.subject}`,
          html
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

