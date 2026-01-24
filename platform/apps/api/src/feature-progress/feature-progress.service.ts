import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { randomUUID } from "crypto";

export interface FeatureProgressItem {
  featureKey: string;
  completed: boolean;
  completedAt: Date | null;
  notes: string | null;
}

@Injectable()
export class FeatureProgressService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all feature progress for a user
   */
  async getProgress(userId: string): Promise<FeatureProgressItem[]> {
    const progress = await this.prisma.featureProgress.findMany({
      where: { userId },
      select: {
        featureKey: true,
        completed: true,
        completedAt: true,
        notes: true,
      },
    });

    return progress;
  }

  /**
   * Get progress for a specific feature
   */
  async getFeatureProgress(userId: string, featureKey: string) {
    return this.prisma.featureProgress.findUnique({
      where: {
        userId_featureKey: { userId, featureKey },
      },
    });
  }

  /**
   * Mark a feature as completed
   */
  async markCompleted(userId: string, featureKey: string, notes?: string) {
    return this.prisma.featureProgress.upsert({
      where: {
        userId_featureKey: { userId, featureKey },
      },
      update: {
        completed: true,
        completedAt: new Date(),
        notes: notes ?? null,
      },
      create: {
        id: randomUUID(),
        userId,
        featureKey,
        completed: true,
        completedAt: new Date(),
        notes: notes ?? null,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Mark a feature as not completed (unchecked)
   */
  async markIncomplete(userId: string, featureKey: string) {
    const existing = await this.prisma.featureProgress.findUnique({
      where: {
        userId_featureKey: { userId, featureKey },
      },
    });

    if (!existing) {
      return null;
    }

    return this.prisma.featureProgress.update({
      where: {
        userId_featureKey: { userId, featureKey },
      },
      data: {
        completed: false,
        completedAt: null,
      },
    });
  }

  /**
   * Toggle feature completion status
   */
  async toggleFeature(userId: string, featureKey: string) {
    const existing = await this.prisma.featureProgress.findUnique({
      where: {
        userId_featureKey: { userId, featureKey },
      },
    });

    if (existing?.completed) {
      return this.markIncomplete(userId, featureKey);
    } else {
      return this.markCompleted(userId, featureKey);
    }
  }

  /**
   * Bulk update feature progress
   */
  async bulkUpdate(userId: string, updates: Array<{ featureKey: string; completed: boolean }>) {
    const operations = updates.map((update) =>
      this.prisma.featureProgress.upsert({
        where: {
          userId_featureKey: { userId, featureKey: update.featureKey },
        },
        update: {
          completed: update.completed,
          completedAt: update.completed ? new Date() : null,
        },
        create: {
          id: randomUUID(),
          userId,
          featureKey: update.featureKey,
          completed: update.completed,
          completedAt: update.completed ? new Date() : null,
          updatedAt: new Date(),
        },
      }),
    );

    return this.prisma.$transaction(operations);
  }

  /**
   * Get completion statistics for a user
   */
  async getStats(userId: string) {
    const allProgress = await this.prisma.featureProgress.findMany({
      where: { userId },
    });

    const completed = allProgress.filter((p) => p.completed).length;
    const total = allProgress.length;

    return {
      completed,
      total,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }

  /**
   * Reset all feature progress for a user
   */
  async resetProgress(userId: string) {
    await this.prisma.featureProgress.deleteMany({
      where: { userId },
    });

    return { success: true };
  }
}
