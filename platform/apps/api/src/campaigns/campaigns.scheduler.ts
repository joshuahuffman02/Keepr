import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { CampaignStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CampaignsService } from "./campaigns.service";
import { JobQueueService } from "../observability/job-queue.service";

@Injectable()
export class CampaignsScheduler {
  private readonly logger = new Logger(CampaignsScheduler.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly campaigns: CampaignsService,
    private readonly queue: JobQueueService,
  ) {}

  @Cron("*/1 * * * *")
  async dispatchScheduled() {
    const now = new Date();
    const due = await this.prisma.campaign.findMany({
      where: {
        status: CampaignStatus.scheduled,
        scheduledAt: { lte: now },
      },
      select: { id: true },
    });
    await Promise.all(
      due.map((c) =>
        this.queue
          .enqueue("campaign-dispatch", () => this.campaigns.sendNow(c.id), {
            jobName: `campaign-${c.id}`,
            timeoutMs: 20000,
            concurrency: 2,
          })
          .catch((err) => {
            this.logger.warn(
              `Failed to dispatch scheduled campaign ${c.id}: ${err instanceof Error ? err.message : err}`,
            );
          }),
      ),
    );
  }
}
