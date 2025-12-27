import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

interface WaitlistMatch {
  entry: any;
  aiScore: any;
  reasons: string[];
}

@Injectable()
export class AiSmartWaitlistService {
  private readonly logger = new Logger(AiSmartWaitlistService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ==================== SCORING ====================

  /**
   * Get all AI scores for a campground's waitlist
   */
  async getScores(campgroundId: string) {
    return this.prisma.aiWaitlistScore.findMany({
      where: { campgroundId },
      include: {
        waitlistEntry: {
          include: {
            guest: { select: { id: true, primaryFirstName: true, primaryLastName: true, email: true } },
            site: { select: { id: true, name: true } },
            siteClass: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { aiScore: "desc" },
    });
  }

  /**
   * Get AI score for a specific waitlist entry
   */
  async getScore(entryId: string) {
    const score = await this.prisma.aiWaitlistScore.findUnique({
      where: { waitlistEntryId: entryId },
      include: {
        waitlistEntry: {
          include: {
            guest: true,
            site: true,
            siteClass: true,
          },
        },
      },
    });

    if (!score) {
      // Calculate on-demand if not exists
      return this.scoreEntry(entryId);
    }

    return score;
  }

  /**
   * Score a single waitlist entry with AI factors
   */
  async scoreEntry(entryId: string) {
    const entry = await this.prisma.waitlistEntry.findUnique({
      where: { id: entryId },
      include: {
        guest: true,
        campground: true,
      },
    });

    if (!entry) throw new NotFoundException("Waitlist entry not found");

    // Calculate component scores
    const baseScore = entry.priority; // 0-100 from existing system
    const guestLtvScore = await this.calculateGuestLtvScore(entry.guestId, entry.campgroundId);
    const bookingLikelihood = await this.predictBookingLikelihood(entry);
    const seasonalFitScore = await this.calculateSeasonalFitScore(
      entry.campgroundId,
      entry.arrivalDate,
      entry.departureDate
    );
    const communicationScore = await this.calculateCommunicationScore(entry.guestId);

    // Get weights from config (or use defaults)
    const config = await this.prisma.aiAutopilotConfig.findUnique({
      where: { campgroundId: entry.campgroundId },
    });

    const weights = {
      base: 0.2,
      ltv: config?.waitlistGuestValueWeight ?? 0.3,
      likelihood: config?.waitlistLikelihoodWeight ?? 0.3,
      seasonal: config?.waitlistSeasonalWeight ?? 0.2,
    };

    // Calculate weighted score
    const aiScore =
      baseScore * weights.base +
      guestLtvScore * weights.ltv +
      bookingLikelihood * weights.likelihood +
      seasonalFitScore * weights.seasonal;

    // Build reason explanation
    const reasons: string[] = [];
    if (guestLtvScore > 70) reasons.push("High-value repeat guest");
    if (guestLtvScore > 50 && guestLtvScore <= 70) reasons.push("Returning guest");
    if (bookingLikelihood > 70) reasons.push("High booking probability");
    if (seasonalFitScore > 70) reasons.push("Peak demand period");
    if (entry.autoOffer) reasons.push("Auto-offer enabled");
    if (entry.flexibleDates) reasons.push("Flexible dates");

    const aiReason = reasons.length > 0 ? reasons.join(", ") : "Standard priority";

    // Upsert the score
    return this.prisma.aiWaitlistScore.upsert({
      where: { waitlistEntryId: entryId },
      create: {
        waitlistEntryId: entryId,
        campgroundId: entry.campgroundId,
        baseScore,
        guestLtvScore,
        bookingLikelihood,
        seasonalFitScore,
        communicationScore,
        aiScore,
        aiReason,
      },
      update: {
        baseScore,
        guestLtvScore,
        bookingLikelihood,
        seasonalFitScore,
        communicationScore,
        aiScore,
        aiReason,
        calculatedAt: new Date(),
      },
    });
  }

  /**
   * Rescore all active waitlist entries for a campground
   */
  async rescoreAll(campgroundId: string) {
    const entries = await this.prisma.waitlistEntry.findMany({
      where: {
        campgroundId,
        status: "active",
      },
      select: { id: true },
    });

    let scored = 0;
    for (const entry of entries) {
      try {
        await this.scoreEntry(entry.id);
        scored++;
      } catch (error) {
        this.logger.warn(`Failed to score entry ${entry.id}: ${error}`);
      }
    }

    return { scored, total: entries.length };
  }

  /**
   * Score all matches for a cancellation/availability opening
   * Returns sorted by AI score (highest first)
   */
  async scoreMatchesForAvailability(
    campgroundId: string,
    arrivalDate: Date,
    departureDate: Date,
    siteId?: string,
    siteClassId?: string
  ): Promise<WaitlistMatch[]> {
    // Find matching waitlist entries
    const entries = await this.prisma.waitlistEntry.findMany({
      where: {
        campgroundId,
        status: "active",
        OR: [
          // Exact date match
          {
            arrivalDate: { lte: arrivalDate },
            departureDate: { gte: departureDate },
          },
          // Flexible dates
          {
            flexibleDates: true,
          },
          // No dates specified (any availability)
          {
            arrivalDate: null,
            departureDate: null,
          },
        ],
        // Site preference match
        ...(siteId ? { OR: [{ siteId }, { siteId: null }] } : {}),
        ...(siteClassId ? { OR: [{ siteTypeId: siteClassId }, { siteTypeId: null }] } : {}),
      },
      include: {
        guest: true,
        site: true,
        siteClass: true,
      },
    });

    // Score each entry
    const scoredMatches: WaitlistMatch[] = [];

    for (const entry of entries) {
      try {
        const aiScore = await this.scoreEntry(entry.id);
        const reasons: string[] = [];

        // Add match-specific reasons
        if (entry.siteId === siteId) reasons.push("Exact site match");
        if (entry.siteTypeId === siteClassId) reasons.push("Site type match");
        if (
          entry.arrivalDate?.getTime() === arrivalDate.getTime() &&
          entry.departureDate?.getTime() === departureDate.getTime()
        ) {
          reasons.push("Exact date match");
        }

        scoredMatches.push({
          entry,
          aiScore,
          reasons: [...(aiScore.aiReason?.split(", ") || []), ...reasons],
        });
      } catch (error) {
        this.logger.warn(`Failed to score entry ${entry.id}: ${error}`);
      }
    }

    // Sort by AI score descending
    scoredMatches.sort((a, b) => b.aiScore.aiScore - a.aiScore.aiScore);

    return scoredMatches;
  }

  // ==================== FACTOR CALCULATIONS ====================

  /**
   * Calculate guest lifetime value score (0-100)
   */
  private async calculateGuestLtvScore(guestId: string | null, campgroundId: string): Promise<number> {
    if (!guestId) return 30; // Unknown guest gets base score

    // Get guest's reservation history
    const reservations = await this.prisma.reservation.findMany({
      where: {
        guestId,
        campgroundId,
        status: { in: ["confirmed", "checked_in", "checked_out"] },
      },
      select: {
        totalAmountCents: true,
        arrivalDate: true,
      },
    });

    if (reservations.length === 0) return 40; // New guest

    // Calculate metrics
    const totalSpent = reservations.reduce((sum, r) => sum + (r.totalAmountCents || 0), 0);
    const reservationCount = reservations.length;
    const avgSpent = totalSpent / reservationCount;

    // Score based on history
    let score = 40; // Base score for known guest

    // Reservation count bonus (up to +30)
    score += Math.min(30, reservationCount * 10);

    // Spending bonus (up to +30)
    if (avgSpent > 50000) score += 30; // >$500 avg
    else if (avgSpent > 20000) score += 20; // >$200 avg
    else if (avgSpent > 10000) score += 10; // >$100 avg

    return Math.min(100, score);
  }

  /**
   * Predict likelihood guest will book if offered (0-100)
   */
  private async predictBookingLikelihood(entry: any): Promise<number> {
    let score = 50; // Base likelihood

    // Auto-offer enabled is a strong signal
    if (entry.autoOffer) score += 25;

    // Flexible dates increases likelihood
    if (entry.flexibleDates) score += 10;

    // Price flexibility increases likelihood
    if (entry.maxPrice) score += 10;

    // Recent entry is more likely to still be interested
    const daysSinceCreated = Math.floor(
      (Date.now() - new Date(entry.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceCreated < 7) score += 15;
    else if (daysSinceCreated < 14) score += 10;
    else if (daysSinceCreated < 30) score += 5;
    else if (daysSinceCreated > 60) score -= 10; // Stale entry

    // Previous offer acceptance/rejection history
    if (entry.offerCount > 0) {
      if (entry.lastOfferStatus === "declined") score -= 20;
      // If they've declined multiple offers, lower priority
      if (entry.offerCount >= 3 && !entry.convertedReservationId) score -= 15;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate seasonal fit score (0-100)
   * Higher score = dates are in higher demand period
   */
  private async calculateSeasonalFitScore(
    campgroundId: string,
    arrivalDate: Date | null,
    departureDate: Date | null
  ): Promise<number> {
    if (!arrivalDate || !departureDate) return 50; // Unknown dates

    // Get historical occupancy for this period
    const lastYear = new Date(arrivalDate);
    lastYear.setFullYear(lastYear.getFullYear() - 1);

    const lastYearEnd = new Date(departureDate);
    lastYearEnd.setFullYear(lastYearEnd.getFullYear() - 1);

    const historicalReservations = await this.prisma.reservation.count({
      where: {
        campgroundId,
        status: { in: ["confirmed", "checked_in", "checked_out"] },
        arrivalDate: { gte: lastYear, lte: lastYearEnd },
      },
    });

    // Get average for all periods
    const totalReservationsLastYear = await this.prisma.reservation.count({
      where: {
        campgroundId,
        status: { in: ["confirmed", "checked_in", "checked_out"] },
        arrivalDate: {
          gte: new Date(lastYear.getFullYear(), 0, 1),
          lte: new Date(lastYear.getFullYear(), 11, 31),
        },
      },
    });

    // Calculate score based on relative demand
    if (totalReservationsLastYear === 0) return 50;

    const daysInPeriod = Math.max(
      1,
      (departureDate.getTime() - arrivalDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const avgPerDay = totalReservationsLastYear / 365;
    const periodAvgPerDay = historicalReservations / daysInPeriod;

    // Score based on how this period compares to average
    const ratio = periodAvgPerDay / avgPerDay;
    if (ratio >= 1.5) return 90; // Very high demand
    if (ratio >= 1.2) return 75; // High demand
    if (ratio >= 1.0) return 60; // Above average
    if (ratio >= 0.8) return 50; // Average
    return 40; // Below average
  }

  /**
   * Calculate communication score based on guest responsiveness (0-100)
   */
  private async calculateCommunicationScore(guestId: string | null): Promise<number> {
    if (!guestId) return 50; // Unknown guest

    // Check if guest has responded to previous communications
    const communications = await this.prisma.communication.findMany({
      where: { guestId },
      select: { direction: true },
      take: 10,
      orderBy: { createdAt: "desc" },
    });

    if (communications.length === 0) return 50;

    // Count inbound vs outbound
    const inbound = communications.filter((c) => c.direction === "inbound").length;
    const outbound = communications.filter((c) => c.direction === "outbound").length;

    // If guest has responded to messages, they're engaged
    if (inbound > 0 && outbound > 0) {
      const responseRate = inbound / Math.max(1, outbound);
      if (responseRate >= 0.8) return 90;
      if (responseRate >= 0.5) return 75;
      if (responseRate >= 0.3) return 60;
    }

    return 50;
  }
}
