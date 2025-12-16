import { Injectable } from '@nestjs/common';
import { AiProviderService } from './ai-provider.service';
import { AiPrivacyService } from './ai-privacy.service';
import { AiFeatureGateService } from './ai-feature-gate.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiFeatureType, AiConsentType } from '@prisma/client';

interface BookingContext {
    campgroundId: string;
    sessionId: string;
    message: string;
    dates?: { arrival: string; departure: string };
    partySize?: { adults: number; children: number };
    rigInfo?: { type: string; length: number };
    preferences?: string[];
    history?: { role: 'user' | 'assistant'; content: string }[];
}

interface SiteRecommendation {
    siteId: string;
    siteName: string;
    siteClassName: string;
    matchScore: number; // 0-100
    reasons: string[];
    available: boolean;
}

interface BookingAssistResponse {
    message: string;
    recommendations?: SiteRecommendation[];
    clarifyingQuestions?: string[];
    action?: 'search' | 'book' | 'clarify' | 'info';
}

@Injectable()
export class AiBookingAssistService {
    constructor(
        private readonly provider: AiProviderService,
        private readonly privacy: AiPrivacyService,
        private readonly gate: AiFeatureGateService,
        private readonly prisma: PrismaService,
    ) { }

    /**
     * Process a booking assistant message
     */
    async chat(context: BookingContext): Promise<BookingAssistResponse> {
        // Check feature enabled
        await this.gate.assertFeatureEnabled(context.campgroundId, AiFeatureType.booking_assist);

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

        // Get campground and site data
        const campground = await this.prisma.campground.findUnique({
            where: { id: context.campgroundId },
            include: {
                siteClasses: {
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
                    },
                },
                sites: {
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

        // Anonymize context
        const { anonymizedText } = this.privacy.anonymize(context.message, 'moderate');

        // Fetch conversation history from DB if not provided in context
        // (DB history is only useful for metadata since content is hashed, but good as fallback)
        let historyMeta = [];
        if (!context.history || context.history.length === 0) {
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

        // Build system prompt
        const systemPrompt = this.buildSystemPrompt(campground);

        // Build user prompt with context AND history
        let userPrompt = this.buildUserPrompt(anonymizedText, context, campground.siteClasses);

        // Append conversation history
        if (context.history && context.history.length > 0) {
            userPrompt += "\n\nCONVERSATION HISTORY (Most recent first):";
            // Take the last 5 messages, excluding the current one if it was somehow included
            const recentHistory = context.history.slice(-5).reverse();

            for (const msg of recentHistory) {
                userPrompt += `\n${msg.role.toUpperCase()}: ${msg.content}`;
            }
        } else if (historyMeta.length > 0) {
            // Fallback to minimal context if we only have DB logs (hashed content)
            userPrompt += `\n\n(This is turn #${historyMeta.length + 1} of the conversation)`;
        }

        // If the context contains extracted entities (like dates), explicitly emphasize them
        if (context.dates || context.rigInfo || context.partySize || context.preferences) {
            userPrompt += "\n\nCRITICAL CONTEXT (Extracted from previous messages):";
            if (context.dates) userPrompt += `\n- Dates: ${context.dates.arrival} to ${context.dates.departure}`;
            if (context.partySize) userPrompt += `\n- Party: ${context.partySize.adults} adults, ${context.partySize.children} children`;
            if (context.rigInfo) userPrompt += `\n- Rig: ${context.rigInfo.length}ft ${context.rigInfo.type}`;
            if (context.preferences) userPrompt += `\n- Preferences: ${context.preferences.join(', ')}`;
        }

        // Get AI response
        const response = await this.provider.getCompletion({
            campgroundId: context.campgroundId,
            featureType: AiFeatureType.booking_assist,
            systemPrompt,
            userPrompt,
            sessionId: context.sessionId,
            maxTokens: 600,
            temperature: 0.7,
        });

        return this.parseResponse(response.content, campground.siteClasses as any);
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
                sites: {
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
            const scAmenities = sc.amenities || [];
            const matchedAmenities = (preferences.amenities || []).filter(a =>
                scAmenities.some((sa: string) => sa.toLowerCase().includes(a.toLowerCase()))
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
            if (sc.sites.length > 0) {
                recommendations.push({
                    siteId: sc.sites[0].id,
                    siteName: sc.sites[0].name,
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

    private buildSystemPrompt(campground: any): string {
        return `You are a helpful booking assistant for ${campground.name}.

Your job is to help guests find the perfect campsite. Be friendly, helpful, and concise.

Available site types:
${campground.siteClasses.map((sc: any) => `- ${sc.name}: ${sc.description || 'No description'} (up to ${sc.maxOccupancy} guests, $${sc.defaultRate ? (Number(sc.defaultRate) / 100).toFixed(0) : '??'}/night)`).join('\n')}

Guidelines:
- If the guest hasn't specified dates, ask for them
- If they mention an RV, ask about length if not specified
- Recommend specific site types based on their needs
- Keep responses under 100 words
- Don't make up policies or amenities not listed

Response format:
MESSAGE: <your response>
ACTION: search|book|clarify|info
QUESTIONS: <optional comma-separated clarifying questions>
RECOMMENDATIONS: <optional comma-separated site class names>`;
    }

    private buildUserPrompt(
        message: string,
        context: BookingContext,
        siteClasses: any[],
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

        return prompt;
    }

    private parseResponse(content: string, siteClasses: any[]): BookingAssistResponse {
        const result: BookingAssistResponse = {
            message: '',
            action: 'info',
        };

        // Parse message
        const messageMatch = content.match(/MESSAGE:\s*(.+?)(?=ACTION:|QUESTIONS:|RECOMMENDATIONS:|$)/is);
        if (messageMatch) {
            result.message = messageMatch[1].trim();
        } else {
            result.message = content.trim();
        }

        // Parse action
        const actionMatch = content.match(/ACTION:\s*(search|book|clarify|info)/i);
        if (actionMatch) {
            result.action = actionMatch[1].toLowerCase() as any;
        }

        // Parse questions
        const questionsMatch = content.match(/QUESTIONS:\s*(.+?)(?=RECOMMENDATIONS:|$)/is);
        if (questionsMatch) {
            result.clarifyingQuestions = questionsMatch[1].split(',').map(q => q.trim()).filter(Boolean);
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

        return result;
    }
}
