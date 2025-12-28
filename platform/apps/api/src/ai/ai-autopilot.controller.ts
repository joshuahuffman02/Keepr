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
  Req,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards";
import { RolesGuard, Roles } from "../auth/guards/roles.guard";
import { UserRole } from "@prisma/client";
import { AiAutopilotConfigService } from "./ai-autopilot-config.service";
import { AiAutoReplyService } from "./ai-auto-reply.service";
import { AiSmartWaitlistService } from "./ai-smart-waitlist.service";
import { AiAnomalyDetectionService } from "./ai-anomaly-detection.service";
import { AiNoShowPredictionService } from "./ai-no-show-prediction.service";
// Autonomous Features
import { AiAutonomousActionService } from "./ai-autonomous-action.service";
import { AiDynamicPricingService } from "./ai-dynamic-pricing.service";
import { AiRevenueManagerService } from "./ai-revenue-manager.service";
import { AiPredictiveMaintenanceService } from "./ai-predictive-maintenance.service";
import { AiWeatherService } from "./ai-weather.service";
import { AiPhoneAgentService } from "./ai-phone-agent.service";
import { AiDashboardService } from "./ai-dashboard.service";
import {
  UpdateAutopilotConfigDto,
  CreateContextItemDto,
  UpdateContextItemDto,
  ReviewDraftDto,
  UpdateAnomalyStatusDto,
  MarkConfirmedDto,
} from "./dto/autopilot.dto";
import type { Request } from "express";

