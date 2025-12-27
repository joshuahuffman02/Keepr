import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GamificationEventCategory, OperationalTask } from '@prisma/client';
import { GamificationService } from '../gamification/gamification.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class OperationsService {
    constructor(
        private prisma: PrismaService,
        private gamification: GamificationService,
        private emailService: EmailService,
    ) { }

    async findAllTasks(campgroundId: string, type?: string, status?: string): Promise<OperationalTask[]> {
        return this.prisma.operationalTask.findMany({
            where: {
                campgroundId,
                ...(type && { type }),
                ...(status && { status }),
            },
            include: { site: true },
            orderBy: { createdAt: 'desc' },
        });
    }

    async createTask(campgroundId: string, data: any, user?: any): Promise<OperationalTask> {
        this.ensureCampgroundAccess(user, campgroundId);
        return this.prisma.operationalTask.create({
            data: {
                ...data,
                campgroundId,
            },
        });
    }

    async updateTask(id: string, data: any, user?: any): Promise<OperationalTask> {
        const existing = await this.prisma.operationalTask.findUnique({ where: { id } });
        if (!existing) {
            throw new ForbiddenException("Task not found");
        }

        this.ensureCampgroundAccess(user, existing.campgroundId);

        const updated = await this.prisma.operationalTask.update({
            where: { id },
            data,
        });

        const statusTarget = data.status as string | undefined;
        const becameCompleted = !!existing && !!statusTarget && ["completed", "verified"].includes(statusTarget) && existing.status !== statusTarget;
        const becameOnTime = becameCompleted && existing?.dueDate
            ? new Date(existing.dueDate).getTime() >= Date.now()
            : false;

        if (becameCompleted && updated.assignedTo) {
            await this.gamification.recordEvent({
                campgroundId: updated.campgroundId,
                userId: updated.assignedTo,
                membershipId: undefined,
                category: GamificationEventCategory.task,
                reason: `Task completed: ${updated.title}`,
                sourceType: "operational_task",
                sourceId: updated.id,
                eventKey: `task:${updated.id}:completed`,
            });

            if (becameOnTime) {
                await this.gamification.recordEvent({
                    campgroundId: updated.campgroundId,
                    userId: updated.assignedTo,
                    membershipId: undefined,
                    category: GamificationEventCategory.on_time_assignment,
                    reason: `On-time: ${updated.title}`,
                    sourceType: "operational_task",
                    sourceId: updated.id,
                    eventKey: `task:${updated.id}:on_time`,
                });
            }
        }

        return updated;
    }

    async updateSiteHousekeeping(siteId: string, status: string, user?: any) {
        const site = await this.prisma.site.findUnique({
            where: { id: siteId },
            select: { campgroundId: true },
        });
        if (!site) {
            throw new ForbiddenException("Site not found");
        }
        this.ensureCampgroundAccess(user, site.campgroundId);
        return this.prisma.site.update({
            where: { id: siteId },
            data: { housekeepingStatus: status },
        });
    }

    async getHousekeepingStats(campgroundId: string) {
        const sites = await this.prisma.site.findMany({
            where: { campgroundId },
            select: { housekeepingStatus: true },
        });

        return {
            clean: sites.filter(s => s.housekeepingStatus === 'clean').length,
            dirty: sites.filter(s => s.housekeepingStatus === 'dirty').length,
            inspecting: sites.filter(s => s.housekeepingStatus === 'inspecting').length,
            total: sites.length,
        };
    }

    async getAutoTasking(campgroundId: string) {
        return [
            {
                trigger: "checkout",
                task: "Inspect and clean site after guest departs",
                status: "active",
                dueMinutes: 45,
                owner: "Housekeeping lead",
                playbook: "Departure SOP",
            },
            {
                trigger: "early_checkin_paid",
                task: "Prep site for early arrival",
                status: "active",
                dueMinutes: 30,
                owner: "Front desk",
                playbook: "Arrival SOP",
            },
            {
                trigger: "maintenance_overdue",
                task: "Escalate overdue maintenance tickets",
                status: "active",
                dueMinutes: 60,
                owner: "Ops supervisor",
                playbook: "Maintenance escalation",
            },
        ];
    }

    async triggerAutoTask(campgroundId: string, trigger: string, user?: any) {
        this.ensureCampgroundAccess(user, campgroundId);
        return {
            triggered: true,
            trigger,
            created: [
                {
                    id: "auto-1",
                    title: `Auto task for ${trigger}`,
                    status: "pending",
                    priority: "high",
                    dueAt: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
                    owner: "Ops queue",
                }
            ],
        };
    }

    async listChecklists(campgroundId: string) {
        return [
            {
                id: "chk-1",
                name: "Arrival checklist",
                steps: ["Verify ID", "Confirm payment", "Site walkthrough"],
                status: "active",
                owner: "Front desk",
                dueMinutes: 20,
            },
            {
                id: "chk-2",
                name: "Departure checklist",
                steps: ["Inspect site", "Reset power/water", "Log issues"],
                status: "active",
                owner: "Housekeeping",
                dueMinutes: 30,
            },
            {
                id: "chk-3",
                name: "Maintenance triage",
                steps: ["Confirm issue", "Assign tech", "Set ETA", "Update guest"],
                status: "active",
                owner: "Ops supervisor",
                dueMinutes: 60,
            },
        ];
    }

    async listReorders(campgroundId: string) {
        return [
            {
                id: "reo-1",
                item: "Cleaning supplies",
                qty: 12,
                threshold: 10,
                status: "needs_order",
                vendor: "Janitorial Co.",
                reorderQty: 30,
            },
            {
                id: "reo-2",
                item: "Propane canisters",
                qty: 8,
                threshold: 15,
                status: "needs_order",
                vendor: "Propane Plus",
                reorderQty: 20,
            },
            {
                id: "reo-3",
                item: "Pool test strips",
                qty: 40,
                threshold: 25,
                status: "ok",
                vendor: "WaterSafe",
                reorderQty: 80,
            },
        ];
    }

    async listSuggestions(campgroundId: string) {
        return [
            {
                id: "ops-1",
                suggestion: "Bundle housekeeping tasks by loop to cut travel time",
                impact: "medium",
                action: "Group tasks",
                status: "new",
            },
            {
                id: "ops-2",
                suggestion: "Auto-assign maintenance overdue tickets to on-call",
                impact: "high",
                action: "Enable auto-assign",
                status: "new",
            },
            {
                id: "ops-3",
                suggestion: "Schedule inventory reorders weekly to avoid rush shipping",
                impact: "low",
                action: "Schedule reorders",
                status: "new",
            },
        ];
    }

    async getOpsHealth(campgroundId: string) {
        const [reorders, checklists] = await Promise.all([
            this.listReorders(campgroundId),
            this.listChecklists(campgroundId),
        ]);

        const pendingReorders = reorders.filter(r => r.status === "needs_order");
        const completionRate = checklists.length
            ? Math.min(1, checklists.length / (checklists.length + pendingReorders.length))
            : 0.75; // fallback stub

        const now = Date.now();
        const recentAutoRuns = [
            {
                trigger: "checkout",
                status: "success",
                createdTasks: 2,
                durationMs: 1200,
                at: new Date(now - 5 * 60 * 1000).toISOString(),
            },
            {
                trigger: "maintenance_overdue",
                status: "success",
                createdTasks: 1,
                durationMs: 1800,
                at: new Date(now - 20 * 60 * 1000).toISOString(),
            },
            {
                trigger: "early_checkin_paid",
                status: "queued",
                createdTasks: 0,
                durationMs: 0,
                at: new Date(now - 45 * 60 * 1000).toISOString(),
            },
        ];

        return {
            campgroundId,
            capturedAt: new Date(now).toISOString(),
            autoTasking: {
                recentRuns: recentAutoRuns,
                tasksCreatedLast24h: 12,
            },
            checklists: {
                completionRate,
                active: checklists.length,
                overdue: Math.max(0, Math.round(checklists.length * 0.1)),
            },
            reorders: {
                pending: pendingReorders.length,
                items: pendingReorders,
            },
        };
    }

    /**
     * Send operations health alerts via configured channels
     *
     * Supported channels:
     * - webhook: POST to OPS_ALERT_WEBHOOK_URL environment variable
     * - slack: POST to Slack webhook (requires SLACK_OPS_WEBHOOK_URL)
     * - email: Send via EmailService (requires OPS_ALERT_EMAIL)
     *
     * TODO: Implement additional channels as needed:
     * - SMS via Twilio (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_FROM, OPS_ALERT_PHONE)
     * - PagerDuty (PAGERDUTY_INTEGRATION_KEY)
     * - Microsoft Teams (TEAMS_OPS_WEBHOOK_URL)
     */
    async sendOpsHealthAlert(
        campgroundId: string,
        channel = "webhook",
        target = "ops-alerts",
        message = "Test alert from ops health",
        user?: any,
    ) {
        this.ensureCampgroundAccess(user, campgroundId);
        const payload = {
            campgroundId,
            channel,
            target,
            message,
            at: new Date().toISOString(),
        };

        // Get campground details for context
        const campground = await this.prisma.campground.findUnique({
            where: { id: campgroundId },
            select: { name: true, email: true },
        });

        try {
            switch (channel) {
                case "webhook":
                    await this.sendWebhookAlert(payload, campground);
                    break;
                case "slack":
                    await this.sendSlackAlert(payload, campground);
                    break;
                case "email":
                    await this.sendEmailAlert(payload, campground);
                    break;
                default:
                    throw new Error(`Unsupported alert channel: ${channel}`);
            }

            return { sent: true, ...payload };
        } catch (error: any) {
            // Log error but don't throw - alerts should fail gracefully
            this.prisma.$executeRawUnsafe(
                `INSERT INTO system_logs (level, message, metadata, created_at) VALUES ('error', 'Failed to send ops alert', '${JSON.stringify({ error: error.message, payload })}', NOW())`
            ).catch(() => {
                // If logging fails, just log to console
                // eslint-disable-next-line no-console
                console.error("[ops-health-alert] Failed to send and log:", error.message, payload);
            });

            return { sent: false, error: error.message, ...payload };
        }
    }

    private async sendWebhookAlert(payload: any, campground: any) {
        const webhookUrl = process.env.OPS_ALERT_WEBHOOK_URL;

        if (!webhookUrl) {
            throw new Error("OPS_ALERT_WEBHOOK_URL not configured");
        }

        const response = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ...payload,
                campgroundName: campground?.name,
                timestamp: payload.at,
            }),
        });

        if (!response.ok) {
            throw new Error(`Webhook request failed: ${response.status} ${response.statusText}`);
        }
    }

    private async sendSlackAlert(payload: any, campground: any) {
        const slackUrl = process.env.SLACK_OPS_WEBHOOK_URL;

        if (!slackUrl) {
            throw new Error("SLACK_OPS_WEBHOOK_URL not configured");
        }

        const response = await fetch(slackUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                text: `*Operations Alert - ${campground?.name || "Campground"}*`,
                blocks: [
                    {
                        type: "header",
                        text: {
                            type: "plain_text",
                            text: `Operations Alert - ${campground?.name || "Campground"}`,
                        },
                    },
                    {
                        type: "section",
                        fields: [
                            { type: "mrkdwn", text: `*Target:*\n${payload.target}` },
                            { type: "mrkdwn", text: `*Time:*\n${new Date(payload.at).toLocaleString()}` },
                        ],
                    },
                    {
                        type: "section",
                        text: {
                            type: "mrkdwn",
                            text: `*Message:*\n${payload.message}`,
                        },
                    },
                ],
            }),
        });

        if (!response.ok) {
            throw new Error(`Slack webhook failed: ${response.status} ${response.statusText}`);
        }
    }

    private async sendEmailAlert(payload: any, campground: any) {
        const alertEmail = process.env.OPS_ALERT_EMAIL || campground?.email;

        if (!alertEmail) {
            throw new Error("OPS_ALERT_EMAIL not configured and no campground email available");
        }

        await this.emailService.sendEmail({
            to: alertEmail,
            subject: `Operations Alert - ${campground?.name || 'Campground'}`,
            html: `
                <h2 style="color: #dc2626;">Operations Alert</h2>
                <table style="border-collapse: collapse; margin: 16px 0;">
                    <tr><td style="padding: 8px; font-weight: bold;">Campground:</td><td style="padding: 8px;">${campground?.name || 'N/A'}</td></tr>
                    <tr><td style="padding: 8px; font-weight: bold;">Target:</td><td style="padding: 8px;">${payload.target}</td></tr>
                    <tr><td style="padding: 8px; font-weight: bold;">Time:</td><td style="padding: 8px;">${new Date(payload.at).toLocaleString()}</td></tr>
                </table>
                <p><strong>Message:</strong></p>
                <p style="background: #f3f4f6; padding: 16px; border-radius: 8px;">${payload.message}</p>
            `,
            campgroundId: payload.campgroundId,
        });
    }

    private ensureCampgroundAccess(user: any, campgroundId?: string | null) {
        if (!campgroundId) {
            throw new ForbiddenException("Campground scope required");
        }
        const allowed = Array.isArray(user?.memberships) && user.memberships.some((m: any) => m.campgroundId === campgroundId);
        if (!allowed) {
            throw new ForbiddenException("Forbidden by campground scope");
        }
    }
}
