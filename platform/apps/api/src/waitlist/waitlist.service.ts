import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import type { PrismaService as PrismaServiceType } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import type { EmailService as EmailServiceType } from "../email/email.service";
import { CreateWaitlistEntryDto } from "@keepr/shared";
import { IdempotencyStatus, WaitlistStatus, WaitlistType } from "@prisma/client";
import { IdempotencyService } from "../payments/idempotency.service";
import type { IdempotencyService as IdempotencyServiceType } from "../payments/idempotency.service";
import { ObservabilityService } from "../observability/observability.service";
import type { ObservabilityService as ObservabilityServiceType } from "../observability/observability.service";
import type { Request } from "express";

interface CreateStaffWaitlistDto {
  campgroundId: string;
  type: "regular" | "seasonal";
  contactName: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
  siteId?: string;
  siteTypeId?: string;
  arrivalDate?: string;
  departureDate?: string;
  priority?: number;
  autoOffer?: boolean;
  maxPrice?: number;
  flexibleDates?: boolean;
  flexibleDays?: number;
}

export interface WaitlistMatch {
  entry: WaitlistScoreEntry;
  score: number;
  reasons: string[];
}

export type WaitlistStore = {
  waitlistEntry: Pick<
    PrismaServiceType["waitlistEntry"],
    "create" | "findMany" | "findUnique" | "update" | "updateMany" | "delete"
  >;
  $queryRaw: PrismaServiceType["$queryRaw"];
};

export type WaitlistEmailSender = Pick<EmailServiceType, "sendEmail">;
export type WaitlistIdempotency = Pick<
  IdempotencyServiceType,
  "start" | "complete" | "fail" | "findBySequence"
>;
export type WaitlistObservability = Pick<ObservabilityServiceType, "recordOfferLag">;

export type WaitlistActor = { campgroundId?: string | null; tenantId?: string | null };
type WaitlistCreatePayload = CreateWaitlistEntryDto & { tenantId?: string | null };

export type WaitlistScoreGuest = {
  reservationCount?: number | null;
  email?: string | null;
  primaryFirstName?: string | null;
};

export type WaitlistScoreEntry = {
  id?: string;
  campgroundId?: string | null;
  priority?: number | null;
  createdAt: Date | string;
  guest?: WaitlistScoreGuest | null;
  Guest?: WaitlistScoreGuest | null;
  arrivalDate?: Date | string | null;
  departureDate?: Date | string | null;
  siteId?: string | null;
  maxPrice?: number | null;
  autoOffer?: boolean | null;
  contactEmail?: string | null;
  contactName?: string | null;
  notifiedCount?: number | null;
};

const toWaitlistType = (value?: string | null): WaitlistType | null => {
  if (value === WaitlistType.regular || value === WaitlistType.seasonal) return value;
  return null;
};

