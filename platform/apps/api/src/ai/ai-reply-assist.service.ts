import { Injectable } from '@nestjs/common';
import { AiProviderService } from './ai-provider.service';
import { AiPrivacyService } from './ai-privacy.service';
import { AiFeatureGateService } from './ai-feature-gate.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiFeatureType } from '@prisma/client';

interface ReplyContext {
    campgroundId: string;
    conversationId: string;
    guestName?: string;
    guestEmail?: string;
    messageHistory: { role: 'guest' | 'staff'; content: string }[];
    siteName?: string;
    reservationDates?: { arrival: string; departure: string };
}

interface ReplySuggestion {
    suggestion: string;
    confidence: 'high' | 'medium' | 'low';
    tone: 'professional' | 'friendly' | 'formal';
}

@Injectable()
export class AiReplyAssistService {
    constructor(
        private readonly provider: AiProviderService,
        private readonly privacy: AiPrivacyService,
        private readonly gate: AiFeatureGateService,
        private readonly prisma: PrismaService,
    ) { }

    /**
     * Generate reply suggestions for a guest message
     */
    async generateReplySuggestions(
        context: ReplyContext,
        userId: string,
    ): Promise<ReplySuggestion[]> {
        // Check if feature is enabled
        await this.gate.assertFeatureEnabled(context.campgroundId, AiFeatureType.reply_assist);

        // Get campground context for tone/branding
        const campground = await this.prisma.campground.findUnique({
            where: { id: context.campgroundId },
            select: {
                name: true,
                brandingNote: true,
                checkInTime: true,
                checkOutTime: true,
                phone: true,
                email: true,
                aiAnonymizationLevel: true,
            },
        });

        if (!campground) {
            throw new Error('Campground not found');
        }

        // Anonymize conversation context
        const anonymizationLevel = campground.aiAnonymizationLevel as 'strict' | 'moderate' | 'minimal';
        const tokenMaps: Map<string, string>[] = [];

        // Anonymize guest info
        const { tokenMap: guestTokens } = this.privacy.anonymizeGuestContext({
            firstName: context.guestName?.split(' ')[0],
            lastName: context.guestName?.split(' ').slice(1).join(' '),
            email: context.guestEmail,
        });
        tokenMaps.push(guestTokens);

        // Anonymize message history
        const anonymizedHistory = context.messageHistory.map(msg => {
            const { anonymizedText, tokenMap } = this.privacy.anonymize(msg.content, anonymizationLevel);
            tokenMaps.push(tokenMap);
            return { role: msg.role, content: anonymizedText };
        });

        // Build system prompt
        const systemPrompt = this.buildSystemPrompt(campground);

        // Build user prompt with anonymized context
        const userPrompt = this.buildUserPrompt(anonymizedHistory, {
            siteName: context.siteName ? '[SITE]' : undefined,
            dates: context.reservationDates,
        });

        // Get AI response
        const response = await this.provider.getCompletion({
            campgroundId: context.campgroundId,
            featureType: AiFeatureType.reply_assist,
            systemPrompt,
            userPrompt,
            userId,
            maxTokens: 500,
            temperature: 0.7,
        });

        // Parse suggestions and de-anonymize
        const suggestions = this.parseSuggestions(response.content);

        // Merge all token maps for de-anonymization
        const mergedTokenMap = new Map<string, string>();
        for (const map of tokenMaps) {
            for (const [key, value] of map) {
                mergedTokenMap.set(key, value);
            }
        }

        // De-anonymize suggestions
        return suggestions.map(suggestion => ({
            ...suggestion,
            suggestion: this.privacy.deanonymize(suggestion.suggestion, mergedTokenMap),
        }));
    }

    /**
     * Learn from staff corrections to improve future suggestions
     */
    async recordFeedback(
        campgroundId: string,
        suggestionText: string,
        correctedText: string,
        wasUsed: boolean,
        userId: string,
    ): Promise<void> {
        // For now, just log this. In the future, could be used for fine-tuning or preference learning
        await this.prisma.aiInteractionLog.create({
            data: {
                campgroundId,
                featureType: AiFeatureType.reply_assist,
                promptHash: this.privacy.hashForAudit(`feedback:${suggestionText}`),
                responseHash: this.privacy.hashForAudit(`correction:${correctedText}`),
                tokensUsed: 0,
                latencyMs: 0,
                userId,
                success: true,
                provider: 'feedback',
                modelUsed: wasUsed ? 'accepted' : 'modified',
            },
        });
    }

    private buildSystemPrompt(campground: {
        name: string;
        brandingNote?: string | null;
        checkInTime?: string | null;
        checkOutTime?: string | null;
        phone?: string | null;
        email?: string | null;
    }): string {
        return `You are a helpful assistant for ${campground.name}, a campground/RV park.

Your job is to help staff respond to guest messages. Generate 2-3 reply suggestions that are:
- Professional yet friendly
- Helpful and informative
- On-brand for a welcoming outdoor hospitality business

Campground details (use when relevant):
- Check-in: ${campground.checkInTime || '3:00 PM'}
- Check-out: ${campground.checkOutTime || '11:00 AM'}
${campground.phone ? `- Phone: ${campground.phone}` : ''}
${campground.email ? `- Email: ${campground.email}` : ''}
${campground.brandingNote ? `- Brand voice: ${campground.brandingNote}` : ''}

IMPORTANT: 
- Never make up policies or information you don't have
- If unsure, suggest staff verify before responding
- Keep responses concise (2-4 sentences typical)
- Match the tone of the guest message

Output format:
SUGGESTION 1 [CONFIDENCE: high/medium/low] [TONE: professional/friendly/formal]
<reply text>

SUGGESTION 2 [CONFIDENCE: high/medium/low] [TONE: professional/friendly/formal]
<reply text>`;
    }

    private buildUserPrompt(
        history: { role: 'guest' | 'staff'; content: string }[],
        context: { siteName?: string; dates?: { arrival: string; departure: string } },
    ): string {
        let prompt = 'Recent conversation:\n\n';

        for (const msg of history.slice(-5)) { // Last 5 messages
            prompt += `${msg.role.toUpperCase()}: ${msg.content}\n\n`;
        }

        if (context.siteName || context.dates) {
            prompt += '\nContext:\n';
            if (context.siteName) prompt += `- Site: ${context.siteName}\n`;
            if (context.dates) prompt += `- Dates: ${context.dates.arrival} to ${context.dates.departure}\n`;
        }

        prompt += '\nGenerate 2-3 reply suggestions for the staff to send:';

        return prompt;
    }

    private parseSuggestions(content: string): ReplySuggestion[] {
        const suggestions: ReplySuggestion[] = [];
        const regex = /SUGGESTION \d+ \[CONFIDENCE: (high|medium|low)\] \[TONE: (professional|friendly|formal)\]\s*\n([\s\S]*?)(?=SUGGESTION \d+|$)/gi;

        let match;
        while ((match = regex.exec(content)) !== null) {
            suggestions.push({
                confidence: match[1].toLowerCase() as 'high' | 'medium' | 'low',
                tone: match[2].toLowerCase() as 'professional' | 'friendly' | 'formal',
                suggestion: match[3].trim(),
            });
        }

        // Fallback: if parsing fails, return the whole response as one suggestion
        if (suggestions.length === 0 && content.trim()) {
            suggestions.push({
                suggestion: content.trim(),
                confidence: 'medium',
                tone: 'friendly',
            });
        }

        return suggestions;
    }
}
