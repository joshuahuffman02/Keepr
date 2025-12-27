import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { Cron, CronExpression } from "@nestjs/schedule";

type ReportType = "occupancy_summary" | "revenue_summary" | "arrivals_departures" |
    "maintenance_summary" | "reservation_activity" | "guest_activity" | "financial_summary";
type ReportFrequency = "daily" | "weekly" | "monthly";

@Injectable()
export class ReportSubscriptionService {
    private readonly logger = new Logger(ReportSubscriptionService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly emailService: EmailService,
    ) { }

    async findByUser(userId: string) {
        return this.prisma.reportSubscription.findMany({
            where: { userId },
            orderBy: { reportType: "asc" },
        });
    }

    async findByCampground(campgroundId: string) {
        return this.prisma.reportSubscription.findMany({
            where: { campgroundId },
            orderBy: { reportType: "asc" },
        });
    }

    async create(data: {
        userId: string;
        userEmail: string;
        campgroundId?: string;
        reportType: ReportType;
        frequency: ReportFrequency;
        deliveryTime?: string;
        dayOfWeek?: number;
        dayOfMonth?: number;
    }) {
        const nextSendAt = this.calculateNextSendAt(data.frequency, data.dayOfWeek, data.dayOfMonth);

        return this.prisma.reportSubscription.create({
            data: {
                ...data,
                nextSendAt,
            } as any,
        });
    }

    async update(id: string, data: {
        enabled?: boolean;
        frequency?: ReportFrequency;
        deliveryTime?: string;
        dayOfWeek?: number;
        dayOfMonth?: number;
    }) {
        const subscription = await this.prisma.reportSubscription.findUnique({ where: { id } });
        if (!subscription) throw new NotFoundException("Subscription not found");

        const nextSendAt = this.calculateNextSendAt(
            (data.frequency as ReportFrequency) || (subscription.frequency as ReportFrequency),
            data.dayOfWeek ?? subscription.dayOfWeek ?? undefined,
            data.dayOfMonth ?? subscription.dayOfMonth ?? undefined
        );

        return this.prisma.reportSubscription.update({
            where: { id },
            data: {
                ...data,
                nextSendAt,
            } as any,
        });
    }

    async delete(id: string) {
        return this.prisma.reportSubscription.delete({ where: { id } });
    }

    private calculateNextSendAt(frequency: ReportFrequency, dayOfWeek?: number, dayOfMonth?: number): Date {
        const now = new Date();
        const next = new Date(now);
        next.setHours(8, 0, 0, 0); // Default to 8 AM

        switch (frequency) {
            case "daily":
                if (now.getHours() >= 8) {
                    next.setDate(next.getDate() + 1);
                }
                break;
            case "weekly":
                const targetDay = dayOfWeek ?? 1; // Default Monday
                const currentDay = now.getDay();
                const daysUntil = (targetDay - currentDay + 7) % 7 || 7;
                next.setDate(next.getDate() + daysUntil);
                break;
            case "monthly":
                const targetDate = dayOfMonth ?? 1;
                next.setDate(targetDate);
                if (next <= now) {
                    next.setMonth(next.getMonth() + 1);
                }
                break;
        }

        return next;
    }

    // Run every hour to check for reports to send
    @Cron(CronExpression.EVERY_HOUR)
    async processScheduledReports() {
        const now = new Date();

        const dueSubscriptions = await this.prisma.reportSubscription.findMany({
            where: {
                enabled: true,
                nextSendAt: { lte: now },
            },
        });

        this.logger.log(`Processing ${dueSubscriptions.length} scheduled reports`);

        for (const subscription of dueSubscriptions) {
            try {
                await this.generateAndSendReport(subscription);

                // Update last sent and next send times
                const nextSendAt = this.calculateNextSendAt(
                    subscription.frequency as ReportFrequency,
                    subscription.dayOfWeek ?? undefined,
                    subscription.dayOfMonth ?? undefined
                );

                await this.prisma.reportSubscription.update({
                    where: { id: subscription.id },
                    data: {
                        lastSentAt: now,
                        nextSendAt,
                    },
                });

                this.logger.log(`Sent ${subscription.reportType} report to ${subscription.userEmail}`);
            } catch (err) {
                this.logger.error(`Failed to send report ${subscription.id}: ${err}`);
            }
        }
    }

