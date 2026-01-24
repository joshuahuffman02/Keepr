import { Controller, Get, Post, Param, Body, UseGuards, Query } from "@nestjs/common";
import { JwtAuthGuard, RolesGuard, Roles } from "../auth/guards";
import { PlatformRole } from "@prisma/client";
import { BullQueueService, QueueStats } from "./bull-queue.service";

@Controller("admin/queues")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PlatformRole.platform_admin)
export class QueuesController {
  constructor(private readonly queueService: BullQueueService) {}

  /**
   * Get all queue statistics
   */
  @Get()
  async getAllStats(): Promise<{ queues: QueueStats[] }> {
    const queues = await this.queueService.getAllStats();
    return { queues };
  }

  /**
   * Get statistics for a specific queue
   */
  @Get(":queueName")
  async getQueueStats(@Param("queueName") queueName: string): Promise<QueueStats> {
    return this.queueService.getStats(queueName);
  }

  /**
   * Get failed jobs for a queue
   */
  @Get(":queueName/failed")
  async getFailedJobs(@Param("queueName") queueName: string, @Query("limit") limit?: string) {
    const jobs = await this.queueService.getFailedJobs(
      queueName,
      limit ? parseInt(limit, 10) : 100,
    );
    return { jobs, count: jobs.length };
  }

  /**
   * Retry failed jobs
   */
  @Post(":queueName/retry")
  async retryFailed(@Param("queueName") queueName: string, @Body() body: { jobId?: string }) {
    const count = await this.queueService.retryFailed(queueName, body.jobId);
    return { retried: count };
  }

  /**
   * Clean old jobs from a queue
   */
  @Post(":queueName/clean")
  async cleanQueue(
    @Param("queueName") queueName: string,
    @Body() body: { grace?: number; status?: "completed" | "failed" },
  ) {
    const grace = body.grace ?? 86400000; // Default 24 hours
    const status = body.status ?? "completed";
    const cleaned = await this.queueService.clean(queueName, grace, status);
    return { cleaned };
  }
}
