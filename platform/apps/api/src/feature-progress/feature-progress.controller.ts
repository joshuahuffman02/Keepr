import type { Request } from "express";
import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { FeatureProgressService } from "./feature-progress.service";
import type { AuthUser } from "../auth/auth.types";

type FeatureProgressRequest = Request & { user?: AuthUser };

@Controller("feature-progress")
@UseGuards(JwtAuthGuard)
export class FeatureProgressController {
  constructor(private readonly featureProgressService: FeatureProgressService) {}

  private requireUserId(req: FeatureProgressRequest): string {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException("User authentication required");
    }
    return userId;
  }

  /**
   * Get all feature progress for the current user
   */
  @Get()
  async getProgress(@Req() req: FeatureProgressRequest) {
    const userId = this.requireUserId(req);
    return this.featureProgressService.getProgress(userId);
  }

  /**
   * Get completion statistics
   */
  @Get("stats")
  async getStats(@Req() req: FeatureProgressRequest) {
    const userId = this.requireUserId(req);
    return this.featureProgressService.getStats(userId);
  }

  /**
   * Get progress for a specific feature
   */
  @Get(":featureKey")
  async getFeatureProgress(
    @Req() req: FeatureProgressRequest,
    @Param("featureKey") featureKey: string,
  ) {
    const userId = this.requireUserId(req);
    return this.featureProgressService.getFeatureProgress(userId, featureKey);
  }

  /**
   * Toggle feature completion
   */
  @Post(":featureKey/toggle")
  async toggleFeature(@Req() req: FeatureProgressRequest, @Param("featureKey") featureKey: string) {
    const userId = this.requireUserId(req);
    return this.featureProgressService.toggleFeature(userId, featureKey);
  }

  /**
   * Mark a feature as completed
   */
  @Post(":featureKey/complete")
  async markCompleted(
    @Req() req: FeatureProgressRequest,
    @Param("featureKey") featureKey: string,
    @Body() body: { notes?: string },
  ) {
    const userId = this.requireUserId(req);
    return this.featureProgressService.markCompleted(userId, featureKey, body.notes);
  }

  /**
   * Mark a feature as incomplete
   */
  @Delete(":featureKey/complete")
  async markIncomplete(
    @Req() req: FeatureProgressRequest,
    @Param("featureKey") featureKey: string,
  ) {
    const userId = this.requireUserId(req);
    return this.featureProgressService.markIncomplete(userId, featureKey);
  }

  /**
   * Bulk update feature progress
   */
  @Patch("bulk")
  async bulkUpdate(
    @Req() req: FeatureProgressRequest,
    @Body() body: { updates: Array<{ featureKey: string; completed: boolean }> },
  ) {
    const userId = this.requireUserId(req);
    return this.featureProgressService.bulkUpdate(userId, body.updates);
  }

  /**
   * Reset all feature progress
   */
  @Delete("reset")
  async resetProgress(@Req() req: FeatureProgressRequest) {
    const userId = this.requireUserId(req);
    return this.featureProgressService.resetProgress(userId);
  }
}