    private async generateAndSendReport(subscription: any) {
        // Get campground name if applicable
        let campgroundName: string | undefined;
        if (subscription.campgroundId) {
            const campground = await this.prisma.campground.findUnique({
                where: { id: subscription.campgroundId },
                select: { name: true },
            });
            campgroundName = campground?.name;
        }

        // Generate report data based on type
        const reportData = await this.generateReportData(
            subscription.reportType,
            subscription.campgroundId,
            subscription.frequency as ReportFrequency
        );

        // Send the email
        await this.emailService.sendScheduledReport({
            to: subscription.userEmail,
            reportName: this.getReportDisplayName(subscription.reportType),
            campgroundName,
            period: this.getPeriodLabel(subscription.frequency as ReportFrequency),
            summary: reportData.summary,
            metrics: reportData.metrics,
            reportUrl: reportData.reportUrl,
        });
    }

    private getReportDisplayName(type: string): string {
        const names: Record<string, string> = {
            occupancy_summary: "Occupancy Summary",
            revenue_summary: "Revenue Summary",
            arrivals_departures: "Arrivals & Departures",
            maintenance_summary: "Maintenance Summary",
            reservation_activity: "Reservation Activity",
            guest_activity: "Guest Activity",
            financial_summary: "Financial Summary",
        };
        return names[type] || type;
    }

