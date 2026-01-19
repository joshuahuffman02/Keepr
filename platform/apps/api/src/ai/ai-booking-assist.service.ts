import { Injectable, Inject, forwardRef, Logger } from '@nestjs/common';
import { AiProviderService } from './ai-provider.service';
import { AiPrivacyService } from './ai-privacy.service';
import { AiFeatureGateService } from './ai-feature-gate.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiFeatureType, AiConsentType, AiInteractionLog, Prisma } from '@prisma/client';
import { PublicReservationsService } from '../public-reservations/public-reservations.service';

type CampgroundWithSites = Prisma.CampgroundGetPayload<{
    include: {
        SiteClass: {
            select: {
                id: true;
                name: true;
                description: true;
                defaultRate: true;
                maxOccupancy: true;
                siteType: true;
                rigMaxLength: true;
                hookupsPower: true;
                hookupsWater: true;
                hookupsSewer: true;
                petFriendly: true;
                accessible: true;
            };
        };
        Site: {
            select: {
                id: true;
                name: true;
                siteClassId: true;
            };
        };
    };
}>;

type SiteClassSummary = CampgroundWithSites['SiteClass'][number];
type SiteSummary = CampgroundWithSites['Site'][number];
type ToolAction = NonNullable<BookingAssistResponse['action']>;
type AvailabilityItem = Awaited<ReturnType<PublicReservationsService['getAvailability']>>[number];

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const toStringValue = (value: unknown): string | undefined => {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return undefined;
};

const toNumberValue = (value: unknown): number | undefined => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return undefined;
};

const toStringArray = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => toStringValue(item))
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((item) => item.trim());
};

const toToolAction = (value: unknown): ToolAction | undefined => {
    if (typeof value !== 'string') return undefined;
    const normalized = value.toLowerCase().trim();
    if (normalized === 'search') return 'search';
    if (normalized === 'book') return 'book';
    if (normalized === 'clarify') return 'clarify';
    if (normalized === 'info') return 'info';
    return undefined;
};

const toAnonymizationLevel = (
    value: string | null | undefined
): 'strict' | 'moderate' | 'minimal' => {
    if (value === 'strict' || value === 'moderate' || value === 'minimal') {
        return value;
    }
    return 'moderate';
};

const hasSiteClassName = (
    site: AvailabilityItem,
): site is AvailabilityItem & { siteClass: { name: string } } =>
    Boolean(site.siteClass && typeof site.siteClass.name === 'string');

const isAvailableSiteWithClass = (
    site: AvailabilityItem
): site is AvailabilityItem & { siteClass: { name: string } } =>
    site.status === 'available' && hasSiteClassName(site);

interface BookingContext {
    campgroundId: string;
    sessionId: string;
    message: string;
    dates?: { arrival: string; departure: string };
    partySize?: { adults: number; children: number };
    rigInfo?: { type: string; length: number };
    preferences?: string[];
    history?: { role: 'user' | 'assistant'; content: string }[];
    sessionOnly?: boolean;
}

interface SiteRecommendation {
    siteId: string;
    siteName: string;
    siteClassName: string;
    matchScore: number; // 0-100
    reasons: string[];
    available: boolean;
}

export interface BookingAssistResponse {
    message: string;
    recommendations?: SiteRecommendation[];
    clarifyingQuestions?: string[];
    action?: 'search' | 'book' | 'clarify' | 'info';
    bookingDetails?: {
        dates?: { arrival: string; departure: string };
        partySize?: { adults: number; children: number };
        rigInfo?: { type: string; length: number };
        siteClassId?: string;
        siteClassName?: string;
        addOns?: string[];
    };
}

@Injectable()
export class AiBookingAssistService {
    private readonly logger = new Logger(AiBookingAssistService.name);

    constructor(
        private readonly provider: AiProviderService,
        private readonly privacy: AiPrivacyService,
        private readonly gate: AiFeatureGateService,
        private readonly prisma: PrismaService,
        @Inject(forwardRef(() => PublicReservationsService))
        private readonly publicReservations: PublicReservationsService,
    ) { }

