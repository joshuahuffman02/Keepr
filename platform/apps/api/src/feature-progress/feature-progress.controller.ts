import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { FeatureProgressService } from "./feature-progress.service";

@Controller("feature-progress")
@UseGuards(JwtAuthGuard)
export class FeatureProgressController {
  constructor(private readonly featureProgressService: FeatureProgressService) {}

  /**
   * Get all feature progress for the current user
   */
  @Get()
  async getProgress(@Request() req: any) {
    return this.featureProgressService.getProgress(req.user.id);
  }

  /**
   * Get completion statistics
   */
  @Get("stats")
  async getStats(@Request() req: any) {
    return this.featureProgressService.getStats(req.user.id);
  }

  /**
   * Get progress for a specific feature
   */
  @Get(":featureKey")
  async getFeatureProgress(
    @Request() req: any,
    @Param("featureKey") featureKey: string
  ) {
    return this.featureProgressService.getFeatureProgress(req.user.id, featureKey);
  }

  /**
   * Toggle feature completion
   */
  @Post(":featureKey/toggle")
  async toggleFeature(
    @Request() req: any,
    @Param("featureKey") featureKey: string
  ) {
    return this.featureProgressService.toggleFeature(req.user.id, featureKey);
  }

  /**
   * Mark a feature as completed
   */
  @Post(":featureKey/complete")
  async markCompleted(
    @Request() req: any,
    @Param("featureKey") featureKey: string,
    @Body() body: { notes?: string }
  ) {
    return this.featureProgressService.markCompleted(
      req.user.id,
      featureKey,
      body.notes
    );
  }

  /**
   * Mark a feature as incomplete
   */
  @Delete(":featureKey/complete")
  async markIncomplete(
    @Request() req: any,
    @Param("featureKey") featureKey: string
  ) {
    return this.featureProgressService.markIncomplete(req.user.id, featureKey);
  }

  /**
   * Bulk update feature progress
   */
  @Patch("bulk")
  async bulkUpdate(
    @Request() req: any,
    @Body() body: { updates: Array<{ featureKey: string; completed: boolean }> }
  ) {
    return this.featureProgressService.bulkUpdate(req.user.id, body.updates);
  }

  /**
   * Reset all feature progress
   */
  @Delete("reset")
  async resetProgress(@Request() req: any) {
    return this.featureProgressService.resetProgress(req.user.id);
  }
}
