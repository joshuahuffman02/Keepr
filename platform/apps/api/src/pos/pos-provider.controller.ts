import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards";
import { TriggerPosSyncDto, UpsertPosProviderDto, ValidatePosProviderDto } from "./pos-provider.dto";
import { PosProviderService } from "./pos-provider.service";

@Controller("pos/providers")
export class PosProviderController {
  constructor(private readonly service: PosProviderService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  list(@Req() req: any) {
    return this.service.listIntegrations(req.user?.campgroundId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(":provider/config")
  configure(@Param("provider") provider: string, @Body() dto: UpsertPosProviderDto, @Req() req: any) {
    return this.service.upsertIntegration(req.user?.campgroundId, provider, dto, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post(":provider/validate")
  validate(@Param("provider") provider: string, @Body() dto: ValidatePosProviderDto, @Req() req: any) {
    return this.service.validateCredentials(req.user?.campgroundId, provider, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get(":provider/status")
  status(@Param("provider") provider: string, @Req() req: any) {
    return this.service.syncStatus(req.user?.campgroundId, provider);
  }

  @UseGuards(JwtAuthGuard)
  @Post(":provider/sync")
  triggerSync(@Param("provider") provider: string, @Body() dto: TriggerPosSyncDto, @Req() req: any) {
    return this.service.syncIntegration(req.user?.campgroundId, provider, dto.target as any);
  }

  @Post(":provider/webhook/:campgroundId")
  webhook(@Param("provider") provider: string, @Param("campgroundId") campgroundId: string, @Body() body: any, @Req() req: any) {
    const rawBody = (req as any).rawBody ? (req as any).rawBody.toString() : JSON.stringify(body ?? {});
    return this.service.handleWebhook(provider, campgroundId, body, req.headers, rawBody);
  }
}
