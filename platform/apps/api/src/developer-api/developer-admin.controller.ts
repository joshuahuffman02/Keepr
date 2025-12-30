import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiQuery,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards";
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
@UseGuards(JwtAuthGuard)
@Controller("developer/clients")
export class DeveloperAdminController {
  constructor(private readonly apiAuth: ApiAuthService) { }

  @Get()
  @ApiOperation({ summary: "List API clients", description: "List all API clients for a campground" })
  @ApiQuery({ name: "campgroundId", required: true, description: "Campground ID" })
  @ApiResponse({ status: 200, description: "List of API clients" })
  list(@Query("campgroundId") campgroundId: string) {
    return this.apiAuth.listClients(campgroundId);
  }

  @Post()
  @ApiOperation({ summary: "Create API client", description: "Create a new API client for a campground" })
  @ApiBody({ type: CreateClientDto })
  @ApiResponse({ status: 201, description: "API client created successfully" })
  async create(@Body() body: CreateClientDto) {
    return this.apiAuth.createClient(body);
  }

  @Post(":id/rotate")
  @ApiOperation({ summary: "Rotate client secret", description: "Generate a new client secret" })
  @ApiResponse({ status: 200, description: "New client secret generated" })
  rotate(@Param("id") id: string) {
    return this.apiAuth.rotateSecret(id);
  }

  @Patch(":id/toggle")
  @ApiOperation({ summary: "Toggle client status", description: "Enable or disable an API client" })
  @ApiBody({ type: ToggleClientDto })
  @ApiResponse({ status: 200, description: "Client status updated" })
  toggle(@Param("id") id: string, @Body() body: ToggleClientDto) {
    return this.apiAuth.setClientActive(id, body.isActive);
  }

  @Patch(":id/tier")
  @ApiOperation({ summary: "Update client tier", description: "Change the tier and associated rate limits for an API client" })
  @ApiBody({ type: UpdateTierDto })
  @ApiResponse({ status: 200, description: "Client tier updated" })
  updateTier(@Param("id") id: string, @Body() body: UpdateTierDto) {
    return this.apiAuth.updateClientTier(id, body.tier);
  }

  @Post("tokens/:id/revoke")
  @ApiOperation({ summary: "Revoke token", description: "Revoke an API token" })
  @ApiResponse({ status: 200, description: "Token revoked" })
  revokeToken(@Param("id") id: string) {
    return this.apiAuth.revokeToken(id);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete API client", description: "Delete an API client and all its tokens" })
  @ApiResponse({ status: 200, description: "Client deleted" })
  remove(@Param("id") id: string) {
    return this.apiAuth.deleteClient(id);
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