export const calculatePriorityScore = (
  entry: WaitlistScoreEntry,
  freedArrival: Date,
  freedDeparture: Date,
): { score: number; reasons: string[] } => {
  let score = 0;
  const reasons: string[] = [];
  const guest = entry.guest ?? entry.Guest ?? null;

  // Base priority (user-defined or default)
  score += entry.priority || 50;
  reasons.push(`Base priority: ${entry.priority || 50}`);

  // Loyalty bonus: returning guests
  if ((guest?.reservationCount ?? 0) > 0) {
    const loyaltyBonus = Math.min((guest?.reservationCount ?? 0) * 5, 25);
    score += loyaltyBonus;
    reasons.push(`Loyalty bonus: +${loyaltyBonus} (${guest?.reservationCount ?? 0} stays)`);
  }

  // Exact date match bonus
  if (entry.arrivalDate && entry.departureDate) {
    const entryArr = new Date(entry.arrivalDate);
    const entryDep = new Date(entry.departureDate);
    const freedArr = new Date(freedArrival);
    const freedDep = new Date(freedDeparture);

    if (entryArr.getTime() === freedArr.getTime() && entryDep.getTime() === freedDep.getTime()) {
      score += 30;
      reasons.push(`Exact date match: +30`);
    } else {
      // Partial overlap bonus
      score += 10;
      reasons.push(`Date overlap: +10`);
    }
  }

  // Specific site preference bonus
  if (entry.siteId) {
    score += 15;
    reasons.push(`Specific site preference: +15`);
  }

  // How long they've been waiting
  const waitDays = Math.floor(
    (Date.now() - new Date(entry.createdAt).getTime()) / (1000 * 60 * 60 * 24),
  );
  const waitBonus = Math.min(waitDays, 30);
  score += waitBonus;
  reasons.push(`Wait time bonus: +${waitBonus} (${waitDays} days)`);

  // Premium/higher rate willingness
  if (entry.maxPrice && entry.maxPrice > 0) {
    score += 10;
    reasons.push(`Price flexibility: +10`);
  }

  // Auto-offer enabled bonus
  if (entry.autoOffer) {
    score += 20;
    reasons.push(`Auto-offer enabled: +20`);
  }

  return { score, reasons };
};

@Injectable()
export class WaitlistService {
  private readonly logger = new Logger(WaitlistService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: WaitlistStore,
    @Inject(EmailService) private readonly emailService: WaitlistEmailSender,
    @Inject(IdempotencyService) private readonly idempotency: WaitlistIdempotency,
    @Inject(ObservabilityService) private readonly observability: WaitlistObservability,
  ) {}

  async create(
    dto: WaitlistCreatePayload,
    idempotencyKey?: string,
    sequence?: string | number | null,
    actor?: WaitlistActor,
  ) {
    const scope = {
      campgroundId: dto.campgroundId ?? actor?.campgroundId ?? null,
      tenantId: dto.tenantId ?? actor?.tenantId ?? null,
    };
    const scopeKey = this.scopeKey(scope);
    if (sequence) {
      const seqExisting = await this.idempotency.findBySequence(
        scopeKey,
        "waitlist/create",
        sequence,
      );
      if (seqExisting?.responseJson) {
        this.logger.warn(`Duplicate waitlist create seq ${sequence} scope ${scopeKey}`);
        return seqExisting.responseJson;
      }
      if (seqExisting) {
        this.logger.warn(
          `Waitlist create seq ${sequence} already processed without snapshot for scope ${scopeKey}`,
        );
        throw new ConflictException("Waitlist request already processed");
      }
    }
    const existing = await this.guardIdempotency(
      idempotencyKey,
      dto,
      scope,
      "waitlist/create",
      sequence,
    );
    if (existing?.status === IdempotencyStatus.succeeded && existing.responseJson)
      return existing.responseJson;
    if (
      existing?.status === IdempotencyStatus.inflight &&
      existing.createdAt &&
      Date.now() - new Date(existing.createdAt).getTime() < 60000
    ) {
      throw new ConflictException("Request already in progress");
    }

    const result = await this.prisma.waitlistEntry.create({
      data: {
        id: randomUUID(),
        ...dto,
        status: WaitlistStatus.active,
      },
    });

    if (idempotencyKey) await this.idempotency.complete(idempotencyKey, result);
    return result;
  }