    /**
     * Process a booking assistant message
     */
    async chat(context: BookingContext): Promise<BookingAssistResponse> {
        // Check feature enabled
        await this.gate.assertFeatureEnabled(context.campgroundId, AiFeatureType.booking_assist);

        const sessionOnly = context.sessionOnly === true;

        if (!sessionOnly) {
            // Check/record consent
            const hasConsent = await this.gate.hasConsent(
                context.campgroundId,
                AiConsentType.booking_assist,
                undefined,
                context.sessionId,
            );

            if (!hasConsent) {
                // Auto-grant session-based consent for booking assist
                await this.gate.recordConsent({
                    campgroundId: context.campgroundId,
                    consentType: AiConsentType.booking_assist,
                    sessionId: context.sessionId,
                    source: 'booking_widget',
                });
            }
        }

        // Get campground and site data
        const campground: CampgroundWithSites | null = await this.prisma.campground.findUnique({
            where: { id: context.campgroundId },
            include: {
                SiteClass: {
                    where: { isActive: true },
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        defaultRate: true,
                        maxOccupancy: true,
                        siteType: true,
                        rigMaxLength: true,
                        hookupsPower: true,
                        hookupsWater: true,
                        hookupsSewer: true,
                        petFriendly: true,
                        accessible: true,
                    },
                },
                Site: {
                    where: { status: 'available' },
                    take: 20,
                    select: {
                        id: true,
                        name: true,
                        siteClassId: true,
                    },
                },
            },
        });

        if (!campground) {
            return {
                message: "I'm sorry, I couldn't find information about this campground.",
                action: 'info',
            };
        }

        const anonymizationLevel = toAnonymizationLevel(campground.aiAnonymizationLevel);
        const { anonymizedText, tokenMap } = this.privacy.anonymize(context.message, anonymizationLevel);
        const { historyText, historyTokenMap } = this.buildHistory(context.history ?? [], anonymizationLevel);
        const mergedTokenMap = this.mergeTokenMaps(tokenMap, historyTokenMap);
        const preferencesForPrompt = context.preferences?.map((pref) => {
            const result = this.privacy.anonymize(pref, anonymizationLevel);
            result.tokenMap.forEach((value, key) => mergedTokenMap.set(key, value));
            return result.anonymizedText;
        });
        const promptContext = {
            ...context,
            preferences: preferencesForPrompt ?? context.preferences,
        };

        // Fetch conversation history from DB if not provided in context
        // (DB history is only useful for metadata since content is hashed, but good as fallback)
        let historyMeta: AiInteractionLog[] = [];
        if (!sessionOnly && (!context.history || context.history.length === 0)) {
            historyMeta = await this.prisma.aiInteractionLog.findMany({
                where: {
                    campgroundId: context.campgroundId,
                    sessionId: context.sessionId,
                    success: true,
                    featureType: AiFeatureType.booking_assist,
                },
                orderBy: { createdAt: 'desc' },
                take: 5,
            });
        }

        // Check availability if dates are known
        let availableSiteTypes: Set<string> | null = null;
        if (context.dates && context.dates.arrival && context.dates.departure) {
            try {
                // Get raw availability from the booking engine
                const availability = await this.publicReservations.getAvailability(
                    campground.slug,
                    context.dates.arrival,
                    context.dates.departure,
                    context.rigInfo?.type,
                    context.rigInfo?.length?.toString(),
                    false // needsAccessible - could infer from context if needed
                );

                // Extract unique site class names that have at least one available site
                    availableSiteTypes = new Set(
                        availability
                            .filter(isAvailableSiteWithClass)
                            .map((site) => site.siteClass.name)
                    );
            } catch (err) {
                this.logger.error("Failed to check availability for AI chat", err);
                // Fallback: assume everything is available if check fails, or handle gracefully
            }
        }

