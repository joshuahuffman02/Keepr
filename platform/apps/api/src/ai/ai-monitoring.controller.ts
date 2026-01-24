import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  Logger,
  BadRequestException,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards";
import { RolesGuard, Roles } from "../auth/guards/roles.guard";
import { PlatformRole } from "@prisma/client";
import { AiCostTrackingService } from "./ai-cost-tracking.service";

interface DateRangeQuery {
  startDate?: string;
  endDate?: string;
  days?: string;
}

interface MonthQuery {
  year?: string;
  month?: string;
}

@Controller("ai")
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiMonitoringController {
  private readonly logger = new Logger(AiMonitoringController.name);

  constructor(private readonly costTracking: AiCostTrackingService) {}

  // ==================== PLATFORM ADMIN ENDPOINTS ====================

  /**
   * Get platform-wide AI cost summary
   * Only accessible by platform admins
   */
  @Get("costs/platform")
  @Roles(PlatformRole.platform_admin)
  async getPlatformCosts(@Query() query: DateRangeQuery) {
    const { startDate, endDate } = this.parseDateRange(query);

    return this.costTracking.getPlatformSummary(startDate, endDate);
  }

  /**
   * Get daily cost breakdown for the platform
   * Only accessible by platform admins
   */
  @Get("costs/daily")
  @Roles(PlatformRole.platform_admin)
  async getDailyCosts(@Query() query: DateRangeQuery) {
    const { startDate, endDate } = this.parseDateRange(query);

    return this.costTracking.getDailyCosts(startDate, endDate);
  }

  /**
   * Get monthly cost summary for the platform
   * Only accessible by platform admins
   */
  @Get("costs/monthly")
  @Roles(PlatformRole.platform_admin)
  async getMonthlyCosts(@Query() query: MonthQuery) {
    const now = new Date();
    const year = query.year ? parseInt(query.year) : now.getFullYear();
    const month = query.month ? parseInt(query.month) : now.getMonth() + 1;

    if (isNaN(year) || year < 2020 || year > 2100) {
      throw new BadRequestException("Invalid year");
    }
    if (isNaN(month) || month < 1 || month > 12) {
      throw new BadRequestException("Invalid month (1-12)");
    }

    return this.costTracking.getMonthlyCosts(year, month);
  }

  /**
   * Get costs broken down by AI feature type
   * Only accessible by platform admins
   */
  @Get("costs/by-feature")
  @Roles(PlatformRole.platform_admin)
  async getCostsByFeature(@Query() query: DateRangeQuery) {
    const { startDate, endDate } = this.parseDateRange(query);

    return this.costTracking.getCostsByFeature(startDate, endDate);
  }

  /**
   * Get latency metrics for AI calls
   * Only accessible by platform admins
   */
  @Get("metrics/latency")
  @Roles(PlatformRole.platform_admin)
  async getLatencyMetrics(@Query() query: DateRangeQuery) {
    const { startDate, endDate } = this.parseDateRange(query);

    return this.costTracking.getLatencyMetrics(startDate, endDate);
  }

  // ==================== CAMPGROUND-SCOPED ENDPOINTS ====================

  /**
   * Get daily costs for a specific campground
   * Accessible by campground managers/owners and platform admins
   */
  @Get("costs/campgrounds/:campgroundId/daily")
  @Roles(PlatformRole.platform_admin, "owner", "manager")
  async getCampgroundDailyCosts(
    @Param("campgroundId") campgroundId: string,
    @Query() query: DateRangeQuery,
  ) {
    const { startDate, endDate } = this.parseDateRange(query);

    return this.costTracking.getDailyCosts(startDate, endDate, campgroundId);
  }

  /**
   * Get monthly costs for a specific campground
   * Accessible by campground managers/owners and platform admins
   */
  @Get("costs/campgrounds/:campgroundId/monthly")
  @Roles(PlatformRole.platform_admin, "owner", "manager")
  async getCampgroundMonthlyCosts(
    @Param("campgroundId") campgroundId: string,
    @Query() query: MonthQuery,
  ) {
    const now = new Date();
    const year = query.year ? parseInt(query.year) : now.getFullYear();
    const month = query.month ? parseInt(query.month) : now.getMonth() + 1;

    if (isNaN(year) || year < 2020 || year > 2100) {
      throw new BadRequestException("Invalid year");
    }
    if (isNaN(month) || month < 1 || month > 12) {
      throw new BadRequestException("Invalid month (1-12)");
    }

    return this.costTracking.getMonthlyCosts(year, month, campgroundId);
  }

  /**
   * Get costs by feature for a specific campground
   * Accessible by campground managers/owners and platform admins
   */
  @Get("costs/campgrounds/:campgroundId/by-feature")
  @Roles(PlatformRole.platform_admin, "owner", "manager")
  async getCampgroundCostsByFeature(
    @Param("campgroundId") campgroundId: string,
    @Query() query: DateRangeQuery,
  ) {
    const { startDate, endDate } = this.parseDateRange(query);

    return this.costTracking.getCostsByFeature(startDate, endDate, campgroundId);
  }

  /**
   * Get latency metrics for a specific campground
   * Accessible by campground managers/owners and platform admins
   */
  @Get("metrics/campgrounds/:campgroundId/latency")
  @Roles(PlatformRole.platform_admin, "owner", "manager")
  async getCampgroundLatencyMetrics(
    @Param("campgroundId") campgroundId: string,
    @Query() query: DateRangeQuery,
  ) {
    const { startDate, endDate } = this.parseDateRange(query);

    return this.costTracking.getLatencyMetrics(startDate, endDate, campgroundId);
  }

  /**
   * Get budget status for a specific campground
   * Accessible by campground managers/owners and platform admins
   */
  @Get("costs/campgrounds/:campgroundId/budget")
  @Roles(PlatformRole.platform_admin, "owner", "manager")
  async getCampgroundBudgetStatus(@Param("campgroundId") campgroundId: string) {
    return this.costTracking.checkBudgetStatus(campgroundId);
  }

  // ==================== HELPER METHODS ====================

  /**
   * Parse date range from query parameters
   */
  private parseDateRange(query: DateRangeQuery): { startDate: Date; endDate: Date } {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    if (query.startDate && query.endDate) {
      startDate = new Date(query.startDate);
      endDate = new Date(query.endDate);

      if (isNaN(startDate.getTime())) {
        throw new BadRequestException("Invalid startDate format. Use ISO format (YYYY-MM-DD)");
      }
      if (isNaN(endDate.getTime())) {
        throw new BadRequestException("Invalid endDate format. Use ISO format (YYYY-MM-DD)");
      }
    } else if (query.days) {
      const days = parseInt(query.days);
      if (isNaN(days) || days < 1 || days > 365) {
        throw new BadRequestException("Days must be between 1 and 365");
      }
      endDate = new Date(now);
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - days);
    } else {
      // Default to last 30 days
      endDate = new Date(now);
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 30);
    }

    // Set time bounds
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    return { startDate, endDate };
  }
}
