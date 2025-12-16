import { Injectable } from '@nestjs/common';
import { AiProviderService } from './ai-provider.service';
import { AiFeatureGateService } from './ai-feature-gate.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiFeatureType } from '@prisma/client';

interface InsightQuery {
    campgroundId: string;
    question: string;
    userId: string;
}

interface InsightResult {
    answer: string;
    dataPoints?: {
        label: string;
        value: string | number;
        change?: number; // Percentage change from previous period
    }[];
    chartData?: {
        type: 'bar' | 'line' | 'pie';
        labels: string[];
        values: number[];
    };
    suggestions?: string[];
}

interface AutoInsight {
    title: string;
    summary: string;
    priority: 'high' | 'medium' | 'low';
    category: 'revenue' | 'occupancy' | 'guest_satisfaction' | 'operations' | 'anomaly';
    actionable: boolean;
    suggestedAction?: string;
}

@Injectable()
export class AiInsightsService {
    constructor(
        private readonly provider: AiProviderService,
        private readonly gate: AiFeatureGateService,
        private readonly prisma: PrismaService,
    ) { }

    /**
     * Answer a natural language analytics question
     */
    async askQuestion(query: InsightQuery): Promise<InsightResult> {
        await this.gate.assertFeatureEnabled(query.campgroundId, AiFeatureType.analytics);

        // First, gather relevant data based on the question
        const campgroundData = await this.gatherCampgroundData(query.campgroundId);

        const systemPrompt = `You are an analytics assistant for a campground management system.
You have access to the following data about the campground:

${JSON.stringify(campgroundData, null, 2)}

Answer the user's question based on this data. Be specific and include numbers when available.
If you can't answer the question with the available data, say so clearly.

Format your response as:
ANSWER: <your answer>

DATA_POINTS (optional, if relevant metrics):
- Label: value (change: +/-X%)

SUGGESTIONS (optional, 1-2 actionable recommendations):
- suggestion 1
- suggestion 2`;

        const response = await this.provider.getCompletion({
            campgroundId: query.campgroundId,
            featureType: AiFeatureType.analytics,
            systemPrompt,
            userPrompt: query.question,
            userId: query.userId,
            maxTokens: 600,
            temperature: 0.3, // Lower temperature for more factual responses
        });

        return this.parseInsightResponse(response.content);
    }

    /**
     * Generate automatic daily insights
     */
    async generateDailyInsights(campgroundId: string): Promise<AutoInsight[]> {
        await this.gate.assertFeatureEnabled(campgroundId, AiFeatureType.analytics);

        const data = await this.gatherCampgroundData(campgroundId);

        const systemPrompt = `You are an analytics assistant. Analyze the campground data and identify the 3-5 most important insights for today.

Focus on:
1. Unusual patterns or anomalies
2. Revenue opportunities
3. Occupancy trends
4. Operational concerns
5. Guest satisfaction signals

Campground data:
${JSON.stringify(data, null, 2)}

For each insight, provide:
- A clear title (5-10 words)
- A brief summary (1-2 sentences)
- Priority (high/medium/low)
- Category (revenue/occupancy/guest_satisfaction/operations/anomaly)
- Whether it's actionable (true/false)
- A suggested action if actionable

Format:
INSIGHT 1:
Title: <title>
Summary: <summary>
Priority: high/medium/low
Category: revenue/occupancy/guest_satisfaction/operations/anomaly
Actionable: true/false
Action: <suggested action or "N/A">`;

        const response = await this.provider.getCompletion({
            campgroundId,
            featureType: AiFeatureType.analytics,
            systemPrompt,
            userPrompt: 'Generate today\'s key insights.',
            maxTokens: 800,
            temperature: 0.5,
        });

        return this.parseAutoInsights(response.content);
    }

