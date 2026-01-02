import { Body, Controller, Get, Headers, Param, Post, Req, UseGuards, Query, BadRequestException } from "@nestjs/common";
import { AccessProviderType, UserRole } from "@prisma/client";
import { AccessControlService } from "./access-control.service";
import { GrantAccessDto, RevokeAccessDto } from "./dto/access-grant.dto";
import { UpsertVehicleDto } from "./dto/vehicle.dto";
import { UpsertAccessIntegrationDto } from "./dto/access-integration.dto";
import { JwtAuthGuard, RolesGuard, Roles } from "../auth/guards";
import { ScopeGuard } from "../permissions/scope.guard";

@Controller()
export class AccessControlController {
  constructor(private readonly service: AccessControlService) {}

  private requireCampgroundId(req: any, fallback?: string): string {
    const campgroundId = fallback || req?.campgroundId || req?.headers?.["x-campground-id"];
    if (!campgroundId) {
      throw new BadRequestException("campgroundId is required");
    }
    return campgroundId;
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Get("/reservations/:reservationId/access")
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  getStatus(
    @Param("reservationId") reservationId: string,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: any
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    return this.service.getAccessStatus(reservationId, requiredCampgroundId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Post("/reservations/:reservationId/access/vehicle")
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  upsertVehicle(
    @Param("reservationId") reservationId: string,
    @Body() dto: UpsertVehicleDto,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: any
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    return this.service.upsertVehicle(reservationId, dto, requiredCampgroundId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Post("/reservations/:reservationId/access/grant")
  @Roles(UserRole.owner, UserRole.manager)
  grant(
    @Param("reservationId") reservationId: string,
    @Body() dto: GrantAccessDto,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: any
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    return this.service.grantAccess(reservationId, dto, requiredCampgroundId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Post("/reservations/:reservationId/access/revoke")
  @Roles(UserRole.owner, UserRole.manager)
  revoke(
    @Param("reservationId") reservationId: string,
    @Body() dto: RevokeAccessDto,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: any
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    return this.service.revokeAccess(reservationId, dto, requiredCampgroundId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Get("/access/providers")
  @Roles(UserRole.owner, UserRole.manager)
  listProviders(
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: any
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    return this.service.listIntegrations(requiredCampgroundId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Post("/access/providers/:provider/config")
  @Roles(UserRole.owner)
  upsertProvider(
    @Param("provider") provider: AccessProviderType,
    @Body() dto: UpsertAccessIntegrationDto,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: any
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    return this.service.upsertIntegration(requiredCampgroundId, {
      ...dto,
      provider
    });
  }

  // Webhook endpoint - no auth (called by external access control providers)
  @Post("/access/webhooks/:provider")
  async webhook(
    @Param("provider") provider: AccessProviderType,
    @Body() body: any,
    @Headers("x-signature") signature: string | undefined,
    @Req() req: any
  ) {
    const rawBody = req.rawBody ? req.rawBody.toString() : JSON.stringify(body ?? {});
    const acknowledged = await this.service.verifyWebhook(
      provider,
      signature ?? (body?.signature as string | undefined),
      rawBody,
      req.headers["x-campground-id"] as string | undefined
    );
    return { acknowledged, provider };
  }
}
