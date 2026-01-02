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
import { UpsellsService } from "./upsells.service";
import { CreateUpsellDto } from "./dto/create-upsell.dto";
import { UpdateUpsellDto } from "./dto/update-upsell.dto";
import { JwtAuthGuard } from "../auth/guards";
import { RolesGuard, Roles } from "../auth/guards/roles.guard";
import { UserRole } from "@prisma/client";
import { ScopeGuard } from "../permissions/scope.guard";

@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
@Controller()
export class UpsellsController {
  constructor(private readonly upsells: UpsellsService) {}

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

  @Roles(UserRole.owner, UserRole.manager)
  @Get("campgrounds/:campgroundId/upsells")
  list(@Param("campgroundId") campgroundId: string, @Req() req: any) {
    this.assertCampgroundAccess(campgroundId, req.user);
    return this.upsells.list(campgroundId);
  }

  @Roles(UserRole.owner, UserRole.manager)
  @Post("campgrounds/:campgroundId/upsells")
  create(
    @Param("campgroundId") campgroundId: string,
    @Body() dto: CreateUpsellDto,
    @Req() req: any
  ) {
    this.assertCampgroundAccess(campgroundId, req.user);
    return this.upsells.create(campgroundId, dto);
  }

  @Roles(UserRole.owner, UserRole.manager)
  @Patch("upsells/:id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateUpsellDto,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: any
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.upsells.update(requiredCampgroundId, id, dto);
  }

  @Roles(UserRole.owner, UserRole.manager)
  @Delete("upsells/:id")
  remove(
    @Param("id") id: string,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: any
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.upsells.remove(requiredCampgroundId, id);
  }
}