    private getPeriodLabel(frequency: ReportFrequency): string {
        const now = new Date();
        switch (frequency) {
            case "daily":
                return now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
            case "weekly":
                const weekStart = new Date(now);
                weekStart.setDate(now.getDate() - 7);
                return `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
            case "monthly":
                return now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
            default:
                return "Report";
        }
    }

    private async generateReportData(type: string, campgroundId: string | null, frequency: ReportFrequency): Promise<{
        summary: string;
        metrics?: { label: string; value: string }[];
        reportUrl?: string;
    }> {
        // Calculate date range based on frequency
        const now = new Date();
        const startDate = new Date(now);

        switch (frequency) {
            case "daily":
                startDate.setDate(now.getDate() - 1);
                break;
            case "weekly":
                startDate.setDate(now.getDate() - 7);
                break;
            case "monthly":
                startDate.setMonth(now.getMonth() - 1);
                break;
        }

        // Generate data based on report type
        switch (type) {
            case "occupancy_summary":
                return await this.generateOccupancyReport(campgroundId, startDate, now);
            case "revenue_summary":
                return await this.generateRevenueReport(campgroundId, startDate, now);
            case "arrivals_departures":
                return await this.generateArrivalsReport(campgroundId, startDate, now);
            case "maintenance_summary":
                return await this.generateMaintenanceReport(campgroundId, startDate, now);
            case "reservation_activity":
                return await this.generateReservationActivityReport(campgroundId, startDate, now);
            case "guest_activity":
                return await this.generateGuestActivityReport(campgroundId, startDate, now);
            case "financial_summary":
                return await this.generateFinancialReport(campgroundId, startDate, now);
            default:
                return {
                    summary: `Your ${this.getReportDisplayName(type)} for the period.`,
                    metrics: [],
                };
        }
    }

    private async generateOccupancyReport(campgroundId: string | null, startDate: Date, endDate: Date) {
        if (!campgroundId) {
            return { summary: "No campground specified.", metrics: [] };
        }

        // Get total sites
        const totalSites = await this.prisma.site.count({ where: { campgroundId } });

        // Get reservations in period
        const reservations = await this.prisma.reservation.findMany({
            where: {
                campgroundId,
                status: { in: ["confirmed", "checked_in", "checked_out"] },
                OR: [
                    { startDate: { gte: startDate, lte: endDate } },
                    { endDate: { gte: startDate, lte: endDate } },
                    { AND: [{ startDate: { lte: startDate } }, { endDate: { gte: endDate } }] },
                ],
            },
            select: { startDate: true, endDate: true },
        });

        // Calculate occupied nights
        const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        let occupiedNights = 0;

        for (const res of reservations) {
            const resStart = new Date(res.startDate).getTime();
            const resEnd = new Date(res.endDate).getTime();
            const periodStart = startDate.getTime();
            const periodEnd = endDate.getTime();

            const overlapStart = Math.max(resStart, periodStart);
            const overlapEnd = Math.min(resEnd, periodEnd);
            const overlapDays = Math.max(0, Math.ceil((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)));

            occupiedNights += overlapDays;
        }

        const totalAvailableNights = totalSites * days;
        const avgOccupancy = totalAvailableNights > 0 ? (occupiedNights / totalAvailableNights) * 100 : 0;

        return {
            summary: "Your campground occupancy performance for the period.",
            metrics: [
                { label: "Average Occupancy", value: `${avgOccupancy.toFixed(1)}%` },
                { label: "Total Sites", value: totalSites.toString() },
                { label: "Occupied Nights", value: occupiedNights.toString() },
                { label: "Available Nights", value: totalAvailableNights.toString() },
            ],
        };
    }

    private async generateRevenueReport(campgroundId: string | null, startDate: Date, endDate: Date) {
        if (!campgroundId) {
            return { summary: "No campground specified.", metrics: [] };
        }

        const ledgerEntries = await this.prisma.ledgerEntry.findMany({
            where: {
                campgroundId,
                createdAt: { gte: startDate, lte: endDate },
            },
            select: { amountCents: true, glCode: true, direction: true },
        });

        let totalRevenue = 0;
        let reservationRevenue = 0;
        let addonRevenue = 0;
        let storeRevenue = 0;

        for (const entry of ledgerEntries) {
            const amount = entry.direction === "credit" ? entry.amountCents : -entry.amountCents;
            totalRevenue += amount;

            if (entry.glCode === "RESERVATION") reservationRevenue += amount;
            else if (entry.glCode === "ADDON") addonRevenue += amount;
            else if (entry.glCode === "STORE") storeRevenue += amount;
        }

        return {
            summary: "Revenue breakdown for the reporting period.",
            metrics: [
                { label: "Total Revenue", value: `$${(totalRevenue / 100).toFixed(2)}` },
                { label: "Reservation Revenue", value: `$${(reservationRevenue / 100).toFixed(2)}` },
                { label: "Add-on Revenue", value: `$${(addonRevenue / 100).toFixed(2)}` },
                { label: "Store Revenue", value: `$${(storeRevenue / 100).toFixed(2)}` },
            ],
        };
    }

    private async generateArrivalsReport(campgroundId: string | null, startDate: Date, endDate: Date) {
        if (!campgroundId) {
            return { summary: "No campground specified.", metrics: [] };
        }

        const [arrivals, departures, current] = await Promise.all([
            this.prisma.reservation.count({
                where: {
                    campgroundId,
                    startDate: { gte: startDate, lte: endDate },
                    status: { in: ["confirmed", "checked_in", "checked_out"] },
                },
            }),
            this.prisma.reservation.count({
                where: {
                    campgroundId,
                    endDate: { gte: startDate, lte: endDate },
                    status: { in: ["checked_out"] },
                },
            }),
            this.prisma.reservation.count({
                where: {
                    campgroundId,
                    status: "checked_in",
                },
            }),
        ]);

        return {
            summary: "Arrivals and departures summary.",
            metrics: [
                { label: "Arrivals", value: arrivals.toString() },
                { label: "Departures", value: departures.toString() },
                { label: "Current Guests", value: current.toString() },
            ],
        };
    }

    private async generateMaintenanceReport(campgroundId: string | null, startDate: Date, endDate: Date) {
        if (!campgroundId) {
            return { summary: "No campground specified.", metrics: [] };
        }

        const [open, resolved, all] = await Promise.all([
            this.prisma.operationalTask.count({
                where: {
                    campgroundId,
                    type: "maintenance",
                    status: { in: ["pending", "in_progress"] },
                },
            }),
            this.prisma.operationalTask.count({
                where: {
                    campgroundId,
                    type: "maintenance",
                    status: "completed",
                    updatedAt: { gte: startDate, lte: endDate },
                },
            }),
            this.prisma.operationalTask.findMany({
                where: {
                    campgroundId,
                    type: "maintenance",
                    status: "completed",
                    updatedAt: { gte: startDate, lte: endDate },
                    createdAt: { not: null },
                },
                select: { createdAt: true, updatedAt: true },
            }),
        ]);

        // Calculate average resolution time
        let totalMinutes = 0;
        for (const task of all) {
            const created = new Date(task.createdAt).getTime();
            const updated = new Date(task.updatedAt).getTime();
            totalMinutes += (updated - created) / (1000 * 60);
        }
        const avgHours = all.length > 0 ? (totalMinutes / all.length / 60).toFixed(1) : "N/A";

        return {
            summary: "Maintenance activity for the period.",
            metrics: [
                { label: "Open Tickets", value: open.toString() },
                { label: "Resolved", value: resolved.toString() },
                { label: "Avg Resolution Time", value: avgHours === "N/A" ? avgHours : `${avgHours} hours` },
            ],
        };
    }

    private async generateReservationActivityReport(campgroundId: string | null, startDate: Date, endDate: Date) {
        if (!campgroundId) {
            return { summary: "No campground specified.", metrics: [] };
        }

        const [created, cancelled, modified] = await Promise.all([
            this.prisma.reservation.count({
                where: {
                    campgroundId,
                    createdAt: { gte: startDate, lte: endDate },
                },
            }),
            this.prisma.reservation.count({
                where: {
                    campgroundId,
                    status: "cancelled",
                    updatedAt: { gte: startDate, lte: endDate },
                },
            }),
            this.prisma.reservation.count({
                where: {
                    campgroundId,
                    updatedAt: { gte: startDate, lte: endDate, gt: startDate },
                    status: { not: "cancelled" },
                },
            }),
        ]);

        return {
            summary: "Reservation activity for the period.",
            metrics: [
                { label: "New Reservations", value: created.toString() },
                { label: "Cancellations", value: cancelled.toString() },
                { label: "Modifications", value: modified.toString() },
            ],
        };
    }

    private async generateGuestActivityReport(campgroundId: string | null, startDate: Date, endDate: Date) {
        if (!campgroundId) {
            return { summary: "No campground specified.", metrics: [] };
        }

        const [newGuests, returningGuests] = await Promise.all([
            this.prisma.guest.count({
                where: {
                    createdAt: { gte: startDate, lte: endDate },
                    reservations: { some: { campgroundId } },
                },
            }),
            this.prisma.guest.count({
                where: {
                    createdAt: { lt: startDate },
                    reservations: {
                        some: {
                            campgroundId,
                            createdAt: { gte: startDate, lte: endDate },
                        },
                    },
                },
            }),
        ]);

        return {
            summary: "Guest activity for the period.",
            metrics: [
                { label: "New Guests", value: newGuests.toString() },
                { label: "Returning Guests", value: returningGuests.toString() },
                { label: "Total Active Guests", value: (newGuests + returningGuests).toString() },
            ],
        };
    }

    private async generateFinancialReport(campgroundId: string | null, startDate: Date, endDate: Date) {
        if (!campgroundId) {
            return { summary: "No campground specified.", metrics: [] };
        }

        const ledgerEntries = await this.prisma.ledgerEntry.findMany({
            where: {
                campgroundId,
                createdAt: { gte: startDate, lte: endDate },
            },
            select: { amountCents: true, direction: true },
        });

        let credits = 0;
        let debits = 0;

        for (const entry of ledgerEntries) {
            if (entry.direction === "credit") {
                credits += entry.amountCents;
            } else {
                debits += entry.amountCents;
            }
        }

        const netIncome = credits - debits;

        return {
            summary: "Financial summary for the period.",
            metrics: [
                { label: "Total Credits", value: `$${(credits / 100).toFixed(2)}` },
                { label: "Total Debits", value: `$${(debits / 100).toFixed(2)}` },
                { label: "Net Income", value: `$${(netIncome / 100).toFixed(2)}` },
            ],
        };
    }
}
