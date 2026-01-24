import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards";
import {
  TriggerPosSyncDto,
  UpsertPosProviderDto,
  ValidatePosProviderDto,
} from "./pos-provider.dto";
import { PosProviderService } from "./pos-provider.service";
import type { Request } from "express";

type AuthRequest = Request & { user?: { campgroundId?: string; id?: string } };
type WebhookRequest = Request & { rawBody?: Buffer };

@Controller("pos/providers")
export class PosProviderController {
  constructor(private readonly service: PosProviderService) {}

  private requireCampgroundId(req: AuthRequest): string {
    const campgroundId = req.user?.campgroundId;
    if (!campgroundId) {
      throw new UnauthorizedException("campgroundId is required");
    }
    return campgroundId;
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  list(@Req() req: AuthRequest) {
    const campgroundId = this.requireCampgroundId(req);
    return this.service.listIntegrations(campgroundId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(":provider/config")
  configure(
    @Param("provider") provider: string,
    @Body() dto: UpsertPosProviderDto,
    @Req() req: AuthRequest,
  ) {
    const campgroundId = this.requireCampgroundId(req);
    return this.service.upsertIntegration(campgroundId, provider, dto, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post(":provider/validate")
  validate(
    @Param("provider") provider: string,
    @Body() dto: ValidatePosProviderDto,
    @Req() req: AuthRequest,
  ) {
    const campgroundId = this.requireCampgroundId(req);
    return this.service.validateCredentials(campgroundId, provider, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get(":provider/status")
  status(@Param("provider") provider: string, @Req() req: AuthRequest) {
    const campgroundId = this.requireCampgroundId(req);
    return this.service.syncStatus(campgroundId, provider);
  }

  @UseGuards(JwtAuthGuard)
  @Post(":provider/sync")
  triggerSync(
    @Param("provider") provider: string,
    @Body() dto: TriggerPosSyncDto,
    @Req() req: AuthRequest,
  ) {
    const campgroundId = this.requireCampgroundId(req);
    return this.service.syncIntegration(campgroundId, provider, dto.target);
  }

  @Post(":provider/webhook/:campgroundId")
  webhook(
    @Param("provider") provider: string,
    @Param("campgroundId") campgroundId: string,
    @Body() body: unknown,
    @Req() req: WebhookRequest,
  ) {
    const rawBody = req.rawBody ? req.rawBody.toString() : JSON.stringify(body ?? {});
    return this.service.handleWebhook(provider, campgroundId, body, req.headers, rawBody);
  }
}
