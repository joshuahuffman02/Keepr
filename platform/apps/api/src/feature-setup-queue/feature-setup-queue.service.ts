import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateFeatureQueueDto,
  BulkCreateFeatureQueueDto,
  UpdateFeatureQueueDto,
  FeatureQueueListResponseDto,
  FeatureSetupStatus,
} from "./dto/feature-setup-queue.dto";

// Local type for Prisma FeatureSetupQueue (until Prisma client generation is fixed)
interface FeatureSetupQueue {
  id: string;
  campgroundId: string;
  featureKey: string;
  status: FeatureSetupStatus;
  priority: number;
  completedAt: Date | null;
  skippedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class FeatureSetupQueueService {
  private readonly logger = new Logger(FeatureSetupQueueService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all queue items for a campground
   */
  async getQueue(campgroundId: string): Promise<FeatureQueueListResponseDto> {
    const items = await this.prisma.featureSetupQueue.findMany({
      where: { campgroundId },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    });

    const setupNowCount = items.filter(
      (i: FeatureSetupQueue) => i.status === FeatureSetupStatus.setup_now
    ).length;
    const setupLaterCount = items.filter(
      (i: FeatureSetupQueue) => i.status === FeatureSetupStatus.setup_later
    ).length;
    const completedCount = items.filter(
      (i: FeatureSetupQueue) => i.status === FeatureSetupStatus.completed
    ).length;
    const skippedCount = items.filter(
      (i: FeatureSetupQueue) => i.status === FeatureSetupStatus.skipped
    ).length;

    return {
      items,
      setupNowCount,
      setupLaterCount,
      completedCount,
      skippedCount,
    };
  }

  /**
   * Get pending items (setup_now or setup_later)
   */
  async getPendingQueue(campgroundId: string) {
    return this.prisma.featureSetupQueue.findMany({
      where: {
        campgroundId,
        status: {
          in: [FeatureSetupStatus.setup_now, FeatureSetupStatus.setup_later],
        },
      },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    });
  }

  /**
   * Get a single queue item
   */
  async getQueueItem(campgroundId: string, featureKey: string) {
    const item = await this.prisma.featureSetupQueue.findUnique({
      where: {
        campgroundId_featureKey: { campgroundId, featureKey },
      },
    });

    if (!item) {
      throw new NotFoundException(`Feature "${featureKey}" not found in queue`);
    }

    return item;
  }

  /**
   * Add a single feature to the queue
   */
  async addToQueue(campgroundId: string, dto: CreateFeatureQueueDto) {
    try {
      return await this.prisma.featureSetupQueue.create({
        data: {
          campgroundId,
          featureKey: dto.featureKey,
          status: dto.status || FeatureSetupStatus.setup_later,
          priority: dto.priority || 0,
        },
      });
    } catch (error: any) {
      if (error.code === "P2002") {
        throw new ConflictException(
          `Feature "${dto.featureKey}" is already in the queue`
        );
      }
      throw error;
    }
  }

  /**
   * Bulk add features to the queue (used after feature triage)
   */
  async bulkAddToQueue(campgroundId: string, dto: BulkCreateFeatureQueueDto) {
    const operations = dto.features.map((feature, index) =>
      this.prisma.featureSetupQueue.upsert({
        where: {
          campgroundId_featureKey: {
            campgroundId,
            featureKey: feature.featureKey,
          },
        },
        create: {
          campgroundId,
          featureKey: feature.featureKey,
          status: feature.status,
          priority: feature.priority ?? index,
        },
        update: {
          status: feature.status,
          priority: feature.priority ?? index,
        },
      })
    );

    return this.prisma.$transaction(operations);
  }

  /**
   * Mark a feature as started (changes status to setup_now)
   */
  async startFeature(campgroundId: string, featureKey: string) {
    const item = await this.getQueueItem(campgroundId, featureKey);

    return this.prisma.featureSetupQueue.update({
      where: { id: item.id },
      data: {
        status: FeatureSetupStatus.setup_now,
        skippedAt: null,
      },
    });
  }

  /**
   * Mark a feature as completed
   */
  async completeFeature(campgroundId: string, featureKey: string) {
    const item = await this.getQueueItem(campgroundId, featureKey);

    return this.prisma.featureSetupQueue.update({
      where: { id: item.id },
      data: {
        status: FeatureSetupStatus.completed,
        completedAt: new Date(),
      },
    });
  }

  /**
   * Skip a feature (moves to skipped status)
   */
  async skipFeature(campgroundId: string, featureKey: string) {
    const item = await this.getQueueItem(campgroundId, featureKey);

    return this.prisma.featureSetupQueue.update({
      where: { id: item.id },
      data: {
        status: FeatureSetupStatus.skipped,
        skippedAt: new Date(),
      },
    });
  }

  /**
   * Re-queue a feature (moves from skipped back to setup_later)
   */
  async requeueFeature(campgroundId: string, featureKey: string) {
    const item = await this.getQueueItem(campgroundId, featureKey);

    return this.prisma.featureSetupQueue.update({
      where: { id: item.id },
      data: {
        status: FeatureSetupStatus.setup_later,
        skippedAt: null,
      },
    });
  }

  /**
   * Update a queue item
   */
  async updateQueueItem(
    campgroundId: string,
    featureKey: string,
    dto: UpdateFeatureQueueDto
  ) {
    const item = await this.getQueueItem(campgroundId, featureKey);

    const updateData: any = {};

    if (dto.status !== undefined) {
      updateData.status = dto.status;

      if (dto.status === FeatureSetupStatus.completed) {
        updateData.completedAt = new Date();
      } else if (dto.status === FeatureSetupStatus.skipped) {
        updateData.skippedAt = new Date();
      } else {
        updateData.completedAt = null;
        updateData.skippedAt = null;
      }
    }

    if (dto.priority !== undefined) {
      updateData.priority = dto.priority;
    }

    return this.prisma.featureSetupQueue.update({
      where: { id: item.id },
      data: updateData,
    });
  }

  /**
   * Remove a feature from the queue
   */
  async removeFromQueue(campgroundId: string, featureKey: string) {
    const item = await this.getQueueItem(campgroundId, featureKey);

    await this.prisma.featureSetupQueue.delete({
      where: { id: item.id },
    });

    return { success: true };
  }

  /**
   * Get the next feature to set up (first setup_now, then first setup_later)
   */
  async getNextFeature(campgroundId: string) {
    const nextItem = await this.prisma.featureSetupQueue.findFirst({
      where: {
        campgroundId,
        status: {
          in: [FeatureSetupStatus.setup_now, FeatureSetupStatus.setup_later],
        },
      },
      orderBy: [
        { status: "asc" }, // setup_now comes before setup_later alphabetically
        { priority: "asc" },
        { createdAt: "asc" },
      ],
    });

    return nextItem;
  }
}