  async createStaffEntry(
    dto: CreateStaffWaitlistDto,
    idempotencyKey?: string,
    sequence?: string | number | null,
    actor?: WaitlistActor,
  ) {
    const scope = {
      campgroundId: dto.campgroundId ?? actor?.campgroundId ?? null,
      tenantId: actor?.tenantId ?? null,
    };
    const scopeKey = this.scopeKey(scope);
    if (sequence) {
      const seqExisting = await this.idempotency.findBySequence(
        scopeKey,
        "waitlist/staff",
        sequence,
      );
      if (seqExisting?.responseJson) {
        this.logger.warn(`Duplicate staff waitlist create seq ${sequence} scope ${scopeKey}`);
        return seqExisting.responseJson;
      }
      if (seqExisting) {
        this.logger.warn(
          `Staff waitlist create seq ${sequence} already processed for scope ${scopeKey}`,
        );
        throw new ConflictException("Waitlist request already processed");
      }
    }
    const existing = await this.guardIdempotency(
      idempotencyKey,
      dto,
      scope,
      "waitlist/staff",
      sequence,
    );
    if (existing?.status === IdempotencyStatus.succeeded && existing.responseJson)
      return existing.responseJson;
    if (
      existing?.status === IdempotencyStatus.inflight &&
      existing.createdAt &&
      Date.now() - new Date(existing.createdAt).getTime() < 60000
    ) {
      throw new ConflictException("Request already in progress");
    }

    const waitlistType = toWaitlistType(dto.type) ?? WaitlistType.regular;
    const result = await this.prisma.waitlistEntry.create({
      data: {
        id: randomUUID(),
        campgroundId: dto.campgroundId,
        type: waitlistType,
        contactName: dto.contactName,
        contactEmail: dto.contactEmail || null,
        contactPhone: dto.contactPhone || null,
        notes: dto.notes || null,
        siteId: dto.siteId || null,
        siteTypeId: dto.siteTypeId || null,
        arrivalDate: dto.arrivalDate ? new Date(dto.arrivalDate) : null,
        departureDate: dto.departureDate ? new Date(dto.departureDate) : null,
        status: WaitlistStatus.active,
        priority: dto.priority ?? 50,
        autoOffer: dto.autoOffer ?? false,
        maxPrice: dto.maxPrice ?? null,
        flexibleDates: dto.flexibleDates ?? false,
        flexibleDays: dto.flexibleDays ?? 0,
      },
      include: { Site: true, SiteClass: true },
    });

    if (idempotencyKey) await this.idempotency.complete(idempotencyKey, result);
    return result;
  }

  async updateEntry(id: string, campgroundId: string, updates: Partial<CreateStaffWaitlistDto>) {
    // Validate entry belongs to this campground
    const existing = await this.prisma.waitlistEntry.findUnique({
      where: { id },
      select: { campgroundId: true },
    });
    if (!existing) throw new NotFoundException("Waitlist entry not found");
    if (existing.campgroundId !== campgroundId) {
      throw new ForbiddenException("Access denied to this waitlist entry");
    }

    return this.prisma.waitlistEntry.update({
      where: { id },
      data: {
        ...(updates.contactName && { contactName: updates.contactName }),
        ...(updates.contactEmail !== undefined && { contactEmail: updates.contactEmail || null }),
        ...(updates.contactPhone !== undefined && { contactPhone: updates.contactPhone || null }),
        ...(updates.notes !== undefined && { notes: updates.notes || null }),
        ...(updates.siteId !== undefined && { siteId: updates.siteId || null }),
        ...(updates.siteTypeId !== undefined && { siteTypeId: updates.siteTypeId || null }),
        ...(updates.arrivalDate !== undefined && {
          arrivalDate: updates.arrivalDate ? new Date(updates.arrivalDate) : null,
        }),
        ...(updates.departureDate !== undefined && {
          departureDate: updates.departureDate ? new Date(updates.departureDate) : null,
        }),
        ...(updates.priority !== undefined && { priority: updates.priority }),
        ...(updates.autoOffer !== undefined && { autoOffer: updates.autoOffer }),
        ...(updates.maxPrice !== undefined && { maxPrice: updates.maxPrice }),
        ...(updates.flexibleDates !== undefined && { flexibleDates: updates.flexibleDates }),
        ...(updates.flexibleDays !== undefined && { flexibleDays: updates.flexibleDays }),
      },
      include: { Site: true, SiteClass: true, Guest: true },
    });
  }

