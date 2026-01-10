import { BadRequestException, Body, Controller, Get, Patch, Post, Query, Request, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards";
import { GamificationService } from "./gamification.service";
import { AwardXpDto, UpdateGamificationSettingsDto, UpsertXpRuleDto } from "./dto/gamification.dto";

@UseGuards(JwtAuthGuard)
@Controller("gamification")
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) { }

  private resolveCampgroundId(req: any, provided?: string) {
    const cg = provided || (req.headers?.["x-campground-id"] as string) || (req.query?.campgroundId as string);
    if (!cg || typeof cg !== "string") {
      throw new BadRequestException("campgroundId is required");
    }
    return cg;
  }

  @Get("dashboard")
  getDashboard(@Request() req: Request, @Query("campgroundId") campgroundId: string): any {
    const cg = this.resolveCampgroundId(req, campgroundId);
    return this.gamificationService.getDashboard(req.user.id, cg);
  }

  @Get("settings")
  getSettings(@Request() req: Request, @Query("campgroundId") campgroundId: string): any {
    const cg = this.resolveCampgroundId(req, campgroundId);
    return this.gamificationService.getSettingsForManager(req.user.id, cg);
  }

  @Patch("settings")
  updateSettings(@Request() req: Request, @Body() body: UpdateGamificationSettingsDto) {
    const cg = this.resolveCampgroundId(req, (body as any)?.campgroundId);
    const rawEnabled = (body as any)?.enabled;
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

    const enabledRoles = Array.isArray(body?.enabledRoles)
      ? body.enabledRoles.filter((r): r is any => typeof r === "string")
      : [];

    return this.gamificationService.updateSettings(req.user.id, {
      campgroundId: cg,
      enabled,
      enabledRoles,
    });
  }

  @Get("rules")
  getRules(@Request() req: Request, @Query("campgroundId") campgroundId: string): any {
    const cg = this.resolveCampgroundId(req, campgroundId);
    return this.gamificationService.getRules(req.user.id, cg);
  }

  @Post("rules")
  upsertRule(@Request() req: Request, @Body() body: UpsertXpRuleDto): any {
    const cg = this.resolveCampgroundId(req, (body as any)?.campgroundId);
    return this.gamificationService.upsertRule(req.user.id, { ...body, campgroundId: cg });
  }

  @Post("award")
  manualAward(@Request() req: Request, @Body() body: AwardXpDto): any {
    const cg = this.resolveCampgroundId(req, (body as any)?.campgroundId);
    return this.gamificationService.manualAward(req.user.id, { ...body, campgroundId: cg });
  }

  @Get("levels")
  listLevels(): any {
    return this.gamificationService.getLevels();
  }

  @Get("leaderboard")
  getLeaderboard(
    @Request() req: Request,
    @Query("campgroundId") campgroundId: string,
    @Query("days") days?: string,
    @Query("limit") limit?: string,
  ): any {
    const cg = this.resolveCampgroundId(req, campgroundId);
    const parsedDays = days ? Number(days) : undefined;
    const parsedLimit = limit ? Number(limit) : undefined;
    return this.gamificationService.getLeaderboard({
      campgroundId: cg,
      viewerId: req.user.id,
      days: parsedDays,
      limit: parsedLimit
    });
  }

  @Get("stats")
  getStats(@Request() req: Request, @Query("campgroundId") campgroundId: string, @Query("days") days?: string): any {
    const cg = this.resolveCampgroundId(req, campgroundId);
    const parsedDays = days ? Number(days) : undefined;
    return this.gamificationService.getStats(cg, parsedDays);
  }
}

