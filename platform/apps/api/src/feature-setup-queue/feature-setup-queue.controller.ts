import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard, Roles } from "../auth/guards/roles.guard";
import { ScopeGuard } from "../auth/guards/scope.guard";
import { UserRole } from "@prisma/client";
import { FeatureSetupQueueService } from "./feature-setup-queue.service";
import {
  CreateFeatureQueueDto,
  BulkCreateFeatureQueueDto,
  UpdateFeatureQueueDto,
} from "./dto/feature-setup-queue.dto";

@Controller("campgrounds/:campgroundId/setup-queue")
@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
export class FeatureSetupQueueController {
  constructor(private readonly service: FeatureSetupQueueService) {}

  /**
   * Get all queue items for a campground
   */
  @Get()
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  async getQueue(@Param("campgroundId") campgroundId: string) {
    return this.service.getQueue(campgroundId);
  }

  /**
   * Get pending items only (for dashboard widget)
   */
  @Get("pending")
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  async getPendingQueue(@Param("campgroundId") campgroundId: string) {
    return this.service.getPendingQueue(campgroundId);
  }

  /**
   * Get the next feature to set up
   */
  @Get("next")
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  async getNextFeature(@Param("campgroundId") campgroundId: string) {
    return this.service.getNextFeature(campgroundId);
  }

  /**
   * Get a specific queue item
   */
  @Get(":featureKey")
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  async getQueueItem(
    @Param("campgroundId") campgroundId: string,
    @Param("featureKey") featureKey: string,
  ) {
    return this.service.getQueueItem(campgroundId, featureKey);
  }

  /**
   * Add a single feature to the queue
   */
  @Post()
  @Roles(UserRole.owner, UserRole.manager)
  async addToQueue(
    @Param("campgroundId") campgroundId: string,
    @Body() dto: CreateFeatureQueueDto,
  ) {
    return this.service.addToQueue(campgroundId, dto);
  }

  /**
   * Bulk add features to the queue
   */
  @Post("bulk")
  @Roles(UserRole.owner, UserRole.manager)
  async bulkAddToQueue(
    @Param("campgroundId") campgroundId: string,
    @Body() dto: BulkCreateFeatureQueueDto,
  ) {
    return this.service.bulkAddToQueue(campgroundId, dto);
  }

  /**
   * Start setting up a feature
   */
  @Post(":featureKey/start")
  @Roles(UserRole.owner, UserRole.manager)
  async startFeature(
    @Param("campgroundId") campgroundId: string,
    @Param("featureKey") featureKey: string,
  ) {
    return this.service.startFeature(campgroundId, featureKey);
  }

  /**
   * Mark a feature as completed
   */
  @Post(":featureKey/complete")
  @Roles(UserRole.owner, UserRole.manager)
  async completeFeature(
    @Param("campgroundId") campgroundId: string,
    @Param("featureKey") featureKey: string,
  ) {
    return this.service.completeFeature(campgroundId, featureKey);
  }

  /**
   * Skip a feature
   */
  @Post(":featureKey/skip")
  @Roles(UserRole.owner, UserRole.manager)
  async skipFeature(
    @Param("campgroundId") campgroundId: string,
    @Param("featureKey") featureKey: string,
  ) {
    return this.service.skipFeature(campgroundId, featureKey);
  }

  /**
   * Re-queue a skipped feature
   */
  @Post(":featureKey/requeue")
  @Roles(UserRole.owner, UserRole.manager)
  async requeueFeature(
    @Param("campgroundId") campgroundId: string,
    @Param("featureKey") featureKey: string,
  ) {
    return this.service.requeueFeature(campgroundId, featureKey);
  }

  /**
   * Update a queue item
   */
  @Patch(":featureKey")
  @Roles(UserRole.owner, UserRole.manager)
  async updateQueueItem(
    @Param("campgroundId") campgroundId: string,
    @Param("featureKey") featureKey: string,
    @Body() dto: UpdateFeatureQueueDto,
  ) {
    return this.service.updateQueueItem(campgroundId, featureKey, dto);
  }

  /**
   * Remove a feature from the queue
   */
  @Delete(":featureKey")
  @Roles(UserRole.owner, UserRole.manager)
  async removeFromQueue(
    @Param("campgroundId") campgroundId: string,
    @Param("featureKey") featureKey: string,
  ) {
    return this.service.removeFromQueue(campgroundId, featureKey);
  }
}
