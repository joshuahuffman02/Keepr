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
    private readonly noShowService: AiNoShowPredictionService
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
}
