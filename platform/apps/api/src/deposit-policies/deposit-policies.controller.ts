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
import { DepositPoliciesService } from "./deposit-policies.service";
import { CreateDepositPolicyDto } from "./dto/create-deposit-policy.dto";
import { UpdateDepositPolicyDto } from "./dto/update-deposit-policy.dto";
import { JwtAuthGuard } from "../auth/guards";
import { RolesGuard, Roles } from "../auth/guards/roles.guard";
import { UserRole } from "@prisma/client";
import { ScopeGuard } from "../permissions/scope.guard";

@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
@Controller()
export class DepositPoliciesController {
  constructor(private readonly depositPolicies: DepositPoliciesService) {}

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

  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Get("campgrounds/:campgroundId/deposit-policies")
  list(@Param("campgroundId") campgroundId: string, @Req() req: any) {
    this.assertCampgroundAccess(campgroundId, req.user);
    return this.depositPolicies.list(campgroundId);
  }

  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Post("campgrounds/:campgroundId/deposit-policies")
  create(
    @Param("campgroundId") campgroundId: string,
    @Body() dto: CreateDepositPolicyDto,
    @Req() req: any
  ) {
    this.assertCampgroundAccess(campgroundId, req.user);
    return this.depositPolicies.create(campgroundId, dto);
  }

  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Patch("deposit-policies/:id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateDepositPolicyDto,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: any
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.depositPolicies.update(requiredCampgroundId, id, dto);
  }

  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Delete("deposit-policies/:id")
  remove(
    @Param("id") id: string,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: any
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.depositPolicies.remove(requiredCampgroundId, id);
  }
}
