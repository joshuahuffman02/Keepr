import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../../prisma/prisma.service";
import { EmailService } from "../../email/email.service";
import { OpSlaStatus, OpTask, OpTaskState } from "@prisma/client";

type SlaTaskSummary = Pick<
  OpTask,
  "id" | "slaDueAt" | "slaStatus" | "campgroundId" | "assignedToUserId" | "assignedToTeamId"
>;

const getErrorMessage = (error: unknown): string =>
  error instanceof Error && error.message ? error.message : "Unknown error";

@Injectable()
export class OpSlaService {
  private readonly logger = new Logger(OpSlaService.name);

  // Time thresholds for at-risk status (in minutes)
  private readonly AT_RISK_THRESHOLD_MINUTES = 30;

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  /**
   * Cron job to update SLA statuses every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async updateSlaStatuses(): Promise<void> {
    this.logger.log("Updating SLA statuses...");

    const now = new Date();
    const atRiskThreshold = new Date(now.getTime() + this.AT_RISK_THRESHOLD_MINUTES * 60 * 1000);

    // Find tasks that need SLA status updates
    const tasks = await this.prisma.opTask.findMany({
      where: {
        state: { notIn: [OpTaskState.completed, OpTaskState.cancelled, OpTaskState.verified] },
        slaDueAt: { not: null },
      },
      select: {
        id: true,
        slaDueAt: true,
        slaStatus: true,
        campgroundId: true,
        assignedToUserId: true,
        assignedToTeamId: true,
      },
    });

    let breachedCount = 0;
    let atRiskCount = 0;

    for (const task of tasks) {
      const dueAt = task.slaDueAt!;
      let newStatus: OpSlaStatus;

      if (dueAt < now) {
        newStatus = OpSlaStatus.breached;
        breachedCount++;
      } else if (dueAt < atRiskThreshold) {
        newStatus = OpSlaStatus.at_risk;
        atRiskCount++;
      } else {
        newStatus = OpSlaStatus.on_track;
      }

      // Only update if status changed
      if (newStatus !== task.slaStatus) {
        await this.prisma.opTask.update({
          where: { id: task.id },
          data: {
            slaStatus: newStatus,
            ...(newStatus === OpSlaStatus.breached && !task.slaStatus
              ? {
                  slaEscalatedAt: now,
                }
              : {}),
          },
        });

        // Notify manager for breached tasks
        if (newStatus === OpSlaStatus.breached) {
          this.logger.warn(`Task ${task.id} SLA breached`);
          await this.notifyManagerSlaBreach(task);
        }
      }
    }

    this.logger.log(`SLA update complete: ${breachedCount} breached, ${atRiskCount} at-risk`);
  }

  /**
   * Notify manager when a task SLA is breached
   */
  private async notifyManagerSlaBreach(task: SlaTaskSummary): Promise<void> {
    try {
      // Get the full task with details
      const fullTask = await this.prisma.opTask.findUnique({
        where: { id: task.id },
        include: {
          OpTaskTemplate: { select: { name: true } },
          User_OpTask_assignedToUserIdToUser: {
            select: { email: true, firstName: true, lastName: true },
          },
          OpTeam: {
            select: {
              name: true,
              OpTeamMember: {
                where: { role: "manager" },
                include: { User: { select: { email: true, firstName: true, lastName: true } } },
              },
            },
          },
        },
      });

      if (!fullTask) return;

      // Find manager emails to notify
      const managerEmails: string[] = [];

      // If assigned to a team, get team managers
      if (fullTask.OpTeam?.OpTeamMember) {
        for (const member of fullTask.OpTeam.OpTeamMember) {
          if (member.User?.email) {
            managerEmails.push(member.User.email);
          }
        }
      }

      // Fallback to campground email if no managers found
      if (managerEmails.length === 0) {
        const campground = await this.prisma.campground.findUnique({
          where: { id: task.campgroundId },
          select: { email: true, name: true },
        });
        if (campground?.email) {
          managerEmails.push(campground.email);
        }
      }

      if (managerEmails.length === 0) {
        this.logger.debug(`No manager emails found for SLA breach notification, skipping`);
        return;
      }

      const taskName = fullTask.OpTaskTemplate?.name || fullTask.title || "Unnamed task";
      const dueAt = fullTask.slaDueAt ? new Date(fullTask.slaDueAt).toLocaleString() : "Unknown";
      const assigneeName = fullTask.User_OpTask_assignedToUserIdToUser
        ? `${fullTask.User_OpTask_assignedToUserIdToUser.firstName} ${fullTask.User_OpTask_assignedToUserIdToUser.lastName}`
        : fullTask.OpTeam?.name || "Unassigned";

      for (const email of managerEmails) {
        await this.emailService.sendEmail({
          to: email,
          subject: `[SLA BREACH] Task "${taskName}" is overdue`,
          html: `
            <h2 style="color: #dc2626">SLA Breach Alert</h2>
            <p>A task has breached its SLA deadline and requires immediate attention.</p>
            <table style="border-collapse: collapse; margin: 16px 0;">
              <tr><td style="padding: 8px; font-weight: bold;">Task:</td><td style="padding: 8px;">${taskName}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">Due:</td><td style="padding: 8px; color: #dc2626;">${dueAt}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">Assigned to:</td><td style="padding: 8px;">${assigneeName}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">Priority:</td><td style="padding: 8px;">${fullTask.priority || "medium"}</td></tr>
            </table>
            <p>Please take action to resolve this task or reassign it if needed.</p>
          `,
          campgroundId: task.campgroundId,
        });
      }

      this.logger.log(
        `Sent SLA breach notification for task ${task.id} to ${managerEmails.length} manager(s)`,
      );
    } catch (error: unknown) {
      this.logger.error(`Failed to send SLA breach notification: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Get SLA dashboard metrics for a campground
   */
  async getDashboardMetrics(campgroundId: string): Promise<SlaDashboardMetrics> {
    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    const startOfWeek = new Date(now);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const [currentStats, completedToday, completedThisWeek, onTimeToday, lateToday] =
      await Promise.all([
        // Current open tasks by SLA status
        this.prisma.opTask.groupBy({
          by: ["slaStatus"],
          where: {
            campgroundId,
            state: { notIn: ["completed", "cancelled", "verified"] },
            slaDueAt: { not: null },
          },
          _count: true,
        }),
        // Tasks completed today
        this.prisma.opTask.count({
          where: {
            campgroundId,
            state: OpTaskState.completed,
            completedAt: { gte: startOfDay },
          },
        }),
        // Tasks completed this week
        this.prisma.opTask.count({
          where: {
            campgroundId,
            state: OpTaskState.completed,
            completedAt: { gte: startOfWeek },
          },
        }),
        // On-time completions today
        this.prisma.opTask.count({
          where: {
            campgroundId,
            state: OpTaskState.completed,
            completedAt: { gte: startOfDay },
            slaStatus: OpSlaStatus.on_track,
          },
        }),
        // Late completions today
        this.prisma.opTask.count({
          where: {
            campgroundId,
            state: OpTaskState.completed,
            completedAt: { gte: startOfDay },
            slaStatus: OpSlaStatus.breached,
          },
        }),
      ]);

    const onTrackCount =
      currentStats.find(
        (s: { slaStatus: string | null; _count: number }) => s.slaStatus === "on_track",
      )?._count ?? 0;
    const atRiskCount =
      currentStats.find(
        (s: { slaStatus: string | null; _count: number }) => s.slaStatus === "at_risk",
      )?._count ?? 0;
    const breachedCount =
      currentStats.find(
        (s: { slaStatus: string | null; _count: number }) => s.slaStatus === "breached",
      )?._count ?? 0;
    const totalOpen = onTrackCount + atRiskCount + breachedCount;

    const complianceRate =
      completedToday > 0 ? Math.round((onTimeToday / completedToday) * 100) : 100;

    return {
      current: {
        onTrack: onTrackCount,
        atRisk: atRiskCount,
        breached: breachedCount,
        total: totalOpen,
      },
      today: {
        completed: completedToday,
        onTime: onTimeToday,
        late: lateToday,
        complianceRate,
      },
      week: {
        completed: completedThisWeek,
      },
    };
  }

  /**
   * Get upcoming SLA deadlines
   */
  async getUpcomingDeadlines(
    campgroundId: string,
    options?: { limit?: number; hoursAhead?: number },
  ): Promise<OpTask[]> {
    const limit = options?.limit ?? 10;
    const hoursAhead = options?.hoursAhead ?? 4;
    const deadline = new Date(Date.now() + hoursAhead * 60 * 60 * 1000);

    return this.prisma.opTask.findMany({
      where: {
        campgroundId,
        state: { notIn: ["completed", "cancelled", "verified"] },
        slaDueAt: { lte: deadline, gt: new Date() },
      },
      orderBy: { slaDueAt: "asc" },
      take: limit,
      include: {
        Site: true,
        User_OpTask_assignedToUserIdToUser: {
          select: { id: true, firstName: true, lastName: true },
        },
        OpTeam: true,
      },
    });
  }

  /**
   * Get breached tasks that need attention
   */
  async getBreachedTasks(campgroundId: string): Promise<OpTask[]> {
    return this.prisma.opTask.findMany({
      where: {
        campgroundId,
        state: { notIn: ["completed", "cancelled", "verified"] },
        slaStatus: OpSlaStatus.breached,
      },
      orderBy: { slaDueAt: "asc" },
      include: {
        Site: true,
        User_OpTask_assignedToUserIdToUser: {
          select: { id: true, firstName: true, lastName: true },
        },
        OpTeam: true,
      },
    });
  }

  /**
   * Get SLA performance by team
   */
  async getTeamPerformance(campgroundId: string): Promise<TeamSlaPerformance[]> {
    const teams = await this.prisma.opTeam.findMany({
      where: { campgroundId, isActive: true },
      include: {
        OpTask: {
          where: { state: OpTaskState.completed },
          select: { slaStatus: true, completedAt: true },
        },
      },
    });

    return teams.map((team: (typeof teams)[number]) => {
      const totalCompleted = team.OpTask.length;
      const onTime = team.OpTask.filter((t) => t.slaStatus !== "breached").length;
      const complianceRate = totalCompleted > 0 ? Math.round((onTime / totalCompleted) * 100) : 100;

      return {
        teamId: team.id,
        teamName: team.name,
        totalCompleted,
        onTime,
        late: totalCompleted - onTime,
        complianceRate,
      };
    });
  }

  /**
   * Get SLA performance by staff member
   */
  async getStaffPerformance(
    campgroundId: string,
    options?: { startDate?: Date; endDate?: Date },
  ): Promise<StaffSlaPerformance[]> {
    const dateFilter = {
      ...(options?.startDate && { gte: options.startDate }),
      ...(options?.endDate && { lte: options.endDate }),
    };

    const staff = await this.prisma.user.findMany({
      where: {
        CampgroundMembership: { some: { campgroundId } },
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        OpTask_OpTask_completedByIdToUser: {
          where: {
            campgroundId,
            ...(Object.keys(dateFilter).length > 0 && { completedAt: dateFilter }),
          },
          select: { slaStatus: true },
        },
      },
    });

    return staff
      .filter((s: (typeof staff)[number]) => s.OpTask_OpTask_completedByIdToUser.length > 0)
      .map((s: (typeof staff)[number]) => {
        const totalCompleted = s.OpTask_OpTask_completedByIdToUser.length;
        const onTime = s.OpTask_OpTask_completedByIdToUser.filter(
          (t: { slaStatus: string | null }) => t.slaStatus !== "breached",
        ).length;

        return {
          userId: s.id,
          userName: `${s.firstName} ${s.lastName}`,
          totalCompleted,
          onTime,
          late: totalCompleted - onTime,
          complianceRate: Math.round((onTime / totalCompleted) * 100),
        };
      })
      .sort(
        (a: StaffSlaPerformance, b: StaffSlaPerformance) => b.totalCompleted - a.totalCompleted,
      );
  }

  /**
   * Escalate a breached task to a manager
   */
  async escalateTask(taskId: string, escalateToUserId: string): Promise<OpTask> {
    return this.prisma.opTask.update({
      where: { id: taskId },
      data: {
        slaEscalatedAt: new Date(),
        slaEscalatedToId: escalateToUserId,
      },
      include: {
        User_OpTask_slaEscalatedToIdToUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }
}

// Types for SLA metrics
export interface SlaDashboardMetrics {
  current: {
    onTrack: number;
    atRisk: number;
    breached: number;
    total: number;
  };
  today: {
    completed: number;
    onTime: number;
    late: number;
    complianceRate: number;
  };
  week: {
    completed: number;
  };
}

export interface TeamSlaPerformance {
  teamId: string;
  teamName: string;
  totalCompleted: number;
  onTime: number;
  late: number;
  complianceRate: number;
}

export interface StaffSlaPerformance {
  userId: string;
  userName: string;
  totalCompleted: number;
  onTime: number;
  late: number;
  complianceRate: number;
}