  async getStats(campgroundId: string) {
    // Single query with conditional aggregation instead of 6 separate count queries
    const result = await this.prisma.$queryRaw<
      [
        {
          active: bigint;
          offered: bigint;
          converted: bigint;
          expired: bigint;
          cancelled: bigint;
        },
      ]
    >`
            SELECT
                COUNT(*) FILTER (WHERE status = 'active') as active,
                COUNT(*) FILTER (WHERE status = 'active' AND "lastOfferSentAt" IS NOT NULL) as offered,
                COUNT(*) FILTER (WHERE status = 'fulfilled') as converted,
                COUNT(*) FILTER (WHERE status = 'expired') as expired,
                COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled
            FROM "WaitlistEntry"
            WHERE "campgroundId" = ${campgroundId}
        `;
    const stats = result[0];
    const active = Number(stats?.active ?? 0);
    const offered = Number(stats?.offered ?? 0);
    const convertedTotal = Number(stats?.converted ?? 0);
    const expiredTotal = Number(stats?.expired ?? 0) + Number(stats?.cancelled ?? 0);
    return {
      active,
      offered,
      converted: convertedTotal,
      expired: expiredTotal,
      total: active + convertedTotal + expiredTotal,
    };
  }

  async findAll(
    campgroundId: string,
    options?: { type?: string; limit?: number; offset?: number },
  ) {
    const limit = Math.min(options?.limit ?? 100, 500);
    const offset = options?.offset ?? 0;
    const type = options?.type;
    const waitlistType = toWaitlistType(type);

    return this.prisma.waitlistEntry.findMany({
      where: {
        campgroundId,
        ...(waitlistType ? { type: waitlistType } : {}),
      },
      include: { Guest: true, Site: true, SiteClass: true },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });
  }

  async remove(id: string, campgroundId: string) {
    // Validate entry belongs to this campground
    const existing = await this.prisma.waitlistEntry.findUnique({
      where: { id },
      select: { campgroundId: true },
    });
    if (!existing) throw new NotFoundException("Waitlist entry not found");
    if (existing.campgroundId !== campgroundId) {
      throw new ForbiddenException("Access denied to this waitlist entry");
    }

    return this.prisma.waitlistEntry.delete({
      where: { id },
    });
  }

  async accept(
    id: string,
    idempotencyKey?: string,
    sequence?: string | number | null,
    actor?: WaitlistActor,
  ) {
    const scope = { campgroundId: actor?.campgroundId ?? null, tenantId: actor?.tenantId ?? null };
    const scopeKey = this.scopeKey(scope);
    if (sequence) {
      const seqExisting = await this.idempotency.findBySequence(
        scopeKey,
        "waitlist/accept",
        sequence,
      );
      if (seqExisting?.responseJson) {
        this.logger.warn(`Duplicate waitlist accept seq ${sequence} scope ${scopeKey}`);
        return seqExisting.responseJson;
      }
      if (seqExisting) {
        this.logger.warn(`Waitlist accept seq ${sequence} already processed for scope ${scopeKey}`);
        throw new ConflictException("Waitlist accept already processed");
      }
    }
    const existing = await this.guardIdempotency(
      idempotencyKey,
      { entryId: id },
      scope,
      "waitlist/accept",
      sequence,
    );
    if (existing?.status === IdempotencyStatus.succeeded && existing.responseJson)
      return existing.responseJson;
    if (
      existing?.status === IdempotencyStatus.inflight &&
      existing.createdAt &&
      Date.now() - new Date(existing.createdAt).getTime() < 60000
    ) {
      throw new ConflictException("Request already in progress");
    }

    const entry = await this.prisma.waitlistEntry.findUnique({ where: { id } });
    if (!entry) {
      if (idempotencyKey) await this.idempotency.fail(idempotencyKey);
      throw new NotFoundException("Waitlist entry not found");
    }
    if (entry.status === WaitlistStatus.fulfilled) {
      if (idempotencyKey) await this.idempotency.fail(idempotencyKey);
      throw new ConflictException("Waitlist entry already accepted");
    }
    if (entry.status !== WaitlistStatus.active) {
      if (idempotencyKey) await this.idempotency.fail(idempotencyKey);
      throw new ConflictException("Waitlist entry not active");
    }

    const response = await this.prisma.waitlistEntry.update({
      where: { id },
      data: { status: WaitlistStatus.fulfilled },
    });

    const snapshot: { entryId: string; status: "accepted" } = { entryId: id, status: "accepted" };
    if (idempotencyKey) await this.idempotency.complete(idempotencyKey, snapshot);
    return snapshot;
  }

