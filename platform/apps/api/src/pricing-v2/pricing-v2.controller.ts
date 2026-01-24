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
import { PricingV2Service } from "./pricing-v2.service";
import { CreatePricingRuleV2Dto } from "./dto/create-pricing-rule-v2.dto";
import { UpdatePricingRuleV2Dto } from "./dto/update-pricing-rule-v2.dto";
import { JwtAuthGuard } from "../auth/guards";
import { RolesGuard, Roles } from "../auth/guards/roles.guard";
import { UserRole } from "@prisma/client";
import { ScopeGuard } from "../permissions/scope.guard";

@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
@Controller()
export class PricingV2Controller {
  constructor(private readonly pricing: PricingV2Service) {}

  private requireCampgroundId(req: AuthRequest, fallback?: string): string {
    const campgroundId =
      fallback || req.campgroundId || getHeaderValue(req.headers, "x-campground-id");
    if (!campgroundId) {
      throw new BadRequestException("campgroundId is required");
    }
    return campgroundId;
  }

  private assertCampgroundAccess(campgroundId: string, user?: AuthUser): void {
    const isPlatformStaff =
      user?.platformRole === "platform_admin" ||
      user?.platformRole === "platform_superadmin" ||
      user?.platformRole === "support_agent";
    if (isPlatformStaff) {
      return;
    }

    const userCampgroundIds =
      user?.memberships?.flatMap((membership) =>
        membership.campgroundId ? [membership.campgroundId] : [],
      ) ?? [];
    if (!userCampgroundIds.includes(campgroundId)) {
      throw new BadRequestException("You do not have access to this campground");
    }
  }

  @Roles(UserRole.owner, UserRole.manager)
  @Get("campgrounds/:campgroundId/pricing-rules/v2")
  list(@Param("campgroundId") campgroundId: string, @Req() req: AuthRequest) {
    this.assertCampgroundAccess(campgroundId, req.user);
    return this.pricing.list(campgroundId);
  }

  @Roles(UserRole.owner, UserRole.manager)
  @Post("campgrounds/:campgroundId/pricing-rules/v2")
  create(
    @Param("campgroundId") campgroundId: string,
    @Body() dto: CreatePricingRuleV2Dto,
    @Req() req: AuthRequest,
  ) {
    this.assertCampgroundAccess(campgroundId, req.user);
    return this.pricing.create(campgroundId, dto);
  }

  @Roles(UserRole.owner, UserRole.manager)
  @Patch("pricing-rules/v2/:id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdatePricingRuleV2Dto,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: AuthRequest,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.pricing.update(requiredCampgroundId, id, dto);
  }

  @Roles(UserRole.owner, UserRole.manager)
  @Delete("pricing-rules/v2/:id")
  remove(
    @Param("id") id: string,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: AuthRequest,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.pricing.remove(requiredCampgroundId, id);
  }
}

type Membership = { campgroundId?: string | null };

type AuthUser = {
  platformRole?: string | null;
  memberships?: Membership[];
};

type AuthRequest = Request & {
  campgroundId?: string;
  user?: AuthUser;
};

const getHeaderValue = (headers: Request["headers"], key: string): string | undefined => {
  const value = headers[key];
  if (Array.isArray(value)) return value[0];
  return typeof value === "string" ? value : undefined;
};
