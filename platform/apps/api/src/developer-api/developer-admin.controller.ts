import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiQuery,
} from "@nestjs/swagger";
import { JwtAuthGuard, RolesGuard, ScopeGuard, Roles } from "../auth/guards";
import { UserRole } from "@prisma/client";
import { ApiAuthService } from "./api-auth.service";
import { ApiScope, ApiClientTier, TIER_LIMITS, DEFAULT_TIER_SCOPES } from "./types";
import { IsArray, IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";

class CreateClientDto {
  @IsString()
  @IsNotEmpty()
  campgroundId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsArray()
  @IsOptional()
  scopes?: ApiScope[];

  @IsEnum(ApiClientTier)
  @IsOptional()
  tier?: ApiClientTier;
}

class ToggleClientDto {
  @IsBoolean()
  isActive!: boolean;
}

class UpdateTierDto {
  @IsEnum(ApiClientTier)
  tier!: ApiClientTier;
}

@ApiTags("Developer")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
@Roles(UserRole.owner, UserRole.manager, UserRole.platform_admin)
@Controller("developer/clients")
export class DeveloperAdminController {
  constructor(private readonly apiAuth: ApiAuthService) { }

  private requireCampgroundId(req: any, fallback?: string): string {
    const campgroundId = fallback || req?.campgroundId || req?.headers?.["x-campground-id"];
    if (!campgroundId) {
      throw new BadRequestException("campgroundId is required");
    }
    return campgroundId;
  }

  @Get()
  @ApiOperation({ summary: "List API clients", description: "List all API clients for a campground" })
  @ApiQuery({ name: "campgroundId", required: true, description: "Campground ID" })
  @ApiResponse({ status: 200, description: "List of API clients" })
  list(@Query("campgroundId") campgroundId: string, @Req() req: Request) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    return this.apiAuth.listClients(requiredCampgroundId);
  }

  @Post()
  @ApiOperation({ summary: "Create API client", description: "Create a new API client for a campground" })
  @ApiBody({ type: CreateClientDto })
  @ApiResponse({ status: 201, description: "API client created successfully" })
  async create(@Body() body: CreateClientDto, @Req() req: Request) {
    const requiredCampgroundId = this.requireCampgroundId(req, body.campgroundId);
    return this.apiAuth.createClient({ ...body, campgroundId: requiredCampgroundId });
  }

  @Post(":id/rotate")
  @ApiOperation({ summary: "Rotate client secret", description: "Generate a new client secret" })
  @ApiResponse({ status: 200, description: "New client secret generated" })
  rotate(
    @Param("id") id: string,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: Request
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    return this.apiAuth.rotateSecret(requiredCampgroundId, id);
  }

  @Patch(":id/toggle")
  @ApiOperation({ summary: "Toggle client status", description: "Enable or disable an API client" })
  @ApiBody({ type: ToggleClientDto })
  @ApiResponse({ status: 200, description: "Client status updated" })
  toggle(
    @Param("id") id: string,
    @Body() body: ToggleClientDto,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: Request
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    return this.apiAuth.setClientActive(requiredCampgroundId, id, body.isActive);
  }

  @Patch(":id/tier")
  @ApiOperation({ summary: "Update client tier", description: "Change the tier and associated rate limits for an API client" })
  @ApiBody({ type: UpdateTierDto })
  @ApiResponse({ status: 200, description: "Client tier updated" })
  updateTier(
    @Param("id") id: string,
    @Body() body: UpdateTierDto,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: Request
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    return this.apiAuth.updateClientTier(requiredCampgroundId, id, body.tier);
  }

  @Post("tokens/:id/revoke")
  @ApiOperation({ summary: "Revoke token", description: "Revoke an API token" })
  @ApiResponse({ status: 200, description: "Token revoked" })
  revokeToken(
    @Param("id") id: string,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: Request
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    return this.apiAuth.revokeToken(requiredCampgroundId, id);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete API client", description: "Delete an API client and all its tokens" })
  @ApiResponse({ status: 200, description: "Client deleted" })
  remove(
    @Param("id") id: string,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: Request
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    return this.apiAuth.deleteClient(requiredCampgroundId, id);
  }

  @Get("tiers")
  @ApiOperation({ summary: "Get tier information", description: "Get available tiers and their limits" })
  @ApiResponse({ status: 200, description: "Tier information" })
  getTiers() {
    return {
      tiers: Object.values(ApiClientTier).map(tier => ({
        tier,
        limits: TIER_LIMITS[tier],
        defaultScopes: DEFAULT_TIER_SCOPES[tier],
      })),
    };
  }
}
