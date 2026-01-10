import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, ForbiddenException } from "@nestjs/common";
import { GuestsService } from "./guests.service";
import { CreateGuestDto } from "./dto/create-guest.dto";
import { JwtAuthGuard } from "../auth/guards";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { RolesGuard, Roles } from "../auth/guards/roles.guard";
import { ScopeGuard } from "../permissions/scope.guard";
import { UserRole } from "@prisma/client";
import type { AuthUser } from "../auth/auth.types";

// SECURITY FIX (GUEST-HIGH-001): Added membership validation to prevent cross-tenant access
@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
@Controller("guests")
export class GuestsController {
  constructor(private readonly guests: GuestsService) { }

  /**
   * Verify the authenticated user has access to the specified campground.
   * Prevents cross-tenant access by ensuring users can only access campgrounds they are members of.
   */
  private assertCampgroundAccess(campgroundId: string, user?: AuthUser | null): void {
    // Platform staff can access any campground
    const isPlatformStaff = user?.platformRole === 'platform_admin' ||
                            user?.platformRole === 'platform_superadmin' ||
                            user?.platformRole === 'support_agent';
    if (isPlatformStaff) {
      return;
    }

    const userCampgroundIds = user?.memberships?.map((m) => m.campgroundId) ?? [];
    if (!userCampgroundIds.includes(campgroundId)) {
      throw new ForbiddenException("You do not have access to this campground");
    }
  }

  @Get()
  findAll(
    @Query("campgroundId") campgroundId?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("search") search?: string,
    @CurrentUser() user?: AuthUser | null
  ) {
    // Require campgroundId to prevent cross-tenant data access
    if (!campgroundId) {
      throw new ForbiddenException("campgroundId is required to list guests");
    }
    // SECURITY: Verify user has access to this campground
    this.assertCampgroundAccess(campgroundId, user);

    return this.guests.findAllByCampground(campgroundId, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      search
    });
  }

  @Get(":id")
  findOne(
    @Param("id") id: string,
    @Query("campgroundId") campgroundId?: string,
    @CurrentUser() user?: AuthUser | null
  ) {
    // When campgroundId provided, verify user has access to that campground
    if (campgroundId) {
      this.assertCampgroundAccess(campgroundId, user);
    }
    return this.guests.findOne(id, campgroundId);
  }

  @Post()
  create(
    @Body() body: CreateGuestDto,
    @Query("campgroundId") campgroundId?: string,
    @CurrentUser() user?: AuthUser | null
  ) {
    // SECURITY: Verify user has access to the campground if specified
    if (campgroundId) {
      this.assertCampgroundAccess(campgroundId, user);
    }
    return this.guests.create(body, { actorId: user?.id, campgroundId });
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() body: Partial<CreateGuestDto>,
    @Query("campgroundId") campgroundId: string,
    @CurrentUser() user?: AuthUser | null
  ) {
    // SECURITY: Require campgroundId to prevent cross-tenant guest modification
    if (!campgroundId) {
      throw new ForbiddenException("campgroundId is required to update a guest");
    }
    // SECURITY: Verify user has access to this campground
    this.assertCampgroundAccess(campgroundId, user);
    return this.guests.update(id, body, { actorId: user?.id, campgroundId });
  }

  @Delete(":id")
  remove(
    @Param("id") id: string,
    @Query("campgroundId") campgroundId: string,
    @CurrentUser() user?: AuthUser | null
  ) {
    // SECURITY: Require campgroundId to prevent cross-tenant guest deletion
    if (!campgroundId) {
      throw new ForbiddenException("campgroundId is required to delete a guest");
    }
    // SECURITY: Verify user has access to this campground
    this.assertCampgroundAccess(campgroundId, user);
    return this.guests.remove(id, { actorId: user?.id, campgroundId });
  }

  @Post("merge")
  merge(
    @Body() body: { primaryId: string; secondaryId: string },
    @Query("campgroundId") campgroundId: string,
    @CurrentUser() user?: AuthUser | null
  ) {
    // SECURITY: Require campgroundId to prevent cross-tenant guest merging
    if (!campgroundId) {
      throw new ForbiddenException("campgroundId is required to merge guests");
    }
    // SECURITY: Verify user has access to this campground
    this.assertCampgroundAccess(campgroundId, user);
    return this.guests.merge(body.primaryId, body.secondaryId, {
      actorId: user?.id,
      campgroundId
    });
  }
}
