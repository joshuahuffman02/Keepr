import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  ForbiddenException,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards";
import { SupportService } from "./support.service";
import { CreateSupportReportDto } from "./dto/create-support-report.dto";
import { UpdateSupportReportDto } from "./dto/update-support-report.dto";
import { UpdateStaffScopeDto } from "./dto/update-staff-scope.dto";
import { ScopeGuard } from "../permissions/scope.guard";
import { RequireScope } from "../permissions/scope.decorator";
import type { Request } from "express";
import type { AuthUser } from "../auth/auth.types";

const PLATFORM_SUPPORT_ROLES = [
  "support_agent",
  "support_lead",
  "regional_support",
  "platform_admin",
];

type AuthRequest = Request & { user: AuthUser };

const getStringValue = (value: unknown): string | null => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === "string" ? first : null;
  }
  return null;
};

@Controller("support/reports")
export class SupportController {
  constructor(private readonly support: SupportService) {}

  private canAct(user: AuthUser | undefined) {
    const membershipRole = user?.role ?? null;
    const platformRole = user?.platformRole ?? null;
    const platformOk = Boolean(platformRole && PLATFORM_SUPPORT_ROLES.includes(platformRole));
    const membershipOk = Boolean(
      membershipRole && ["owner", "manager", "support"].includes(membershipRole),
    );
    return platformOk || membershipOk;
  }

  private regionAllowed(user: AuthUser | undefined, targetRegion: string | null) {
    if (!targetRegion) return true;
    if (user?.platformRegion) return user.platformRegion === targetRegion;
    if (user?.region) return user.region === targetRegion;
    return true;
  }

  @Post()
  @UseGuards(JwtAuthGuard, ScopeGuard)
  @RequireScope({ resource: "support", action: "write" })
  async create(@Body() dto: CreateSupportReportDto, @Req() req: AuthRequest) {
    if (!this.canAct(req.user)) {
      throw new ForbiddenException();
    }
    const authorId = req.user.id;
    return this.support.create(dto, authorId);
  }

  @UseGuards(JwtAuthGuard, ScopeGuard)
  @RequireScope({ resource: "support", action: "read" })
  @Get()
  async list(@Req() req: AuthRequest) {
    if (!this.canAct(req.user)) {
      throw new ForbiddenException();
    }
    const requestedRegion = getStringValue(req.query?.region) ?? null;
    if (!this.regionAllowed(req.user, requestedRegion)) {
      throw new ForbiddenException("Forbidden by region scope");
    }
    const region = requestedRegion ?? req.user.platformRegion ?? req.user.region ?? null;
    const campgroundId = getStringValue(req.query?.campgroundId) ?? null;
    return this.support.findAll({ region, campgroundId });
  }

  @UseGuards(JwtAuthGuard, ScopeGuard)
  @RequireScope({ resource: "support", action: "write" })
  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateSupportReportDto,
    @Req() req: AuthRequest,
  ) {
    if (!this.canAct(req.user)) {
      throw new ForbiddenException();
    }
    const actorCampgrounds = req.user.memberships.map((membership) => membership.campgroundId);
    return this.support.update(
      id,
      dto,
      req.user.id,
      req.user.platformRegion ?? req.user.region ?? null,
      actorCampgrounds,
      this.canAct(req.user) && PLATFORM_SUPPORT_ROLES.includes(req.user.platformRole ?? ""),
    );
  }

  @UseGuards(JwtAuthGuard, ScopeGuard)
  @RequireScope({ resource: "support", action: "read" })
  @Get("/staff/directory")
  async staffDirectory(@Req() req: AuthRequest) {
    const requestedRegion = getStringValue(req.query?.region) ?? null;
    const campgroundId = getStringValue(req.query?.campgroundId) ?? null;
    const userRegion = req.user.platformRegion ?? req.user.region ?? null;
    if (requestedRegion && userRegion && requestedRegion !== userRegion) {
      throw new ForbiddenException("Forbidden by region scope");
    }
    return this.support.staffDirectory({ region: requestedRegion ?? null, campgroundId });
  }

  @UseGuards(JwtAuthGuard, ScopeGuard)
  @RequireScope({ resource: "support", action: "assign" })
  @Patch("/staff/:id/scope")
  async updateStaffScope(
    @Param("id") id: string,
    @Body() dto: UpdateStaffScopeDto,
    @Req() req: AuthRequest,
  ) {
    if (!this.canAct(req.user)) {
      throw new ForbiddenException();
    }
    const userRegion = req.user.platformRegion ?? req.user.region ?? null;
    if (dto.region && userRegion && dto.region !== userRegion) {
      throw new ForbiddenException("Forbidden by region scope");
    }
    return this.support.updateStaffScope(id, dto);
  }
}
