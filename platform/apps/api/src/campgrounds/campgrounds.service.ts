import { ConflictException, Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCampgroundDto } from "./dto/create-campground.dto";
import * as bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { EmailService } from "../email/email.service";
import { AuditService } from "../audit/audit.service";
import { randomBytes } from "crypto";
import { ExternalCampgroundUpsertDto, OsmIngestRequestDto } from "./dto/external-campground.dto";
import { CampgroundAssetsService } from "./campground-assets.service";
import { CampgroundReviewConnectors } from "./campground-review-connectors.service";
import { UpdatePhotosDto } from "./dto/update-photos.dto";
import { randomUUID } from "crypto";
import dns from "dns/promises";

@Injectable()
export class CampgroundsService {
  private readonly logger = new Logger(CampgroundsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly audit: AuditService,
    private readonly assets: CampgroundAssetsService,
    private readonly reviewConnectors: CampgroundReviewConnectors
  ) { }

  private readonly INVITE_RESEND_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes
  private readonly EXTERNAL_ORG_NAME = "External Inventory";
  private readonly DEFAULT_SLA_MINUTES = Number(process.env.DEFAULT_SLA_MINUTES || 30);

  private slugifyName(name: string) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || `camp-${randomBytes(3).toString("hex")}`;
  }

  private normalizeName(name?: string) {
    return (name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  private nameSimilarity(a?: string, b?: string) {
    if (!a || !b) return 0;
    const aParts = new Set(this.normalizeName(a).split(" ").filter(Boolean));
    const bParts = new Set(this.normalizeName(b).split(" ").filter(Boolean));
    if (aParts.size === 0 || bParts.size === 0) return 0;
    let overlap = 0;
    for (const part of aParts) {
      if (bParts.has(part)) overlap++;
    }
    return overlap / Math.max(aParts.size, bParts.size);
  }

  private amenityKeyMap: Record<string, string> = {
    power_supply: "Power",
    drinking_water: "Drinking Water",
    sanitary_dump_station: "Dump Station",
    internet_access: "Internet",
    wifi: "WiFi",
    shower: "Showers",
    toilet: "Restrooms",
    picnic_table: "Picnic Table",
    firepit: "Fire Pits",
    bbq: "BBQ",
    playground: "Playground",
    swimming_pool: "Pool",
    laundry: "Laundry",
    store: "Camp Store",
    dog: "Pet Friendly",
    fee: "Fees Apply",
    caravan: "RV Sites",
    tent: "Tent Sites",
    backcountry: "Backcountry",
    cabin: "Cabins",
    reservation: "Reservations",
    charge: "EV Charging"
  };

  private extractAmenitiesFromTags(tags?: Record<string, any>): string[] {
    if (!tags) return [];
    const amenities = new Set<string>();
    for (const [key, label] of Object.entries(this.amenityKeyMap)) {
      if (tags[key] || tags[`amenity:${key}`]) {
        amenities.add(label);
      }
    }
    if (tags["internet_access"] === "wlan" || tags["internet_access"] === "yes") {
      amenities.add("WiFi");
    }
    if (tags["sanitary_dump_station"] === "yes") {
      amenities.add("Dump Station");
    }
    if (tags["power_supply"] === "yes") {
      amenities.add("Power");
    }
    if (tags["caravan_site"] === "yes" || tags["caravan"] === "yes") {
      amenities.add("RV Sites");
    }
    if (tags["tents"] === "yes" || tags["tent"] === "yes") {
      amenities.add("Tent Sites");
    }
    if (tags["cabins"] === "yes" || tags["cabin"] === "yes") {
      amenities.add("Cabins");
    }
    return Array.from(amenities);
  }

  private amenitySummaryFromTags(tags?: Record<string, any>) {
    if (!tags) return undefined;
    const summary: Record<string, any> = {};
    for (const [key, label] of Object.entries(this.amenityKeyMap)) {
      if (tags[key] !== undefined) {
        summary[label] = tags[key];
      }
    }
    if (tags["internet_access"]) summary["Internet"] = tags["internet_access"];
    if (tags["sanitary_dump_station"]) summary["Dump Station"] = tags["sanitary_dump_station"];
    if (tags["power_supply"]) summary["Power"] = tags["power_supply"];
    return Object.keys(summary).length ? summary : undefined;
  }

  private computeBlendedReviewScore(
    sources?: { source?: string; rating?: number; count?: number; weight?: number }[],
    fallback?: number | null
  ) {
    if (!sources || sources.length === 0) {
      return { score: fallback ?? null, count: undefined as number | undefined };
    }
    let weightedSum = 0;
    let totalWeight = 0;
    let totalCount = 0;

    for (const src of sources) {
      if (src.rating === undefined || src.rating === null) continue;
      const weight = src.weight ?? 1;
      weightedSum += Number(src.rating) * weight;
      totalWeight += weight;
      if (src.count) totalCount += src.count;
    }

    const score = totalWeight > 0 ? weightedSum / totalWeight : fallback ?? null;
    return { score, count: totalCount || undefined };
  }

  async refreshExternalReviews(campgroundId: string, opts?: { googlePlaceId?: string; rvLifeId?: string }) {
    const cg = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: {
        id: true,
        dataSource: true,
        dataSourceId: true,
        reviewScore: true,
        reviewCount: true,
        reviewSources: true
      }
    });
    if (!cg) throw new NotFoundException("Campground not found");

    const reviews = await this.reviewConnectors.collectExternalReviews({
      googlePlaceId: opts?.googlePlaceId || (cg.dataSource === "google_places" ? cg.dataSourceId || undefined : undefined),
      rvLifeId: opts?.rvLifeId
    });

    const blended = this.computeBlendedReviewScore(
      reviews.map((r) => ({ source: r.source, rating: r.rating ?? undefined, count: r.count ?? undefined })),
      cg.reviewScore as any
    );

    return this.prisma.campground.update({
      where: { id: cg.id },
      data: {
        reviewScore: blended.score ?? cg.reviewScore ?? null,
        reviewCount: blended.count ?? cg.reviewCount ?? 0,
        reviewSources: reviews,
        reviewsUpdatedAt: new Date()
      }
    });
  }

  async mirrorCampgroundPhotos(campgroundId: string) {
    const cg = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { id: true, photos: true }
    });
    if (!cg) throw new NotFoundException("Campground not found");
    if (!cg.photos || cg.photos.length === 0) return { updated: false, photos: [], meta: [] };

    const { photos, meta } = await this.assets.mirrorPhotos(cg.photos);
    const updated = await this.prisma.campground.update({
      where: { id: cg.id },
      data: {
        photos,
        photosMeta: meta ?? []
      }
    });
    return { updated: true, photos: updated.photos, meta: updated.photosMeta };
  }

  async updatePhotos(campgroundId: string, dto: UpdatePhotosDto, organizationId?: string, actorId?: string) {
    const cg = await this.prisma.campground.findUnique({ where: { id: campgroundId }, select: { id: true, organizationId: true, photos: true } });
    if (!cg) throw new NotFoundException("Campground not found");
    if (organizationId && cg.organizationId !== organizationId) throw new ForbiddenException("Unauthorized");

    const unique = Array.from(new Set(dto.photos.filter(Boolean)));
    if (unique.length === 0) throw new BadRequestException("At least one photo is required");

    const updated = await this.prisma.campground.update({
      where: { id: campgroundId },
      data: {
        photos: unique,
        heroImageUrl: dto.heroImageUrl ?? undefined,
      },
    });

    await this.audit.record({
      campgroundId,
      actorId: actorId ?? null,
      action: "campground.photos.update",
      entity: "campground",
      entityId: campgroundId,
      before: { photos: cg.photos },
      after: { photos: updated.photos, hero: dto.heroImageUrl ?? updated.heroImageUrl ?? null },
      ip: null,
      userAgent: null,
    });

    await this.prisma.analyticsEvent.create({
      data: {
        sessionId: randomUUID(),
        eventName: "admin_image_reorder" as any,
        campground: { connect: { id: campgroundId } },
        metadata: { count: updated.photos.length },
      },
    });

    return updated;
  }

  async updateFaqs(campgroundId: string, faqs: Array<{ id: string; question: string; answer: string; order: number }>, organizationId?: string) {
    const cg = await this.prisma.campground.findUnique({ where: { id: campgroundId }, select: { id: true, organizationId: true, faqs: true } });
    if (!cg) throw new NotFoundException("Campground not found");
    if (organizationId && cg.organizationId !== organizationId) throw new ForbiddenException("Unauthorized");

    // Validate and sanitize FAQs
    const sanitizedFaqs = faqs
      .filter(faq => faq.question?.trim() && faq.answer?.trim())
      .map((faq, idx) => ({
        id: faq.id || `faq-${Date.now()}-${idx}`,
        question: faq.question.trim(),
        answer: faq.answer.trim(),
        order: faq.order ?? idx
      }))
      .sort((a, b) => a.order - b.order);

    const updated = await this.prisma.campground.update({
      where: { id: campgroundId },
      data: { faqs: sanitizedFaqs },
    });

    return updated;
  }

  private async ensureExternalOrganization(organizationId?: string) {
    if (organizationId) return organizationId;
    if (process.env.EXTERNAL_ORG_ID) return process.env.EXTERNAL_ORG_ID;

    const existing = await this.prisma.organization.findFirst({
      where: { name: this.EXTERNAL_ORG_NAME }
    });
    if (existing) return existing.id;

    const org = await this.prisma.organization.create({
      data: { name: this.EXTERNAL_ORG_NAME }
    });
    return org.id;
  }

  private async findNearbyCampground(name?: string, latitude?: number | null, longitude?: number | null) {
    if (latitude === undefined || longitude === undefined || latitude === null || longitude === null) return null;
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    const delta = 0.1; // ~11km window
    const candidates = await this.prisma.campground.findMany({
      where: {
        latitude: { gte: lat - delta, lte: lat + delta },
        longitude: { gte: lon - delta, lte: lon + delta }
      },
      take: 10
    });

    if (!name) return candidates[0] || null;
    const scored = candidates
      .map((c) => ({
        campground: c,
        score: this.nameSimilarity(name, c.name)
      }))
      .sort((a, b) => b.score - a.score);
    return scored[0]?.score && scored[0].score >= 0.4 ? scored[0].campground : null;
  }

  listByOrganization(organizationId: string) {
    return this.prisma.campground.findMany({ where: { organizationId } });
  }

  listAll(orgId?: string) {
    if (orgId) {
      return this.prisma.campground.findMany({ where: { organizationId: orgId } });
    }
    return this.prisma.campground.findMany();
  }

  /**
   * List campgrounds by IDs (for membership-based filtering)
   * SECURITY: Used by controller to return only campgrounds the user has membership to
   */
  listByIds(ids: string[], orgId?: string) {
    const where: any = { id: { in: ids } };
    if (orgId) {
      where.organizationId = orgId;
    }
    return this.prisma.campground.findMany({ where });
  }

  // Public campgrounds (published only)
  async listPublic() {
    // Fetch campgrounds with historical awards
    const campgrounds = await this.prisma.campground.findMany({
      where: { OR: [{ isPublished: true }, { isExternal: true }] },
      select: {
        id: true,
        name: true,
        slug: true,
        city: true,
        state: true,
        country: true,
        tagline: true,
        heroImageUrl: true,
        amenities: true,
        photos: true,
        isExternal: true,
        isBookable: true,
        externalUrl: true,
        reviewScore: true,
        reviewCount: true,
        reviewSources: true,
        amenitySummary: true,
        CampgroundAward: {
          where: { awardType: "campground_of_year" },
          select: { year: true, npsScore: true },
          orderBy: { year: "desc" }
        }
      }
    });

    // Date ranges for NPS comparison
    const now = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

    // Fetch NPS responses for current period (last 6 months)
    const currentPeriodResponses = await this.prisma.npsResponse.findMany({
      where: {
        createdAt: { gte: sixMonthsAgo },
        campgroundId: { in: campgrounds.map(c => c.id) }
      },
      select: {
        campgroundId: true,
        score: true
      }
    });

    // Fetch NPS responses for previous period (6-12 months ago)
    const previousPeriodResponses = await this.prisma.npsResponse.findMany({
      where: {
        createdAt: { gte: twelveMonthsAgo, lt: sixMonthsAgo },
        campgroundId: { in: campgrounds.map(c => c.id) }
      },
      select: {
        campgroundId: true,
        score: true
      }
    });

    // Calculate NPS for current period
    const currentNps: Record<string, { score: number; responseCount: number }> = {};
    const currentByCampground: Record<string, number[]> = {};

    for (const response of currentPeriodResponses) {
      if (!currentByCampground[response.campgroundId]) {
        currentByCampground[response.campgroundId] = [];
      }
      currentByCampground[response.campgroundId].push(response.score);
    }

    for (const [campgroundId, scores] of Object.entries(currentByCampground)) {
      if (scores.length >= 5) {
        const promoters = scores.filter(s => s >= 9).length;
        const detractors = scores.filter(s => s <= 6).length;
        const nps = Math.round(((promoters - detractors) / scores.length) * 100);
        currentNps[campgroundId] = { score: nps, responseCount: scores.length };
      }
    }

    // Calculate NPS for previous period
    const previousNps: Record<string, number> = {};
    const previousByCampground: Record<string, number[]> = {};

    for (const response of previousPeriodResponses) {
      if (!previousByCampground[response.campgroundId]) {
        previousByCampground[response.campgroundId] = [];
      }
      previousByCampground[response.campgroundId].push(response.score);
    }

    for (const [campgroundId, scores] of Object.entries(previousByCampground)) {
      if (scores.length >= 5) {
        const promoters = scores.filter(s => s >= 9).length;
        const detractors = scores.filter(s => s <= 6).length;
        previousNps[campgroundId] = Math.round(((promoters - detractors) / scores.length) * 100);
      }
    }

    // Calculate NPS improvement (Rising Star candidates)
    const npsImprovements: { id: string; improvement: number; currentNps: number }[] = [];
    for (const [campgroundId, data] of Object.entries(currentNps)) {
      if (previousNps[campgroundId] !== undefined) {
        const improvement = data.score - previousNps[campgroundId];
        if (improvement > 0) {
          npsImprovements.push({ id: campgroundId, improvement, currentNps: data.score });
        }
      }
    }

    // Sort by improvement and get top improvers (Rising Stars)
    npsImprovements.sort((a, b) => b.improvement - a.improvement);
    const risingStars = new Set(
      npsImprovements
        .filter(item => item.improvement >= 10) // Must have improved by at least 10 points
        .slice(0, 5) // Top 5 improvers
        .map(item => item.id)
    );
    const risingStarData: Record<string, number> = {};
    for (const item of npsImprovements) {
      if (risingStars.has(item.id)) {
        risingStarData[item.id] = item.improvement;
      }
    }

    // Compute percentile rankings
    const npsScores = Object.entries(currentNps)
      .map(([id, data]) => ({ id, score: data.score }))
      .sort((a, b) => b.score - a.score);

    const totalWithNps = npsScores.length;
    const percentileRankings: Record<string, { rank: number; percentile: number; isTop1Percent: boolean; isTop5Percent: boolean; isTop10Percent: boolean; isTopCampground: boolean }> = {};

    npsScores.forEach((item, index) => {
      const rank = index + 1;
      const percentile = totalWithNps > 0 ? ((totalWithNps - rank + 1) / totalWithNps) * 100 : 0;
      percentileRankings[item.id] = {
        rank,
        percentile,
        isTopCampground: rank === 1,
        isTop1Percent: percentile >= 99,
        isTop5Percent: percentile >= 95,
        isTop10Percent: percentile >= 90
      };
    });

    // Combine data
    return campgrounds.map(cg => {
      const nps = currentNps[cg.id];
      const ranking = percentileRankings[cg.id];
      const isRisingStar = risingStars.has(cg.id);
      const npsImprovement = risingStarData[cg.id] ?? null;

      // Get past Campground of the Year awards
      const pastAwards = cg.CampgroundAward
        .filter(a => a.year < new Date().getFullYear())
        .map(a => ({ year: a.year, npsScore: a.npsScore }));

      return {
        ...cg,
        CampgroundAward: undefined, // Remove raw data
        npsScore: nps?.score ?? null,
        npsResponseCount: nps?.responseCount ?? 0,
        npsRank: ranking?.rank ?? null,
        npsPercentile: ranking?.percentile ?? null,
        npsImprovement,
        isWorldClassNps: nps && nps.score >= 70,
        isTopCampground: ranking?.isTopCampground ?? false,
        isTop1PercentNps: ranking?.isTop1Percent ?? false,
        isTop5PercentNps: ranking?.isTop5Percent ?? false,
        isTop10PercentNps: ranking?.isTop10Percent ?? false,
        isRisingStar,
        pastCampgroundOfYearAwards: pastAwards
      };
    });
  }

  findOne(id: string, orgId?: string) {
    return this.prisma.campground.findFirst({ where: { id, ...(orgId ? { organizationId: orgId } : {}) } });
  }

  async updateSlaMinutes(id: string, slaMinutes: number, orgId?: string) {
    if (slaMinutes < 1 || slaMinutes > 720) {
      throw new ConflictException("slaMinutes must be between 1 and 720");
    }
    await this.assertCampgroundScoped(id, orgId);
    return this.prisma.campground.update({
      where: { id },
      data: { slaMinutes } as any
    });
  }

  private async lookupTxt(domain: string): Promise<string[]> {
    try {
      const txt = await dns.resolveTxt(domain);
      return txt.flat();
    } catch (err) {
      return [];
    }
  }

  private evaluateSpf(txtRecords: string[]) {
    const spf = txtRecords.find((t) => t.toLowerCase().startsWith("v=spf1"));
    if (!spf) return { status: "fail", record: null };
    if (spf.includes("-all") || spf.includes("~all") || spf.includes("?all") || spf.includes("+all")) {
      return { status: "pass", record: spf };
    }
    return { status: "unknown", record: spf };
  }

  private evaluateDmarc(txtRecords: string[]) {
    const rec = txtRecords.find((t) => t.toLowerCase().startsWith("v=dmarc1"));
    if (!rec) return { status: "fail", record: null };
    return { status: "pass", record: rec };
  }

  async verifySenderDomain(id: string, domain: string, orgId?: string) {
    await this.assertCampgroundScoped(id, orgId);
    const normalized = domain.trim().toLowerCase();
    const spfTxt = await this.lookupTxt(normalized);
    const dmarcTxt = await this.lookupTxt(`_dmarc.${normalized}`);

    const spf = this.evaluateSpf(spfTxt);
    const dmarc = this.evaluateDmarc(dmarcTxt);
    const status = spf.status === "pass" && dmarc.status === "pass" ? "verified" : "failed";

    const updated = await this.prisma.campground.update({
      where: { id },
      data: {
        senderDomain: normalized,
        senderDomainStatus: status,
        senderDomainCheckedAt: new Date(),
        senderDomainSpf: spf.record,
        senderDomainDmarc: dmarc.record
      }
    });

    return {
      status,
      spf,
      dmarc,
      checkedAt: updated.senderDomainCheckedAt
    };
  }

  async updateOpsSettings(
    id: string,
    data: { quietHoursStart?: string | null; quietHoursEnd?: string | null; routingAssigneeId?: string | null; officeClosesAt?: string | null },
    orgId?: string
  ) {
    await this.assertCampgroundScoped(id, orgId);
    return this.prisma.campground.update({
      where: { id },
      data: {
        quietHoursStart: data.quietHoursStart ?? null,
        quietHoursEnd: data.quietHoursEnd ?? null,
        routingAssigneeId: data.routingAssigneeId ?? null,
        officeClosesAt: data.officeClosesAt ?? undefined
      }
    });
  }

  async updateStoreHours(id: string, open?: number, close?: number, orgId?: string) {
    if (open !== undefined && (open < 0 || open > 23)) {
      throw new ConflictException("storeOpenHour must be between 0 and 23");
    }
    if (close !== undefined && (close < 0 || close > 23)) {
      throw new ConflictException("storeCloseHour must be between 0 and 23");
    }
    if (open !== undefined && close !== undefined && open >= close) {
      throw new ConflictException("storeOpenHour must be before storeCloseHour");
    }

    const cg = await this.findOne(id, orgId);
    if (!cg) throw new NotFoundException("Campground not found");

    return this.prisma.campground.update({
      where: { id },
      data: {
        ...(open !== undefined ? { storeOpenHour: open } : {}),
        ...(close !== undefined ? { storeCloseHour: close } : {})
      }
    });
  }

  async updateOrderWebhook(id: string, orderWebhookUrl?: string, orgId?: string) {
    const cg = await this.findOne(id, orgId);
    if (!cg) throw new NotFoundException("Campground not found");
    return this.prisma.campground.update({
      where: { id },
      data: { orderWebhookUrl: orderWebhookUrl || null }
    });
  }

  async updateAnalytics(
    id: string,
    data: { gaMeasurementId?: string | null; metaPixelId?: string | null },
    orgId?: string
  ) {
    const cg = await this.findOne(id, orgId);
    if (!cg) throw new NotFoundException("Campground not found");
    return this.prisma.campground.update({
      where: { id },
      data: {
        gaMeasurementId: data.gaMeasurementId ?? null,
        metaPixelId: data.metaPixelId ?? null
      }
    });
  }

  async updateNpsSettings(
    id: string,
    data: { npsAutoSendEnabled?: boolean; npsSendHour?: number | null; npsTemplateId?: string | null; npsSchedule?: any },
    orgId?: string
  ) {
    const cg = await this.findOne(id, orgId);
    if (!cg) throw new NotFoundException("Campground not found");
    if (data.npsSendHour !== undefined && data.npsSendHour !== null) {
      if (data.npsSendHour < 0 || data.npsSendHour > 23) {
        throw new BadRequestException("npsSendHour must be between 0 and 23");
      }
    }
    return this.prisma.campground.update({
      where: { id },
      data: {
        ...(data.npsAutoSendEnabled !== undefined ? { npsAutoSendEnabled: data.npsAutoSendEnabled } : {}),
        ...(data.npsSendHour !== undefined ? { npsSendHour: data.npsSendHour } : {}),
        ...(data.npsTemplateId !== undefined ? { npsTemplateId: data.npsTemplateId } : {}),
        ...(data.npsSchedule !== undefined ? { npsSchedule: data.npsSchedule } : {})
      }
    });
  }

  async updateSmsSettings(
    id: string,
    data: {
      smsEnabled?: boolean;
      twilioAccountSid?: string | null;
      twilioAuthToken?: string | null;
      twilioFromNumber?: string | null;
      smsWelcomeMessage?: string | null;
    },
    orgId?: string
  ) {
    const cg = await this.findOne(id, orgId);
    if (!cg) throw new NotFoundException("Campground not found");

    return this.prisma.campground.update({
      where: { id },
      data: {
        ...(data.smsEnabled !== undefined ? { smsEnabled: data.smsEnabled } : {}),
        ...(data.twilioAccountSid !== undefined ? { twilioAccountSid: data.twilioAccountSid } : {}),
        ...(data.twilioAuthToken !== undefined ? { twilioAuthToken: data.twilioAuthToken } : {}),
        ...(data.twilioFromNumber !== undefined ? { twilioFromNumber: data.twilioFromNumber } : {}),
        ...(data.smsWelcomeMessage !== undefined ? { smsWelcomeMessage: data.smsWelcomeMessage } : {}),
      },
      select: {
        id: true,
        smsEnabled: true,
        twilioAccountSid: true,
        // Don't return the auth token for security
        twilioFromNumber: true,
        smsWelcomeMessage: true,
      }
    });
  }

  async getSmsSettings(id: string, orgId?: string) {
    const cg = await this.findOne(id, orgId);
    if (!cg) throw new NotFoundException("Campground not found");

    const campground = await this.prisma.campground.findUnique({
      where: { id },
      select: {
        id: true,
        smsEnabled: true,
        twilioAccountSid: true,
        twilioFromNumber: true,
        smsWelcomeMessage: true,
        // Include whether auth token is set (but not the token itself)
        twilioAuthToken: true,
      }
    });

    return {
      ...campground,
      // Mask the auth token - just indicate if it's set
      twilioAuthTokenSet: !!campground?.twilioAuthToken,
      twilioAuthToken: undefined,
    };
  }

  // Find by slug with full public details including events and site classes
  async findBySlug(slug: string) {
    const campground = await this.prisma.campground.findUnique({
      where: { slug },
      include: {
        siteClasses: {
          where: { isActive: true },
          orderBy: { defaultRate: "asc" }
        },
        events: {
          where: {
            isPublished: true,
            isCancelled: false,
            startDate: { gte: new Date() }
          },
          orderBy: { startDate: "asc" },
          take: 10
        },
        promotions: {
          where: { isActive: true },
          orderBy: { createdAt: "desc" }
        }
      }
    });
    return campground;
  }

  async findPublicSite(slug: string, code: string) {
    const campground = await this.prisma.campground.findUnique({
      where: { slug },
      select: { id: true }
    });
    if (!campground) return null;

    const site = await this.prisma.site.findFirst({
      where: {
        campgroundId: campground.id,
        name: { equals: code, mode: "insensitive" } // Flexible matching
      },
      include: {
        siteClass: true
      }
    });

    if (!site) return null;

    const now = new Date();
    const activeReservation = await this.prisma.reservation.findFirst({
      where: {
        siteId: site.id,
        status: { not: "canceled" }, // Assuming string based status or enum mapping
        arrivalDate: { lte: now },
        departureDate: { gt: now }
      },
      select: { id: true, status: true, arrivalDate: true, departureDate: true, guestId: true }
    });

    return {
      site,
      status: activeReservation ? "occupied" : "available",
      currentReservation: activeReservation
    };
  }

  create(data: CreateCampgroundDto) {
    const {
      taxState,
      taxLocal,
      seasonStart,
      seasonEnd,
      dataSourceUpdatedAt,
      amenities,
      photos,
      reviewScore,
      reviewCount,
      ...rest
    } = data as any;
    return this.prisma.campground.create({
      data: {
        ...rest,
        taxState: taxState ? Number(taxState) : null,
        taxLocal: taxLocal ? Number(taxLocal) : null,
        seasonStart: seasonStart ? new Date(seasonStart) : null,
        seasonEnd: seasonEnd ? new Date(seasonEnd) : null,
        dataSourceUpdatedAt: dataSourceUpdatedAt ? new Date(dataSourceUpdatedAt) : null,
        amenities: amenities ?? [],
        photos: photos ?? [],
        isBookable: rest?.isBookable ?? true,
        isExternal: rest?.isExternal ?? false,
        externalUrl: rest?.externalUrl ?? null,
        nonBookableReason: rest?.nonBookableReason ?? null,
        reviewScore: reviewScore !== undefined ? Number(reviewScore) : null,
        reviewCount: reviewCount !== undefined ? Number(reviewCount) : 0
      }
    });
  }

  async upsertExternalCampground(payload: ExternalCampgroundUpsertDto) {
    const organizationId = await this.ensureExternalOrganization(payload.organizationId);
    const dataSourceKey =
      payload.dataSource && payload.dataSourceId
        ? { dataSource: payload.dataSource, dataSourceId: payload.dataSourceId }
        : null;

    let existing = dataSourceKey
      ? await this.prisma.campground.findFirst({ where: dataSourceKey })
      : null;

    if (!existing) {
      existing = await this.findNearbyCampground(payload.name, payload.latitude, payload.longitude);
    }

    const slug = payload.slug || existing?.slug || this.slugifyName(payload.name);
    const amenitySummaryRaw = payload.amenitySummary ?? existing?.amenitySummary;
    const amenitySummary =
      amenitySummaryRaw === null || amenitySummaryRaw === undefined
        ? undefined
        : (amenitySummaryRaw as any);

    const reviewSourcesRaw = payload.reviewSources ?? existing?.reviewSources;
    const reviewSources =
      reviewSourcesRaw === null || reviewSourcesRaw === undefined
        ? undefined
        : (reviewSourcesRaw as any);
    const now = new Date();
    const blended = this.computeBlendedReviewScore(
      payload.reviewSources as any,
      (payload.reviewScore ?? existing?.reviewScore) as any
    );

    const photosMetaRaw = payload.photosMeta ?? existing?.photosMeta;
    const photosMeta =
      photosMetaRaw === null || photosMetaRaw === undefined
        ? undefined
        : Array.isArray(photosMetaRaw)
          ? (photosMetaRaw as any)
          : (photosMetaRaw as any);

    const data = {
      organizationId,
      name: payload.name,
      slug,
      city: payload.city ?? existing?.city,
      state: payload.state ?? existing?.state,
      country: payload.country ?? existing?.country,
      address1: payload.address1 ?? existing?.address1,
      address2: payload.address2 ?? existing?.address2,
      postalCode: payload.postalCode ?? existing?.postalCode,
      latitude: payload.latitude ?? existing?.latitude,
      longitude: payload.longitude ?? existing?.longitude,
      timezone: payload.timezone ?? existing?.timezone,
      phone: payload.phone ?? existing?.phone,
      email: payload.email ?? existing?.email,
      website: payload.website ?? existing?.website,
      externalUrl: payload.externalUrl ?? payload.website ?? existing?.externalUrl,
      isExternal: true,
      isBookable: payload.isBookable ?? false,
      nonBookableReason: payload.nonBookableReason ?? existing?.nonBookableReason ?? "View-only listing",
      isPublished: payload.isPublished ?? true,
      dataSource: payload.dataSource ?? existing?.dataSource ?? "osm",
      dataSourceId: payload.dataSourceId ?? existing?.dataSourceId,
      dataSourceUpdatedAt: payload.dataSourceUpdatedAt
        ? new Date(payload.dataSourceUpdatedAt)
        : existing?.dataSourceUpdatedAt,
      amenities: payload.amenities ?? existing?.amenities ?? [],
      amenitySummary,
      photos: payload.photos ?? existing?.photos ?? [],
      photosMeta,
      reviewScore: blended.score ?? null,
      reviewCount: payload.reviewCount ?? blended.count ?? existing?.reviewCount ?? 0,
      reviewSources,
      reviewsUpdatedAt: payload.reviewsUpdatedAt
        ? new Date(payload.reviewsUpdatedAt)
        : existing?.reviewsUpdatedAt,
      importedAt: payload.dataSourceUpdatedAt
        ? new Date(payload.dataSourceUpdatedAt)
        : existing?.importedAt ?? now,
      provenance: {
        ...(existing?.provenance as any),
        lastIngestSource: payload.dataSource ?? existing?.dataSource ?? "osm",
        lastIngestedAt: now.toISOString()
      }
    };

    if (existing) {
      return this.prisma.campground.update({
        where: { id: existing.id },
        data
      });
    }

    return this.prisma.campground.create({
      data
    });
  }

  async ingestFromOsm(options: OsmIngestRequestDto = {}) {
    const bbox =
      options.bbox ||
      // Broad North America box (lat, lon)
      "14.0,-171.0,83.0,-52.0";

    const query = `
      [out:json][timeout:180];
      (
        node["tourism"="camp_site"](${bbox});
        way["tourism"="camp_site"](${bbox});
        relation["tourism"="camp_site"](${bbox});
      );
      out center;
    `;

    const res = await (globalThis as any).fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: query
    });

    if (!res.ok) {
      throw new ConflictException("Failed to pull OSM data");
    }

    const json = await res.json();
    const elements: any[] = Array.isArray(json?.elements) ? json.elements : [];
    const limited = options.limit ? elements.slice(0, options.limit) : elements;

    let upserted = 0;
    for (const el of limited) {
      const tags = el.tags || {};
      const center = el.center || (el.type === "node" ? { lat: el.lat, lon: el.lon } : null);
      if (!center) continue;

      await this.upsertExternalCampground({
        name: tags.name || tags.ref || `Campground ${el.id}`,
        slug: tags.slug,
        latitude: center.lat,
        longitude: center.lon,
        city: tags["addr:city"],
        state: tags["addr:state"] || tags["addr:province"],
        country: tags["addr:country"],
        postalCode: tags["addr:postcode"],
        website: tags.website || tags.url,
        externalUrl: tags.website || tags.url,
        phone: tags.phone,
        amenities: this.extractAmenitiesFromTags(tags),
        amenitySummary: this.amenitySummaryFromTags(tags),
        photos: tags.image ? [tags.image] : undefined,
        dataSource: "osm",
        dataSourceId: `${el.type}:${el.id}`,
        dataSourceUpdatedAt: tags["source:date"],
        isBookable: false,
        isPublished: true
      });
      upserted++;
    }

    return { processed: limited.length, upserted };
  }

  async getExternalIngestStatus() {
    const [totals, published, bookable, freshest, sources] = await Promise.all([
      this.prisma.campground.count({ where: { isExternal: true } }),
      this.prisma.campground.count({ where: { isExternal: true, isPublished: true } }),
      this.prisma.campground.count({ where: { isExternal: true, isBookable: true } }),
      this.prisma.campground.findFirst({
        where: { isExternal: true },
        orderBy: [{ importedAt: "desc" }, { dataSourceUpdatedAt: "desc" }],
        select: { importedAt: true, dataSourceUpdatedAt: true }
      }),
      this.prisma.campground.groupBy({
        by: ["dataSource"],
        where: { isExternal: true },
        _count: { _all: true }
      })
    ]);

    return {
      externalTotal: totals,
      externalPublished: published,
      externalBookable: bookable,
      lastImportedAt: freshest?.importedAt ?? null,
      lastSourceUpdatedAt: freshest?.dataSourceUpdatedAt ?? null,
      sources: sources.map((s) => ({ source: s.dataSource ?? "unknown", count: s._count._all }))
    };
  }

  async remove(id: string) {
    return this.prisma.campground.delete({ where: { id } });
  }

  async updateDepositRule(id: string, depositRule: string, depositPercentage?: number | null, depositConfig?: any) {
    return this.prisma.campground.update({
      where: { id },
      data: {
        depositRule,
        depositPercentage: depositPercentage ?? null,
        depositConfig: depositConfig ?? null
      }
    });
  }

  async updateBranding(
    id: string,
    data: {
      logoUrl?: string | null;
      primaryColor?: string | null;
      accentColor?: string | null;
      secondaryColor?: string | null;
      buttonColor?: string | null;
      brandFont?: string | null;
      emailHeader?: string | null;
      receiptFooter?: string | null;
      brandingNote?: string | null;
    },
    organizationId?: string
  ) {
    await this.assertCampgroundScoped(id, organizationId);
    return this.prisma.campground.update({
      where: { id },
      data: {
        logoUrl: data.logoUrl ?? null,
        primaryColor: data.primaryColor ?? null,
        accentColor: data.accentColor ?? null,
        secondaryColor: data.secondaryColor ?? null,
        buttonColor: data.buttonColor ?? null,
        brandFont: data.brandFont ?? null,
        emailHeader: data.emailHeader ?? null,
        receiptFooter: data.receiptFooter ?? null,
        brandingNote: data.brandingNote ?? null
      }
    });
  }

  async updatePolicies(
    id: string,
    data: {
      cancellationPolicyType?: string | null;
      cancellationWindowHours?: number | null;
      cancellationFeeType?: string | null;
      cancellationFeeFlatCents?: number | null;
      cancellationFeePercent?: number | null;
      cancellationNotes?: string | null;
    },
    organizationId?: string
  ) {
    await this.assertCampgroundScoped(id, organizationId);
    return this.prisma.campground.update({
      where: { id },
      data: {
        cancellationPolicyType: data.cancellationPolicyType ?? null,
        cancellationWindowHours: data.cancellationWindowHours ?? null,
        cancellationFeeType: data.cancellationFeeType ?? null,
        cancellationFeeFlatCents: data.cancellationFeeFlatCents ?? null,
        cancellationFeePercent: data.cancellationFeePercent ?? null,
        cancellationNotes: data.cancellationNotes ?? null
      }
    });
  }

  async updateFinancials(
    id: string,
    data: {
      currency?: string | null;
      taxId?: string | null;
      taxIdName?: string | null;
      taxState?: number | null;
      taxLocal?: number | null;
    },
    organizationId?: string
  ) {
    await this.assertCampgroundScoped(id, organizationId);
    return this.prisma.campground.update({
      where: { id },
      data: {
        currency: data.currency ?? "USD",
        taxId: data.taxId ?? null,
        taxIdName: data.taxIdName ?? "Tax ID",
        taxState: data.taxState ?? null,
        taxLocal: data.taxLocal ?? null
      }
    });
  }

  async getMembers(id: string) {
    const memberships = await this.prisma.campgroundMembership.findMany({
      where: { campgroundId: id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, isActive: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    const userIds = memberships.map((m) => m.userId);
    const invites = await this.prisma.inviteToken.findMany({
      where: { campgroundId: id, userId: { in: userIds } },
      orderBy: { createdAt: "desc" }
    });
    const latestInviteByUser: Record<string, any> = {};
    for (const inv of invites) {
      if (!latestInviteByUser[inv.userId]) {
        latestInviteByUser[inv.userId] = inv;
      }
    }

    return memberships.map((m) => {
      const invite = latestInviteByUser[m.userId];
      return {
        id: m.id,
        role: m.role,
        user: m.user,
        createdAt: m.createdAt,
        lastInviteSentAt: invite?.createdAt ?? null,
        lastInviteRedeemedAt: invite?.redeemedAt ?? null,
        inviteExpiresAt: invite?.expiresAt ?? null
      };
    });
  }

  private async assertAnotherOwner(campgroundId: string, excludeMembershipId?: string) {
    const ownerCount = await this.prisma.campgroundMembership.count({
      where: {
        campgroundId,
        role: UserRole.owner,
        ...(excludeMembershipId ? { id: { not: excludeMembershipId } } : {})
      }
    });
    if (ownerCount <= 0) {
      throw new ConflictException("At least one owner is required");
    }
  }

  private generateInviteToken() {
    return randomBytes(20).toString("hex");
  }

  private inviteExpiresAt() {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d;
  }

  private async assertCampgroundScoped(campgroundId: string, organizationId?: string | null) {
    if (!organizationId) return;
    const found = await this.prisma.campground.findFirst({
      where: { id: campgroundId, organizationId }
    });
    if (!found) {
      throw new ForbiddenException("Campground not found in your organization");
    }
  }

  async addMember(
    campgroundId: string,
    data: { email: string; firstName?: string; lastName?: string; role: UserRole },
    actorId?: string
  ) {
    const email = data.email.toLowerCase().trim();
    const existingUser = await this.prisma.user.findUnique({ where: { email } });

    let userId = existingUser?.id;

    if (!existingUser) {
      const passwordHash = await bcrypt.hash(Math.random().toString(36), 12);
      const user = await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName: data.firstName || "Pending",
          lastName: data.lastName || "User",
          isActive: true
        }
      });
      userId = user.id;
    }

    if (!userId) {
      throw new ConflictException("Failed to create user for membership");
    }
    const ensuredUserId = userId;

    const existingMembership = await this.prisma.campgroundMembership.findUnique({
      where: {
        userId_campgroundId: {
          userId: ensuredUserId,
          campgroundId
        }
      }
    });

    if (existingMembership) {
      throw new ConflictException("User already a member of this campground");
    }

    const membership = await this.prisma.campgroundMembership.create({
      data: { userId: ensuredUserId, campgroundId, role: data.role }
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, email: true, isActive: true }
    });

    // Create invite token for newly added users or inactive users
    let inviteToken: string | null = null;
    if (user && (!user.isActive || existingUser == null)) {
      inviteToken = this.generateInviteToken();
      await this.prisma.inviteToken.create({
        data: {
          token: inviteToken,
          userId,
          campgroundId,
          expiresAt: this.inviteExpiresAt()
        }
      });
    }

    // Fire-and-forget invite email
    if (user?.email) {
      const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || "there";
      const roleLabel = data.role.replace("_", " ");
      const baseUrl = process.env.FRONTEND_URL || "https://app.campreserv.com";
      const inviteUrl = inviteToken ? `${baseUrl}/invite?token=${inviteToken}` : `${baseUrl}/login`;
      this.emailService.sendEmail({
        to: user.email,
        subject: `You've been added to a campground as ${roleLabel}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #0f172a; margin-bottom: 12px;">Welcome, ${name}!</h2>
            <p style="color: #475569; line-height: 1.5;">
              You've been granted <strong>${roleLabel}</strong> access to a campground in Keepr Host.
            </p>
            <p style="color: #475569; line-height: 1.5;">
              Sign in with your email. ${inviteToken ? "Use the button below to set your password." : "If you don't have a password yet, use the reset link on the login page to set one."}
            </p>
            <div style="margin: 24px 0;">
              <a href="${inviteUrl}" style="display: inline-block; padding: 12px 18px; background: #0ea5e9; color: white; border-radius: 10px; text-decoration: none; font-weight: 600;">
                ${inviteToken ? "Accept invite" : "Go to app"}
              </a>
            </div>
            <div style="margin-top: 20px; padding: 16px; background: #ecfeff; border: 1px solid #cffafe; border-radius: 10px; color: #0ea5e9;">
              Tip: Save this email for your records.
            </div>
          </div>
        `
      }).catch((err) => {
        // best-effort email; don't block - but log for debugging
        this.logger.warn(`Failed to send invite email: ${err instanceof Error ? err.message : err}`);
      });
    }

    const result = {
      id: membership.id,
      role: membership.role,
      createdAt: membership.createdAt,
      user
    };

    // Audit
    await this.audit.record({
      campgroundId,
      actorId: actorId ?? null,
      action: "member.added",
      entity: "campground_membership",
      entityId: membership.id,
      after: { role: membership.role, userId: ensuredUserId }
    });

    return result;
  }

  async resendInvite(campgroundId: string, membershipId: string, actorId?: string) {
    const membership = await this.prisma.campgroundMembership.findFirst({
      where: { id: membershipId, campgroundId },
      include: { user: true }
    });
    if (!membership) {
      throw new NotFoundException("Membership not found");
    }
    // Rate-limit resends
    const latestInvite = await this.prisma.inviteToken.findFirst({
      where: { campgroundId, userId: membership.userId },
      orderBy: { createdAt: "desc" }
    });
    const now = Date.now();
    if (latestInvite && !latestInvite.redeemedAt) {
      const createdMs = new Date(latestInvite.createdAt).getTime();
      if (now - createdMs < this.INVITE_RESEND_COOLDOWN_MS) {
        const waitMs = this.INVITE_RESEND_COOLDOWN_MS - (now - createdMs);
        const waitMinutes = Math.ceil(waitMs / 60000);
        throw new ConflictException(`Please wait ${waitMinutes} minute(s) before resending another invite`);
      }
    }

    const token = this.generateInviteToken();
    await this.prisma.inviteToken.create({
      data: {
        token,
        userId: membership.userId,
        campgroundId,
        expiresAt: this.inviteExpiresAt()
      }
    });

    const baseUrl = process.env.FRONTEND_URL || "https://app.campreserv.com";
    const inviteUrl = `${baseUrl}/invite?token=${token}`;
    this.emailService.sendEmail({
      to: membership.user.email,
      subject: "Your Keepr Host invite",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #0f172a; margin-bottom: 12px;">You're invited</h2>
          <p style="color: #475569; line-height: 1.5;">Use the button below to set your password and access the campground.</p>
          <div style="margin: 24px 0;">
            <a href="${inviteUrl}" style="display: inline-block; padding: 12px 18px; background: #0ea5e9; color: white; border-radius: 10px; text-decoration: none; font-weight: 600;">
              Accept invite
            </a>
          </div>
        </div>
      `
    }).catch((err) => this.logger.warn(`Failed to send invite email: ${err instanceof Error ? err.message : err}`));

    await this.audit.record({
      campgroundId,
      actorId: actorId ?? null,
      action: "member.invite_resent",
      entity: "campground_membership",
      entityId: membershipId,
      after: { userId: membership.userId }
    });

    return { ok: true };
  }

  async updateMemberRole(campgroundId: string, membershipId: string, role: UserRole, actorId?: string) {
    const membership = await this.prisma.campgroundMembership.findFirst({
      where: { id: membershipId, campgroundId }
    });
    if (!membership) {
      throw new NotFoundException("Membership not found");
    }

    if (actorId && membership.userId === actorId && membership.role === UserRole.owner && role !== UserRole.owner) {
      throw new ConflictException("You cannot demote yourself as the last owner");
    }

    if (membership.role === UserRole.owner && role !== UserRole.owner) {
      await this.assertAnotherOwner(campgroundId, membershipId);
    }

    const updated = await this.prisma.campgroundMembership.update({
      where: { id: membershipId },
      data: { role }
    });

    await this.audit.record({
      campgroundId,
      actorId: actorId ?? null,
      action: "member.role_changed",
      entity: "campground_membership",
      entityId: membershipId,
      before: { role: membership.role },
      after: { role }
    });

    return updated;
  }

  async removeMember(campgroundId: string, membershipId: string, actorId?: string) {
    const membership = await this.prisma.campgroundMembership.findFirst({
      where: { id: membershipId, campgroundId }
    });
    if (!membership) {
      throw new NotFoundException("Membership not found");
    }

    if (actorId && membership.userId === actorId && membership.role === UserRole.owner) {
      throw new ConflictException("You cannot remove yourself as the last owner");
    }

    if (membership.role === UserRole.owner) {
      await this.assertAnotherOwner(campgroundId, membershipId);
    }

    const deleted = await this.prisma.campgroundMembership.delete({ where: { id: membershipId } });

    await this.audit.record({
      campgroundId,
      actorId: actorId ?? null,
      action: "member.removed",
      entity: "campground_membership",
      entityId: membershipId,
      before: { role: membership.role, userId: membership.userId }
    });

    return deleted;
  }

  async updateAccessibilitySettings(
    id: string,
    data: {
      adaAssessment?: any;
      adaCertificationLevel?: string;
      adaAccessibleSiteCount?: number;
      adaTotalSiteCount?: number;
      adaAssessmentUpdatedAt?: string;
      adaVerified?: boolean;
      adaVerifiedAt?: string | null;
      adaVerifiedBy?: string | null;
    },
    organizationId?: string
  ) {
    await this.assertCampgroundScoped(id, organizationId);
    return this.prisma.campground.update({
      where: { id },
      data: {
        adaAssessment: data.adaAssessment ?? undefined,
        adaCertificationLevel: data.adaCertificationLevel ?? undefined,
        adaAccessibleSiteCount: data.adaAccessibleSiteCount ?? undefined,
        adaTotalSiteCount: data.adaTotalSiteCount ?? undefined,
        adaAssessmentUpdatedAt: data.adaAssessmentUpdatedAt ? new Date(data.adaAssessmentUpdatedAt) : undefined,
        adaVerified: data.adaVerified ?? undefined,
        adaVerifiedAt: data.adaVerifiedAt ? new Date(data.adaVerifiedAt) : undefined,
        adaVerifiedBy: data.adaVerifiedBy ?? undefined,
      }
    });
  }

  async updateSecuritySettings(
    id: string,
    data: {
      securityAssessment?: any;
      securityCertificationLevel?: string;
      securityAssessmentUpdatedAt?: string;
      securityVerified?: boolean;
      securityVerifiedAt?: string | null;
      securityVerifiedBy?: string | null;
      securityAuditorEmail?: string | null;
      securityAuditorOrg?: string | null;
    },
    organizationId?: string
  ) {
    await this.assertCampgroundScoped(id, organizationId);
    return this.prisma.campground.update({
      where: { id },
      data: {
        securityAssessment: data.securityAssessment ?? undefined,
        securityCertificationLevel: data.securityCertificationLevel ?? undefined,
        securityAssessmentUpdatedAt: data.securityAssessmentUpdatedAt ? new Date(data.securityAssessmentUpdatedAt) : undefined,
        securityVerified: data.securityVerified ?? undefined,
        securityVerifiedAt: data.securityVerifiedAt ? new Date(data.securityVerifiedAt) : undefined,
        securityVerifiedBy: data.securityVerifiedBy ?? undefined,
        securityAuditorEmail: data.securityAuditorEmail ?? undefined,
        securityAuditorOrg: data.securityAuditorOrg ?? undefined,
      }
    });
  }
}

