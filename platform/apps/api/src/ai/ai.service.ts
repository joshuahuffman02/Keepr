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

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly prisma: PrismaService) { }

  private async shouldUseMock(campgroundId?: string, forceMock?: boolean) {
    if (forceMock) return true;
    if (!campgroundId) return true;
    const cg = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { aiSuggestionsEnabled: true as any, aiOpenaiApiKey: true as any },
    });
    if (!cg) return true;
    if (!(cg as any).aiSuggestionsEnabled) return true;
    if (!(cg as any).aiOpenaiApiKey) return true;
    return false;
  }

  async updateSettings(campgroundId: string, dto: UpdateAiSettingsDto) {
    const cg = await this.prisma.campground.findUnique({ where: { id: campgroundId } });
    if (!cg) throw new BadRequestException("Campground not found");
    await this.prisma.campground.update({
      where: { id: campgroundId },
      data: {
        aiSuggestionsEnabled: dto.enabled,
        aiOpenaiApiKey: dto.openaiApiKey ?? (cg as any).aiOpenaiApiKey,
      } as any,
    });
    return { ok: true, enabled: dto.enabled, hasKey: !!(dto.openaiApiKey ?? (cg as any).aiOpenaiApiKey) };
  }

  async generate(dto: GenerateAiSuggestionsDto) {
    const cg = await this.prisma.campground.findUnique({
      where: { id: dto.campgroundId },
      select: { id: true, name: true, aiSuggestionsEnabled: true as any, aiOpenaiApiKey: true as any } as any,
    });
    if (!cg) throw new BadRequestException("Campground not found");
    if (!(cg as any).aiSuggestionsEnabled || !(cg as any).aiOpenaiApiKey) {
      throw new ForbiddenException("AI suggestions not enabled for this campground");
    }

    const cgId = (cg as any).id as string;
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
        { role: "system", content: "You produce concise, high-signal recommendations for campground operators. No PII. Be specific with actions and expected impact." },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 600,
    };

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${(cg as any).aiOpenaiApiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`OpenAI error ${res.status}: ${text}`);
      throw new BadRequestException("AI suggestion request failed");
    }

    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content || "";
    const usage = json?.usage || {};

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
      select: { id: true, name: true, aiSuggestionsEnabled: true as any, aiOpenaiApiKey: true as any } as any,
    });
    if (!cg) throw new BadRequestException("Campground not found");
    if (!(cg as any).aiSuggestionsEnabled || !(cg as any).aiOpenaiApiKey) {
      throw new ForbiddenException("AI not enabled for this campground");
    }

    const cgId = (cg as any).id as string;

    const scrubbedQuestion = dto.question
      .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[phone]")
      .replace(/\b\S+@\S+\.\S+\b/g, "[email]");

    const metrics90 = await this.getEventCounts(cgId, 90);
    const metrics365 = await this.getEventCounts(cgId, 365);

    const prompt = `
You are a campground admin helper for ${cg.name}. Provide concise, data-backed guidance. No PII. If unsure, say so briefly.
User question: "${scrubbedQuestion}"

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
- If data is thin, say “Data is thin; suggest lightweight tests.”
`;

    const body = {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You assist campground staff with concise answers and next steps. No guest PII. Be specific, short, and actionable." },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 500,
    };

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${(cg as any).aiOpenaiApiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`OpenAI ask error ${res.status}: ${text}`);
      throw new BadRequestException("AI ask request failed");
    }

    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content || "";
    const usage = json?.usage || {};

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
    let baseRateCents = 12000;
    let siteClassName = "Standard Site";
    if (dto.siteClassId) {
      const siteClass = await this.prisma.siteClass.findUnique({
        where: { id: dto.siteClassId },
        select: { name: true, baseRateCents: true },
      });
      if (siteClass) {
        baseRateCents = siteClass.baseRateCents ?? 12000;
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
    const occupancyPercent = totalSites > 0 ? Math.round((bookedNights / (totalSites * 14)) * 100) : 0;

    // Get recent booking velocity (last 7 days vs prior 7 days)
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const prior7Days = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const recentBookings = await this.prisma.reservation.count({
      where: { campgroundId: cgId, createdAt: { gte: last7Days } },
    });
    const priorBookings = await this.prisma.reservation.count({
      where: { campgroundId: cgId, createdAt: { gte: prior7Days, lt: last7Days } },
    });
    const velocityChange = priorBookings > 0 ? Math.round(((recentBookings - priorBookings) / priorBookings) * 100) : 0;

    // Calculate demand index based on real metrics
    const demandIndex = Math.min(1, Math.max(0, (occupancyPercent / 100) * 0.6 + (velocityChange > 0 ? 0.2 : 0) + 0.2));

    if (useMock) {
      // Return formula-based result without AI
      const upliftPercent = Math.round(demandIndex * 20);
      const suggestedRateCents = Math.round(baseRateCents * (1 + upliftPercent / 100));
      return {
        campgroundId: cgId,
        siteClassId: dto.siteClassId ?? null,
        window: { arrivalDate: dto.arrivalDate ?? null, departureDate: dto.departureDate ?? null },
        baseRateCents,
        suggestedRateCents,
        currency: "USD",
        demandIndex,
        factors: [
          { label: "Occupancy (next 14d)", value: `${occupancyPercent}%`, weight: 0.4 },
          { label: "Booking velocity", value: `${velocityChange >= 0 ? "+" : ""}${velocityChange}%`, weight: 0.25 },
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
      select: { name: true, aiOpenaiApiKey: true as any },
    });

    const prompt = `You are a revenue management AI for ${cg?.name || "a campground"}. Analyze the data and suggest optimal pricing.

Current Data:
- Site Class: ${siteClassName}
- Base Rate: $${(baseRateCents / 100).toFixed(2)}/night
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
          Authorization: `Bearer ${(cg as any).aiOpenaiApiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a revenue management expert. Return only valid JSON." },
            { role: "user", content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 300,
        }),
      });

      if (!res.ok) {
        throw new Error(`OpenAI error: ${res.status}`);
      }

      const json = await res.json();
      const content = json?.choices?.[0]?.message?.content || "";
      const parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, "").trim());

      return {
        campgroundId: cgId,
        siteClassId: dto.siteClassId ?? null,
        window: { arrivalDate: dto.arrivalDate ?? null, departureDate: dto.departureDate ?? null },
        baseRateCents,
        suggestedRateCents: parsed.suggestedRateCents || baseRateCents,
        currency: "USD",
        demandIndex,
        factors: parsed.factors || [],
        comparableSites: [],
        notes: parsed.reasoning || "AI-generated pricing recommendation",
        confidence: parsed.confidence,
        generatedAt: new Date().toISOString(),
        mode: "live",
      };
    } catch (error) {
      this.logger.error("AI pricing suggestion failed, falling back to formula", error);
      const upliftPercent = Math.round(demandIndex * 20);
      const suggestedRateCents = Math.round(baseRateCents * (1 + upliftPercent / 100));
      return {
        campgroundId: cgId,
        siteClassId: dto.siteClassId ?? null,
        window: { arrivalDate: dto.arrivalDate ?? null, departureDate: dto.departureDate ?? null },
        baseRateCents,
        suggestedRateCents,
        currency: "USD",
        demandIndex,
        factors: [
          { label: "Occupancy (next 14d)", value: `${occupancyPercent}%`, weight: 0.4 },
          { label: "Booking velocity", value: `${velocityChange >= 0 ? "+" : ""}${velocityChange}%`, weight: 0.25 },
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
        where: cgId ? { campgroundId: cgId } : {},
        take: 50,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          notes: true,
          loyaltyTier: true,
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
          maxRigLength: true,
          hookups: true,
          amenities: true,
        },
      }),
      // Get recent messages
      this.prisma.message.findMany({
        where: cgId ? { campgroundId: cgId } : {},
        take: 30,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          subject: true,
          body: true,
          guestId: true,
        },
      }),
    ]);

    // Format data for search context
    const searchableItems = [
      ...guests.map((g) => ({
        type: "guest",
        id: g.id,
        title: `${g.firstName} ${g.lastName}`,
        content: `${g.firstName} ${g.lastName} ${g.email || ""} ${g.notes || ""} ${g.loyaltyTier || ""} ${(g.tags as string[] || []).join(" ")}`.trim(),
      })),
      ...sites.map((s) => ({
        type: "site",
        id: s.id,
        title: s.name,
        content: `${s.name} ${s.description || ""} ${s.siteType || ""} ${s.maxRigLength ? `fits ${s.maxRigLength}ft rigs` : ""} ${(s.hookups as string[] || []).join(" ")} ${(s.amenities as string[] || []).join(" ")}`.trim(),
      })),
      ...messages.map((m) => ({
        type: "message",
        id: m.id,
        title: m.subject || "Message",
        content: `${m.subject || ""} ${(m.body || "").slice(0, 200)}`.trim(),
      })),
    ];

    if (useMock) {
      // Simple keyword matching without AI
      const lowerQuery = query.toLowerCase();
      const results = searchableItems
        .filter((item) => item.content.toLowerCase().includes(lowerQuery) || item.title.toLowerCase().includes(lowerQuery))
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
    const cg = await this.prisma.campground.findUnique({
      where: { id: cgId! },
      select: { name: true, aiOpenaiApiKey: true as any },
    });

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
          Authorization: `Bearer ${(cg as any).aiOpenaiApiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a semantic search engine. Return only valid JSON arrays." },
            { role: "user", content: prompt },
          ],
          temperature: 0.2,
          max_tokens: 500,
        }),
      });

      if (!res.ok) {
        throw new Error(`OpenAI error: ${res.status}`);
      }

      const json = await res.json();
      const content = json?.choices?.[0]?.message?.content || "[]";
      const parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, "").trim());

      // Enrich results with full data
      const results = (parsed as any[]).map((match) => {
        const item = searchableItems.find((i) => i.id === match.id);
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
        .filter((item) => item.content.toLowerCase().includes(lowerQuery) || item.title.toLowerCase().includes(lowerQuery))
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
    if (action === "adjust_rates") {
      return {
        action,
        preview: "Apply +8% weekend uplift for premium RV sites; keep weekdays flat.",
        steps: ["Preview affected stays", "Notify front desk of rate changes", "Publish to booking channels"],
        impact: "Est. +$420 next 14 days with minimal cannibalization.",
        generatedAt: new Date().toISOString(),
        mode: useMock ? "mock" : "live",
      };
    }
    if (action === "draft_reply") {
      const { guestName, lastMessage, reservationContext } = dto.payload || {};

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
          { role: "system", content: "You are a helpful campground concierge. Draft concise, friendly replies." },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 150,
      };

      try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${(cg as any).aiOpenaiApiKey}`,
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          // Fallback for demo if no key or error
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
          preview: content.replace(/^"|"$/g, ''), // remove quotes if AI adds them
          tone: "friendly",
          generatedAt: new Date().toISOString(),
          mode: "live",
        };
      } catch (err) {
        // Fallback
        return {
          action,
          preview: `(Fallback) Hi ${guestName || "Guest"}, received your message: "${lastMessage}". We will get back to you shortly.`,
          tone: "neutral",
          generatedAt: new Date().toISOString(),
          mode: "fallback",
        };
      }
    }
    return {
      action,
      preview: "What-if: add 10% rate during county fair and auto-apply late checkout bundle to Saturday departures.",
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

