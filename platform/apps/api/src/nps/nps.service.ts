import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "crypto";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { SupportService } from "../support/support.service";
import { CreateNpsSurveyDto } from "./dto/create-nps-survey.dto";
import { CreateNpsRuleDto } from "./dto/create-nps-rule.dto";
import { CreateNpsInviteDto } from "./dto/create-nps-invite.dto";
import { RespondNpsDto } from "./dto/respond-nps.dto";

function baseAppUrl() {
  const url = process.env.PUBLIC_WEB_URL || process.env.NEXT_PUBLIC_APP_URL || "https://app.campreserv.com";
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

@Injectable()
export class NpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly supportService: SupportService
  ) { }

  async createSurvey(dto: CreateNpsSurveyDto) {
    const prisma = this.prisma;
    return prisma.npsSurvey.create({
      data: {
        campgroundId: dto.campgroundId,
        name: dto.name,
        question: dto.question ?? "How likely are you to recommend us to a friend?",
        channels: dto.channels ?? ["inapp", "email"],
        locales: dto.locales ?? ["en"],
        cooldownDays: dto.cooldownDays ?? 30,
        samplingPercent: dto.samplingPercent ?? 100,
        activeFrom: dto.activeFrom ? new Date(dto.activeFrom) : null,
        activeTo: dto.activeTo ? new Date(dto.activeTo) : null,
        status: "active"
      }
    });
  }

  async listSurveys(campgroundId: string) {
    const prisma = this.prisma;
    return prisma.npsSurvey.findMany({
      where: { campgroundId },
      include: { rules: true },
      orderBy: { createdAt: "desc" }
    });
  }

  async addRule(dto: CreateNpsRuleDto) {
    const prisma = this.prisma;
    const survey = await prisma.npsSurvey.findUnique({ where: { id: dto.surveyId } });
    if (!survey) throw new NotFoundException("Survey not found");
    return prisma.npsRule.create({
      data: {
        surveyId: dto.surveyId,
        trigger: dto.trigger,
        percentage: dto.percentage ?? survey.samplingPercent ?? 100,
        cooldownDays: dto.cooldownDays ?? survey.cooldownDays ?? 30,
        segmentJson: dto.segmentJson as any,
        isActive: dto.isActive ?? true
      }
    });
  }

  private generateToken() {
    return randomBytes(24).toString("hex");
  }

  private async resolveGuestContact(guestId?: string, reservationId?: string, email?: string, phone?: string) {
    if (guestId) {
      const guest = await this.prisma.guest.findUnique({
        where: { id: guestId },
        select: { email: true, phone: true, primaryFirstName: true, primaryLastName: true }
      });
      if (guest) {
        return {
          email: email ?? guest.email,
          phone: phone ?? guest.phone,
          name: `${guest.primaryFirstName} ${guest.primaryLastName}`
        };
      }
    }
    if (reservationId) {
      const reservation = await this.prisma.reservation.findUnique({
        where: { id: reservationId },
        select: {
          guest: { select: { email: true, phone: true, primaryFirstName: true, primaryLastName: true } }
        }
      });
      if (reservation?.guest) {
        const g = reservation.guest;
        return {
          email: email ?? g.email,
          phone: phone ?? g.phone,
          name: `${g.primaryFirstName} ${g.primaryLastName}`
        };
      }
    }
    return { email, phone, name: undefined as string | undefined };
  }

  async createInvite(dto: CreateNpsInviteDto) {
    const prisma = this.prisma;
    const survey = await prisma.npsSurvey.findUnique({
      where: { id: dto.surveyId },
      include: { campground: { select: { name: true } } }
    });
    if (!survey) throw new NotFoundException("Survey not found");
    if (survey.status !== "active") throw new BadRequestException("Survey is not active");
    if (survey.activeFrom && survey.activeFrom > new Date()) throw new BadRequestException("Survey not yet active");
    if (survey.activeTo && survey.activeTo < new Date()) throw new BadRequestException("Survey expired");

    const contact = await this.resolveGuestContact(dto.guestId, dto.reservationId, dto.email, dto.phone);

    const cooldownDays = survey.cooldownDays ?? 30;
    if (dto.guestId && cooldownDays > 0) {
      const recent = await prisma.npsInvite.findFirst({
        where: {
          guestId: dto.guestId,
          surveyId: dto.surveyId,
          createdAt: { gte: new Date(Date.now() - cooldownDays * 24 * 60 * 60 * 1000) }
        }
      });
      if (recent) {
        throw new BadRequestException("Guest already invited within cooldown window");
      }
    }

    const token = this.generateToken();
    const expiresAt = dto.expireDays ? new Date(Date.now() + dto.expireDays * 24 * 60 * 60 * 1000) : null;
    const link = `${baseAppUrl()}/nps/respond?token=${token}`;

    const invite = await prisma.npsInvite.create({
      data: {
        surveyId: dto.surveyId,
        campgroundId: dto.campgroundId,
        organizationId: dto.organizationId ?? null,
        guestId: dto.guestId ?? null,
        reservationId: dto.reservationId ?? null,
        channel: dto.channel,
        status: dto.channel === "email" ? "sent" : "queued",
        token,
        expiresAt,
        sentAt: dto.channel === "email" ? new Date() : null,
        metadata: { link }
      }
    });

    if (dto.channel === "email") {
      if (!contact.email) throw new BadRequestException("Email required for email channel");
      const guestName = contact.name || "there";

      let subject = `How was your stay at ${survey.campground.name}?`;
      let html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #0f172a; margin-bottom: 8px;">Hi ${guestName},</h2>
          <p style="color: #475569; line-height: 1.6;">We'd love your quick feedback. How likely are you to recommend us to a friend or colleague?</p>
          <p style="margin: 16px 0;">
            <a href="${link}" style="background: #0ea5e9; color: white; padding: 12px 18px; border-radius: 8px; text-decoration: none; font-weight: 600;">Rate your stay</a>
          </p>
          <p style="color: #94a3b8; font-size: 12px;">This link is unique to you and may expire.</p>
        </div>
      `;

      if (dto.templateId) {
        const template = await prisma.communicationTemplate.findFirst({
          where: { id: dto.templateId, campgroundId: dto.campgroundId }
        });
        if (!template) {
          throw new BadRequestException("Template not found for this campground");
        }
        if (template.status !== "approved") {
          throw new BadRequestException("Template not approved");
        }
        subject = template.subject || subject;
        const linkHtml = `<p><a href="${link}" style="color:#0ea5e9;font-weight:600;">Rate your stay</a></p>`;
        html = (template.bodyHtml || html).replace("{{nps_link}}", link).replace("{{npsLink}}", link);
        if (!html.includes(link)) {
          html += linkHtml;
        }
      }

      await this.emailService.sendEmail({
        to: contact.email,
        subject,
        html,
        guestId: dto.guestId,
        reservationId: dto.reservationId,
        campgroundId: dto.campgroundId
      });
    }

    return invite;
  }

  async recordOpen(token: string) {
    const prisma = this.prisma;
    const invite = await prisma.npsInvite.findUnique({ where: { token } });
    if (!invite) throw new NotFoundException("Invite not found");
    await prisma.npsInvite.update({
      where: { id: invite.id },
      data: { openedAt: invite.openedAt ?? new Date(), status: invite.status === "queued" ? "opened" : invite.status }
    });
    await prisma.npsEvent.create({
      data: { inviteId: invite.id, type: "open" }
    });
    return { ok: true };
  }

  async respond(dto: RespondNpsDto, ip?: string) {
    const prisma = this.prisma;
    const invite = await prisma.npsInvite.findUnique({
      where: { token: dto.token },
      include: { survey: true }
    });
    if (!invite) throw new NotFoundException("Invite not found");
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      await prisma.npsInvite.update({ where: { id: invite.id }, data: { status: "expired" } });
      throw new BadRequestException("Invite expired");
    }
    if (invite.respondedAt) throw new BadRequestException("Invite already used");

    const response = await prisma.npsResponse.create({
      data: {
        surveyId: invite.surveyId,
        inviteId: invite.id,
        campgroundId: invite.campgroundId,
        guestId: invite.guestId,
        reservationId: invite.reservationId,
        score: dto.score,
        comment: dto.comment ?? null,
        tags: dto.tags ?? [],
        sentiment: null
      }
    });

    await prisma.npsInvite.update({
      where: { id: invite.id },
      data: { respondedAt: new Date(), status: "responded" }
    });

    await prisma.npsEvent.create({
      data: { inviteId: invite.id, type: "respond", payload: { ip } as any }
    });

    // Detractor handling: create support ticket
    if (dto.score <= 6) {
      await this.supportService.create({
        description: `NPS detractor (${dto.score})`,
        steps: dto.comment || "No comment provided",
        contactEmail: undefined,
        path: "/nps/respond",
        roleFilter: undefined,
        pinnedIds: [],
        recentIds: [],
        rawContext: { inviteId: invite.id, surveyId: invite.surveyId, score: dto.score },
        campgroundId: invite.campgroundId
      });
      if (process.env.NPS_ALERT_EMAIL) {
        await this.emailService.sendEmail({
          to: process.env.NPS_ALERT_EMAIL,
          subject: `Detractor alert (${dto.score}) for survey ${invite.surveyId}`,
          html: `<p>Score: ${dto.score}</p><p>Comment: ${dto.comment || "None"}</p><p>Invite: ${invite.id}</p>`
        });
      }
    }

    // Promoter branch: queue a review request
    if (dto.score >= 9) {
      const reviewToken = this.generateToken();
      await prisma.reviewRequest.create({
        data: {
          campgroundId: invite.campgroundId,
          organizationId: invite.organizationId ?? null,
          guestId: invite.guestId ?? null,
          reservationId: invite.reservationId ?? null,
          channel: "inapp",
          status: "queued",
          token: reviewToken,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          metadata: { source: "nps_promoter", inviteId: invite.id }
        }
      });
    }

    return response;
  }

  private parseSchedule(raw: any, defaultTemplateId?: string | null) {
    const entries: any[] = Array.isArray(raw) ? raw : [];
    const safeEntries = entries
      .map((e) => ({
        id: e.id || randomBytes(6).toString("hex"),
        anchor: e.anchor === "arrival" ? "arrival" : "departure",
        direction: e.direction === "before" ? "before" : "after",
        offset: Number.isFinite(e.offset) ? Number(e.offset) : 0,
        unit: e.unit === "hours" ? "hours" : "days",
        templateId: e.templateId || defaultTemplateId || null,
        enabled: e.enabled !== false
      }))
      .filter((e) => e.enabled);

    // Always include day-after departure default
    safeEntries.push({
      id: "nps-post-departure-default",
      anchor: "departure",
      direction: "after",
      offset: 1,
      unit: "days",
      templateId: defaultTemplateId || null,
      enabled: true
    });

    return safeEntries;
  }

  private computeScheduledTime(anchorDate: Date, entry: any, sendHour: number) {
    const target = new Date(anchorDate);
    const deltaMs = entry.unit === "hours" ? entry.offset * 60 * 60 * 1000 : entry.offset * 24 * 60 * 60 * 1000;
    const signed = entry.direction === "before" ? -deltaMs : deltaMs;
    const shifted = new Date(target.getTime() + signed);
    shifted.setHours(sendHour, 0, 0, 0);
    return shifted;
  }

  @Cron("0 * * * *")
  async sendPostCheckoutInvites() {
    const prisma = this.prisma;
    const now = new Date();
    const campgrounds = (await prisma.campground.findMany({
      select: { id: true, timezone: true, npsAutoSendEnabled: true, npsSendHour: true, npsTemplateId: true, npsSchedule: true }
    })) as any[];
    const surveys = (await prisma.npsSurvey.findMany({
      where: { status: "active" },
      select: { id: true, campgroundId: true },
      include: { rules: { where: { trigger: "post_checkout", isActive: true } } }
    })) as any[];

    for (const cg of campgrounds) {
      if (!cg.npsAutoSendEnabled) continue;
      const sendHour = cg.npsSendHour ?? 7;
      const schedule = this.parseSchedule(cg.npsSchedule, cg.npsTemplateId);
      if (!schedule.length) continue;
      const cgSurveys = (surveys as any[]).filter((s) => s.campgroundId === cg.id && s.rules.length > 0);
      if (cgSurveys.length === 0) continue;
      const surveyId = cgSurveys[0].id;

      // ensure nps playbook exists
      let playbook = await prisma.communicationPlaybook.findFirst({
        where: { campgroundId: cg.id, type: "nps" }
      });
      if (!playbook) {
        playbook = await prisma.communicationPlaybook.create({
          data: {
            campgroundId: cg.id,
            type: "nps",
            enabled: true,
            templateId: cg.npsTemplateId ?? null,
            channel: "email"
          }
        });
      }

      const reservations = (await prisma.reservation.findMany({
        where: { campgroundId: cg.id, status: { not: "cancelled" } },
        select: {
          id: true,
          guestId: true,
          arrivalDate: true,
          departureDate: true,
          status: true,
          guest: { select: { email: true, phone: true, primaryFirstName: true, primaryLastName: true } }
        }
      })) as any[];

      for (const res of reservations) {
        for (const entry of schedule) {
          const anchorDate = entry.anchor === "arrival" ? res.arrivalDate : res.departureDate;
          if (!anchorDate) continue;
          const target = this.computeScheduledTime(anchorDate, entry, sendHour);
          const windowStart = target;
          const windowEnd = new Date(target.getTime() + 60 * 60 * 1000);
          if (now < windowStart || now > windowEnd) continue;

          const existingJob = await prisma.communicationPlaybookJob.findFirst({
            where: {
              campgroundId: cg.id,
              reservationId: res.id,
              playbookId: playbook.id,
              metadata: { path: ["entryId"], equals: entry.id }
            }
          });
          if (existingJob) continue;

          await prisma.communicationPlaybookJob.create({
            data: {
              playbookId: playbook.id,
              campgroundId: cg.id,
              reservationId: res.id,
              guestId: res.guestId ?? null,
              status: "pending",
              scheduledAt: target,
              metadata: {
                entryId: entry.id,
                surveyId,
                templateId: entry.templateId ?? cg.npsTemplateId ?? playbook.templateId ?? null
              }
            }
          });
        }
      }
    }
  }

  private getLocalHour(now: Date, tz?: string | null) {
    try {
      const formatter = new Intl.DateTimeFormat("en-US", {
        hour12: false,
        hour: "2-digit",
        timeZone: tz || "UTC"
      });
      const parts = formatter.formatToParts(now);
      const hourPart = parts.find((p) => p.type === "hour")?.value;
      return hourPart ? parseInt(hourPart, 10) : now.getUTCHours();
    } catch {
      return now.getUTCHours();
    }
  }

  async metrics(campgroundId: string) {
    const prisma = this.prisma;
    const [responses, invites, systemResponses] = await Promise.all([
      prisma.npsResponse.findMany({
        where: { campgroundId },
        select: { score: true, createdAt: true }
      }),
      prisma.npsInvite.count({ where: { campgroundId } }),
      // Get system-wide responses for average calculation
      prisma.npsResponse.findMany({
        select: { score: true, campgroundId: true }
      })
    ]);

    const total = responses.length;
    const promoters = (responses as any[]).filter((r) => r.score >= 9).length;
    const detractors = (responses as any[]).filter((r) => r.score <= 6).length;
    const passives = total - promoters - detractors;
    const nps = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : null;

    // Calculate system-wide NPS average
    const systemTotal = systemResponses.length;
    const systemPromoters = (systemResponses as any[]).filter((r) => r.score >= 9).length;
    const systemDetractors = (systemResponses as any[]).filter((r) => r.score <= 6).length;
    const systemNps = systemTotal > 0 ? Math.round(((systemPromoters - systemDetractors) / systemTotal) * 100) : null;

    // Count unique campgrounds with responses for context
    const campgroundsWithResponses = new Set((systemResponses as any[]).map((r) => r.campgroundId)).size;

    // Calculate what's needed to reach benchmarks
    let toReachAverage: number | null = null;
    let toReachWorldClass: number | null = null;

    if (nps !== null && total > 0) {
      // To reach a target NPS, we need to solve for additional promoters needed
      // NPS = ((promoters - detractors) / total) * 100
      // Target = ((promoters + x - detractors) / (total + x)) * 100
      // Solving for x (additional promoters needed)

      const calculatePromotersNeeded = (targetNps: number): number => {
        // Current state
        const currentPromoterRatio = promoters / total;
        const currentDetractorRatio = detractors / total;
        const targetRatio = targetNps / 100;

        // If we already meet the target, return 0
        if ((nps ?? 0) >= targetNps) return 0;

        // We need: (promoters + x) / (total + x) - detractors / (total + x) = targetRatio
        // Simplifying: promoters + x - detractors = targetRatio * (total + x)
        // promoters + x - detractors = targetRatio * total + targetRatio * x
        // x - targetRatio * x = targetRatio * total - promoters + detractors
        // x * (1 - targetRatio) = targetRatio * total - promoters + detractors
        // x = (targetRatio * total - promoters + detractors) / (1 - targetRatio)

        if (targetRatio >= 1) return Infinity; // Can't reach 100+ NPS

        const needed = Math.ceil(
          (targetRatio * total - promoters + detractors) / (1 - targetRatio)
        );

        return Math.max(0, needed);
      };

      if (systemNps !== null && (nps ?? 0) < systemNps) {
        toReachAverage = calculatePromotersNeeded(systemNps);
      }

      if ((nps ?? 0) < 70) {
        toReachWorldClass = calculatePromotersNeeded(70);
      }
    }

    return {
      totalResponses: total,
      promoters,
      passives,
      detractors,
      nps,
      responseRate: invites > 0 ? Math.round((total / invites) * 100) : null,
      // Benchmarking data
      systemAverage: systemNps,
      systemTotalResponses: systemTotal,
      campgroundsInSystem: campgroundsWithResponses,
      // Guidance
      toReachAverage,
      toReachWorldClass,
      isAboveAverage: nps !== null && systemNps !== null ? nps > systemNps : null,
      isWorldClass: nps !== null ? nps >= 70 : false
    };
  }
}

