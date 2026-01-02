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
  UseGuards
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards";
import { Roles, RolesGuard } from "../auth/guards/roles.guard";
import { UserRole } from "@prisma/client";
import { PoliciesService } from "./policies.service";
import { CreatePolicyTemplateDto } from "./dto/create-policy-template.dto";
import { UpdatePolicyTemplateDto } from "./dto/update-policy-template.dto";
import { ScopeGuard } from "../permissions/scope.guard";

@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
@Controller()
export class PoliciesController {
  constructor(private readonly policies: PoliciesService) {}

  private requireCampgroundId(req: any, fallback?: string): string {
    const campgroundId = fallback || req?.campgroundId || req?.headers?.["x-campground-id"];
    if (!campgroundId) {
      throw new BadRequestException("campgroundId is required");
    }
    return campgroundId;
  }

  private assertCampgroundAccess(campgroundId: string, user: any): void {
    const isPlatformStaff = user?.platformRole === "platform_admin" ||
                            user?.platformRole === "platform_superadmin" ||
                            user?.platformRole === "support_agent";
    if (isPlatformStaff) {
      return;
    }

    const userCampgroundIds = user?.memberships?.map((m: any) => m.campgroundId) ?? [];
    if (!userCampgroundIds.includes(campgroundId)) {
      throw new BadRequestException("You do not have access to this campground");
    }
  }

  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk, UserRole.finance, UserRole.readonly)
  @Get("campgrounds/:campgroundId/policy-templates")
  list(@Param("campgroundId") campgroundId: string, @Req() req: any) {
    this.assertCampgroundAccess(campgroundId, req.user);
    return this.policies.listTemplates(campgroundId);
  }

  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  @Post("campgrounds/:campgroundId/policy-templates")
  create(
    @Param("campgroundId") campgroundId: string,
    @Body() dto: CreatePolicyTemplateDto,
    @Req() req: any
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
    @Req() req: any
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
    @Req() req: any
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.policies.removeTemplate(requiredCampgroundId, id);
  }
}
