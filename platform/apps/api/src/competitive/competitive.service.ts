import { Injectable, NotFoundException, BadRequestException, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import {
    CreateCompetitorDto,
    UpdateCompetitorDto,
    CreateCompetitorRateDto,
    UpdateCompetitorRateDto,
    MarketPositionResponse,
    RateParityCheckResult,
    RateTrendResponse,
} from "./dto/competitive.dto";

@Injectable()
export class CompetitiveService {
    private readonly logger = new Logger(CompetitiveService.name);

    constructor(private readonly prisma: PrismaService) {}

    // =============================================================================
    // COMPETITOR CRUD
    // =============================================================================

    async createCompetitor(data: CreateCompetitorDto) {
        return this.prisma.competitor.create({
            data: {
                campgroundId: data.campgroundId,
                name: data.name.trim(),
                url: data.url?.trim() || null,
                notes: data.notes?.trim() || null,
                isActive: data.isActive ?? true,
            },
            include: {
                rates: {
                    orderBy: { capturedAt: "desc" },
                    take: 5,
                },
            },
        });
    }

    async findAllCompetitors(campgroundId: string, includeInactive = false) {
        return this.prisma.competitor.findMany({
            where: {
                campgroundId,
                ...(includeInactive ? {} : { isActive: true }),
            },
            include: {
                rates: {
                    orderBy: { capturedAt: "desc" },
                    take: 1, // Latest rate per competitor
                },
            },
            orderBy: { name: "asc" },
        });
    }

    async findCompetitorById(id: string) {
        const competitor = await this.prisma.competitor.findUnique({
            where: { id },
            include: {
                rates: {
                    orderBy: { capturedAt: "desc" },
                },
            },
        });

        if (!competitor) {
            throw new NotFoundException(`Competitor ${id} not found`);
        }

        return competitor;
    }

    async updateCompetitor(id: string, data: UpdateCompetitorDto) {
        await this.findCompetitorById(id); // Validate existence

        return this.prisma.competitor.update({
            where: { id },
            data: {
                name: data.name?.trim(),
                url: data.url?.trim(),
                notes: data.notes?.trim(),
                isActive: data.isActive,
            },
            include: {
                rates: {
                    orderBy: { capturedAt: "desc" },
                    take: 5,
                },
            },
        });
    }

    async deleteCompetitor(id: string) {
        await this.findCompetitorById(id); // Validate existence

        return this.prisma.competitor.delete({
            where: { id },
        });
    }

    // =============================================================================
    // COMPETITOR RATE CRUD
    // =============================================================================

    async createRate(data: CreateCompetitorRateDto) {
        // Validate competitor exists
        const competitor = await this.prisma.competitor.findUnique({
            where: { id: data.competitorId },
        });

        if (!competitor) {
            throw new NotFoundException(`Competitor ${data.competitorId} not found`);
        }

        return this.prisma.competitorRate.create({
            data: {
                competitorId: data.competitorId,
                siteType: data.siteType,
                rateNightly: data.rateNightly,
                source: data.source,
                validFrom: data.validFrom ? new Date(data.validFrom) : null,
                validTo: data.validTo ? new Date(data.validTo) : null,
                notes: data.notes?.trim() || null,
            },
            include: {
                competitor: true,
            },
        });
    }

    async findRatesByCompetitor(competitorId: string) {
        return this.prisma.competitorRate.findMany({
            where: { competitorId },
            orderBy: { capturedAt: "desc" },
            include: {
                competitor: true,
            },
        });
    }

    async findRatesByCampground(campgroundId: string, siteType?: string) {
        return this.prisma.competitorRate.findMany({
            where: {
                competitor: {
                    campgroundId,
                    isActive: true,
                },
                ...(siteType ? { siteType } : {}),
            },
            orderBy: { capturedAt: "desc" },
            include: {
                competitor: true,
            },
        });
    }

    async findRateById(id: string) {
        const rate = await this.prisma.competitorRate.findUnique({
            where: { id },
            include: { competitor: true },
        });

        if (!rate) {
            throw new NotFoundException(`Rate ${id} not found`);
        }

        return rate;
    }

    async updateRate(id: string, data: UpdateCompetitorRateDto) {
        await this.findRateById(id); // Validate existence

        return this.prisma.competitorRate.update({
            where: { id },
            data: {
                siteType: data.siteType,
                rateNightly: data.rateNightly,
                source: data.source,
                validFrom: data.validFrom ? new Date(data.validFrom) : undefined,
                validTo: data.validTo ? new Date(data.validTo) : undefined,
                notes: data.notes?.trim(),
            },
            include: {
                competitor: true,
            },
        });
    }

    async deleteRate(id: string) {
        await this.findRateById(id); // Validate existence

        return this.prisma.competitorRate.delete({
            where: { id },
        });
    }

    // =============================================================================
    // RATE COMPARISON & MARKET POSITIONING
    // =============================================================================

    /**
     * Compare your rates against competitors for a specific site type
     */
    async getCompetitorComparison(
        campgroundId: string,
        siteType: string,
        date?: Date
    ): Promise<MarketPositionResponse> {
        // Get your own rate (from site classes)
        const yourSiteClass = await this.prisma.siteClass.findFirst({
            where: {
                campgroundId,
                siteType: siteType as any,
            },
        });

        if (!yourSiteClass) {
            throw new BadRequestException(`No site class found for type ${siteType}`);
        }

        const yourRate = yourSiteClass.defaultRate;

        // Get latest competitor rates for this site type
        const competitorRates = await this.prisma.competitorRate.findMany({
            where: {
                competitor: {
                    campgroundId,
                    isActive: true,
                },
                siteType,
                // Only include rates that are currently valid
                OR: [
                    { validFrom: null, validTo: null },
                    {
                        validFrom: { lte: date || new Date() },
                        validTo: { gte: date || new Date() },
                    },
                    { validFrom: { lte: date || new Date() }, validTo: null },
                    { validFrom: null, validTo: { gte: date || new Date() } },
                ],
            },
            orderBy: { capturedAt: "desc" },
            include: {
                competitor: true,
            },
            distinct: ["competitorId"], // Only latest rate per competitor
        });

        // Build comparison data
        const comparisons = competitorRates.map((cr: { competitorId: string; competitor: { name: string }; rateNightly: number }) => ({
            competitorId: cr.competitorId,
            competitorName: cr.competitor.name,
            rate: cr.rateNightly,
            difference: yourRate - cr.rateNightly,
            percentDifference:
                cr.rateNightly > 0
                    ? Math.round(((yourRate - cr.rateNightly) / cr.rateNightly) * 100)
                    : 0,
        }));

        // Calculate market stats
        const allRates = [yourRate, ...comparisons.map((c: { rate: number }) => c.rate)];
        const sortedRates = [...allRates].sort((a: number, b: number) => a - b);
        const yourPosition = sortedRates.indexOf(yourRate) + 1;

        const positionLabel = this.getPositionLabel(yourPosition, sortedRates.length, siteType);

        return {
            siteType,
            yourRate,
            competitorRates: comparisons.sort((a: { rate: number }, b: { rate: number }) => a.rate - b.rate),
            position: yourPosition,
            totalCompetitors: sortedRates.length,
            positionLabel,
            averageMarketRate: Math.round(
                allRates.reduce((sum, r) => sum + r, 0) / allRates.length
            ),
            lowestRate: sortedRates[0],
            highestRate: sortedRates[sortedRates.length - 1],
        };
    }

    private getPositionLabel(position: number, total: number, siteType: string): string {
        const ordinal = this.getOrdinal(position);
        const siteLabel = siteType.replace(/_/g, " ").toUpperCase();

        if (position === 1) {
            return `Lowest price for ${siteLabel}`;
        } else if (position === total) {
            return `Highest price for ${siteLabel}`;
        } else {
            return `${ordinal} cheapest for ${siteLabel}`;
        }
    }

    private getOrdinal(n: number): string {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    }

    /**
     * Get overall market position across all site types
     */
    async getMarketPosition(campgroundId: string): Promise<MarketPositionResponse[]> {
        // Get all site types you offer
        const yourSiteClasses = await this.prisma.siteClass.findMany({
            where: { campgroundId },
            select: { siteType: true },
            distinct: ["siteType"],
        });

        const positions: MarketPositionResponse[] = [];

        for (const sc of yourSiteClasses) {
            try {
                const comparison = await this.getCompetitorComparison(
                    campgroundId,
                    sc.siteType
                );
                positions.push(comparison);
            } catch {
                // Skip site types with no data
            }
        }

        return positions;
    }

    // =============================================================================
    // RATE PARITY ALERTS
    // =============================================================================

    /**
     * Check if any OTA rates are cheaper than direct rates
     */
    async checkRateParity(campgroundId: string): Promise<RateParityCheckResult> {
        const alerts: RateParityCheckResult["alerts"] = [];

        // Get your site classes with rates
        const siteClasses = await this.prisma.siteClass.findMany({
            where: { campgroundId },
        });

        // Get latest OTA-sourced competitor rates
        const otaRates = await this.prisma.competitorRate.findMany({
            where: {
                competitor: {
                    campgroundId,
                    isActive: true,
                },
                source: "ota",
                // Only current rates
                OR: [
                    { validFrom: null, validTo: null },
                    {
                        validFrom: { lte: new Date() },
                        validTo: { gte: new Date() },
                    },
                ],
            },
            orderBy: { capturedAt: "desc" },
            include: {
                competitor: true,
            },
        });

        // Check each site type for parity issues
        for (const sc of siteClasses) {
            const otaRatesForType = otaRates.filter((r: { siteType: string }) => r.siteType === sc.siteType);

            for (const otaRate of otaRatesForType) {
                if (otaRate.rateNightly < sc.defaultRate) {
                    alerts.push({
                        siteType: sc.siteType,
                        directRate: sc.defaultRate,
                        otaRate: otaRate.rateNightly,
                        otaSource: otaRate.competitor.name,
                        difference: sc.defaultRate - otaRate.rateNightly,
                    });
                }
            }
        }

        return {
            hasParityIssues: alerts.length > 0,
            alerts,
        };
    }

    /**
     * Cron job: Daily rate parity check for all campgrounds
     */
    @Cron(CronExpression.EVERY_DAY_AT_6AM)
    async dailyRateParityCheck() {
        this.logger.log("Running daily rate parity check...");

        // Get all campgrounds with active competitors
        const campgroundsWithCompetitors = await this.prisma.competitor.findMany({
            where: { isActive: true },
            select: { campgroundId: true },
            distinct: ["campgroundId"],
        });

        for (const { campgroundId } of campgroundsWithCompetitors) {
            try {
                const result = await this.checkRateParity(campgroundId);

                if (result.hasParityIssues) {
                    // Create alerts for each parity issue
                    for (const alert of result.alerts) {
                        // Check if similar alert already exists
                        const existingAlert = await this.prisma.rateParityAlert.findFirst({
                            where: {
                                campgroundId,
                                siteType: alert.siteType,
                                otaSource: alert.otaSource,
                                status: "active",
                            },
                        });

                        if (!existingAlert) {
                            await this.prisma.rateParityAlert.create({
                                data: {
                                    campgroundId,
                                    siteType: alert.siteType,
                                    directRateCents: alert.directRate,
                                    otaRateCents: alert.otaRate,
                                    otaSource: alert.otaSource,
                                    difference: alert.difference,
                                },
                            });

                            this.logger.warn(
                                `Rate parity issue: ${alert.otaSource} has ${alert.siteType} at $${(alert.otaRate / 100).toFixed(2)} vs direct $${(alert.directRate / 100).toFixed(2)}`
                            );
                        }
                    }
                }
            } catch (error) {
                this.logger.error(
                    `Rate parity check failed for campground ${campgroundId}`,
                    error instanceof Error ? error.stack : undefined
                );
            }
        }

        this.logger.log("Daily rate parity check completed");
    }

    // =============================================================================
    // RATE PARITY ALERT MANAGEMENT
    // =============================================================================

    async findActiveAlerts(campgroundId: string) {
        return this.prisma.rateParityAlert.findMany({
            where: {
                campgroundId,
                status: "active",
            },
            orderBy: { createdAt: "desc" },
        });
    }

    async findAllAlerts(campgroundId: string, status?: string) {
        return this.prisma.rateParityAlert.findMany({
            where: {
                campgroundId,
                ...(status ? { status: status as any } : {}),
            },
            orderBy: { createdAt: "desc" },
        });
    }

    async acknowledgeAlert(id: string, userId: string) {
        const alert = await this.prisma.rateParityAlert.findUnique({
            where: { id },
        });

        if (!alert) {
            throw new NotFoundException(`Alert ${id} not found`);
        }

        return this.prisma.rateParityAlert.update({
            where: { id },
            data: {
                status: "acknowledged",
                acknowledgedBy: userId,
                acknowledgedAt: new Date(),
            },
        });
    }

    async resolveAlert(id: string) {
        const alert = await this.prisma.rateParityAlert.findUnique({
            where: { id },
        });

        if (!alert) {
            throw new NotFoundException(`Alert ${id} not found`);
        }

        return this.prisma.rateParityAlert.update({
            where: { id },
            data: {
                status: "resolved",
                resolvedAt: new Date(),
            },
        });
    }

    // =============================================================================
    // HISTORICAL RATE TRENDS
    // =============================================================================

    /**
     * Get historical rate trends for competitors
     */
    async getRateTrends(
        campgroundId: string,
        siteType: string,
        startDate?: Date,
        endDate?: Date
    ): Promise<RateTrendResponse> {
        const start = startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days ago
        const end = endDate || new Date();

        const rates = await this.prisma.competitorRate.findMany({
            where: {
                competitor: {
                    campgroundId,
                    isActive: true,
                },
                siteType,
                capturedAt: {
                    gte: start,
                    lte: end,
                },
            },
            orderBy: { capturedAt: "asc" },
            include: {
                competitor: true,
            },
        });

        // Group by competitor
        const trendsByCompetitor = new Map<
            string,
            { competitorId: string; competitorName: string; dataPoints: Array<{ date: string; rate: number }> }
        >();

        for (const rate of rates) {
            const key = rate.competitorId;
            if (!trendsByCompetitor.has(key)) {
                trendsByCompetitor.set(key, {
                    competitorId: rate.competitorId,
                    competitorName: rate.competitor.name,
                    dataPoints: [],
                });
            }

            trendsByCompetitor.get(key)!.dataPoints.push({
                date: rate.capturedAt.toISOString().split("T")[0],
                rate: rate.rateNightly,
            });
        }

        return {
            siteType,
            trends: Array.from(trendsByCompetitor.values()),
        };
    }

    // =============================================================================
    // BULK OPERATIONS
    // =============================================================================

    /**
     * Bulk import competitor rates (for batch manual entry)
     */
    async bulkCreateRates(
        rates: Array<{
            competitorId: string;
            siteType: string;
            rateNightly: number;
            source?: string;
            notes?: string;
        }>
    ) {
        // Validate all competitor IDs exist
        const competitorIds = [...new Set(rates.map((r) => r.competitorId))];
        const competitors = await this.prisma.competitor.findMany({
            where: { id: { in: competitorIds } },
            select: { id: true },
        });

        const validIds = new Set(competitors.map((c: { id: string }) => c.id));
        const invalidIds = competitorIds.filter((id) => !validIds.has(id));

        if (invalidIds.length > 0) {
            throw new BadRequestException(
                `Invalid competitor IDs: ${invalidIds.join(", ")}`
            );
        }

        return this.prisma.competitorRate.createMany({
            data: rates.map((r) => ({
                competitorId: r.competitorId,
                siteType: r.siteType,
                rateNightly: r.rateNightly,
                source: r.source || "manual",
                notes: r.notes || null,
            })),
        });
    }
}
