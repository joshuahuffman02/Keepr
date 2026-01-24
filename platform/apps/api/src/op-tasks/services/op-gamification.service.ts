import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../../prisma/prisma.service";
import {
  OpBadge,
  OpBadgeCategory,
  OpBadgeTier,
  OpStaffStats,
  OpStaffBadge,
  OpStaffDailyStats,
  OpTaskState,
  OpSlaStatus,
} from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

interface BadgeCriteria {
  type: "task_count" | "streak" | "sla_compliance" | "speed" | "special";
  threshold: number;
  timeframe?: "day" | "week" | "month" | "all_time";
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isBadgeType = (value: unknown): value is BadgeCriteria["type"] =>
  value === "task_count" ||
  value === "streak" ||
  value === "sla_compliance" ||
  value === "speed" ||
  value === "special";

const isBadgeTimeframe = (value: unknown): value is NonNullable<BadgeCriteria["timeframe"]> =>
  value === "day" || value === "week" || value === "month" || value === "all_time";

const parseBadgeCriteria = (value: unknown): BadgeCriteria | null => {
  if (!isRecord(value)) return null;
  const type = value.type;
  const threshold = value.threshold;
  const timeframe = value.timeframe;

  if (!isBadgeType(type)) return null;
  if (typeof threshold !== "number") return null;
  if (timeframe !== undefined && !isBadgeTimeframe(timeframe)) {
    return null;
  }

  return {
    type,
    threshold,
    ...(timeframe ? { timeframe } : {}),
  };
};

const toBadgeCriteriaJson = (criteria: BadgeCriteria): Prisma.InputJsonValue => ({
  type: criteria.type,
  threshold: criteria.threshold,
  ...(criteria.timeframe ? { timeframe: criteria.timeframe } : {}),
});

@Injectable()
export class OpGamificationService {
  private readonly logger = new Logger(OpGamificationService.name);

  // Points configuration
  private readonly POINTS = {
    TASK_COMPLETED: 10,
    TASK_ON_TIME: 5, // Bonus for completing before SLA
    TASK_EARLY: 10, // Bonus for completing well before SLA (>30min early)
    STREAK_DAY: 20, // Bonus for maintaining streak
    PERFECT_DAY: 50, // All tasks on time in a day
    LEVEL_UP: 100, // Bonus when leveling up
  };

  // XP thresholds for levels
  private readonly LEVEL_THRESHOLDS = [
    0, 100, 250, 500, 1000, 2000, 3500, 5500, 8000, 12000, 17000, 24000, 33000, 45000, 60000,
  ];

  constructor(private prisma: PrismaService) {}

  // ============================================================
  // BADGE MANAGEMENT
  // ============================================================

  /**
   * Get all available badges for a campground
   */
  async getBadges(campgroundId: string): Promise<OpBadge[]> {
    return this.prisma.opBadge.findMany({
      where: {
        OR: [
          { campgroundId },
          { campgroundId: null }, // System-wide badges
        ],
        isActive: true,
      },
      orderBy: [{ tier: "asc" }, { category: "asc" }, { name: "asc" }],
    });
  }

  /**
   * Create a custom badge for a campground
   */
  async createBadge(
    campgroundId: string,
    data: {
      code: string;
      name: string;
      description: string;
      icon: string;
      category: OpBadgeCategory;
      tier?: OpBadgeTier;
      criteria: BadgeCriteria;
      points?: number;
    },
  ): Promise<OpBadge> {
    return this.prisma.opBadge.create({
      data: {
        id: randomUUID(),
        campgroundId,
        code: data.code,
        name: data.name,
        description: data.description,
        icon: data.icon,
        category: data.category,
        tier: data.tier || OpBadgeTier.bronze,
        criteria: toBadgeCriteriaJson(data.criteria),
        points: data.points || 10,
      },
    });
  }

