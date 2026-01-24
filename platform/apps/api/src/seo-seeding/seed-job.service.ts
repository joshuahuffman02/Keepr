import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CampgroundDataSource, Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

/**
 * Seed Job Service
 *
 * Manages CampgroundSeedJob records for tracking seeding operations.
 * Provides job scheduling, status tracking, and progress reporting.
 */

export interface CreateSeedJobDto {
  dataSource: CampgroundDataSource;
  targetState?: string;
  targetRegion?: string;
}

export interface SeedJobProgress {
  jobId: string;
  status: string;
  progress: number;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsFailed: number;
  startedAt: Date | null;
  completedAt: Date | null;
  errorMessage: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getConfigValue = (config: unknown, key: string): string | undefined => {
  if (!isRecord(config)) return undefined;
  const value = config[key];
  return typeof value === "string" ? value : undefined;
};

@Injectable()
export class SeedJobService {
  private readonly logger = new Logger(SeedJobService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new seed job
   */
  async createJob(dto: CreateSeedJobDto): Promise<string> {
    const config: Record<string, string> = {};
    if (dto.targetState) config.targetState = dto.targetState;
    if (dto.targetRegion) config.targetRegion = dto.targetRegion;
    const configValue = Object.keys(config).length ? config : undefined;

    const job = await this.prisma.campgroundSeedJob.create({
      data: {
        id: randomUUID(),
        source: dto.dataSource,
        status: "pending",
        config: configValue,
        updatedAt: new Date(),
      },
    });

    this.logger.log(
      `Created seed job ${job.id} for ${dto.dataSource}${dto.targetState ? ` (${dto.targetState})` : ""}`,
    );

    return job.id;
  }

  /**
   * Mark job as started
   */
  async startJob(jobId: string): Promise<void> {
    await this.prisma.campgroundSeedJob.update({
      where: { id: jobId },
      data: {
        status: "running",
        startedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    this.logger.log(`Started seed job ${jobId}`);
  }

  /**
   * Update job progress
   */
  async updateProgress(
    jobId: string,
    progress: {
      recordsProcessed?: number;
      recordsCreated?: number;
      recordsUpdated?: number;
      recordsFailed?: number;
    },
  ): Promise<void> {
    const data: Prisma.CampgroundSeedJobUpdateInput = {};

    if (progress.recordsProcessed !== undefined) {
      data.processedRecords = progress.recordsProcessed;
    }
    if (progress.recordsCreated !== undefined) {
      data.createdRecords = progress.recordsCreated;
    }
    if (progress.recordsUpdated !== undefined) {
      data.updatedRecords = progress.recordsUpdated;
    }
    if (progress.recordsFailed !== undefined) {
      data.errorRecords = progress.recordsFailed;
    }

    await this.prisma.campgroundSeedJob.update({
      where: { id: jobId },
      data,
    });
  }

  /**
   * Mark job as completed
   */
  async completeJob(
    jobId: string,
    stats: {
      recordsProcessed: number;
      recordsCreated: number;
      recordsUpdated: number;
      recordsFailed: number;
    },
  ): Promise<void> {
    await this.prisma.campgroundSeedJob.update({
      where: { id: jobId },
      data: {
        status: "completed",
        completedAt: new Date(),
        processedRecords: stats.recordsProcessed,
        createdRecords: stats.recordsCreated,
        updatedRecords: stats.recordsUpdated,
        errorRecords: stats.recordsFailed,
        updatedAt: new Date(),
      },
    });

    this.logger.log(
      `Completed seed job ${jobId}: processed=${stats.recordsProcessed}, created=${stats.recordsCreated}, updated=${stats.recordsUpdated}, failed=${stats.recordsFailed}`,
    );
  }

  /**
   * Mark job as failed
   */
  async failJob(jobId: string, errorMessage: string): Promise<void> {
    await this.prisma.campgroundSeedJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        completedAt: new Date(),
        errors: [{ message: errorMessage, at: new Date().toISOString() }],
        updatedAt: new Date(),
      },
    });

    this.logger.error(`Seed job ${jobId} failed: ${errorMessage}`);
  }

  /**
   * Get job status and progress
   */
  async getJobProgress(jobId: string): Promise<SeedJobProgress | null> {
    const job = await this.prisma.campgroundSeedJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return null;
    }

    // Calculate progress percentage
    let progress = 0;
    const targetState = getConfigValue(job.config, "targetState");
    if (job.status === "completed") {
      progress = 100;
    } else if (job.status === "running" && job.processedRecords > 0) {
      // Estimate based on typical state size (~500 campgrounds avg)
      const estimatedTotal = targetState ? 500 : 25000;
      progress = Math.min(99, Math.round((job.processedRecords / estimatedTotal) * 100));
    }

    const errorMessage = (() => {
      if (Array.isArray(job.errors) && job.errors.length > 0) {
        const first = job.errors[0];
        if (isRecord(first) && typeof first.message === "string") {
          return first.message;
        }
      }
      if (isRecord(job.errors) && typeof job.errors.message === "string") {
        return job.errors.message;
      }
      return null;
    })();

    return {
      jobId: job.id,
      status: job.status,
      progress,
      recordsProcessed: job.processedRecords,
      recordsCreated: job.createdRecords,
      recordsUpdated: job.updatedRecords,
      recordsFailed: job.errorRecords,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      errorMessage,
    };
  }

