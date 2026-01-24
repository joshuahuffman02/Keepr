import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiTokenGuard } from "./guards/api-token.guard";
import { ApiScopeGuard } from "./guards/api-scope.guard";
import { ApiScopes } from "./decorators/api-scopes.decorator";
import { PublicApiService } from "./public-api.service";
import { IsEmail, IsOptional, IsString } from "class-validator";
import type { Request } from "express";
import type { ApiPrincipal } from "./types";

class CreateGuestBody {
  @IsString() primaryFirstName!: string;
  @IsString() primaryLastName!: string;
  @IsEmail() email!: string;
  @IsString() @IsOptional() phone?: string;
}

class UpdateGuestBody {
  @IsString() @IsOptional() primaryFirstName?: string;
  @IsString() @IsOptional() primaryLastName?: string;
  @IsEmail() @IsOptional() email?: string;
  @IsString() @IsOptional() phone?: string;
}

type ApiRequest = Request & { apiPrincipal: ApiPrincipal };

@Controller("developer/guests")
@UseGuards(ApiTokenGuard, ApiScopeGuard)
export class PublicGuestsController {
  constructor(private readonly api: PublicApiService) {}

  @Get()
  @ApiScopes("guests:read")
  list(@Req() req: ApiRequest) {
    const campgroundId = req.apiPrincipal.campgroundId;
    return this.api.listGuests(campgroundId);
  }

  @Get(":id")
  @ApiScopes("guests:read")
  get(@Req() req: ApiRequest, @Param("id") id: string) {
    const campgroundId = req.apiPrincipal.campgroundId;
    return this.api.getGuest(campgroundId, id);
  }

  @Post()
  @ApiScopes("guests:write")
  create(@Req() req: ApiRequest, @Body() body: CreateGuestBody) {
    const campgroundId = req.apiPrincipal.campgroundId;
    return this.api.createGuest(campgroundId, body);
  }

  @Patch(":id")
  @ApiScopes("guests:write")
  update(@Req() req: ApiRequest, @Param("id") id: string, @Body() body: UpdateGuestBody) {
    const campgroundId = req.apiPrincipal.campgroundId;
    return this.api.updateGuest(campgroundId, id, body);
  }

  @Delete(":id")
  @ApiScopes("guests:write")
  remove(@Req() req: ApiRequest, @Param("id") id: string) {
    const campgroundId = req.apiPrincipal.campgroundId;
    return this.api.deleteGuest(campgroundId, id);
  }
}
