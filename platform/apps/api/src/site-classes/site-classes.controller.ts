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
import { SiteClassesService } from "./site-classes.service";
import { CreateSiteClassDto } from "./dto/create-site-class.dto";
import { JwtAuthGuard } from "../auth/guards";
import { RolesGuard } from "../auth/guards/roles.guard";
import { ScopeGuard } from "../permissions/scope.guard";

@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
@Controller()
export class SiteClassesController {
  constructor(private readonly siteClasses: SiteClassesService) { }

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

  @Get("campgrounds/:campgroundId/site-classes")
  list(@Param("campgroundId") campgroundId: string, @Req() req: any) {
    this.assertCampgroundAccess(campgroundId, req.user);
    return this.siteClasses.listByCampground(campgroundId);
  }

  @Get("site-classes/:id")
  getById(
    @Param("id") id: string,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: any
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.siteClasses.findOne(requiredCampgroundId, id);
  }

  @Post("campgrounds/:campgroundId/site-classes")
  create(
    @Param("campgroundId") campgroundId: string,
    @Body() body: Omit<CreateSiteClassDto, "campgroundId">,
    @Req() req: any
  ) {
    this.assertCampgroundAccess(campgroundId, req.user);
    return this.siteClasses.create({ campgroundId, ...body });
  }

  @Patch("site-classes/:id")
  update(
    @Param("id") id: string,
    @Body() body: Partial<CreateSiteClassDto>,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: any
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.siteClasses.update(requiredCampgroundId, id, body);
  }

  @Delete("site-classes/:id")
  remove(
    @Param("id") id: string,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: any
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.siteClasses.remove(requiredCampgroundId, id);
  }
}