        // Build system prompt
        const systemPrompt = this.buildSystemPrompt(campground);

        // Build user prompt with context AND history
        let userPrompt = this.buildUserPrompt(anonymizedText, promptContext, availableSiteTypes);

        // Append conversation history
        if (historyText) {
            userPrompt += `\n\nCONVERSATION HISTORY:\n${historyText}`;
        } else if (historyMeta.length > 0) {
            // Fallback to minimal context if we only have DB logs (hashed content)
            userPrompt += `\n\n(This is turn #${historyMeta.length + 1} of the conversation)`;
        }

        // If the context contains extracted entities (like dates), explicitly emphasize them
        if (promptContext.dates || promptContext.rigInfo || promptContext.partySize || promptContext.preferences) {
            userPrompt += "\n\nCRITICAL CONTEXT (Extracted from previous messages):";
            if (promptContext.dates) userPrompt += `\n- Dates: ${promptContext.dates.arrival} to ${promptContext.dates.departure}`;
            if (promptContext.partySize) userPrompt += `\n- Party: ${promptContext.partySize.adults} adults, ${promptContext.partySize.children} children`;
            if (promptContext.rigInfo) userPrompt += `\n- Rig: ${promptContext.rigInfo.length}ft ${promptContext.rigInfo.type}`;
            if (promptContext.preferences) userPrompt += `\n- Preferences: ${promptContext.preferences.join(', ')}`;
        }

        // Get AI response
        const response = await this.provider.getToolCompletion({
            campgroundId: context.campgroundId,
            featureType: AiFeatureType.booking_assist,
            systemPrompt,
            userPrompt,
            sessionId: context.sessionId,
            maxTokens: 600,
            temperature: 0.6,
            tools: this.buildTools(),
            persistLogs: !sessionOnly,
        });

        const toolCall = this.pickToolCall(response.toolCalls);
        let parsedResponse: BookingAssistResponse | null = null;

        if (toolCall) {
            const toolResult = this.parseToolArgs(toolCall.arguments);
            if (toolResult) {
                parsedResponse = this.buildResponseFromTool(
                    toolResult,
                    campground.SiteClass,
                    campground.Site,
                    mergedTokenMap
                );
            }
        }

        if (!parsedResponse) {
            parsedResponse = this.parseResponse(response.content, campground.SiteClass);
            parsedResponse.message = this.privacy.deanonymize(parsedResponse.message, mergedTokenMap);
            if (parsedResponse.clarifyingQuestions?.length) {
                parsedResponse.clarifyingQuestions = parsedResponse.clarifyingQuestions.map((q) =>
                    this.privacy.deanonymize(q, mergedTokenMap)
                );
            }
        }

