import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CompetitiveService } from "./competitive.service";
import {
  CreateCompetitorDto,
  UpdateCompetitorDto,
  CreateCompetitorRateDto,
  UpdateCompetitorRateDto,
  AcknowledgeAlertDto,
} from "./dto/competitive.dto";
import { JwtAuthGuard, RolesGuard, ScopeGuard } from "../auth/guards";
import { Roles } from "../auth/guards/roles.guard";
import { UserRole } from "@prisma/client";

@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
@Controller("campgrounds/:campgroundId/competitive")
export class CompetitiveController {
  constructor(private readonly competitiveService: CompetitiveService) {}

  // =============================================================================
  // COMPETITOR ENDPOINTS
  // =============================================================================

  @Post("competitors")
  @Roles(UserRole.owner, UserRole.manager)
  async createCompetitor(
    @Param("campgroundId") campgroundId: string,
    @Body() body: Omit<CreateCompetitorDto, "campgroundId">,
  ) {
    return this.competitiveService.createCompetitor({
      ...body,
      campgroundId,
    });
  }

  @Get("competitors")
  @Roles(UserRole.owner, UserRole.manager, UserRole.marketing, UserRole.readonly)
  async listCompetitors(
    @Param("campgroundId") campgroundId: string,
    @Query("includeInactive") includeInactive?: string,
  ) {
    return this.competitiveService.findAllCompetitors(campgroundId, includeInactive === "true");
  }

  @Get("competitors/:competitorId")
  @Roles(UserRole.owner, UserRole.manager, UserRole.marketing, UserRole.readonly)
  async getCompetitor(@Param("competitorId") competitorId: string) {
    return this.competitiveService.findCompetitorById(competitorId);
  }

  @Patch("competitors/:competitorId")
  @Roles(UserRole.owner, UserRole.manager)
  async updateCompetitor(
    @Param("competitorId") competitorId: string,
    @Body() body: UpdateCompetitorDto,
  ) {
    return this.competitiveService.updateCompetitor(competitorId, body);
  }

  @Delete("competitors/:competitorId")
  @Roles(UserRole.owner, UserRole.manager)
  async deleteCompetitor(@Param("competitorId") competitorId: string) {
    return this.competitiveService.deleteCompetitor(competitorId);
  }

  // =============================================================================
  // COMPETITOR RATE ENDPOINTS
  // =============================================================================

  @Post("rates")
  @Roles(UserRole.owner, UserRole.manager)
  async createRate(@Body() body: CreateCompetitorRateDto) {
    return this.competitiveService.createRate(body);
  }

  @Get("rates")
  @Roles(UserRole.owner, UserRole.manager, UserRole.marketing, UserRole.readonly)
  async listRates(
    @Param("campgroundId") campgroundId: string,
    @Query("siteType") siteType?: string,
  ) {
    return this.competitiveService.findRatesByCampground(campgroundId, siteType);
  }

  @Get("competitors/:competitorId/rates")
  @Roles(UserRole.owner, UserRole.manager, UserRole.marketing, UserRole.readonly)
  async listCompetitorRates(@Param("competitorId") competitorId: string) {
    return this.competitiveService.findRatesByCompetitor(competitorId);
  }

  @Get("rates/:rateId")
  @Roles(UserRole.owner, UserRole.manager, UserRole.marketing, UserRole.readonly)
  async getRate(@Param("rateId") rateId: string) {
    return this.competitiveService.findRateById(rateId);
  }

  @Patch("rates/:rateId")
  @Roles(UserRole.owner, UserRole.manager)
  async updateRate(@Param("rateId") rateId: string, @Body() body: UpdateCompetitorRateDto) {
    return this.competitiveService.updateRate(rateId, body);
  }

  @Delete("rates/:rateId")
  @Roles(UserRole.owner, UserRole.manager)
  async deleteRate(@Param("rateId") rateId: string) {
    return this.competitiveService.deleteRate(rateId);
  }

  @Post("rates/bulk")
  @Roles(UserRole.owner, UserRole.manager)
  async bulkCreateRates(
    @Body()
    body: {
      rates: Array<{
        competitorId: string;
        siteType: string;
        rateNightly: number;
        source?: string;
        notes?: string;
      }>;
    },
  ) {
    return this.competitiveService.bulkCreateRates(body.rates);
  }

  // =============================================================================
  // MARKET POSITION & COMPARISON ENDPOINTS
  // =============================================================================

  @Get("comparison/:siteType")
  @Roles(UserRole.owner, UserRole.manager, UserRole.marketing, UserRole.readonly)
  async getComparison(
    @Param("campgroundId") campgroundId: string,
    @Param("siteType") siteType: string,
    @Query("date") date?: string,
  ) {
    return this.competitiveService.getCompetitorComparison(
      campgroundId,
      siteType,
      date ? new Date(date) : undefined,
    );
  }

  @Get("market-position")
  @Roles(UserRole.owner, UserRole.manager, UserRole.marketing, UserRole.readonly)
  async getMarketPosition(@Param("campgroundId") campgroundId: string) {
    return this.competitiveService.getMarketPosition(campgroundId);
  }

  @Get("rate-parity")
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  async checkRateParity(@Param("campgroundId") campgroundId: string) {
    return this.competitiveService.checkRateParity(campgroundId);
  }

  @Get("trends/:siteType")
  @Roles(UserRole.owner, UserRole.manager, UserRole.marketing, UserRole.readonly)
  async getRateTrends(
    @Param("campgroundId") campgroundId: string,
    @Param("siteType") siteType: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.competitiveService.getRateTrends(
      campgroundId,
      siteType,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  // =============================================================================
  // RATE PARITY ALERT ENDPOINTS
  // =============================================================================

  @Get("alerts")
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  async listAlerts(@Param("campgroundId") campgroundId: string, @Query("status") status?: string) {
    if (status) {
      return this.competitiveService.findAllAlerts(campgroundId, status);
    }
    return this.competitiveService.findActiveAlerts(campgroundId);
  }

  @Post("alerts/:alertId/acknowledge")
  @Roles(UserRole.owner, UserRole.manager)
  async acknowledgeAlert(@Param("alertId") alertId: string, @Body() body: AcknowledgeAlertDto) {
    return this.competitiveService.acknowledgeAlert(alertId, body.userId);
  }

  @Post("alerts/:alertId/resolve")
  @Roles(UserRole.owner, UserRole.manager)
  async resolveAlert(@Param("alertId") alertId: string) {
    return this.competitiveService.resolveAlert(alertId);
  }
}
