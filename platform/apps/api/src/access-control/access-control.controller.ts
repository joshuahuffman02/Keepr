import { Body, Controller, Get, Headers, Param, Post, Req, UseGuards } from "@nestjs/common";
import { AccessProviderType } from "@prisma/client";
import { AccessControlService } from "./access-control.service";
import { GrantAccessDto, RevokeAccessDto } from "./dto/access-grant.dto";
import { UpsertVehicleDto } from "./dto/vehicle.dto";
import { UpsertAccessIntegrationDto } from "./dto/access-integration.dto";
import { JwtAuthGuard } from "../auth/guards";

@Controller()
export class AccessControlController {
  constructor(private readonly service: AccessControlService) {}

  @UseGuards(JwtAuthGuard)
  @Get("/reservations/:reservationId/access")
  getStatus(@Param("reservationId") reservationId: string) {
    return this.service.getAccessStatus(reservationId);
  }

  @UseGuards(JwtAuthGuard)
  @Post("/reservations/:reservationId/access/vehicle")
  upsertVehicle(@Param("reservationId") reservationId: string, @Body() dto: UpsertVehicleDto) {
    return this.service.upsertVehicle(reservationId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post("/reservations/:reservationId/access/grant")
  grant(@Param("reservationId") reservationId: string, @Body() dto: GrantAccessDto) {
    return this.service.grantAccess(reservationId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post("/reservations/:reservationId/access/revoke")
  revoke(@Param("reservationId") reservationId: string, @Body() dto: RevokeAccessDto) {
    return this.service.revokeAccess(reservationId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get("/access/providers")
  listProviders(@Req() req: any) {
    return this.service.listIntegrations(req.user?.campgroundId ?? req.campgroundId ?? null);
  }

  @UseGuards(JwtAuthGuard)
  @Post("/access/providers/:provider/config")
  upsertProvider(
    @Param("provider") provider: AccessProviderType,
    @Body() dto: UpsertAccessIntegrationDto,
    @Req() req: any
  ) {
    return this.service.upsertIntegration(req.user?.campgroundId ?? req.campgroundId ?? null, {
      ...dto,
      provider
    });
  }

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
