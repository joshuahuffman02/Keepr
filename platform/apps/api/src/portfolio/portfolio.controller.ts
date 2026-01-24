import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { PortfolioService, type CreateDashboardDto } from "./portfolio.service";
import { JwtAuthGuard } from "../auth/guards";

type CreateRatePushDto = {
  orgId: string;
  name: string;
  rateConfig: Record<string, unknown>;
  targetCampIds: string[];
  createdBy: string;
};

@Controller("portfolio")
@UseGuards(JwtAuthGuard)
export class PortfolioController {
  constructor(private readonly service: PortfolioService) {}

  // ---- Dashboards ----

  @Post("dashboards")
  createDashboard(@Body() dto: CreateDashboardDto) {
    return this.service.createDashboard(dto);
  }

  @Get("dashboards")
  listDashboards(@Query("orgId") orgId: string) {
    return this.service.listDashboards(orgId);
  }

  @Get("dashboards/:id")
  getDashboard(@Param("id") id: string) {
    return this.service.getDashboard(id);
  }

  @Patch("dashboards/:id")
  updateDashboard(@Param("id") id: string, @Body() dto: Partial<CreateDashboardDto>) {
    return this.service.updateDashboard(id, dto);
  }

  @Delete("dashboards/:id")
  deleteDashboard(@Param("id") id: string) {
    return this.service.deleteDashboard(id);
  }

  // ---- Metrics ----

  @Post("metrics")
  recordMetrics(
    @Body()
    dto: {
      orgId: string;
      campgroundId?: string;
      date: string;
      metrics: { metricType: string; value: number }[];
    },
  ) {
    return this.service.recordMetrics(
      dto.orgId,
      dto.campgroundId ?? null,
      new Date(dto.date),
      dto.metrics,
    );
  }

  @Get("metrics")
  getMetrics(
    @Query("orgId") orgId: string,
    @Query("campgroundId") campgroundId?: string,
    @Query("metricType") metricType?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.service.getMetrics(
      orgId,
      campgroundId,
      metricType,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get("summary")
  getPortfolioSummary(@Query("orgId") orgId: string, @Query("date") date: string) {
    return this.service.getPortfolioSummary(orgId, new Date(date));
  }

  @Post("metrics/calculate")
  calculateDailyMetrics(@Body() dto: { orgId: string; date: string }) {
    return this.service.calculateDailyMetrics(dto.orgId, new Date(dto.date));
  }

  // ---- Rate Push ----

  @Post("rate-push")
  createRatePush(@Body() dto: CreateRatePushDto) {
    return this.service.createRatePush(
      dto.orgId,
      dto.name,
      dto.rateConfig,
      dto.targetCampIds,
      dto.createdBy,
    );
  }

  @Get("rate-push")
  listRatePushes(@Query("orgId") orgId: string) {
    return this.service.listRatePushes(orgId);
  }

  @Post("rate-push/:id/apply")
  applyRatePush(@Param("id") id: string, @Body() dto: { appliedBy: string }) {
    return this.service.applyRatePush(id, dto.appliedBy);
  }
}
