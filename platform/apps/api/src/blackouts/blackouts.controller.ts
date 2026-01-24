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
import { BlackoutsService } from "./blackouts.service";
import { CreateBlackoutDateDto, UpdateBlackoutDateDto } from "./dto/blackout.dto";
import { JwtAuthGuard } from "../auth/guards";
import { RolesGuard } from "../auth/guards/roles.guard";
import { ScopeGuard } from "../permissions/scope.guard";
import type { AuthUser } from "../auth/auth.types";

type BlackoutsRequest = Request & {
  user?: AuthUser;
  campgroundId?: string | null;
};

@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
@Controller("blackouts")
export class BlackoutsController {
  constructor(private readonly blackoutsService: BlackoutsService) {}

  private requireCampgroundId(req: BlackoutsRequest, fallback?: string): string {
    const headerCampgroundId = req?.headers?.["x-campground-id"];
    const normalizedHeader =
      typeof headerCampgroundId === "string"
        ? headerCampgroundId
        : Array.isArray(headerCampgroundId)
          ? headerCampgroundId[0]
          : undefined;
    const campgroundId = fallback || req?.campgroundId || normalizedHeader;
    if (!campgroundId) {
      throw new BadRequestException("campgroundId is required");
    }
    return campgroundId;
  }

  private assertCampgroundAccess(campgroundId: string, user?: AuthUser): void {
    const isPlatformStaff =
      user?.platformRole === "platform_admin" || user?.platformRole === "support_agent";
    if (isPlatformStaff) {
      return;
    }

    const userCampgroundIds = user?.memberships?.map((m) => m.campgroundId) ?? [];
    if (!userCampgroundIds.includes(campgroundId)) {
      throw new BadRequestException("You do not have access to this campground");
    }
  }

  @Post()
  create(@Body() createBlackoutDateDto: CreateBlackoutDateDto, @Req() req: BlackoutsRequest) {
    this.assertCampgroundAccess(createBlackoutDateDto.campgroundId, req.user);
    return this.blackoutsService.create(createBlackoutDateDto);
  }

  @Get("campgrounds/:campgroundId")
  findAll(@Param("campgroundId") campgroundId: string, @Req() req: BlackoutsRequest) {
    this.assertCampgroundAccess(campgroundId, req.user);
    return this.blackoutsService.findAll(campgroundId);
  }

  @Get(":id")
  findOne(
    @Param("id") id: string,
    @Req() req: BlackoutsRequest,
    @Query("campgroundId") campgroundId?: string,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.blackoutsService.findOne(requiredCampgroundId, id);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() updateBlackoutDateDto: UpdateBlackoutDateDto,
    @Req() req: BlackoutsRequest,
    @Query("campgroundId") campgroundId?: string,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.blackoutsService.update(requiredCampgroundId, id, updateBlackoutDateDto);
  }

  @Delete(":id")
  remove(
    @Param("id") id: string,
    @Req() req: BlackoutsRequest,
    @Query("campgroundId") campgroundId?: string,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.blackoutsService.remove(requiredCampgroundId, id);
  }
}