    private async gatherCampgroundData(campgroundId: string): Promise<Record<string, unknown>> {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Gather various metrics
        const [
            campground,
            recentReservations,
            siteStats,
            revenueStats,
        ] = await Promise.all([
            this.prisma.campground.findUnique({
                where: { id: campgroundId },
                select: {
                    name: true,
                    reviewScore: true,
                    reviewCount: true,
                    _count: { select: { sites: true, reservations: true } },
                },
            }),
            this.prisma.reservation.count({
                where: {
                    campgroundId,
                    createdAt: { gte: sevenDaysAgo },
                },
            }),
            this.prisma.site.groupBy({
                by: ['siteType'],
                where: { campgroundId },
                _count: { id: true },
            }),
            this.prisma.payment.aggregate({
                where: {
                    campgroundId,
                    status: 'succeeded',
                    createdAt: { gte: thirtyDaysAgo },
                },
                _sum: { amountCents: true },
                _count: { id: true },
            }),
        ]);

        // Calculate occupancy for next 7 days
        const upcomingReservations = await this.prisma.reservation.count({
            where: {
                campgroundId,
                status: { in: ['confirmed', 'pending'] },
                arrivalDate: { lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
                departureDate: { gte: now },
            },
        });

        const totalSites = campground?._count?.sites || 0;
        const occupancyRate = totalSites > 0 ? Math.round((upcomingReservations / totalSites) * 100) : 0;

        return {
            campgroundName: campground?.name,
            metrics: {
                totalSites,
                totalReservationsAllTime: campground?._count?.reservations || 0,
                reservationsLast7Days: recentReservations,
                revenueLast30Days: revenueStats._sum.amountCents
                    ? `$${(revenueStats._sum.amountCents / 100).toLocaleString()}`
                    : '$0',
                paymentsLast30Days: revenueStats._count || 0,
                currentOccupancyRate: `${occupancyRate}%`,
                reviewScore: campground?.reviewScore ? Number(campground.reviewScore) : null,
                reviewCount: campground?.reviewCount || 0,
            },
            siteBreakdown: siteStats.map(s => ({
                type: s.siteType,
                count: s._count.id,
            })),
            dateContext: {
                today: now.toISOString().split('T')[0],
                dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long' }),
            },
        };
    }

    private parseInsightResponse(content: string): InsightResult {
        const result: InsightResult = {
            answer: '',
        };

        // Parse answer
        const answerMatch = content.match(/ANSWER:\s*([\s\S]*?)(?=DATA_POINTS|SUGGESTIONS|$)/i);
        if (answerMatch) {
            result.answer = answerMatch[1].trim();
        } else {
            result.answer = content.trim();
        }

        // Parse data points
        const dataPointsMatch = content.match(/DATA_POINTS[\s\S]*?(?=SUGGESTIONS|$)/i);
        if (dataPointsMatch) {
            const dataPoints: typeof result.dataPoints = [];
            const lines = dataPointsMatch[0].split('\n').slice(1);
            for (const line of lines) {
                const match = line.match(/-\s*(.+?):\s*(.+?)(?:\s*\(change:\s*([+-]?\d+)%\))?$/i);
                if (match) {
                    dataPoints.push({
                        label: match[1].trim(),
                        value: match[2].trim(),
                        change: match[3] ? parseInt(match[3]) : undefined,
                    });
                }
            }
            if (dataPoints.length > 0) {
                result.dataPoints = dataPoints;
            }
        }

        // Parse suggestions
        const suggestionsMatch = content.match(/SUGGESTIONS[\s\S]*$/i);
        if (suggestionsMatch) {
            const suggestions: string[] = [];
            const lines = suggestionsMatch[0].split('\n').slice(1);
            for (const line of lines) {
                const cleaned = line.replace(/^-\s*/, '').trim();
                if (cleaned) {
                    suggestions.push(cleaned);
                }
            }
            if (suggestions.length > 0) {
                result.suggestions = suggestions;
            }
        }

        return result;
    }

    private parseAutoInsights(content: string): AutoInsight[] {
        const insights: AutoInsight[] = [];
        const insightBlocks = content.split(/INSIGHT \d+:/i).slice(1);

        for (const block of insightBlocks) {
            const titleMatch = block.match(/Title:\s*(.+)/i);
            const summaryMatch = block.match(/Summary:\s*(.+)/i);
            const priorityMatch = block.match(/Priority:\s*(high|medium|low)/i);
            const categoryMatch = block.match(/Category:\s*(revenue|occupancy|guest_satisfaction|operations|anomaly)/i);
            const actionableMatch = block.match(/Actionable:\s*(true|false)/i);
            const actionMatch = block.match(/Action:\s*(.+)/i);

            if (titleMatch && summaryMatch) {
                insights.push({
                    title: titleMatch[1].trim(),
                    summary: summaryMatch[1].trim(),
                    priority: (priorityMatch?.[1]?.toLowerCase() as 'high' | 'medium' | 'low') || 'medium',
                    category: (categoryMatch?.[1]?.toLowerCase() as AutoInsight['category']) || 'operations',
                    actionable: actionableMatch?.[1]?.toLowerCase() === 'true',
                    suggestedAction: actionMatch?.[1]?.trim() !== 'N/A' ? actionMatch?.[1]?.trim() : undefined,
                });
            }
        }

        return insights;
    }
}
