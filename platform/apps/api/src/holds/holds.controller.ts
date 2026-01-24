import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { HoldsService } from "./holds.service";
import { CreateHoldDto } from "./dto/create-hold.dto";
import { JwtAuthGuard } from "../auth/guards";
import { Roles, RolesGuard } from "../auth/guards/roles.guard";
import { ScopeGuard } from "../permissions/scope.guard";
import { UserRole } from "@prisma/client";
import type { Request } from "express";
import type { AuthUser } from "../auth/auth.types";

type CampgroundRequest = Request & { campgroundId?: string | null; user?: AuthUser | null };

@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
@Controller("holds")
export class HoldsController {
  constructor(private readonly holds: HoldsService) {}

  private requireCampgroundId(req: CampgroundRequest, fallback?: string): string {
    const headerValue = req.headers["x-campground-id"];
    const headerCampgroundId = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    const campgroundId = fallback ?? req.campgroundId ?? headerCampgroundId;
    if (!campgroundId) {
      throw new BadRequestException("campgroundId is required");
    }
    return campgroundId;
  }

  private assertCampgroundAccess(campgroundId: string, user?: AuthUser | null): void {
    const isPlatformStaff =
      user?.platformRole === "platform_admin" || user?.platformRole === "support_agent";
    if (isPlatformStaff) {
      return;
    }

    const userCampgroundIds = user?.memberships?.map((membership) => membership.campgroundId) ?? [];
    if (!userCampgroundIds.includes(campgroundId)) {
      throw new BadRequestException("You do not have access to this campground");
    }
  }

  @Post()
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  create(@Body() dto: CreateHoldDto, @Req() req: CampgroundRequest) {
    const requiredCampgroundId = this.requireCampgroundId(req, dto.campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.holds.create({ ...dto, campgroundId: requiredCampgroundId });
  }

  @Get("campgrounds/:campgroundId")
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  list(@Param("campgroundId") campgroundId: string, @Req() req: CampgroundRequest) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.holds.listByCampground(requiredCampgroundId);
  }

  @Delete(":id")
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  release(
    @Param("id") id: string,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: CampgroundRequest,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.holds.release(requiredCampgroundId, id);
  }

  @Post("expire")
  @Roles(UserRole.owner, UserRole.manager)
  expireStale(
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: CampgroundRequest,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.holds.expireStale(requiredCampgroundId);
  }
}
