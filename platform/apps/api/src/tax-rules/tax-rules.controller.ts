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
import { TaxRulesService } from "./tax-rules.service";
import { TaxRuleType } from "@prisma/client";
import { JwtAuthGuard } from "../auth/guards";
import { RolesGuard } from "../auth/guards/roles.guard";
import { ScopeGuard } from "../permissions/scope.guard";
import type { AuthUser } from "../auth/auth.types";

type CampgroundRequest = Request & { campgroundId?: string };

const getHeaderValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
@Controller("tax-rules")
export class TaxRulesController {
  constructor(private readonly taxRulesService: TaxRulesService) {}

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

  @Post()
  create(
    @Body()
    body: {
      campgroundId: string;
      name: string;
      type: TaxRuleType;
      rate?: number;
      minNights?: number;
      maxNights?: number;
      requiresWaiver?: boolean;
      waiverText?: string;
    },
    @Req() req: Request,
  ) {
    this.assertCampgroundAccess(body.campgroundId, req.user);
    return this.taxRulesService.create(body);
  }

  @Get("campground/:campgroundId")
  findAllByCampground(@Param("campgroundId") campgroundId: string, @Req() req: Request) {
    this.assertCampgroundAccess(campgroundId, req.user);
    return this.taxRulesService.findAllByCampground(campgroundId);
  }

  @Get(":id")
  findOne(
    @Param("id") id: string,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: Request,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.taxRulesService.findOne(requiredCampgroundId, id);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body()
    body: Partial<{
      name: string;
      type: TaxRuleType;
      rate: number;
      minNights: number;
      maxNights: number;
      requiresWaiver: boolean;
      waiverText: string;
      isActive: boolean;
    }>,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: Request,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.taxRulesService.update(requiredCampgroundId, id, body);
  }

  @Delete(":id")
  remove(
    @Param("id") id: string,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: Request,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.taxRulesService.remove(requiredCampgroundId, id);
  }
}
