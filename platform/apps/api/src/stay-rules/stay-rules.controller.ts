import type { Request } from "express";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { StayRulesService } from "./stay-rules.service";
import { JwtAuthGuard } from "../auth/guards";
import { RolesGuard } from "../auth/guards/roles.guard";
import { ScopeGuard } from "../permissions/scope.guard";
import type { AuthUser } from "../auth/auth.types";

type CampgroundRequest = Request & { campgroundId?: string };

const getHeaderValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

interface DateRange {
  start: string;
  end: string;
}

@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
@Controller()
export class StayRulesController {
  constructor(private readonly stayRulesService: StayRulesService) {}

  private requireCampgroundId(req: CampgroundRequest, fallback?: string): string {
    const headerCampgroundId = getHeaderValue(req.headers?.["x-campground-id"]);
    const campgroundId = fallback ?? req.campgroundId ?? headerCampgroundId;
    if (!campgroundId) {
      throw new BadRequestException("campgroundId is required");
    }
    return campgroundId;
  }

  private assertCampgroundAccess(campgroundId: string, user: AuthUser | undefined): void {
    if (!user) {
      throw new BadRequestException("You do not have access to this campground");
    }

    const platformRole = user.platformRole ?? "";
    const isPlatformStaff = ["platform_admin", "platform_superadmin", "support_agent"].includes(
      platformRole,
    );
    if (isPlatformStaff) {
      return;
    }

    const userCampgroundIds = user.memberships.map((membership) => membership.campgroundId);
    if (!userCampgroundIds.includes(campgroundId)) {
      throw new BadRequestException("You do not have access to this campground");
    }
  }

  @Post("campgrounds/:campgroundId/stay-rules")
  create(
    @Param("campgroundId") campgroundId: string,
    @Body()
    body: {
      name: string;
      minNights?: number;
      maxNights?: number;
      siteClasses?: string[];
      dateRanges?: DateRange[];
      ignoreDaysBefore?: number;
    },
    @Req() req: Request,
  ) {
    this.assertCampgroundAccess(campgroundId, req.user);
    return this.stayRulesService.create({
      campgroundId,
      ...body,
    });
  }

  @Get("campgrounds/:campgroundId/stay-rules")
  findAllByCampground(@Param("campgroundId") campgroundId: string, @Req() req: Request) {
    this.assertCampgroundAccess(campgroundId, req.user);
    return this.stayRulesService.findAllByCampground(campgroundId);
  }

  @Get("stay-rules/:id")
  findOne(
    @Param("id") id: string,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: Request,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.stayRulesService.findOne(requiredCampgroundId, id);
  }

  @Patch("stay-rules/:id")
  update(
    @Param("id") id: string,
    @Body()
    body: Partial<{
      name: string;
      minNights: number;
      maxNights: number;
      siteClasses: string[];
      dateRanges: DateRange[];
      ignoreDaysBefore: number;
      isActive: boolean;
    }>,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: Request,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.stayRulesService.update(requiredCampgroundId, id, body);
  }

  @Delete("stay-rules/:id")
  remove(
    @Param("id") id: string,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: Request,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.stayRulesService.remove(requiredCampgroundId, id);
  }

  @Post("stay-rules/:id/duplicate")
  duplicate(
    @Param("id") id: string,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: Request,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.stayRulesService.duplicate(requiredCampgroundId, id);
  }
}
