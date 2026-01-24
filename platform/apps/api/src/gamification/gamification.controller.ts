import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards";
import { GamificationService } from "./gamification.service";
import { AwardXpDto, UpdateGamificationSettingsDto, UpsertXpRuleDto } from "./dto/gamification.dto";
import type { Request as ExpressRequest } from "express";
import type { AuthUser } from "../auth/auth.types";
import { UserRole } from "@prisma/client";

type GamificationRequest = ExpressRequest & { user?: AuthUser };

@UseGuards(JwtAuthGuard)
@Controller("gamification")
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  private resolveCampgroundId(req: GamificationRequest, provided?: string) {
    const headerValue = req.headers?.["x-campground-id"];
    const headerId = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    const queryValue = req.query?.campgroundId;
    const queryId =
      typeof queryValue === "string"
        ? queryValue
        : Array.isArray(queryValue)
          ? queryValue[0]
          : undefined;
    const cg = provided || headerId || queryId;
    if (!cg || typeof cg !== "string") {
      throw new BadRequestException("campgroundId is required");
    }
    return cg;
  }

  private requireUserId(req: GamificationRequest): string {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException("User authentication required");
    }
    return userId;
  }

  @Get("dashboard")
  getDashboard(@Req() req: GamificationRequest, @Query("campgroundId") campgroundId: string) {
    const cg = this.resolveCampgroundId(req, campgroundId);
    const userId = this.requireUserId(req);
    return this.gamificationService.getDashboard(userId, cg);
  }

  @Get("settings")
  getSettings(@Req() req: GamificationRequest, @Query("campgroundId") campgroundId: string) {
    const cg = this.resolveCampgroundId(req, campgroundId);
    const userId = this.requireUserId(req);
    return this.gamificationService.getSettingsForManager(userId, cg);
  }

  @Patch("settings")
  updateSettings(@Req() req: GamificationRequest, @Body() body: UpdateGamificationSettingsDto) {
    const cg = this.resolveCampgroundId(req, body.campgroundId);
    const userId = this.requireUserId(req);
    const rawEnabled: unknown = body.enabled;
    let enabled: boolean;
    if (typeof rawEnabled === "boolean") {
      enabled = rawEnabled;
    } else if (typeof rawEnabled === "string") {
      const v = rawEnabled.trim().toLowerCase();
      if (v === "true") enabled = true;
      else if (v === "false") enabled = false;
      else throw new BadRequestException("enabled must be a boolean");
    } else if (typeof rawEnabled === "number") {
      enabled = rawEnabled === 1;
    } else {
      throw new BadRequestException("enabled must be a boolean");
    }

    const roleSet = new Set(Object.values(UserRole));
    const enabledRoles = Array.isArray(body?.enabledRoles)
      ? body.enabledRoles.filter((role): role is UserRole => roleSet.has(role))
      : [];

    return this.gamificationService.updateSettings(userId, {
      campgroundId: cg,
      enabled,
      enabledRoles,
    });
  }

  @Get("rules")
  getRules(@Req() req: GamificationRequest, @Query("campgroundId") campgroundId: string) {
    const cg = this.resolveCampgroundId(req, campgroundId);
    const userId = this.requireUserId(req);
    return this.gamificationService.getRules(userId, cg);
  }

  @Post("rules")
  upsertRule(@Req() req: GamificationRequest, @Body() body: UpsertXpRuleDto) {
    const cg = this.resolveCampgroundId(req, body.campgroundId);
    const userId = this.requireUserId(req);
    return this.gamificationService.upsertRule(userId, { ...body, campgroundId: cg });
  }

  @Post("award")
  manualAward(@Req() req: GamificationRequest, @Body() body: AwardXpDto) {
    const cg = this.resolveCampgroundId(req, body.campgroundId);
    const userId = this.requireUserId(req);
    return this.gamificationService.manualAward(userId, { ...body, campgroundId: cg });
  }

  @Get("levels")
  listLevels() {
    return this.gamificationService.getLevels();
  }

  @Get("leaderboard")
  getLeaderboard(
    @Req() req: GamificationRequest,
    @Query("campgroundId") campgroundId: string,
    @Query("days") days?: string,
    @Query("limit") limit?: string,
  ) {
    const cg = this.resolveCampgroundId(req, campgroundId);
    const userId = this.requireUserId(req);
    const parsedDays = days ? Number(days) : undefined;
    const parsedLimit = limit ? Number(limit) : undefined;
    return this.gamificationService.getLeaderboard({
      campgroundId: cg,
      viewerId: userId,
      days: parsedDays,
      limit: parsedLimit,
    });
  }

  @Get("stats")
  getStats(
    @Req() req: GamificationRequest,
    @Query("campgroundId") campgroundId: string,
    @Query("days") days?: string,
  ) {
    const cg = this.resolveCampgroundId(req, campgroundId);
    const parsedDays = days ? Number(days) : undefined;
    return this.gamificationService.getStats(cg, parsedDays);
  }
}
