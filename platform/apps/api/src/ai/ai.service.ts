import { Injectable, BadRequestException, ForbiddenException, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { GenerateAiSuggestionsDto } from "./dto/generate-ai-suggestions.dto";
import { UpdateAiSettingsDto } from "./dto/update-ai-settings.dto";
import { AnalyticsEventName } from "@prisma/client";
import fetch from "node-fetch";
import { AskDto } from "./dto/ask.dto";
import { RecommendDto } from "./dto/recommend.dto";
import { PricingSuggestDto } from "./dto/pricing-suggest.dto";
import { SemanticSearchDto } from "./dto/semantic-search.dto";
import { CopilotActionDto } from "./dto/copilot-action.dto";
import { AiDynamicPricingService } from "./ai-dynamic-pricing.service";
import { AiRevenueManagerService } from "./ai-revenue-manager.service";
import { AiWeatherService } from "./ai-weather.service";
import { AiPredictiveMaintenanceService } from "./ai-predictive-maintenance.service";
import { AiDashboardService } from "./ai-dashboard.service";
import { PromptSanitizerService } from "./prompt-sanitizer.service";
import { PiiEncryptionService } from "../security/pii-encryption.service";
import { AiPrivacyService } from "./ai-privacy.service";

type OpenAiUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

type SearchableItemType = "guest" | "site" | "message";

type SearchableItem = {
  type: SearchableItemType;
  id: string;
  title: string;
  content: string;
};

type SearchMatch = {
  id: string;
  type: SearchableItemType;
  score: number;
  reason?: string;
};

type PricingFactor = {
  label: string;
  value: string;
  weight: number;
};

type PricingSuggestion = {
  suggestedRateCents?: number;
  upliftPercent?: number;
  reasoning?: string;
  factors?: PricingFactor[];
  confidence?: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isSearchableItemType = (value: unknown): value is SearchableItemType =>
  value === "guest" || value === "site" || value === "message";

const toStringValue = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const toNumberValue = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const toPayloadRecord = (value: unknown): Record<string, unknown> => (isRecord(value) ? value : {});

const parseOpenAiUsage = (value: unknown): OpenAiUsage => {
  if (!isRecord(value)) return {};
  const usage = value.usage;
  if (!isRecord(usage)) return {};
  return {
    prompt_tokens: typeof usage.prompt_tokens === "number" ? usage.prompt_tokens : undefined,
    completion_tokens:
      typeof usage.completion_tokens === "number" ? usage.completion_tokens : undefined,
    total_tokens: typeof usage.total_tokens === "number" ? usage.total_tokens : undefined,
  };
};

const parseOpenAiContent = (value: unknown): string => {
  if (!isRecord(value)) return "";
  const choices = value.choices;
  if (!Array.isArray(choices) || choices.length === 0) return "";
  const first = choices[0];
  if (!isRecord(first)) return "";
  const message = first.message;
  if (!isRecord(message)) return "";
  return typeof message.content === "string" ? message.content : "";
};

const parseSearchMatches = (value: unknown): SearchMatch[] => {
  if (!Array.isArray(value)) return [];
  const matches: SearchMatch[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const { id, type, score, reason } = entry;
    if (typeof id !== "string" || !isSearchableItemType(type) || typeof score !== "number") {
      continue;
    }
    if (typeof reason !== "undefined" && typeof reason !== "string") {
      continue;
    }
    matches.push({ id, type, score, reason: typeof reason === "string" ? reason : undefined });
  }
  return matches;
};

const parsePricingSuggestion = (value: unknown): PricingSuggestion | null => {
  if (!isRecord(value)) return null;
  const suggestion: PricingSuggestion = {};
  if (typeof value.suggestedRateCents === "number") {
    suggestion.suggestedRateCents = value.suggestedRateCents;
  }
  if (typeof value.upliftPercent === "number") {
    suggestion.upliftPercent = value.upliftPercent;
  }
  if (typeof value.reasoning === "string") {
    suggestion.reasoning = value.reasoning;
  }
  if (typeof value.confidence === "number") {
    suggestion.confidence = value.confidence;
  }
  if (Array.isArray(value.factors)) {
    const factors: PricingFactor[] = [];
    for (const factor of value.factors) {
      if (!isRecord(factor)) continue;
      const { label, value: factorValue, weight } = factor;
      if (
        typeof label === "string" &&
        typeof factorValue === "string" &&
        typeof weight === "number"
      ) {
        factors.push({ label, value: factorValue, weight });
      }
    }
    if (factors.length > 0) {
      suggestion.factors = factors;
    }
  }
  return suggestion;
};

const nonEmpty = (value: string): boolean => value.length > 0;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dynamicPricingService: AiDynamicPricingService,
    private readonly revenueService: AiRevenueManagerService,
    private readonly weatherService: AiWeatherService,
    private readonly maintenanceService: AiPredictiveMaintenanceService,
    private readonly dashboardService: AiDashboardService,
    private readonly promptSanitizer: PromptSanitizerService,
    private readonly piiEncryption: PiiEncryptionService,
    private readonly aiPrivacy: AiPrivacyService,
  ) {}

  /**
   * Decrypt API key from database
   */
  private decryptApiKey(encryptedKey: string | null | undefined): string | null {
    if (!encryptedKey) return null;
    return this.piiEncryption.decrypt(encryptedKey);
  }

  /**
   * Get API key for a campground (decrypted if stored encrypted)
   */
  private getApiKey(campground: { aiApiKey?: string | null }): string | null {
    const encryptedKey = campground?.aiApiKey;
    const decryptedKey = this.decryptApiKey(encryptedKey);
    return decryptedKey || process.env.OPENAI_API_KEY || null;
  }

  private async shouldUseMock(campgroundId?: string, forceMock?: boolean) {
    if (forceMock) return true;
    if (!campgroundId) return true;
    const cg = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { aiEnabled: true, aiApiKey: true },
    });
    if (!cg) return true;
    if (!cg.aiEnabled) return true;
    // SECURITY: Decrypt and check API key
    const apiKey = this.getApiKey(cg);
    if (!apiKey) return true;
    return false;
  }

  async updateSettings(campgroundId: string, dto: UpdateAiSettingsDto) {
    const cg = await this.prisma.campground.findUnique({ where: { id: campgroundId } });
    if (!cg) throw new BadRequestException("Campground not found");

    // SECURITY: Encrypt API key before storing
    const newApiKey = dto.openaiApiKey ? this.piiEncryption.encrypt(dto.openaiApiKey) : cg.aiApiKey;

    await this.prisma.campground.update({
      where: { id: campgroundId },
      data: {
        aiEnabled: dto.enabled,
        aiApiKey: newApiKey,
      },
    });
    return { ok: true, enabled: dto.enabled, hasKey: !!newApiKey };
  }

  async generate(dto: GenerateAiSuggestionsDto) {
    const cg = await this.prisma.campground.findUnique({
      where: { id: dto.campgroundId },
      select: { id: true, name: true, aiEnabled: true, aiApiKey: true },
    });
    if (!cg) throw new BadRequestException("Campground not found");
    // SECURITY: Decrypt API key from database
    const apiKey = this.getApiKey(cg);
    if (!cg.aiEnabled || !apiKey) {
      throw new ForbiddenException("AI suggestions not enabled for this campground");
    }

    const cgId = cg.id;
    const last90 = await this.getEventCounts(cgId, 90);
    const last365 = await this.getEventCounts(cgId, 365);
    const cabins90 = await this.getCabinRollup(cgId, 90);
    const cabins365 = await this.getCabinRollup(cgId, 365);
    const cabins3y = await this.getCabinRollup(cgId, 365 * 3);

    const attribution = await this.prisma.$queryRaw<
      Array<{ referrer: string | null; count: bigint }>
    >`
      SELECT COALESCE("referrer", 'direct') as referrer, COUNT(*)::bigint as count
      FROM "AnalyticsEvent"
      WHERE "campgroundId" = ${cgId} AND "occurredAt" >= NOW() - INTERVAL '365 day'
      GROUP BY COALESCE("referrer", 'direct')
      ORDER BY count DESC
    `;

    const prompt = `
You are an RV campground revenue and operations assistant.
Return concise, actionable suggestions. DO NOT include any personal guest info. Use aggregates only.
If data is sparse, say so and suggest quick wins. Output 5-8 bullet recommendations.

Campground: ${cg.name}
Focus: ${dto.focus || "overall performance"}

Metrics (last 90d):
- Views: ${last90.page_view}
- Availability checks: ${last90.availability_check}
- Add-to-stay: ${last90.add_to_stay}
- Reservation starts: ${last90.reservation_start}
- Abandoned: ${last90.reservation_abandoned}
- Completed: ${last90.reservation_completed}
- Image views: ${last90.image_viewed}, clicks: ${last90.image_clicked}
- Deal views: ${last90.deal_viewed}, applies: ${last90.deal_applied}
Metrics (last 365d):
- Views: ${last365.page_view}
- Availability checks: ${last365.availability_check}
- Add-to-stay: ${last365.add_to_stay}
- Reservation starts: ${last365.reservation_start}
- Abandoned: ${last365.reservation_abandoned}
- Completed: ${last365.reservation_completed}
- Image views: ${last365.image_viewed}, clicks: ${last365.image_clicked}
- Deal views: ${last365.deal_viewed}, applies: ${last365.deal_applied}
- Referrers (365d): ${attribution.map((r) => `${r.referrer}:${Number(r.count)}`).join(", ")}

Cabins performance (stays/revenue/ADR):
- Last 90d: bookings ${cabins90.bookings}, revenue $${(cabins90.revenueCents / 100).toFixed(0)}, ADR $${cabins90.adr.toFixed(0)}
- Last 365d: bookings ${cabins365.bookings}, revenue $${(cabins365.revenueCents / 100).toFixed(0)}, ADR $${cabins365.adr.toFixed(0)}
- Last 3y: bookings ${cabins3y.bookings}, revenue $${(cabins3y.revenueCents / 100).toFixed(0)}, ADR $${cabins3y.adr.toFixed(0)}

Guidelines:
- Start with a short numeric “What we see” summary citing the counts above.
- Then give 4-6 specific actions with expected impact. No navigation/how-to; focus on what to change.
- If data is thin, say “Data is thin; suggest lightweight tests.”
- Respect privacy; never request PII.
    `;

    const body = {
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You produce concise, high-signal recommendations for campground operators. No PII. Be specific with actions and expected impact.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 600,
    };

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`OpenAI error ${res.status}: ${text}`);
      throw new BadRequestException("AI suggestion request failed");
    }

    const json: unknown = await res.json();
    const content = parseOpenAiContent(json);
    const usage = parseOpenAiUsage(json);

    return {
      suggestions: content,
      windowDays: 365,
      usage: {
        promptTokens: usage.prompt_tokens ?? null,
        completionTokens: usage.completion_tokens ?? null,
        totalTokens: usage.total_tokens ?? null,
      },
    };
  }

  async ask(dto: AskDto) {
    const cg = await this.prisma.campground.findUnique({
      where: { id: dto.campgroundId },
      select: { id: true, name: true, aiEnabled: true, aiApiKey: true },
    });
    if (!cg) throw new BadRequestException("Campground not found");
    // SECURITY: Decrypt API key from database
    const apiKey = this.getApiKey(cg);
    if (!cg.aiEnabled || !apiKey) {
      throw new ForbiddenException("AI not enabled for this campground");
    }

    const cgId = cg.id;

    // SECURITY: Sanitize user input to prevent prompt injection
    const {
      sanitized: sanitizedQuestion,
      blocked,
      warnings,
    } = this.promptSanitizer.sanitize(dto.question);
    if (blocked) {
      this.logger.warn(`Blocked suspicious AI ask request for campground ${dto.campgroundId}`);
      throw new BadRequestException(
        "Your question contains invalid content. Please rephrase and try again.",
      );
    }
    if (warnings.length > 0) {
      this.logger.debug(`AI ask request sanitization warnings: ${warnings.join(", ")}`);
    }

    const metrics90 = await this.getEventCounts(cgId, 90);
    const metrics365 = await this.getEventCounts(cgId, 365);

    // SECURITY: Use structured prompt with clear separation of user input
    const systemInstructions = `You are a campground admin helper for ${cg.name}. Provide concise, data-backed guidance. No PII. If unsure, say so briefly.

Analytics (last 90d):
- Views: ${metrics90.page_view}, Add-to-stay: ${metrics90.add_to_stay}, Starts: ${metrics90.reservation_start}, Abandoned: ${metrics90.reservation_abandoned}, Completed: ${metrics90.reservation_completed}
- Availability checks: ${metrics90.availability_check}, Deals views/applies: ${metrics90.deal_viewed}/${metrics90.deal_applied}
- Images views/clicks: ${metrics90.image_viewed}/${metrics90.image_clicked}

Analytics (last 365d):
- Views: ${metrics365.page_view}, Add-to-stay: ${metrics365.add_to_stay}, Starts: ${metrics365.reservation_start}, Abandoned: ${metrics365.reservation_abandoned}, Completed: ${metrics365.reservation_completed}
- Availability checks: ${metrics365.availability_check}, Deals views/applies: ${metrics365.deal_viewed}/${metrics365.deal_applied}
- Images views/clicks: ${metrics365.image_viewed}/${metrics365.image_clicked}

Return:
- Short numeric summary (2-3 sentences) citing the metrics above.
- 3-5 specific actions with expected impact; no navigation/how-to instructions.
- If data is thin, say "Data is thin; suggest lightweight tests."`;

    const prompt = this.promptSanitizer.createSafePrompt(systemInstructions, sanitizedQuestion);

    const body = {
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You assist campground staff with concise answers and next steps. No guest PII. Be specific, short, and actionable.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 500,
    };

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`OpenAI ask error ${res.status}: ${text}`);
      throw new BadRequestException("AI ask request failed");
    }

    const json: unknown = await res.json();
    const content = parseOpenAiContent(json);
    const usage = parseOpenAiUsage(json);

    return {
      answer: content,
      usage: {
        promptTokens: usage.prompt_tokens ?? null,
        completionTokens: usage.completion_tokens ?? null,
        totalTokens: usage.total_tokens ?? null,
      },
    };
  }

  async recommend(dto: RecommendDto, forceMock = false) {
    const useMock = await this.shouldUseMock(dto.campgroundId, forceMock);
    const intent = dto.intent?.trim() || "boost conversions";
    const items = [
      {
        type: "site",
        title: "Riverside pull-through",
        reason: `Matches intent "${intent}" with full hookups and shade; near bathhouse.`,
        cta: "Hold Site 12",
        targetId: "site-12",
      },
      {
        type: "upsell",
        title: "Late checkout + firewood bundle",
        reason: "Common mid-stay ask; bundle yields +$18 margin with zero ops lift.",
        cta: "Add bundle",
        targetId: "bundle-late-firewood",
      },
      {
        type: "message",
        title: "Pre-arrival text",
        reason: "Send arrival tips + wifi + gate code; reduces desk calls by ~18%.",
        cta: "Send template",
        targetId: "template-arrival",
      },
    ];
    return {
      campgroundId: dto.campgroundId,
      guestId: dto.guestId ?? null,
      intent,
      items,
      generatedAt: new Date().toISOString(),
      mode: useMock ? "mock" : "live",
    };
  }

  async pricingSuggest(dto: PricingSuggestDto, forceMock = false) {
    const useMock = await this.shouldUseMock(dto.campgroundId, forceMock);

    // Gather real data for context
    const cgId = dto.campgroundId;
    const now = new Date();
    const next14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    // Get current base rate from site class if provided
    let defaultRate = 12000;
    let siteClassName = "Standard Site";
    if (dto.siteClassId) {
      const siteClass = await this.prisma.siteClass.findUnique({
        where: { id: dto.siteClassId },
        select: { name: true, defaultRate: true },
      });
      if (siteClass) {
        defaultRate = siteClass.defaultRate ?? 12000;
        siteClassName = siteClass.name;
      }
    }

    // Calculate real occupancy for next 14 days
    const totalSites = await this.prisma.site.count({ where: { campgroundId: cgId } });
    const bookedNights = await this.prisma.reservation.count({
      where: {
        campgroundId: cgId,
        status: { in: ["confirmed", "checked_in"] },
        arrivalDate: { lte: next14Days },
        departureDate: { gte: now },
      },
    });
    const occupancyPercent =
      totalSites > 0 ? Math.round((bookedNights / (totalSites * 14)) * 100) : 0;

    // Get recent booking velocity (last 7 days vs prior 7 days)
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const prior7Days = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const recentBookings = await this.prisma.reservation.count({
      where: { campgroundId: cgId, createdAt: { gte: last7Days } },
    });
    const priorBookings = await this.prisma.reservation.count({
      where: { campgroundId: cgId, createdAt: { gte: prior7Days, lt: last7Days } },
    });
    const velocityChange =
      priorBookings > 0 ? Math.round(((recentBookings - priorBookings) / priorBookings) * 100) : 0;

    // Calculate demand index based on real metrics
    const demandIndex = Math.min(
      1,
      Math.max(0, (occupancyPercent / 100) * 0.6 + (velocityChange > 0 ? 0.2 : 0) + 0.2),
    );

    if (useMock) {
      // Return formula-based result without AI
      const upliftPercent = Math.round(demandIndex * 20);
      const suggestedRateCents = Math.round(defaultRate * (1 + upliftPercent / 100));
      return {
        campgroundId: cgId,
        siteClassId: dto.siteClassId ?? null,
        window: { arrivalDate: dto.arrivalDate ?? null, departureDate: dto.departureDate ?? null },
        defaultRate,
        suggestedRateCents,
        currency: "USD",
        demandIndex,
        factors: [
          { label: "Occupancy (next 14d)", value: `${occupancyPercent}%`, weight: 0.4 },
          {
            label: "Booking velocity",
            value: `${velocityChange >= 0 ? "+" : ""}${velocityChange}%`,
            weight: 0.25,
          },
          { label: "Base demand", value: "Standard", weight: 0.2 },
          { label: "Active rules", value: "None detected", weight: 0.15 },
        ],
        comparableSites: [],
        notes: "Formula-based suggestion. Enable AI for smarter recommendations.",
        generatedAt: new Date().toISOString(),
        mode: "mock",
      };
    }

    // Use AI for intelligent pricing recommendation
    const cg = await this.prisma.campground.findUnique({
      where: { id: cgId },
      select: { name: true, aiApiKey: true },
    });
    const apiKey = cg?.aiApiKey || process.env.OPENAI_API_KEY;

    const prompt = `You are a revenue management AI for ${cg?.name || "a campground"}. Analyze the data and suggest optimal pricing.

Current Data:
- Site Class: ${siteClassName}
- Base Rate: $${(defaultRate / 100).toFixed(2)}/night
- Occupancy (next 14 days): ${occupancyPercent}%
- Booking velocity change (7d vs prior): ${velocityChange >= 0 ? "+" : ""}${velocityChange}%
- Target dates: ${dto.arrivalDate || "flexible"} to ${dto.departureDate || "flexible"}

Respond with JSON only (no markdown):
{
  "suggestedRateCents": <number>,
  "upliftPercent": <number>,
  "reasoning": "<brief explanation>",
  "factors": [{"label": "<factor>", "value": "<value>", "weight": <0-1>}],
  "confidence": <0-1>
}`;

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are a revenue management expert. Return only valid JSON.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 300,
        }),
      });

      if (!res.ok) {
        throw new BadRequestException(`OpenAI error: ${res.status}`);
      }

      const json: unknown = await res.json();
      const content = parseOpenAiContent(json);
      const parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, "").trim());
      const suggestion = parsePricingSuggestion(parsed);

      return {
        campgroundId: cgId,
        siteClassId: dto.siteClassId ?? null,
        window: { arrivalDate: dto.arrivalDate ?? null, departureDate: dto.departureDate ?? null },
        defaultRate,
        suggestedRateCents: suggestion?.suggestedRateCents ?? defaultRate,
        currency: "USD",
        demandIndex,
        factors: suggestion?.factors ?? [],
        comparableSites: [],
        notes: suggestion?.reasoning || "AI-generated pricing recommendation",
        confidence: suggestion?.confidence,
        generatedAt: new Date().toISOString(),
        mode: "live",
      };
    } catch (error) {
      this.logger.error("AI pricing suggestion failed, falling back to formula", error);
      const upliftPercent = Math.round(demandIndex * 20);
      const suggestedRateCents = Math.round(defaultRate * (1 + upliftPercent / 100));
      return {
        campgroundId: cgId,
        siteClassId: dto.siteClassId ?? null,
        window: { arrivalDate: dto.arrivalDate ?? null, departureDate: dto.departureDate ?? null },
        defaultRate,
        suggestedRateCents,
        currency: "USD",
        demandIndex,
        factors: [
          { label: "Occupancy (next 14d)", value: `${occupancyPercent}%`, weight: 0.4 },
          {
            label: "Booking velocity",
            value: `${velocityChange >= 0 ? "+" : ""}${velocityChange}%`,
            weight: 0.25,
          },
        ],
        comparableSites: [],
        notes: "Fallback formula-based suggestion (AI unavailable).",
        generatedAt: new Date().toISOString(),
        mode: "fallback",
      };
    }
  }

  async semanticSearch(dto: SemanticSearchDto, forceMock = false) {
    const useMock = await this.shouldUseMock(dto.campgroundId, forceMock);
    const query = dto.query.trim();
    const cgId = dto.campgroundId;

    if (!query) {
      return {
        campgroundId: cgId ?? null,
        query,
        results: [],
        generatedAt: new Date().toISOString(),
        mode: "empty",
      };
    }

    // Gather searchable data from the database
    const [guests, sites, messages] = await Promise.all([
      // Get recent/relevant guests
      this.prisma.guest.findMany({
        where: cgId ? { Reservation: { some: { campgroundId: cgId } } } : {},
        take: 50,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          notes: true,
          tags: true,
        },
      }),
      // Get sites
      this.prisma.site.findMany({
        where: cgId ? { campgroundId: cgId } : {},
        take: 50,
        select: {
          id: true,
          name: true,
          description: true,
          siteType: true,
          rigMaxLength: true,
          hookupsPower: true,
          hookupsWater: true,
          hookupsSewer: true,
          powerAmps: true,
          amenityTags: true,
          vibeTags: true,
          tags: true,
        },
      }),
      // Get recent messages
      this.prisma.message.findMany({
        where: cgId ? { campgroundId: cgId } : {},
        take: 30,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          content: true,
          guestId: true,
        },
      }),
    ]);

    // SECURITY: Anonymize guest PII before sending to AI
    // We use IDs and metadata only, not names/emails
    const guestItems: SearchableItem[] = guests.map((g, index) => {
      const guestRef = `Guest_${index + 1}`;
      const { anonymizedText } = this.aiPrivacy.anonymize(g.notes || "");
      return {
        type: "guest",
        id: g.id,
        title: guestRef,
        content: `${guestRef} ${g.tags.join(" ")} ${anonymizedText}`.trim(),
      };
    });

    const siteItems: SearchableItem[] = sites.map((s) => {
      const powerLabel = s.hookupsPower
        ? s.powerAmps.length > 0
          ? `${s.powerAmps.join("/")}A power`
          : "power"
        : "";
      const hookups = [
        powerLabel,
        s.hookupsWater ? "water" : "",
        s.hookupsSewer ? "sewer" : "",
      ].filter(nonEmpty);
      const amenities = [...s.amenityTags, ...s.vibeTags, ...s.tags].filter(nonEmpty);
      const rigLabel = s.rigMaxLength ? `fits ${s.rigMaxLength}ft rigs` : "";
      return {
        type: "site",
        id: s.id,
        title: s.name,
        content:
          `${s.name} ${s.description || ""} ${s.siteType || ""} ${rigLabel} ${hookups.join(" ")} ${amenities.join(" ")}`.trim(),
      };
    });

    const messageItems: SearchableItem[] = messages.map((m) => {
      const { anonymizedText } = this.aiPrivacy.anonymize(m.content.slice(0, 200));
      return {
        type: "message",
        id: m.id,
        title: "Message",
        content: anonymizedText,
      };
    });

    const searchableItems: SearchableItem[] = [...guestItems, ...siteItems, ...messageItems];

    if (useMock) {
      // Simple keyword matching without AI
      const lowerQuery = query.toLowerCase();
      const results = searchableItems
        .filter(
          (item) =>
            item.content.toLowerCase().includes(lowerQuery) ||
            item.title.toLowerCase().includes(lowerQuery),
        )
        .slice(0, 10)
        .map((item, idx) => ({
          type: item.type,
          id: item.id,
          title: item.title,
          snippet: item.content.slice(0, 150),
          score: 0.9 - idx * 0.05,
        }));

      return {
        campgroundId: cgId ?? null,
        query,
        results,
        generatedAt: new Date().toISOString(),
        mode: "mock",
      };
    }

    // Use AI for semantic matching
    if (!cgId) {
      return {
        campgroundId: null,
        query,
        results: [],
        generatedAt: new Date().toISOString(),
        mode: "empty",
      };
    }
    const cg = await this.prisma.campground.findUnique({
      where: { id: cgId },
      select: { name: true, aiApiKey: true },
    });
    const apiKey = cg?.aiApiKey || process.env.OPENAI_API_KEY;

    const prompt = `You are a search assistant. Given the user query and items below, return the most relevant matches.

User Query: "${query}"

Available Items (JSON):
${JSON.stringify(searchableItems.slice(0, 40), null, 2)}

Return JSON array of matches (max 10), ordered by relevance:
[{"id": "<item id>", "type": "<guest|site|message>", "score": <0-1>, "reason": "<why it matches>"}]

Only include items with score >= 0.5. Return empty array if no good matches.`;

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are a semantic search engine. Return only valid JSON arrays.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.2,
          max_tokens: 500,
        }),
      });

      if (!res.ok) {
        throw new BadRequestException(`OpenAI error: ${res.status}`);
      }

      const json: unknown = await res.json();
      const content = parseOpenAiContent(json) || "[]";
      const parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, "").trim());

      // Enrich results with full data
      const results = parseSearchMatches(parsed).map((match) => {
        const item = searchableItems.find((entry) => entry.id === match.id);
        return {
          type: match.type,
          id: match.id,
          title: item?.title || "Unknown",
          snippet: match.reason || item?.content?.slice(0, 150) || "",
          score: match.score,
        };
      });

      return {
        campgroundId: cgId ?? null,
        query,
        results,
        generatedAt: new Date().toISOString(),
        mode: "live",
      };
    } catch (error) {
      this.logger.error("AI semantic search failed, falling back to keyword", error);
      // Fallback to keyword search
      const lowerQuery = query.toLowerCase();
      const results = searchableItems
        .filter(
          (item) =>
            item.content.toLowerCase().includes(lowerQuery) ||
            item.title.toLowerCase().includes(lowerQuery),
        )
        .slice(0, 10)
        .map((item, idx) => ({
          type: item.type,
          id: item.id,
          title: item.title,
          snippet: item.content.slice(0, 150),
          score: 0.9 - idx * 0.05,
        }));

      return {
        campgroundId: cgId ?? null,
        query,
        results,
        generatedAt: new Date().toISOString(),
        mode: "fallback",
      };
    }
  }

  async copilot(dto: CopilotActionDto, forceMock = false) {
    const useMock = await this.shouldUseMock(dto.campgroundId, forceMock);
    const action = dto.action.toLowerCase();
    const campgroundId = dto.campgroundId;
    const payload = toPayloadRecord(dto.payload);

    // ==================== DYNAMIC PRICING ACTIONS ====================
    if (action === "get_pricing_recommendations" || action === "pricing_recommendations") {
      if (!campgroundId) {
        return { action, error: "campgroundId is required", generatedAt: new Date().toISOString() };
      }
      const recommendations = await this.dynamicPricingService.getRecommendations(campgroundId, {
        status: toStringValue(payload.status) ?? "pending",
        limit: toNumberValue(payload.limit) ?? 10,
      });
      const summary = await this.dynamicPricingService.getPricingSummary(campgroundId);
      return {
        action,
        recommendations,
        summary,
        message:
          recommendations.length > 0
            ? `Found ${recommendations.length} pricing recommendations. ${summary.pendingRecommendations} pending review.`
            : "No pending pricing recommendations.",
        generatedAt: new Date().toISOString(),
        mode: "live",
      };
    }

    if (action === "apply_pricing" || action === "apply_pricing_recommendation") {
      const recommendationId = toStringValue(payload.recommendationId);
      const userId = toStringValue(payload.userId);
      if (!recommendationId) {
        return {
          action,
          error: "recommendationId is required",
          generatedAt: new Date().toISOString(),
        };
      }
      const result = await this.dynamicPricingService.applyRecommendation(
        recommendationId,
        userId || "system",
      );
      return {
        action,
        result,
        message: `Applied pricing adjustment of ${result.adjustmentPercent}% for ${result.siteClassId || "sites"}`,
        generatedAt: new Date().toISOString(),
        mode: "live",
      };
    }

    if (action === "dismiss_pricing" || action === "dismiss_pricing_recommendation") {
      const recommendationId = toStringValue(payload.recommendationId);
      const userId = toStringValue(payload.userId);
      const reason = toStringValue(payload.reason);
      if (!recommendationId) {
        return {
          action,
          error: "recommendationId is required",
          generatedAt: new Date().toISOString(),
        };
      }
      const result = await this.dynamicPricingService.dismissRecommendation(
        recommendationId,
        userId || "system",
        reason,
      );
      return {
        action,
        result,
        message: "Pricing recommendation dismissed",
        generatedAt: new Date().toISOString(),
        mode: "live",
      };
    }

    if (action === "analyze_pricing") {
      if (!campgroundId) {
        return { action, error: "campgroundId is required", generatedAt: new Date().toISOString() };
      }
      const recommendations = await this.dynamicPricingService.analyzePricing(campgroundId);
      return {
        action,
        recommendations,
        message: `Generated ${recommendations.length} new pricing recommendations`,
        generatedAt: new Date().toISOString(),
        mode: "live",
      };
    }

    // ==================== REVENUE INSIGHTS ACTIONS ====================
    if (action === "get_revenue_insights" || action === "revenue_insights") {
      if (!campgroundId) {
        return { action, error: "campgroundId is required", generatedAt: new Date().toISOString() };
      }
      const insights = await this.revenueService.getInsights(campgroundId, {
        status: toStringValue(payload.status) ?? "new",
        limit: toNumberValue(payload.limit) ?? 10,
      });
      const summary = await this.revenueService.getRevenueSummary(campgroundId);
      return {
        action,
        insights,
        summary,
        message:
          summary.totalOpportunityCents > 0
            ? `You're leaving ${summary.totalOpportunityFormatted} on the table. ${summary.activeInsights} opportunities identified.`
            : "No revenue opportunities identified at this time.",
        generatedAt: new Date().toISOString(),
        mode: "live",
      };
    }

    if (action === "analyze_revenue") {
      if (!campgroundId) {
        return { action, error: "campgroundId is required", generatedAt: new Date().toISOString() };
      }
      const insights = await this.revenueService.analyzeRevenue(campgroundId);
      return {
        action,
        insights,
        message: `Generated ${insights.length} new revenue insights`,
        generatedAt: new Date().toISOString(),
        mode: "live",
      };
    }

    // ==================== WEATHER ACTIONS ====================
    if (action === "get_weather" || action === "current_weather") {
      if (!campgroundId) {
        return { action, error: "campgroundId is required", generatedAt: new Date().toISOString() };
      }
      const weather = await this.weatherService.getCurrentWeather(campgroundId);
      const activeAlerts = await this.weatherService.getAlerts(campgroundId, { status: "active" });
      return {
        action,
        weather,
        activeAlerts,
        message: weather
          ? `Current: ${weather.temp}°F, ${weather.description}. ${activeAlerts.length} active alerts.`
          : "Weather data unavailable. Check API configuration.",
        generatedAt: new Date().toISOString(),
        mode: "live",
      };
    }

    if (action === "get_weather_forecast" || action === "weather_forecast") {
      if (!campgroundId) {
        return { action, error: "campgroundId is required", generatedAt: new Date().toISOString() };
      }
      const forecast = await this.weatherService.getForecast(campgroundId);
      return {
        action,
        forecast,
        message:
          forecast.length > 0
            ? `7-day forecast retrieved. Next day: ${forecast[0]?.tempHigh}°F high.`
            : "Forecast unavailable.",
        generatedAt: new Date().toISOString(),
        mode: "live",
      };
    }

    if (action === "get_weather_alerts" || action === "weather_alerts") {
      if (!campgroundId) {
        return { action, error: "campgroundId is required", generatedAt: new Date().toISOString() };
      }
      const alerts = await this.weatherService.getAlerts(campgroundId, {
        status: toStringValue(payload.status),
        limit: toNumberValue(payload.limit) ?? 10,
      });
      return {
        action,
        alerts,
        message:
          alerts.length > 0 ? `${alerts.length} weather alerts found.` : "No weather alerts.",
        generatedAt: new Date().toISOString(),
        mode: "live",
      };
    }

    if (action === "check_weather") {
      if (!campgroundId) {
        return { action, error: "campgroundId is required", generatedAt: new Date().toISOString() };
      }
      const alerts = await this.weatherService.checkWeatherConditions(campgroundId);
      return {
        action,
        newAlerts: alerts,
        message:
          alerts.length > 0
            ? `Created ${alerts.length} new weather alerts. Guests will be notified.`
            : "No severe weather conditions detected.",
        generatedAt: new Date().toISOString(),
        mode: "live",
      };
    }

    // ==================== MAINTENANCE ACTIONS ====================
    if (action === "get_maintenance_alerts" || action === "maintenance_alerts") {
      if (!campgroundId) {
        return { action, error: "campgroundId is required", generatedAt: new Date().toISOString() };
      }
      const alerts = await this.maintenanceService.getAlerts(campgroundId, {
        status: toStringValue(payload.status),
        severity: toStringValue(payload.severity),
        limit: toNumberValue(payload.limit) ?? 10,
      });
      const summary = await this.maintenanceService.getMaintenanceSummary(campgroundId);
      return {
        action,
        alerts,
        summary,
        message:
          summary.activeAlerts > 0
            ? `${summary.activeAlerts} maintenance issues detected. ${summary.critical + summary.high} need immediate attention.`
            : "No maintenance issues detected.",
        generatedAt: new Date().toISOString(),
        mode: "live",
      };
    }

    if (action === "analyze_maintenance") {
      if (!campgroundId) {
        return { action, error: "campgroundId is required", generatedAt: new Date().toISOString() };
      }
      const alerts = await this.maintenanceService.analyzePatterns(campgroundId);
      return {
        action,
        newAlerts: alerts,
        message:
          alerts.length > 0
            ? `Detected ${alerts.length} maintenance patterns requiring attention.`
            : "No new maintenance patterns detected.",
        generatedAt: new Date().toISOString(),
        mode: "live",
      };
    }

    // ==================== DASHBOARD ACTIONS ====================
    if (action === "get_ai_dashboard" || action === "ai_dashboard" || action === "dashboard") {
      if (!campgroundId) {
        return { action, error: "campgroundId is required", generatedAt: new Date().toISOString() };
      }
      const [metrics, quickStats, activity] = await Promise.all([
        this.dashboardService.getMetrics(campgroundId, toNumberValue(payload.periodDays) ?? 30),
        this.dashboardService.getQuickStats(campgroundId),
        this.dashboardService.getActivityFeed(
          campgroundId,
          toNumberValue(payload.activityLimit) ?? 10,
        ),
      ]);
      return {
        action,
        metrics,
        quickStats,
        activity,
        message: `AI handled ${metrics.messagesHandled} messages, prevented ${metrics.noShowsPrevented} no-shows. ROI: ${metrics.roiPercent}%.`,
        generatedAt: new Date().toISOString(),
        mode: "live",
      };
    }

    if (action === "get_ai_activity" || action === "ai_activity") {
      if (!campgroundId) {
        return { action, error: "campgroundId is required", generatedAt: new Date().toISOString() };
      }
      const activity = await this.dashboardService.getActivityFeed(
        campgroundId,
        toNumberValue(payload.limit) ?? 20,
      );
      return {
        action,
        activity,
        message: `Retrieved ${activity.length} recent AI activities.`,
        generatedAt: new Date().toISOString(),
        mode: "live",
      };
    }

    if (action === "get_ai_metrics" || action === "ai_metrics") {
      if (!campgroundId) {
        return { action, error: "campgroundId is required", generatedAt: new Date().toISOString() };
      }
      const metrics = await this.dashboardService.getMetrics(
        campgroundId,
        toNumberValue(payload.periodDays) ?? 30,
      );
      return {
        action,
        metrics,
        message: `Revenue saved: $${(metrics.estimatedRevenueSavedCents / 100).toFixed(2)}, AI cost: $${(metrics.aiCostCents / 100).toFixed(2)}, ROI: ${metrics.roiPercent}%.`,
        generatedAt: new Date().toISOString(),
        mode: "live",
      };
    }

    // ==================== ORIGINAL ACTIONS ====================
    if (action === "adjust_rates") {
      return {
        action,
        preview: "Apply +8% weekend uplift for premium RV sites; keep weekdays flat.",
        steps: [
          "Preview affected stays",
          "Notify front desk of rate changes",
          "Publish to booking channels",
        ],
        impact: "Est. +$420 next 14 days with minimal cannibalization.",
        generatedAt: new Date().toISOString(),
        mode: useMock ? "mock" : "live",
      };
    }

    if (action === "draft_reply") {
      const guestName = toStringValue(payload.guestName);
      const lastMessage = toStringValue(payload.lastMessage);
      const reservationContext = toStringValue(payload.reservationContext);
      const cg = campgroundId
        ? await this.prisma.campground.findUnique({
            where: { id: campgroundId },
            select: { aiApiKey: true },
          })
        : null;

      const prompt = `
      You are a helpful campground concierge. Draft a friendly, professional reply to a guest.
      Guest Name: ${guestName || "Guest"}
      Last Message: "${lastMessage || "N/A"}"
      Context: ${reservationContext || "General inquiry"}

      Guidelines:
      - Be concise and warm.
      - Address their specific question if clear.
      - If they asked about late checkout, offer it for a fee if applicable.
      - If they asked about amenities, mention the pool/wifi.
      - Keep it under 50 words.
      `;

      const body = {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a helpful campground concierge. Draft concise, friendly replies.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 150,
      };

      try {
        const apiKey = cg?.aiApiKey || process.env.OPENAI_API_KEY;
        if (!apiKey) {
          return {
            action,
            preview: `(AI Mock) Hi ${guestName || "Guest"}, thanks for your message! regarding "${lastMessage}", we'd be happy to help. Let us know if you need anything else!`,
            tone: "friendly",
            generatedAt: new Date().toISOString(),
            mode: "mock",
          };
        }

        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          return {
            action,
            preview: `(AI Mock) Hi ${guestName || "Guest"}, thanks for your message! regarding "${lastMessage}", we'd be happy to help. Let us know if you need anything else!`,
            tone: "friendly",
            generatedAt: new Date().toISOString(),
            mode: "mock",
          };
        }

        const json = await res.json();
        const content = json?.choices?.[0]?.message?.content || "";

        return {
          action,
          preview: content.replace(/^"|"$/g, ""),
          tone: "friendly",
          generatedAt: new Date().toISOString(),
          mode: "live",
        };
      } catch (err) {
        return {
          action,
          preview: `(Fallback) Hi ${guestName || "Guest"}, received your message: "${lastMessage}". We will get back to you shortly.`,
          tone: "neutral",
          generatedAt: new Date().toISOString(),
          mode: "fallback",
        };
      }
    }

    // ==================== HELP ACTION ====================
    if (action === "help" || action === "list_actions") {
      return {
        action,
        availableActions: [
          // Pricing
          { action: "get_pricing_recommendations", description: "Get AI pricing recommendations" },
          {
            action: "apply_pricing",
            description: "Apply a pricing recommendation",
            params: ["recommendationId"],
          },
          {
            action: "dismiss_pricing",
            description: "Dismiss a pricing recommendation",
            params: ["recommendationId"],
          },
          { action: "analyze_pricing", description: "Trigger new pricing analysis" },
          // Revenue
          { action: "get_revenue_insights", description: "Get revenue opportunity insights" },
          { action: "analyze_revenue", description: "Trigger new revenue analysis" },
          // Weather
          { action: "get_weather", description: "Get current weather conditions" },
          { action: "get_weather_forecast", description: "Get 7-day weather forecast" },
          { action: "get_weather_alerts", description: "Get weather alerts" },
          { action: "check_weather", description: "Check for severe weather and create alerts" },
          // Maintenance
          { action: "get_maintenance_alerts", description: "Get maintenance alerts" },
          { action: "analyze_maintenance", description: "Analyze maintenance patterns" },
          // Dashboard
          {
            action: "get_ai_dashboard",
            description: "Get full AI dashboard with metrics and activity",
          },
          { action: "get_ai_activity", description: "Get recent AI activity feed" },
          { action: "get_ai_metrics", description: "Get AI performance metrics" },
          // Messages
          { action: "draft_reply", description: "Draft a reply to a guest message" },
          { action: "adjust_rates", description: "Get rate adjustment recommendations" },
        ],
        generatedAt: new Date().toISOString(),
        mode: "live",
      };
    }

    // Default fallback
    return {
      action,
      preview:
        "What-if: add 10% rate during county fair and auto-apply late checkout bundle to Saturday departures.",
      steps: ["Simulate ADR/occupancy impact", "Stage pricing rule", "Confirm to apply"],
      generatedAt: new Date().toISOString(),
      mode: useMock ? "mock" : "live",
    };
  }

  private async getEventCounts(campgroundId: string, days: number) {
    const counts = await this.prisma.analyticsDailyAggregate.groupBy({
      by: ["eventName"],
      where: { campgroundId, date: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) } },
      _sum: { count: true },
    });
    const pick = (event: AnalyticsEventName) => {
      const found = counts.find((c) => c.eventName === event);
      return found && found._sum && typeof found._sum.count === "number" ? found._sum.count : 0;
    };
    return {
      page_view: pick(AnalyticsEventName.page_view),
      availability_check: pick(AnalyticsEventName.availability_check),
      add_to_stay: pick(AnalyticsEventName.add_to_stay),
      reservation_start: pick(AnalyticsEventName.reservation_start),
      reservation_abandoned: pick(AnalyticsEventName.reservation_abandoned),
      reservation_completed: pick(AnalyticsEventName.reservation_completed),
      image_viewed: pick(AnalyticsEventName.image_viewed),
      image_clicked: pick(AnalyticsEventName.image_clicked),
      deal_viewed: pick(AnalyticsEventName.deal_viewed),
      deal_applied: pick(AnalyticsEventName.deal_applied),
    };
  }

  private async getCabinRollup(campgroundId: string, days: number) {
    const rows = await this.prisma.$queryRaw<
      Array<{ bookings: bigint; revenue: bigint; nights: number }>
    >`
      SELECT
        COUNT(*)::bigint AS bookings,
        COALESCE(SUM(r."totalAmount"), 0)::bigint AS revenue,
        COALESCE(SUM(EXTRACT(epoch FROM (r."departureDate" - r."arrivalDate")) / 86400), 0) AS nights
      FROM "Reservation" r
      JOIN "Site" s ON s.id = r."siteId"
      WHERE r."campgroundId" = ${campgroundId}
        AND s."siteType" = 'cabin'
        AND r."status" = 'confirmed'
        AND r."arrivalDate" >= NOW() - (${days} || ' day')::interval
    `;
    const row = rows[0] || { bookings: 0n, revenue: 0n, nights: 0 };
    const bookings = Number(row.bookings);
    const revenueCents = Number(row.revenue);
    const nights = row.nights || 0;
    const adr = nights > 0 ? revenueCents / nights / 100 : 0;
    return { bookings, revenueCents, adr };
  }
}