  /**
   * List recent jobs
   */
  async listJobs(options: { limit?: number; dataSource?: CampgroundDataSource } = {}) {
    const { limit = 20, dataSource } = options;

    const where: Prisma.CampgroundSeedJobWhereInput = {};
    if (dataSource) {
      where.source = dataSource;
    }

    return this.prisma.campgroundSeedJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  /**
   * Get the last successful job for a data source/state
   */
  async getLastSuccessfulJob(dataSource: CampgroundDataSource, targetState?: string) {
    const jobs = await this.prisma.campgroundSeedJob.findMany({
      where: {
        source: dataSource,
        status: "completed",
      },
      orderBy: { completedAt: "desc" },
      take: targetState ? 50 : 1,
    });
    if (!targetState) return jobs[0] ?? null;
    return jobs.find((job) => getConfigValue(job.config, "targetState") === targetState) ?? null;
  }

  /**
   * Check if a job is currently running for a data source/state
   */
  async isJobRunning(dataSource: CampgroundDataSource, targetState?: string): Promise<boolean> {
    const jobs = await this.prisma.campgroundSeedJob.findMany({
      where: {
        source: dataSource,
        status: "running",
      },
      orderBy: { createdAt: "desc" },
      take: targetState ? 50 : 1,
    });
    if (!targetState) return jobs.length > 0;
    return jobs.some((job) => getConfigValue(job.config, "targetState") === targetState);
  }

  /**
   * Get statistics for all seed jobs
   */
  async getJobStats(): Promise<{
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    runningJobs: number;
    totalRecordsCreated: number;
    totalRecordsUpdated: number;
  }> {
    const [total, completed, failed, running, aggregates] = await Promise.all([
      this.prisma.campgroundSeedJob.count(),
      this.prisma.campgroundSeedJob.count({ where: { status: "completed" } }),
      this.prisma.campgroundSeedJob.count({ where: { status: "failed" } }),
      this.prisma.campgroundSeedJob.count({ where: { status: "running" } }),
      this.prisma.campgroundSeedJob.aggregate({
        where: { status: "completed" },
        _sum: {
          createdRecords: true,
          updatedRecords: true,
        },
      }),
    ]);

    return {
      totalJobs: total,
      completedJobs: completed,
      failedJobs: failed,
      runningJobs: running,
      totalRecordsCreated: aggregates._sum?.createdRecords ?? 0,
      totalRecordsUpdated: aggregates._sum?.updatedRecords ?? 0,
    };
  }

  /**
   * Clean up old completed/failed jobs (retention policy)
   */
  async cleanupOldJobs(retentionDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.prisma.campgroundSeedJob.deleteMany({
      where: {
        status: { in: ["completed", "failed"] },
        completedAt: { lt: cutoffDate },
      },
    });

    this.logger.log(`Cleaned up ${result.count} old seed jobs`);
    return result.count;
  }
}
