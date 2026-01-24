import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { DateRange } from "../platform-analytics.service";

export interface CreateGoalDto {
  name: string;
  description?: string;
  metric: string;
  target: number;
  unit: "currency" | "percentage" | "number" | "score";
  period: string;
  category: "revenue" | "bookings" | "guests" | "satisfaction";
  dueDate: string;
  campgroundId?: string;
}

export interface UpdateGoalDto {
  name?: string;
  description?: string;
  metric?: string;
  target?: number;
  current?: number;
  unit?: "currency" | "percentage" | "number" | "score";
  period?: string;
  category?: "revenue" | "bookings" | "guests" | "satisfaction";
  status?: "on_track" | "at_risk" | "behind" | "achieved";
  dueDate?: string;
}

export interface GoalWithProgress {
  id: string;
  name: string;
  description: string | null;
  metric: string;
  target: number;
  current: number;
  unit: string;
  period: string;
  category: string;
  status: string;
  dueDate: Date;
  createdAt: Date;
  updatedAt: Date;
  progress: number;
  daysRemaining: number;
  trend: "up" | "down" | "flat";
  campgroundId: string | null;
  campgroundName?: string;
}

@Injectable()
export class GoalsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all platform goals with computed progress
   */
  async getGoals(params?: {
    category?: string;
    status?: string;
    campgroundId?: string;
  }): Promise<GoalWithProgress[]> {
    const where: Record<string, unknown> = {};

    if (params?.category) {
      where.category = params.category;
    }
    if (params?.status) {
      where.status = params.status;
    }
    if (params?.campgroundId) {
      where.campgroundId = params.campgroundId;
    }

    const goals = await this.prisma.platformGoal.findMany({
      where,
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      include: {
        Campground: {
          select: { name: true },
        },
      },
    });

    return goals.map((goal) => ({
      id: goal.id,
      name: goal.name,
      description: goal.description,
      metric: goal.metric,
      target: goal.target,
      current: goal.current,
      unit: goal.unit,
      period: goal.period,
      category: goal.category,
      status: goal.status,
      dueDate: goal.dueDate,
      createdAt: goal.createdAt,
      updatedAt: goal.updatedAt,
      campgroundId: goal.campgroundId,
      campgroundName: goal.Campground?.name,
      progress: goal.target > 0 ? (goal.current / goal.target) * 100 : 0,
      daysRemaining: Math.ceil(
        (goal.dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
      ),
      trend: this.determineTrend(goal.current, goal.target, goal.status),
    }));
  }

  /**
   * Get a single goal by ID
   */
  async getGoal(id: string): Promise<GoalWithProgress | null> {
    const goal = await this.prisma.platformGoal.findUnique({
      where: { id },
      include: {
        Campground: {
          select: { name: true },
        },
      },
    });

    if (!goal) return null;

    return {
      id: goal.id,
      name: goal.name,
      description: goal.description,
      metric: goal.metric,
      target: goal.target,
      current: goal.current,
      unit: goal.unit,
      period: goal.period,
      category: goal.category,
      status: goal.status,
      dueDate: goal.dueDate,
      createdAt: goal.createdAt,
      updatedAt: goal.updatedAt,
      campgroundId: goal.campgroundId,
      campgroundName: goal.Campground?.name,
      progress: goal.target > 0 ? (goal.current / goal.target) * 100 : 0,
      daysRemaining: Math.ceil(
        (goal.dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
      ),
      trend: this.determineTrend(goal.current, goal.target, goal.status),
    };
  }

  /**
   * Create a new goal
   */
  async createGoal(data: CreateGoalDto, createdBy?: string): Promise<GoalWithProgress> {
    const createData: Prisma.PlatformGoalUncheckedCreateInput = {
      id: randomUUID(),
      name: data.name,
      description: data.description,
      metric: data.metric,
      target: data.target,
      current: 0,
      unit: data.unit,
      period: data.period,
      category: data.category,
      status: "on_track",
      dueDate: new Date(data.dueDate),
      createdBy,
      updatedAt: new Date(),
      ...(data.campgroundId ? { campgroundId: data.campgroundId } : {}),
    };
    const goal = await this.prisma.platformGoal.create({
      data: createData,
      include: {
        Campground: {
          select: { name: true },
        },
      },
    });

    return {
      id: goal.id,
      name: goal.name,
      description: goal.description,
      metric: goal.metric,
      target: goal.target,
      current: goal.current,
      unit: goal.unit,
      period: goal.period,
      category: goal.category,
      status: goal.status,
      dueDate: goal.dueDate,
      createdAt: goal.createdAt,
      updatedAt: goal.updatedAt,
      campgroundId: goal.campgroundId,
      campgroundName: goal.Campground?.name,
      progress: 0,
      daysRemaining: Math.ceil(
        (goal.dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
      ),
      trend: "flat",
    };
  }

  /**
   * Update a goal
   */
  async updateGoal(id: string, data: UpdateGoalDto): Promise<GoalWithProgress | null> {
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.metric !== undefined) updateData.metric = data.metric;
    if (data.target !== undefined) updateData.target = data.target;
    if (data.current !== undefined) updateData.current = data.current;
    if (data.unit !== undefined) updateData.unit = data.unit;
    if (data.period !== undefined) updateData.period = data.period;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.dueDate !== undefined) updateData.dueDate = new Date(data.dueDate);

    const goal = await this.prisma.platformGoal.update({
      where: { id },
      data: updateData,
      include: {
        Campground: {
          select: { name: true },
        },
      },
    });

    return {
      id: goal.id,
      name: goal.name,
      description: goal.description,
      metric: goal.metric,
      target: goal.target,
      current: goal.current,
      unit: goal.unit,
      period: goal.period,
      category: goal.category,
      status: goal.status,
      dueDate: goal.dueDate,
      createdAt: goal.createdAt,
      updatedAt: goal.updatedAt,
      campgroundId: goal.campgroundId,
      campgroundName: goal.Campground?.name,
      progress: goal.target > 0 ? (goal.current / goal.target) * 100 : 0,
      daysRemaining: Math.ceil(
        (goal.dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
      ),
      trend: this.determineTrend(goal.current, goal.target, goal.status),
    };
  }

  /**
   * Delete a goal
   */
  async deleteGoal(id: string): Promise<boolean> {
    await this.prisma.platformGoal.delete({ where: { id } });
    return true;
  }

  /**
   * Get goal summary statistics
   */
  async getGoalSummary() {
    const goals = await this.prisma.platformGoal.findMany();

    return {
      total: goals.length,
      onTrack: goals.filter((g) => g.status === "on_track").length,
      atRisk: goals.filter((g) => g.status === "at_risk").length,
      behind: goals.filter((g) => g.status === "behind").length,
      achieved: goals.filter((g) => g.status === "achieved").length,
      byCategory: {
        revenue: goals.filter((g) => g.category === "revenue").length,
        bookings: goals.filter((g) => g.category === "bookings").length,
        guests: goals.filter((g) => g.category === "guests").length,
        satisfaction: goals.filter((g) => g.category === "satisfaction").length,
      },
    };
  }

  /**
   * Update goal progress based on current metrics
   * This can be called periodically to sync goal current values with actual data
   */
  async syncGoalProgress(dateRange: DateRange): Promise<void> {
    const { start, end } = dateRange;

    // Get all active goals
    const goals = await this.prisma.platformGoal.findMany({
      where: {
        status: { notIn: ["achieved"] },
        dueDate: { gte: new Date() },
      },
    });

    for (const goal of goals) {
      let currentValue: number | null = null;

      // Fetch current value based on metric type
      switch (goal.metric.toLowerCase()) {
        case "total revenue":
          const revenueResult = await this.prisma.reservation.aggregate({
            where: {
              createdAt: { gte: start, lte: end },
              status: { notIn: ["cancelled"] },
              ...(goal.campgroundId && { campgroundId: goal.campgroundId }),
            },
            _sum: { totalAmount: true },
          });
          currentValue = revenueResult._sum.totalAmount ?? 0;
          break;

        case "nps score":
          const npsResponses = await this.prisma.npsResponse.findMany({
            where: {
              createdAt: { gte: start, lte: end },
              ...(goal.campgroundId && { campgroundId: goal.campgroundId }),
            },
            select: { score: true },
          });
          if (npsResponses.length >= 5) {
            const promoters = npsResponses.filter((r) => r.score >= 9).length;
            const detractors = npsResponses.filter((r) => r.score <= 6).length;
            currentValue = Math.round(((promoters - detractors) / npsResponses.length) * 100);
          }
          break;

        case "total reservations":
          const resCount = await this.prisma.reservation.count({
            where: {
              createdAt: { gte: start, lte: end },
              status: { notIn: ["cancelled"] },
              ...(goal.campgroundId && { campgroundId: goal.campgroundId }),
            },
          });
          currentValue = resCount;
          break;

        case "cancellation rate":
          const [cancelled, total] = await Promise.all([
            this.prisma.reservation.count({
              where: {
                updatedAt: { gte: start, lte: end },
                status: "cancelled",
                ...(goal.campgroundId && { campgroundId: goal.campgroundId }),
              },
            }),
            this.prisma.reservation.count({
              where: {
                createdAt: { gte: start, lte: end },
                ...(goal.campgroundId && { campgroundId: goal.campgroundId }),
              },
            }),
          ]);
          currentValue = total > 0 ? (cancelled / total) * 100 : 0;
          break;

        case "repeat guest rate":
          const [repeatGuests, totalGuests] = await Promise.all([
            this.prisma.guest.count({
              where: {
                Reservation: {
                  some: {
                    createdAt: { gte: start, lte: end },
                    ...(goal.campgroundId && { campgroundId: goal.campgroundId }),
                  },
                },
                repeatStays: { gt: 0 },
              },
            }),
            this.prisma.guest.count({
              where: {
                Reservation: {
                  some: {
                    createdAt: { gte: start, lte: end },
                    ...(goal.campgroundId && { campgroundId: goal.campgroundId }),
                  },
                },
              },
            }),
          ]);
          currentValue = totalGuests > 0 ? (repeatGuests / totalGuests) * 100 : 0;
          break;

        case "average daily rate":
          const adrReservations = await this.prisma.reservation.findMany({
            where: {
              createdAt: { gte: start, lte: end },
              status: { notIn: ["cancelled"] },
              ...(goal.campgroundId && { campgroundId: goal.campgroundId }),
            },
            select: {
              totalAmount: true,
              arrivalDate: true,
              departureDate: true,
            },
          });
          const nightlyRates = adrReservations
            .map((res) => {
              const nights = Math.ceil(
                (new Date(res.departureDate).getTime() - new Date(res.arrivalDate).getTime()) /
                  (1000 * 60 * 60 * 24),
              );
              return nights > 0 ? (res.totalAmount || 0) / nights : null;
            })
            .filter((rate): rate is number => rate !== null);
          currentValue =
            nightlyRates.length > 0
              ? nightlyRates.reduce((sum, rate) => sum + rate, 0) / nightlyRates.length
              : 0;
          break;
      }

      if (currentValue !== null) {
        // Determine status based on progress
        const progress = (currentValue / goal.target) * 100;
        const daysRemaining = Math.ceil(
          (goal.dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
        );
        const expectedProgress = 100 - (daysRemaining / 90) * 100; // Assume 90-day goals

        let newStatus = goal.status;
        if (progress >= 100) {
          newStatus = "achieved";
        } else if (progress >= expectedProgress - 10) {
          newStatus = "on_track";
        } else if (progress >= expectedProgress - 25) {
          newStatus = "at_risk";
        } else {
          newStatus = "behind";
        }

        await this.prisma.platformGoal.update({
          where: { id: goal.id },
          data: {
            current: currentValue,
            status: newStatus,
          },
        });
      }
    }
  }

  private determineTrend(current: number, target: number, status: string): "up" | "down" | "flat" {
    // Simple trend determination based on status
    if (status === "achieved" || status === "on_track") return "up";
    if (status === "behind") return "down";
    return "flat";
  }
}
