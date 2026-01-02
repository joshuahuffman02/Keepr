import { BadRequestException, ConflictException, Injectable, NotFoundException, Logger } from "@nestjs/common";
import { CheckInStatus, GamificationEventCategory, MaintenanceStatus, Prisma, ReferralIncentiveType, Reservation, ReservationStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateReservationDto } from "./dto/create-reservation.dto";
import { RefundPaymentDto } from "./dto/refund-payment.dto";
import { LockService } from "../redis/lock.service";
import { PromotionsService } from "../promotions/promotions.service";
import { AccessControlService } from "../access-control/access-control.service";

import { WaitlistService } from '../waitlist/waitlist.service';
import { EmailService } from '../email/email.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { TaxRulesService } from '../tax-rules/tax-rules.service';
import { postBalancedLedgerEntries, LedgerEntryInput } from "../ledger/ledger-posting.util";
import { AuditService } from "../audit/audit.service";

import { MatchScoreService } from "./match-score.service";
import { GamificationService } from "../gamification/gamification.service";
import { CommunicationPlaybook } from "@prisma/client";
import { Cron } from "@nestjs/schedule";
import { PricingV2Service } from "../pricing-v2/pricing-v2.service";
import { DepositPoliciesService } from "../deposit-policies/deposit-policies.service";
import { SignaturesService } from "../signatures/signatures.service";
import { ApprovalsService } from "../approvals/approvals.service";
import { UsageTrackerService } from "../org-billing/usage-tracker.service";
import { RepeatChargesService } from "../repeat-charges/repeat-charges.service";
import { PoliciesService } from "../policies/policies.service";
import { GuestWalletService } from "../guest-wallet/guest-wallet.service";
import { assertSiteLockValid } from "./reservation-guards";
import { evaluatePricingV2 } from "./reservation-pricing";
import { assertReservationDepositV2, calculateReservationDepositV2 } from "./reservation-deposit";
import { StripeService } from "../payments/stripe.service";
import { RealtimeService, ReservationEventData } from "../realtime";

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly locks: LockService,
    private readonly promotionsService: PromotionsService,
    private readonly emailService: EmailService,
    private readonly waitlistService: WaitlistService,
    private readonly loyaltyService: LoyaltyService,
    private readonly taxRulesService: TaxRulesService,
    private readonly matchScoreService: MatchScoreService,
    private readonly gamification: GamificationService,
    private readonly pricingV2Service: PricingV2Service,
    private readonly depositPoliciesService: DepositPoliciesService,
    private readonly accessControl: AccessControlService,
    private readonly signaturesService: SignaturesService,
    private readonly audit: AuditService,
    private readonly approvals: ApprovalsService,
    private readonly usageTracker: UsageTrackerService,
    private readonly repeatChargesService: RepeatChargesService,
    private readonly policiesService: PoliciesService,
    private readonly guestWalletService: GuestWalletService,
    private readonly stripeService: StripeService,
    private readonly realtime: RealtimeService
  ) { }

  async getMatchedSites(campgroundId: string, guestId: string) {
    // Fetch guest with only the fields needed for matching (not all reservations)
    const guest = await this.prisma.guest.findUnique({
      where: { id: guestId },
      select: {
        id: true,
        rigLength: true,
        preferences: true,
        // Only fetch distinct site history for this campground, not all reservations
        reservations: {
          where: { campgroundId },
          select: {
            siteId: true,
            site: { select: { siteClassId: true } }
          },
          distinct: ['siteId']
        }
      }
    });
    if (!guest) throw new NotFoundException("Guest not found");

    const sites = await this.prisma.site.findMany({
      where: { campgroundId, isActive: true },
      include: { siteClass: true }
    });

    const matches = sites.map(site => {
      const { score, reasons } = this.matchScoreService.calculateMatchScore(guest as any, site);
      return {
        site,
        score,
        reasons
      };
    });

    // Sort by score descending
    return matches.sort((a, b) => b.score - a.score);
  }



  private computeNights(arrival: Date, departure: Date) {
    const ms = departure.getTime() - arrival.getTime();
    if (!Number.isFinite(ms) || ms <= 0) return 1;
    return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
  }

  private async attachWaiverArtifacts(reservationId: string, guestId: string, evidence: { request?: any; artifact?: any; digital?: any }) {
    const ops: Promise<any>[] = [];

    if (evidence.request && (!evidence.request.reservationId || !evidence.request.guestId)) {
      ops.push(
        (this.prisma as any).signatureRequest?.update?.({
          where: { id: evidence.request.id },
          data: {
            reservationId: evidence.request.reservationId ?? reservationId,
            guestId: evidence.request.guestId ?? guestId
          }
        })
      );
    }

    if (evidence.artifact && (!evidence.artifact.reservationId || !evidence.artifact.guestId)) {
      ops.push(
        (this.prisma as any).signatureArtifact?.update?.({
          where: { id: evidence.artifact.id },
          data: {
            reservationId: evidence.artifact.reservationId ?? reservationId,
            guestId: evidence.artifact.guestId ?? guestId
          }
        })
      );
    }

    if (evidence.digital && (!evidence.digital.reservationId || !evidence.digital.guestId)) {
      ops.push(
        (this.prisma as any).digitalWaiver?.update?.({
          where: { id: evidence.digital.id },
          data: {
            reservationId: evidence.digital.reservationId ?? reservationId,
            guestId: evidence.digital.guestId ?? guestId
          }
        })
      );
    }

    if (ops.length) {
      try {
        await Promise.all(ops);
      } catch (err) {
        this.logger.warn("Failed to attach waiver artifacts to reservation", err);
      }
    }
  }

  private async hasSignedWaiver(reservationId: string, guestId: string) {
    const [signedRequest, digitalWaiver] = await Promise.all([
      (this.prisma as any).signatureRequest.findFirst?.({
        where: {
          documentType: "waiver",
          status: "signed",
          OR: [{ reservationId }, { reservationId: null, guestId }]
        },
        include: { artifact: true },
        orderBy: { signedAt: "desc" }
      }),
      (this.prisma as any).digitalWaiver.findFirst?.({
        where: {
          OR: [{ reservationId }, { reservationId: null, guestId }],
          status: "signed"
        },
        orderBy: { signedAt: "desc" }
      })
    ]);

    const signedArtifact =
      signedRequest?.artifact ??
      (await (this.prisma as any).signatureArtifact?.findFirst?.({
        where: {
          pdfUrl: { not: null },
          OR: [{ reservationId }, { reservationId: null, guestId }]
        }
      }));

    const hasEvidence = Boolean(signedRequest || signedArtifact || digitalWaiver);

    if (hasEvidence) {
      await this.attachWaiverArtifacts(reservationId, guestId, {
        request: signedRequest ?? undefined,
        artifact: signedArtifact ?? undefined,
        digital: digitalWaiver ?? undefined
      });
    }

    return hasEvidence;
  }

  private async attachIdVerification(reservationId: string, guestId: string, match: any) {
    if (!match || (match.reservationId && match.guestId)) return;
    try {
      await (this.prisma as any).idVerification?.update?.({
        where: { id: match.id },
        data: {
          reservationId: match.reservationId ?? reservationId,
          guestId: match.guestId ?? guestId
        }
      });
    } catch (err) {
      this.logger.warn("Failed to attach ID verification to reservation", err);
    }
  }

  private async hasVerifiedId(reservationId: string, guestId: string) {
    const now = new Date();
    const match = await (this.prisma as any).idVerification.findFirst?.({
      where: {
        status: "verified",
        OR: [
          { reservationId },
          {
            guestId,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
          }
        ]
      },
      orderBy: { verifiedAt: "desc" }
    });

    if (match) {
      await this.attachIdVerification(reservationId, guestId, match);
      return true;
    }

    return false;
  }

  private async checkCompliance(reservation: any) {
    const reasons: string[] = [];
    let signingUrl: string | undefined;

    if (reservation.paymentRequired && reservation.paymentStatus !== "paid") {
      reasons.push("payment_required");
    }
    if (reservation.idVerificationRequired) {
      const verified = await this.hasVerifiedId(reservation.id, reservation.guestId);
      if (!verified) reasons.push("id_verification_required");
    }
    if (reservation.waiverRequired) {
      const signed = await this.hasSignedWaiver(reservation.id, reservation.guestId);
      if (!signed) {
        reasons.push("waiver_required");
        try {
          const signatureResult = await this.signaturesService.autoSendForReservation(reservation);
          signingUrl = (signatureResult as any)?.signingUrl;
        } catch (err) {
          // auto-send best-effort
          signingUrl = undefined;
        }
      }
    }

    const policyCompliance = await this.policiesService.getPendingPolicyCompliance(reservation.id);
    if (!policyCompliance.ok) {
      reasons.push("policy_required");
      signingUrl = signingUrl ?? policyCompliance.signingUrl;
    }
    return { ok: reasons.length === 0, reason: reasons[0], reasons, signingUrl };
  }

  private computePaymentStatus(total: number, paid: number): string {
    if (!total || total <= 0) return "unpaid";
    if (paid >= total) return "paid";
    if (paid > 0) return "partial";
    return "unpaid";
  }

  private async enqueuePlaybooksForReservation(type: "arrival" | "unpaid" | "upsell", reservationId: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      select: { id: true, campgroundId: true, arrivalDate: true, guestId: true, totalAmount: true, paidAmount: true }
    });
    if (!reservation) return;

    const playbooks = await (this.prisma as any).communicationPlaybook.findMany({
      where: { campgroundId: reservation.campgroundId, type, enabled: true, templateId: { not: null } }
    });

    for (const pb of playbooks as CommunicationPlaybook[]) {
      const template = await (this.prisma as any).communicationTemplate.findFirst({
        where: { id: pb.templateId, status: "approved" }
      });
      if (!template) continue;

      // Check for existing pending/sent job for this playbook + reservation (prevents duplicates)
      const existingJob = await (this.prisma as any).communicationPlaybookJob.findFirst({
        where: {
          playbookId: pb.id,
          reservationId: reservation.id,
          status: { in: ["pending", "sent"] }
        }
      });
      if (existingJob) continue; // Skip if already queued or sent

      const scheduledAt = new Date(type === "arrival" ? reservation.arrivalDate : new Date());
      if (pb.offsetMinutes && Number.isFinite(pb.offsetMinutes)) {
        scheduledAt.setMinutes(scheduledAt.getMinutes() + pb.offsetMinutes);
      }
      await (this.prisma as any).communicationPlaybookJob.create({
        data: {
          playbookId: pb.id,
          campgroundId: reservation.campgroundId,
          reservationId: reservation.id,
          guestId: reservation.guestId,
          status: "pending",
          scheduledAt
        }
      });
    }
  }

  @Cron("0 */12 * * *") // every 12 hours
  async enqueueUnpaidSweep() {
    // Use raw SQL to filter unpaid reservations in the database instead of fetching all
    const due = await this.prisma.$queryRaw<{ id: string; campgroundId: string; guestId: string }[]>`
      SELECT id, "campgroundId", "guestId"
      FROM "Reservation"
      WHERE status != 'cancelled'
        AND "totalAmount" > 0
        AND COALESCE("paidAmount", 0) < "totalAmount"
    `;
    if (!due.length) return;

    // Fetch playbooks with their templates in a single query (join)
    const playbooks = await (this.prisma as any).communicationPlaybook.findMany({
      where: {
        type: "unpaid",
        enabled: true,
        templateId: { not: null }
      },
      include: {
        template: { select: { id: true, status: true } }
      }
    });

    // Filter to only playbooks with approved templates
    const validPlaybooks = (playbooks as any[]).filter(pb => pb.template?.status === "approved");
    if (!validPlaybooks.length) return;

    // Group due reservations by campgroundId for O(1) lookup
    const dueByCampground = new Map<string, typeof due>();
    for (const r of due) {
      if (!dueByCampground.has(r.campgroundId)) {
        dueByCampground.set(r.campgroundId, []);
      }
      dueByCampground.get(r.campgroundId)!.push(r);
    }

    // Batch create all jobs at once
    const jobsToCreate: {
      playbookId: string;
      campgroundId: string;
      reservationId: string;
      guestId: string;
      status: string;
      scheduledAt: Date;
    }[] = [];

    for (const pb of validPlaybooks) {
      const campgroundReservations = dueByCampground.get(pb.campgroundId) ?? [];
      for (const r of campgroundReservations) {
        const scheduledAt = new Date();
        if (pb.offsetMinutes && Number.isFinite(pb.offsetMinutes)) {
          scheduledAt.setMinutes(scheduledAt.getMinutes() + pb.offsetMinutes);
        }
        jobsToCreate.push({
          playbookId: pb.id,
          campgroundId: r.campgroundId,
          reservationId: r.id,
          guestId: r.guestId,
          status: "pending",
          scheduledAt
        });
      }
    }

    // Single batch insert instead of N individual creates
    if (jobsToCreate.length > 0) {
      await (this.prisma as any).communicationPlaybookJob.createMany({
        data: jobsToCreate,
        skipDuplicates: true
      });
    }
  }

  private isOverlapError(err: unknown) {
    return err instanceof Prisma.PrismaClientKnownRequestError && err.message.includes("Reservation_no_overlap");
  }

  /**
   * Find an available site in a given site class for the specified date range.
   * Uses batch query to check availability for all sites at once instead of N sequential queries.
   */
  private async findAvailableSiteInClass(
    campgroundId: string,
    siteClassId: string,
    arrival: Date,
    departure: Date,
    options?: {
      guestId?: string;
      rigType?: string | null;
      rigLength?: number | null;
      requiresAccessible?: boolean | null;
      requiredAmenities?: string[] | null;
      adults?: number;
      children?: number;
      holdId?: string | null;
    }
  ): Promise<string | null> {
    const now = new Date();
    const ignoreHoldId = options?.holdId ?? null;

    // Single query to get all available site IDs (no reservation/hold/maintenance/blackout conflicts)
    const availableSiteIds = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT s.id
      FROM "Site" s
      WHERE s."campgroundId" = ${campgroundId}
        AND s."siteClassId" = ${siteClassId}
        AND s."isActive" = true
        -- No overlapping reservations
        AND NOT EXISTS (
          SELECT 1 FROM "Reservation" r
          WHERE r."siteId" = s.id
            AND r.status != 'cancelled'
            AND tstzrange(r."arrivalDate", r."departureDate", '[)') && tstzrange(${arrival}, ${departure}, '[)')
        )
        -- No active holds (unless it's the one we're using)
        AND NOT EXISTS (
          SELECT 1 FROM "SiteHold" h
          WHERE h."siteId" = s.id
            AND h.status = 'active'
            AND (h."expiresAt" IS NULL OR h."expiresAt" > ${now})
            AND h."arrivalDate" < ${departure}
            AND h."departureDate" > ${arrival}
            ${ignoreHoldId ? Prisma.sql`AND h.id != ${ignoreHoldId}` : Prisma.sql``}
        )
        -- No blocking maintenance
        AND NOT EXISTS (
          SELECT 1 FROM "MaintenanceTicket" m
          WHERE m."siteId" = s.id
            AND m.status IN ('open', 'in_progress')
            AND (m."isBlocking" = true OR m."outOfOrder" = true OR m."outOfOrderUntil" > ${arrival})
        )
        -- No blackout dates
        AND NOT EXISTS (
          SELECT 1 FROM "BlackoutDate" b
          WHERE b."campgroundId" = ${campgroundId}
            AND (b."siteId" = s.id OR b."siteId" IS NULL)
            AND b."startDate" < ${departure}
            AND b."endDate" > ${arrival}
        )
    `;

    if (!availableSiteIds.length) {
      return null;
    }

    const availableIds = availableSiteIds.map(s => s.id);

    // Fetch full site details only for available sites
    const sites = await this.prisma.site.findMany({
      where: { id: { in: availableIds } },
      include: { siteClass: true }
    });

    if (!sites.length) {
      return null;
    }

    // Fetch guest for scoring (optimized: only distinct site history for this campground)
    const guest = options?.guestId
      ? await this.prisma.guest.findUnique({
          where: { id: options.guestId },
          select: {
            id: true,
            rigLength: true,
            preferences: true,
            reservations: {
              where: { campgroundId },
              select: { siteId: true, site: { select: { siteClassId: true } } },
              distinct: ['siteId']
            }
          }
        })
      : null;

    const candidates: { site: (typeof sites)[number]; score: number }[] = [];

    for (const site of sites) {
      try {
        this.validateAssignmentConstraints(
          {
            siteType: site.siteType,
            rigMaxLength: site.rigMaxLength,
            siteClassRigMaxLength: site.siteClass?.rigMaxLength ?? null,
            accessible: site.accessible,
            amenityTags: site.amenityTags,
            maxOccupancy: site.maxOccupancy
          },
          {
            rigType: options?.rigType,
            rigLength: options?.rigLength ?? null,
            requiresAccessible: options?.requiresAccessible ?? null,
            requiredAmenities: options?.requiredAmenities ?? null,
            adults: options?.adults ?? null,
            children: options?.children ?? null
          }
        );
        const match = guest ? this.matchScoreService.calculateMatchScore(guest as any, site as any) : { score: 0 };
        candidates.push({ site, score: match.score });
      } catch {
        // Skip sites that don't meet constraints
        continue;
      }
    }

    if (!candidates.length) {
      return null;
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].site.id;
  }

  /**
   * Fast overlap check using Postgres range operators to avoid Prisma-generated slow queries.
   */
  private async assertSiteAvailable(
    siteId: string,
    arrival: Date,
    departure: Date,
    ignoreReservationId?: string,
    ignoreHoldId?: string
  ) {
    const range = Prisma.sql`tstzrange(${arrival}, ${departure}, '[)'::text)`;
    const ignore = ignoreReservationId ? Prisma.sql`AND r."id" <> ${ignoreReservationId}` : Prisma.sql``;
    const site = await this.prisma.site.findUnique({ where: { id: siteId }, select: { campgroundId: true } });
    if (!site) {
      throw new NotFoundException("Site not found");
    }
    const result = await this.prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*)::int as count
      FROM "Reservation" r
      WHERE r."siteId" = ${siteId}
        AND r."status" != 'cancelled'
        ${ignore}
        AND tstzrange(r."arrivalDate", r."departureDate", '[)'::text) && ${range}
    `;
    const overlapCount = result?.[0]?.count ?? 0;
    if (overlapCount > 0) {
      throw new ConflictException("Site is not available for the selected dates.");
    }

    // Active holds block assignments unless it's the same hold being referenced
    const now = new Date();
    const holdCount = await (this.prisma as any).siteHold.count({
      where: {
        siteId,
        status: "active",
        ...(ignoreHoldId ? { id: { not: ignoreHoldId } } : {}),
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        arrivalDate: { lt: departure },
        departureDate: { gt: arrival }
      }
    });
    if (holdCount > 0) {
      throw new ConflictException("Site is currently on hold for these dates.");
    }

    // Maintenance tickets that block stays
    const maintenanceCount = await this.prisma.maintenanceTicket.count({
      where: {
        siteId,
        status: { in: [MaintenanceStatus.open, MaintenanceStatus.in_progress] },
        OR: [
          { isBlocking: true },
          { outOfOrder: true },
          { outOfOrderUntil: { gt: arrival } }
        ]
      }
    });
    if (maintenanceCount > 0) {
      throw new ConflictException("Site is unavailable due to maintenance.");
    }

    // Check for blackout dates
    const blackoutCount = await this.prisma.blackoutDate.count({
      where: {
        campgroundId: site.campgroundId,
        OR: [
          { siteId: siteId },
          { siteId: null }
        ],
        startDate: { lt: departure },
        endDate: { gt: arrival }
      }
    });

    if (blackoutCount > 0) {
      throw new ConflictException("Site is blacked out for maintenance or other reasons.");
    }
  }

  async calculateDeposit(id: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: { site: { select: { siteClassId: true } } }
    });
    if (!reservation) throw new NotFoundException("Reservation not found");

    const nights = this.computeNights(reservation.arrivalDate, reservation.departureDate);
    const depositCalc = await calculateReservationDepositV2(this.depositPoliciesService, {
      campgroundId: reservation.campgroundId,
      siteClassId: reservation.site?.siteClassId ?? null,
      totalAmountCents: reservation.totalAmount,
      lodgingOnlyCents: reservation.baseSubtotal,
      nights
    });

    const remainingBalance = Math.max(0, reservation.totalAmount - (reservation.paidAmount || 0));

    return {
      depositAmount: depositCalc.depositAmount,
      depositPolicyVersion: depositCalc.depositPolicyVersion,
      remainingBalance
    };
  }

  private buildPaymentFields(totalAmount: number, paidAmount: number) {
    const balanceAmount = Math.max(0, totalAmount - paidAmount);
    const paymentStatus = this.computePaymentStatus(totalAmount, paidAmount);
    return { balanceAmount, paymentStatus };
  }

  private isRigCompatible(
    site: { siteType: string; rigMaxLength?: number | null; siteClassRigMaxLength?: number | null },
    rigType?: string | null,
    rigLength?: number | null
  ) {
    if (!rigType && !rigLength) return true;
    const normalizedType = (rigType || "").toLowerCase();

    // Treat tents/cabins/cars as non-RV; no rig constraints
    if (["tent", "cabin", "car", "walkin", "walk-in"].includes(normalizedType)) {
      return true;
    }

    // For RV types, require RV sites and respect max length when provided
    if (site.siteType !== "rv") return false;
    const maxLength = site.rigMaxLength ?? site.siteClassRigMaxLength ?? null;
    if (rigLength && maxLength && rigLength > maxLength) return false;
    return true;
  }

  private validateAssignmentConstraints(
    site: {
      siteType: string;
      rigMaxLength?: number | null;
      siteClassRigMaxLength?: number | null;
      accessible?: boolean | null;
      amenityTags?: string[] | null;
      maxOccupancy?: number | null;
    },
    opts: {
      rigType?: string | null;
      rigLength?: number | null;
      requiresAccessible?: boolean | null;
      requiredAmenities?: string[] | null;
      adults?: number | null;
      children?: number | null;
    }
  ) {
    const occupancy = (opts.adults ?? 0) + (opts.children ?? 0);
    if (site.maxOccupancy && occupancy > site.maxOccupancy) {
      throw new BadRequestException(`Occupancy exceeds max for this site (${site.maxOccupancy}).`);
    }

    if (!this.isRigCompatible(site, opts.rigType, opts.rigLength ?? null)) {
      throw new BadRequestException("Rig type or length is not compatible with this site.");
    }

    if (opts.requiresAccessible && !site.accessible) {
      throw new BadRequestException("An ADA accessible site is required for this reservation.");
    }

    if (opts.requiredAmenities && opts.requiredAmenities.length > 0) {
      const siteAmenities = (site.amenityTags ?? []).map((a) => a.toLowerCase());
      const missing = opts.requiredAmenities.filter((a) => !siteAmenities.includes((a || "").toLowerCase()));
      if (missing.length > 0) {
        throw new BadRequestException(`Site is missing required amenities: ${missing.join(", ")}`);
      }
    }
  }

  async searchAvailability(campgroundId: string, arrivalDate: string, departureDate: string, rigType?: string, rigLength?: string) {
    if (!arrivalDate || !departureDate) {
      throw new BadRequestException("arrivalDate and departureDate are required");
    }
    const arrival = new Date(arrivalDate);
    const departure = new Date(departureDate);
    if (!(arrival instanceof Date) || isNaN(arrival.valueOf()) || !(departure instanceof Date) || isNaN(departure.valueOf())) {
      throw new BadRequestException("Invalid dates");
    }
    if (departure <= arrival) {
      throw new BadRequestException("departureDate must be after arrivalDate");
    }

    // Get all active sites for the campground
    const allSites = await this.prisma.site.findMany({
      where: {
        campgroundId,
        isActive: true
      },
      select: {
        id: true,
        campgroundId: true,
        name: true,
        siteNumber: true,
        siteType: true,
        siteClassId: true,
        maxOccupancy: true,
        isActive: true,
        rigMaxLength: true,
        siteClass: {
          select: {
            rigMaxLength: true,
            defaultRate: true,
            name: true,
            siteType: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    // Get all conflicting reservations
    const conflictingReservations = await this.prisma.reservation.findMany({
      where: {
        campgroundId,
        status: { not: ReservationStatus.cancelled },
        departureDate: { gt: arrival },
        arrivalDate: { lt: departure }
      },
      select: {
        siteId: true
      }
    });

    const conflictingSiteIds = new Set(conflictingReservations.map(r => r.siteId));

    // Get active holds overlapping the range
    const now = new Date();
    const holds = await (this.prisma as any).siteHold.findMany({
      where: {
        campgroundId,
        status: "active",
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        arrivalDate: { lt: departure },
        departureDate: { gt: arrival }
      },
      select: { siteId: true }
    });
    const holdSiteIds = new Set(holds.map((h: { siteId: string }) => h.siteId));

    // Get all blackout dates
    const blackouts = await this.prisma.blackoutDate.findMany({
      where: {
        campgroundId,
        startDate: { lt: departure },
        endDate: { gt: arrival }
      },
      select: {
        siteId: true
      }
    });

    const blackedOutSiteIds = new Set<string>();
    let campgroundBlackedOut = false;

    for (const b of blackouts) {
      if (b.siteId) {
        blackedOutSiteIds.add(b.siteId);
      } else {
        campgroundBlackedOut = true;
      }
    }

    if (campgroundBlackedOut) {
      return [];
    }

    // Filter out sites with conflicts
    const rigLengthNum = rigLength ? Number(rigLength) : null;
    const availableSites = allSites.filter(site =>
      !conflictingSiteIds.has(site.id) &&
      !blackedOutSiteIds.has(site.id) &&
      !holdSiteIds.has(site.id) &&
      this.isRigCompatible(
        {
          siteType: site.siteType || site.siteClass?.siteType || "rv",
          rigMaxLength: site.rigMaxLength,
          siteClassRigMaxLength: (site as any)?.siteClass?.rigMaxLength ?? null
        },
        rigType,
        Number.isFinite(rigLengthNum) ? rigLengthNum : null
      )
    );

    return availableSites;
  }

  /**
   * Get all sites with their current occupancy status for a given date range.
   * Returns: available, occupied, or maintenance status for each site.
   */
  async getSitesWithStatus(campgroundId: string, arrivalDate?: string, departureDate?: string) {
    const now = new Date();
    const arrival = arrivalDate ? new Date(arrivalDate) : now;
    const departure = departureDate ? new Date(departureDate) : new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { latitude: true, longitude: true }
    });
    const campgroundLat = campground?.latitude ? Number(campground.latitude) : null;
    const campgroundLng = campground?.longitude ? Number(campground.longitude) : null;

    // Get all active sites for the campground
    const allSites = await this.prisma.site.findMany({
      where: {
        campgroundId,
        isActive: true
      },
      include: {
        siteClass: {
          select: { name: true, defaultRate: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Get conflicting reservations with guest info
    const conflictingReservations = await this.prisma.reservation.findMany({
      where: {
        campgroundId,
        status: { not: ReservationStatus.cancelled },
        departureDate: { gt: arrival },
        arrivalDate: { lt: departure }
      },
      select: {
        siteId: true,
        arrivalDate: true,
        departureDate: true,
        guest: {
          select: { primaryFirstName: true, primaryLastName: true }
        }
      }
    });

    const occupiedSiteMap = new Map<string, { guestName: string; arrivalDate: Date; departureDate: Date }>();
    for (const r of conflictingReservations) {
      occupiedSiteMap.set(r.siteId, {
        guestName: `${r.guest.primaryFirstName} ${r.guest.primaryLastName}`,
        arrivalDate: r.arrivalDate,
        departureDate: r.departureDate
      });
    }

    // Get maintenance tickets (open or in_progress)
    const maintenanceTickets = await this.prisma.maintenanceTicket.findMany({
      where: {
        campgroundId,
        status: { in: [MaintenanceStatus.open, MaintenanceStatus.in_progress] },
        siteId: { not: null }
      },
      select: { siteId: true, title: true }
    });

    const maintenanceSiteMap = new Map<string, string>();
    for (const t of maintenanceTickets) {
      if (t.siteId) maintenanceSiteMap.set(t.siteId, t.title);
    }

    // Get blackout dates
    const blackouts = await this.prisma.blackoutDate.findMany({
      where: {
        campgroundId,
        startDate: { lt: departure },
        endDate: { gt: arrival }
      },
      select: { siteId: true, reason: true }
    });

    const blackoutSiteMap = new Map<string, string>();
    let campgroundBlackedOut = false;
    for (const b of blackouts) {
      if (b.siteId) {
        blackoutSiteMap.set(b.siteId, b.reason || 'Blacked out');
      } else {
        campgroundBlackedOut = true;
      }
    }

    // Build result with status for each site
    return allSites.map((site, idx) => {
      let status: 'available' | 'occupied' | 'maintenance' = 'available';
      let statusDetail: string | null = null;

      if (campgroundBlackedOut || blackoutSiteMap.has(site.id)) {
        status = 'maintenance';
        statusDetail = blackoutSiteMap.get(site.id) || 'Campground closed';
      } else if (maintenanceSiteMap.has(site.id)) {
        status = 'maintenance';
        statusDetail = maintenanceSiteMap.get(site.id) || 'Under maintenance';
      } else if (occupiedSiteMap.has(site.id)) {
        status = 'occupied';
        const occ = occupiedSiteMap.get(site.id)!;
        statusDetail = occ.guestName;
      }

      const derivedLat = site.latitude !== null && site.latitude !== undefined
        ? Number(site.latitude)
        : (campgroundLat !== null ? campgroundLat + 0.0005 * Math.sin(idx) : null);
      const derivedLng = site.longitude !== null && site.longitude !== undefined
        ? Number(site.longitude)
        : (campgroundLng !== null ? campgroundLng + 0.0005 * Math.cos(idx) : null);

      return {
        id: site.id,
        campgroundId: site.campgroundId,
        name: site.name,
        siteNumber: site.siteNumber,
        siteType: site.siteType,
        siteClassId: site.siteClassId,
        siteClassName: site.siteClass?.name || null,
        maxOccupancy: site.maxOccupancy,
        latitude: derivedLat,
        longitude: derivedLng,
        defaultRate: site.siteClass?.defaultRate ?? null,
        status,
        statusDetail
      };
    });
  }

  listByCampground(
    campgroundId: string,
    options?: {
      limit?: number;
      offset?: number;
      status?: string;
      fromDate?: Date;
      toDate?: Date;
    }
  ) {
    const limit = Math.min(options?.limit ?? 1000, 2000); // Increased default for calendar view
    const offset = options?.offset ?? 0;

    return this.prisma.reservation.findMany({
      where: {
        campgroundId,
        ...(options?.status && { status: options.status as any }),
        ...(options?.fromDate && { arrivalDate: { gte: options.fromDate } }),
        ...(options?.toDate && { departureDate: { lte: options.toDate } })
      },
      include: { guest: true, site: true },
      orderBy: { arrivalDate: 'asc' }, // Changed to ASC so current/near-term reservations come first
      take: limit,
      skip: offset
    });
  }

  /**
   * Search reservations by site number or guest name
   * Used for folio/charge-to-site lookups
   */
  async searchReservations(campgroundId: string, query: string, activeOnly = true) {
    if (!query || query.trim().length < 1) {
      return [];
    }

    const searchTerm = query.trim().toLowerCase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const reservations = await this.prisma.reservation.findMany({
      where: {
        campgroundId,
        // Only active reservations (confirmed or checked_in) if activeOnly
        ...(activeOnly && {
          status: { in: ['confirmed', 'checked_in'] },
          departureDate: { gte: today }, // Not yet departed
        }),
        OR: [
          // Search by site number/name
          { site: { number: { contains: searchTerm, mode: 'insensitive' } } },
          { site: { name: { contains: searchTerm, mode: 'insensitive' } } },
          // Search by guest name
          { guest: { firstName: { contains: searchTerm, mode: 'insensitive' } } },
          { guest: { lastName: { contains: searchTerm, mode: 'insensitive' } } },
          // Search by confirmation code
          { confirmationCode: { contains: searchTerm, mode: 'insensitive' } },
        ],
      },
      include: {
        guest: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        site: {
          select: {
            id: true,
            number: true,
            name: true,
            siteClass: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: [
        { status: 'asc' }, // checked_in first
        { arrivalDate: 'asc' },
      ],
      take: 10, // Limit results for typeahead
    });

    // Format results for display
    return reservations.map((res) => ({
      id: res.id,
      confirmationCode: res.confirmationCode,
      status: res.status,
      arrivalDate: res.arrivalDate,
      departureDate: res.departureDate,
      totalAmount: res.totalAmount,
      paidAmount: res.paidAmount,
      balanceAmount: Math.max(0, res.totalAmount - (res.paidAmount ?? 0)),
      guest: res.guest,
      site: res.site,
      displayLabel: `${res.site?.number || res.site?.name || 'No Site'} - ${res.guest?.firstName || ''} ${res.guest?.lastName || ''}`.trim(),
    }));
  }

  async findOne(id: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: {
        guest: true,
        site: { include: { siteClass: true } },
        campground: true,
        payments: true
      }
    });
    if (!reservation) throw new NotFoundException("Reservation not found");

    const paymentStatus = this.computePaymentStatus(reservation.totalAmount, reservation.paidAmount ?? 0);
    const balanceAmount = Math.max(0, reservation.totalAmount - (reservation.paidAmount ?? 0));

    return {
      ...reservation,
      paymentStatus,
      balanceAmount
    };
  }

  async create(data: CreateReservationDto) {
    const arrival = new Date(data.arrivalDate);
    const departure = new Date(data.departureDate);

    assertSiteLockValid(data.siteLocked, data.siteId);

    // If siteClassId is provided instead of siteId, find an available site in that class
    let siteId: string | null | undefined = data.siteId;
    if (!siteId && data.siteClassId) {
      siteId = await this.findAvailableSiteInClass(data.campgroundId, data.siteClassId, arrival, departure, {
        guestId: data.guestId,
        rigType: data.rigType ?? (data as any).rvType ?? null,
        rigLength: data.rigLength ?? null,
        requiresAccessible: (data as any).requiresAccessible ?? null,
        requiredAmenities: (data as any).requiredAmenities ?? null,
        adults: data.adults,
        children: data.children ?? 0,
        holdId: data.holdId ?? null
      });
      if (!siteId) {
        throw new ConflictException("No available sites found in the selected class for the given dates.");
      }
    }

    if (!siteId) {
      throw new BadRequestException("Either siteId or siteClassId must be provided.");
    }

    try {
      return await this.locks.withLocks([siteId], async () => {
        let hold: any = null;
        if (data.holdId) {
          hold = await (this.prisma as any).siteHold.findUnique({ where: { id: data.holdId } });
          const now = new Date();
          if (!hold) {
            throw new NotFoundException("Hold not found");
          }
          if (hold.status !== "active" || (hold.expiresAt && hold.expiresAt <= now)) {
            throw new ConflictException("Hold is not active");
          }
          if (hold.siteId !== siteId || hold.campgroundId !== data.campgroundId) {
            throw new ConflictException("Hold does not match site/campground");
          }
          if (!(hold.arrivalDate <= arrival && hold.departureDate >= departure)) {
            throw new ConflictException("Hold does not cover requested dates");
          }
        }

        await this.assertSiteAvailable(siteId, arrival, departure, undefined, data.holdId);

        // Get site info for siteClassId
        const siteInfo = await this.prisma.site.findUnique({
          where: { id: siteId },
          select: {
            siteClassId: true,
            siteType: true,
            rigMaxLength: true,
            accessible: true,
            amenityTags: true,
            maxOccupancy: true,
            siteClass: {
              select: { rigMaxLength: true, siteType: true, name: true }
            }
          }
        });

        if (!siteInfo) {
          throw new NotFoundException("Site not found");
        }

        this.validateAssignmentConstraints(
          {
            siteType: siteInfo.siteType,
            rigMaxLength: siteInfo.rigMaxLength,
            siteClassRigMaxLength: siteInfo.siteClass?.rigMaxLength ?? null,
            accessible: siteInfo.accessible,
            amenityTags: siteInfo.amenityTags,
            maxOccupancy: siteInfo.maxOccupancy
          },
          {
            rigType: data.rigType ?? (data as any).rvType ?? null,
            rigLength: data.rigLength ?? null,
            requiresAccessible: (data as any).requiresAccessible ?? null,
            requiredAmenities: (data as any).requiredAmenities ?? null,
            adults: data.adults,
            children: data.children ?? 0
          }
        );

        const baselinePrice = await evaluatePricingV2(
          this.prisma,
          this.pricingV2Service,
          data.campgroundId,
          siteId,
          arrival,
          departure
        );

        // Get campground pricing control settings
        const pricingControls = await this.prisma.campground.findUnique({
          where: { id: data.campgroundId },
          select: {
            maxDiscountFraction: true,
            managerApprovalThreshold: true,
            minOverrideRateCents: true,
            maxOverrideRateCents: true
          }
        });
        const manualPriceProvided = data.totalAmount !== undefined && data.totalAmount !== null && data.totalAmount > 0;
        const price = manualPriceProvided
          ? {
            totalCents: data.totalAmount,
            baseSubtotalCents: baselinePrice.baseSubtotalCents,
            rulesDeltaCents: baselinePrice.rulesDeltaCents,
            nights: this.computeNights(arrival, departure),
            pricingRuleVersion: "manual"
          }
          : baselinePrice;
        const manualDiscountProvided = (data.discountsAmount ?? 0) > 0;
        const manualOverrideDelta = manualPriceProvided ? data.totalAmount - baselinePrice.totalCents : 0;
        const overrideReason = (data as any).overrideReason as string | undefined;
        const overrideApprovedBy = (data as any).overrideApprovedBy as string | undefined;
        const needsOverrideApproval = (manualPriceProvided && manualOverrideDelta !== 0) || manualDiscountProvided;
        if (needsOverrideApproval && (!overrideReason || !overrideApprovedBy)) {
          throw new BadRequestException("Manual pricing overrides require overrideReason and overrideApprovedBy.");
        }

        // Validate override against campground pricing controls
        if (manualPriceProvided && pricingControls) {
          const maxDiscountFraction = pricingControls.maxDiscountFraction
            ? Number(pricingControls.maxDiscountFraction)
            : 0.4;
          const managerThreshold = pricingControls.managerApprovalThreshold
            ? Number(pricingControls.managerApprovalThreshold)
            : 0.25;

          // Calculate discount percentage (negative delta = discount)
          if (manualOverrideDelta < 0 && baselinePrice.totalCents > 0) {
            const discountPct = Math.abs(manualOverrideDelta) / baselinePrice.totalCents;

            // Hard cap - cannot exceed max discount
            if (discountPct > maxDiscountFraction) {
              throw new BadRequestException(
                `Override discount of ${Math.round(discountPct * 100)}% exceeds maximum allowed (${Math.round(maxDiscountFraction * 100)}%). ` +
                `Minimum allowed price: $${((baselinePrice.totalCents * (1 - maxDiscountFraction)) / 100).toFixed(2)}`
              );
            }

            // Manager approval required for discounts above threshold
            if (discountPct > managerThreshold && !overrideApprovedBy) {
              throw new BadRequestException(
                `Discounts above ${Math.round(managerThreshold * 100)}% require manager approval. ` +
                `Please provide overrideApprovedBy with a manager's user ID.`
              );
            }
          }

          // Validate against min/max rate bounds if configured
          const nights = this.computeNights(arrival, departure);
          const perNightRate = data.totalAmount / nights;

          if (pricingControls.minOverrideRateCents !== null && perNightRate < pricingControls.minOverrideRateCents) {
            throw new BadRequestException(
              `Per-night rate of $${(perNightRate / 100).toFixed(2)} is below minimum allowed ($${(pricingControls.minOverrideRateCents / 100).toFixed(2)}/night).`
            );
          }

          if (pricingControls.maxOverrideRateCents !== null && perNightRate > pricingControls.maxOverrideRateCents) {
            throw new BadRequestException(
              `Per-night rate of $${(perNightRate / 100).toFixed(2)} exceeds maximum allowed ($${(pricingControls.maxOverrideRateCents / 100).toFixed(2)}/night).`
            );
          }
        }

        let subtotal = price.totalCents;
        let discountCents = 0;
        let promoCode = data.promoCode || null;
        let promotionId: string | null = null;
        let referralProgram: any = null;
        let referralDiscountCents = 0;
        let referralIncentiveType: ReferralIncentiveType | null = null;
        let referralIncentiveValue = 0;
        let referralSource = data.referralSource ?? data.source ?? null;
        let referralChannel = data.referralChannel ?? null;

        // Apply promo code if provided
        if (promoCode) {
          try {
            const validation = await this.promotionsService.validate({
              campgroundId: data.campgroundId,
              code: promoCode,
              subtotal: subtotal
            });
            discountCents = validation.discountCents;
            promotionId = validation.promotionId;
          } catch (err) {
            // Re-throw validation errors (invalid code, expired, etc.)
            throw err;
          }
        }

        if (data.referralProgramId || data.referralCode) {
          referralProgram = await (this.prisma as any).referralProgram.findFirst({
            where: {
              campgroundId: data.campgroundId,
              isActive: true,
              OR: [
                data.referralProgramId ? { id: data.referralProgramId } : undefined,
                data.referralCode ? { code: data.referralCode } : undefined,
                data.referralCode ? { linkSlug: data.referralCode } : undefined
              ].filter(Boolean) as any[]
            }
          });
          if (!referralProgram) {
            throw new BadRequestException("Invalid or inactive referral code");
          }

          const basis = Math.max(0, subtotal - discountCents);
          referralIncentiveType = referralProgram.incentiveType as ReferralIncentiveType;
          referralIncentiveValue = referralProgram.incentiveValue ?? 0;
          referralSource = referralProgram.source ?? referralSource;
          referralChannel = referralProgram.channel ?? referralChannel;

          if (referralIncentiveType === ReferralIncentiveType.percent_discount) {
            referralDiscountCents = Math.min(basis, Math.floor(basis * (referralIncentiveValue / 100)));
          } else {
            referralDiscountCents = Math.min(basis, Math.max(0, referralIncentiveValue));
          }
        }

        const totalBeforeReferral = Math.max(0, subtotal - discountCents);
        const totalAmount = Math.max(0, totalBeforeReferral - referralDiscountCents);
        const paidAmount = data.paidAmount ?? 0;
        const status = data.status ?? ReservationStatus.pending;
        const allowPendingCardWithoutDeposit =
          data.paymentMethod === "card" &&
          status === ReservationStatus.pending &&
          paidAmount <= 0;

        const depositCalc = allowPendingCardWithoutDeposit
          ? await calculateReservationDepositV2(this.depositPoliciesService, {
              campgroundId: data.campgroundId,
              siteClassId: siteInfo?.siteClassId ?? null,
              totalAmountCents: totalAmount,
              lodgingOnlyCents: price.baseSubtotalCents,
              nights: price.nights
            })
          : await assertReservationDepositV2(this.depositPoliciesService, {
              campgroundId: data.campgroundId,
              siteClassId: siteInfo?.siteClassId ?? null,
              totalAmountCents: totalAmount,
              lodgingOnlyCents: price.baseSubtotalCents,
              paidAmountCents: paidAmount,
              nights: price.nights
            });
        const paymentFields = this.buildPaymentFields(totalAmount, paidAmount);

        const {
          paymentMethod,
          transactionId,
          paymentNotes,
          siteClassId,
          rvType,
          pets,
          petTypes,
          policyAcceptances,
          holdId: _holdId,
          requiresAccessible: _requiresAccessible,
          requiredAmenities: _requiredAmenities,
          overrideReason: _overrideReason,
          overrideApprovedBy: _overrideApprovedBy,
          seasonalRateId: _seasonalRateId,
          pricingType: _pricingType,
          ...reservationData
        } = data;

        const reservation = await this.prisma.reservation.create({
          data: {
            ...reservationData,
            seasonalRateId: data.seasonalRateId ?? null,
            pricingType: data.pricingType ?? "transient",
            rigType: data.rigType || rvType,
            siteId: siteId, // Use the determined siteId (either from data or found from siteClassId)
            children: data.children ?? 0,
            petCount: pets ?? 0,
            petTypes: petTypes && petTypes.length ? petTypes : null,
            status: data.status ?? ReservationStatus.pending,
            arrivalDate: arrival,
            departureDate: departure,
            paidAmount,
            totalAmount,
            baseSubtotal: data.baseSubtotal ?? price.baseSubtotalCents,
            feesAmount: data.feesAmount ?? 0,
            taxesAmount: data.taxesAmount ?? 0,
            discountsAmount:
              (discountCents > 0 ? discountCents : (data.discountsAmount ?? (price.rulesDeltaCents < 0 ? -price.rulesDeltaCents : 0))) +
              referralDiscountCents,
            promoCode: promoCode,
            referralProgramId: referralProgram?.id ?? data.referralProgramId ?? null,
            referralCode: referralProgram?.code ?? data.referralCode ?? null,
            referralSource: referralSource ?? null,
            referralChannel: referralChannel ?? null,
            referralIncentiveType: referralIncentiveType,
            referralIncentiveValue: referralDiscountCents || referralIncentiveValue || null,
            stayReasonPreset: data.stayReasonPreset ?? null,
            stayReasonOther: data.stayReasonOther ?? null,
            depositAmount: depositCalc.depositAmount,
            depositDueDate: new Date(), // Due immediately upon booking
            pricingRuleVersion: price.pricingRuleVersion,
            depositPolicyVersion: depositCalc.depositPolicyVersion,
            ...paymentFields,
            checkInAt: data.checkInAt ? new Date(data.checkInAt) : null,
            checkOutAt: data.checkOutAt ? new Date(data.checkOutAt) : null,
            notes: data.notes ?? null
          },
          include: {
            site: {
              include: {
                siteClass: true
              }
            },
            guest: true,
            campground: { select: { name: true } }
          }
        });

        // Audit reservation creation
        await this.audit.record({
          campgroundId: data.campgroundId,
          actorId: data.createdBy ?? data.updatedBy ?? null,
          action: "reservation.create",
          entity: "reservation",
          entityId: reservation.id,
          before: null,
          after: {
            id: reservation.id,
            guestId: reservation.guestId,
            guestName: `${reservation.guest?.primaryFirstName} ${reservation.guest?.primaryLastName}`,
            siteId: reservation.siteId,
            siteName: reservation.site?.siteNumber,
            arrivalDate: reservation.arrivalDate,
            departureDate: reservation.departureDate,
            status: reservation.status,
            totalAmount: reservation.totalAmount,
            source: reservation.source
          }
        });

        await this.enqueuePlaybooksForReservation("arrival", reservation.id);

        if (reservation.seasonalRateId) {
          try {
            await this.repeatChargesService.generateCharges(reservation.id);
          } catch (err) {
            this.logger.error(`Failed to generate repeat charges for reservation ${reservation.id}:`, err instanceof Error ? err.stack : err);
          }
        }

        if (hold?.id) {
          await (this.prisma as any).siteHold.update({
            where: { id: hold.id },
            data: { status: "released", expiresAt: hold.expiresAt ?? new Date() }
          });
        }

        // Create payment record if paidAmount > 0
        if (paidAmount > 0) {
          await this.prisma.payment.create({
            data: {
              campgroundId: data.campgroundId,
              reservationId: reservation.id,
              amountCents: paidAmount,
              method: paymentMethod || "card", // Default to card if not specified
              direction: "charge",
              note: paymentNotes || (transactionId ? `Transaction ID: ${transactionId}` : "Initial payment")
            }
          });

          const revenueGl = reservation.site?.siteClass?.glCode ?? "REVENUE_UNMAPPED";
          const revenueAccount = reservation.site?.siteClass?.clientAccount ?? "Revenue";
          await postBalancedLedgerEntries(this.prisma, [
            {
              campgroundId: data.campgroundId,
              reservationId: reservation.id,
              glCode: "CASH",
              account: "Cash",
              description: paymentNotes || "Initial reservation payment",
              amountCents: paidAmount,
              direction: "debit",
              externalRef: transactionId ?? undefined,
              dedupeKey: transactionId ? `res:${reservation.id}:init:${transactionId}:debit` : `res:${reservation.id}:init:debit`
            },
            {
              campgroundId: data.campgroundId,
              reservationId: reservation.id,
              glCode: revenueGl,
              account: revenueAccount,
              description: paymentNotes || "Initial reservation payment",
              amountCents: paidAmount,
              direction: "credit",
              externalRef: transactionId ?? undefined,
              dedupeKey: transactionId ? `res:${reservation.id}:init:${transactionId}:credit` : `res:${reservation.id}:init:credit`
            }
          ]);

          // Send payment receipt email
          try {
            await this.emailService.sendPaymentReceipt({
              guestEmail: reservation.guest.email,
              guestName: `${reservation.guest.primaryFirstName} ${reservation.guest.primaryLastName}`,
              campgroundName: reservation.campground?.name || "Campground",
              amountCents: paidAmount,
              paymentMethod: paymentMethod || "card",
              transactionId: transactionId ?? undefined,
              reservationId: reservation.id,
              siteNumber: reservation.site?.siteNumber,
              arrivalDate: reservation.arrivalDate,
              departureDate: reservation.departureDate,
              source: reservation.source || "admin",
              totalCents: paidAmount,
              kind: "payment"
            });
          } catch (emailError) {
            this.logger.error("Failed to send payment receipt email:", emailError instanceof Error ? emailError.stack : emailError);
          }
        }

        // Increment promotion usage count if promo was applied
        if (promotionId) {
          await this.promotionsService.incrementUsage(promotionId);
        }

        if (needsOverrideApproval) {
          await this.audit.record({
            campgroundId: data.campgroundId,
            actorId: overrideApprovedBy ?? data.updatedBy ?? data.createdBy ?? null,
            action: "reservation_override",
            entity: "reservation",
            entityId: reservation.id,
            before: null,
            after: {
              totalAmount,
              baselineTotalCents: baselinePrice.totalCents,
              deltaCents: manualOverrideDelta,
              discountsAmount: reservation.discountsAmount ?? 0
            }
          });
          await this.approvals.create({
            type: "config_change",
            amount: Math.abs(manualOverrideDelta) / 100,
            currency: "USD",
            reason: overrideReason || "Manual pricing override",
            requester: overrideApprovedBy || data.updatedBy || data.createdBy || "unknown",
            metadata: {
              reservationId: reservation.id,
              guestId: reservation.guestId,
              siteId: reservation.siteId,
              baselineTotalCents: baselinePrice.totalCents
            }
          });
        }

        try {
          await this.policiesService.applyPoliciesToReservation({
            reservation,
            guest: reservation.guest,
            site: reservation.site,
            siteClass: reservation.site?.siteClass,
            channel: reservation.source || "admin",
            acceptances: policyAcceptances
          });
        } catch (err) {
          this.logger.warn(`Policies auto-apply failed for reservation ${reservation.id}:`, err);
        }

        // Track usage for billing (non-blocking)
        this.usageTracker.trackBookingCreated(reservation.id, data.campgroundId, {
          totalAmount: totalAmount,
          nights: this.computeNights(arrival, departure),
          guestId: reservation.guestId,
        });

        // Emit real-time event for new reservation
        this.realtime.emitReservationCreated(data.campgroundId, {
          reservationId: reservation.id,
          guestId: reservation.guestId,
          guestName: `${reservation.guest.primaryFirstName} ${reservation.guest.primaryLastName}`,
          siteId: reservation.siteId ?? undefined,
          siteName: reservation.site?.siteNumber ?? undefined,
          arrivalDate: reservation.arrivalDate.toISOString(),
          departureDate: reservation.departureDate.toISOString(),
          status: reservation.status,
          totalCents: reservation.totalAmount,
          balanceCents: reservation.balanceAmount
        });

        return reservation;
      });
    } catch (err) {
      if (this.isOverlapError(err)) {
        throw new ConflictException("Site is not available for the selected dates.");
      }
      throw err;
    }
  }


  async update(id: string, data: Partial<CreateReservationDto>) {
    const existing = await this.prisma.reservation.findUnique({
      where: { id },
      include: { guest: true, campground: true, site: true }
    });
    if (!existing) throw new NotFoundException("Reservation not found");

    const arrival = data.arrivalDate ? new Date(data.arrivalDate) : existing.arrivalDate;
    const departure = data.departureDate ? new Date(data.departureDate) : existing.departureDate;
    const targetSiteId = data.siteId ?? existing.siteId;
    const lockIds = Array.from(new Set([existing.siteId, targetSiteId].filter(Boolean)));

    try {
      return await this.locks.withLocks(lockIds, async () => {
        await this.assertSiteAvailable(targetSiteId, arrival, departure, id);

        // Get site info for siteClassId
        const siteInfo = await this.prisma.site.findUnique({
          where: { id: targetSiteId },
          select: {
            siteClassId: true,
            siteType: true,
            rigMaxLength: true,
            accessible: true,
            amenityTags: true,
            maxOccupancy: true,
            siteClass: { select: { rigMaxLength: true, siteType: true, name: true } }
          }
        });

        if (!siteInfo) {
          throw new NotFoundException("Site not found");
        }

        this.validateAssignmentConstraints(
          {
            siteType: siteInfo.siteType,
            rigMaxLength: siteInfo.rigMaxLength,
            siteClassRigMaxLength: siteInfo.siteClass?.rigMaxLength ?? null,
            accessible: siteInfo.accessible,
            amenityTags: siteInfo.amenityTags,
            maxOccupancy: siteInfo.maxOccupancy
          },
          {
            rigType: data.rigType ?? existing.rigType ?? (existing as any).rvType ?? null,
            rigLength: data.rigLength ?? existing.rigLength ?? null,
            requiresAccessible: (data as any)?.requiresAccessible ?? null,
            requiredAmenities: (data as any)?.requiredAmenities ?? null,
            adults: data.adults ?? existing.adults ?? 0,
            children: data.children ?? existing.children ?? 0
          }
        );

        const baselinePrice = await evaluatePricingV2(
          this.prisma,
          this.pricingV2Service,
          existing.campgroundId,
          targetSiteId,
          arrival,
          departure
        );

        // Get campground pricing control settings
        const pricingControls = await this.prisma.campground.findUnique({
          where: { id: existing.campgroundId },
          select: {
            maxDiscountFraction: true,
            managerApprovalThreshold: true,
            minOverrideRateCents: true,
            maxOverrideRateCents: true
          }
        });

        const shouldReprice = data.totalAmount === undefined || data.totalAmount === null;
        const price = shouldReprice ? baselinePrice : null;
        const totalAmount = shouldReprice ? baselinePrice.totalCents : data.totalAmount ?? existing.totalAmount;
        const paidAmount = data.paidAmount ?? existing.paidAmount ?? 0;
        const manualDiscountProvided = data.discountsAmount !== undefined && data.discountsAmount !== null;
        const manualOverrideDelta = shouldReprice ? 0 : totalAmount - baselinePrice.totalCents;
        const overrideReason = (data as any).overrideReason as string | undefined;
        const overrideApprovedBy = (data as any).overrideApprovedBy as string | undefined;
        const needsOverrideApproval = !shouldReprice && (manualOverrideDelta !== 0 || manualDiscountProvided);
        if (needsOverrideApproval && (!overrideReason || !overrideApprovedBy)) {
          throw new BadRequestException("Manual pricing overrides require overrideReason and overrideApprovedBy.");
        }

        // Validate override against campground pricing controls
        if (!shouldReprice && pricingControls) {
          const maxDiscountFraction = pricingControls.maxDiscountFraction
            ? Number(pricingControls.maxDiscountFraction)
            : 0.4;
          const managerThreshold = pricingControls.managerApprovalThreshold
            ? Number(pricingControls.managerApprovalThreshold)
            : 0.25;

          // Calculate discount percentage (negative delta = discount)
          if (manualOverrideDelta < 0 && baselinePrice.totalCents > 0) {
            const discountPct = Math.abs(manualOverrideDelta) / baselinePrice.totalCents;

            // Hard cap - cannot exceed max discount
            if (discountPct > maxDiscountFraction) {
              throw new BadRequestException(
                `Override discount of ${Math.round(discountPct * 100)}% exceeds maximum allowed (${Math.round(maxDiscountFraction * 100)}%). ` +
                `Minimum allowed price: $${((baselinePrice.totalCents * (1 - maxDiscountFraction)) / 100).toFixed(2)}`
              );
            }

            // Manager approval required for discounts above threshold
            if (discountPct > managerThreshold && !overrideApprovedBy) {
              throw new BadRequestException(
                `Discounts above ${Math.round(managerThreshold * 100)}% require manager approval. ` +
                `Please provide overrideApprovedBy with a manager's user ID.`
              );
            }
          }

          // Validate against min/max rate bounds if configured
          const nights = baselinePrice.nights;
          const perNightRate = totalAmount / nights;

          if (pricingControls.minOverrideRateCents !== null && perNightRate < pricingControls.minOverrideRateCents) {
            throw new BadRequestException(
              `Per-night rate of $${(perNightRate / 100).toFixed(2)} is below minimum allowed ($${(pricingControls.minOverrideRateCents / 100).toFixed(2)}/night).`
            );
          }

          if (pricingControls.maxOverrideRateCents !== null && perNightRate > pricingControls.maxOverrideRateCents) {
            throw new BadRequestException(
              `Per-night rate of $${(perNightRate / 100).toFixed(2)} exceeds maximum allowed ($${(pricingControls.maxOverrideRateCents / 100).toFixed(2)}/night).`
            );
          }
        }

        const depositCalc = await assertReservationDepositV2(this.depositPoliciesService, {
          campgroundId: existing.campgroundId,
          siteClassId: siteInfo?.siteClassId ?? null,
          totalAmountCents: totalAmount,
          lodgingOnlyCents: price?.baseSubtotalCents ?? data.baseSubtotal ?? existing.baseSubtotal ?? baselinePrice.baseSubtotalCents,
          paidAmountCents: paidAmount,
          nights: baselinePrice.nights
        });
        const paymentFields = this.buildPaymentFields(totalAmount, paidAmount);

        const {
          paymentMethod,
          transactionId,
          paymentNotes,
          siteClassId: _siteClassId,
          rvType: _rvType,
          pets: _pets,
          petTypes: _petTypes,
          holdId: _holdId,
          requiresAccessible: _requiresAccessible,
          requiredAmenities: _requiredAmenities,
          overrideReason: _overrideReason,
          overrideApprovedBy: _overrideApprovedBy,
          ...reservationData
        } = data;

        // If attempting to check in, ensure required forms are completed
        if (reservationData.status === ReservationStatus.checked_in) {
          const pendingForms = await (this.prisma as any).formSubmission?.count?.({
            where: { reservationId: id, status: "pending" }
          }) ?? 0;
          if (pendingForms > 0) {
            throw new ConflictException("Forms must be completed before check-in");
          }

          const mergedForCompliance = {
            ...existing,
            paymentStatus: (reservationData as any).paymentStatus ?? existing.paymentStatus,
            paymentRequired: (reservationData as any).paymentRequired ?? existing.paymentRequired,
            waiverRequired: (reservationData as any).waiverRequired ?? existing.waiverRequired,
            idVerificationRequired: (reservationData as any).idVerificationRequired ?? existing.idVerificationRequired
          };
          const compliance = await this.checkCompliance(mergedForCompliance);
          if (!compliance.ok) {
            throw new ConflictException({
              reason: compliance.reason,
              signingUrl: compliance.signingUrl
            });
          }
        }

        const updatedReservation = await this.prisma.reservation.update({
          where: { id },
          data: {
            ...reservationData,
            arrivalDate: data.arrivalDate ? arrival : undefined,
            departureDate: data.departureDate ? departure : undefined,
            totalAmount,
            paidAmount,
            petCount: _pets !== undefined ? _pets : existing.petCount,
            petTypes: _petTypes !== undefined ? _petTypes : existing.petTypes,
            baseSubtotal: data.baseSubtotal ?? (price ? price.baseSubtotalCents : baselinePrice.baseSubtotalCents ?? existing.baseSubtotal),
            feesAmount: data.feesAmount ?? existing.feesAmount,
            taxesAmount: data.taxesAmount ?? existing.taxesAmount,
            discountsAmount:
              data.discountsAmount !== undefined
                ? data.discountsAmount
                : price
                  ? price.rulesDeltaCents < 0
                    ? -price.rulesDeltaCents
                    : 0
                  : existing.discountsAmount,
            depositAmount: depositCalc.depositAmount,
            pricingRuleVersion: price?.pricingRuleVersion ?? existing.pricingRuleVersion,
            depositPolicyVersion: depositCalc.depositPolicyVersion,
            ...paymentFields,
            checkInAt: data.checkInAt ? new Date(data.checkInAt) : undefined,
            checkOutAt: data.checkOutAt ? new Date(data.checkOutAt) : undefined,
            notes: data.notes ?? undefined,
            siteId: data.siteId ?? undefined
          }
        });

        // Determine the action type based on status change
        const statusChanged = data.status && data.status !== existing.status;
        let auditAction = "reservation.update";
        if (statusChanged) {
          if (data.status === "cancelled") auditAction = "reservation.cancel";
          else if (data.status === "checked_in") auditAction = "reservation.checkin";
          else if (data.status === "checked_out") auditAction = "reservation.checkout";
          else if (data.status === "confirmed") auditAction = "reservation.confirm";
        }

        // Audit reservation update
        await this.audit.record({
          campgroundId: existing.campgroundId,
          actorId: data.updatedBy ?? existing.updatedBy ?? null,
          action: auditAction,
          entity: "reservation",
          entityId: id,
          before: {
            status: existing.status,
            siteId: existing.siteId,
            arrivalDate: existing.arrivalDate,
            departureDate: existing.departureDate,
            totalAmount: existing.totalAmount,
            adults: existing.adults,
            children: existing.children,
            notes: existing.notes
          },
          after: {
            status: updatedReservation.status,
            siteId: updatedReservation.siteId,
            arrivalDate: updatedReservation.arrivalDate,
            departureDate: updatedReservation.departureDate,
            totalAmount: updatedReservation.totalAmount,
            adults: updatedReservation.adults,
            children: updatedReservation.children,
            notes: updatedReservation.notes
          }
        });

        if (needsOverrideApproval) {
          await this.audit.record({
            campgroundId: existing.campgroundId,
            actorId: overrideApprovedBy ?? data.updatedBy ?? existing.updatedBy ?? null,
            action: "reservation_override",
            entity: "reservation",
            entityId: id,
            before: {
              totalAmount: existing.totalAmount,
              discountsAmount: existing.discountsAmount,
              baselineTotalCents: baselinePrice.totalCents
            },
            after: {
              totalAmount: updatedReservation.totalAmount,
              discountsAmount: updatedReservation.discountsAmount,
              baselineTotalCents: baselinePrice.totalCents,
              deltaCents: manualOverrideDelta
            }
          });
          await this.approvals.create({
            type: "config_change",
            amount: Math.abs(manualOverrideDelta) / 100,
            currency: "USD",
            reason: overrideReason || "Manual pricing override",
            requester: overrideApprovedBy || data.updatedBy || "unknown",
            metadata: {
              reservationId: id,
              guestId: updatedReservation.guestId,
              siteId: updatedReservation.siteId,
              baselineTotalCents: baselinePrice.totalCents
            }
          });
        }

        // Send cancellation email if status changed to cancelled
        if (data.status === 'cancelled' && existing.status !== 'cancelled') {
          await this.emailService.sendEmail({
            to: existing.guest.email,
            subject: `Reservation Cancelled: ${existing.campground.name}`,
            html: `
                  <h1>Reservation Cancelled</h1>
                  <p>Dear ${existing.guest.primaryFirstName},</p>
                  <p>Your reservation at ${existing.campground.name} has been cancelled.</p>
                  <p><strong>Site:</strong> ${existing.site.siteNumber}</p>
                  <p>If you did not request this cancellation, please contact us immediately.</p>
                `
          });

          // Check waitlist for matches
          // We use the original reservation dates and site
          await this.waitlistService.checkWaitlist(
            existing.campgroundId,
            existing.arrivalDate,
            existing.departureDate,
            existing.siteId,
            existing.site.siteClassId ?? undefined
          );

          await this.accessControl.blockAccessForReservation(id, "reservation_cancelled");
          await this.accessControl.revokeAllForReservation(id, "reservation_cancelled");
        }

        // Award loyalty points if status changed to checked_out
        if (data.status === ReservationStatus.checked_out && existing.status !== ReservationStatus.checked_out) {
          const points = Math.floor(updatedReservation.totalAmount / 100);
          if (points > 0) {
            await this.loyaltyService.awardPoints(
              existing.guestId,
              points,
              `Reservation #${existing.id}`
            );
          }

          // Auto-create turnover task for housekeeping
          try {
            await this.prisma.task.create({
              data: {
                tenantId: existing.campgroundId,
                type: 'turnover',
                state: 'pending',
                siteId: existing.siteId,
                reservationId: existing.id,
                slaStatus: 'on_track',
                slaDueAt: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
                source: 'auto_turnover',
                createdBy: 'system',
              },
            });
          } catch (taskErr) {
            // Log but don't fail the checkout
            this.logger.error('Failed to create turnover task:', taskErr instanceof Error ? taskErr.stack : taskErr);
          }

          await this.accessControl.blockAccessForReservation(id, "checked_out");
          await this.accessControl.revokeAllForReservation(id, "checked_out");
        }

        // Playbook triggers on status change
        if (data.status === ReservationStatus.confirmed && existing.status !== ReservationStatus.confirmed) {
          await this.enqueuePlaybooksForReservation("arrival", updatedReservation.id);
        }
        if (data.status === ReservationStatus.checked_in && existing.status !== ReservationStatus.checked_in) {
          await this.enqueuePlaybooksForReservation("upsell", updatedReservation.id);
          await this.accessControl.autoGrantForReservation(id);
        }

        // Gamification: smooth check-in via standard update
        if (data.status === ReservationStatus.checked_in && existing.status !== ReservationStatus.checked_in && existing.createdBy) {
          const membership = await this.prisma.campgroundMembership.findFirst({
            where: { userId: existing.createdBy, campgroundId: existing.campgroundId }
          });
          await this.gamification.recordEvent({
            campgroundId: existing.campgroundId,
            userId: existing.createdBy,
            membershipId: membership?.id,
            category: GamificationEventCategory.check_in,
            reason: "Smooth check-in",
            sourceType: "reservation",
            sourceId: existing.id,
            eventKey: `reservation:${existing.id}:checkin`
          });
        }

        // Emit real-time events based on status changes
        const eventData: ReservationEventData = {
          reservationId: updatedReservation.id,
          guestId: updatedReservation.guestId,
          guestName: `${updatedReservation.guest.primaryFirstName} ${updatedReservation.guest.primaryLastName}`,
          siteId: updatedReservation.siteId ?? undefined,
          siteName: updatedReservation.site?.siteNumber ?? undefined,
          arrivalDate: updatedReservation.arrivalDate.toISOString(),
          departureDate: updatedReservation.departureDate.toISOString(),
          status: updatedReservation.status,
          totalCents: updatedReservation.totalAmount,
          balanceCents: updatedReservation.balanceAmount
        };

        // Reuse statusChanged from earlier in this transaction
        if (statusChanged) {
          if (data.status === ReservationStatus.cancelled) {
            this.realtime.emitReservationCancelled(existing.campgroundId, eventData);
          } else if (data.status === ReservationStatus.checked_in) {
            this.realtime.emitReservationCheckedIn(existing.campgroundId, eventData);
          } else if (data.status === ReservationStatus.checked_out) {
            this.realtime.emitReservationCheckedOut(existing.campgroundId, eventData);
          } else {
            this.realtime.emitReservationUpdated(existing.campgroundId, eventData);
          }
        } else {
          // General update (dates, site, guest, etc.)
          this.realtime.emitReservationUpdated(existing.campgroundId, eventData);
        }

        return updatedReservation;
      });
    } catch (err) {
      if (this.isOverlapError(err)) {
        throw new ConflictException("Site is not available for the selected dates.");
      }
      throw err;
    }
  }

  async updateGroupAssignment(
    id: string,
    payload: { groupId: string | null; role?: "primary" | "member" | null }
  ) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      select: { campgroundId: true, groupId: true }
    });
    if (!reservation) throw new NotFoundException("Reservation not found");

    const targetGroupId = payload.groupId ?? null;
    const targetRole: "primary" | "member" | null = targetGroupId ? (payload.role ?? "member") : null;

    if (targetGroupId) {
      const group = await this.prisma.group.findUnique({
        where: { id: targetGroupId },
        select: { tenantId: true }
      });
      if (!group) throw new NotFoundException("Group not found");
      if (group.tenantId !== reservation.campgroundId) {
        throw new BadRequestException("Group belongs to a different campground");
      }
    }

    await this.prisma.$transaction(async (tx) => {
      // Clear any primary pointer if demoting or removing this reservation
      if (!targetGroupId || targetRole !== "primary") {
        await tx.group.updateMany({
          where: { primaryReservationId: id },
          data: { primaryReservationId: null }
        });
      }

      if (targetGroupId && targetRole === "primary") {
        // Ensure this reservation is the sole primary for the group
        await tx.reservation.updateMany({
          where: { groupId: targetGroupId, id: { not: id }, groupRole: "primary" },
          data: { groupRole: "member" }
        });
        await tx.group.update({
          where: { id: targetGroupId },
          data: { primaryReservationId: id }
        });
      }

      await tx.reservation.update({
        where: { id },
        data: { groupId: targetGroupId, groupRole: targetRole }
      });
    });

    return this.findOne(id);
  }

  async remove(id: string, options?: { actorId?: string }) {
    // Get reservation before deletion for audit
    const before = await this.prisma.reservation.findUnique({
      where: { id },
      include: { guest: true, site: true }
    });

    const deleted = await this.prisma.reservation.delete({ where: { id } });

    // Audit reservation deletion
    if (before) {
      await this.audit.record({
        campgroundId: before.campgroundId,
        actorId: options?.actorId ?? before.updatedBy ?? null,
        action: "reservation.delete",
        entity: "reservation",
        entityId: id,
        before: {
          id: before.id,
          guestId: before.guestId,
          guestName: `${before.guest?.primaryFirstName} ${before.guest?.primaryLastName}`,
          siteId: before.siteId,
          siteName: before.site?.siteNumber,
          arrivalDate: before.arrivalDate,
          departureDate: before.departureDate,
          status: before.status,
          totalAmount: before.totalAmount
        },
        after: null
      });
    }

    return deleted;
  }

  async recordPayment(
    id: string,
    amountCents?: number,
    options?: {
      transactionId?: string;
      paymentMethod?: string;
      source?: string;
      stripePaymentIntentId?: string;
      stripeChargeId?: string;
      stripeBalanceTransactionId?: string;
      stripePayoutId?: string;
      applicationFeeCents?: number;
      stripeFeeCents?: number;
      methodType?: string;
      capturedAt?: Date;
      lineItems?: { label: string; amountCents: number }[];
      taxCents?: number;
      feeCents?: number;
      totalCents?: number;
      receiptKind?: "payment" | "refund" | "pos";
      tenders?: { method: string; amountCents: number; note?: string }[];
      recordedBy?: string; // User ID of staff who recorded the payment (for gamification)
    }
  ) {
    const tenderList =
      options?.tenders && options.tenders.length > 0
        ? options.tenders
        : amountCents
          ? [{ method: options?.paymentMethod || "card", amountCents, note: options?.receiptKind ? `${options.receiptKind} payment` : undefined }]
          : [];
    const totalTenderCents = tenderList.reduce((sum, t) => sum + (t.amountCents || 0), 0);
    if (totalTenderCents <= 0) throw new BadRequestException("Payment amount must be positive");

    const externalRef = options?.stripeBalanceTransactionId ?? options?.stripeChargeId ?? options?.stripePaymentIntentId ?? options?.transactionId ?? null;

    // Wrap entire operation in transaction with row-level locking to prevent race conditions
    // This ensures concurrent payments don't overwrite each other's paidAmount updates
    const { updated, reservation } = await this.prisma.$transaction(async (tx) => {
      // Lock the reservation row using SELECT FOR UPDATE to prevent concurrent modifications
      const [lockedReservation] = await tx.$queryRaw<Array<{
        id: string;
        campgroundId: string;
        guestId: string;
        siteId: string;
        paidAmount: number | null;
        totalAmount: number;
        arrivalDate: Date;
        departureDate: Date;
        source: string | null;
      }>>`
        SELECT id, "campgroundId", "guestId", "siteId", "paidAmount", "totalAmount", "arrivalDate", "departureDate", source
        FROM "Reservation"
        WHERE id = ${id}
        FOR UPDATE
      `;
      if (!lockedReservation) throw new NotFoundException("Reservation not found");

      // Calculate new paid amount atomically with the locked row
      const newPaid = (lockedReservation.paidAmount ?? 0) + totalTenderCents;
      const paymentFields = this.buildPaymentFields(lockedReservation.totalAmount, newPaid);

      // Get related data for ledger entries (these don't need locking)
      const site = await tx.site.findUnique({
        where: { id: lockedReservation.siteId },
        include: { siteClass: true }
      });
      const guest = await tx.guest.findUnique({ where: { id: lockedReservation.guestId } });
      const campground = await tx.campground.findUnique({
        where: { id: lockedReservation.campgroundId },
        select: { name: true }
      });

      const revenueGl = site?.siteClass?.glCode ?? "REVENUE_UNMAPPED";
      const revenueAccount = site?.siteClass?.clientAccount ?? "Revenue";

      const updatedReservation = await tx.reservation.update({
        where: { id },
        data: {
          paidAmount: newPaid,
          ...paymentFields
        }
      });

      // Combine locked data with related data for return
      const fullReservation = {
        ...lockedReservation,
        site,
        guest,
        campground
      };

      for (const tender of tenderList) {
        // Create unique payment ref for deduplication
        // Use tender.note if provided (e.g., "CASH-1234567890"), otherwise generate one
        const paymentRef = externalRef ?? tender.note ?? `${tender.method}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        await tx.payment.create({
          data: {
            campgroundId: fullReservation.campgroundId,
            reservationId: fullReservation.id,
            amountCents: tender.amountCents,
            method: tender.method || options?.paymentMethod || "card",
            direction: "charge",
            note: tender.note ?? "Reservation payment",
            stripePaymentIntentId: options?.stripePaymentIntentId,
            stripeChargeId: options?.stripeChargeId,
            stripeBalanceTransactionId: options?.stripeBalanceTransactionId,
            stripePayoutId: options?.stripePayoutId,
            applicationFeeCents: options?.applicationFeeCents,
            stripeFeeCents: options?.stripeFeeCents,
            methodType: options?.methodType,
            capturedAt: options?.capturedAt
          }
        });
        // Build ledger entries with tax/fee split when available
        // ACCT-HIGH-005: Split payment into revenue, tax liability, and fee revenue
        const taxCents = options?.taxCents ?? 0;
        const feeCents = options?.feeCents ?? 0;
        const revenueAmount = tender.amountCents - taxCents - feeCents;

        const ledgerEntries: LedgerEntryInput[] = [
          {
            campgroundId: fullReservation.campgroundId,
            reservationId: fullReservation.id,
            glCode: "CASH",
            account: "Cash",
            description: options?.transactionId ? `Payment ${options.transactionId}` : `Reservation payment (${tender.method})`,
            amountCents: tender.amountCents,
            direction: "debit",
            externalRef: externalRef ?? paymentRef,
            dedupeKey: `res:${fullReservation.id}:payment:${paymentRef}:${tender.method}:debit`
          }
        ];

        // Credit site revenue for the net amount (after tax and fees)
        if (revenueAmount > 0) {
          ledgerEntries.push({
            campgroundId: fullReservation.campgroundId,
            reservationId: fullReservation.id,
            glCode: revenueGl,
            account: revenueAccount,
            description: `Reservation payment (${tender.method})`,
            amountCents: revenueAmount,
            direction: "credit",
            externalRef: externalRef ?? paymentRef,
            dedupeKey: `res:${fullReservation.id}:payment:${paymentRef}:${tender.method}:credit:revenue`
          });
        }

        // Credit tax liability if tax was collected
        if (taxCents > 0) {
          ledgerEntries.push({
            campgroundId: fullReservation.campgroundId,
            reservationId: fullReservation.id,
            glCode: "TAX_LIABILITY",
            account: "Tax Liability",
            description: `Sales tax collected (${tender.method})`,
            amountCents: taxCents,
            direction: "credit",
            externalRef: externalRef ?? paymentRef,
            dedupeKey: `res:${fullReservation.id}:payment:${paymentRef}:${tender.method}:credit:tax`
          });
        }

        // Credit fee revenue if fees were collected
        if (feeCents > 0) {
          ledgerEntries.push({
            campgroundId: fullReservation.campgroundId,
            reservationId: fullReservation.id,
            glCode: "FEE_REVENUE",
            account: "Fee Revenue",
            description: `Booking fees (${tender.method})`,
            amountCents: feeCents,
            direction: "credit",
            externalRef: externalRef ?? paymentRef,
            dedupeKey: `res:${fullReservation.id}:payment:${paymentRef}:${tender.method}:credit:fees`
          });
        }

        await postBalancedLedgerEntries(tx, ledgerEntries);
      }

      return {
        updated: updatedReservation,
        reservation: fullReservation,
        previousPaidAmount: lockedReservation.paidAmount ?? 0
      };
    });

    // Audit payment recording
    try {
      await this.audit.record({
        campgroundId: reservation.campgroundId,
        actorId: null, // Payment recording doesn't always have actor context
        action: "reservation.payment",
        entity: "reservation",
        entityId: id,
        before: {
          paidAmount: updated.paidAmount ? updated.paidAmount - totalTenderCents : 0
        },
        after: {
          paidAmount: updated.paidAmount,
          paymentMethod: tenderList.map(t => t.method).join(", "),
          paymentAmount: totalTenderCents
        }
      });
    } catch (auditError) {
      this.logger.error("Failed to audit payment:", auditError instanceof Error ? auditError.stack : auditError);
    }

    // Send payment receipt email
    try {
      await this.emailService.sendPaymentReceipt({
        guestEmail: reservation.guest?.email,
        guestName: `${reservation.guest?.primaryFirstName} ${reservation.guest?.primaryLastName}`,
        campgroundName: reservation.campground?.name,
        campgroundId: reservation.campgroundId,
        guestId: reservation.guestId,
        amountCents: totalTenderCents,
        paymentMethod: options?.paymentMethod || (tenderList.length === 1 ? tenderList[0].method : 'Mixed'),
        transactionId: options?.transactionId,
        reservationId: reservation.id,
        siteNumber: reservation.site?.siteNumber,
        arrivalDate: reservation.arrivalDate,
        departureDate: reservation.departureDate,
        source: options?.source || reservation.source || 'admin',
        lineItems: options?.lineItems,
        taxCents: options?.taxCents,
        feeCents: options?.feeCents,
        totalCents: options?.totalCents ?? totalTenderCents,
        kind: options?.receiptKind ?? "payment"
      });
    } catch (emailError) {
      // Log but don't fail the payment if email fails
      this.logger.error('Failed to send payment receipt email:', emailError instanceof Error ? emailError.stack : emailError);
    }

    // Gamification: Award XP for collecting payment (only if staff member is known)
    if (options?.recordedBy) {
      try {
        const membership = await this.prisma.campgroundMembership.findFirst({
          where: { userId: options.recordedBy, campgroundId: reservation.campgroundId }
        });
        if (membership) {
          const isFullPayment = (updated.paidAmount ?? 0) >= updated.totalAmount;
          await this.gamification.recordEvent({
            campgroundId: reservation.campgroundId,
            userId: options.recordedBy,
            membershipId: membership.id,
            category: GamificationEventCategory.payment_collection,
            reason: isFullPayment
              ? `Collected full balance ($${(totalTenderCents / 100).toFixed(2)})`
              : `Collected payment ($${(totalTenderCents / 100).toFixed(2)})`,
            sourceType: "reservation",
            sourceId: reservation.id,
            eventKey: `reservation:${id}:payment:${Date.now()}`,
            // Award bonus XP for collecting full balance
            xpOverride: isFullPayment ? 20 : undefined
          });
        }
      } catch (gamificationError) {
        this.logger.error('Failed to record gamification event:', gamificationError instanceof Error ? gamificationError.stack : gamificationError);
      }
    }

    return updated;
  }

  async refundPayment(
    id: string,
    amountCents: number,
    options?: { destination?: "card" | "wallet"; reason?: string }
  ) {
    if (amountCents <= 0) throw new BadRequestException("Refund amount must be positive");

    const destination = options?.destination ?? "card";
    const refundTimestamp = Date.now();

    // Wrap entire operation in transaction with row-level locking to prevent race conditions
    const { updated, reservation } = await this.prisma.$transaction(async (tx) => {
      // Lock the reservation row using SELECT FOR UPDATE to prevent concurrent modifications
      const [lockedReservation] = await tx.$queryRaw<Array<{
        id: string;
        campgroundId: string;
        guestId: string;
        siteId: string;
        paidAmount: number | null;
        totalAmount: number;
        arrivalDate: Date;
        departureDate: Date;
        source: string | null;
      }>>`
        SELECT id, "campgroundId", "guestId", "siteId", "paidAmount", "totalAmount", "arrivalDate", "departureDate", source
        FROM "Reservation"
        WHERE id = ${id}
        FOR UPDATE
      `;
      if (!lockedReservation) throw new NotFoundException("Reservation not found");

      // Validate refund amount against locked paidAmount
      if ((lockedReservation.paidAmount ?? 0) < amountCents) {
        throw new BadRequestException("Refund exceeds paid amount");
      }

      // Calculate new paid amount atomically
      const newPaid = (lockedReservation.paidAmount ?? 0) - amountCents;
      const paymentFields = this.buildPaymentFields(lockedReservation.totalAmount, newPaid);

      // Get related data for ledger entries
      const site = await tx.site.findUnique({
        where: { id: lockedReservation.siteId },
        include: { siteClass: true }
      });
      const guest = await tx.guest.findUnique({ where: { id: lockedReservation.guestId } });
      const campground = await tx.campground.findUnique({
        where: { id: lockedReservation.campgroundId },
        select: { name: true }
      });

      const revenueGl = site?.siteClass?.glCode ?? "REVENUE_UNMAPPED";
      const revenueAccount = site?.siteClass?.clientAccount ?? "Revenue";

      const updatedReservation = await tx.reservation.update({
        where: { id },
        data: {
          paidAmount: newPaid,
          ...paymentFields
        }
      });

      const fullReservation = { ...lockedReservation, site, guest, campground };

      // Handle wallet refund
      if (destination === "wallet" && fullReservation.guestId) {
        await this.guestWalletService.creditFromRefund(
          fullReservation.campgroundId,
          fullReservation.id,
          fullReservation.guestId,
          amountCents,
          options?.reason ?? "Reservation refund"
        );

        await tx.payment.create({
          data: {
            campgroundId: fullReservation.campgroundId,
            reservationId: fullReservation.id,
            amountCents,
            method: "wallet_credit",
            direction: "refund",
            note: options?.reason ?? "Reservation refund - credited to wallet"
          }
        });
      } else {
        // Standard card refund
        await tx.payment.create({
          data: {
            campgroundId: fullReservation.campgroundId,
            reservationId: fullReservation.id,
            amountCents,
            method: "card",
            direction: "refund",
            note: options?.reason ?? "Reservation refund"
          }
        });
      }

      await postBalancedLedgerEntries(tx, [
        {
          campgroundId: fullReservation.campgroundId,
          reservationId: fullReservation.id,
          glCode: destination === "wallet" ? "GUEST_WALLET" : "CASH",
          account: destination === "wallet" ? "Guest Wallet Liability" : "Cash",
          description: options?.reason ?? "Reservation refund",
          amountCents,
          direction: "credit",
          dedupeKey: `res:${fullReservation.id}:refund:${amountCents}:credit:${refundTimestamp}`
        },
        {
          campgroundId: fullReservation.campgroundId,
          reservationId: fullReservation.id,
          glCode: revenueGl,
          account: revenueAccount,
          description: options?.reason ?? "Reservation refund",
          amountCents,
          direction: "debit",
          dedupeKey: `res:${fullReservation.id}:refund:${amountCents}:debit:${refundTimestamp}`
        }
      ]);

      return { updated: updatedReservation, reservation: fullReservation };
    });

    // Audit refund
    try {
      await this.audit.record({
        campgroundId: reservation.campgroundId,
        actorId: null,
        action: "reservation.refund",
        entity: "reservation",
        entityId: id,
        before: {
          paidAmount: updated.paidAmount + amountCents
        },
        after: {
          paidAmount: updated.paidAmount,
          refundAmount: amountCents,
          destination,
          reason: options?.reason
        }
      });
    } catch (auditError) {
      this.logger.error("Failed to audit refund:", auditError instanceof Error ? auditError.stack : auditError);
    }

    // Send refund receipt
    try {
      await this.emailService.sendPaymentReceipt({
        guestEmail: reservation.guest?.email ?? "",
        guestName: `${reservation.guest?.primaryFirstName ?? ""} ${reservation.guest?.primaryLastName ?? ""}`.trim(),
        campgroundName: reservation.campground?.name ?? "Campground",
        amountCents,
        paymentMethod: destination === "wallet" ? "Guest Wallet Credit" : "Card",
        transactionId: undefined,
        reservationId: reservation.id,
        siteNumber: reservation.site?.siteNumber,
        arrivalDate: reservation.arrivalDate,
        departureDate: reservation.departureDate,
        source: reservation.source ?? "admin",
        kind: "refund",
        totalCents: amountCents
      });
    } catch (err) {
      this.logger.warn("Failed to send refund receipt email", err);
    }

    return updated;
  }

  /**
   * Record a refund that was already processed by Stripe.
   * This is called from webhooks or API endpoints after Stripe confirms the refund.
   * Unlike refundPayment(), this doesn't validate amounts since Stripe already processed it.
   */
  async recordRefund(
    id: string,
    amountCents: number,
    stripeRefundId?: string,
    options?: {
      lineItems?: { label: string; amountCents: number }[];
      taxCents?: number;
      feeCents?: number;
      totalCents?: number;
      paymentMethod?: string;
      source?: string;
      tenders?: { method: string; amountCents: number; note?: string }[];
      receiptKind?: "refund" | "payment" | "pos";
    }
  ) {
    if (amountCents <= 0) return; // Skip zero or negative refunds

    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: {
        site: { include: { siteClass: true } },
        guest: true,
        campground: { select: { name: true } }
      }
    });
    if (!reservation) {
      this.logger.error(`Stripe Refund - Reservation ${id} not found for refund recording`);
      return;
    }

    const newPaid = Math.max(0, (reservation.paidAmount ?? 0) - amountCents);
    const paymentFields = this.buildPaymentFields(reservation.totalAmount, newPaid);

    const updated = await this.prisma.reservation.update({
      where: { id },
      data: {
        paidAmount: newPaid,
        ...paymentFields
      }
    });

    await this.prisma.payment.create({
      data: {
        campgroundId: reservation.campgroundId,
        reservationId: reservation.id,
        amountCents,
        method: "card",
        direction: "refund",
        note: stripeRefundId ? `Stripe refund: ${stripeRefundId}` : "Stripe refund"
      }
    });

    const revenueGl = reservation.site?.siteClass?.glCode ?? "REVENUE_UNMAPPED";
    const revenueAccount = reservation.site?.siteClass?.clientAccount ?? "Revenue";
    const dedupeKeyBase = stripeRefundId ? `res:${reservation.id}:refund:${stripeRefundId}` : `res:${reservation.id}:refund:${amountCents}`;
    await postBalancedLedgerEntries(this.prisma, [
      {
        campgroundId: reservation.campgroundId,
        reservationId: reservation.id,
        glCode: "CASH",
        account: "Cash",
        description: stripeRefundId ? `Stripe refund: ${stripeRefundId}` : "Stripe refund",
        amountCents: amountCents,
        direction: "credit",
        externalRef: stripeRefundId ?? null,
        dedupeKey: `${dedupeKeyBase}:credit`
      },
      {
        campgroundId: reservation.campgroundId,
        reservationId: reservation.id,
        glCode: revenueGl,
        account: revenueAccount,
        description: stripeRefundId ? `Stripe refund: ${stripeRefundId}` : "Stripe refund",
        amountCents: amountCents,
        direction: "debit",
        externalRef: stripeRefundId ?? null,
        dedupeKey: `${dedupeKeyBase}:debit`
      }
    ]);

    // Send refund receipt
    try {
      await this.emailService.sendPaymentReceipt({
        guestEmail: (reservation as any)?.guest?.email ?? "",
        guestName: reservation ? `${(reservation as any)?.guest?.primaryFirstName ?? ""} ${(reservation as any)?.guest?.primaryLastName ?? ""}`.trim() : "",
        campgroundName: (reservation as any)?.campground?.name ?? "Campground",
        amountCents,
        paymentMethod: options?.paymentMethod ?? "Card",
        transactionId: stripeRefundId,
        reservationId: reservation.id,
        siteNumber: (reservation as any)?.site?.siteNumber,
        arrivalDate: (reservation as any)?.arrivalDate,
        departureDate: (reservation as any)?.departureDate,
        source: options?.source ?? "admin",
        kind: options?.receiptKind ?? "refund",
        lineItems: options?.lineItems,
        taxCents: options?.taxCents,
        feeCents: options?.feeCents,
        totalCents: options?.totalCents ?? amountCents
      });
    } catch (err) {
      this.logger.warn("Failed to send refund receipt email", err);
    }

    return updated;
  }

  async quote(campgroundId: string, siteId: string, arrival: string, departure: string) {
    const pricing = await evaluatePricingV2(
      this.prisma,
      this.pricingV2Service,
      campgroundId,
      siteId,
      new Date(arrival),
      new Date(departure)
    );
    const taxExemption = await this.taxRulesService.evaluateExemption(campgroundId, pricing.nights, false);
    const exemptionPayload = {
      eligible: taxExemption.eligible,
      applied: taxExemption.applied,
      requiresWaiver: taxExemption.rule?.requiresWaiver ?? false,
      waiverText: taxExemption.rule?.waiverText ?? null,
      reason: (taxExemption as any).reason ?? null
    };

    return {
      ...pricing,
      perNightCents: Math.round(pricing.totalCents / pricing.nights),
      taxExemption: exemptionPayload,
      taxExemptionEligible: exemptionPayload.eligible,
      requiresWaiver: exemptionPayload.requiresWaiver,
      waiverText: exemptionPayload.waiverText
    };
  }

  async agingBuckets(campgroundId: string) {
    const now = new Date();
    const reservations = await this.prisma.reservation.findMany({
      where: {
        campgroundId,
        balanceAmount: { gt: 0 },
        NOT: { status: ReservationStatus.cancelled }
      },
      select: { id: true, departureDate: true, balanceAmount: true }
    });

    const buckets = {
      current: 0,
      "31_60": 0,
      "61_90": 0,
      "90_plus": 0
    };

    for (const r of reservations) {
      const daysPast = Math.floor((now.getTime() - r.departureDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysPast <= 30) buckets.current += r.balanceAmount;
      else if (daysPast <= 60) buckets["31_60"] += r.balanceAmount;
      else if (daysPast <= 90) buckets["61_90"] += r.balanceAmount;
      else buckets["90_plus"] += r.balanceAmount;
    }
    return buckets;
  }

  async listOverlaps(campgroundId: string) {
    return this.prisma.$queryRaw<
      {
        siteId: string;
        reservationA: string;
        reservationB: string;
        arrivalA: Date;
        departureA: Date;
        arrivalB: Date;
        departureB: Date;
      }[]
    >`
      SELECT
        a."siteId" as "siteId",
        a."id" as "reservationA",
        b."id" as "reservationB",
        a."arrivalDate" as "arrivalA",
        a."departureDate" as "departureA",
        b."arrivalDate" as "arrivalB",
        b."departureDate" as "departureB"
      FROM "Reservation" a
      JOIN "Reservation" b
        ON a."siteId" = b."siteId"
        AND a."id" < b."id"
        AND a."status" != 'cancelled'
        AND b."status" != 'cancelled'
        AND a."campgroundId" = ${campgroundId}
        AND b."campgroundId" = ${campgroundId}
        AND tstzrange(a."arrivalDate", a."departureDate", '[]'::text) && tstzrange(b."arrivalDate", b."departureDate", '[]'::text)
      ORDER BY a."siteId", a."arrivalDate"
    `;
  }

  async overlapCheck(campgroundId: string, siteId: string, arrivalDate: string, departureDate: string, ignoreId?: string) {
    if (!siteId || !arrivalDate || !departureDate) {
      throw new BadRequestException("siteId, arrivalDate, and departureDate are required");
    }
    const site = await this.prisma.site.findUnique({ where: { id: siteId }, select: { campgroundId: true } });
    if (!site) throw new NotFoundException("Site not found");
    const arrival = new Date(arrivalDate);
    const departure = new Date(departureDate);
    if (!(arrival instanceof Date) || isNaN(arrival.valueOf()) || !(departure instanceof Date) || isNaN(departure.valueOf())) {
      throw new BadRequestException("Invalid dates");
    }
    if (departure <= arrival) throw new BadRequestException("departureDate must be after arrivalDate");

    const reasons: string[] = [];

    const conflictCount = await this.prisma.reservation.count({
      where: {
        campgroundId,
        siteId,
        status: { not: ReservationStatus.cancelled },
        departureDate: { gt: arrival },
        arrivalDate: { lt: departure },
        ...(ignoreId ? { id: { not: ignoreId } } : {})
      }
    });
    if (conflictCount > 0) reasons.push("reservation");

    const now = new Date();
    const holdCount = await (this.prisma as any).siteHold.count({
      where: {
        siteId,
        status: "active",
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        arrivalDate: { lt: departure },
        departureDate: { gt: arrival }
      }
    });
    if (holdCount > 0) reasons.push("hold");

    const maintenanceCount = await this.prisma.maintenanceTicket.count({
      where: {
        siteId,
        status: { in: [MaintenanceStatus.open, MaintenanceStatus.in_progress] },
        OR: [
          { isBlocking: true },
          { outOfOrder: true },
          { outOfOrderUntil: { gt: arrival } }
        ]
      }
    });
    if (maintenanceCount > 0) reasons.push("maintenance");

    const blackoutCount = await this.prisma.blackoutDate.count({
      where: {
        campgroundId: site.campgroundId,
        OR: [{ siteId }, { siteId: null }],
        startDate: { lt: departure },
        endDate: { gt: arrival }
      }
    });
    if (blackoutCount > 0) reasons.push("blackout");

    return { conflict: reasons.length > 0, reasons };
  }

  async kioskCheckIn(
    id: string,
    upsellTotalCents: number,
    options?: { override?: boolean; overrideReason?: string; actorId?: string | null }
  ) {
    this.logger.log(`Kiosk - Check-in request for ${id}, upsell: ${upsellTotalCents}`);
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: {
        guest: true,
        campground: true,
        site: true
      }
    });
    if (!reservation) {
      this.logger.error(`Kiosk - Reservation ${id} not found`);
      throw new NotFoundException("Reservation not found");
    }

    this.logger.log(`Kiosk - Found reservation: ${reservation.status}, Total: ${reservation.totalAmount}, Paid: ${reservation.paidAmount}`);

    if (reservation.status === ReservationStatus.checked_in) {
      this.logger.warn(`Kiosk - Reservation ${id} already checked in`);
      throw new ConflictException("Reservation is already checked in");
    }

    // Require forms to be completed before check-in
    const pendingForms = await (this.prisma as any).formSubmission?.count?.({
      where: { reservationId: id, status: "pending" }
    }) ?? 0;
    if (pendingForms > 0) {
      throw new ConflictException("Forms must be completed before check-in");
    }

    const compliance = await this.checkCompliance(reservation);
    const isOverride = Boolean(options?.override);
    if (!compliance.ok && !isOverride) {
      const checkInStatus =
        compliance.reason === "waiver_required"
          ? CheckInStatus.pending_waiver
          : compliance.reason === "id_verification_required"
            ? CheckInStatus.pending_id
            : compliance.reason === "payment_required"
              ? CheckInStatus.pending_payment
              : CheckInStatus.failed;

      await this.prisma.reservation.update({
        where: { id },
        data: { checkInStatus }
      });

      throw new ConflictException({
        reason: compliance.reason,
        signingUrl: compliance.signingUrl
      });
    }

    if (isOverride && !compliance.ok) {
      try {
        await this.audit.record({
          campgroundId: reservation.campgroundId,
          actorId: options?.actorId ?? null,
          action: "checkin.override",
          entity: "Reservation",
          entityId: id,
          before: { unmet: compliance.reasons ?? [] },
          after: { override: true, reason: options?.overrideReason ?? null }
        });
      } catch (err) {
        this.logger.error("Kiosk - Failed to audit check-in override", err instanceof Error ? err.stack : err);
      }
    }

    const newTotal = reservation.totalAmount + upsellTotalCents;
    const balanceDue = newTotal - (reservation.paidAmount || 0);

    this.logger.log(`Kiosk - New Total: ${newTotal}, Balance Due: ${balanceDue}`);

    // Process payment if there's a balance due
    let paymentIntentId: string | undefined;
    if (balanceDue > 0) {
      try {
        // Get the most recent successful payment to extract payment method details
        const lastPayment = await this.prisma.payment.findFirst({
          where: {
            reservationId: id,
            stripePaymentIntentId: { not: null }
          },
          orderBy: { createdAt: 'desc' }
        });

        if (!lastPayment?.stripePaymentIntentId) {
          throw new BadRequestException('No payment method on file. Please provide payment details.');
        }

        // Retrieve the original payment intent to get customer and payment method
        const originalIntent = await this.stripeService.retrievePaymentIntent(lastPayment.stripePaymentIntentId);

        if (!originalIntent.customer || !originalIntent.payment_method) {
          throw new BadRequestException('Payment method information not available. Please provide payment details.');
        }

        const customerId = typeof originalIntent.customer === 'string'
          ? originalIntent.customer
          : originalIntent.customer.id;
        const paymentMethodId = typeof originalIntent.payment_method === 'string'
          ? originalIntent.payment_method
          : originalIntent.payment_method.id;

        // Get campground's Stripe account
        const campground = await this.prisma.campground.findUnique({
          where: { id: reservation.campgroundId },
          select: { stripeAccountId: true, perBookingFeeCents: true }
        });

        if (!campground?.stripeAccountId) {
          throw new BadRequestException('Payment processing not configured for this campground.');
        }

        const applicationFeeCents = campground.perBookingFeeCents || 0;

        // Charge the saved payment method
        const paymentIntent = await this.stripeService.chargeOffSession(
          balanceDue,
          'usd',
          customerId,
          paymentMethodId,
          campground.stripeAccountId,
          {
            reservationId: id,
            campgroundId: reservation.campgroundId,
            source: 'kiosk_checkin',
            type: 'balance_due',
            upsellAmount: String(upsellTotalCents),
            override: String(isOverride)
          },
          applicationFeeCents,
          `kiosk-checkin-${id}-${Date.now()}`
        );

        if (paymentIntent.status !== 'succeeded') {
          throw new BadRequestException(`Payment failed: ${paymentIntent.status}. Please contact staff for assistance.`);
        }

        paymentIntentId = paymentIntent.id;

        // Record the payment
        await this.prisma.payment.create({
          data: {
            campgroundId: reservation.campgroundId,
            reservationId: id,
            amountCents: balanceDue,
            method: 'card',
            direction: 'charge',
            note: `Kiosk check-in balance charge. Upsell: $${(upsellTotalCents / 100).toFixed(2)}${isOverride ? ' (override)' : ''}`,
            stripePaymentIntentId: paymentIntent.id,
            stripeChargeId: paymentIntent.latest_charge as string | undefined,
            applicationFeeCents,
            capturedAt: new Date()
          }
        });

        this.logger.log(`Kiosk - Payment successful: ${paymentIntent.id}`);
      } catch (error: any) {
        this.logger.error(`Kiosk - Payment failed for ${id}:`, error.message);
        throw new BadRequestException(
          `Payment processing failed: ${error.message}. Please contact staff for assistance.`
        );
      }
    }

    try {
      const now = new Date();
      const overrideNote = isOverride
        ? `[Override ${now.toISOString()}] ${options?.overrideReason ?? "No reason provided"}`
        : null;
      const kioskNote = `[Kiosk] Checked in${isOverride ? " (override)" : ""}. Upsell: $${(upsellTotalCents / 100).toFixed(2)}. ${balanceDue > 0 ? `Charged card on file (${paymentIntentId}).` : 'No balance due.'}`;
      const notes = [reservation.notes, overrideNote, kioskNote].filter(Boolean).join("\n");

      const updated = await this.prisma.reservation.update({
        where: { id },
        data: {
          status: ReservationStatus.checked_in,
          checkInStatus: CheckInStatus.completed,
          checkInAt: now,
          feesAmount: { increment: upsellTotalCents },
          totalAmount: newTotal,
          paidAmount: newTotal,
          // Add a note about the upsell/kiosk check-in
          notes
        }
      });
      this.logger.log(`Kiosk - Check-in successful for ${id}`);

      // Audit successful kiosk check-in
      await this.audit.record({
        campgroundId: reservation.campgroundId,
        actorId: options?.actorId ?? null,
        action: "reservation.checkin",
        entity: "reservation",
        entityId: id,
        before: {
          status: reservation.status,
          checkInStatus: reservation.checkInStatus
        },
        after: {
          status: ReservationStatus.checked_in,
          checkInStatus: CheckInStatus.completed,
          checkInAt: updated.checkInAt,
          upsellAmount: upsellTotalCents,
          source: "kiosk"
        }
      });

      try {
        await this.accessControl.autoGrantForReservation(id, options?.actorId ?? null);
      } catch (err) {
        this.logger.error(`Kiosk - Access grant failed for ${id}:`, err instanceof Error ? err.stack : err);
      }

      if (reservation.createdBy) {
        const membership = await this.prisma.campgroundMembership.findFirst({
          where: { userId: reservation.createdBy, campgroundId: reservation.campgroundId }
        });
        await this.gamification.recordEvent({
          campgroundId: reservation.campgroundId,
          userId: reservation.createdBy,
          membershipId: membership?.id,
          category: GamificationEventCategory.check_in,
          reason: "Smooth check-in (kiosk)",
          sourceType: "reservation",
          sourceId: reservation.id,
          eventKey: `reservation:${reservation.id}:checkin`
        });
      }

      // Emit real-time event for kiosk check-in
      this.realtime.emitReservationCheckedIn(reservation.campgroundId, {
        reservationId: updated.id,
        guestId: reservation.guestId,
        guestName: `${reservation.guest.primaryFirstName} ${reservation.guest.primaryLastName}`,
        siteId: reservation.siteId ?? undefined,
        siteName: reservation.site?.siteNumber ?? undefined,
        arrivalDate: reservation.arrivalDate.toISOString(),
        departureDate: reservation.departureDate.toISOString(),
        status: updated.status
      });

      return updated;
    } catch (e) {
      this.logger.error(`Kiosk - Update failed for ${id}:`, e instanceof Error ? e.stack : e);
      throw e;
    }
  }

  /**
   * Staff check-in from dashboard
   * Unlike kiosk check-in, this doesn't require payment but warns about balance
   */
  async staffCheckIn(
    id: string,
    options?: { force?: boolean; actorId?: string | null }
  ): Promise<{ reservation: Reservation; warning?: string }> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: { guest: true, site: true, campground: true }
    });

    if (!reservation) {
      throw new NotFoundException("Reservation not found");
    }

    if (reservation.status === ReservationStatus.checked_in) {
      throw new ConflictException("Reservation is already checked in");
    }

    if (reservation.status === ReservationStatus.cancelled) {
      throw new BadRequestException("Cannot check in a cancelled reservation");
    }

    // Check for pending forms
    const pendingForms = await (this.prisma as any).formSubmission?.count?.({
      where: { reservationId: id, status: "pending" }
    }) ?? 0;

    if (pendingForms > 0 && !options?.force) {
      throw new ConflictException(
        "Forms must be completed before check-in. Use force=true to override."
      );
    }

    // Check balance
    const balance = (reservation.totalAmount ?? 0) - (reservation.paidAmount ?? 0);
    let warning: string | undefined;

    if (balance > 0) {
      warning = `Guest has outstanding balance of $${(balance / 100).toFixed(2)}`;
    }

    const now = new Date();
    const updated = await this.prisma.reservation.update({
      where: { id },
      data: {
        status: ReservationStatus.checked_in,
        checkInStatus: CheckInStatus.completed,
        checkInAt: now
      },
      include: { guest: true, site: true, campground: true }
    });

    // Audit
    await this.audit.record({
      action: "reservation.checkin",
      campgroundId: reservation.campgroundId,
      actorId: options?.actorId ?? null,
      entity: "reservation",
      entityId: id,
      before: { status: reservation.status },
      after: { status: updated.status, checkInAt: now, source: "staff" }
    });

    // Trigger playbooks and access control
    await this.enqueuePlaybooksForReservation("upsell", id);
    await this.accessControl.autoGrantForReservation(id);

    // Gamification
    if (reservation.createdBy) {
      const membership = await this.prisma.campgroundMembership.findFirst({
        where: { userId: reservation.createdBy, campgroundId: reservation.campgroundId }
      });
      await this.gamification.recordEvent({
        campgroundId: reservation.campgroundId,
        userId: reservation.createdBy,
        membershipId: membership?.id,
        category: GamificationEventCategory.operational,
        xpOverride: 5,
        reason: "Smooth check-in (staff)",
        sourceType: "reservation",
        sourceId: reservation.id,
        eventKey: `reservation:${reservation.id}:checkin`
      });
    }

    // Emit real-time event for staff check-in
    this.realtime.emitReservationCheckedIn(reservation.campgroundId, {
      reservationId: updated.id,
      guestId: updated.guestId,
      guestName: `${updated.guest.primaryFirstName} ${updated.guest.primaryLastName}`,
      siteId: updated.siteId ?? undefined,
      siteName: updated.site?.siteNumber ?? undefined,
      arrivalDate: updated.arrivalDate.toISOString(),
      departureDate: updated.departureDate.toISOString(),
      status: updated.status
    });

    return { reservation: updated, warning };
  }

  /**
   * Staff check-out from dashboard
   */
  async staffCheckOut(
    id: string,
    options?: { force?: boolean; actorId?: string | null }
  ): Promise<{ reservation: Reservation; warning?: string }> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: { guest: true, site: true, campground: true }
    });

    if (!reservation) {
      throw new NotFoundException("Reservation not found");
    }

    if (reservation.status === ReservationStatus.checked_out) {
      throw new ConflictException("Reservation is already checked out");
    }

    if (reservation.status === ReservationStatus.cancelled) {
      throw new BadRequestException("Cannot check out a cancelled reservation");
    }

    // Check balance
    const balance = (reservation.totalAmount ?? 0) - (reservation.paidAmount ?? 0);
    let warning: string | undefined;

    if (balance > 0 && !options?.force) {
      throw new BadRequestException(
        `Cannot check out with outstanding balance of $${(balance / 100).toFixed(2)}. ` +
        `Collect payment first or use force=true to override.`
      );
    } else if (balance > 0) {
      warning = `Guest checked out with outstanding balance of $${(balance / 100).toFixed(2)}`;
    }

    const now = new Date();
    const updated = await this.prisma.reservation.update({
      where: { id },
      data: {
        status: ReservationStatus.checked_out,
        checkOutAt: now
      },
      include: { guest: true, site: true, campground: true }
    });

    // Audit
    await this.audit.record({
      action: "reservation.checkout",
      campgroundId: reservation.campgroundId,
      actorId: options?.actorId ?? null,
      entity: "reservation",
      entityId: id,
      before: { status: reservation.status },
      after: { status: updated.status, checkOutAt: now, source: "staff" }
    });

    // Trigger departure playbook
    await this.enqueuePlaybooksForReservation("post_departure", id);

    // Emit real-time event for staff check-out
    this.realtime.emitReservationCheckedOut(reservation.campgroundId, {
      reservationId: updated.id,
      guestId: updated.guestId,
      guestName: `${updated.guest.primaryFirstName} ${updated.guest.primaryLastName}`,
      siteId: updated.siteId ?? undefined,
      siteName: updated.site?.siteNumber ?? undefined,
      arrivalDate: updated.arrivalDate.toISOString(),
      departureDate: updated.departureDate.toISOString(),
      status: updated.status
    });

    return { reservation: updated, warning };
  }

  /**
   * Split a reservation into multiple site segments.
   * Allows a guest to stay on different sites during their reservation.
   * Each segment has its own siteId and price based on that site's rates.
   */
  async splitReservation(
    reservationId: string,
    segments: Array<{
      siteId: string;
      startDate: string | Date;
      endDate: string | Date;
    }>,
    options?: { actorId?: string | null; sendNotification?: boolean }
  ) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { campground: true, guest: true, site: true }
    });

    if (!reservation) {
      throw new NotFoundException("Reservation not found");
    }

    // Validate segments are contiguous and cover the full reservation
    const sortedSegments = [...segments].sort(
      (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );

    const resStart = new Date(reservation.arrivalDate);
    const resEnd = new Date(reservation.departureDate);
    resStart.setHours(0, 0, 0, 0);
    resEnd.setHours(0, 0, 0, 0);

    // First segment must start at reservation arrival
    const firstStart = new Date(sortedSegments[0].startDate);
    firstStart.setHours(0, 0, 0, 0);
    if (firstStart.getTime() !== resStart.getTime()) {
      throw new BadRequestException(
        `First segment must start on ${resStart.toISOString().slice(0, 10)}`
      );
    }

    // Last segment must end at reservation departure
    const lastEnd = new Date(sortedSegments[sortedSegments.length - 1].endDate);
    lastEnd.setHours(0, 0, 0, 0);
    if (lastEnd.getTime() !== resEnd.getTime()) {
      throw new BadRequestException(
        `Last segment must end on ${resEnd.toISOString().slice(0, 10)}`
      );
    }

    // Validate segments are contiguous (no gaps)
    for (let i = 1; i < sortedSegments.length; i++) {
      const prevEnd = new Date(sortedSegments[i - 1].endDate);
      prevEnd.setHours(0, 0, 0, 0);
      const currStart = new Date(sortedSegments[i].startDate);
      currStart.setHours(0, 0, 0, 0);
      if (currStart.getTime() !== prevEnd.getTime()) {
        throw new BadRequestException(
          `Segments must be contiguous. Gap found between segment ${i} and ${i + 1}.`
        );
      }
    }

    // Validate each site exists and is available for their segment
    for (const seg of sortedSegments) {
      const site = await this.prisma.site.findUnique({ where: { id: seg.siteId } });
      if (!site) {
        throw new NotFoundException(`Site ${seg.siteId} not found`);
      }
      if (site.campgroundId !== reservation.campgroundId) {
        throw new BadRequestException(`Site ${seg.siteId} is not in this campground`);
      }

      // Check availability (ignore this reservation's original site block)
      await this.assertSiteAvailable(
        seg.siteId,
        new Date(seg.startDate),
        new Date(seg.endDate),
        reservationId
      );
    }

    // Calculate price for each segment
    const segmentPrices: number[] = [];
    for (const seg of sortedSegments) {
      const priceResult = await evaluatePricingV2(
        this.prisma,
        this.pricingV2Service,
        reservation.campgroundId,
        seg.siteId,
        new Date(seg.startDate),
        new Date(seg.endDate)
      );
      segmentPrices.push(priceResult.totalCents);
    }

    const newTotalAmount = segmentPrices.reduce((sum, p) => sum + p, 0);

    // Delete any existing segments and create new ones
    await this.prisma.reservationSegment.deleteMany({
      where: { reservationId }
    });

    // Create new segments in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create segments
      for (let i = 0; i < sortedSegments.length; i++) {
        const seg = sortedSegments[i];
        await tx.reservationSegment.create({
          data: {
            reservationId,
            siteId: seg.siteId,
            startDate: new Date(seg.startDate),
            endDate: new Date(seg.endDate),
            subtotalCents: segmentPrices[i],
            sortOrder: i
          }
        });
      }

      // Update reservation total and set siteId to first segment's site
      const updated = await tx.reservation.update({
        where: { id: reservationId },
        data: {
          siteId: sortedSegments[0].siteId,
          totalAmount: newTotalAmount,
          balanceAmount: Math.max(0, newTotalAmount - reservation.paidAmount),
          notes: reservation.notes
            ? `${reservation.notes}\n[Split Stay] ${sortedSegments.length} segments across sites.`
            : `[Split Stay] ${sortedSegments.length} segments across sites.`
        },
        include: {
          segments: { include: { site: true }, orderBy: { sortOrder: "asc" } },
          guest: true,
          campground: true
        }
      });

      return updated;
    });

    // Record audit log
    await this.audit.record({
      action: "reservation.split",
      entity: "reservation",
      entityId: reservationId,
      actorId: options?.actorId ?? null,
      campgroundId: reservation.campgroundId,
      before: { totalAmount: reservation.totalAmount, segmentCount: 0 },
      after: {
        segmentCount: sortedSegments.length,
        siteIds: sortedSegments.map((s) => s.siteId),
        totalAmount: newTotalAmount
      }
    });

    // Send notification to guest about site change if requested
    if (options?.sendNotification && reservation.guest?.email) {
      try {
        const siteNames = await Promise.all(
          sortedSegments.map(async (s) => {
            const site = await this.prisma.site.findUnique({
              where: { id: s.siteId },
              select: { name: true }
            });
            return site?.name ?? s.siteId;
          })
        );

        await this.emailService.sendTemplatedEmail({
          to: reservation.guest.email,
          campgroundId: reservation.campgroundId,
          template: "reservation_update",
          context: {
            guestFirstName: reservation.guest.primaryFirstName,
            campgroundName: reservation.campground.name,
            arrivalDate: reservation.arrivalDate.toISOString().slice(0, 10),
            departureDate: reservation.departureDate.toISOString().slice(0, 10),
            message: `Your stay has been split across multiple sites: ${siteNames.join(" → ")}. We will ensure a smooth transition between sites.`,
            totalAmount: (newTotalAmount / 100).toFixed(2)
          }
        });
      } catch (err) {
        this.logger.warn("Failed to send split booking notification:", err);
      }
    }

    return result;
  }

  /**
   * Get reservation segments for a reservation (if it's a split booking)
   */
  async getReservationSegments(reservationId: string) {
    return this.prisma.reservationSegment.findMany({
      where: { reservationId },
      include: { site: true },
      orderBy: { sortOrder: "asc" }
    });
  }
}
