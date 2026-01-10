import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiTokenGuard } from "./guards/api-token.guard";
import { ApiScopeGuard } from "./guards/api-scope.guard";
import { ApiScopes } from "./decorators/api-scopes.decorator";
import { PublicApiService } from "./public-api.service";
import { IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";
import { ApiTags, ApiOperation, ApiResponse, ApiProperty } from "@nestjs/swagger";

class CreateSiteBody {
  @ApiProperty({ description: "Name of the site" })
  @IsString() @IsNotEmpty() name!: string;

  @ApiProperty({ description: "Site number/identifier" })
  @IsString() @IsNotEmpty() siteNumber!: string;

  @ApiProperty({ description: "Type of site (e.g. 'rv', 'tent', 'cabin')" })
  @IsString() @IsNotEmpty() siteType!: string;

  @ApiProperty({ description: "Maximum occupancy" })
  @IsNumber() maxOccupancy!: number;

  @ApiProperty({ description: "Max rig length in feet", required: false, nullable: true })
  @IsNumber() @IsOptional() rigMaxLength?: number | null;
}

class UpdateSiteBody {
  @ApiProperty({ description: "Name of the site", required: false })
  @IsString() @IsOptional() name?: string;

  @ApiProperty({ description: "Site number/identifier", required: false })
  @IsString() @IsOptional() siteNumber?: string;

  @ApiProperty({ description: "Type of site", required: false })
  @IsString() @IsOptional() siteType?: string;

  @ApiProperty({ description: "Maximum occupancy", required: false })
  @IsNumber() @IsOptional() maxOccupancy?: number;

  @ApiProperty({ description: "Max rig length in feet", required: false, nullable: true })
  @IsNumber() @IsOptional() rigMaxLength?: number | null;
}

@ApiTags("Sites")
@Controller("developer/sites")
@UseGuards(ApiTokenGuard, ApiScopeGuard)
export class PublicSitesController {
  constructor(private readonly api: PublicApiService) { }

  @Get()
  @ApiScopes("sites:read")
  @ApiOperation({ summary: "List sites" })
  @ApiResponse({ status: 200, description: "List of sites" })
  list(@Req() req: Request) {
    const campgroundId = req.apiPrincipal.campgroundId;
    return this.api.listSites(campgroundId);
  }

  @Get(":id")
  @ApiScopes("sites:read")
  @ApiOperation({ summary: "Get a site" })
  @ApiResponse({ status: 200, description: "Site details" })
  @ApiResponse({ status: 404, description: "Site not found" })
  get(@Req() req: Request, @Param("id") id: string) {
    const campgroundId = req.apiPrincipal.campgroundId;
    return this.api.getSite(campgroundId, id);
  }

  @Post()
  @ApiScopes("sites:write")
  @ApiOperation({ summary: "Create a site" })
  @ApiResponse({ status: 201, description: "Site created" })
  create(@Req() req: Request, @Body() body: CreateSiteBody) {
    const campgroundId = req.apiPrincipal.campgroundId;
    return this.api.createSite(campgroundId, body);
  }

  @Patch(":id")
  @ApiScopes("sites:write")
  @ApiOperation({ summary: "Update a site" })
  @ApiResponse({ status: 200, description: "Site updated" })
  update(@Req() req: Request, @Param("id") id: string, @Body() body: UpdateSiteBody) {
    const campgroundId = req.apiPrincipal.campgroundId;
    return this.api.updateSite(campgroundId, id, body);
  }

  @Delete(":id")
  @ApiScopes("sites:write")
  @ApiOperation({ summary: "Delete a site" })
  @ApiResponse({ status: 200, description: "Site deleted" })
  remove(@Req() req: Request, @Param("id") id: string) {
    const campgroundId = req.apiPrincipal.campgroundId;
    return this.api.deleteSite(campgroundId, id);
  }
}

