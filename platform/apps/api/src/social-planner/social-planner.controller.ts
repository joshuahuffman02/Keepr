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
import { JwtAuthGuard } from "../auth/guards";
import { SocialPlannerService } from "./social-planner.service";
import { SocialSuggestionStatus } from "@prisma/client";
import {
  CreateAlertDto,
  CreateAssetDto,
  CreatePostDto,
  CreateStrategyDto,
  CreateSuggestionDto,
  CreateTemplateDto,
  PerformanceInputDto,
  UpdateAssetDto,
  UpdatePostDto,
  UpdateSuggestionStatusDto,
  UpdateTemplateDto,
} from "./dto/social-planner.dto";

@UseGuards(JwtAuthGuard)
@Controller("social-planner")
export class SocialPlannerController {
  constructor(private readonly service: SocialPlannerService) {}

  // Posts / Calendar
  @Get("posts")
  listPosts(@Query("campgroundId") campgroundId: string) {
    return this.service.listPosts(campgroundId);
  }

  @Get("posts/:id")
  getPost(@Param("id") id: string) {
    return this.service.getPost(id);
  }

  @Post("posts")
  createPost(@Body() dto: CreatePostDto) {
    return this.service.createPost(dto);
  }

  @Patch("posts/:id")
  updatePost(@Param("id") id: string, @Body() dto: UpdatePostDto) {
    return this.service.updatePost(id, dto);
  }

  @Delete("posts/:id")
  deletePost(@Param("id") id: string) {
    return this.service.deletePost(id);
  }

  // Templates
  @Get("templates")
  listTemplates(@Query("campgroundId") campgroundId: string) {
    return this.service.listTemplates(campgroundId);
  }

  @Post("templates")
  createTemplate(@Body() dto: CreateTemplateDto) {
    return this.service.createTemplate(dto);
  }

  @Patch("templates/:id")
  updateTemplate(@Param("id") id: string, @Body() dto: UpdateTemplateDto) {
    return this.service.updateTemplate(id, dto);
  }

  @Delete("templates/:id")
  deleteTemplate(@Param("id") id: string) {
    return this.service.deleteTemplate(id);
  }

  // Content bank
  @Get("assets")
  listAssets(@Query("campgroundId") campgroundId: string) {
    return this.service.listAssets(campgroundId);
  }

  @Post("assets")
  createAsset(@Body() dto: CreateAssetDto) {
    return this.service.createAsset(dto);
  }

  @Patch("assets/:id")
  updateAsset(@Param("id") id: string, @Body() dto: UpdateAssetDto) {
    return this.service.updateAsset(id, dto);
  }

  @Delete("assets/:id")
  deleteAsset(@Param("id") id: string) {
    return this.service.deleteAsset(id);
  }

  // Suggestions
  @Get("suggestions")
  listSuggestions(@Query("campgroundId") campgroundId: string, @Query("status") status?: string) {
    const statusFilter = status && isSocialSuggestionStatus(status) ? status : undefined;
    return this.service.listSuggestions(campgroundId, statusFilter);
  }

  @Post("suggestions")
  createSuggestion(@Body() dto: CreateSuggestionDto) {
    return this.service.createSuggestion(dto);
  }

  @Post("suggestions/refresh")
  refreshSuggestions(@Body("campgroundId") campgroundId: string) {
    return this.service.refreshSuggestions(campgroundId);
  }

  @Patch("suggestions/:id/status")
  updateSuggestionStatus(@Param("id") id: string, @Body() dto: UpdateSuggestionStatusDto) {
    return this.service.updateSuggestionStatus(id, dto);
  }

  // Weekly ideas
  @Post("weekly")
  generateWeekly(@Body("campgroundId") campgroundId: string) {
    return this.service.generateWeeklyIdeas(campgroundId);
  }

  // Strategy & alerts
  @Post("strategies")
  createStrategy(@Body() dto: CreateStrategyDto) {
    return this.service.createStrategy(dto);
  }

  @Get("strategies")
  listStrategies(@Query("campgroundId") campgroundId: string) {
    return this.service.listStrategies(campgroundId);
  }

  @Post("alerts")
  createAlert(@Body() dto: CreateAlertDto) {
    return this.service.createAlert(dto);
  }

  @Get("alerts")
  listAlerts(@Query("campgroundId") campgroundId: string) {
    return this.service.listAlerts(campgroundId);
  }

  @Post("alerts/:id/dismiss")
  dismissAlert(@Param("id") id: string) {
    return this.service.dismissAlert(id);
  }

  // Performance & reports
  @Post("performance")
  recordPerformance(@Body() dto: PerformanceInputDto) {
    return this.service.recordPerformance(dto);
  }

  @Get("reports")
  report(@Query("campgroundId") campgroundId: string) {
    return this.service.reportSummary(campgroundId);
  }
}

const SOCIAL_SUGGESTION_STATUSES = new Set<string>(Object.values(SocialSuggestionStatus));

const isSocialSuggestionStatus = (value: string): value is SocialSuggestionStatus =>
  SOCIAL_SUGGESTION_STATUSES.has(value);