@Controller("ai/autopilot")
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiAutopilotController {
  constructor(
    private readonly configService: AiAutopilotConfigService,
    private readonly autoReplyService: AiAutoReplyService,
    private readonly smartWaitlistService: AiSmartWaitlistService,
    private readonly anomalyService: AiAnomalyDetectionService,
    private readonly noShowService: AiNoShowPredictionService,
    // Autonomous Features
    private readonly autonomousActionService: AiAutonomousActionService,
    private readonly dynamicPricingService: AiDynamicPricingService,
    private readonly revenueManagerService: AiRevenueManagerService,
    private readonly predictiveMaintenanceService: AiPredictiveMaintenanceService,
    private readonly weatherService: AiWeatherService,
    private readonly phoneAgentService: AiPhoneAgentService,
    private readonly dashboardService: AiDashboardService
  ) {}

  // ==================== CONFIG ENDPOINTS ====================

  @Get("campgrounds/:campgroundId/config")
  @Roles(UserRole.owner, UserRole.manager)
  async getConfig(@Param("campgroundId") campgroundId: string) {
    return this.configService.getConfig(campgroundId);
  }

  @Patch("campgrounds/:campgroundId/config")
  @Roles(UserRole.owner, UserRole.manager)
  async updateConfig(
    @Param("campgroundId") campgroundId: string,
    @Body() updates: UpdateAutopilotConfigDto
  ) {
    return this.configService.updateConfig(campgroundId, updates);
  }

  // ==================== CONTEXT ENDPOINTS ====================

  @Get("campgrounds/:campgroundId/context")
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  async getContextItems(
    @Param("campgroundId") campgroundId: string,
    @Query("type") type?: string,
    @Query("category") category?: string,
    @Query("activeOnly") activeOnly?: string
  ) {
    return this.configService.getContextItems(
      campgroundId,
      type,
      category,
      activeOnly !== "false"
    );
  }

  @Post("campgrounds/:campgroundId/context")
  @Roles(UserRole.owner, UserRole.manager)
  async createContextItem(
    @Param("campgroundId") campgroundId: string,
    @Body() data: CreateContextItemDto
  ) {
    return this.configService.createContextItem(campgroundId, data);
  }

  @Patch("context/:id")
  @Roles(UserRole.owner, UserRole.manager)
  async updateContextItem(
    @Param("id") id: string,
    @Body() updates: UpdateContextItemDto
  ) {
    return this.configService.updateContextItem(id, updates);
  }

  @Delete("context/:id")
  @Roles(UserRole.owner, UserRole.manager)
  async deleteContextItem(@Param("id") id: string) {
    return this.configService.deleteContextItem(id);
  }

  @Post("campgrounds/:campgroundId/context/auto-populate")
  @Roles(UserRole.owner, UserRole.manager)
  async autoPopulateContext(@Param("campgroundId") campgroundId: string) {
    return this.configService.autoPopulateContext(campgroundId);
  }

  // ==================== AUTO-REPLY ENDPOINTS ====================

  @Get("campgrounds/:campgroundId/reply-drafts")
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  async getReplyDrafts(
    @Param("campgroundId") campgroundId: string,
    @Query("status") status?: string
  ) {
    return this.autoReplyService.getDrafts(campgroundId, status);
  }

  @Get("reply-drafts/:id")
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  async getReplyDraft(@Param("id") id: string) {
    return this.autoReplyService.getDraft(id);
  }

  @Post("reply-drafts/:id/review")
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  async reviewDraft(
    @Param("id") id: string,
    @Body() data: ReviewDraftDto,
    @Req() req: Request
  ) {
    const user = (req as any).user;
    return this.autoReplyService.reviewDraft(id, data, user?.id);
  }

  @Post("reply-drafts/:id/send")
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  async sendDraft(@Param("id") id: string) {
    return this.autoReplyService.sendDraft(id);
  }

  // ==================== SMART WAITLIST ENDPOINTS ====================

  @Get("campgrounds/:campgroundId/waitlist/ai-scores")
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  async getWaitlistAiScores(@Param("campgroundId") campgroundId: string) {
    return this.smartWaitlistService.getScores(campgroundId);
  }

  @Post("campgrounds/:campgroundId/waitlist/rescore")
  @Roles(UserRole.owner, UserRole.manager)
  async rescoreWaitlist(@Param("campgroundId") campgroundId: string) {
    return this.smartWaitlistService.rescoreAll(campgroundId);
  }

  @Get("waitlist/:entryId/ai-score")
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  async getWaitlistEntryScore(@Param("entryId") entryId: string) {
    return this.smartWaitlistService.getScore(entryId);
  }

  // ==================== ANOMALY DETECTION ENDPOINTS ====================

  @Get("campgrounds/:campgroundId/anomalies")
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  async getAnomalyAlerts(
    @Param("campgroundId") campgroundId: string,
    @Query("status") status?: string,
    @Query("severity") severity?: string
  ) {
    return this.anomalyService.getAlerts(campgroundId, status, severity);
  }

  @Get("anomalies/:id")
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  async getAnomalyAlert(@Param("id") id: string) {
    return this.anomalyService.getAlert(id);
  }

  @Patch("anomalies/:id/status")
  @Roles(UserRole.owner, UserRole.manager)
  async updateAnomalyStatus(
    @Param("id") id: string,
    @Body() data: UpdateAnomalyStatusDto,
    @Req() req: Request
  ) {
    const user = (req as any).user;
    return this.anomalyService.updateAlertStatus(id, data, user?.id);
  }

  @Post("campgrounds/:campgroundId/anomalies/check")
  @Roles(UserRole.owner, UserRole.manager)
  async runAnomalyCheck(@Param("campgroundId") campgroundId: string) {
    return this.anomalyService.runChecks(campgroundId);
  }

  // ==================== NO-SHOW PREDICTION ENDPOINTS ====================

  @Get("campgrounds/:campgroundId/no-show-risks")
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  async getNoShowRisks(
    @Param("campgroundId") campgroundId: string,
    @Query("flaggedOnly") flaggedOnly?: string,
    @Query("daysAhead") daysAhead?: string
  ) {
    return this.noShowService.getRisks(
      campgroundId,
      flaggedOnly === "true",
      daysAhead ? parseInt(daysAhead) : undefined
    );
  }

  @Get("reservations/:reservationId/no-show-risk")
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  async getReservationRisk(@Param("reservationId") reservationId: string) {
    return this.noShowService.getRisk(reservationId);
  }

  @Post("reservations/:reservationId/no-show-risk/calculate")
  @Roles(UserRole.owner, UserRole.manager)
  async calculateRisk(@Param("reservationId") reservationId: string) {
    return this.noShowService.calculateRisk(reservationId);
  }

  @Post("reservations/:reservationId/no-show-risk/remind")
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  async sendNoShowReminder(@Param("reservationId") reservationId: string) {
    return this.noShowService.sendReminder(reservationId);
  }

  @Post("reservations/:reservationId/no-show-risk/confirm")
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  async markConfirmed(
    @Param("reservationId") reservationId: string,
    @Body() data: MarkConfirmedDto
  ) {
    return this.noShowService.markConfirmed(reservationId, data.source);
  }

  @Post("campgrounds/:campgroundId/no-show-risks/recalculate")
  @Roles(UserRole.owner, UserRole.manager)
  async recalculateAllRisks(
    @Param("campgroundId") campgroundId: string,
    @Query("daysAhead") daysAhead?: string
  ) {
    return this.noShowService.recalculateAll(
      campgroundId,
      daysAhead ? parseInt(daysAhead) : undefined
    );
  }

  // ==================== AI DASHBOARD ENDPOINTS ====================

  @Get("campgrounds/:campgroundId/dashboard")
  @Roles(UserRole.owner, UserRole.manager)
  async getDashboard(@Param("campgroundId") campgroundId: string) {
    const [quickStats, metrics, activity] = await Promise.all([
      this.dashboardService.getQuickStats(campgroundId),
      this.dashboardService.getMetrics(campgroundId, 30),
      this.dashboardService.getActivityFeed(campgroundId, 20),
    ]);

    return { quickStats, metrics, activity };
  }

  @Get("campgrounds/:campgroundId/dashboard/activity")
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  async getActivityFeed(
    @Param("campgroundId") campgroundId: string,
    @Query("limit") limit?: string
  ) {
    return this.dashboardService.getActivityFeed(
      campgroundId,
      limit ? parseInt(limit) : 20
    );
  }

  @Get("campgrounds/:campgroundId/dashboard/metrics")
  @Roles(UserRole.owner, UserRole.manager)
  async getMetrics(
    @Param("campgroundId") campgroundId: string,
    @Query("days") days?: string
  ) {
    return this.dashboardService.getMetrics(
      campgroundId,
      days ? parseInt(days) : 30
    );
  }

  // ==================== DYNAMIC PRICING ENDPOINTS ====================

  @Get("campgrounds/:campgroundId/pricing/recommendations")
  @Roles(UserRole.owner, UserRole.manager)
  async getPricingRecommendations(
    @Param("campgroundId") campgroundId: string,
    @Query("status") status?: string,
    @Query("siteClassId") siteClassId?: string
  ) {
    return this.dynamicPricingService.getRecommendations(campgroundId, {
      status,
      siteClassId,
    });
  }

  @Get("pricing/recommendations/:id")
  @Roles(UserRole.owner, UserRole.manager)
  async getPricingRecommendation(@Param("id") id: string) {
    return this.dynamicPricingService.getRecommendation(id);
  }

  @Post("pricing/recommendations/:id/apply")
  @Roles(UserRole.owner, UserRole.manager)
  async applyPricingRecommendation(
    @Param("id") id: string,
    @Req() req: Request
  ) {
    const user = (req as any).user;
    return this.dynamicPricingService.applyRecommendation(id, user?.id);
  }

  @Post("pricing/recommendations/:id/dismiss")
  @Roles(UserRole.owner, UserRole.manager)
  async dismissPricingRecommendation(
    @Param("id") id: string,
    @Body("reason") reason: string,
    @Req() req: Request
  ) {
    const user = (req as any).user;
    return this.dynamicPricingService.dismissRecommendation(id, user?.id, reason);
  }

  @Post("campgrounds/:campgroundId/pricing/analyze")
  @Roles(UserRole.owner, UserRole.manager)
  async analyzePricing(@Param("campgroundId") campgroundId: string) {
    return this.dynamicPricingService.analyzePricing(campgroundId);
  }

  @Get("campgrounds/:campgroundId/pricing/summary")
  @Roles(UserRole.owner, UserRole.manager)
  async getPricingSummary(@Param("campgroundId") campgroundId: string) {
    return this.dynamicPricingService.getPricingSummary(campgroundId);
  }

  // ==================== REVENUE MANAGER ENDPOINTS ====================

  @Get("campgrounds/:campgroundId/revenue/insights")
  @Roles(UserRole.owner, UserRole.manager)
  async getRevenueInsights(
    @Param("campgroundId") campgroundId: string,
    @Query("status") status?: string,
    @Query("type") insightType?: string
  ) {
    return this.revenueManagerService.getInsights(campgroundId, {
      status,
      insightType,
    });
  }

  @Get("revenue/insights/:id")
  @Roles(UserRole.owner, UserRole.manager)
  async getRevenueInsight(@Param("id") id: string) {
    return this.revenueManagerService.getInsight(id);
  }

  @Post("revenue/insights/:id/start")
  @Roles(UserRole.owner, UserRole.manager)
  async startRevenueInsight(@Param("id") id: string) {
    return this.revenueManagerService.startInsight(id);
  }

  @Post("revenue/insights/:id/complete")
  @Roles(UserRole.owner, UserRole.manager)
  async completeRevenueInsight(@Param("id") id: string) {
    return this.revenueManagerService.completeInsight(id);
  }

  @Post("revenue/insights/:id/dismiss")
  @Roles(UserRole.owner, UserRole.manager)
  async dismissRevenueInsight(
    @Param("id") id: string,
    @Body("reason") reason?: string
  ) {
    return this.revenueManagerService.dismissInsight(id, reason);
  }

  @Post("campgrounds/:campgroundId/revenue/analyze")
  @Roles(UserRole.owner, UserRole.manager)
  async analyzeRevenue(@Param("campgroundId") campgroundId: string) {
    return this.revenueManagerService.analyzeRevenue(campgroundId);
  }

  @Get("campgrounds/:campgroundId/revenue/summary")
  @Roles(UserRole.owner, UserRole.manager)
  async getRevenueSummary(@Param("campgroundId") campgroundId: string) {
    return this.revenueManagerService.getRevenueSummary(campgroundId);
  }

  // ==================== PREDICTIVE MAINTENANCE ENDPOINTS ====================

  @Get("campgrounds/:campgroundId/maintenance/alerts")
  @Roles(UserRole.owner, UserRole.manager, UserRole.maintenance)
  async getMaintenanceAlerts(
    @Param("campgroundId") campgroundId: string,
    @Query("status") status?: string,
    @Query("severity") severity?: string,
    @Query("category") category?: string
  ) {
    return this.predictiveMaintenanceService.getAlerts(campgroundId, {
      status,
      severity,
      category,
    });
  }

  @Get("maintenance/alerts/:id")
  @Roles(UserRole.owner, UserRole.manager, UserRole.maintenance)
  async getMaintenanceAlert(@Param("id") id: string) {
    return this.predictiveMaintenanceService.getAlert(id);
  }

  @Post("maintenance/alerts/:id/acknowledge")
  @Roles(UserRole.owner, UserRole.manager, UserRole.maintenance)
  async acknowledgeMaintenanceAlert(
    @Param("id") id: string,
    @Req() req: Request
  ) {
    const user = (req as any).user;
    return this.predictiveMaintenanceService.acknowledgeAlert(id, user?.id);
  }

  @Post("maintenance/alerts/:id/schedule")
  @Roles(UserRole.owner, UserRole.manager, UserRole.maintenance)
  async scheduleMaintenanceAlert(
    @Param("id") id: string,
    @Body("ticketId") ticketId: string
  ) {
    return this.predictiveMaintenanceService.scheduleAlert(id, ticketId);
  }

  @Post("maintenance/alerts/:id/resolve")
  @Roles(UserRole.owner, UserRole.manager, UserRole.maintenance)
  async resolveMaintenanceAlert(@Param("id") id: string) {
    return this.predictiveMaintenanceService.resolveAlert(id);
  }

  @Post("maintenance/alerts/:id/dismiss")
  @Roles(UserRole.owner, UserRole.manager)
  async dismissMaintenanceAlert(@Param("id") id: string) {
    return this.predictiveMaintenanceService.dismissAlert(id);
  }

  @Post("campgrounds/:campgroundId/maintenance/analyze")
  @Roles(UserRole.owner, UserRole.manager)
  async analyzeMaintenancePatterns(@Param("campgroundId") campgroundId: string) {
    return this.predictiveMaintenanceService.analyzePatterns(campgroundId);
  }

  @Get("campgrounds/:campgroundId/maintenance/summary")
  @Roles(UserRole.owner, UserRole.manager, UserRole.maintenance)
  async getMaintenanceSummary(@Param("campgroundId") campgroundId: string) {
    return this.predictiveMaintenanceService.getMaintenanceSummary(campgroundId);
  }

  // ==================== WEATHER ENDPOINTS ====================

  @Get("campgrounds/:campgroundId/weather/current")
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  async getCurrentWeather(@Param("campgroundId") campgroundId: string) {
    return this.weatherService.getCurrentWeather(campgroundId);
  }

  @Get("campgrounds/:campgroundId/weather/forecast")
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  async getWeatherForecast(@Param("campgroundId") campgroundId: string) {
    return this.weatherService.getForecast(campgroundId);
  }

  @Get("campgrounds/:campgroundId/weather/alerts")
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  async getWeatherAlerts(
    @Param("campgroundId") campgroundId: string,
    @Query("status") status?: string
  ) {
    return this.weatherService.getAlerts(campgroundId, { status });
  }

  @Get("weather/alerts/:id")
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  async getWeatherAlert(@Param("id") id: string) {
    return this.weatherService.getAlert(id);
  }

  @Post("weather/alerts/:id/notify")
  @Roles(UserRole.owner, UserRole.manager)
  async sendWeatherNotifications(@Param("id") id: string) {
    return this.weatherService.sendAlertNotifications(id);
  }

  @Post("campgrounds/:campgroundId/weather/check")
  @Roles(UserRole.owner, UserRole.manager)
  async checkWeatherConditions(@Param("campgroundId") campgroundId: string) {
    return this.weatherService.checkWeatherConditions(campgroundId);
  }

  @Get("campgrounds/:campgroundId/weather/summary")
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  async getWeatherSummary(@Param("campgroundId") campgroundId: string) {
    return this.weatherService.getWeatherSummary(campgroundId);
  }

  // ==================== PHONE AGENT ENDPOINTS ====================

  @Get("campgrounds/:campgroundId/phone/sessions")
  @Roles(UserRole.owner, UserRole.manager)
  async getPhoneSessions(
    @Param("campgroundId") campgroundId: string,
    @Query("status") status?: string,
    @Query("limit") limit?: string
  ) {
    return this.phoneAgentService.getSessions(campgroundId, {
      status,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Get("phone/sessions/:id")
  @Roles(UserRole.owner, UserRole.manager)
  async getPhoneSession(@Param("id") id: string) {
    return this.phoneAgentService.getSession(id);
  }

  @Get("campgrounds/:campgroundId/phone/summary")
  @Roles(UserRole.owner, UserRole.manager)
  async getPhoneSummary(
    @Param("campgroundId") campgroundId: string,
    @Query("days") days?: string
  ) {
    return this.phoneAgentService.getPhoneSummary(
      campgroundId,
      days ? parseInt(days) : 30
    );
  }

  // ==================== AUTONOMOUS ACTIONS ENDPOINTS ====================

  @Get("campgrounds/:campgroundId/autonomous-actions")
  @Roles(UserRole.owner, UserRole.manager)
  async getAutonomousActions(
    @Param("campgroundId") campgroundId: string,
    @Query("actionType") actionType?: string,
    @Query("limit") limit?: string
  ) {
    return this.autonomousActionService.getRecentActions(campgroundId, {
      actionType,
      limit: limit ? parseInt(limit) : 50,
    });
  }

  @Get("autonomous-actions/:id")
  @Roles(UserRole.owner, UserRole.manager)
  async getAutonomousAction(@Param("id") id: string) {
    return this.autonomousActionService.getAction(id);
  }

  @Post("autonomous-actions/:id/reverse")
  @Roles(UserRole.owner, UserRole.manager)
  async reverseAutonomousAction(
    @Param("id") id: string,
    @Body("reason") reason: string,
    @Req() req: Request
  ) {
    const user = (req as any).user;
    return this.autonomousActionService.reverseAction(id, user?.id, reason);
  }

  @Get("campgrounds/:campgroundId/autonomous-actions/summary")
  @Roles(UserRole.owner, UserRole.manager)
  async getAutonomousActionsSummary(
    @Param("campgroundId") campgroundId: string,
    @Query("days") days?: string
  ) {
    return this.autonomousActionService.getActionsSummary(
      campgroundId,
      days ? parseInt(days) : 30
    );
  }
}
