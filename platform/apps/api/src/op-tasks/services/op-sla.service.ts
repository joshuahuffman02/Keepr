import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { OpSlaStatus, OpTask, OpTaskState } from '@prisma/client';

@Injectable()
export class OpSlaService {
  private readonly logger = new Logger(OpSlaService.name);

  // Time thresholds for at-risk status (in minutes)
  private readonly AT_RISK_THRESHOLD_MINUTES = 30;

  constructor(private prisma: PrismaService) {}

  /**
   * Cron job to update SLA statuses every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async updateSlaStatuses(): Promise<void> {
    this.logger.log('Updating SLA statuses...');

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
            ...(newStatus === OpSlaStatus.breached && !task.slaStatus ? {
              slaEscalatedAt: now,
            } : {}),
          },
        });

        // Log escalation for breached tasks
        if (newStatus === OpSlaStatus.breached) {
          this.logger.warn(`Task ${task.id} SLA breached`);
          // TODO: Send notification to manager
        }
      }
    }

    this.logger.log(`SLA update complete: ${breachedCount} breached, ${atRiskCount} at-risk`);
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

    const [
      currentStats,
      completedToday,
      completedThisWeek,
      onTimeToday,
      lateToday,
    ] = await Promise.all([
      // Current open tasks by SLA status
      this.prisma.opTask.groupBy({
        by: ['slaStatus'],
        where: {
          campgroundId,
          state: { notIn: ['completed', 'cancelled', 'verified'] },
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

    const onTrackCount = currentStats.find((s: { slaStatus: string | null; _count: number }) => s.slaStatus === 'on_track')?._count ?? 0;
    const atRiskCount = currentStats.find((s: { slaStatus: string | null; _count: number }) => s.slaStatus === 'at_risk')?._count ?? 0;
    const breachedCount = currentStats.find((s: { slaStatus: string | null; _count: number }) => s.slaStatus === 'breached')?._count ?? 0;
    const totalOpen = onTrackCount + atRiskCount + breachedCount;

    const complianceRate = completedToday > 0
      ? Math.round((onTimeToday / completedToday) * 100)
      : 100;

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
        state: { notIn: ['completed', 'cancelled', 'verified'] },
        slaDueAt: { lte: deadline, gt: new Date() },
      },
      orderBy: { slaDueAt: 'asc' },
      take: limit,
      include: {
        site: true,
        assignedToUser: { select: { id: true, firstName: true, lastName: true } },
        assignedToTeam: true,
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
        state: { notIn: ['completed', 'cancelled', 'verified'] },
        slaStatus: OpSlaStatus.breached,
      },
      orderBy: { slaDueAt: 'asc' },
      include: {
        site: true,
        assignedToUser: { select: { id: true, firstName: true, lastName: true } },
        assignedToTeam: true,
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
        tasks: {
          where: { state: OpTaskState.completed },
          select: { slaStatus: true, completedAt: true },
        },
      },
    });

    return teams.map((team: typeof teams[number]) => {
      const totalCompleted = team.tasks.length;
      const onTime = team.tasks.filter((t: { slaStatus: string | null }) => t.slaStatus !== 'breached').length;
      const complianceRate = totalCompleted > 0
        ? Math.round((onTime / totalCompleted) * 100)
        : 100;

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
        memberships: { some: { campgroundId } },
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        opTasksCompleted: {
          where: {
            campgroundId,
            ...(Object.keys(dateFilter).length > 0 && { completedAt: dateFilter }),
          },
          select: { slaStatus: true },
        },
      },
    });

    return staff
      .filter((s: typeof staff[number]) => s.opTasksCompleted.length > 0)
      .map((s: typeof staff[number]) => {
        const totalCompleted = s.opTasksCompleted.length;
        const onTime = s.opTasksCompleted.filter((t: { slaStatus: string | null }) => t.slaStatus !== 'breached').length;

        return {
          userId: s.id,
          userName: `${s.firstName} ${s.lastName}`,
          totalCompleted,
          onTime,
          late: totalCompleted - onTime,
          complianceRate: Math.round((onTime / totalCompleted) * 100),
        };
      })
      .sort((a: StaffSlaPerformance, b: StaffSlaPerformance) => b.totalCompleted - a.totalCompleted);
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
        slaEscalatedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
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
