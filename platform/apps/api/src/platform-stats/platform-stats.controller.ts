import { Controller, Get } from "@nestjs/common";
import { PlatformStatsService } from "./platform-stats.service";

/**
 * Public Platform Stats Controller
 *
 * Unauthenticated endpoint for homepage activity feed and social proof.
 * Returns aggregate platform statistics only - no personal data.
 */
@Controller("public/platform-stats")
export class PlatformStatsController {
  constructor(private readonly platformStats: PlatformStatsService) {}

  /**
   * Get platform-wide statistics for public display
   *
   * Used by homepage activity feed to show:
   * - Total campgrounds available
   * - Recent activity (page views, searches)
   * - Top regions
   */
  @Get()
  async getStats() {
    return this.platformStats.getStats();
  }
}
