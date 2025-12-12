import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { GamificationEventCategory, MaintenanceStatus, Prisma, ReferralIncentiveType, Reservation, ReservationStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateReservationDto } from "./dto/create-reservation.dto";
import { RefundPaymentDto } from "./dto/refund-payment.dto";
import { PricingService } from "../pricing/pricing.service";
import { LockService } from "../redis/lock.service";
import { PromotionsService } from "../promotions/promotions.service";
import { AccessControlService } from "../access-control/access-control.service";

import { WaitlistService } from '../waitlist/waitlist.service';
import { EmailService } from '../email/email.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { SeasonalRatesService } from '../seasonal-rates/seasonal-rates.service';
import { TaxRulesService } from '../tax-rules/tax-rules.service';
import { postBalancedLedgerEntries } from "../ledger/ledger-posting.util";

import { MatchScoreService } from "./match-score.service";
import { GamificationService } from "../gamification/gamification.service";
import { CommunicationPlaybook } from "@prisma/client";
import { Cron } from "@nestjs/schedule";
import { PricingV2Service, PricingBreakdown } from "../pricing-v2/pricing-v2.service";
import { DepositPoliciesService, DepositCalculation } from "../deposit-policies/deposit-policies.service";
import { SignaturesService } from "../signatures/signatures.service";

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingService: PricingService,
    private readonly locks: LockService,
    private readonly promotionsService: PromotionsService,
    private readonly emailService: EmailService,
    private readonly waitlistService: WaitlistService,
    private readonly loyaltyService: LoyaltyService,
    private readonly seasonalRatesService: SeasonalRatesService,
    private readonly taxRulesService: TaxRulesService,
    private readonly matchScoreService: MatchScoreService,
    private readonly gamification: GamificationService,
    private readonly pricingV2Service: PricingV2Service,
    private readonly depositPoliciesService: DepositPoliciesService,
    private readonly accessControl: AccessControlService,
    private readonly signaturesService: SignaturesService
  ) { }

  async getMatchedSites(campgroundId: string, guestId: string) {
    const guest = await this.prisma.guest.findUnique({
      where: { id: guestId },
      include: { reservations: { include: { site: true } } }
    });
    if (!guest) throw new NotFoundException("Guest not found");

    const sites = await this.prisma.site.findMany({
      where: { campgroundId, isActive: true },
      include: { siteClass: true }
    });

    const matches = sites.map(site => {
      const { score, reasons } = this.matchScoreService.calculateMatchScore(guest, site);
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

  private computeDepositRequired(
    rule: string | null | undefined,
    totalCents: number,
    nights: number,
    depositPercentage?: number | null
  ) {
    const normalized = (rule || "none").toLowerCase();
    if (normalized === "full") return totalCents;
    if (normalized === "half" || normalized === "percentage_50") return Math.ceil(totalCents / 2);
    if (normalized === "first_night" || normalized === "first_night_fees") return Math.ceil(totalCents / nights);
    if (normalized === "percentage") {
      const pct = depositPercentage ?? 0;
      if (pct <= 0) return 0;
      return Math.ceil(totalCents * (pct / 100));
    }
    return 0;
  }

  private async hasSignedWaiver(reservationId: string, guestId: string) {
    const [signedSignature, signedArtifact, digitalWaiver] = await Promise.all([
      (this.prisma as any).signatureRequest.findFirst?.({
        where: { reservationId, documentType: "waiver", status: "signed" }
      }),
      (this.prisma as any).signatureArtifact.findFirst?.({
        where: { reservationId, pdfUrl: { not: null } }
      }),
      (this.prisma as any).digitalWaiver.findFirst?.({
        where: {
          OR: [{ reservationId }, { reservationId: null, guestId }],
          status: "signed"
        }
      })
    ]);
    return Boolean(signedSignature || signedArtifact || digitalWaiver);
  }

  private async hasVerifiedId(reservationId: string, guestId: string) {
    const now = new Date();
    const match = await (this.prisma as any).idVerification.findFirst?.({
      where: {
        OR: [
          { reservationId, status: "verified" },
          { guestId, status: "verified", expiresAt: { gt: now } }
        ]
      }
    });
    return Boolean(match);
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
    return { ok: reasons.length === 0, reason: reasons[0], reasons, signingUrl };
  }

  /**
   * Compute pricing using V2 rules if any exist, otherwise fallback to legacy.
   * Returns unified result with pricingRuleVersion for snapshot.
   */
  private async computePriceV2(
    campgroundId: string,
    siteId: string,
    arrival: Date,
    departure: Date,
    options?: { taxWaiverSigned?: boolean; occupancyPct?: number }
  ) {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      include: { siteClass: true }
    });
    if (!site) throw new NotFoundException("Site not found");

    const nights = this.computeNights(arrival, departure);
    const defaultRate = site.siteClass?.defaultRate ?? 0;

    // Check if V2 rules exist for this campground
    const v2RuleCount = await this.prisma.pricingRuleV2.count({
      where: { campgroundId, active: true }
    });

    let result: {
      nights: number;
      baseSubtotalCents: number;
      totalCents: number;
      rulesDeltaCents: number;
      pricingRuleVersion: string;
      appliedRules?: PricingBreakdown["appliedRules"];
      seasonalRate?: any;
      taxExemption?: any;
    };

    if (v2RuleCount > 0) {
      // Use V2 pricing engine
      const breakdown = await this.pricingV2Service.evaluate(
        campgroundId,
        site.siteClassId,
        defaultRate,
        arrival,
        departure,
        options?.occupancyPct
      );

      result = {
        nights: breakdown.nights,
        baseSubtotalCents: breakdown.baseSubtotalCents,
        totalCents: breakdown.totalBeforeTaxCents,
        rulesDeltaCents: breakdown.adjustmentsCents + breakdown.demandAdjustmentCents,
        pricingRuleVersion: breakdown.pricingRuleVersion,
        appliedRules: breakdown.appliedRules
      };
    } else {
      // Fallback to legacy pricing
      const legacy = await this.computePrice(campgroundId, siteId, arrival, departure, options);
      result = {
        nights: legacy.nights,
        baseSubtotalCents: legacy.baseSubtotalCents,
        totalCents: legacy.totalCents,
        rulesDeltaCents: legacy.rulesDeltaCents,
        pricingRuleVersion: "v1:legacy",
        seasonalRate: legacy.seasonalRate,
        taxExemption: legacy.taxExemption
      };
    }

    // Add tax exemption evaluation for V2 as well
    if (v2RuleCount > 0) {
      const taxExemption = await this.taxRulesService.evaluateExemption(
        campgroundId,
        nights,
        options?.taxWaiverSigned ?? false
      );
      result.taxExemption = {
        eligible: taxExemption.eligible,
        applied: taxExemption.applied,
        requiresWaiver: taxExemption.rule?.requiresWaiver ?? false,
        waiverText: taxExemption.rule?.waiverText ?? null,
        reason: (taxExemption as any).reason ?? null
      };
    }

    return result;
  }

  /**
   * Assert deposit using V2 DepositPolicy if available, otherwise legacy.
   * Returns deposit calculation with version string.
   */
  private async assertDepositV2(
    campgroundId: string,
    siteClassId: string | null,
    totalAmount: number,
    lodgingOnlyCents: number,
    paidAmount: number,
    arrivalDate: Date,
    departureDate: Date
  ): Promise<{ depositAmount: number; depositPolicyVersion: string }> {
    const nights = this.computeNights(arrivalDate, departureDate);

    // Try V2 deposit policy first
    const v2Calc = await this.depositPoliciesService.calculateDeposit(
      campgroundId,
      siteClassId,
      totalAmount,
      lodgingOnlyCents,
      nights
    );

    if (v2Calc) {
      if (paidAmount < v2Calc.depositAmountCents) {
        throw new BadRequestException(
          `Deposit of at least $${(v2Calc.depositAmountCents / 100).toFixed(2)} required (${v2Calc.policy.name}: ${v2Calc.policy.strategy})`
        );
      }
      return {
        depositAmount: v2Calc.depositAmountCents,
        depositPolicyVersion: v2Calc.depositPolicyVersion
      };
    }

    // Fallback to legacy
    const campground = await this.prisma.campground.findUnique({ where: { id: campgroundId } });
    if (!campground) throw new NotFoundException("Campground not found");

    const required = this.computeDepositRequired(
      campground.depositRule,
      totalAmount,
      nights,
      campground.depositPercentage
    );

    if (paidAmount < required) {
      throw new BadRequestException(
        `Deposit of at least $${(required / 100).toFixed(2)} required by campground rule (${campground.depositRule || "none"})`
      );
    }

    return {
      depositAmount: required,
      depositPolicyVersion: "v1:legacy"
    };
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
    const reservations = await this.prisma.reservation.findMany({
      where: {
        status: { not: ReservationStatus.cancelled },
        totalAmount: { gt: 0 }
      },
      select: { id: true, campgroundId: true, guestId: true, totalAmount: true, paidAmount: true }
    });
    const due = reservations.filter(r => Number(r.paidAmount || 0) < Number(r.totalAmount || 0));
    if (!due.length) return;

    const playbooks = await (this.prisma as any).communicationPlaybook.findMany({
      where: {
        type: "unpaid",
        enabled: true,
        templateId: { not: null }
      }
    });

    for (const pb of playbooks as CommunicationPlaybook[]) {
      const tpl = await (this.prisma as any).communicationTemplate.findFirst({ where: { id: pb.templateId, status: "approved" } });
      if (!tpl) continue;
      for (const r of due.filter(d => d.campgroundId === pb.campgroundId)) {
        const scheduledAt = new Date();
        if (pb.offsetMinutes && Number.isFinite(pb.offsetMinutes)) {
          scheduledAt.setMinutes(scheduledAt.getMinutes() + pb.offsetMinutes);
        }
        await (this.prisma as any).communicationPlaybookJob.create({
          data: {
            playbookId: pb.id,
            campgroundId: r.campgroundId,
            reservationId: r.id,
            guestId: r.guestId,
            status: "pending",
            scheduledAt
          }
        });
      }
    }
  }

  private isOverlapError(err: unknown) {
    return err instanceof Prisma.PrismaClientKnownRequestError && err.message.includes("Reservation_no_overlap");
  }

  /**
   * Find an available site in a given site class for the specified date range.
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
    // Get all sites in the class with metadata needed for scoring/validation
    const sites = await this.prisma.site.findMany({
      where: {
        campgroundId,
        siteClassId,
        isActive: true
      },
      include: {
        siteClass: true
      }
    });

    if (!sites || sites.length === 0) {
      return null;
    }

    const guest = options?.guestId
      ? await this.prisma.guest.findUnique({
        where: { id: options.guestId },
        include: { reservations: { include: { site: true } } }
      })
      : null;

    const candidates: { site: (typeof sites)[number]; score: number }[] = [];

    for (const site of sites) {
      try {
        await this.assertSiteAvailable(site.id, arrival, departure, undefined, options?.holdId ?? undefined);
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
        // Skip ineligible or unavailable site
        continue;
      }
    }

    if (!candidates.length) {
      return null; // No available sites found
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

  /**
   * Pricing calculation with seasonal rates and tax exemptions.
   * - Uses SeasonalRatesService.findApplicableRate() to get best rate based on stay length
   * - Uses TaxRulesService.evaluateExemption() to check tax waiver eligibility
   */
  private async computePrice(
    campgroundId: string,
    siteId: string,
    arrival: Date,
    departure: Date,
    options?: { taxWaiverSigned?: boolean }
  ) {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      include: { siteClass: true }
    });
    if (!site) throw new NotFoundException("Site not found");

    const nights = this.computeNights(arrival, departure);
    const defaultRate = site.siteClass?.defaultRate ?? 0; // cents per night

    // Check for applicable seasonal rate
    const seasonalRate = await this.seasonalRatesService.findApplicableRate(
      campgroundId,
      site.siteClassId,
      nights,
      arrival
    );

    // Use seasonal rate if available, otherwise use default rate
    const baseRate = seasonalRate ? seasonalRate.amount : defaultRate;

    const rules = await this.prisma.pricingRule.findMany({
      where: {
        campgroundId,
        isActive: true,
        OR: [{ siteClassId: null }, { siteClassId: site.siteClassId }]
      }
    });

    let total = 0;
    let baseSubtotal = 0;
    let rulesDelta = 0;

    for (let i = 0; i < nights; i++) {
      const day = new Date(arrival);
      day.setDate(day.getDate() + i);
      const dow = day.getDay();

      let nightly = baseRate;
      let nightlyDelta = 0;

      for (const rule of rules) {
        if (rule.minNights && nights < rule.minNights) continue;
        if (rule.startDate && day < rule.startDate) continue;
        if (rule.endDate && day > rule.endDate) continue;
        if (rule.dayOfWeek !== null && rule.dayOfWeek !== undefined && rule.dayOfWeek !== dow) continue;

        if (rule.flatAdjust) nightlyDelta += rule.flatAdjust;
        if (rule.percentAdjust) nightlyDelta += Math.round(nightly * Number(rule.percentAdjust));
      }

      nightly += nightlyDelta;
      baseSubtotal += baseRate;
      rulesDelta += nightlyDelta;
      total += nightly;
    }

    // Evaluate tax exemption eligibility
    const taxExemption = await this.taxRulesService.evaluateExemption(
      campgroundId,
      nights,
      options?.taxWaiverSigned ?? false
    );

    return {
      nights,
      baseSubtotalCents: baseSubtotal,
      rulesDeltaCents: rulesDelta,
      totalCents: total,
      seasonalRate: seasonalRate ? {
        id: seasonalRate.id,
        name: seasonalRate.name,
        rateType: seasonalRate.rateType,
        amount: seasonalRate.amount
      } : null,
      taxExemption: {
        eligible: taxExemption.eligible,
        applied: taxExemption.applied,
        requiresWaiver: taxExemption.rule?.requiresWaiver ?? false,
        waiverText: taxExemption.rule?.waiverText ?? null,
        reason: (taxExemption as any).reason ?? null
      }
    };
  }

  private async assertDeposit(
    campgroundId: string,
    totalAmount: number,
    paidAmount: number,
    arrivalDate: Date,
    departureDate: Date
  ) {
    const campground = await this.prisma.campground.findUnique({ where: { id: campgroundId } });
    if (!campground) throw new NotFoundException("Campground not found");
    const nights = this.computeNights(arrivalDate, departureDate);
    const required = this.computeDepositRequired(
      campground.depositRule,
      totalAmount,
      nights,
      campground.depositPercentage
    );
    if (paidAmount < required) {
      throw new BadRequestException(
        `Deposit of at least $${(required / 100).toFixed(2)} required by campground rule (${campground.depositRule || "none"})`
      );
    }
    return required;
  }

  async calculateDeposit(id: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: { campground: true }
    });
    if (!reservation) throw new NotFoundException("Reservation not found");

    const nights = this.computeNights(reservation.arrivalDate, reservation.departureDate);
    const depositAmount = this.computeDepositRequired(
      reservation.campground.depositRule,
      reservation.totalAmount,
      nights,
      reservation.campground.depositPercentage
    );

    const remainingBalance = Math.max(0, reservation.totalAmount - (reservation.paidAmount || 0));

    return { depositAmount, remainingBalance };
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

  listByCampground(campgroundId: string) {
    return this.prisma.reservation.findMany({
      where: { campgroundId },
      include: { guest: true, site: true }
    });
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
          include: {
            siteClass: {
              select: { rigMaxLength: true, siteType: true, name: true }
            }
          },
          select: {
            siteClassId: true,
            siteType: true,
            rigMaxLength: true,
            accessible: true,
            amenityTags: true,
            maxOccupancy: true
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

        const price =
          data.totalAmount && data.totalAmount > 0
            ? {
              totalCents: data.totalAmount,
              baseSubtotalCents: 0,
              rulesDeltaCents: 0,
              nights: this.computeNights(arrival, departure),
              pricingRuleVersion: "manual"
            }
            : await this.computePriceV2(data.campgroundId, siteId, arrival, departure);

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

        // Use V2 deposit policy if available
        const depositCalc = await this.assertDepositV2(
          data.campgroundId,
          siteInfo?.siteClassId ?? null,
          totalAmount,
          price.baseSubtotalCents, // lodging only
          paidAmount,
          arrival,
          departure
        );
        const paymentFields = this.buildPaymentFields(totalAmount, paidAmount);

        const {
          paymentMethod,
          transactionId,
          paymentNotes,
          siteClassId,
          rvType,
          pets,
          ...reservationData
        } = data;

        const reservation = await this.prisma.reservation.create({
          data: {
            ...reservationData,
            rigType: data.rigType || rvType,
            siteId: siteId, // Use the determined siteId (either from data or found from siteClassId)
            children: data.children ?? 0,
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
            guest: true
          }
        });

        await this.enqueuePlaybooksForReservation("arrival", reservation.id);

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
        }

        // Increment promotion usage count if promo was applied
        if (promotionId) {
          await this.promotionsService.incrementUsage(promotionId);
        }

        try {
          await this.signaturesService.autoSendForReservation(reservation);
        } catch (err) {
          // Auto-send failures should not block booking creation
          console.warn(`[Signatures] Auto-send failed for reservation ${reservation.id}:`, err);
        }

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

        const shouldReprice = data.totalAmount === undefined || data.totalAmount === null;
        const price = shouldReprice
          ? await this.computePriceV2(existing.campgroundId, targetSiteId, arrival, departure)
          : null;
        const totalAmount = shouldReprice ? price!.totalCents : data.totalAmount ?? existing.totalAmount;
        const paidAmount = data.paidAmount ?? existing.paidAmount ?? 0;

        const depositCalc = await this.assertDepositV2(
          existing.campgroundId,
          siteInfo?.siteClassId ?? null,
          totalAmount,
          price?.baseSubtotalCents ?? existing.baseSubtotal ?? 0,
          paidAmount,
          arrival,
          departure
        );
        const paymentFields = this.buildPaymentFields(totalAmount, paidAmount);

        const {
          paymentMethod,
          transactionId,
          paymentNotes,
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
            baseSubtotal: data.baseSubtotal ?? (price ? price.baseSubtotalCents : existing.baseSubtotal),
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
            console.error('Failed to create turnover task:', taskErr);
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

  remove(id: string) {
    return this.prisma.reservation.delete({ where: { id } });
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
    }
  ) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: {
        site: { include: { siteClass: true } },
        guest: true,
        campground: { select: { name: true } }
      }
    });
    if (!reservation) throw new NotFoundException("Reservation not found");

    const tenderList =
      options?.tenders && options.tenders.length > 0
        ? options.tenders
        : amountCents
          ? [{ method: options?.paymentMethod || "card", amountCents, note: options?.receiptKind ? `${options.receiptKind} payment` : undefined }]
          : [];
    const totalTenderCents = tenderList.reduce((sum, t) => sum + (t.amountCents || 0), 0);
    if (totalTenderCents <= 0) throw new BadRequestException("Payment amount must be positive");

    const newPaid = (reservation.paidAmount ?? 0) + totalTenderCents;
    const paymentFields = this.buildPaymentFields(reservation.totalAmount, newPaid);

    const updated = await this.prisma.reservation.update({
      where: { id },
      data: {
        paidAmount: newPaid,
        ...paymentFields
      }
    });

    const revenueGl = reservation.site?.siteClass?.glCode ?? "REVENUE_UNMAPPED";
    const revenueAccount = reservation.site?.siteClass?.clientAccount ?? "Revenue";
    const externalRef = options?.stripeBalanceTransactionId ?? options?.stripeChargeId ?? options?.stripePaymentIntentId ?? options?.transactionId ?? null;

    for (const tender of tenderList) {
      await this.prisma.payment.create({
        data: {
          campgroundId: reservation.campgroundId,
          reservationId: reservation.id,
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
      await postBalancedLedgerEntries(this.prisma, [
        {
          campgroundId: reservation.campgroundId,
          reservationId: reservation.id,
          glCode: "CASH",
          account: "Cash",
          description: options?.transactionId ? `Payment ${options.transactionId}` : `Reservation payment (${tender.method})`,
          amountCents: tender.amountCents,
          direction: "debit",
          externalRef,
          dedupeKey: externalRef ? `res:${reservation.id}:payment:${externalRef}:${tender.method}:debit` : `res:${reservation.id}:payment:${tender.method}:debit`
        },
        {
          campgroundId: reservation.campgroundId,
          reservationId: reservation.id,
          glCode: revenueGl,
          account: revenueAccount,
          description: `Reservation payment (${tender.method})`,
          amountCents: tender.amountCents,
          direction: "credit",
          externalRef,
          dedupeKey: externalRef ? `res:${reservation.id}:payment:${externalRef}:${tender.method}:credit` : `res:${reservation.id}:payment:${tender.method}:credit`
        }
      ]);
    }

    // Send payment receipt email
    try {
      await this.emailService.sendPaymentReceipt({
        guestEmail: reservation.guest.email,
        guestName: `${reservation.guest.primaryFirstName} ${reservation.guest.primaryLastName}`,
        campgroundName: reservation.campground.name,
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
      console.error('Failed to send payment receipt email:', emailError);
    }

    return updated;
  }

  async refundPayment(id: string, amountCents: number) {
    if (amountCents <= 0) throw new BadRequestException("Refund amount must be positive");
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: {
        site: { include: { siteClass: true } },
        guest: true,
        campground: { select: { name: true } }
      }
    });
    if (!reservation) throw new NotFoundException("Reservation not found");

    if ((reservation.paidAmount ?? 0) < amountCents) {
      throw new BadRequestException("Refund exceeds paid amount");
    }

    const newPaid = (reservation.paidAmount ?? 0) - amountCents;
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
        note: "Reservation refund"
      }
    });
    const revenueGl = reservation.site?.siteClass?.glCode ?? "REVENUE_UNMAPPED";
    const revenueAccount = reservation.site?.siteClass?.clientAccount ?? "Revenue";
    await postBalancedLedgerEntries(this.prisma, [
      {
        campgroundId: reservation.campgroundId,
        reservationId: reservation.id,
        glCode: "CASH",
        account: "Cash",
        description: "Reservation refund",
        amountCents,
        direction: "credit",
        dedupeKey: `res:${reservation.id}:refund:${amountCents}:credit`
      },
      {
        campgroundId: reservation.campgroundId,
        reservationId: reservation.id,
        glCode: revenueGl,
        account: revenueAccount,
        description: "Reservation refund",
        amountCents,
        direction: "debit",
        dedupeKey: `res:${reservation.id}:refund:${amountCents}:debit`
      }
    ]);

    // Send refund receipt
    try {
      await this.emailService.sendPaymentReceipt({
        guestEmail: (reservation as any)?.guest?.email ?? "",
        guestName: reservation ? `${(reservation as any)?.guest?.primaryFirstName ?? ""} ${(reservation as any)?.guest?.primaryLastName ?? ""}`.trim() : "",
        campgroundName: (reservation as any)?.campground?.name ?? "Campground",
        amountCents,
        paymentMethod: "Card",
        transactionId: stripeRefundId,
        reservationId: reservation.id,
        siteNumber: (reservation as any)?.site?.siteNumber,
        arrivalDate: (reservation as any)?.arrivalDate,
        departureDate: (reservation as any)?.departureDate,
        source: (reservation as any)?.source ?? "admin",
        kind: "refund",
        totalCents: amountCents
      });
    } catch (err) {
      console.warn("Failed to send refund receipt email", err);
    }

    return updated;
  }

  /**
   * Record a refund that was already processed by Stripe.
   * This is called from webhooks or API endpoints after Stripe confirms the refund.
   * Unlike refundPayment(), this doesn't validate amounts since Stripe already processed it.
   */
  async recordRefund(id: string, amountCents: number, stripeRefundId?: string) {
    if (amountCents <= 0) return; // Skip zero or negative refunds

    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: { site: { include: { siteClass: true } } }
    });
    if (!reservation) {
      console.error(`[Stripe Refund] Reservation ${id} not found for refund recording`);
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

    return updated;
  }

  async quote(campgroundId: string, siteId: string, arrival: string, departure: string) {
    return this.computePrice(campgroundId, siteId, new Date(arrival), new Date(departure));
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

  async kioskCheckIn(id: string, upsellTotalCents: number) {
    console.log(`[Kiosk] Check-in request for ${id}, upsell: ${upsellTotalCents}`);
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: {
        guest: true,
        campground: true,
        site: true
      }
    });
    if (!reservation) {
      console.error(`[Kiosk] Reservation ${id} not found`);
      throw new NotFoundException("Reservation not found");
    }

    console.log(`[Kiosk] Found reservation: ${reservation.status}, Total: ${reservation.totalAmount}, Paid: ${reservation.paidAmount}`);

    if (reservation.status === ReservationStatus.checked_in) {
      console.warn(`[Kiosk] Reservation ${id} already checked in`);
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
    if (!compliance.ok) {
      throw new ConflictException({
        reason: compliance.reason,
        signingUrl: compliance.signingUrl
      });
    }

    const newTotal = reservation.totalAmount + upsellTotalCents;
    const balanceDue = newTotal - (reservation.paidAmount || 0);

    console.log(`[Kiosk] New Total: ${newTotal}, Balance Due: ${balanceDue}`);

    // In a real app, we would charge the card here using StripeService
    // const charge = await this.stripeService.chargeCustomer(reservation.guestId, balanceDue);

    try {
      const updated = await this.prisma.reservation.update({
        where: { id },
        data: {
          status: ReservationStatus.checked_in,
          checkInAt: new Date(),
          feesAmount: { increment: upsellTotalCents },
          totalAmount: newTotal,
          paidAmount: newTotal, // Assume full payment successful
          // Add a note about the upsell/kiosk check-in
          notes: reservation.notes
            ? `${reservation.notes}\n[Kiosk] Checked in. Upsell: $${(upsellTotalCents / 100).toFixed(2)}. Charged card on file.`
            : `[Kiosk] Checked in. Upsell: $${(upsellTotalCents / 100).toFixed(2)}. Charged card on file.`
        }
      });
      console.log(`[Kiosk] Check-in successful for ${id}`);

      try {
        await this.accessControl.autoGrantForReservation(id);
      } catch (err) {
        console.error(`[Kiosk] Access grant failed for ${id}:`, err);
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

      return updated;
    } catch (e) {
      console.error(`[Kiosk] Update failed for ${id}:`, e);
      throw e;
    }
  }
}