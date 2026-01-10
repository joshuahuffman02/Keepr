import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards, ForbiddenException } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards";
import { SupportService } from "./support.service";
import { CreateSupportReportDto } from "./dto/create-support-report.dto";
import { UpdateSupportReportDto } from "./dto/update-support-report.dto";
import { UpdateStaffScopeDto } from "./dto/update-staff-scope.dto";
import { ScopeGuard } from "../permissions/scope.guard";
import { RequireScope } from "../permissions/scope.decorator";

const PLATFORM_SUPPORT_ROLES = ["support_agent", "support_lead", "regional_support", "platform_admin"];

@Controller("support/reports")
export class SupportController {
  constructor(private readonly support: SupportService) {}

  private canAct(user: any) {
    const membershipRole = user?.role;
    const platformRole = user?.platformRole;
    const platformOk = platformRole && PLATFORM_SUPPORT_ROLES.includes(platformRole);
    const membershipOk = membershipRole && ["owner", "manager", "support"].includes(membershipRole);
    return platformOk || membershipOk;
  }

  private regionAllowed(user: any, targetRegion: string | null) {
    if (!targetRegion) return true;
    if (user?.platformRegion) return user.platformRegion === targetRegion;
    if (user?.region) return user.region === targetRegion;
    return true;
  }

  @Post()
  @UseGuards(JwtAuthGuard, ScopeGuard)
  @RequireScope({ resource: "support", action: "write" })
  async create(@Body() dto: CreateSupportReportDto, @Req() req: Request) {
    if (!this.canAct(req?.user)) {
      throw new ForbiddenException();
    }
    const authorId = req?.user?.id;
    return this.support.create(dto, authorId);
  }

  @UseGuards(JwtAuthGuard, ScopeGuard)
  @RequireScope({ resource: "support", action: "read" })
  @Get()
  async list(@Req() req: Request) {
    if (!this.canAct(req?.user)) {
      throw new ForbiddenException();
    }
    const requestedRegion = req?.query?.region ?? null;
    if (!this.regionAllowed(req?.user, requestedRegion)) {
      throw new ForbiddenException("Forbidden by region scope");
    }
    const region = requestedRegion ?? req?.user?.platformRegion ?? req?.user?.region ?? null;
    const campgroundId = req?.query?.campgroundId ?? null;
    return this.support.findAll({ region, campgroundId });
  }

  @UseGuards(JwtAuthGuard, ScopeGuard)
  @RequireScope({ resource: "support", action: "write" })
  @Patch(":id")
  async update(@Param("id") id: string, @Body() dto: UpdateSupportReportDto, @Req() req: Request) {
    if (!this.canAct(req?.user)) {
      throw new ForbiddenException();
    }
    const actorCampgrounds = req?.user?.memberships?.map((m: any) => m.campgroundId) ?? [];
    return this.support.update(
      id,
      dto,
      req?.user?.id,
      req?.user?.platformRegion ?? req?.user?.region ?? null,
      actorCampgrounds,
      this.canAct(req?.user) && PLATFORM_SUPPORT_ROLES.includes(req?.user?.platformRole)
    );
  }

  @UseGuards(JwtAuthGuard, ScopeGuard)
  @RequireScope({ resource: "support", action: "read" })
  @Get("/staff/directory")
  async staffDirectory(@Req() req: Request) {
    const requestedRegion = req?.query?.region ?? null;
    const campgroundId = req?.query?.campgroundId ?? null;
    const userRegion = req?.user?.platformRegion ?? req?.user?.region ?? null;
    if (requestedRegion && userRegion && requestedRegion !== userRegion) {
      throw new ForbiddenException("Forbidden by region scope");
    }
    return this.support.staffDirectory({ region: requestedRegion ?? null, campgroundId });
  }

  @UseGuards(JwtAuthGuard, ScopeGuard)
  @RequireScope({ resource: "support", action: "assign" })
  @Patch("/staff/:id/scope")
  async updateStaffScope(@Param("id") id: string, @Body() dto: UpdateStaffScopeDto, @Req() req: Request) {
    if (!this.canAct(req?.user)) {
      throw new ForbiddenException();
    }
    const userRegion = req?.user?.platformRegion ?? req?.user?.region ?? null;
    if (dto.region && userRegion && dto.region !== userRegion) {
      throw new ForbiddenException("Forbidden by region scope");
    }
    return this.support.updateStaffScope(id, dto);
  }
}

