import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, ForbiddenException, NotFoundException } from "@nestjs/common";
import { SitesService } from "./sites.service";
import { CreateSiteDto } from "./dto/create-site.dto";
import { JwtAuthGuard, RolesGuard, ScopeGuard } from "../auth/guards";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/guards/roles.guard";
import { UserRole } from "@prisma/client";

@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
@Controller()
export class SitesController {
  constructor(private readonly sites: SitesService) { }

  @Get("campgrounds/:campgroundId/sites")
  list(
    @Param("campgroundId") campgroundId: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("isActive") isActive?: string
  ) {
    return this.sites.listByCampground(campgroundId, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined
    });
  }

  @Get("sites/:id")
  getById(@Param("id") id: string) {
    return this.sites.findOne(id);
  }

  @Get("sites/:id/availability/now")
  checkAvailability(@Param("id") id: string) {
    return this.sites.checkAvailability(id);
  }

  @Post("campgrounds/:campgroundId/sites")
  @Roles(UserRole.owner, UserRole.manager)
  create(@Param("campgroundId") campgroundId: string, @Body() body: Omit<CreateSiteDto, "campgroundId">) {
    return this.sites.create({ campgroundId, ...body });
  }

  @Patch("campgrounds/:campgroundId/sites/:id")
  @Roles(UserRole.owner, UserRole.manager)
  async update(
    @Param("campgroundId") campgroundId: string,
    @Param("id") id: string,
    @Body() body: Partial<CreateSiteDto>,
    @CurrentUser() user: any
  ) {
    // SECURITY: Verify site belongs to campground before update
    const site = await this.sites.findOne(id);
    if (!site) {
      throw new NotFoundException(`Site ${id} not found`);
    }
    if (site.campgroundId !== campgroundId) {
      throw new ForbiddenException("Site does not belong to this campground");
    }
    return this.sites.update(id, body);
  }

  @Delete("campgrounds/:campgroundId/sites/:id")
  @Roles(UserRole.owner, UserRole.manager)
  async remove(
    @Param("campgroundId") campgroundId: string,
    @Param("id") id: string,
    @CurrentUser() user: any
  ) {
    // SECURITY: Verify site belongs to campground before delete
    const site = await this.sites.findOne(id);
    if (!site) {
      throw new NotFoundException(`Site ${id} not found`);
    }
    if (site.campgroundId !== campgroundId) {
      throw new ForbiddenException("Site does not belong to this campground");
    }
    return this.sites.remove(id);
  }
}