  /**
   * Check waitlist for matches after a cancellation.
   * Returns prioritized matches sorted by score.
   */
  async checkWaitlist(
    campgroundId: string,
    arrival: Date,
    departure: Date,
    siteId: string,
    siteClassId?: string,
  ): Promise<WaitlistMatch[]> {
    this.logger.log(
      `Checking waitlist for campground ${campgroundId} dates ${arrival.toISOString()} - ${departure.toISOString()}`,
    );

    const cooldownHours = Number(process.env.WAITLIST_NOTIFY_COOLDOWN_HOURS ?? 6);
    const cooldownThreshold =
      cooldownHours > 0 ? new Date(Date.now() - cooldownHours * 60 * 60 * 1000) : null;

    // Find active waitlist entries that overlap the freed range and match site preference
    const entries = await this.prisma.waitlistEntry.findMany({
      where: {
        campgroundId,
        status: WaitlistStatus.active,
        arrivalDate: { lt: departure },
        departureDate: { gt: arrival },
        OR: [
          { siteId: null, siteTypeId: null }, // any
          { siteId: siteId }, // specific site
          { siteTypeId: siteClassId }, // specific class
        ],
        ...(cooldownThreshold
          ? {
              lastNotifiedAt: {
                lt: cooldownThreshold,
              },
            }
          : {}),
      },
      include: { Guest: true },
    });

    // Calculate priority scores and sort
    const scoredMatches: WaitlistMatch[] = entries
      .map((entry) => {
        const { score, reasons } = calculatePriorityScore(entry, arrival, departure);
        return { entry, score, reasons };
      })
      .sort((a: WaitlistMatch, b: WaitlistMatch) => b.score - a.score);

    this.logger.log(`Found ${scoredMatches.length} waitlist matches, sorted by priority.`);
    return scoredMatches;
  }

