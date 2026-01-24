import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, RolesGuard, Roles } from "../auth/guards";
import { PlatformRole } from "@prisma/client";
import { FeatureFlagService } from "./feature-flag.service";

class CreateFeatureFlagDto {
  key!: string;
  name!: string;
  description?: string;
  enabled?: boolean;
  scope?: "global" | "campground";
  campgrounds?: string[];
}

class UpdateFeatureFlagDto {
  name?: string;
  description?: string;
  enabled?: boolean;
  scope?: "global" | "campground";
  campgrounds?: string[];
}

@Controller("admin/flags")
@UseGuards(JwtAuthGuard, RolesGuard)
export class FeatureFlagController {
  constructor(private readonly flags: FeatureFlagService) {}

  @Get()
  @Roles(PlatformRole.platform_admin, PlatformRole.support_agent, PlatformRole.support_lead)
  async list() {
    return this.flags.findAll();
  }

  @Get(":id")
  @Roles(PlatformRole.platform_admin, PlatformRole.support_agent, PlatformRole.support_lead)
  async get(@Param("id") id: string) {
    return this.flags.findOne(id);
  }

  @Post()
  @Roles(PlatformRole.platform_admin)
  async create(@Body() dto: CreateFeatureFlagDto) {
    return this.flags.create(dto);
  }

  @Patch(":id")
  @Roles(PlatformRole.platform_admin)
  async update(@Param("id") id: string, @Body() dto: UpdateFeatureFlagDto) {
    return this.flags.update(id, dto);
  }

  @Patch(":id/toggle")
  @Roles(PlatformRole.platform_admin)
  async toggle(@Param("id") id: string) {
    return this.flags.toggle(id);
  }

  @Delete(":id")
  @Roles(PlatformRole.platform_admin)
  async delete(@Param("id") id: string) {
    return this.flags.delete(id);
  }
}
