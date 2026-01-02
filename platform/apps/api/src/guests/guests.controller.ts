import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, ForbiddenException } from "@nestjs/common";
import { GuestsService } from "./guests.service";
import { CreateGuestDto } from "./dto/create-guest.dto";
import { JwtAuthGuard } from "../auth/guards";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { RolesGuard, Roles } from "../auth/guards/roles.guard";
import { ScopeGuard } from "../permissions/scope.guard";
import { UserRole } from "@prisma/client";

// SECURITY: Added RolesGuard and ScopeGuard to prevent cross-tenant access
@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
@Controller("guests")
export class GuestsController {
  constructor(private readonly guests: GuestsService) { }

  @Get()
  findAll(
    @Query("campgroundId") campgroundId?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("search") search?: string
  ) {
    // Require campgroundId to prevent cross-tenant data access
    if (!campgroundId) {
      throw new ForbiddenException("campgroundId is required to list guests");
    }
    return this.guests.findAllByCampground(campgroundId, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      search
    });
  }

  @Get(":id")
  findOne(@Param("id") id: string, @Query("campgroundId") campgroundId?: string) {
    // When campgroundId provided, verify guest belongs to that campground
    return this.guests.findOne(id, campgroundId);
  }

  @Post()
  create(
    @Body() body: CreateGuestDto,
    @Query("campgroundId") campgroundId?: string,
    @CurrentUser() user?: any
  ) {
    return this.guests.create(body, { actorId: user?.id, campgroundId });
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() body: Partial<CreateGuestDto>,
    @Query("campgroundId") campgroundId: string,
    @CurrentUser() user?: any
  ) {
    // SECURITY: Require campgroundId to prevent cross-tenant guest modification
    if (!campgroundId) {
      throw new ForbiddenException("campgroundId is required to update a guest");
    }
    return this.guests.update(id, body, { actorId: user?.id, campgroundId });
  }

  @Delete(":id")
  remove(
    @Param("id") id: string,
    @Query("campgroundId") campgroundId: string,
    @CurrentUser() user?: any
  ) {
    // SECURITY: Require campgroundId to prevent cross-tenant guest deletion
    if (!campgroundId) {
      throw new ForbiddenException("campgroundId is required to delete a guest");
    }
    return this.guests.remove(id, { actorId: user?.id, campgroundId });
  }

  @Post("merge")
  merge(
    @Body() body: { primaryId: string; secondaryId: string },
    @Query("campgroundId") campgroundId: string,
    @CurrentUser() user?: any
  ) {
    // SECURITY: Require campgroundId to prevent cross-tenant guest merging
    if (!campgroundId) {
      throw new ForbiddenException("campgroundId is required to merge guests");
    }
    return this.guests.merge(body.primaryId, body.secondaryId, {
      actorId: user?.id,
      campgroundId
    });
  }
}