  /**
   * Notify waitlist matches about availability
   */
  async notifyMatches(
    matches: WaitlistMatch[],
    siteNumber: string,
    campgroundName: string,
    arrival: Date,
    departure: Date,
  ) {
    let notified = 0;
    let autoOffered = 0;

    for (const { entry, score } of matches) {
      const guest = entry.guest ?? entry.Guest ?? null;
      if (!guest && !entry.contactEmail) {
        this.logger.warn(`Skipping waitlist entry ${entry.id} due to missing contact info`);
        continue;
      }

      const email = guest?.email || entry.contactEmail;
      const name = guest?.primaryFirstName || entry.contactName || "Guest";

      if (!email) continue;

      try {
        const isAutoOffer = entry.autoOffer === true;
        const subject = isAutoOffer
          ? `Auto-Reserved: Site ${siteNumber} is yours!`
          : `Good News! Site ${siteNumber} is available!`;

        const html = isAutoOffer
          ? `
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px; padding: 24px; text-align: center; color: white;">
                            <h1 style="margin: 0;">You're In!</h1>
                            <p style="margin: 8px 0 0 0; opacity: 0.9;">We auto-reserved this site for you</p>
                        </div>
                        <div style="padding: 24px;">
                            <p>Dear ${name},</p>
                            <p>Great news! Based on your auto-offer preference, we've automatically reserved <strong>Site ${siteNumber}</strong> at <strong>${campgroundName}</strong> for you.</p>
                            <p><strong>Dates:</strong> ${arrival.toLocaleDateString()} - ${departure.toLocaleDateString()}</p>
                            <p style="background: #fef3c7; border-radius: 8px; padding: 16px; margin: 20px 0;">
                                <strong>Important:</strong> Please confirm and complete payment within 24 hours or this reservation will be released.
                            </p>
                            <a href="#" style="display: inline-block; background: #10b981; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">Confirm & Pay Now</a>
                        </div>
                    </div>
                `
          : `
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h1 style="color: #10b981;">Site Available!</h1>
                        <p>Dear ${name},</p>
                        <p>Good news! <strong>Site ${siteNumber}</strong> has become available at <strong>${campgroundName}</strong> for your desired dates:</p>
                        <p><strong>${arrival.toLocaleDateString()} - ${departure.toLocaleDateString()}</strong></p>
                        <p>This is first-come, first-served, so book soon!</p>
                        <a href="#" style="display: inline-block; background: #10b981; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; margin-top: 16px;">Book Now</a>
                        <p style="color: #64748b; font-size: 12px; margin-top: 24px;">Your priority score: ${score}</p>
                    </div>
                `;

        await this.emailService.sendEmail({
          to: email,
          subject,
          html,
          campgroundId: entry.campgroundId ?? undefined,
        });

        await this.prisma.waitlistEntry.update({
          where: { id: entry.id },
          data: {
            lastNotifiedAt: new Date(),
            notifiedCount: (entry.notifiedCount ?? 0) + 1,
            status: WaitlistStatus.active,
          },
        });

        // Record offer lag for observability (time from entry creation to notification)
        const createdAt = entry.createdAt ? new Date(entry.createdAt).getTime() : Date.now();
        const lagSeconds = Math.max(0, (Date.now() - createdAt) / 1000);
        this.observability.recordOfferLag(lagSeconds, {
          entryId: entry.id,
          campgroundId: entry.campgroundId,
          autoOffer: isAutoOffer,
          status: isAutoOffer ? "auto_offer" : "notify",
        });

        notified++;
        if (isAutoOffer) autoOffered++;
      } catch (err) {
        this.logger.warn(`Failed to notify waitlist entry ${entry.id}: ${err}`);
      }
    }

    return { notified, autoOffered };
  }

  /**
   * Mark entry as converted (booked)
   */
  async markConverted(id: string, reservationId: string) {
    return this.prisma.waitlistEntry.update({
      where: { id },
      data: {
        status: WaitlistStatus.fulfilled,
        convertedReservationId: reservationId,
        convertedAt: new Date(),
      },
    });
  }

  /**
   * Expire old waitlist entries
   */
  async expireOldEntries(campgroundId: string, daysOld: number = 90) {
    const threshold = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

    const result = await this.prisma.waitlistEntry.updateMany({
      where: {
        campgroundId,
        status: WaitlistStatus.active,
        createdAt: { lt: threshold },
      },
      data: {
        status: WaitlistStatus.expired,
      },
    });

    this.logger.log(`Expired ${result.count} old waitlist entries for campground ${campgroundId}`);
    return result.count;
  }

  private scopeKey(scope: { campgroundId?: string | null; tenantId?: string | null }) {
    return scope.tenantId ?? scope.campgroundId ?? "global";
  }

  private async guardIdempotency(
    key: string | undefined,
    body: unknown,
    scope: { campgroundId?: string | null; tenantId?: string | null },
    endpoint: string,
    sequence?: string | number | null,
  ) {
    if (!key) return null;
    return this.idempotency.start(key, body ?? {}, scope.campgroundId ?? null, {
      tenantId: scope.tenantId ?? null,
      endpoint,
      sequence,
      rateAction: "apply",
    });
  }
}
