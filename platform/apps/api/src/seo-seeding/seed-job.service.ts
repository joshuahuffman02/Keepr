import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CampgroundDataSource, Prisma } from "@prisma/client";

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

@Injectable()
export class SeedJobService {
  private readonly logger = new Logger(SeedJobService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new seed job
   */
  async createJob(dto: CreateSeedJobDto): Promise<string> {
    const job = await this.prisma.campgroundSeedJob.create({
      data: {
        dataSource: dto.dataSource,
        targetState: dto.targetState,
        targetRegion: dto.targetRegion,
        status: "pending",
      },
    });

    this.logger.log(
      `Created seed job ${job.id} for ${dto.dataSource}${dto.targetState ? ` (${dto.targetState})` : ""}`
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
    }
  ): Promise<void> {
    const data: Prisma.CampgroundSeedJobUpdateInput = {};

    if (progress.recordsProcessed !== undefined) {
      data.recordsProcessed = progress.recordsProcessed;
    }
    if (progress.recordsCreated !== undefined) {
      data.recordsCreated = progress.recordsCreated;
    }
    if (progress.recordsUpdated !== undefined) {
      data.recordsUpdated = progress.recordsUpdated;
    }
    if (progress.recordsFailed !== undefined) {
      data.recordsFailed = progress.recordsFailed;
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
    }
  ): Promise<void> {
    await this.prisma.campgroundSeedJob.update({
      where: { id: jobId },
      data: {
        status: "completed",
        completedAt: new Date(),
        recordsProcessed: stats.recordsProcessed,
        recordsCreated: stats.recordsCreated,
        recordsUpdated: stats.recordsUpdated,
        recordsFailed: stats.recordsFailed,
      },
    });

    this.logger.log(
      `Completed seed job ${jobId}: processed=${stats.recordsProcessed}, created=${stats.recordsCreated}, updated=${stats.recordsUpdated}, failed=${stats.recordsFailed}`
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
        errorMessage,
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
    if (job.status === "completed") {
      progress = 100;
    } else if (job.status === "running" && job.recordsProcessed > 0) {
      // Estimate based on typical state size (~500 campgrounds avg)
      const estimatedTotal = job.targetState ? 500 : 25000;
      progress = Math.min(
        99,
        Math.round((job.recordsProcessed / estimatedTotal) * 100)
      );
    }

    return {
      jobId: job.id,
      status: job.status,
      progress,
      recordsProcessed: job.recordsProcessed,
      recordsCreated: job.recordsCreated,
      recordsUpdated: job.recordsUpdated,
      recordsFailed: job.recordsFailed,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      errorMessage: job.errorMessage,
    };
  }

  /**
   * List recent jobs
   */
  async listJobs(options: { limit?: number; dataSource?: CampgroundDataSource } = {}) {
    const { limit = 20, dataSource } = options;

    const where: Prisma.CampgroundSeedJobWhereInput = {};
    if (dataSource) {
      where.dataSource = dataSource;
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
  async getLastSuccessfulJob(
    dataSource: CampgroundDataSource,
    targetState?: string
  ) {
    return this.prisma.campgroundSeedJob.findFirst({
      where: {
        dataSource,
        targetState,
        status: "completed",
      },
      orderBy: { completedAt: "desc" },
    });
  }

  /**
   * Check if a job is currently running for a data source/state
   */
  async isJobRunning(
    dataSource: CampgroundDataSource,
    targetState?: string
  ): Promise<boolean> {
    const runningJob = await this.prisma.campgroundSeedJob.findFirst({
      where: {
        dataSource,
        targetState,
        status: "running",
      },
    });

    return !!runningJob;
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
          recordsCreated: true,
          recordsUpdated: true,
        },
      }),
    ]);

    return {
      totalJobs: total,
      completedJobs: completed,
      failedJobs: failed,
      runningJobs: running,
      totalRecordsCreated: aggregates._sum.recordsCreated || 0,
      totalRecordsUpdated: aggregates._sum.recordsUpdated || 0,
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
