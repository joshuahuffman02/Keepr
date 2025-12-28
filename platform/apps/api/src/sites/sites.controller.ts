import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { SitesService } from "./sites.service";
import { CreateSiteDto } from "./dto/create-site.dto";
import { JwtAuthGuard } from "../auth/guards";

@UseGuards(JwtAuthGuard)
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

  getById(@Param("id") id: string) {
    return this.sites.findOne(id);
  }

  @Get("sites/:id/availability/now")
  checkAvailability(@Param("id") id: string) {
    return this.sites.checkAvailability(id);
  }

  @Post("campgrounds/:campgroundId/sites")
  create(@Param("campgroundId") campgroundId: string, @Body() body: Omit<CreateSiteDto, "campgroundId">) {
    return this.sites.create({ campgroundId, ...body });
  }

  @Patch("sites/:id")
  update(@Param("id") id: string, @Body() body: Partial<CreateSiteDto>) {
    return this.sites.update(id, body);
  }

  @Delete("sites/:id")
  remove(@Param("id") id: string) {
    return this.sites.remove(id);
  }
}