  /**
   * Seed default badges for a campground
   */
  async seedDefaultBadges(campgroundId: string): Promise<OpBadge[]> {
    const defaultBadges: Array<{
      code: string;
      name: string;
      description: string;
      icon: string;
      category: OpBadgeCategory;
      tier: OpBadgeTier;
      criteria: BadgeCriteria;
      points: number;
    }> = [
      // Speed badges
      {
        code: "speed_demon",
        name: "Speed Demon",
        description: "Complete 5 tasks in under 30 minutes each",
        icon: "bolt",
        category: OpBadgeCategory.speed,
        tier: OpBadgeTier.bronze,
        criteria: { type: "speed", threshold: 5, timeframe: "day" },
        points: 25,
      },
      {
        code: "lightning_fast",
        name: "Lightning Fast",
        description: "Complete 20 tasks in under 30 minutes each",
        icon: "zap",
        category: OpBadgeCategory.speed,
        tier: OpBadgeTier.silver,
        criteria: { type: "speed", threshold: 20, timeframe: "week" },
        points: 50,
      },

      // Volume badges
      {
        code: "task_starter",
        name: "Task Starter",
        description: "Complete your first 10 tasks",
        icon: "target",
        category: OpBadgeCategory.volume,
        tier: OpBadgeTier.bronze,
        criteria: { type: "task_count", threshold: 10, timeframe: "all_time" },
        points: 20,
      },
      {
        code: "task_crusher",
        name: "Task Crusher",
        description: "Complete 50 tasks",
        icon: "hammer",
        category: OpBadgeCategory.volume,
        tier: OpBadgeTier.silver,
        criteria: { type: "task_count", threshold: 50, timeframe: "all_time" },
        points: 50,
      },
      {
        code: "task_master",
        name: "Task Master",
        description: "Complete 200 tasks",
        icon: "crown",
        category: OpBadgeCategory.volume,
        tier: OpBadgeTier.gold,
        criteria: { type: "task_count", threshold: 200, timeframe: "all_time" },
        points: 100,
      },
      {
        code: "daily_warrior",
        name: "Daily Warrior",
        description: "Complete 10 tasks in a single day",
        icon: "swords",
        category: OpBadgeCategory.volume,
        tier: OpBadgeTier.silver,
        criteria: { type: "task_count", threshold: 10, timeframe: "day" },
        points: 30,
      },

      // Quality badges
      {
        code: "perfect_day",
        name: "Perfect Day",
        description: "Complete all your tasks on time for a full day",
        icon: "sparkles",
        category: OpBadgeCategory.quality,
        tier: OpBadgeTier.bronze,
        criteria: { type: "sla_compliance", threshold: 100, timeframe: "day" },
        points: 25,
      },
      {
        code: "perfect_week",
        name: "Perfect Week",
        description: "Maintain 100% SLA compliance for a week",
        icon: "star",
        category: OpBadgeCategory.quality,
        tier: OpBadgeTier.gold,
        criteria: { type: "sla_compliance", threshold: 100, timeframe: "week" },
        points: 100,
      },
      {
        code: "reliability_star",
        name: "Reliability Star",
        description: "Maintain 95%+ SLA compliance over 50 tasks",
        icon: "award",
        category: OpBadgeCategory.quality,
        tier: OpBadgeTier.silver,
        criteria: { type: "sla_compliance", threshold: 95, timeframe: "all_time" },
        points: 75,
      },

      // Streak badges
      {
        code: "on_fire",
        name: "On Fire",
        description: "Complete tasks 5 days in a row",
        icon: "flame",
        category: OpBadgeCategory.streak,
        tier: OpBadgeTier.bronze,
        criteria: { type: "streak", threshold: 5 },
        points: 30,
      },
      {
        code: "unstoppable",
        name: "Unstoppable",
        description: "Complete tasks 14 days in a row",
        icon: "rocket",
        category: OpBadgeCategory.streak,
        tier: OpBadgeTier.silver,
        criteria: { type: "streak", threshold: 14 },
        points: 75,
      },
      {
        code: "legend",
        name: "Legend",
        description: "Complete tasks 30 days in a row",
        icon: "trophy",
        category: OpBadgeCategory.streak,
        tier: OpBadgeTier.platinum,
        criteria: { type: "streak", threshold: 30 },
        points: 200,
      },

      // Milestone badges
      {
        code: "first_task",
        name: "First Steps",
        description: "Complete your very first task",
        icon: "footprints",
        category: OpBadgeCategory.milestone,
        tier: OpBadgeTier.bronze,
        criteria: { type: "task_count", threshold: 1, timeframe: "all_time" },
        points: 10,
      },
      {
        code: "century_club",
        name: "Century Club",
        description: "Complete 100 tasks",
        icon: "badge-check",
        category: OpBadgeCategory.milestone,
        tier: OpBadgeTier.gold,
        criteria: { type: "task_count", threshold: 100, timeframe: "all_time" },
        points: 100,
      },
    ];

    const badges: OpBadge[] = [];

    for (const badge of defaultBadges) {
      try {
        const created = await this.prisma.opBadge.upsert({
          where: {
            campgroundId_code: {
              campgroundId,
              code: badge.code,
            },
          },
          create: {
            id: randomUUID(),
            campgroundId,
            ...badge,
            criteria: toBadgeCriteriaJson(badge.criteria),
          },
          update: {},
        });
        badges.push(created);
      } catch (error: unknown) {
        this.logger.warn(
          `Failed to create badge ${badge.code}: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }

    return badges;
  }

  // ============================================================
  // STAFF STATS
  // ============================================================

  /**
   * Get or create staff stats for a user
   */
  async getOrCreateStats(userId: string, campgroundId: string): Promise<OpStaffStats> {
    let stats = await this.prisma.opStaffStats.findUnique({
      where: {
        userId_campgroundId: { userId, campgroundId },
      },
    });

    if (!stats) {
      stats = await this.prisma.opStaffStats.create({
        data: { id: randomUUID(), userId, campgroundId, updatedAt: new Date() },
      });
    }

    return stats;
  }

  /**
   * Get leaderboard for a campground
   */
  async getLeaderboard(
    campgroundId: string,
    options?: {
      period?: "week" | "month" | "all_time";
      limit?: number;
    },
  ): Promise<Array<OpStaffStats & { user: { id: string; firstName: string; lastName: string } }>> {
    const period = options?.period || "week";
    const limit = options?.limit || 10;

    const orderByField =
      period === "week" ? "weekPoints" : period === "month" ? "monthPoints" : "totalPoints";

    const leaderboard = await this.prisma.opStaffStats.findMany({
      where: { campgroundId },
      orderBy: { [orderByField]: "desc" },
      take: limit,
      include: {
        User: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
    return leaderboard.map(({ User, ...rest }) => ({ ...rest, user: User }));
  }

  /**
   * Get staff profile with stats and badges
   */
  async getStaffProfile(
    userId: string,
    campgroundId: string,
  ): Promise<{
    stats: OpStaffStats;
    badges: Array<OpStaffBadge & { badge: OpBadge }>;
    recentActivity: OpStaffDailyStats[];
    level: number;
    nextLevelProgress: number;
  }> {
    const stats = await this.getOrCreateStats(userId, campgroundId);

    const badges = await this.prisma.opStaffBadge.findMany({
      where: { userId, campgroundId },
      include: { OpBadge: true },
      orderBy: { earnedAt: "desc" },
    });
    const mappedBadges = badges.map(({ OpBadge, ...rest }) => ({ ...rest, badge: OpBadge }));

    // Get last 14 days of activity
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const recentActivity = await this.prisma.opStaffDailyStats.findMany({
      where: {
        userId,
        campgroundId,
        date: { gte: fourteenDaysAgo },
      },
      orderBy: { date: "desc" },
    });

    // Calculate level
    const level = this.calculateLevel(stats.totalPoints);
    const nextLevelProgress = this.calculateLevelProgress(stats.totalPoints);

    return { stats, badges: mappedBadges, recentActivity, level, nextLevelProgress };
  }

  /**
   * Get all staff with their stats for a campground
   */
  async getAllStaffStats(campgroundId: string): Promise<
    Array<
      OpStaffStats & {
        user: { id: string; firstName: string; lastName: string };
      }
    >
  > {
    const stats = await this.prisma.opStaffStats.findMany({
      where: { campgroundId },
      include: {
        User: {
          select: { id: true, firstName: true, lastName: true },
        },
        // Note: This relation might not exist directly - we may need to query badges separately
      },
      orderBy: { totalPoints: "desc" },
    });
    return stats.map(({ User, ...rest }) => ({ ...rest, user: User }));
  }

  // ============================================================
  // TASK COMPLETION PROCESSING
  // ============================================================

  /**
   * Process a completed task for gamification
   * Called when a task is marked as completed
   */
  async processTaskCompletion(
    taskId: string,
    userId: string,
    campgroundId: string,
    wasOnTime: boolean,
    completionTimeMinutes?: number,
  ): Promise<{
    pointsEarned: number;
    newBadges: OpBadge[];
    streakUpdated: boolean;
    levelUp: boolean;
  }> {
    const result: {
      pointsEarned: number;
      newBadges: OpBadge[];
      streakUpdated: boolean;
      levelUp: boolean;
    } = {
      pointsEarned: 0,
      newBadges: [],
      streakUpdated: false,
      levelUp: false,
    };

    // Get or create stats
    const stats = await this.getOrCreateStats(userId, campgroundId);
    const previousLevel = this.calculateLevel(stats.totalPoints);

    // Calculate points
    result.pointsEarned = this.POINTS.TASK_COMPLETED;
    if (wasOnTime) {
      result.pointsEarned += this.POINTS.TASK_ON_TIME;
    }
    if (completionTimeMinutes && completionTimeMinutes < 30) {
      result.pointsEarned += this.POINTS.TASK_EARLY;
    }

    // Update daily stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Track fast completions (under 30 minutes)
    const FAST_COMPLETION_THRESHOLD_MINUTES = 30;
    const isFastCompletion =
      completionTimeMinutes !== undefined &&
      completionTimeMinutes < FAST_COMPLETION_THRESHOLD_MINUTES;

    const dailyStats = await this.prisma.opStaffDailyStats.upsert({
      where: {
        userId_campgroundId_date: { userId, campgroundId, date: today },
      },
      create: {
        id: randomUUID(),
        userId,
        campgroundId,
        date: today,
        tasksCompleted: 1,
        tasksOnTime: wasOnTime ? 1 : 0,
        tasksLate: wasOnTime ? 0 : 1,
        pointsEarned: result.pointsEarned,
        isWorkDay: true,
        fastCompletions: isFastCompletion ? 1 : 0,
        ...(completionTimeMinutes && {
          avgCompletionTime: completionTimeMinutes,
          fastestTask: completionTimeMinutes,
        }),
      },
      update: {
        tasksCompleted: { increment: 1 },
        tasksOnTime: { increment: wasOnTime ? 1 : 0 },
        tasksLate: { increment: wasOnTime ? 0 : 1 },
        pointsEarned: { increment: result.pointsEarned },
        isWorkDay: true,
        fastCompletions: { increment: isFastCompletion ? 1 : 0 },
      },
    });

    // Update streak
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const yesterdayStats = await this.prisma.opStaffDailyStats.findUnique({
      where: {
        userId_campgroundId_date: { userId, campgroundId, date: yesterday },
      },
    });

    let newStreak = stats.currentStreak;
    let newPerfectStreak = stats.currentPerfectStreak;

    // If yesterday was a work day, continue streak; otherwise check if it's a new streak start
    if (yesterdayStats?.isWorkDay) {
      // Continue streak
      if (dailyStats.tasksCompleted === 1) {
        // First task today, increment streak
        newStreak = stats.currentStreak + 1;
        result.streakUpdated = true;
        result.pointsEarned += this.POINTS.STREAK_DAY;
      }
    } else if (!yesterdayStats) {
      // Yesterday wasn't tracked, check if we should reset
      // For simplicity, if there's no yesterday record, don't break streak on first task of day
      if (stats.lastTaskAt) {
        const daysSinceLastTask = Math.floor(
          (today.getTime() - new Date(stats.lastTaskAt).getTime()) / (1000 * 60 * 60 * 24),
        );
        if (daysSinceLastTask > 1) {
          newStreak = 1; // Reset streak
        }
      }
    }

    // Update aggregate stats
    await this.prisma.opStaffStats.update({
      where: { id: stats.id },
      data: {
        totalTasksCompleted: { increment: 1 },
        totalTasksOnTime: { increment: wasOnTime ? 1 : 0 },
        totalTasksLate: { increment: wasOnTime ? 0 : 1 },
        totalPoints: { increment: result.pointsEarned },
        totalFastCompletions: { increment: isFastCompletion ? 1 : 0 },
        weekTasksCompleted: { increment: 1 },
        weekTasksOnTime: { increment: wasOnTime ? 1 : 0 },
        weekPoints: { increment: result.pointsEarned },
        weekFastCompletions: { increment: isFastCompletion ? 1 : 0 },
        monthTasksCompleted: { increment: 1 },
        monthTasksOnTime: { increment: wasOnTime ? 1 : 0 },
        monthPoints: { increment: result.pointsEarned },
        currentStreak: newStreak,
        longestStreak: Math.max(stats.longestStreak, newStreak),
        currentPerfectStreak: wasOnTime ? newPerfectStreak + 1 : 0,
        longestPerfectStreak: Math.max(
          stats.longestPerfectStreak,
          wasOnTime ? newPerfectStreak + 1 : newPerfectStreak,
        ),
        lastTaskAt: new Date(),
      },
    });

    // Check for new badges
    result.newBadges = await this.checkAndAwardBadges(userId, campgroundId);

    // Check for level up
    const newLevel = this.calculateLevel(stats.totalPoints + result.pointsEarned);
    if (newLevel > previousLevel) {
      result.levelUp = true;
      // Award level-up bonus
      await this.prisma.opStaffStats.update({
        where: { id: stats.id },
        data: {
          totalPoints: { increment: this.POINTS.LEVEL_UP },
          weekPoints: { increment: this.POINTS.LEVEL_UP },
          monthPoints: { increment: this.POINTS.LEVEL_UP },
        },
      });
      result.pointsEarned += this.POINTS.LEVEL_UP;
    }

    return result;
  }

  /**
   * Check and award any badges the user has newly qualified for
   */
  private async checkAndAwardBadges(userId: string, campgroundId: string): Promise<OpBadge[]> {
    const newBadges: OpBadge[] = [];

    // Get all badges and user's current badges
    const [allBadges, earnedBadgeIds] = await Promise.all([
      this.getBadges(campgroundId),
      this.prisma.opStaffBadge.findMany({
        where: { userId, campgroundId },
        select: { badgeId: true },
      }),
    ]);

    const earnedSet = new Set(earnedBadgeIds.map((b) => b.badgeId));
    const stats = await this.getOrCreateStats(userId, campgroundId);

    // Get today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dailyStats = await this.prisma.opStaffDailyStats.findUnique({
      where: {
        userId_campgroundId_date: { userId, campgroundId, date: today },
      },
    });

    for (const badge of allBadges) {
      if (earnedSet.has(badge.id)) continue; // Already earned

      const criteria = parseBadgeCriteria(badge.criteria);
      if (!criteria) {
        this.logger.warn(`Badge ${badge.code} has invalid criteria`);
        continue;
      }
      let qualified = false;

      switch (criteria.type) {
        case "task_count":
          if (criteria.timeframe === "day") {
            qualified = (dailyStats?.tasksCompleted || 0) >= criteria.threshold;
          } else {
            qualified = stats.totalTasksCompleted >= criteria.threshold;
          }
          break;

        case "streak":
          qualified = stats.currentStreak >= criteria.threshold;
          break;

        case "sla_compliance":
          if (criteria.timeframe === "day") {
            qualified =
              !!dailyStats &&
              dailyStats.tasksCompleted > 0 &&
              dailyStats.tasksOnTime === dailyStats.tasksCompleted;
          } else {
            qualified =
              stats.totalTasksCompleted > 0 && stats.slaComplianceRate >= criteria.threshold;
          }
          break;

        case "speed":
          // Check fast completions (tasks completed in under 30 minutes)
          if (criteria.timeframe === "day") {
            qualified = (dailyStats?.fastCompletions || 0) >= criteria.threshold;
          } else if (criteria.timeframe === "week") {
            qualified = stats.weekFastCompletions >= criteria.threshold;
          } else {
            qualified = stats.totalFastCompletions >= criteria.threshold;
          }
          break;
      }

      if (qualified) {
        try {
          await this.prisma.opStaffBadge.create({
            data: {
              id: randomUUID(),
              userId,
              badgeId: badge.id,
              campgroundId,
              context: {
                streak: stats.currentStreak,
                tasksCompleted: stats.totalTasksCompleted,
                slaCompliance: stats.slaComplianceRate,
              },
            },
          });

          // Award badge points
          await this.prisma.opStaffStats.update({
            where: { userId_campgroundId: { userId, campgroundId } },
            data: {
              totalPoints: { increment: badge.points },
              weekPoints: { increment: badge.points },
              monthPoints: { increment: badge.points },
            },
          });

          newBadges.push(badge);
          this.logger.log(`User ${userId} earned badge: ${badge.name}`);
        } catch (error: unknown) {
          // Unique constraint violation means already earned
          this.logger.debug(
            `Badge ${badge.code} already earned or error: ${error instanceof Error ? error.message : "Unknown"}`,
          );
        }
      }
    }

    return newBadges;
  }

  // ============================================================
  // PERIODIC UPDATES
  // ============================================================

  /**
   * Reset weekly stats (runs Monday at midnight)
   */
  @Cron("0 0 * * 1") // Every Monday at midnight
  async resetWeeklyStats(): Promise<void> {
    this.logger.log("Resetting weekly stats...");

    await this.prisma.opStaffStats.updateMany({
      data: {
        weekTasksCompleted: 0,
        weekTasksOnTime: 0,
        weekPoints: 0,
        weekFastCompletions: 0,
        weeklyRank: null,
      },
    });
  }

  /**
   * Reset monthly stats (runs 1st of month at midnight)
   */
  @Cron("0 0 1 * *") // First day of month at midnight
  async resetMonthlyStats(): Promise<void> {
    this.logger.log("Resetting monthly stats...");

    await this.prisma.opStaffStats.updateMany({
      data: {
        monthTasksCompleted: 0,
        monthTasksOnTime: 0,
        monthPoints: 0,
        monthlyRank: null,
      },
    });
  }

  /**
   * Update rankings and SLA compliance rates (runs hourly)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async updateRankings(): Promise<void> {
    this.logger.log("Updating rankings...");

    // Get all campgrounds with staff stats
    const campgrounds = await this.prisma.campground.findMany({
      where: {
        OpStaffStats: { some: {} },
      },
      select: { id: true },
    });

    for (const campground of campgrounds) {
      // Update weekly rankings
      const weeklyStats = await this.prisma.opStaffStats.findMany({
        where: { campgroundId: campground.id },
        orderBy: { weekPoints: "desc" },
      });

      for (let i = 0; i < weeklyStats.length; i++) {
        await this.prisma.opStaffStats.update({
          where: { id: weeklyStats[i].id },
          data: { weeklyRank: i + 1 },
        });
      }

      // Update monthly rankings
      const monthlyStats = await this.prisma.opStaffStats.findMany({
        where: { campgroundId: campground.id },
        orderBy: { monthPoints: "desc" },
      });

      for (let i = 0; i < monthlyStats.length; i++) {
        await this.prisma.opStaffStats.update({
          where: { id: monthlyStats[i].id },
          data: { monthlyRank: i + 1 },
        });
      }

      // Update all-time rankings
      const allTimeStats = await this.prisma.opStaffStats.findMany({
        where: { campgroundId: campground.id },
        orderBy: { totalPoints: "desc" },
      });

      for (let i = 0; i < allTimeStats.length; i++) {
        const stats = allTimeStats[i];
        const compliance =
          stats.totalTasksCompleted > 0
            ? (stats.totalTasksOnTime / stats.totalTasksCompleted) * 100
            : 100;

        await this.prisma.opStaffStats.update({
          where: { id: stats.id },
          data: {
            allTimeRank: i + 1,
            slaComplianceRate: Math.round(compliance * 10) / 10,
          },
        });
      }
    }

    this.logger.log("Rankings updated successfully");
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private calculateLevel(totalPoints: number): number {
    for (let i = this.LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (totalPoints >= this.LEVEL_THRESHOLDS[i]) {
        return i + 1;
      }
    }
    return 1;
  }

  private calculateLevelProgress(totalPoints: number): number {
    const level = this.calculateLevel(totalPoints);
    if (level >= this.LEVEL_THRESHOLDS.length) return 100;

    const currentThreshold = this.LEVEL_THRESHOLDS[level - 1];
    const nextThreshold = this.LEVEL_THRESHOLDS[level];
    const progress = ((totalPoints - currentThreshold) / (nextThreshold - currentThreshold)) * 100;

    return Math.round(progress);
  }
}
