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
import { JwtAuthGuard } from "../auth/guards";
import { Roles, RolesGuard } from "../auth/guards/roles.guard";
import { UserRole } from "@prisma/client";
import { PoliciesService } from "./policies.service";
import { CreatePolicyTemplateDto } from "./dto/create-policy-template.dto";
import { UpdatePolicyTemplateDto } from "./dto/update-policy-template.dto";
import { ScopeGuard } from "../permissions/scope.guard";
import type { AuthUser } from "../auth/auth.types";

@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
@Controller()
export class PoliciesController {
  constructor(private readonly policies: PoliciesService) {}

  private requireCampgroundId(req: Request & { campgroundId?: string }, fallback?: string): string {
    const headerValue = req.headers?.["x-campground-id"];
    const headerCampgroundId = Array.isArray(headerValue) ? headerValue[0] : headerValue;
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

  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk, UserRole.finance, UserRole.readonly)
  @Get("campgrounds/:campgroundId/policy-templates")
  list(@Param("campgroundId") campgroundId: string, @Req() req: Request) {
    this.assertCampgroundAccess(campgroundId, req.user);
    return this.policies.listTemplates(campgroundId);
  }

  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  @Post("campgrounds/:campgroundId/policy-templates")
  create(
    @Param("campgroundId") campgroundId: string,
    @Body() dto: CreatePolicyTemplateDto,
    @Req() req: Request,
  ) {
    this.assertCampgroundAccess(campgroundId, req.user);
    return this.policies.createTemplate(campgroundId, dto);
  }

  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  @Patch("policy-templates/:id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdatePolicyTemplateDto,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: Request,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.policies.updateTemplate(requiredCampgroundId, id, dto);
  }

  @Roles(UserRole.owner, UserRole.manager)
  @Delete("policy-templates/:id")
  remove(
    @Param("id") id: string,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: Request,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.policies.removeTemplate(requiredCampgroundId, id);
  }
}