        return this.finalizeGuestResponse(parsedResponse, context, campground.SiteClass, availableSiteTypes);
    }

    /**
     * Get site recommendations based on preferences
     */
    async getRecommendations(
        campgroundId: string,
        preferences: {
            dates: { arrival: string; departure: string };
            partySize: number;
            rvLength?: number;
            amenities?: string[];
            budget?: number;
        },
    ): Promise<SiteRecommendation[]> {
        await this.gate.assertFeatureEnabled(campgroundId, AiFeatureType.booking_assist);

        // Get site classes that match basic criteria
        const siteClasses = await this.prisma.siteClass.findMany({
            where: {
                campgroundId,
                isActive: true,
                maxOccupancy: { gte: preferences.partySize },
                ...(preferences.rvLength ? { rigMaxLength: { gte: preferences.rvLength } } : {}),
            },
            include: {
                Site: {
                    where: { status: 'available' },
                    take: 5,
                },
            },
        });

        // Score each site class
        const recommendations: SiteRecommendation[] = [];

        for (const sc of siteClasses) {
            const reasons: string[] = [];
            let score = 50; // Base score

            // Capacity match
            if (sc.maxOccupancy && sc.maxOccupancy >= preferences.partySize) {
                score += 10;
                reasons.push(`Fits ${preferences.partySize} guests`);
            }

            // RV length match
            if (preferences.rvLength && sc.rigMaxLength && Number(sc.rigMaxLength) >= preferences.rvLength) {
                score += 15;
                reasons.push(`Accommodates ${preferences.rvLength}ft RV`);
            }

            // Amenity matches
            const scAmenities = sc.amenityTags.length ? sc.amenityTags : sc.tags;
            const matchedAmenities = (preferences.amenities || []).filter(a =>
                scAmenities.some((sa) => sa.toLowerCase().includes(a.toLowerCase()))
            );
            if (matchedAmenities.length > 0) {
                score += matchedAmenities.length * 5;
                reasons.push(`Has ${matchedAmenities.join(', ')}`);
            }

            // Budget consideration
            if (preferences.budget && sc.defaultRate) {
                if (Number(sc.defaultRate) <= preferences.budget) {
                    score += 10;
                    reasons.push('Within budget');
                }
            }

            // Add first available site from this class
            if (sc.Site.length > 0) {
                recommendations.push({
                    siteId: sc.Site[0].id,
                    siteName: sc.Site[0].name,
                    siteClassName: sc.name,
                    matchScore: Math.min(100, score),
                    reasons,
                    available: true,
                });
            }
        }

        // Sort by score
        return recommendations.sort((a, b) => b.matchScore - a.matchScore).slice(0, 5);
    }

    private buildSystemPrompt(campground: CampgroundWithSites): string {
        const classLines = campground.SiteClass.map((sc) => {
            const rate =
                sc.defaultRate !== null && sc.defaultRate !== undefined
                    ? `$${(Number(sc.defaultRate) / 100).toFixed(0)}`
                    : 'N/A';
            const rigLength = sc.rigMaxLength ? `${sc.rigMaxLength}ft` : 'n/a';
            const hookups = [
                sc.hookupsPower ? 'power' : null,
                sc.hookupsWater ? 'water' : null,
                sc.hookupsSewer ? 'sewer' : null,
            ].filter(Boolean).join('/');
            const hookupsLabel = hookups || 'no hookups';
            const petLabel = sc.petFriendly ? 'pet-friendly' : 'no pets';
            const accessibility = sc.accessible ? 'accessible' : 'not accessible';
            return `- ${sc.name} (${sc.siteType}, up to ${sc.maxOccupancy} guests, ${rigLength}, ${hookupsLabel}, ${petLabel}, ${accessibility}, ${rate}/night)`;
        }).join('\n');

        return `You are the Active Campground AI Partner in PUBLIC GUEST MODE for ${campground.name}.
You guide guests to the best-fit site class and prefill an anonymous booking context. You do not create or confirm reservations.
This chat is session-only; do not request personal contact details.

Allowed:
- Ask non-PII preference questions (dates, flexibility, RV length, power needs, pets, accessibility, location features).
- Explain site classes, pricing ranges, and policies in plain language.
- Recommend best-fit site classes and alternatives if preferred options are unavailable.

Disallowed:
- Asking for or storing names, emails, phone numbers, addresses, or payment details.
- Creating, modifying, or confirming reservations.
- Calling any write-enabled reservation services.

Rig rules:
- If the guest has an RV, only recommend RV site classes.
- If the guest has a tent, only recommend tent site classes.
- If the guest wants a cabin or glamping, only recommend those classes.
- Ask for RV length if missing, and avoid classes that cannot fit it.

Availability rules:
- Only recommend site classes listed in REAL-TIME AVAILABILITY.
- If none are available, say so and offer flexible date options.

SITE CLASSES:
${classLines}

Output:
- Use the guest_assist_response tool only.
- action: search | book | clarify | info
- action=book means "prefill the booking form" (never confirm a reservation).
- Keep responses under 120 words.`;
    }

    private buildUserPrompt(
        message: string,
        context: BookingContext,
        availableSiteTypes: Set<string> | null = null,
    ): string {
        let prompt = `Guest message: "${message}"\n`;

        if (context.dates) {
            prompt += `\nDates: ${context.dates.arrival} to ${context.dates.departure}`;
        }
        if (context.partySize) {
            prompt += `\nParty: ${context.partySize.adults} adults, ${context.partySize.children} children`;
        }
        if (context.rigInfo) {
            prompt += `\nRV: ${context.rigInfo.type}, ${context.rigInfo.length}ft`;
        }
        if (context.preferences?.length) {
            prompt += `\nPreferences: ${context.preferences.join(', ')}`;
        }

        if (availableSiteTypes !== null) {
            prompt += `\n\nREAL-TIME AVAILABILITY FOR ${context.dates!.arrival} to ${context.dates!.departure}:`;
            if (availableSiteTypes.size === 0) {
                prompt += `\n- NO SITES AVAILABLE (Everything is sold out for these dates)`;
            } else {
                prompt += `\n- ${Array.from(availableSiteTypes).join('\n- ')}`;
            }
        }

        return prompt;
    }

    private buildTools() {
        return [
            {
                type: 'function',
                function: {
                    name: 'guest_assist_response',
                    description: 'Return a structured guest booking assistant response.',
                    parameters: {
                        type: 'object',
                        properties: {
                            message: { type: 'string' },
                            action: { type: 'string', enum: ['search', 'book', 'clarify', 'info'] },
                            questions: { type: 'array', items: { type: 'string' } },
                            recommendations: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        siteClassName: { type: 'string' },
                                        reasons: { type: 'array', items: { type: 'string' } },
                                        matchScore: { type: 'number' },
                                    },
                                    required: ['siteClassName'],
                                },
                            },
                            bookingDetails: {
                                type: 'object',
                                properties: {
                                    dates: {
                                        type: 'object',
                                        properties: {
                                            arrival: { type: 'string' },
                                            departure: { type: 'string' },
                                        },
                                    },
                                    partySize: {
                                        type: 'object',
                                        properties: {
                                            adults: { type: 'number' },
                                            children: { type: 'number' },
                                        },
                                    },
                                    rigInfo: {
                                        type: 'object',
                                        properties: {
                                            type: { type: 'string' },
                                            length: { type: 'number' },
                                        },
                                    },
                                    siteClassName: { type: 'string' },
                                    siteClassId: { type: 'string' },
                                    addOns: { type: 'array', items: { type: 'string' } },
                                },
                            },
                        },
                        required: ['message', 'action'],
                    },
                },
            },
        ];
    }

    private pickToolCall(toolCalls?: { name: string; arguments: string }[]) {
        if (!toolCalls?.length) return null;
        return toolCalls.find((call) => call.name === 'guest_assist_response') ?? toolCalls[0];
    }

    private parseToolArgs(args: string): unknown {
        try {
            return JSON.parse(args);
        } catch {
            return null;
        }
    }

    private buildHistory(history: { role: 'user' | 'assistant'; content: string }[], level: 'strict' | 'moderate' | 'minimal') {
        if (!history.length) return { historyText: '', historyTokenMap: new Map<string, string>() };
        const tokenMap = new Map<string, string>();
        const lines = history.slice(-8).map((entry) => {
            const result = this.privacy.anonymize(entry.content, level);
            result.tokenMap.forEach((value, key) => tokenMap.set(key, value));
            return `${entry.role.toUpperCase()}: ${result.anonymizedText}`;
        });
        return { historyText: lines.join('\n'), historyTokenMap: tokenMap };
    }

    private mergeTokenMaps(a: Map<string, string>, b: Map<string, string>) {
        const merged = new Map<string, string>();
        a.forEach((value, key) => merged.set(key, value));
        b.forEach((value, key) => merged.set(key, value));
        return merged;
    }

    private resolveTokenValue(value: unknown, tokenMap: Map<string, string>): unknown {
        if (typeof value === 'string') {
            return tokenMap.get(value) ?? value;
        }
        if (Array.isArray(value)) {
            return value.map((item) => this.resolveTokenValue(item, tokenMap));
        }
        if (isRecord(value)) {
            const resolved: Record<string, unknown> = {};
            for (const [key, item] of Object.entries(value)) {
                resolved[key] = this.resolveTokenValue(item, tokenMap);
            }
            return resolved;
        }
        return value;
    }

    private buildResponseFromTool(
        toolResult: unknown,
        siteClasses: SiteClassSummary[],
        sites: SiteSummary[],
        tokenMap: Map<string, string>
    ): BookingAssistResponse {
        const resolved = this.resolveTokenValue(toolResult, tokenMap);
        const resolvedRecord = isRecord(resolved) ? resolved : {};
        const response: BookingAssistResponse = {
            message: (toStringValue(resolvedRecord.message) ?? '').trim(),
            action: toToolAction(resolvedRecord.action),
        };

        const questions = toStringArray(resolvedRecord.questions);
        if (questions.length) {
            response.clarifyingQuestions = questions.map((q) => q.trim()).filter(Boolean);
        }

        if (Array.isArray(resolvedRecord.recommendations) && resolvedRecord.recommendations.length) {
            response.recommendations = resolvedRecord.recommendations.map((rec) => {
                const recRecord = isRecord(rec) ? rec : {};
                const name = toStringValue(recRecord.siteClassName) ?? toStringValue(recRecord.name) ?? '';
                const normalizedName = name.toLowerCase();
                const siteClass = siteClasses.find((sc) => sc.name.toLowerCase() === normalizedName);
                const site = siteClass ? sites.find((s) => s.siteClassId === siteClass.id) : null;
                const reasons = Array.isArray(recRecord.reasons)
                    ? toStringArray(recRecord.reasons)
                    : ['AI recommended'];
                return {
                    siteId: site?.id || '',
                    siteName: site?.name || String(name),
                    siteClassName: siteClass?.name || String(name),
                    matchScore: toNumberValue(recRecord.matchScore) ?? 80,
                    reasons,
                    available: true,
                };
            });
        }

        if (isRecord(resolvedRecord.bookingDetails)) {
            const bookingDetails = resolvedRecord.bookingDetails;
            const dates = isRecord(bookingDetails.dates) ? bookingDetails.dates : null;
            const partySize = isRecord(bookingDetails.partySize) ? bookingDetails.partySize : null;
            const rigInfo = isRecord(bookingDetails.rigInfo) ? bookingDetails.rigInfo : null;
            const arrival = dates ? toStringValue(dates.arrival) : undefined;
            const departure = dates ? toStringValue(dates.departure) : undefined;
            const adults = partySize ? toNumberValue(partySize.adults) : undefined;
            const children = partySize ? toNumberValue(partySize.children) : undefined;
            const rigType = rigInfo ? toStringValue(rigInfo.type) : undefined;
            const rigLength = rigInfo ? toNumberValue(rigInfo.length) : undefined;

            response.bookingDetails = {
                dates: arrival && departure ? { arrival, departure } : undefined,
                partySize: adults !== undefined && children !== undefined ? { adults, children } : undefined,
                rigInfo: rigType && rigLength !== undefined ? { type: rigType, length: rigLength } : undefined,
                siteClassId: toStringValue(bookingDetails.siteClassId),
                siteClassName: toStringValue(bookingDetails.siteClassName),
                addOns: toStringArray(bookingDetails.addOns),
            };
        }

        return response;
    }

    private finalizeGuestResponse(
        response: BookingAssistResponse,
        context: BookingContext,
        siteClasses: SiteClassSummary[],
        availableSiteTypes: Set<string> | null
    ): BookingAssistResponse {
        const normalized: BookingAssistResponse = {
            ...response,
            action: response.action || 'info',
            message: response.message?.trim() || 'How can I help with dates or site preferences?',
        };

        const bookingDetails = { ...(normalized.bookingDetails || {}) };
        bookingDetails.dates = bookingDetails.dates || context.dates;
        bookingDetails.partySize = bookingDetails.partySize || context.partySize;
        bookingDetails.rigInfo = bookingDetails.rigInfo || context.rigInfo;

        const siteClassName = bookingDetails.siteClassName || normalized.recommendations?.[0]?.siteClassName;
        if (siteClassName && !bookingDetails.siteClassId) {
            const match = siteClasses.find((sc) => sc.name.toLowerCase() === String(siteClassName).toLowerCase());
            if (match) {
                bookingDetails.siteClassId = match.id;
                bookingDetails.siteClassName = match.name;
            }
        }

        normalized.recommendations = this.filterRecommendations(
            normalized.recommendations,
            siteClasses,
            bookingDetails,
            availableSiteTypes
        );

        const safeQuestions = this.sanitizeQuestions(normalized.clarifyingQuestions || []);

        if (normalized.action === 'book') {
            const followups: string[] = [];
            const hasDates = bookingDetails.dates?.arrival && bookingDetails.dates?.departure;
            const rigType = String(bookingDetails.rigInfo?.type || '').toLowerCase();
            const wantsRig = ['rv', 'motor', 'trailer', 'fifth', 'camper', 'tent'].some((key) => rigType.includes(key));
            const hasParty = !!bookingDetails.partySize;
            const hasRigInfo = !!bookingDetails.rigInfo?.type;

            if (!hasDates) {
                followups.push('What are your arrival and departure dates?');
            }

            if (!hasParty && !hasRigInfo) {
                followups.push('How many guests, and are you bringing an RV, a tent, or looking for a cabin?');
            } else if (!hasParty && !wantsRig) {
                followups.push('How many guests will be staying?');
            }

            if (wantsRig && !bookingDetails.rigInfo?.length) {
                followups.push('What is the length of your RV or trailer?');
            }

            if (followups.length) {
                normalized.action = 'clarify';
                normalized.clarifyingQuestions = Array.from(new Set([...safeQuestions, ...followups]));
            } else {
                normalized.clarifyingQuestions = safeQuestions.length ? safeQuestions : undefined;
            }
        } else {
            normalized.clarifyingQuestions = safeQuestions.length ? safeQuestions : undefined;
        }

        if (availableSiteTypes && availableSiteTypes.size === 0) {
            normalized.action = normalized.action === 'book' ? 'info' : normalized.action;
        }

        normalized.bookingDetails = Object.values(bookingDetails).some((value) => value !== undefined)
            ? bookingDetails
            : undefined;

        return normalized;
    }

    private filterRecommendations(
        recommendations: SiteRecommendation[] | undefined,
        siteClasses: SiteClassSummary[],
        bookingDetails: BookingAssistResponse['bookingDetails'],
        availableSiteTypes: Set<string> | null
    ) {
        if (!recommendations?.length) return recommendations;

        const allowedTypes = this.resolveSiteTypeFilter(bookingDetails?.rigInfo?.type);
        const rigLength = bookingDetails?.rigInfo?.length;

        return recommendations.filter((rec) => {
            if (availableSiteTypes && !availableSiteTypes.has(rec.siteClassName)) {
                return false;
            }

            const siteClass = siteClasses.find((sc) => sc.name.toLowerCase() === rec.siteClassName.toLowerCase());
            if (!siteClass) return true;

            if (allowedTypes && !allowedTypes.has(siteClass.siteType)) {
                return false;
            }

            if (rigLength && siteClass.rigMaxLength && Number(siteClass.rigMaxLength) < rigLength) {
                return false;
            }

            return true;
        });
    }

    private resolveSiteTypeFilter(rigType?: string): Set<string> | null {
        if (!rigType) return null;
        const normalized = rigType.toLowerCase();
        if (normalized.includes('tent')) return new Set(['tent']);
        if (normalized.includes('cabin')) return new Set(['cabin', 'glamping']);
        if (normalized.includes('glamp') || normalized.includes('yurt')) return new Set(['glamping', 'cabin']);
        if (normalized.includes('group')) return new Set(['group']);
        if (['rv', 'motor', 'trailer', 'fifth', 'camper'].some((key) => normalized.includes(key))) {
            return new Set(['rv']);
        }
        return null;
    }

    private sanitizeQuestions(questions: string[]) {
        const blocked = [
            /name/i,
            /email/i,
            /phone/i,
            /contact/i,
            /address/i,
            /payment/i,
            /credit/i,
            /card/i,
            /zip/i,
            /postal/i,
        ];

        return questions.filter((question) => !blocked.some((pattern) => pattern.test(question)));
    }

    private parseResponse(content: string, siteClasses: SiteClassSummary[]): BookingAssistResponse {
        const result: BookingAssistResponse = {
            message: '',
            action: 'info',
        };

        // Parse action
        const actionMatch = content.match(/ACTION:\s*(search|book|clarify|info)/i);
        if (actionMatch) {
            result.action = toToolAction(actionMatch[1]);
        }

        // Parse DATES
        const datesMatch = content.match(/DATES:\s*(\d{4}-\d{2}-\d{2}),\s*(\d{4}-\d{2}-\d{2})/i);
        if (datesMatch) {
            result.bookingDetails = result.bookingDetails || {};
            result.bookingDetails.dates = { arrival: datesMatch[1], departure: datesMatch[2] };
        }

        // Parse PARTY
        const partyMatch = content.match(/PARTY:\s*(\d+),\s*(\d+)/i);
        if (partyMatch) {
            result.bookingDetails = result.bookingDetails || {};
            result.bookingDetails.partySize = { adults: parseInt(partyMatch[1]), children: parseInt(partyMatch[2]) };
        }

        // Parse RIG
        const rigMatch = content.match(/RIG:\s*(\d+),\s*([a-zA-Z\s]+)/i);
        if (rigMatch) {
            result.bookingDetails = result.bookingDetails || {};
            result.bookingDetails.rigInfo = { length: parseInt(rigMatch[1]), type: rigMatch[2].trim() };
        }

        // Parse clarifying questions
        const questionsMatch = content.match(/QUESTIONS:\s*(.+)/i);
        if (questionsMatch) {
            result.clarifyingQuestions = questionsMatch[1].split(',').map(q => q.trim());
        }

        // Parse recommendations
        const recsMatch = content.match(/RECOMMENDATIONS:\s*(.+)/i);
        if (recsMatch && siteClasses) {
            const recNames = recsMatch[1].split(',').map(r => r.trim().toLowerCase());
            result.recommendations = siteClasses
                .filter(sc => recNames.some(rn => sc.name.toLowerCase().includes(rn)))
                .map(sc => ({
                    siteId: '',
                    siteName: sc.name,
                    siteClassName: sc.name,
                    matchScore: 80,
                    reasons: ['AI recommended'],
                    available: true,
                }));
        }

        // Parse message
        const messageMatch = content.match(/MESSAGE:\s*(.+?)(?=ACTION:|QUESTIONS:|RECOMMENDATIONS:|DATES:|RIG:|PARTY:|$)/is);
        if (messageMatch) {
            result.message = messageMatch[1].trim();
        } else {
            // Fallback: Use content but strip out the metadata lines
            result.message = content
                .replace(/ACTION:.*(\n|$)/gi, '')
                .replace(/QUESTIONS:.*(\n|$)/gi, '')
                .replace(/RECOMMENDATIONS:.*(\n|$)/gi, '')
                .replace(/DATES:.*(\n|$)/gi, '')
                .replace(/PARTY:.*(\n|$)/gi, '')
                .replace(/RIG:.*(\n|$)/gi, '')
                .replace(/MESSAGE:/gi, '')
                .trim();
        }

        return result;
    }
}
